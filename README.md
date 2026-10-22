# FakeRadar

Self-serve counterfeit & copycat listing monitor for small Indian D2C brands.
**Upload → Scan → Confirm & report.** FakeRadar never files a report for you — the owner confirms every fake and submits the takedown themselves.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional — demo mode works with no env at all
npm run dev                  # http://localhost:3000
```

Click **Try with sample product** on the home page for the instant demo.

## Deploy to Vercel

```bash
npx vercel          # first deploy (links the project)
npx vercel --prod   # production deploy
```

Or push this repo to GitHub and import it at vercel.com/new — zero config. Add env vars in *Project → Settings → Environment Variables*.

## What it does (v2)

- **Free photo matching**: each listing photo is fingerprinted (dHash via `sharp`) and compared with your authorised photos. "Uses your photo · 94%" is the strongest copycat signal, at no AI cost.
- **Smarter search**: every live scan runs 3 Amazon.in searches in one Apify run: brand + product, product without brand (copycats hiding your name), and brand alone.
- **Brand memory** (in this browser): saved products with one-click re-scan, sellers you marked Genuine are skipped next time, sellers with confirmed fakes are flagged as repeat offenders, and a fake you confirmed that is still up is pushed to the top.
- **Takedown tracker** (`/takedowns`): every confirmed fake from Not reported → Reported → Removed / Still live / Rejected, with dates and a **Re-check** button that visits the listing to see if it is gone.

## Marketplaces

Amazon.in (`junglee/Amazon-crawler`), Flipkart (`scrapesage/flipkart-scraper`) and Myntra (`khadinakbar/myntra-product-scraper`), chosen per product. A scan starts one Apify run per marketplace and merges the results; if one marketplace fails, the others still show, with a note. Adapters live in `lib/apify.ts`. Meesho is not included: its search results carry no seller or brand. Optional caps: `FLIPKART_MAX_ITEMS` (15), `MYNTRA_MAX_ITEMS` (12).

## Batch 2: database, daily scans, alerts, sellers

- **Database (optional, free)**: Vercel → Storage → Neon. With `DATABASE_URL` set, everything syncs to a private workspace (a random id in the browser; "Copy device link" opens it elsewhere). Tables are created automatically on first use. Without it, the app runs browser-only as before.
- **Daily scans**: `vercel.json` runs `/api/cron/daily` at 02:30 UTC (08:00 IST). It starts one Apify run per product with daily scans on; Apify calls `/api/cron/finish` when each run ends, which classifies, saves the scan and sends the alert. Both endpoints require `CRON_SECRET`. "Run now" in product settings triggers the same flow for one product.
- **New listings**: each scan records what it saw, so listings that appear later get a **New** badge and drive the alerts.
- **Email alerts** (optional): `RESEND_API_KEY` (resend.com, free). Without a verified domain Resend only delivers to your Resend account email.
- **Seller view**: a Sellers tab ranks flagged sellers by a 0–100 risk score (strongest flag + extra flagged listings + earlier confirmed fakes) and marks repeat offenders.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `USE_MOCK_DATA` | `true` | `true`: built-in mock listings + pre-baked verdicts. `false`: live Amazon.in scans. The home page's sample product always uses demo data. |
| `APIFY_TOKEN` | – | Live data, **free tier**: FakeRadar runs the Apify Amazon scraper directly (no n8n needed). |
| `APIFY_ACTOR` | `junglee/Amazon-crawler` | Apify actor used for the Amazon.in search. |
| `APIFY_MAX_ITEMS` | `30` | Listings fetched per scan across the 3 searches (each costs Apify credit, about $0.005). |
| `N8N_WEBHOOK_URL` | – | Optional alternative data source; takes priority over `APIFY_TOKEN`. |
| `ANTHROPIC_API_KEY` | – | Optional. Set it to classify with Claude (compares photos). Empty = **free rule checks**. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Model for both Claude calls. |
| `DATABASE_URL` | – | Set automatically by Vercel's Neon integration. Enables sync, daily scans and alerts. |
| `CRON_SECRET` | – | Random string protecting the cron and Apify-callback endpoints. |
| `RESEND_API_KEY` | – | Optional email alerts. |
| `ALERT_FROM_EMAIL` | `FakeRadar <onboarding@resend.dev>` | Sender, once you verify a domain in Resend. |
| `OPENROUTER_API_KEY` | – | Optional. Reach Claude through OpenRouter instead (used only when `ANTHROPIC_API_KEY` is empty). |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-5.5` | OpenRouter model slug — copy the exact one from openrouter.ai/models. |
| `GEMINI_API_KEY` | – | Optional, **free tier** (aistudio.google.com). Used when neither Claude key is set. Same prompts, photos included. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model name. |

### Free live mode (no paid services)

1. Sign up at apify.com (free plan) and copy your API token.
2. `npx vercel env add APIFY_TOKEN production` (paste the token) and `npx vercel env add USE_MOCK_DATA production` (type `false`).
3. `npx vercel --prod`.

Scans then use real Amazon.in listings, judged by the free rule checks in `lib/rulesClassifier.ts`: near-miss brand spellings, your brand far below your price, and titles that reuse your product name. Photos are not compared, so name-only copycat matches go to the Unsure tab. Add `ANTHROPIC_API_KEY` later to switch to Claude.

## How a scan works

```
/api/scan        (live + Apify: starts a background run; the browser polls /api/scan/poll)
  search      mock data  OR  POST N8N_WEBHOOK_URL  OR  Apify junglee/Amazon-crawler
  rules       dedupe by URL → drop authorised sellers          (plain code, lib/rules.ts)
  classify    Claude vision+text per listing → strict JSON      (prompts/classify.md)
              or, with no ANTHROPIC_API_KEY, free rule checks     (lib/rulesClassifier.ts)
  buckets     confidence ≥0.7 → queue · 0.3–0.7 → Unsure · <0.3 or "unrelated" → hidden
/api/takedown
  AI          Claude drafts report from stored fields only      (prompts/takedown.md)
              falls back to a template (lib/takedown.ts) in mock mode / on error
```

Scans, decisions and drafts are stored in the browser's `localStorage` (prototype: no auth, single brand). The server stays stateless, so it runs on Vercel serverless functions.

## n8n webhook contract

FakeRadar sends:

```http
POST $N8N_WEBHOOK_URL
Content-Type: application/json

{ "query": "TerraSip Bamboo Steel Water Bottle 1L", "marketplace": "amazon_in", "maxResults": 20 }
```

n8n must respond (Respond to Webhook node) with:

```json
{
  "listings": [
    {
      "id": "B0XXXXXXXX",
      "asin": "B0XXXXXXXX",
      "url": "https://www.amazon.in/dp/B0XXXXXXXX",
      "title": "Listing title",
      "price": 249,
      "seller": "Seller display name",
      "imageUrl": "https://m.media-amazon.com/images/I/....jpg"
    }
  ]
}
```

Suggested n8n flow: **Webhook** → **Apify: Run actor** (an Amazon search scraper pointed at `https://www.amazon.in/s?k={{query}}`) → **Apify: Get dataset items** → **Code** (map to the shape above; `price` as a number in ₹) → **Respond to Webhook**.
`imageUrl` must be a public `https://` URL so Claude can fetch it.

## Prompts

- [`prompts/classify.md`](prompts/classify.md) — per-listing classification (label, confidence, evidence, seller risk). Evidence may only cite what's visible in the inputs.
- [`prompts/takedown.md`](prompts/takedown.md) — Report-a-Violation draft, using only stored listing fields + evidence; leaves `[TRADEMARK NUMBER]` for the owner.

## Project layout

```
app/                 pages (/, /new, /scan/[id]) and API routes
components/          ListingCard, TakedownPanel, ScanProgress, ui primitives
lib/                 types, rules, mock data, Claude client, scan pipeline, storage
prompts/             the two Claude prompts
```

## Out of scope (prototype)

Auto-submitting reports, accounts/login, multiple brands, payments, scheduled scans, WhatsApp alerts, Flipkart/Meesho scraping.
