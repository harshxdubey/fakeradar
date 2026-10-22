// Email alerts via Resend (free tier). Optional: without RESEND_API_KEY, daily scans still run
// and their results show in the app; nothing is emailed.
import { inr, LABELS } from "./format";
import type { ScanItem, ScanResult } from "./types";

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY);

// Without a verified domain, Resend only sends from this address, to the account owner's email.
const FROM = () => process.env.ALERT_FROM_EMAIL || "FakeRadar <onboarding@resend.dev>";

export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function alertHtml(result: ScanResult, flagged: ScanItem[], newCount: number) {
  const link = `${appUrl()}/scan/${result.id}`;
  const rows = flagged
    .slice(0, 10)
    .map(
      ({ listing, verdict }) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee"><img src="${esc(listing.imageUrl)}" width="56" height="56" style="object-fit:cover;border-radius:6px" alt=""></td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px">
          <b>${esc(LABELS[verdict.label].text)}</b> · ${Math.round(verdict.confidence * 100)}%<br>
          <a href="${esc(listing.url)}" style="color:#4f46e5">${esc(listing.title.slice(0, 90))}</a><br>
          ${inr(listing.price)} · ${esc(listing.seller)}<br>
          <span style="color:#64748b">${esc(verdict.evidence[0] ?? "")}</span>
        </td></tr>`,
    )
    .join("");
  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:600px;color:#0f172a">
    <h2 style="margin:0 0 4px">${flagged.length} suspected fake${flagged.length === 1 ? "" : "s"} for ${esc(result.product.brand)}</h2>
    <p style="margin:0 0 16px;color:#475569">${esc(result.product.name)} · daily Amazon.in scan · ${newCount} new since the last scan</p>
    <table style="border-collapse:collapse;width:100%">${rows}</table>
    <p style="margin:20px 0"><a href="${link}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Review and report</a></p>
    <p style="color:#94a3b8;font-size:12px">FakeRadar never files reports for you — you review and submit every takedown yourself.</p>
  </div>`;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM(), to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
