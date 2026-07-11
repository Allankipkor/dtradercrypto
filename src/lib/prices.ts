import { prisma } from "./prisma";
import { getVolatility } from "./assets";

export async function tickPrice(assetId: string): Promise<number> {
  const existing = await prisma.priceFeed.findUnique({ where: { assetId } });
  const prev = existing?.price ?? 1000;
  const volatility = getVolatility(assetId);
  const delta = (Math.random() - 0.5) * volatility;
  const next = Math.max(900, Math.min(1100, prev + delta));

  await prisma.priceFeed.upsert({
    where: { assetId },
    create: { assetId, price: next },
    update: { price: next },
  });

  return next;
}

export async function getPrice(assetId: string): Promise<number> {
  const feed = await prisma.priceFeed.findUnique({ where: { assetId } });
  if (feed) return feed.price;
  await prisma.priceFeed.create({ data: { assetId, price: 1000 } });
  return 1000;
}

export async function tickPriceBulk(assetId: string, count: number): Promise<number[]> {
  const existing = await prisma.priceFeed.findUnique({ where: { assetId } });
  let prev = existing?.price ?? 1000;
  const volatility = getVolatility(assetId);
  const prices: number[] = [];

  for (let i = 0; i < count; i++) {
    const delta = (Math.random() - 0.5) * volatility;
    prev = Math.max(900, Math.min(1100, prev + delta));
    prices.push(prev);
  }

  await prisma.priceFeed.upsert({
    where: { assetId },
    create: { assetId, price: prev },
    update: { price: prev },
  });

  return prices;
}
