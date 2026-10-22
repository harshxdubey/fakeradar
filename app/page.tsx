"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Radar } from "@/components/Radar";
import { Reveal } from "@/components/Reveal";
import { ScanProgress } from "@/components/ScanProgress";
import { bagShot } from "@/lib/images";
import { SAMPLE_PRODUCT } from "@/lib/mock";
import { startScan } from "@/lib/startScan";

// A fictional luxury house, so the example never implies anything about a real brand or its sellers.
const EXAMPLE_REAL = bagShot({ brand: "Maison Vela" });
const EXAMPLE_FAKE = bagShot({ brand: "Maison Vella", leather: "#8a5634", flap: "#6b4024", hardware: "#e3c463", sloppy: true, sticker: "90% OFF" });

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const STEPS = [
  {
    title: "Add your product once.",
    body: "A photo, your price range and the sellers you trust.",
    icon: icon(<><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>),
  },
  {
    title: "It scans every day.",
    body: "Amazon.in, Flipkart and Myntra — photos, prices, sellers.",
    icon: icon(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 12 18 6" /></>),
  },
  {
    title: "You confirm. It reports.",
    body: "Evidence on every flag and a takedown ready to paste.",
    icon: icon(<><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  },
];

export default function Home() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trySample() {
    setError(null);
    setScanning(true);
    try {
      const id = await startScan(SAMPLE_PRODUCT, 3500, { demo: true });
      router.push(`/scan/${id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const ctas = (dark = false) => (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <button
        onClick={trySample}
        className="rounded-full bg-accent px-7 py-3.5 text-[17px] font-medium text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-accent-ink hover:shadow-lift active:translate-y-0"
      >
        Try it with a sample
      </button>
      <Link
        href="/new"
        className={
          dark
            ? "rounded-full px-5 py-3.5 text-[17px] font-medium text-indigo-300 transition hover:text-white"
            : "rounded-full px-5 py-3.5 text-[17px] font-medium text-accent transition hover:text-accent-ink"
        }
      >
        Add your product ›
      </Link>
    </div>
  );

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-8 pt-20 text-center md:pt-28">
        <p className="animate-fade-up text-[15px] font-semibold text-fake">New · Amazon.in, Flipkart and Myntra</p>
        <h1 className="mt-4 animate-fade-up text-balance text-5xl font-semibold leading-[1.05] tracking-[-0.02em] [animation-delay:80ms] md:text-7xl">
          Find the fakes.
          <br />
          <span className="text-gradient">
            Before your <span className="whitespace-nowrap">customers do.</span>
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-xl leading-relaxed text-ink-soft [animation-delay:160ms] md:text-2xl">
          FakeRadar watches the marketplaces for copies of your product, shows you the proof, and drafts the takedown.
        </p>
        <div className="mt-10 animate-fade-up [animation-delay:240ms]">{ctas()}</div>
        <p className="mt-3 animate-fade-up text-sm text-ink-faint [animation-delay:240ms]">No sign-up. Takes about 10 seconds.</p>
      </section>

      <div className="mx-auto max-w-[560px] animate-fade-up px-6 [animation-delay:320ms]">
        <Radar className="animate-float" />
      </div>

      <Reveal className="mx-auto mt-12 max-w-4xl px-6 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-ink-faint">Watching</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-2xl font-semibold tracking-tight text-ink-soft md:text-3xl">
          <span>Amazon.in</span>
          <span>Flipkart</span>
          <span>Myntra</span>
        </div>
      </Reveal>

      {/* Spot the difference */}
      <section className="mt-28 bg-white py-24 md:mt-36 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="text-center">
            <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] md:text-6xl">One letter off. 90% cheaper.</h2>
            <p className="mt-4 text-xl text-ink-soft md:text-2xl">FakeRadar spots what a quick look misses.</p>
          </Reveal>

          <div className="mt-16 grid items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
            <Reveal>
              <figure className="rounded-[28px] bg-canvas p-8 shadow-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={EXAMPLE_REAL} alt="Your authorised handbag" className="mx-auto aspect-square w-full max-w-sm rounded-2xl" />
                <figcaption className="mt-5 text-center">
                  <span className="block text-lg font-semibold">Your product</span>
                  <span className="text-ink-soft">Maison Vela · ₹24,900</span>
                </figcaption>
              </figure>
            </Reveal>

            <Reveal delay={150} className="flex justify-center">
              <span className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">vs</span>
            </Reveal>

            <Reveal delay={250}>
              <figure className="relative rounded-[28px] bg-fake-soft p-8 shadow-soft ring-2 ring-fake/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={EXAMPLE_FAKE} alt="A counterfeit handbag listing" className="mx-auto aspect-square w-full max-w-sm rounded-2xl" />
                <figcaption className="mt-5 text-center">
                  <span className="block text-lg font-semibold text-fake">Listing on Myntra</span>
                  <span className="text-ink-soft">“Maison Vella” · ₹2,499</span>
                </figcaption>
              </figure>
            </Reveal>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-2">
            {[
              ["Plate reads “Maison Vella”", "one letter off yours"],
              ["₹2,499", "90% below your price"],
              ["Uses your photo", "91% match, recoloured"],
              ["Unknown seller", "not an authorised boutique"],
            ].map(([a, b], i) => (
              <Reveal key={a} delay={100 * i}>
                <div className="flex items-center gap-3 rounded-2xl bg-canvas px-5 py-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fake text-sm font-bold text-white">!</span>
                  <p className="text-[17px]">
                    <span className="font-semibold">{a}</span> <span className="text-ink-soft">— {b}</span>
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <Reveal className="text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] md:text-6xl">Set it up once. That’s it.</h2>
        </Reveal>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={120 * i}>
              <div className="h-full rounded-[28px] bg-white p-8 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">{s.icon}</span>
                <p className="mt-8 text-sm font-semibold text-ink-faint">Step {i + 1}</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Numbers */}
      <section className="bg-white py-24 md:py-32">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 text-center md:grid-cols-3">
          {[
            ["57", "listings checked in one scan"],
            ["89s", "across three marketplaces"],
            ["~9 hrs", "back every week"],
          ].map(([n, l], i) => (
            <Reveal key={l} delay={120 * i}>
              <p className="text-6xl font-semibold tracking-[-0.03em] text-gradient md:text-7xl">{n}</p>
              <p className="mt-3 text-lg text-ink-soft">{l}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 text-center">
          <p className="text-sm text-ink-faint">From a live test on real listings. Time saved is an estimate for one product.</p>
        </Reveal>
      </section>

      {/* Closing */}
      <section className="bg-[#1d1d1f] py-24 text-center text-white md:py-32">
        <Reveal className="mx-auto max-w-3xl px-6">
          <div className="mx-auto mb-10 w-44">
            <Radar labels={false} tone="dark" />
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] md:text-6xl">See it work in seconds.</h2>
          <p className="mx-auto mt-4 max-w-xl text-xl text-white/60">Run a scan on a sample product. Nothing is ever reported without&nbsp;you.</p>
          <div className="mt-10">{ctas(true)}</div>
        </Reveal>
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
