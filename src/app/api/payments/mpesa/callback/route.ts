import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkStkStatus } from "@/lib/mpesa";

interface CallbackBody {
  status?: string | boolean;
  Status?: string;
  message?: string;
  external_reference?: string;
  ExternalReference?: string;
  checkout_request_id?: string;
  CheckoutRequestID?: string;
  transaction_id?: string;
  mpesa_receipt_number?: string;
  MpesaReceiptNumber?: string;
  mpesaReceiptNumber?: string;
  mpesaReceipt?: string;
  reference?: string;
  MerchantRequestID?: string;
  ResultDesc?: string;
  ResultDescription?: string;
  response?: {
    ExternalReference?: string;
    Status?: string;
    CheckoutRequestID?: string;
    MerchantRequestID?: string;
    MpesaReceiptNumber?: string;
    ResultDesc?: string;
  };
}

// Lipia Online's docs confirm there is no webhook signature header or
// shared secret to verify against — their guidance for testing callbacks
// is just "expose your local server with ngrok," nothing about
// authenticating the request. This route is therefore unauthenticated by
// the provider's own design, not as a gap on our side.
//
// Because of that, this route does NOT trust the callback body's own claim
// of success. Anyone who discovers this URL and a live ExternalReference
// (e.g. by starting a real deposit, then forging a "Success" POST here
// instead of actually paying) could otherwise get credited without ever
// sending money. To close that, a "Success" callback is only acted on after
// independently asking Lipia's own status API (checkStkStatus) to confirm
// the same checkoutRequestId — an attacker can forge a POST to us, but they
// can't forge what Lipia's own servers report back when we ask them directly.
function verifySignature(_req: Request, _rawBody: string): boolean {
  return true;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!verifySignature(req, rawBody)) {
    console.warn("Mpesa webhook: signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body: CallbackBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Extract reference, status, checkoutRequestId and receipt number defensively
  const reference = body?.response?.ExternalReference || body?.external_reference || body?.ExternalReference || body?.reference;
  const status = body?.response?.Status || body?.status || body?.Status;
  const checkoutRequestId = body?.response?.CheckoutRequestID || body?.checkout_request_id || body?.CheckoutRequestID || body?.transaction_id || body?.MerchantRequestID;
  const mpesaReceipt = body?.response?.MpesaReceiptNumber || body?.mpesa_receipt_number || body?.MpesaReceiptNumber || body?.mpesaReceiptNumber || body?.mpesaReceipt || "";
  const failureReason = body?.response?.ResultDesc || body?.response?.Status || body?.message || body?.ResultDesc || body?.ResultDescription || body?.status || "failed";

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  // Find the pending transaction we created when initiating the STK push.
  const transaction = await prisma.transaction.findFirst({
    where: { externalRef: reference, status: "pending" },
  });

  if (!transaction) {
    console.warn(`Mpesa webhook: no pending transaction found for reference ${reference}`);
    return NextResponse.json({ ok: true, note: "No matching pending transaction" });
  }

  const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

  const isSuccess = String(status).toLowerCase().trim() === "success";

  if (isSuccess) {
    if (!checkoutRequestId) {
      console.warn(`Mpesa webhook: missing checkoutRequestId for reference ${reference}`);
      return NextResponse.json({ error: "Missing checkoutRequestId" }, { status: 400 });
    }
    let corroborated = false;
    try {
      const statusResult = await checkStkStatus(checkoutRequestId);
      console.log(`[mpesa-callback] corroboration raw response for ${checkoutRequestId}=`, JSON.stringify(statusResult));
      const remoteStatus = statusResult.data?.response?.Status?.toLowerCase().trim();
      corroborated = statusResult.success === true && remoteStatus === "success";
    } catch (err) {
      console.error(`Mpesa webhook: corroboration check failed for ${checkoutRequestId}`, err);
    }

    if (!corroborated) {
      console.warn(
        `Mpesa webhook: REJECTED uncorroborated success claim for reference ${reference} ` +
        `(checkoutRequestId=${checkoutRequestId}) — callback claimed success but independent check ` +
        `status API did not confirm it. Leaving transaction pending.`
      );
      return NextResponse.json({ ok: true, note: "Not corroborated, left pending" });
    }

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "completed",
          metadata: JSON.stringify({
            ...existingMeta,
            mpesaReceipt,
            checkoutRequestId,
            resolvedVia: "webhook-corroborated",
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

  // Failed transaction
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: "failed",
      metadata: JSON.stringify({
        ...existingMeta,
        failureReason,
      }),
    },
  });

  console.log(`Deposit failed: ${reference} (${failureReason})`);
  return NextResponse.json({ ok: true });
}