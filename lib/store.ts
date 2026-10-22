"use client";
// Prototype persistence: scans live in the browser's localStorage (no auth, single brand).
// This keeps the server stateless, so it works on Vercel's serverless functions.
import type { Decision, Product, ScanResult, StoredScan } from "./types";

const KEY = (id: string) => `fakeradar:scan:${id}`;
const PHOTOS_KEY = "fakeradar:photos";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked — the page still works for this session */
  }
}

export function saveScan(result: ScanResult, photos: string[]) {
  const stored: StoredScan = { result, decisions: {}, takedowns: {} };
  safeSet(KEY(result.id), JSON.stringify(stored));
  safeSet(`${PHOTOS_KEY}:${result.id}`, JSON.stringify(photos));
}

export function loadScan(id: string): { stored: StoredScan; photos: string[] } | null {
  const raw = safeGet(KEY(id));
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredScan;
    const photos = JSON.parse(safeGet(`${PHOTOS_KEY}:${id}`) || "[]") as string[];
    return { stored, photos };
  } catch {
    return null;
  }
}

export function updateScan(id: string, stored: StoredScan) {
  safeSet(KEY(id), JSON.stringify(stored));
}

export function withDecision(stored: StoredScan, listingId: string, decision: Decision): StoredScan {
  const next: StoredScan = { ...stored, decisions: { ...stored.decisions, [listingId]: decision } };
  if (decision === "genuine") {
    const seller = stored.result.items.find((i) => i.listing.id === listingId)?.listing.seller;
    const product: Product = stored.result.product;
    if (seller && !product.authorisedSellers.includes(seller)) {
      next.result = {
        ...stored.result,
        product: { ...product, authorisedSellers: [...product.authorisedSellers, seller] },
      };
    }
  }
  return next;
}
