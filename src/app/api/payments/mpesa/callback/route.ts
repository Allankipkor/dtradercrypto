import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

interface GravityPayWebhookBody {
  type: string;
  transactionId: string;
  data: {
    amount: number;
    mpesaReceipt?: string;
    phoneNumber?: string;
    reference: string;
    checkoutRequestId?: string;
    paidAt?: string;
    failureReason?: string;
  };
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // Use a timing-safe comparison to avoid leaking info via response-time differences
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export async function POST(req: Request) {
  const secret = process.env.GRAVITYPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("GRAVITYPAY_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // IMPORTANT: read the raw text body first — signature was computed over the
  // exact bytes GravityPay sent, not a re-stringified version of parsed JSON.
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature");

  if (!verifySignature(rawBody, signature, secret)) {
    console.warn("GravityPay webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body: GravityPayWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, data } = body;
  const reference = data?.reference;

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  // Find the pending transaction we created when initiating the STK push.
  // We stored our reference as `externalRef` on the Transaction row.
  const transaction = await prisma.transaction.findFirst({
    where: { externalRef: reference, status: "pending" },
  });

  if (!transaction) {
    // Either already processed (duplicate webhook delivery — GravityPay may
    // retry) or we never created this transaction. Respond 200 either way
    // so they don't keep retrying a transaction we can't do anything with.
    console.warn(`GravityPay webhook: no pending transaction found for reference ${reference}`);
    return NextResponse.json({ ok: true, note: "No matching pending transaction" });
  }

  if (type === "PAYMENT_SUCCESS") {
    const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "completed",
          metadata: JSON.stringify({
            ...existingMeta,
            mpesaReceipt: data.mpesaReceipt,
            paidAt: data.paidAt,
            checkoutRequestId: data.checkoutRequestId,
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

  if (type === "PAYMENT_FAILED" || type === "PAYMENT_CANCELLED") {
    const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "failed",
        metadata: JSON.stringify({
          ...existingMeta,
          failureReason: data.failureReason ?? type,
        }),
      },
    });

    console.log(`Deposit failed: ${reference} (${data.failureReason ?? type})`);
    return NextResponse.json({ ok: true });
  }

  // Unknown event type — acknowledge so they don't retry, but log it for visibility
  console.warn(`GravityPay webhook: unhandled event type "${type}" for reference ${reference}`);
  return NextResponse.json({ ok: true, note: "Unhandled event type" });
}