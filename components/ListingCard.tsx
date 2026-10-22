"use client";
import clsx from "clsx";
import { inr, LABELS, RISK } from "@/lib/format";
import { PHOTO_SAME, PHOTO_SIMILAR } from "@/lib/imageHash";
import type { Decision, Product, ScanItem, TakedownStatus } from "@/lib/types";
import { Badge, Button, Card } from "./ui";

export function ListingCard({
  item,
  product,
  ownerPhoto,
  decision,
  trackStatus,
  onDecide,
  onOpenTakedown,
}: {
  item: ScanItem;
  product: Product;
  ownerPhoto?: string;
  decision?: Decision;
  trackStatus?: TakedownStatus;
  onDecide: (d: Decision) => void;
  onOpenTakedown: () => void;
}) {
  const { listing, verdict } = item;
  const belowMin = product.minPrice > 0 && listing.price < product.minPrice;
  const label = LABELS[verdict.label];
  const risk = RISK[verdict.seller_risk];
  const confirmed = decision === "confirmed";

  return (
    <Card className={clsx("overflow-hidden", confirmed && "ring-2 ring-red-300")}>
      <div className="grid gap-4 p-4 sm:grid-cols-[260px_1fr] sm:p-5">
        <div className="grid grid-cols-2 gap-2">
          <figure>
            {ownerPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ownerPhoto} alt="Your authorised product" className="aspect-square w-full rounded-lg border object-cover" />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border bg-slate-50 text-center text-[11px] text-slate-400">
                Photo unavailable
              </div>
            )}
            <figcaption className="mt-1 text-center text-[11px] text-slate-500">Yours</figcaption>
          </figure>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={listing.imageUrl} alt={`Listing: ${listing.title}`} className="aspect-square w-full rounded-lg border object-cover" />
            <figcaption className="mt-1 text-center text-[11px] text-slate-500">This listing</figcaption>
          </figure>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.isNew && <Badge className="bg-accent text-white ring-accent">New</Badge>}
            <Badge className={label.className}>{label.text}</Badge>
            <span className="text-xs text-slate-500">{Math.round(verdict.confidence * 100)}% confidence</span>
            <span className="text-xs text-slate-500">
              · Seller risk <b className={risk.className}>{risk.text}</b>
            </span>
            {item.photoMatch !== undefined && <PhotoBadge match={item.photoMatch} />}
            {confirmed && <Badge className="bg-red-600 text-white ring-red-600">Confirmed fake</Badge>}
            {confirmed && trackStatus && trackStatus !== "confirmed" && (
              <Badge className={TRACK[trackStatus].className}>{TRACK[trackStatus].text}</Badge>
            )}
            {decision === "unsure" && <Badge className="bg-slate-100 text-slate-600 ring-slate-200">Marked unsure</Badge>}
          </div>

          <a href={listing.url} target="_blank" rel="noreferrer" className="mt-2 block font-semibold leading-snug hover:underline">
            {listing.title}
          </a>
          <p className="mt-1 text-sm text-slate-600">
            <span className={clsx("font-semibold", belowMin ? "text-red-600" : "text-slate-900")}>{inr(listing.price)}</span>
            {belowMin && <span className="ml-1 text-xs text-red-600">below your {inr(product.minPrice)} minimum</span>}
            <span className="mx-1.5 text-slate-300">|</span>
            Seller: <span className="font-medium">{listing.seller}</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="font-mono text-xs">{listing.asin}</span>
          </p>

          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why we flagged this</p>
            <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
              {verdict.evidence.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  {e}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {confirmed ? (
              <>
                <Button variant="danger" size="sm" onClick={onOpenTakedown}>Open takedown pack</Button>
                <Button variant="ghost" size="sm" onClick={() => onDecide("unsure")}>Undo — mark unsure</Button>
              </>
            ) : (
              <>
                <Button variant="danger" size="sm" onClick={() => onDecide("confirmed")}>✅ Confirm fake</Button>
                <Button variant="success" size="sm" onClick={() => onDecide("genuine")}>👍 Genuine</Button>
                {decision !== "unsure" && (
                  <Button variant="outline" size="sm" onClick={() => onDecide("unsure")}>❓ Unsure</Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export const TRACK: Record<TakedownStatus, { text: string; className: string }> = {
  confirmed: { text: "Not reported yet", className: "bg-slate-100 text-slate-700 ring-slate-200" },
  reported: { text: "Reported", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  removed: { text: "Removed ✓", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  still_live: { text: "Still live", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  rejected: { text: "Report rejected", className: "bg-red-50 text-red-700 ring-red-200" },
};

function PhotoBadge({ match }: { match: number }) {
  const pct = Math.round(match * 100);
  const [text, className] =
    match >= PHOTO_SAME
      ? [`Uses your photo · ${pct}%`, "bg-red-50 text-red-700 ring-red-200"]
      : match >= PHOTO_SIMILAR
        ? [`Similar photo · ${pct}%`, "bg-amber-50 text-amber-800 ring-amber-200"]
        : [`Different photo · ${pct}%`, "bg-slate-100 text-slate-600 ring-slate-200"];
  return (
    <span title="Free image fingerprint compared with your authorised photos">
      <Badge className={className}>{text}</Badge>
    </span>
  );
}
