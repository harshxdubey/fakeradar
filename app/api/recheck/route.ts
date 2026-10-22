import { NextResponse } from "next/server";
import { hasApifyToken, recheckListing } from "@/lib/apify";
import { isMockMode } from "@/lib/scan";
import type { RecheckResult } from "@/lib/types";

export const maxDuration = 60;

const AMAZON_PRODUCT = /^https:\/\/www\.amazon\.in\/(?:[^/?#]+\/)?dp\/([A-Z0-9]{10})(?:[/?#].*)?$/;

export async function POST(req: Request) {
  const { url, demo } = (await req.json().catch(() => ({}))) as { url?: string; demo?: boolean };
  const asin = url?.match(AMAZON_PRODUCT)?.[1];
  if (!url || !asin) return NextResponse.json({ error: "A valid amazon.in product link is required" }, { status: 400 });

  // Demo listings don't exist on Amazon: simulate a takedown result so the tracker can be shown end to end.
  if (demo || isMockMode() || !hasApifyToken()) {
    const removed = asin.charCodeAt(asin.length - 1) % 3 !== 0;
    const result: RecheckResult = removed
      ? { live: false, note: "Demo: listing page not found — it looks removed." }
      : { live: true, note: "Demo: still live." };
    return NextResponse.json({ result, demo: true });
  }

  try {
    return NextResponse.json({ result: await recheckListing(`https://www.amazon.in/dp/${asin}`) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
