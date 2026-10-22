"use client";
import clsx from "clsx";
import { inr, LABELS } from "@/lib/format";
import type { Offender } from "@/lib/profile";
import type { ScanItem, VerdictLabel } from "@/lib/types";
import { Badge, Card } from "./ui";

// How much each kind of flag says about the seller behind it.
const WEIGHT: Record<VerdictLabel, number> = {
  counterfeit: 1,
  copycat: 0.85,
  possible_genuine_reseller: 0.25,
  unrelated: 0,
};

export interface SellerSummary {
  seller: string;
  items: ScanItem[];
  score: number;
  offender?: Offender;
  minPrice: number;
}

/**
 * Seller risk score, 0–100: the strongest flag on any of their listings, plus 8 points per extra
 * flagged listing and 15 per fake you confirmed from them before.
 */
export function summariseSellers(items: ScanItem[], offenders: Offender[] = []): SellerSummary[] {
  const by = new Map<string, ScanItem[]>();
  for (const it of items) by.set(it.listing.seller, [...(by.get(it.listing.seller) ?? []), it]);
  const norm = (s: string) => s.trim().toLowerCase();
  return [...by.entries()]
    .map(([seller, list]) => {
      const offender = offenders.find((o) => norm(o.seller) === norm(seller));
      const strongest = Math.max(...list.map((i) => i.verdict.confidence * WEIGHT[i.verdict.label]));
      const flagged = list.filter((i) => WEIGHT[i.verdict.label] >= 0.85).length;
      const score = Math.min(100, Math.round(strongest * 100 + Math.max(0, flagged - 1) * 8 + (offender?.count ?? 0) * 15));
      return { seller, items: list, score, offender, minPrice: Math.min(...list.map((i) => i.listing.price || Infinity)) };
    })
    .sort((a, b) => b.score - a.score);
}

const band = (score: number) =>
  score >= 75
    ? { text: "High", className: "bg-red-600 text-white ring-red-600" }
    : score >= 45
      ? { text: "Medium", className: "bg-amber-100 text-amber-900 ring-amber-200" }
      : { text: "Low", className: "bg-slate-100 text-slate-700 ring-slate-200" };

export function SellerView({
  sellers,
  onPick,
}: {
  sellers: SellerSummary[];
  onPick: (seller: string) => void;
}) {
  if (!sellers.length) {
    return <Card className="p-8 text-center text-sm text-slate-500">No flagged sellers in this scan.</Card>;
  }
  return (
    <Card className="overflow-hidden">
      <div className="hidden grid-cols-[1fr_90px_110px_1.4fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
        <span>Seller</span>
        <span>Risk</span>
        <span>Listings</span>
        <span>Flags</span>
      </div>
      {sellers.map((s) => {
        const b = band(s.score);
        const labels = [...new Set(s.items.map((i) => i.verdict.label))];
        return (
          <button
            key={s.seller}
            onClick={() => onPick(s.seller)}
            className="grid w-full gap-2 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 md:grid-cols-[1fr_90px_110px_1.4fr] md:items-center md:gap-3"
            title="Show this seller's listings"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">{s.seller}</span>
              {s.offender && (
                <span className="text-xs font-medium text-red-700">
                  Repeat offender · {s.offender.count} confirmed fake{s.offender.count === 1 ? "" : "s"} before
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <Badge className={b.className}>{b.text}</Badge>
              <span className="text-sm font-semibold tabular-nums">{s.score}</span>
            </span>
            <span className="text-sm text-slate-700">
              {s.items.length} listing{s.items.length === 1 ? "" : "s"}
              {Number.isFinite(s.minPrice) && <span className="block text-xs text-slate-500">from {inr(s.minPrice)}</span>}
            </span>
            <span className="flex flex-wrap gap-1">
              {labels.map((l) => (
                <Badge key={l} className={clsx(LABELS[l].className)}>
                  {LABELS[l].text}
                </Badge>
              ))}
            </span>
          </button>
        );
      })}
    </Card>
  );
}
