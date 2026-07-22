import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const signature = req.headers.get("x-paystack-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret key is not configured" }, { status: 500 });
  }

  // Get raw body as text for signature validation
  const rawBody = await req.text();

  // Validate the Paystack signature
  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  if (hash !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    
    console.log(`[paystack-webhook] Received event: ${event}`);

    if (event === "charge.success") {
      const data = payload.data;
      const reference = data.reference;
      const status = data.status; // e.g. "success"

      if (status === "success" && reference) {
        // Look up the pending transaction in our database by externalRef (reference)
        const transaction = await prisma.transaction.findFirst({
          where: {
            externalRef: reference,
            method: "paystack",
            status: "pending",
          },
        });

        if (transaction) {
          // Perform secure prisma transaction to resolve and credit user balance
          await prisma.$transaction([
            prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status: "completed",
                metadata: JSON.stringify({
                  paystackId: data.id,
                  resolvedVia: "webhook",
                  gatewayResponse: data.gateway_response,
                  rawStatus: status,
                }),
              },
            }),
            prisma.user.update({
              where: { id: transaction.userId },
              data: { balance: { increment: transaction.amount } },
            }),
          ]);
          console.log(`[paystack-webhook] Confirmed transaction reference=${reference}, amount=${transaction.amount} credited to userId=${transaction.userId}`);
        } else {
          console.log(`[paystack-webhook] Pending transaction not found or already resolved for reference=${reference}`);
        }
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (err) {
    console.error("[paystack-webhook] Processing failed:", err);
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }
}
