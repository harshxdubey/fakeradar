import { NextResponse } from "next/server";
import { runScan } from "@/lib/scan";
import type { Product } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  let product: Product;
  try {
    product = (await req.json()).product;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!product?.brand?.trim() || !product?.name?.trim()) {
    return NextResponse.json({ error: "Brand and product name are required" }, { status: 400 });
  }
  if (product.marketplace !== "amazon_in") {
    return NextResponse.json({ error: "Only Amazon.in is supported in this prototype" }, { status: 400 });
  }
  try {
    const result = await runScan({
      ...product,
      minPrice: Number(product.minPrice) || 0,
      maxPrice: Number(product.maxPrice) || 0,
      photos: (product.photos || []).slice(0, 3),
      authorisedSellers: (product.authorisedSellers || []).map(String),
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
