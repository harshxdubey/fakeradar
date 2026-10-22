"use client";
import { saveScan } from "./store";
import type { Product, ScanResult } from "./types";

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

/** Run a scan, keeping the progress screen up for at least `minMs` so the steps are readable. */
export async function startScan(product: Product, minMs: number): Promise<string> {
  const started = Date.now();
  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product }),
  });
  const json = (await res.json().catch(() => ({}))) as { result?: ScanResult; error?: string };
  if (!res.ok || !json.result) throw new Error(json.error || `Scan failed (${res.status})`);
  const wait = minMs - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  saveScan(json.result, product.photos);
  return json.result.id;
}
