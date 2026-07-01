import { prisma } from "./prisma";
import { getPrice, tickPrice } from "./prices";

export async function settleExpiredTrades(userId?: string) {
  const now = new Date();
  const openTrades = await prisma.trade.findMany({
    where: {
      status: "open",
      expiresAt: { lte: now },
      ...(userId ? { userId } : {}),
    },
  });

  for (const trade of openTrades) {
    const closePrice = await getPrice(trade.assetId);
    const getLastDigit = (val: number) => {
      const cents = Math.round(val * 100);
      return cents % 10;
    };

    let won = false;
    if (trade.contractType.startsWith("Over/Under")) {
      const parts = trade.contractType.split("|");
      const digitDirection = parts[1] || (trade.direction === "up" ? "Over" : "Under");
      const predictedDigit = parts[2] !== undefined ? parseInt(parts[2], 10) : 0;
      const finalDigit = getLastDigit(closePrice);

      if (digitDirection === "Over") {
        won = finalDigit > predictedDigit;
      } else if (digitDirection === "Under") {
        won = finalDigit < predictedDigit;
      }
    } else {
      won =
        trade.direction === "up"
          ? closePrice > trade.openPrice
          : closePrice < trade.openPrice;
    }
    const profit = won ? trade.stake * (trade.payout / 100) : -trade.stake;

    await prisma.$transaction([
      prisma.trade.update({
        where: { id: trade.id },
        data: {
          status: won ? "won" : "lost",
          closePrice,
          profit,
          settledAt: now,
        },
      }),
      ...(won
        ? [
            prisma.user.update({
              where: { id: trade.userId },
              data: { balance: { increment: trade.stake + profit } },
            }),
          ]
        : []),
    ]);
  }
}

export async function settleAndFetchTrades(userId: string) {
  await settleExpiredTrades(userId);
  return prisma.trade.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export { tickPrice };
