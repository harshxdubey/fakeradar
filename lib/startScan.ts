"use client";
import { saveScan } from "./store";
import type { PendingScan, Product, ScanResult } from "./types";

/** Resize an uploaded photo to a JPEG data URL (keeps requests and storage small). */
export function resizePhoto(file: File, maxSide = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Couldn't read ${file.name} as an image`));
    };
    img.src = url;
  });
}

type ScanResponse = { result?: ScanResult; pending?: PendingScan; error?: string };

const POLL_MS = 3000;
const MAX_WAIT_MS = 4 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(url: string, body: object): Promise<ScanResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ScanResponse;
  if (!res.ok) throw new Error(json.error || `Scan failed (${res.status})`);
  return json;
}

/**
 * Run a scan, keeping the progress screen up for at least `minMs` so the steps are readable.
 * Live scans run on Apify in the background, so this polls until the scraper finishes.
 */
export async function startScan(product: Product, minMs: number, opts: { demo?: boolean } = {}): Promise<string> {
  const started = Date.now();
  let json = await post("/api/scan", { product, demo: opts.demo });
  while (!json.result && json.pending) {
    if (Date.now() - started > MAX_WAIT_MS) throw new Error("The Amazon.in search is taking too long. Please try again.");
    await sleep(POLL_MS);
    json = await post("/api/scan/poll", { product: { ...product, photos: [] }, pending: json.pending });
  }
  if (!json.result) throw new Error(json.error || "Scan returned no result");
  const wait = minMs - (Date.now() - started);
  if (wait > 0) await sleep(wait);
  saveScan(json.result, product.photos);
  return json.result.id;
}
