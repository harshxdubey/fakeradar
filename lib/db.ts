// Server-side Postgres (Neon, via Vercel Storage). Optional: without DATABASE_URL the app keeps
// everything in the browser, exactly as before. Rows are scoped to a workspace id, a long random
// id kept in the owner's browser (no login in this prototype).
import { neon } from "@neondatabase/serverless";
import type { SavedProduct } from "./profile";
import type { StoredScan, TrackedTakedown } from "./types";

const url = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
export const dbEnabled = () => Boolean(url());

export const isWorkspace = (ws: unknown): ws is string => typeof ws === "string" && /^[a-z0-9]{16,40}$/.test(ws);

function sql() {
  return neon(url());
}

let schema: Promise<void> | null = null;

/** Creates the tables on first use (idempotent), so there is no separate migration step. */
export function ensureSchema(): Promise<void> {
  schema ??= (async () => {
    const q = sql();
    await q`CREATE TABLE IF NOT EXISTS products (
      ws text NOT NULL, key text NOT NULL, data jsonb NOT NULL,
      daily_scan boolean NOT NULL DEFAULT false, alert_email text,
      updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (ws, key))`;
    await q`CREATE TABLE IF NOT EXISTS scans (
      id text PRIMARY KEY, ws text NOT NULL, product_key text, data jsonb NOT NULL,
      source text NOT NULL DEFAULT 'manual', created_at timestamptz NOT NULL DEFAULT now())`;
    await q`CREATE INDEX IF NOT EXISTS scans_ws_idx ON scans (ws, created_at DESC)`;
    await q`CREATE TABLE IF NOT EXISTS takedowns (
      ws text NOT NULL, asin text NOT NULL, data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (ws, asin))`;
    await q`CREATE TABLE IF NOT EXISTS seen_listings (
      ws text NOT NULL, product_key text NOT NULL, asin text NOT NULL,
      first_seen timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (ws, product_key, asin))`;
    await q`CREATE TABLE IF NOT EXISTS cron_runs (
      run_id text PRIMARY KEY, ws text NOT NULL, product_key text NOT NULL,
      dataset_id text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz)`;
  })().catch((err) => {
    schema = null;
    throw err;
  });
  return schema;
}

// ---- products ----

export interface ProductRow {
  ws: string;
  product: SavedProduct;
  dailyScan: boolean;
  alertEmail: string | null;
}

export async function upsertProduct(ws: string, product: SavedProduct, settings?: { dailyScan?: boolean; alertEmail?: string | null }) {
  await ensureSchema();
  const q = sql();
  if (settings) {
    await q`INSERT INTO products (ws, key, data, daily_scan, alert_email, updated_at)
      VALUES (${ws}, ${product.key}, ${JSON.stringify(product)}::jsonb, ${settings.dailyScan ?? false}, ${settings.alertEmail ?? null}, now())
      ON CONFLICT (ws, key) DO UPDATE SET data = EXCLUDED.data, daily_scan = EXCLUDED.daily_scan,
        alert_email = EXCLUDED.alert_email, updated_at = now()`;
  } else {
    await q`INSERT INTO products (ws, key, data, updated_at) VALUES (${ws}, ${product.key}, ${JSON.stringify(product)}::jsonb, now())
      ON CONFLICT (ws, key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  }
}

export async function deleteProductRow(ws: string, key: string) {
  await ensureSchema();
  await sql()`DELETE FROM products WHERE ws = ${ws} AND key = ${key}`;
}

const toRow = (r: Record<string, unknown>): ProductRow => ({
  ws: r.ws as string,
  product: r.data as SavedProduct,
  dailyScan: Boolean(r.daily_scan),
  alertEmail: (r.alert_email as string | null) ?? null,
});

export async function listProductRows(ws: string): Promise<ProductRow[]> {
  await ensureSchema();
  const rows = await sql()`SELECT ws, data, daily_scan, alert_email FROM products WHERE ws = ${ws} ORDER BY updated_at DESC LIMIT 50`;
  return rows.map(toRow);
}

export async function getProductRow(ws: string, key: string): Promise<ProductRow | null> {
  await ensureSchema();
  const rows = await sql()`SELECT ws, data, daily_scan, alert_email FROM products WHERE ws = ${ws} AND key = ${key}`;
  return rows[0] ? toRow(rows[0]) : null;
}

export async function dailyScanProducts(): Promise<ProductRow[]> {
  await ensureSchema();
  const rows = await sql()`SELECT ws, data, daily_scan, alert_email FROM products WHERE daily_scan = true ORDER BY updated_at LIMIT 25`;
  return rows.map(toRow);
}

// ---- scans ----

export async function upsertScan(ws: string, stored: StoredScan, source: "manual" | "daily" = "manual") {
  await ensureSchema();
  const key = `${stored.result.product.brand}|${stored.result.product.name}`.trim().toLowerCase();
  await sql()`INSERT INTO scans (id, ws, product_key, data, source)
    VALUES (${stored.result.id}, ${ws}, ${key}, ${JSON.stringify(stored)}::jsonb, ${source})
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data WHERE scans.ws = EXCLUDED.ws`;
}

/** Scan ids are random, so a scan can be opened by its link on any device. */
export async function getScanRow(id: string): Promise<{ ws: string; stored: StoredScan } | null> {
  await ensureSchema();
  const rows = await sql()`SELECT ws, data FROM scans WHERE id = ${id}`;
  return rows[0] ? { ws: rows[0].ws as string, stored: rows[0].data as StoredScan } : null;
}

export async function recentScans(ws: string) {
  await ensureSchema();
  return sql()`SELECT id, product_key, source, created_at FROM scans WHERE ws = ${ws} ORDER BY created_at DESC LIMIT 20`;
}

// ---- takedowns ----

export async function upsertTakedowns(ws: string, list: TrackedTakedown[]) {
  if (!list.length) return;
  await ensureSchema();
  const q = sql();
  for (const t of list) {
    await q`INSERT INTO takedowns (ws, asin, data, updated_at) VALUES (${ws}, ${t.asin}, ${JSON.stringify(t)}::jsonb, now())
      ON CONFLICT (ws, asin) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  }
}

export async function deleteTakedowns(ws: string, asins: string[]) {
  if (!asins.length) return;
  await ensureSchema();
  await sql()`DELETE FROM takedowns WHERE ws = ${ws} AND asin = ANY(${asins})`;
}

export async function listTakedownRows(ws: string): Promise<TrackedTakedown[]> {
  await ensureSchema();
  const rows = await sql()`SELECT data FROM takedowns WHERE ws = ${ws} ORDER BY updated_at DESC LIMIT 300`;
  return rows.map((r) => r.data as TrackedTakedown);
}

// ---- new-listing detection ----

/** Records listings as seen for a product; returns the asins that had never been seen before. */
export async function markSeen(ws: string, productKey: string, asins: string[]): Promise<Set<string>> {
  if (!asins.length) return new Set();
  await ensureSchema();
  const q = sql();
  const before = await q`SELECT asin FROM seen_listings WHERE ws = ${ws} AND product_key = ${productKey} AND asin = ANY(${asins})`;
  const known = new Set(before.map((r) => r.asin as string));
  const fresh = asins.filter((a) => !known.has(a));
  for (const a of fresh) {
    await q`INSERT INTO seen_listings (ws, product_key, asin) VALUES (${ws}, ${productKey}, ${a}) ON CONFLICT DO NOTHING`;
  }
  return new Set(fresh);
}

/** True if this product was scanned before (so "new" listings are meaningful). */
export async function hasSeenBefore(ws: string, productKey: string): Promise<boolean> {
  await ensureSchema();
  const rows = await sql()`SELECT 1 FROM seen_listings WHERE ws = ${ws} AND product_key = ${productKey} LIMIT 1`;
  return rows.length > 0;
}

// ---- daily-scan runs ----

export async function recordCronRun(runId: string, ws: string, productKey: string, datasetId: string) {
  await ensureSchema();
  await sql()`INSERT INTO cron_runs (run_id, ws, product_key, dataset_id) VALUES (${runId}, ${ws}, ${productKey}, ${datasetId})
    ON CONFLICT DO NOTHING`;
}

/** Claims a finished run exactly once (Apify can deliver a webhook more than once). */
export async function claimCronRun(runId: string): Promise<{ ws: string; productKey: string; datasetId: string } | null> {
  await ensureSchema();
  const rows = await sql()`UPDATE cron_runs SET finished_at = now() WHERE run_id = ${runId} AND finished_at IS NULL
    RETURNING ws, product_key, dataset_id`;
  return rows[0] ? { ws: rows[0].ws as string, productKey: rows[0].product_key as string, datasetId: rows[0].dataset_id as string } : null;
}
