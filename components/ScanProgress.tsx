"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Button, Card, Spinner } from "./ui";

const STEPS = ["Searching Amazon.in…", "Filtering authorised sellers…", "AI comparing photos…"];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6" role="status" aria-live="polite">
        {error ? (
          <>
            <h2 className="text-lg font-semibold text-red-700">Scan failed</h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <div className="mt-5 flex gap-2">
              {onRetry && <Button onClick={onRetry}>Try again</Button>}
              {onCancel && <Button variant="outline" onClick={onCancel}>Back</Button>}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold">Scanning for fakes</h2>
            <ol className="mt-4 space-y-3">
              {STEPS.map((s, i) => (
                <li key={s} className={clsx("flex items-center gap-3 text-sm", i > step && "text-slate-400")}>
                  {i < step ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] text-white">✓</span>
                  ) : i === step ? (
                    <Spinner className="h-5 w-5 text-accent" />
                  ) : (
                    <span className="h-5 w-5 rounded-full border-2 border-slate-200" />
                  )}
                  {s}
                </li>
              ))}
            </ol>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-accent transition-all duration-700"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
