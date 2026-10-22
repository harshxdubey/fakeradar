"use client";
// Browser-side fingerprints for the owner's authorised photos (same dHash as the server).
import { dHashFromGray } from "./imageHash";

export function hashPhoto(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 9;
        canvas.height = 8;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 9, 8);
        ctx.drawImage(img, 0, 0, 9, 8);
        const { data } = ctx.getImageData(0, 0, 9, 8);
        const gray: number[] = [];
        // Same luma weights sharp uses for grayscale (Rec. 709).
        for (let i = 0; i < data.length; i += 4) gray.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
        resolve(dHashFromGray(gray));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function hashPhotos(photos: string[]): Promise<string[]> {
  return (await Promise.all(photos.map(hashPhoto))).filter((h): h is string => Boolean(h));
}
