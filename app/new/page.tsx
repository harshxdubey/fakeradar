"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { ScanProgress } from "@/components/ScanProgress";
import { Button, Card } from "@/components/ui";
import { resizePhoto, startScan } from "@/lib/startScan";
import type { Marketplace, Product } from "@/lib/types";

const MARKETPLACES: { id: Marketplace; name: string; enabled: boolean }[] = [
  { id: "amazon_in", name: "Amazon.in", enabled: true },
  { id: "flipkart", name: "Flipkart", enabled: false },
  { id: "meesho", name: "Meesho", enabled: false },
];

const input =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export default function NewProduct() {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sellers, setSellers] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError(null);
    const room = 3 - photos.length;
    if (room <= 0) return setPhotoError("You can add up to 3 photos.");
    setLoadingPhotos(true);
    try {
      const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
      if (!picked.length) throw new Error("Please choose image files (JPG, PNG or WebP).");
      const resized = await Promise.all(picked.map((f) => resizePhoto(f)));
      setPhotos((p) => [...p, ...resized]);
      if (files.length > room) setPhotoError("Only the first 3 photos were added.");
    } catch (e) {
      setPhotoError((e as Error).message);
    } finally {
      setLoadingPhotos(false);
    }
  }

  function product(): Product {
    return {
      brand: brand.trim(),
      name: name.trim(),
      minPrice: Number(minPrice),
      maxPrice: Number(maxPrice),
      photos,
      authorisedSellers: sellers.split(",").map((s) => s.trim()).filter(Boolean),
      marketplace: "amazon_in",
    };
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!brand.trim()) e.brand = "Enter your brand name";
    if (!name.trim()) e.name = "Enter the product name";
    const lo = Number(minPrice), hi = Number(maxPrice);
    if (!(lo > 0)) e.minPrice = "Enter a minimum price";
    if (!(hi > 0)) e.maxPrice = "Enter a maximum price";
    else if (lo > hi) e.maxPrice = "Max must be at least the min";
    if (!photos.length) e.photos = "Add at least 1 authorised photo";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function run() {
    setScanError(null);
    setScanning(true);
    try {
      const id = await startScan(product(), 6000);
      router.push(`/scan/${id}`);
    } catch (e) {
      setScanError((e as Error).message);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (validate()) run();
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Add your product</h1>
      <p className="mt-1 text-sm text-slate-600">
        We use this as the reference to tell your real product apart from fakes and copycats.
      </p>

      <Card className="mt-6 p-6">
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Brand name
              <input className={input} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. TerraSip" />
              {err("brand")}
            </label>
            <label className="block text-sm font-medium">
              Product name
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bamboo Steel Water Bottle 1L" />
              {err("name")}
            </label>
          </div>

          <div>
            <span className="text-sm font-medium">Your selling price range (₹)</span>
            <div className="mt-1 grid grid-cols-2 gap-4">
              <label className="block text-xs text-slate-500">
                Min
                <input className={input} inputMode="numeric" type="number" min={1} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="799" />
                {err("minPrice")}
              </label>
              <label className="block text-xs text-slate-500">
                Max
                <input className={input} inputMode="numeric" type="number" min={1} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="999" />
                {err("maxPrice")}
              </label>
            </div>
          </div>

          <div>
            <span className="text-sm font-medium">Authorised product photos (1–3)</span>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {photos.map((p, i) => (
                <div key={i} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt={`Authorised photo ${i + 1}`} className="aspect-square w-full rounded-lg border object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-xs font-semibold text-slate-700 shadow"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-center text-xs text-slate-500 hover:border-accent hover:text-accent">
                  <span className="text-2xl">+</span>
                  {loadingPhotos ? "Processing…" : "Upload photo"}
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
            {err("photos")}
            {photoError && <p className="mt-1 text-xs text-amber-700">{photoError}</p>}
          </div>

          <label className="block text-sm font-medium">
            Authorised sellers <span className="font-normal text-slate-500">(comma-separated)</span>
            <input className={input} value={sellers} onChange={(e) => setSellers(e.target.value)} placeholder="TerraSip Official, GreenNest Retail" />
            <span className="mt-1 block text-xs font-normal text-slate-500">Listings from these sellers are skipped — they’re never flagged.</span>
          </label>

          <fieldset>
            <legend className="text-sm font-medium">Marketplace</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {MARKETPLACES.map((m) => (
                <span
                  key={m.id}
                  className={clsx(
                    "rounded-lg border px-3 py-2 text-sm",
                    m.enabled ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-slate-200 text-slate-400",
                  )}
                >
                  {m.enabled ? "● " : ""}
                  {m.name}
                  {!m.enabled && <span className="ml-1 text-xs">· coming soon</span>}
                </span>
              ))}
            </div>
          </fieldset>

          <Button type="submit" size="lg" className="w-full" disabled={loadingPhotos}>
            Scan for fakes
          </Button>
        </form>
      </Card>

      {scanning && (
        <ScanProgress
          durationMs={6000}
          error={scanError}
          onRetry={run}
          onCancel={() => {
            setScanning(false);
            setScanError(null);
          }}
        />
      )}
    </div>
  );
}
