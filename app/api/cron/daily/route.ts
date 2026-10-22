import { NextResponse } from "next/server";
import { dailyScanProducts, dbEnabled, getProductRow, isWorkspace } from "@/lib/db";
import { startDailyScan } from "@/lib/daily";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron (once a day): start a scan for every product with daily scans turned on. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!dbEnabled()) return NextResponse.json({ skipped: "no database" });
  const rows = await dailyScanProducts();
  const started: string[] = [];
  const errors: string[] = [];
  for (const row of rows) {
    try {
      started.push(await startDailyScan(row));
    } catch (err) {
      errors.push(`${row.product.brand}: ${(err as Error).message}`);
    }
  }
  return NextResponse.json({ products: rows.length, started: started.length, errors });
}

/** "Run it now" from the product settings: the same daily scan, for one product of your workspace. */
export async function POST(req: Request) {
  if (!dbEnabled() || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Daily scans need the database and CRON_SECRET" }, { status: 400 });
  }
  const { ws, key } = (await req.json().catch(() => ({}))) as { ws?: string; key?: string };
  if (!isWorkspace(ws) || !key) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const row = await getProductRow(ws, key);
  if (!row) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  try {
    return NextResponse.json({ runId: await startDailyScan(row) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
