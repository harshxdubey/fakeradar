// Server-only Claude calls, direct to Anthropic or through OpenRouter. Keys never reach the browser.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Listing, Product, Verdict, VerdictLabel, SellerRisk } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Check the exact slug at openrouter.ai/models; a wrong one falls back to the free rule checks.
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5.5";
// Google AI Studio has a free tier. Check model names at ai.google.dev/gemini-api/docs/models.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

type ImageBlock = {
  type: "image";
  source:
    | { type: "base64"; media_type: string; data: string }
    | { type: "url"; url: string };
};
type ContentBlock = ImageBlock | { type: "text"; text: string };

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);
}

/** Which AI provider the scan uses: Claude direct, then OpenRouter, then Gemini. */
export function aiProvider(): "claude" | "gemini" | null {
  if (process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY) return "claude";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
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

/** OpenRouter speaks the OpenAI chat format: images become image_url parts. */
async function callOpenRouter(content: ContentBlock[], maxTokens: number): Promise<string> {
  const parts = content.map((b) =>
    b.type === "text"
      ? { type: "text", text: b.text }
      : {
          type: "image_url",
          image_url: {
            url: b.source.type === "url" ? b.source.url : `data:${b.source.media_type};base64,${b.source.data}`,
          },
        },
  );
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "x-title": "FakeRadar",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: parts }],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Gemini needs images inline, so remote listing photos are downloaded and base64-encoded first. */
async function geminiImagePart(b: ImageBlock) {
  if (b.source.type === "base64") return { inline_data: { mime_type: b.source.media_type, data: b.source.data } };
  const res = await fetch(b.source.url);
  if (!res.ok) return null;
  const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return null;
  return { inline_data: { mime_type: mime, data: Buffer.from(await res.arrayBuffer()).toString("base64") } };
}

async function callGemini(content: ContentBlock[], maxTokens: number): Promise<string> {
  const parts = (
    await Promise.all(content.map((b) => (b.type === "text" ? { text: b.text } : geminiImagePart(b))))
  ).filter(Boolean);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

async function callClaude(content: ContentBlock[], maxTokens: number): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENROUTER_API_KEY && process.env.GEMINI_API_KEY) {
    return callGemini(content, maxTokens);
  }
  if (!process.env.ANTHROPIC_API_KEY && process.env.OPENROUTER_API_KEY) return callOpenRouter(content, maxTokens);
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
