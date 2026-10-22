import clsx from "clsx";

/**
 * FakeRadar's signature graphic: a radar with a rotating sweep and pulsing blips (the fakes it finds).
 * Pure SVG + CSS animation; still under prefers-reduced-motion.
 */
export function Radar({
  className,
  labels = true,
  tone = "light",
}: {
  className?: string;
  labels?: boolean;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const ring = dark ? "rgba(255,255,255,0.14)" : "#c7d2fe";
  const axis = dark ? "rgba(255,255,255,0.08)" : "#e0e7ff";
  return (
    <div className={clsx("relative aspect-square", className)} aria-hidden>
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#eef2ff" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {!dark && <circle cx="200" cy="200" r="196" fill="url(#radar-bg)" />}
        {[190, 140, 90, 40].map((r) => (
          <circle key={r} cx="200" cy="200" r={r} fill="none" stroke={ring} strokeWidth={dark ? 2 : 1} />
        ))}
        <line x1="10" y1="200" x2="390" y2="200" stroke={axis} strokeWidth="1" />
        <line x1="200" y1="10" x2="200" y2="390" stroke={axis} strokeWidth="1" />
      </svg>

      {/* Rotating sweep */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full origin-center animate-sweep">
        <path d="M200 200 L200 10 A190 190 0 0 1 334 66 Z" fill="url(#radar-sweep)" />
        <line x1="200" y1="200" x2="334" y2="66" stroke={dark ? "#a5b4fc" : "#4f46e5"} strokeWidth={dark ? 3 : 2} strokeLinecap="round" />
      </svg>

      {/* Blips: fakes found */}
      {[
        { left: "68%", top: "26%", delay: "0s", size: 14, label: "TerraSlp · ₹259" },
        { left: "27%", top: "68%", delay: "0.8s", size: 11, label: "Copycat · ₹559" },
        { left: "74%", top: "70%", delay: "1.6s", size: 9, label: null },
        { left: "30%", top: "33%", delay: "1.2s", size: 8, label: null },
      ].map((b, i) => (
        <div key={i} className="absolute" style={{ left: b.left, top: b.top }}>
          {/* Centred with offsets, not translate: the pulse animations own `transform`. */}
          <span
            className="absolute animate-ripple rounded-full bg-fake/40"
            style={{ left: -b.size, top: -b.size, width: b.size * 2, height: b.size * 2, animationDelay: b.delay }}
          />
          <span
            className={clsx(
              "absolute animate-blip rounded-full bg-fake",
              dark ? "shadow-[0_0_12px_rgba(226,81,43,0.8)]" : "shadow-[0_0_0_3px_rgba(255,255,255,0.9)]",
            )}
            style={{ left: -b.size / 2, top: -b.size / 2, width: b.size, height: b.size, animationDelay: b.delay }}
          />
          {labels && b.label && (
            <span className="absolute left-3 top-2 hidden whitespace-nowrap rounded-full bg-white/90 sm:block px-2.5 py-1 text-[11px] font-semibold text-ink shadow-soft backdrop-blur">
              {b.label}
            </span>
          )}
        </div>
      ))}

      <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_6px_rgba(79,70,229,0.15)]" />
    </div>
  );
}
