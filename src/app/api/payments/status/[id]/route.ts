import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkStkStatus } from "@/lib/mpesa";
import { verifyPaystackTransaction } from "@/lib/paystack";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.userId !== session.user.id) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Already resolved (e.g. webhook beat us to it, or a previous poll resolved it)
  if (transaction.status !== "pending") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });
    return NextResponse.json({
      status: transaction.status,
      amount: transaction.amount,
      balance: user?.balance,
    });
  }

  // Still pending in our DB — ask Lipia Online directly for the latest status.
  // Only meaningful for M-Pesa transactions that have a checkoutRequestId saved.
  if (transaction.method === "mpesa" && transaction.metadata) {
    let meta: { checkoutRequestId?: string } = {};
    try {
      meta = JSON.parse(transaction.metadata);
    } catch {
      // malformed metadata, fall through to returning pending
    }

    if (meta.checkoutRequestId) {
      try {
        const result = await checkStkStatus(meta.checkoutRequestId);

        // Log the raw response so we can see exactly what Lipia sends for
        // edge cases — this is what was missing last time something showed
        // "success" on their dashboard but never resolved here.
        console.log(`[withdraw-status-poll] checkoutRequestId=${meta.checkoutRequestId} raw=`, JSON.stringify(result));

        // Lipia nests the actual payment fields under data.response (same
        // shape as their webhook callback), not flat on data like GravityPay was.
        const response = result.data?.response;

        if (result.success && response) {
          const remoteStatus = response.Status?.toLowerCase().trim();

          const successValues = ["success", "successful", "completed", "complete", "paid", "confirmed"];
          const failureValues = ["failed", "failure", "cancelled", "canceled", "rejected", "timeout", "expired"];

          // IMPORTANT: do NOT treat ResultCode === 0 alone as success. Daraja
          // (which Lipia wraps) reuses ResultCode 0 for "STK push accepted
          // for processing" on the *initiation* response, separately from
          // "payment actually completed" on the *status/callback* response.
          // Trusting ResultCode alone here previously caused balances to be
          // credited the moment the prompt was sent to the phone, before the
          // user had even entered their PIN. Only the explicit Status string
          // is trusted now.
          const succeeded = Boolean(remoteStatus && successValues.includes(remoteStatus));

          if (succeeded) {
            const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

            await prisma.$transaction([
              prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                  status: "completed",
                  metadata: JSON.stringify({
                    ...existingMeta,
                    mpesaReceipt: response.MpesaReceiptNumber,
                    resolvedVia: "poll",
                    rawStatus: remoteStatus,
                  }),
                },
              }),
              prisma.user.update({
                where: { id: transaction.userId },
                data: { balance: { increment: transaction.amount } },
              }),
            ]);

            const user = await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { balance: true },
            });

            return NextResponse.json({
              status: "completed",
              amount: transaction.amount,
              balance: user?.balance,
            });
          }

          if (remoteStatus && failureValues.includes(remoteStatus)) {
            const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status: "failed",
                metadata: JSON.stringify({
                  ...existingMeta,
                  resultDesc: response.ResultDesc,
                  resolvedVia: "poll",
                  rawStatus: remoteStatus,
                }),
              },
            });
            return NextResponse.json({ status: "failed", amount: transaction.amount });
          }

          // Unrecognized status string — log it loudly so we can add it to
          // the lists above, but don't guess; just report pending.
          console.warn(`[withdraw-status-poll] UNRECOGNIZED status "${remoteStatus}" for checkoutRequestId=${meta.checkoutRequestId}`);
        } else {
          console.log(`[withdraw-status-poll] success=false or no data for checkoutRequestId=${meta.checkoutRequestId}`, result);
        }
      } catch (err) {
        console.error("checkStkStatus error:", err);
        // Network/API error talking to Lipia — don't fail the poll request,
        // just report pending and let the client try again shortly.
      }
    }
  }



  if (transaction.method === "paystack" && transaction.metadata) {
    let meta: { paystackReference?: string } = {};
    try {
      meta = JSON.parse(transaction.metadata);
    } catch {
      // malformed metadata
    }

    if (meta.paystackReference) {
      if (meta.paystackReference.startsWith("MOCK_PSTK_")) {
        return NextResponse.json({ status: "pending", amount: transaction.amount });
      }

      try {
        const result = await verifyPaystackTransaction(meta.paystackReference);

        console.log(`[paystack-status-poll] Poll status: txId=${transaction.id}, reference=${meta.paystackReference}, success=${result.success}, rawStatus=${result.status}`);

        if (result.success && result.data) {
          const remoteStatus = result.status?.toLowerCase().trim();

          const successValues = ["success", "successful", "completed", "complete", "paid", "confirmed"];
          const failureValues = ["failed", "failure", "cancelled", "canceled", "rejected", "timeout", "expired", "error"];

          const succeeded = remoteStatus === "success" || successValues.includes(remoteStatus);

          if (succeeded) {
            const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

            await prisma.$transaction([
              prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                  status: "completed",
                  metadata: JSON.stringify({
                    ...existingMeta,
                    resolvedVia: "poll",
                    rawStatus: remoteStatus,
                    paystackId: result.data.id,
                  }),
                },
              }),
              prisma.user.update({
                where: { id: transaction.userId },
                data: { balance: { increment: transaction.amount } },
              }),
            ]);

            const user = await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { balance: true },
            });

            console.log(`[paystack-status-poll] Confirmed: txId=${transaction.id}, amount=${transaction.amount}, balance=${user?.balance}`);

            return NextResponse.json({
              status: "completed",
              amount: transaction.amount,
              balance: user?.balance,
            });
          }

          if (remoteStatus && failureValues.includes(remoteStatus)) {
            const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status: "failed",
                metadata: JSON.stringify({
                  ...existingMeta,
                  resolvedVia: "poll",
                  rawStatus: remoteStatus,
                }),
              },
            });

            console.log(`[paystack-status-poll] Failed: txId=${transaction.id}, remoteStatus=${remoteStatus}`);

            return NextResponse.json({ status: "failed", amount: transaction.amount });
          }
        }
      } catch (err) {
        console.error("verifyPaystackTransaction error:", err);
      }
    }
  }

  return NextResponse.json({ status: "pending", amount: transaction.amount });
}