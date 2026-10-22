"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { openEvidenceSheet } from "@/lib/evidence";
import { getTakedown, setTakedownStatus } from "@/lib/profile";
import { inr, VIOLATION_TYPE } from "@/lib/format";
import { TRADEMARK_PLACEHOLDER } from "@/lib/takedown";
import type { Product, ScanItem } from "@/lib/types";
import { Button, Spinner } from "./ui";

export function TakedownPanel({
  item,
  product,
  ownerPhoto,
  cachedText,
  onText,
  onClose,
  onTracked,
}: {
  item: ScanItem;
  product: Product;
  ownerPhoto?: string;
  cachedText?: string;
  onText: (text: string) => void;
  onClose: () => void;
  onTracked?: () => void;
}) {
  const { listing, verdict } = item;
  const [text, setText] = useState(cachedText ?? "");
  const [loading, setLoading] = useState(!cachedText);
  const [error, setError] = useState<string | null>(null);
  const [trademark, setTrademark] = useState("");
  const [copied, setCopied] = useState(false);
  const [tracked, setTracked] = useState(() => getTakedown(listing.asin));

  function markReported() {
    setTakedownStatus(listing.asin, "reported");
    setTracked(getTakedown(listing.asin));
    onTracked?.();
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/takedown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product: { brand: product.brand, name: product.name }, listing, verdict }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setText(json.text);
      onText(json.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!cachedText) load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);

  const finalText = trademark.trim() ? text.split(TRADEMARK_PLACEHOLDER).join(trademark.trim()) : text;

  async function copy() {
    try {
      await navigator.clipboard.writeText(finalText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = finalText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Takedown pack">
      <button className="absolute inset-0 bg-slate-900/30" aria-label="Close takedown pack" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Takedown pack</p>
            <h2 className="mt-0.5 font-semibold leading-snug">{listing.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <b>FakeRadar never files for you</b> — review and submit it yourself on Amazon’s{" "}
            <i>Report a Violation</i> form.
          </div>

          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-slate-500">Listing URL</dt>
            <dd className="break-all"><a className="text-accent hover:underline" href={listing.url} target="_blank" rel="noreferrer">{listing.url}</a></dd>
            <dt className="text-slate-500">ASIN</dt><dd className="font-mono">{listing.asin}</dd>
            <dt className="text-slate-500">Seller</dt><dd>{listing.seller}</dd>
            <dt className="text-slate-500">Price</dt><dd>{inr(listing.price)}</dd>
            <dt className="text-slate-500">Violation</dt><dd>{VIOLATION_TYPE[verdict.label]}</dd>
          </dl>

          <label className="block text-sm font-medium">
            Your trademark number
            <input
              value={trademark}
              onChange={(e) => setTrademark(e.target.value)}
              placeholder="e.g. 4567890 (Class 21)"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">Left blank on purpose — only you can provide it.</span>
          </label>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">Report text</span>
              {!loading && !error && <span className="text-xs text-slate-400">Drafted from this listing’s data + evidence only</span>}
            </div>
            {loading ? (
              <div className="flex h-56 items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-slate-500">
                <Spinner /> Drafting report…
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Couldn’t draft the report: {error}
                <Button size="sm" variant="outline" className="ml-2" onClick={load}>Retry</Button>
              </div>
            ) : (
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-slate-50 p-3 font-sans text-[13px] leading-relaxed text-slate-800">
                {finalText}
              </pre>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 p-4">
          <Button onClick={copy} disabled={loading || !!error}>{copied ? "Copied ✓" : "Copy text"}</Button>
          <Button variant="outline" onClick={() => openEvidenceSheet(product, ownerPhoto, item)}>
            Download evidence (PDF)
          </Button>
          {tracked && tracked.status === "confirmed" ? (
            <Button variant="success" onClick={markReported} title="Click after you submit the report on Amazon">
              I've reported it ✓
            </Button>
          ) : tracked ? (
            <Link href="/takedowns" className="self-center text-sm text-accent hover:underline">
              Reported {tracked.reportedAt ? new Date(tracked.reportedAt).toLocaleDateString("en-IN") : ""} · Track it →
            </Link>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
