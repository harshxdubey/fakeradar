"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Radar } from "./Radar";
import { Button } from "./ui";

const STEPS = ["Searching marketplaces", "Filtering authorised sellers", "Comparing photos and listings"];

export function ScanProgress({
  durationMs,
  error,
  onRetry,
  onCancel,
}: {
  durationMs: number;
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (error) return;
    setStep(0);
    const per = durationMs / STEPS.length;
    const timers = STEPS.slice(1).map((_, i) => setTimeout(() => setStep(i + 1), per * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, [durationMs, error]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 p-6 backdrop-blur-2xl">
      <div className="w-full max-w-sm animate-fade-up text-center" role="status" aria-live="polite">
        {error ? (
          <>
            <p className="text-2xl font-semibold tracking-tight text-fake">Scan didn’t finish</p>
            <p className="mt-3 text-[15px] text-ink-soft">{error}</p>
            <div className="mt-8 flex justify-center gap-3">
              {onRetry && <Button onClick={onRetry}>Try again</Button>}
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Back
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <Radar className="mx-auto w-56" labels={false} />
            <p className="mt-8 text-2xl font-semibold tracking-tight">Scanning for fakes</p>
            <div className="relative mt-3 h-6 overflow-hidden">
              {STEPS.map((s, i) => (
                <p
                  key={s}
                  className={clsx(
                    "absolute inset-x-0 text-[15px] text-ink-soft transition-all duration-500",
                    i === step ? "translate-y-0 opacity-100" : i < step ? "-translate-y-4 opacity-0" : "translate-y-4 opacity-0",
                  )}
                >
                  {s}…
                </p>
              ))}
            </div>
            <div className="mx-auto mt-6 flex w-24 justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <span key={i} className={clsx("h-1.5 flex-1 rounded-full transition-colors duration-500", i <= step ? "bg-accent" : "bg-black/10")} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
