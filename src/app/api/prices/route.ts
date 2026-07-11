import { NextResponse } from "next/server";
import { z } from "zod";
import { tickPrice, getPrice, tickPriceBulk } from "@/lib/prices";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");

  if (!assetId) {
    return NextResponse.json({ error: "assetId required" }, { status: 400 });
  }

  const tick = searchParams.get("tick") === "true";
  const countStr = searchParams.get("count");
  const count = countStr ? parseInt(countStr, 10) : 1;

  if (tick) {
    if (count > 1) {
      const prices = await tickPriceBulk(assetId, count);
      return NextResponse.json({ assetId, prices });
    } else {
      const price = await tickPrice(assetId);
      return NextResponse.json({ assetId, price });
    }
  }

  const price = await getPrice(assetId);
  return NextResponse.json({ assetId, price });
}
