import { NextResponse } from "next/server";
import {
  dbEnabled,
  deleteProductRow,
  deleteTakedowns,
  getProductRow,
  isWorkspace,
  listProductRows,
  listTakedownRows,
  recentScans,
  upsertProduct,
  upsertScan,
  upsertTakedowns,
} from "@/lib/db";
import type { SavedProduct } from "@/lib/profile";
import type { StoredScan, TrackedTakedown } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Everything for one workspace: products (with daily-scan settings), takedowns, recent scans. */
export async function GET(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ db: false });
  const ws = new URL(req.url).searchParams.get("ws");
  if (!isWorkspace(ws)) return NextResponse.json({ error: "Invalid workspace" }, { status: 400 });
  try {
    const [products, takedowns, scans] = await Promise.all([listProductRows(ws), listTakedownRows(ws), recentScans(ws)]);
    return NextResponse.json({
      db: true,
      products: products.map((r) => ({ ...r.product, dailyScan: r.dailyScan, alertEmail: r.alertEmail })),
      takedowns,
      scans,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

interface SyncBody {
  ws?: string;
  products?: SavedProduct[];
  deleteProducts?: string[];
  scan?: StoredScan;
  takedowns?: TrackedTakedown[];
  deleteTakedowns?: string[];
  settings?: { key: string; dailyScan: boolean; alertEmail: string | null };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ db: false });
  const body = (await req.json().catch(() => ({}))) as SyncBody;
  const ws = body.ws;
  if (!isWorkspace(ws)) return NextResponse.json({ error: "Invalid workspace" }, { status: 400 });
  try {
    for (const p of (body.products ?? []).slice(0, 10)) {
      const existing = await getProductRow(ws, p.key);
      await upsertProduct(ws, p, existing ? { dailyScan: existing.dailyScan, alertEmail: existing.alertEmail } : undefined);
    }
    for (const key of body.deleteProducts ?? []) await deleteProductRow(ws, key);
    if (body.settings) {
      const row = await getProductRow(ws, body.settings.key);
      if (!row) return NextResponse.json({ error: "Scan this product once before turning on daily scans" }, { status: 404 });
      const email = body.settings.alertEmail?.trim() || null;
      if (email && !EMAIL.test(email)) return NextResponse.json({ error: "That email address doesn't look right" }, { status: 400 });
      await upsertProduct(ws, row.product, { dailyScan: Boolean(body.settings.dailyScan), alertEmail: email });
    }
    if (body.scan?.result?.id) await upsertScan(ws, body.scan);
    await upsertTakedowns(ws, (body.takedowns ?? []).slice(0, 300));
    await deleteTakedowns(ws, body.deleteTakedowns ?? []);
    return NextResponse.json({ db: true, ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
