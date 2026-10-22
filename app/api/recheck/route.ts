import { NextResponse } from "next/server";
import { hasApifyToken, parseProductUrl, recheckListing } from "@/lib/apify";
import { isMockMode } from "@/lib/scan";
import type { RecheckResult } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { url, demo } = (await req.json().catch(() => ({}))) as { url?: string; demo?: boolean };
  // Only real Amazon.in / Flipkart / Myntra product links, so the endpoint can't be used to scrape other sites.
  const parsed = url ? parseProductUrl(url) : null;
  if (!url || !parsed) {
    return NextResponse.json({ error: "A valid Amazon.in, Flipkart or Myntra product link is required" }, { status: 400 });
  }
  const asin = parsed.id;

  // Demo listings don't exist on Amazon: simulate a takedown result so the tracker can be shown end to end.
  if (demo || isMockMode() || !hasApifyToken()) {
    const removed = asin.charCodeAt(asin.length - 1) % 3 !== 0;
    const result: RecheckResult = removed
      ? { live: false, note: "Demo: listing page not found — it looks removed." }
      : { live: true, note: "Demo: still live." };
    return NextResponse.json({ result, demo: true });
  }

  try {
    return NextResponse.json({ result: await recheckListing(url) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
