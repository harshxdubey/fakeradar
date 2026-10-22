"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { TRACK } from "@/components/ListingCard";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { inr } from "@/lib/format";
import { listTakedowns, removeTakedown, setTakedownStatus } from "@/lib/profile";
import { pullWorkspace } from "@/lib/sync";
import type { RecheckResult, TakedownStatus, TrackedTakedown } from "@/lib/types";

type Filter = "all" | TakedownStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "confirmed", label: "Not reported" },
  { id: "reported", label: "Reported" },
  { id: "still_live", label: "Still live" },
  { id: "removed", label: "Removed" },
  { id: "rejected", label: "Rejected" },
];

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—");
const daysSince = (iso?: string) => (iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 864e5)) : 0);

export default function Takedowns() {
  const [items, setItems] = useState<TrackedTakedown[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => setItems(listTakedowns());
  useEffect(() => {
    refresh();
    pullWorkspace().then((pulled) => pulled && refresh());
  }, []);

  const stats = useMemo(() => {
    const all = items ?? [];
    const count = (s: TakedownStatus) => all.filter((t) => t.status === s).length;
    const reported = all.filter((t) => t.status !== "confirmed").length;
    return {
      total: all.length,
      notReported: count("confirmed"),
      removed: count("removed"),
      open: count("reported") + count("still_live"),
      successRate: reported ? Math.round((count("removed") / reported) * 100) : null,
    };
  }, [items]);

  async function recheck(t: TrackedTakedown) {
    setChecking(t.asin);
    setError(null);
    try {
      const res = await fetch("/api/recheck", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: t.url, demo: t.demo }),
      });
      const json = (await res.json()) as { result?: RecheckResult; error?: string };
      if (!res.ok || !json.result) throw new Error(json.error || `Re-check failed (${res.status})`);
      setTakedownStatus(t.asin, json.result.live ? "still_live" : "removed", json.result.note);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(null);
    }
  }

  function setStatus(t: TrackedTakedown, s: TakedownStatus) {
    setTakedownStatus(t.asin, s);
    refresh();
  }

  if (items === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-32 text-slate-500">
        <Spinner /> Loading takedowns…
      </div>
    );
  }

  const shown = filter === "all" ? items : items.filter((t) => t.status === filter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Takedown tracker</h1>
      <p className="mt-1 text-sm text-slate-600">
        Every fake you confirmed, from report to removal. Re-check visits the listing on Amazon.in to see if it’s gone.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Confirmed fakes" value={String(stats.total)} />
        <Stat label="Not reported yet" value={String(stats.notReported)} tone={stats.notReported ? "red" : undefined} />
        <Stat label="Waiting / still live" value={String(stats.open)} />
        <Stat
          label="Removed"
          value={String(stats.removed)}
          hint={stats.successRate === null ? "No reports yet" : `${stats.successRate}% of reported listings`}
        />
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              filter === f.id ? "border-accent text-accent-ink" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {f.label}
            <span className={clsx("ml-1.5 rounded-full px-1.5 text-xs", filter === f.id ? "bg-accent-soft" : "bg-slate-100")}>
              {f.id === "all" ? items.length : items.filter((t) => t.status === f.id).length}
            </span>
          </button>
        ))}
      </div>

      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="font-semibold">No confirmed fakes yet</p>
            <p className="mt-1 text-sm text-slate-500">When you click “Confirm fake” on a scan, it’s tracked here until it’s removed.</p>
            <Link href="/new" className="mt-4 inline-block">
              <Button>Scan a product</Button>
            </Link>
          </Card>
        ) : shown.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-500">Nothing with this status.</Card>
        ) : (
          shown.map((t) => (
            <Card key={t.asin} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg border object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={TRACK[t.status].className}>{TRACK[t.status].text}</Badge>
                  {t.demo && <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Demo</Badge>}
                  <span className="text-xs text-slate-500">{t.productLabel}</span>
                </div>
                <a href={t.url} target="_blank" rel="noreferrer" className="mt-1 line-clamp-1 font-semibold hover:underline">
                  {t.title}
                </a>
                <p className="mt-0.5 text-sm text-slate-600">
                  {inr(t.price)} · {t.seller} · <span className="font-mono text-xs">{t.asin}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Confirmed {day(t.confirmedAt)} · Reported {day(t.reportedAt)}
                  {t.reportedAt && t.status === "reported" && ` (${daysSince(t.reportedAt)} days ago)`} · Last check {day(t.checkedAt)}
                  {t.checkNote && <> · <span className="text-slate-700">{t.checkNote}</span></>}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {t.status === "confirmed" && (
                  <Button size="sm" variant="success" onClick={() => setStatus(t, "reported")}>
                    I’ve reported it
                  </Button>
                )}
                {t.status !== "confirmed" && t.status !== "removed" && (
                  <Button size="sm" onClick={() => recheck(t)} disabled={checking !== null}>
                    {checking === t.asin ? (
                      <>
                        <Spinner /> Checking…
                      </>
                    ) : (
                      "Re-check"
                    )}
                  </Button>
                )}
                {(t.status === "reported" || t.status === "still_live") && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(t, "rejected")}>
                    Amazon rejected
                  </Button>
                )}
                {(t.status === "rejected" || t.status === "still_live") && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(t, "reported")}>
                    Reported again
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    removeTakedown(t.asin);
                    refresh();
                  }}
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
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
