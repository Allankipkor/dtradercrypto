import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyUsdtTransfer } from "@/lib/crypto";

const schema = z.object({
  transactionId: z.string(),
  txHash: z.string().min(10),
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

    const { transactionId, txHash } = parsed.data;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId: session.user.id,
        method: "crypto",
        type: "deposit",
        status: "pending",
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Reject a txHash that's already been used to confirm a different
    // deposit. There's no dedicated, unique-indexed txHash column today —
    // it only lives inside the JSON `metadata` blob — so this check is a
    // best-effort scan rather than a DB-level guarantee. It closes the
    // realistic case (a hash being replayed against a second deposit
    // request) but isn't fully race-proof against two simultaneous
    // requests submitting the same brand-new hash in the same instant.
    // Recommend adding a dedicated `txHash String? @unique` column to the
    // Transaction model for a real guarantee.
    const existingUse = await prisma.transaction.findFirst({
      where: {
        method: "crypto",
        type: "deposit",
        status: "completed",
        metadata: { contains: txHash },
      },
    });
    if (existingUse) {
      return NextResponse.json(
        { error: "This transaction hash has already been used to confirm a deposit" },
        { status: 409 }
      );
    }

    // The real check: ask the TRON blockchain itself (via TronGrid) whether
    // this hash is an actual USDT TRC20 transfer to OUR address, for at
    // least the deposited amount. Previously this endpoint trusted whatever
    // string the user typed into the txHash field — any 10+ character
    // value, real or fabricated, was enough to get credited instantly with
    // zero verification. That was the single most exploitable gap found in
    // this whole codebase: no forgery skill required, no external system to
    // fool, just type anything and submit.
    const verification = await verifyUsdtTransfer({
      txHash,
      minAmount: transaction.amount,
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: verification.reason ?? "Could not verify this transaction on-chain" },
        { status: 400 }
      );
    }

    const meta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "completed",
          metadata: JSON.stringify({
            ...meta,
            txHash,
            confirmedAt: new Date().toISOString(),
            onChainAmount: verification.amount,
            fromAddress: verification.from,
          }),
        },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { balance: { increment: transaction.amount } },
      }),
    ]);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });

    return NextResponse.json({
      status: "completed",
      balance: user?.balance,
      message: "Crypto deposit confirmed",
    });
  } catch (err) {
    console.error("POST /api/payments/crypto/confirm error:", err);
    return NextResponse.json({ error: "Confirmation failed" }, { status: 500 });
  }
}