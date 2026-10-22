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

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `USE_MOCK_DATA` | `true` | `true`: built-in mock Amazon.in listings + pre-baked AI verdicts (no keys needed). `false`: live mode. |
| `ANTHROPIC_API_KEY` | – | Live mode: Claude classification + takedown drafting (server-side only). |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Model for both calls. |
| `N8N_WEBHOOK_URL` | – | Live mode: n8n webhook that runs the Apify Amazon search. |

## How a scan works

```
/api/scan
  search      mock data  OR  POST N8N_WEBHOOK_URL
  rules       dedupe by URL → drop authorised sellers          (plain code, lib/rules.ts)
  AI          Claude vision+text per listing → strict JSON      (prompts/classify.md)
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
