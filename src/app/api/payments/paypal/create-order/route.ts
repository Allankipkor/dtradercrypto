import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPaypalOrder, isPaypalConfigured } from "@/lib/paypal";
import { generateDepositReference } from "@/lib/crypto";

const schema = z.object({
    amount: z.number().min(5).max(10000),
});

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isPaypalConfigured()) {
        return NextResponse.json(
            { error: "PayPal not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env" },
            { status: 503 }
        );
    }

    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            const flat = parsed.error.flatten();
            const firstError = Object.values(flat.fieldErrors).flat()[0];
            return NextResponse.json({ error: firstError || "Invalid deposit request" }, { status: 400 });
        }

        const { amount } = parsed.data;
        const reference = generateDepositReference();

        // Create our own pending transaction first, then the PayPal order
        // referencing it. If the PayPal call fails, mark our transaction failed
        // rather than leaving an orphaned pending row with no corresponding
        // order on PayPal's side.
        const transaction = await prisma.transaction.create({
            data: {
                userId: session.user.id,
                type: "deposit",
                method: "card",
                amount,
                currency: "USD",
                status: "pending",
                externalRef: reference,
            },
        });

        try {
            const order = await createPaypalOrder({ amount, referenceId: reference });

            await prisma.transaction.update({
                where: { id: transaction.id },
                data: { metadata: JSON.stringify({ paypalOrderId: order.id }) },
            });

            return NextResponse.json({
                transactionId: transaction.id,
                orderId: order.id,
            });
        } catch (err) {
            await prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: "failed" },
            });
            throw err;
        }
    } catch (err) {
        console.error("POST /api/payments/paypal/create-order error:", err);
        const message = err instanceof Error ? err.message : "Failed to start PayPal checkout";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}