"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScanProgress } from "@/components/ScanProgress";
import { Button, Card } from "@/components/ui";
import { productShot } from "@/lib/images";
import { SAMPLE_PRODUCT } from "@/lib/mock";
import { startScan } from "@/lib/startScan";

const EXAMPLE_FAKE = productShot({ brand: "TerraSlp", tagline: "BAMBOO · STEEL · 1 LITRE", sticker: "70% OFF" });

const STEPS = [
  { n: "1", title: "Upload", body: "Add your product photo, price range and the sellers you've authorised." },
  { n: "2", title: "Scan", body: "We search Amazon.in and AI compares every listing against your real product." },
  { n: "3", title: "Confirm & report", body: "You confirm each fake. We draft the takedown report — you submit it." },
];

export default function Home() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trySample() {
    setError(null);
    setScanning(true);
    try {
      const id = await startScan(SAMPLE_PRODUCT, 3500);
      router.push(`/scan/${id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
        <div>
          <p className="mb-3 inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
            For small D2C brands · Amazon.in today, Flipkart &amp; Meesho next
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Find fakes of your product in 2 minutes
          </h1>
          <p className="mt-4 max-w-lg text-lg text-slate-600">
            Stop spending a day hunting counterfeit and copycat listings by hand. FakeRadar finds them, shows you
            the evidence, and drafts the takedown — you stay in control of every report.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={trySample}>
              Try with sample product
            </Button>
            <Link href="/new">
              <Button size="lg" variant="outline">Add your product</Button>
            </Link>
          </div>
          <p className="mt-3 text-sm text-slate-500">No sign-up. Sample: “TerraSip Bamboo Steel Water Bottle 1L”.</p>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Example flag
          </div>
          <div className="grid grid-cols-2 gap-3 p-5">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SAMPLE_PRODUCT.photos[0]} alt="Your authorised product" className="aspect-square w-full rounded-lg border" />
              <figcaption className="mt-1 text-center text-xs text-slate-500">Your product</figcaption>
            </figure>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={EXAMPLE_FAKE} alt="Suspected fake listing" className="aspect-square w-full rounded-lg border-2 border-red-300" />
              <figcaption className="mt-1 text-center text-xs text-red-600">Listing on Amazon.in · ₹259</figcaption>
            </figure>
          </div>
          <ul className="space-y-1 border-t border-slate-100 px-5 py-4 text-sm text-slate-700">
            <li>• Brand reads “TerraSlp” — one letter off</li>
            <li>• Price 68% below your minimum</li>
            <li>• Seller isn’t on your authorised list</li>
          </ul>
        </Card>
      </section>

      <section className="grid gap-4 pb-16 md:grid-cols-3">
        {STEPS.map((s) => (
          <Card key={s.n} className="p-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-ink">
              {s.n}
            </span>
            <h3 className="mt-3 font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{s.body}</p>
          </Card>
        ))}
      </section>

      {scanning && (
        <ScanProgress
          durationMs={3500}
          error={error}
          onRetry={trySample}
          onCancel={() => {
            setScanning(false);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
