import { NextResponse } from "next/server";
import { cleanProduct, isMockMode, runDemoScan, startLiveScan } from "@/lib/scan";
import type { Product } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { product?: Product; demo?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const product = body.product;
  if (!product?.brand?.trim() || !product?.name?.trim()) {
    return NextResponse.json({ error: "Brand and product name are required" }, { status: 400 });
  }
  if (product.marketplace !== "amazon_in") {
    return NextResponse.json({ error: "Only Amazon.in is supported in this prototype" }, { status: 400 });
  }
  try {
    // The sample product on the home page always uses demo data, so the demo works in any mode.
    if (body.demo || isMockMode()) return NextResponse.json({ result: runDemoScan(cleanProduct(product)) });
    return NextResponse.json(await startLiveScan(cleanProduct(product)));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
