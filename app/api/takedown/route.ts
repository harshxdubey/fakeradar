import { NextResponse } from "next/server";
import { draftTakedownAI, hasApiKey } from "@/lib/claude";
import { isMockMode } from "@/lib/scan";
import { draftTakedownTemplate, takedownData } from "@/lib/takedown";
import type { Listing, Product, Verdict } from "@/lib/types";

export async function POST(req: Request) {
  const { product, listing, verdict } = (await req.json()) as {
    product: Pick<Product, "brand" | "name">;
    listing: Listing;
    verdict: Verdict;
  };
  if (!product || !listing || !verdict) {
    return NextResponse.json({ error: "product, listing and verdict are required" }, { status: 400 });
  }

  if (isMockMode() || !hasApiKey()) {
    return NextResponse.json({ text: draftTakedownTemplate(product, listing, verdict), source: "template" });
  }
  try {
    const text = await draftTakedownAI(takedownData(product, listing, verdict));
    return NextResponse.json({ text, source: "ai" });
  } catch {
    return NextResponse.json({ text: draftTakedownTemplate(product, listing, verdict), source: "template" });
  }
}
