import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { capturePaypalOrder } from "@/lib/paypal";

const schema = z.object({
    transactionId: z.string(),
    orderId: z.string(),
});

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const { transactionId, orderId } = parsed.data;

        const transaction = await prisma.transaction.findFirst({
            where: {
                id: transactionId,
                userId: session.user.id,
                method: "card",
                type: "deposit",
                status: "pending",
            },
        });

        if (!transaction) {
            return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
        }

        const meta = transaction.metadata ? JSON.parse(transaction.metadata) : {};
        if (meta.paypalOrderId && meta.paypalOrderId !== orderId) {
            return NextResponse.json({ error: "Order ID does not match this transaction" }, { status: 400 });
        }

        // The actual money-moving call. capturePaypalOrder talks to PayPal
        // directly with our server credentials — the client only ever supplied
        // an orderId it doesn't control the contents of, so there's nothing for
        // it to tamper with here.
        const capture = await capturePaypalOrder(orderId);

        // Credit using the amount PAYPAL ITSELF reports as captured, not
        // transaction.amount and not anything the client sent. In the (very
        // unlikely) case PayPal's captured amount differs from what we
        // requested, crediting the lesser of the two protects against ever
        // giving more than was actually charged.
        const creditAmount = Math.min(capture.amount, transaction.amount);

        await prisma.$transaction([
            prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: "completed",
                    amount: creditAmount,
                    metadata: JSON.stringify({
                        ...meta,
                        paypalOrderId: orderId,
                        paypalCaptureId: capture.captureId,
                        capturedAmount: capture.amount,
                        payerEmail: capture.payerEmail,
                        payeeEmail: capture.payeeEmail,
                        confirmedAt: new Date().toISOString(),
                    }),
                },
            }),
            prisma.user.update({
                where: { id: session.user.id },
                data: { balance: { increment: creditAmount } },
            }),
        ]);

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { balance: true },
        });

        return NextResponse.json({
            status: "completed",
            balance: user?.balance,
            amount: creditAmount,
            message: "Card deposit confirmed",
        });
    } catch (err) {
        console.error("POST /api/payments/paypal/capture-order error:", err);
        const message = err instanceof Error ? err.message : "Failed to capture PayPal order";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}