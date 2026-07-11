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
    const finalDigit = getLastDigit(closePrice);

    if (trade.contractType.startsWith("Over/Under")) {
      const parts = trade.contractType.split("|");
      const digitDirection = parts[1] || (trade.direction === "up" ? "Over" : "Under");
      const predictedDigit = parts[2] !== undefined ? parseInt(parts[2], 10) : 0;

      if (digitDirection === "Over") {
        won = finalDigit > predictedDigit;
      } else if (digitDirection === "Under") {
        won = finalDigit < predictedDigit;
      }
    } else if (trade.contractType.startsWith("Even/Odd")) {
      const parts = trade.contractType.split("|");
      const subType = parts[1] || (trade.direction === "up" ? "Even" : "Odd");
      const isEven = finalDigit % 2 === 0;

      if (subType === "Even") {
        won = isEven;
      } else {
        won = !isEven;
      }
    } else if (trade.contractType.startsWith("Match/Differ")) {
      const parts = trade.contractType.split("|");
      const subType = parts[1] || (trade.direction === "up" ? "Match" : "Differ");
      const predictedDigit = parts[2] !== undefined ? parseInt(parts[2], 10) : 0;

      if (subType === "Match") {
        won = finalDigit === predictedDigit;
      } else {
        won = finalDigit !== predictedDigit;
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
