"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ListingCard } from "@/components/ListingCard";
import { TakedownPanel } from "@/components/TakedownPanel";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { inr, market } from "@/lib/format";
import { ASSUMED_UNITS_PER_WEEK, bucketFor, isSuspected } from "@/lib/rules";
import { forgetGenuine, getProduct, getTakedown, productKey, recordDecision } from "@/lib/profile";
import { fetchScan } from "@/lib/sync";
import { SellerView, summariseSellers } from "@/components/SellerView";
import { cacheScan, loadScan, updateScan, withDecision } from "@/lib/store";
import type { Decision, Marketplace, ScanItem, StoredScan, VerdictLabel } from "@/lib/types";

type Tab = "all" | Exclude<VerdictLabel, "unrelated"> | "unsure" | "sellers";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "counterfeit", label: "Counterfeit" },
  { id: "copycat", label: "Copycat" },
  { id: "possible_genuine_reseller", label: "Possible reseller" },
  { id: "unsure", label: "Unsure" },
  { id: "sellers", label: "Sellers" },
];

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<{ stored: StoredScan; photos: string[] } | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("all");
  const [panelFor, setPanelFor] = useState<string | null>(null);
  const [, setTrackTick] = useState(0);
  const [sellerFilter, setSellerFilter] = useState<string | null>(null);
  const [marketFilter, setMarketFilter] = useState<Marketplace | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: StoredScan; onUndo?: () => void } | null>(null);

  useEffect(() => {
    const local = loadScan(id);
    if (local) return setState(local);
    // Not in this browser: another device or a daily scan. Fetch it by its link if there's a database.
    fetchScan(id).then((stored) => {
      if (stored) cacheScan(stored);
      setState(stored ? { stored, photos: getProduct(productKey(stored.result.product))?.photos ?? [] } : null);
    });
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const view = useMemo(() => {
    if (!state) return null;
    const { result, decisions } = state.stored;
    const withBucket = result.items.map((item) => ({ item, bucket: bucketFor(item, decisions[item.listing.id]) }));
    const queue = withBucket.filter((x) => x.bucket === "queue").map((x) => x.item);
    const unsure = withBucket.filter((x) => x.bucket === "unsure").map((x) => x.item);
    const hiddenUnrelated = result.items.filter((i) => i.verdict.label === "unrelated").length;
    // "Suspected" = confident flags only; Unsure listings are counted separately so the cards match the tabs.
    const suspected = queue.filter(isSuspected).length;
    const confirmed = Object.values(decisions).filter((d) => d === "confirmed").length;
    const avgPrice = (result.product.minPrice + result.product.maxPrice) / 2;
    const sellers = summariseSellers([...queue, ...unsure], getProduct(productKey(result.product))?.offenders);
    const counts: Record<Tab, number> = {
      sellers: sellers.length,
      all: queue.length + unsure.length,
      counterfeit: queue.filter((i) => i.verdict.label === "counterfeit").length,
      copycat: queue.filter((i) => i.verdict.label === "copycat").length,
      possible_genuine_reseller: queue.filter((i) => i.verdict.label === "possible_genuine_reseller").length,
      unsure: unsure.length,
    };
    // All = everything left to review: confident flags first, then the ones that need a closer look.
    let shown: ScanItem[] =
      tab === "all" || tab === "sellers" ? [...queue, ...unsure] : tab === "unsure" ? unsure : queue.filter((i) => i.verdict.label === tab);
    if (sellerFilter) shown = shown.filter((i) => i.listing.seller === sellerFilter);
    if (marketFilter) shown = shown.filter((i) => (i.listing.marketplace ?? "amazon_in") === marketFilter);
    // Per-marketplace counts of everything left to review, for the filter chips.
    const byMarket = new Map<Marketplace, number>();
    for (const i of [...queue, ...unsure]) {
      const m = i.listing.marketplace ?? "amazon_in";
      byMarket.set(m, (byMarket.get(m) ?? 0) + 1);
    }
    const newCount = result.items.filter((i) => i.isNew && bucketFor(i, decisions[i.listing.id]) !== "hidden").length;
    return { result, queue, unsure, hiddenUnrelated, suspected, confirmed, revenue: suspected * avgPrice * ASSUMED_UNITS_PER_WEEK, counts, shown, sellers, newCount, byMarket };
  }, [state, tab, sellerFilter, marketFilter]);

  if (state === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-32 text-slate-500">
        <Spinner /> Loading scan…
      </div>
    );
  }

  if (state === null || !view) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">Scan not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This scan isn’t in this browser. Open it on the device that ran it, or use your workspace link from the Add product page.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/new"><Button>Start a new scan</Button></Link>
          <Link href="/"><Button variant="outline">Home</Button></Link>
        </div>
      </div>
    );
  }

  const { result } = view;
  const product = result.product;
  const ownerPhoto = state.photos[0];

  function save(next: StoredScan) {
    updateScan(id, next);
    setState((s) => (s ? { ...s, stored: next } : s));
  }

  function decide(item: ScanItem, d: Decision) {
    const prev = state!.stored;
    save(withDecision(prev, item.listing.id, d));
    // Brand memory: future scans skip genuine sellers and flag repeat offenders.
    recordDecision(product, item.listing, d, { scanId: id, demo: result.mode === "mock" });
    if (d === "genuine") {
      setToast({
        text: `“${item.listing.seller}” added to your authorised sellers — future scans will skip them`,
        undo: prev,
        onUndo: () => forgetGenuine(product, item.listing.seller),
      });
    }
    if (d === "unsure") setToast({ text: "Moved to Unsure — check it later, or do a test buy" });
    if (d === "confirmed") setPanelFor(item.listing.id);
  }

  const panelItem = panelFor ? result.items.find((i) => i.listing.id === panelFor) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {(result.marketplaces?.length ? result.marketplaces : ["amazon_in" as Marketplace]).map((m) => market(m).label).join(" + ")} scan ·{" "}
            {new Date(result.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            {result.mode === "mock" && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Demo data</span>}
            {result.mode === "live" && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">Live Amazon.in data</span>}
            {result.classifier === "rules" && (
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 normal-case text-slate-600" title="Checks brand spelling, price and title. Add a Claude API key to also compare photos.">
                Free rule checks · photos not compared
              </span>
            )}
            {result.classifier === "claude" && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-accent-ink">Checked by Claude</span>}
            {result.classifier === "gemini" && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-accent-ink">Checked by Gemini</span>}
          </p>
          <h1 className="mt-1 line-clamp-2 text-2xl font-bold tracking-tight" title={`${product.brand} · ${product.name}`}>
            {product.brand} · {product.name}
          </h1>
        </div>
        <Link href="/new"><Button variant="outline" size="sm">Scan another product</Button></Link>
      </div>

      {result.marketNotes?.map((note) => (
        <p key={note} className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{note}</p>
      ))}
      {result.aiNote && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{result.aiNote}</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Listings scanned" value={String(result.scanned)} />
        <Stat
          label="Suspected fakes"
          value={String(view.suspected)}
          tone="red"
          hint={view.unsure.length ? `+${view.unsure.length} need a closer look (Unsure)` : undefined}
        />
        <Stat label="Confirmed" value={String(view.confirmed)} />
        <Stat
          label="Revenue at risk / week"
          value={inr(view.revenue)}
          hint={`Estimate: suspected × avg price × ${ASSUMED_UNITS_PER_WEEK} units/week`}
        />
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Before AI: {result.duplicatesRemoved} duplicate{result.duplicatesRemoved === 1 ? "" : "s"} removed ·{" "}
        {result.authorisedFiltered.length} listing{result.authorisedFiltered.length === 1 ? "" : "s"} from authorised sellers skipped
        {result.authorisedFiltered.length > 0 && ` (${[...new Set(result.authorisedFiltered.map((l) => l.seller))].join(", ")})`}
        {" · "}After AI: {view.hiddenUnrelated} unrelated hidden
      </p>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setSellerFilter(null);
            }}
            className={clsx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.id ? "border-accent text-accent-ink" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
            <span className={clsx("ml-1.5 rounded-full px-1.5 text-xs", tab === t.id ? "bg-accent-soft" : "bg-slate-100")}>
              {view.counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {view.newCount > 0 && (
        <p className="mt-3 text-sm text-slate-700">
          <Badge className="mr-1.5 bg-accent text-white ring-accent">New</Badge>
          {view.newCount} listing{view.newCount === 1 ? "" : "s"} appeared since your last scan of this product.
        </p>
      )}

      <div className="mt-4 space-y-4">
        {view.byMarket.size > 1 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs font-medium text-slate-500">Marketplace:</span>
            {[null, ...view.byMarket.keys()].map((m) => (
              <button
                key={m ?? "all"}
                onClick={() => setMarketFilter(m)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
                  marketFilter === m ? "bg-accent text-white ring-accent" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {m ? `${market(m).label} · ${view.byMarket.get(m)}` : "All"}
              </button>
            ))}
          </div>
        )}
        {sellerFilter && (
          <div className="flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">
            <span>
              Showing listings from <b>{sellerFilter}</b>
            </span>
            <button className="font-semibold hover:underline" onClick={() => setSellerFilter(null)}>
              {tab === "sellers" ? "← Back to sellers" : "Show all"}
            </button>
          </div>
        )}
        {tab === "sellers" && !sellerFilter ? (
          <SellerView sellers={view.sellers} onPick={setSellerFilter} />
        ) : view.shown.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-3xl">{view.queue.length + view.unsure.length === 0 ? "🎉" : "🗂️"}</p>
            <p className="mt-2 font-semibold">
              {view.queue.length + view.unsure.length === 0 ? "All clear — nothing left to review" : "Nothing in this tab"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {tab === "unsure"
                ? "Listings the AI is 30–70% sure about, or that you mark ❓ Unsure, land here."
                : "Try another tab, or scan another product."}
            </p>
          </Card>
        ) : (
          view.shown.map((item) => (
            <ListingCard
              key={item.listing.id}
              item={item}
              product={product}
              ownerPhoto={ownerPhoto}
              decision={state.stored.decisions[item.listing.id]}
              trackStatus={getTakedown(item.listing.asin)?.status}
              onDecide={(d) => decide(item, d)}
              onOpenTakedown={() => setPanelFor(item.listing.id)}
            />
          ))
        )}
      </div>

      {panelItem && (
        <TakedownPanel
          item={panelItem}
          product={product}
          ownerPhoto={ownerPhoto}
          cachedText={state.stored.takedowns[panelItem.listing.id]}
          onText={(text) => {
            const s = loadScan(id)?.stored ?? state.stored;
            save({ ...s, takedowns: { ...s.takedowns, [panelItem.listing.id]: text } });
          }}
          onClose={() => setPanelFor(null)}
          onTracked={() => setTrackTick((n) => n + 1)}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast.text}
          {toast.undo && (
            <button
              className="font-semibold text-indigo-300 hover:text-indigo-200"
              onClick={() => {
                save(toast.undo!);
                toast.onUndo?.();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={clsx("mt-1 text-2xl font-bold tracking-tight", tone === "red" && "text-red-600")}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{hint}</p>}
    </Card>
  );
}
