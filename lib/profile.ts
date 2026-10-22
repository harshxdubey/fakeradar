"use client";
// Brand memory, kept in this browser until a database is added: saved products, sellers you marked
// genuine, sellers with confirmed fakes, and every confirmed fake followed through to removal.
import type { Decision, Listing, Product, TakedownStatus, TrackedTakedown } from "./types";

import { KEYS, pushDeleteProduct, pushDeleteTakedown, pushProduct, pushTakedowns } from "./sync";

const PRODUCTS = KEYS.products;
const TAKEDOWNS = KEYS.takedowns;

export interface Offender {
  seller: string;
  count: number;
  asins: string[];
  lastSeen: string;
}

export interface SavedProduct extends Product {
  key: string;
  demo: boolean;
  savedAt: string;
  lastScanId?: string;
  /** Sellers you marked Genuine — added to authorised sellers on every scan. */
  genuineSellers: string[];
  offenders: Offender[];
  confirmedAsins: string[];
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the current page still works */
  }
}

const norm = (s: string) => s.trim().toLowerCase();
export const productKey = (p: Pick<Product, "brand" | "name">) => `${norm(p.brand)}|${norm(p.name)}`;

export function listProducts(): SavedProduct[] {
  return read<SavedProduct[]>(PRODUCTS, []);
}

export function getProduct(key: string): SavedProduct | undefined {
  return listProducts().find((p) => p.key === key);
}

function putProduct(next: SavedProduct) {
  const all = listProducts().filter((p) => p.key !== next.key);
  write(PRODUCTS, [next, ...all].slice(0, 8)); // photos are stored too; keep well under the ~5 MB browser limit
  pushProduct(next);
}

/** Save (or update) a product before a scan; history from earlier scans is kept. */
export function saveProduct(product: Product, demo = false): SavedProduct {
  const key = productKey(product);
  const prev = getProduct(key);
  const saved: SavedProduct = {
    ...product,
    key,
    demo,
    savedAt: new Date().toISOString(),
    lastScanId: prev?.lastScanId,
    genuineSellers: prev?.genuineSellers ?? [],
    offenders: prev?.offenders ?? [],
    confirmedAsins: prev?.confirmedAsins ?? [],
  };
  putProduct(saved);
  return saved;
}

export function setLastScan(key: string, scanId: string) {
  const p = getProduct(key);
  if (p) putProduct({ ...p, lastScanId: scanId });
}

export function deleteProduct(key: string) {
  write(PRODUCTS, listProducts().filter((p) => p.key !== key));
  pushDeleteProduct(key);
}

/** The product as sent to a scan: genuine sellers skipped, history attached. */
export function withHistory(product: Product): Product {
  const p = getProduct(productKey(product));
  if (!p) return product;
  const sellers = [...product.authorisedSellers];
  for (const s of p.genuineSellers) if (!sellers.some((x) => norm(x) === norm(s))) sellers.push(s);
  return {
    ...product,
    authorisedSellers: sellers,
    knownOffenders: p.offenders.map((o) => ({ seller: o.seller, count: o.count })),
    confirmedAsins: p.confirmedAsins,
  };
}

/** Undo a Genuine click: the seller is no longer skipped on future scans. */
export function forgetGenuine(product: Product, seller: string) {
  const p = getProduct(productKey(product));
  if (p) putProduct({ ...p, genuineSellers: p.genuineSellers.filter((s) => norm(s) !== norm(seller)) });
}

/** Learn from the owner's decision so the next scan is smarter. */
export function recordDecision(
  product: Product,
  listing: Listing,
  decision: Decision,
  ctx: { scanId: string; demo: boolean },
) {
  const key = productKey(product);
  const p = getProduct(key) ?? saveProduct(product, ctx.demo);
  const now = new Date().toISOString();

  if (decision === "genuine") {
    putProduct({
      ...p,
      genuineSellers: p.genuineSellers.some((s) => norm(s) === norm(listing.seller)) ? p.genuineSellers : [...p.genuineSellers, listing.seller],
      offenders: p.offenders,
      confirmedAsins: p.confirmedAsins.filter((a) => a !== listing.asin),
    });
    removeTakedown(listing.asin);
    return;
  }

  if (decision === "unsure") {
    // Undo an earlier confirmation: forget it as an offence and stop tracking it.
    putProduct({
      ...p,
      offenders: p.offenders
        .map((o) => (o.asins.includes(listing.asin) ? { ...o, count: o.count - 1, asins: o.asins.filter((a) => a !== listing.asin) } : o))
        .filter((o) => o.count > 0),
      confirmedAsins: p.confirmedAsins.filter((a) => a !== listing.asin),
    });
    removeTakedown(listing.asin);
    return;
  }

  if (decision === "confirmed") {
    const offenders = [...p.offenders];
    const i = offenders.findIndex((o) => norm(o.seller) === norm(listing.seller));
    if (i === -1) offenders.push({ seller: listing.seller, count: 1, asins: [listing.asin], lastSeen: now });
    else if (!offenders.at(i)!.asins.includes(listing.asin)) {
      const o = offenders.at(i)!;
      offenders.splice(i, 1, { ...o, count: o.count + 1, asins: [...o.asins, listing.asin], lastSeen: now });
    }
    putProduct({
      ...p,
      offenders,
      confirmedAsins: p.confirmedAsins.includes(listing.asin) ? p.confirmedAsins : [...p.confirmedAsins, listing.asin],
    });
    trackTakedown(listing, { productKey: key, productLabel: `${product.brand} · ${product.name}`, ...ctx });
  }
}

// ---- Takedown tracker ----

export function listTakedowns(): TrackedTakedown[] {
  return read<TrackedTakedown[]>(TAKEDOWNS, []);
}

function writeTakedowns(all: TrackedTakedown[], changed: TrackedTakedown[] = []) {
  write(TAKEDOWNS, all.slice(0, 300));
  if (changed.length) pushTakedowns(changed);
}

export function getTakedown(asin: string) {
  return listTakedowns().find((t) => t.asin === asin);
}

function trackTakedown(
  listing: Listing,
  ctx: { productKey: string; productLabel: string; scanId: string; demo: boolean },
) {
  const all = listTakedowns();
  if (all.some((t) => t.asin === listing.asin)) return;
  const item: TrackedTakedown = {
      asin: listing.asin,
      url: listing.url,
      title: listing.title,
      seller: listing.seller,
      price: listing.price,
      imageUrl: listing.imageUrl,
      marketplace: listing.marketplace ?? "amazon_in",
      ...ctx,
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
  };
  writeTakedowns([item, ...all], [item]);
}

export function updateTakedown(asin: string, patch: Partial<TrackedTakedown>) {
  const all = listTakedowns().map((t) => (t.asin === asin ? { ...t, ...patch } : t));
  writeTakedowns(all, all.filter((t) => t.asin === asin));
}

export function setTakedownStatus(asin: string, status: TakedownStatus, note?: string) {
  const now = new Date().toISOString();
  updateTakedown(asin, {
    status,
    ...(status === "reported" ? { reportedAt: now } : {}),
    ...(status === "removed" || status === "still_live" ? { checkedAt: now } : {}),
    ...(note ? { checkNote: note } : {}),
  });
}

export function removeTakedown(asin: string) {
  if (!listTakedowns().some((t) => t.asin === asin)) return;
  writeTakedowns(listTakedowns().filter((t) => t.asin !== asin));
  pushDeleteTakedown(asin);
}
