// Server-side fingerprints for listing photos (remote URLs or data URLs, incl. demo SVGs).
import sharp from "sharp";
import { dHashFromGray } from "./imageHash";

async function loadImage(src: string): Promise<Buffer | null> {
  const data = src.match(/^data:([^,]*?)(;base64)?,([\s\S]*)$/);
  if (data) {
    return data[2] ? Buffer.from(data[3], "base64") : Buffer.from(decodeURIComponent(data[3]), "utf8");
  }
  if (!/^https?:\/\//.test(src)) return null;
  const res = await fetch(src, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** dHash of an image, or null if it can't be fetched or decoded (never throws). */
export async function hashImage(src: string): Promise<string | null> {
  try {
    const buf = await loadImage(src);
    if (!buf) return null;
    const gray = await sharp(buf).flatten({ background: "#ffffff" }).resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer();
    return dHashFromGray(gray);
  } catch {
    return null;
  }
}
