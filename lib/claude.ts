// Server-only Anthropic calls. The API key never reaches the browser.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Listing, Product, Verdict, VerdictLabel, SellerRisk } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

type ImageBlock = {
  type: "image";
  source:
    | { type: "base64"; media_type: string; data: string }
    | { type: "url"; url: string };
};
type ContentBlock = ImageBlock | { type: "text"; text: string };

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function loadPrompt(name: string, vars: Record<string, string | number>) {
  const raw = await readFile(path.join(process.cwd(), "prompts", name), "utf8");
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
}

function imageBlock(src: string): ImageBlock | null {
  const m = src.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if (m) return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
  if (/^https?:\/\//.test(src)) return { type: "image", source: { type: "url", url: src } };
  return null; // e.g. SVG data URLs — Claude can't read those
}

async function callClaude(content: ContentBlock[], maxTokens: number): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { content: { type: string; text?: string }[] };
  return json.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

const LABELS: VerdictLabel[] = ["counterfeit", "copycat", "possible_genuine_reseller", "unrelated"];
const RISKS: SellerRisk[] = ["low", "medium", "high"];

export function parseVerdict(text: string): Verdict {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model did not return JSON");
  const v = JSON.parse(match[0]);
  if (!LABELS.includes(v.label)) throw new Error(`Bad label: ${v.label}`);
  return {
    label: v.label,
    confidence: Math.max(0, Math.min(1, Number(v.confidence) || 0)),
    evidence: (Array.isArray(v.evidence) ? v.evidence : []).map(String).slice(0, 3),
    seller_risk: RISKS.includes(v.seller_risk) ? v.seller_risk : "low",
  };
}

export async function classifyListing(product: Product, listing: Listing): Promise<Verdict> {
  const text = await loadPrompt("classify.md", {
    brand: product.brand,
    product: product.name,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    authorisedSellers: product.authorisedSellers.join(", ") || "(none)",
    title: listing.title,
    price: listing.price,
    seller: listing.seller,
    url: listing.url,
  });
  const content: ContentBlock[] = [];
  product.photos.slice(0, 3).forEach((p, i) => {
    const b = imageBlock(p);
    if (b) content.push({ type: "text", text: `Authorised photo ${i + 1}:` }, b);
  });
  const candidate = imageBlock(listing.imageUrl);
  if (candidate) content.push({ type: "text", text: "Candidate listing photo:" }, candidate);
  content.push({ type: "text", text });
  return parseVerdict(await callClaude(content, 400));
}

export async function draftTakedownAI(data: object): Promise<string> {
  const text = await loadPrompt("takedown.md", { data: JSON.stringify(data, null, 2) });
  return (await callClaude([{ type: "text", text }], 900)).trim();
}
