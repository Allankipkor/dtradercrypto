import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAsset } from "@/lib/assets";
import { tickPrice } from "@/lib/prices";
import { settleAndFetchTrades } from "@/lib/trades";

const CONTRACT_TYPES = ["Over/Under"] as const;

const placeSchema = z.object({
  assetId: z.string(),
  contractType: z.enum(CONTRACT_TYPES),
  direction: z.enum(["up", "down"]),
  stake: z.number().min(0.1).max(10000),
  durationSeconds: z.number().int().min(1).max(3600).default(1),
  // Optional digit-contract metadata (Even/Odd, Over/Under, Match/Differ)
  digit: z.number().int().min(0).max(9).optional(),
  digitDirection: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trades = await settleAndFetchTrades(session.user.id);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true },
  });

  return NextResponse.json({ trades, balance: user?.balance ?? 0 });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = placeSchema.safeParse(body);
    if (!parsed.success) {
      // Surface a readable message instead of a raw zod tree
      const flat = parsed.error.flatten();
      const firstFieldError = Object.values(flat.fieldErrors).flat()[0];
      const message = firstFieldError || "Invalid trade request";
      return NextResponse.json({ error: message, details: flat }, { status: 400 });
    }

    const { assetId, contractType, direction, stake, durationSeconds, digit, digitDirection } =
      parsed.data;

    const asset = getAsset(assetId);
    if (!asset) {
      return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.balance < stake) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    const openPrice = await tickPrice(assetId);
    const expiresAt = new Date(Date.now() + durationSeconds * 1000);

    // Store digit-contract metadata inside contractType string if no dedicated
    // columns exist yet, e.g. "Even/Odd:Even:6" — falls back gracefully if
    // your schema doesn't have separate digit/digitDirection columns.
    const enrichedContractType =
      digit !== undefined && digitDirection
        ? `${contractType}|${digitDirection}|${digit}`
        : contractType;

    const [, trade] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { balance: { decrement: stake } },
      }),
      prisma.trade.create({
        data: {
          userId: session.user.id,
          assetId,
          assetName: asset.name,
          contractType: enrichedContractType,
          direction,
          stake,
          payout: asset.payout,
          openPrice,
          expiresAt,
        },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });

    return NextResponse.json({ trade, balance: updatedUser?.balance ?? 0 }, { status: 201 });
  } catch (err) {
    console.error("POST /api/trades error:", err);
    const message = err instanceof Error ? err.message : "Failed to place trade";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}