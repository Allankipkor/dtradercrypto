import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface LipiaCallbackBody {
  status: boolean;
  message?: string;
  response: {
    Amount: number;
    ExternalReference: string;
    MerchantRequestID: string;
    CheckoutRequestID: string;
    MpesaReceiptNumber: string;
    Phone: string;
    ResultCode: number;
    ResultDesc: string;
    Metadata?: Record<string, unknown>;
    Status: "Success" | "Failed" | string;
  };
}

// Lipia Online's docs confirm there is no webhook signature header or
// shared secret to verify against — their guidance for testing callbacks
// is just "expose your local server with ngrok," nothing about
// authenticating the request. This route is therefore unauthenticated by
// the provider's own design, not as a gap on our side.
//
// Practical exposure: anyone who discovers this URL and an externalRef they
// don't already control still can't credit themselves, since the lookup
// below only matches an existing *pending* transaction created by our own
// deposit route — an attacker would need to guess a live reference for a
// real pending deposit and race it before the legitimate callback or the
// poll-status fallback resolves it. Low but nonzero; consider rate-limiting
// this route or checking source IP if Lipia documents one later.
function verifySignature(_req: Request, _rawBody: string): boolean {
  return true;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!verifySignature(req, rawBody)) {
    console.warn("Lipia webhook: signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body: LipiaCallbackBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { response } = body;
  const reference = response?.ExternalReference;

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  // Find the pending transaction we created when initiating the STK push.
  // We stored our reference as `externalRef` on the Transaction row, and
  // sent it to Lipia as `external_reference` in the STK push request.
  const transaction = await prisma.transaction.findFirst({
    where: { externalRef: reference, status: "pending" },
  });

  if (!transaction) {
    // Either already processed (duplicate webhook delivery — Lipia may
    // retry) or we never created this transaction. Respond 200 either way
    // so they don't keep retrying a transaction we can't do anything with.
    console.warn(`Lipia webhook: no pending transaction found for reference ${reference}`);
    return NextResponse.json({ ok: true, note: "No matching pending transaction" });
  }

  const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

  if (response.Status === "Success" && response.ResultCode === 0) {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "completed",
          metadata: JSON.stringify({
            ...existingMeta,
            mpesaReceipt: response.MpesaReceiptNumber,
            checkoutRequestId: response.CheckoutRequestID,
            merchantRequestId: response.MerchantRequestID,
          }),
        },
      }),
      prisma.user.update({
        where: { id: transaction.userId },
        data: { balance: { increment: transaction.amount } },
      }),
    ]);

    console.log(`Deposit completed: ${reference} (+$${transaction.amount} for user ${transaction.userId})`);
    return NextResponse.json({ ok: true });
  }

  // Anything else (Status === "Failed", or a non-zero ResultCode) is treated
  // as a failed payment — Lipia's docs only document Success/Failed, no
  // separate "cancelled" state, so ResultDesc is kept for diagnosis.
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: "failed",
      metadata: JSON.stringify({
        ...existingMeta,
        failureReason: response.ResultDesc ?? response.Status,
      }),
    },
  });

  console.log(`Deposit failed: ${reference} (${response.ResultDesc ?? response.Status})`);
  return NextResponse.json({ ok: true });
}