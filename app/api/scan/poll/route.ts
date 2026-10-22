import { NextResponse } from "next/server";
import { cleanProduct, pollLiveScan } from "@/lib/scan";
import type { PendingScan, Product } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { product, pending, ws } = (await req.json().catch(() => ({}))) as {
    product?: Product;
    pending?: PendingScan;
    ws?: string;
  };
  if (!product || !Array.isArray(pending?.runs) || !pending.runs.length || pending.runs.some((r) => !r.runId || !r.datasetId)) {
    return NextResponse.json({ error: "product and pending run are required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await pollLiveScan(cleanProduct(product), pending, ws));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
