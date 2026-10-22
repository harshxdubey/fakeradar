"use client";
// "Download evidence": opens a print-ready evidence sheet; the browser's Save as PDF does the rest.
import { inr, LABELS, market, VIOLATION_TYPE } from "./format";
import type { Product, ScanItem } from "./types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function openEvidenceSheet(product: Product, ownerPhoto: string | undefined, item: ScanItem) {
  const { listing, verdict } = item;
  const win = window.open("", "_blank");
  if (!win) {
    alert("Your browser blocked the evidence window. Allow pop-ups for this site and try again.");
    return;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Evidence – ${esc(listing.asin)}</title>
<style>
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0f172a;margin:32px;font-size:13px}
  h1{font-size:20px;margin:0} .muted{color:#64748b}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}
  figure{margin:0;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center}
  figure img{width:100%;max-height:300px;object-fit:contain} figcaption{margin-top:6px;font-weight:600}
  table{border-collapse:collapse;width:100%} td{border:1px solid #e2e8f0;padding:6px 8px;vertical-align:top}
  td:first-child{width:28%;color:#475569} li{margin:4px 0}
</style></head><body>
<h1>Infringement evidence — ${esc(product.brand)} ${esc(product.name)}</h1>
<p class="muted">Prepared with FakeRadar on ${new Date().toLocaleString("en-IN")}. Reviewed and confirmed by the brand owner.</p>
<div class="grid">
  <figure>${ownerPhoto ? `<img src="${ownerPhoto}" alt="Authorised product">` : "<p>(authorised photo not available)</p>"}<figcaption>Authorised product</figcaption></figure>
  <figure><img src="${esc(listing.imageUrl)}" alt="Reported listing"><figcaption>Reported listing</figcaption></figure>
</div>
<table>
  <tr><td>Listing URL</td><td>${esc(listing.url)}</td></tr>
  <tr><td>Marketplace</td><td>${esc(market(listing.marketplace).label)}</td></tr>
  <tr><td>${esc(market(listing.marketplace).idName)}</td><td>${esc(listing.asin)}</td></tr>
  <tr><td>Title</td><td>${esc(listing.title)}</td></tr>
  <tr><td>Seller</td><td>${esc(listing.seller)}</td></tr>
  <tr><td>Price</td><td>${inr(listing.price)} (authorised range ${inr(product.minPrice)}–${inr(product.maxPrice)})</td></tr>
  <tr><td>Classification</td><td>${LABELS[verdict.label].text} · ${Math.round(verdict.confidence * 100)}% confidence</td></tr>
  <tr><td>Violation type</td><td>${esc(VIOLATION_TYPE[verdict.label])}</td></tr>
</table>
<h3>Why it was flagged</h3>
<ul>${verdict.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
