import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { initiateStkPush, isMpesaConfigured, usdToKes, isMpesaAutoConfirmEnabled } from "@/lib/mpesa";
import {
  generateDepositReference,
  getUsdtDepositAddress,
  isAutoConfirmEnabled,
  isCryptoConfigured,
} from "@/lib/crypto";

const schema = z.object({
  method: z.enum(["mpesa", "crypto", "card"]),
  amount: z.number().min(1).max(10000),
  phone: z.string().optional(),
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
      const flat = parsed.error.flatten();
      const firstError = Object.values(flat.fieldErrors).flat()[0];
      return NextResponse.json(
        { error: firstError || "Invalid deposit request", details: flat },
        { status: 400 }
      );
    }

    const { method, amount, phone } = parsed.data;
    const reference = generateDepositReference();

    if (method === "mpesa") {
      if (!isMpesaConfigured() && !isMpesaAutoConfirmEnabled()) {
        return NextResponse.json(
          { error: "M-Pesa not configured. Add PAYHERO credentials to .env" },
          { status: 503 }
        );
      }

      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      const mpesaPhone = phone ?? user?.phone;
      if (!mpesaPhone) {
        return NextResponse.json({ error: "Phone number required for M-Pesa" }, { status: 400 });
      }

      const amountKes = usdToKes(amount);
      if (amountKes < 1) {
        return NextResponse.json(
          { error: "Amount is too small to convert to a valid M-Pesa charge" },
          { status: 400 }
        );
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId: session.user.id,
          type: "deposit",
          method: "mpesa",
          amount,
          currency: "USD",
          status: "pending",
          externalRef: reference,
          metadata: JSON.stringify({ amountKes, phone: mpesaPhone }),
        },
      });

      if (isMpesaAutoConfirmEnabled()) {
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "completed",
              metadata: JSON.stringify({
                amountKes,
                phone: mpesaPhone,
                autoConfirmed: true,
                checkoutRequestId: `MOCK_CK_${reference}`,
                merchantRequestId: `MOCK_MR_${reference}`,
              }),
            },
          }),
          prisma.user.update({
            where: { id: session.user.id },
            data: { balance: { increment: amount } },
          }),
        ]);

        const updatedUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { balance: true },
        });

        return NextResponse.json({
          transactionId: transaction.id,
          method: "mpesa",
          message: `Deposit of $${amount} mock auto-confirmed (dev mode)!`,
          amountKes,
          checkoutRequestId: `MOCK_CK_${reference}`,
          status: "completed",
          balance: updatedUser?.balance,
        });
      }

      try {
        const stk = await initiateStkPush({
          phone: mpesaPhone,
          amountKes,
          accountReference: reference,
          transactionDesc: "DTraderCrypto deposit",
        });

        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            metadata: JSON.stringify({
              amountKes,
              phone: mpesaPhone,
              checkoutRequestId: stk.checkoutRequestId,
              merchantRequestId: stk.merchantRequestId,
            }),
          },
        });

        return NextResponse.json({
          transactionId: transaction.id,
          method: "mpesa",
          message: stk.CustomerMessage,
          amountKes,
          checkoutRequestId: stk.checkoutRequestId,
        });
      } catch (err) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: "failed" },
        });
        throw err;
      }
    }

    if (method === "crypto") {
      const address = getUsdtDepositAddress();
      if (!isCryptoConfigured()) {
        return NextResponse.json(
          { error: "Crypto deposits not configured. Set CRYPTO_USDT_ADDRESS in .env" },
          { status: 503 }
        );
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId: session.user.id,
          type: "deposit",
          method: "crypto",
          amount,
          currency: "USD",
          status: "pending",
          externalRef: reference,
          metadata: JSON.stringify({ network: "TRC20", token: "USDT" }),
        },
      });

      if (isAutoConfirmEnabled()) {
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "completed", metadata: JSON.stringify({ autoConfirmed: true }) },
          }),
          prisma.user.update({
            where: { id: session.user.id },
            data: { balance: { increment: amount } },
          }),
        ]);

        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { balance: true },
        });

        return NextResponse.json({
          transactionId: transaction.id,
          method: "crypto",
          address,
          amount,
          network: "TRC20",
          reference,
          status: "completed",
          balance: user?.balance,
          message: "Deposit auto-confirmed (dev mode)",
        });
      }

      return NextResponse.json({
        transactionId: transaction.id,
        method: "crypto",
        address,
        amount,
        network: "TRC20",
        reference,
        status: "pending",
        message: "Send USDT to the address, then confirm with your transaction hash",
      });
    }

    // Card placeholder — integrate Stripe/Paystack later
    const transaction = await prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: "deposit",
        method: "card",
        amount,
        status: "pending",
        externalRef: reference,
      },
    });

    return NextResponse.json({
      transactionId: transaction.id,
      method: "card",
      status: "pending",
      message: "Card payments coming soon. Use M-Pesa or crypto for now.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deposit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}