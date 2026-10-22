// Daily automatic scans: the cron starts one Apify run per opted-in product, Apify calls back
// /api/cron/finish when each run ends, and the finished scan is saved and emailed.
import { getRunListings, hasApifyToken, startApifyRun } from "./apify";
import { claimCronRun, getProductRow, recordCronRun, upsertProduct, upsertScan, type ProductRow } from "./db";
import { alertHtml, appUrl, emailEnabled, sendEmail } from "./email";
import type { SavedProduct } from "./profile";
import { bucketFor, isSuspected } from "./rules";
import { classifyLive, tagNewListings } from "./scan";
import type { Product, StoredScan } from "./types";

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
    marketplace: "amazon_in",
    knownOffenders: (saved.offenders ?? []).map((o) => ({ seller: o.seller, count: o.count })),
    confirmedAsins: saved.confirmedAsins ?? [],
  };
}

const finishUrl = () => `${appUrl()}/api/cron/finish?secret=${encodeURIComponent(process.env.CRON_SECRET ?? "")}`;

export async function startDailyScan(row: ProductRow): Promise<string> {
  if (!hasApifyToken()) throw new Error("APIFY_TOKEN is not set");
  const run = await startApifyRun(productForScan(row.product), finishUrl());
  await recordCronRun(run.runId, row.ws, row.product.key, run.datasetId);
  return run.runId;
}

export async function finishDailyScan(runId: string, failed: boolean) {
  const claim = await claimCronRun(runId);
  if (!claim) return { skipped: "unknown or already processed run" };
  if (failed) return { skipped: "scraper run failed" };
  const row = await getProductRow(claim.ws, claim.productKey);
  if (!row) return { skipped: "product deleted" };

  const product = productForScan(row.product);
  const result = await classifyLive(product, await getRunListings(claim.datasetId));
  await tagNewListings(claim.ws, product, result);
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
