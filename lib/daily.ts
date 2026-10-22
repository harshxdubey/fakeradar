// Daily automatic scans: the cron starts one Apify run per opted-in product, Apify calls back
// /api/cron/finish when each run ends, and the finished scan is saved and emailed.
import { hasApifyToken, startRuns } from "./apify";
import { claimGroupIfDone, finishCronRun, getProductRow, recordCronGroup, upsertProduct, upsertScan, type ProductRow } from "./db";
import { alertHtml, appUrl, emailEnabled, sendEmail } from "./email";
import type { SavedProduct } from "./profile";
import { bucketFor, isSuspected } from "./rules";
import { finishRuns } from "./scan";
import type { Marketplace, Product, StoredScan } from "./types";

const norm = (s: string) => s.trim().toLowerCase();

/** Server-side twin of the browser's withHistory(): genuine sellers skipped, history attached. */
export function productForScan(saved: SavedProduct): Product {
  const sellers = [...saved.authorisedSellers];
  for (const s of saved.genuineSellers ?? []) if (!sellers.some((x) => norm(x) === norm(s))) sellers.push(s);
  return {
    brand: saved.brand,
    name: saved.name,
    minPrice: saved.minPrice,
    maxPrice: saved.maxPrice,
    photos: saved.photos ?? [],
    photoHashes: saved.photoHashes ?? [],
    authorisedSellers: sellers,
    marketplace: saved.marketplace || "amazon_in",
    marketplaces: saved.marketplaces,
    knownOffenders: (saved.offenders ?? []).map((o) => ({ seller: o.seller, count: o.count })),
    confirmedAsins: saved.confirmedAsins ?? [],
  };
}

const finishUrl = () => `${appUrl()}/api/cron/finish?secret=${encodeURIComponent(process.env.CRON_SECRET ?? "")}`;

export async function startDailyScan(row: ProductRow): Promise<string> {
  if (!hasApifyToken()) throw new Error("APIFY_TOKEN is not set");
  const runs = await startRuns(productForScan(row.product), finishUrl());
  const groupId = runs.map((r) => r.runId).join("+");
  await recordCronGroup(groupId, row.ws, row.product.key, runs);
  return groupId;
}

export async function finishDailyScan(runId: string, failed: boolean) {
  const groupId = await finishCronRun(runId, failed);
  if (!groupId) return { skipped: "unknown or already processed run" };
  const group = await claimGroupIfDone(groupId);
  if (!group) return { waiting: "other marketplaces still running" };
  const row = await getProductRow(group.ws, group.productKey);
  if (!row) return { skipped: "product deleted" };
  const claim = { ws: group.ws };

  const product = productForScan(row.product);
  const result = await finishRuns(
    product,
    group.runs.map((r) => ({ runId: r.runId, datasetId: r.datasetId, marketplace: r.marketplace as Marketplace, ok: !r.failed })),
    claim.ws,
  );
  const stored: StoredScan = { result, decisions: {}, takedowns: {} };
  await upsertScan(claim.ws, stored, "daily");
  await upsertProduct(claim.ws, { ...row.product, lastScanId: result.id }, { dailyScan: row.dailyScan, alertEmail: row.alertEmail });

  // Alert on confident flags; after the first scan, only when something new turned up.
  const flagged = result.items.filter((i) => bucketFor(i) === "queue" && isSuspected(i));
  const fresh = flagged.filter((i) => i.isNew);
  const firstScan = result.newCount === undefined;
  const worthEmailing = firstScan ? flagged.length > 0 : fresh.length > 0;
  let emailed = false;
  if (worthEmailing && row.alertEmail && emailEnabled()) {
    const list = firstScan ? flagged : fresh;
    await sendEmail(
      row.alertEmail,
      `FakeRadar: ${list.length} ${firstScan ? "suspected" : "new suspected"} fake${list.length === 1 ? "" : "s"} for ${row.product.brand}`,
      alertHtml(result, list, result.newCount ?? 0),
    );
    emailed = true;
  }
  return { scanId: result.id, flagged: flagged.length, new: fresh.length, emailed };
}
