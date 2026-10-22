// Free photo matching with a difference hash (dHash): shrink to 9×8 grayscale, compare neighbours,
// get a 64-bit fingerprint. Near-identical photos (resized, recompressed, lightly edited) differ in
// only a few bits. The browser and the server compute it the same way, so fingerprints compare.

/** 72 grayscale values (9 wide × 8 tall, row by row) → 16-char hex fingerprint. */
export function dHashFromGray(gray: ArrayLike<number>): string {
  let hex = "";
  for (let row = 0; row < 8; row++) {
    let byte = 0;
    for (let col = 0; col < 8; col++) {
      const left = gray[row * 9 + col];
      const right = gray[row * 9 + col + 1];
      byte = (byte << 1) | (left > right ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** 0–1 similarity: share of the 64 bits that agree. */
export function hashSimilarity(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 0;
  let diff = 0;
  for (let i = 0; i < 16; i += 2) {
    let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (x) {
      diff += x & 1;
      x >>= 1;
    }
  }
  return 1 - diff / 64;
}

/** Best similarity of one listing fingerprint against any authorised photo. */
export function bestMatch(listingHash: string | null, ownerHashes: string[] = []): number | undefined {
  if (!listingHash || !ownerHashes.length) return undefined;
  return Math.max(...ownerHashes.map((h) => hashSimilarity(listingHash, h)));
}

/** ≥ this = the listing almost certainly uses your photo (or a light edit of it). */
export const PHOTO_SAME = 0.88;
/** ≥ this = very similar shot or layout; worth a look. */
export const PHOTO_SIMILAR = 0.8;
