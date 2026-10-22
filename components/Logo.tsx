export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="8" opacity=".5" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 12 18 6" strokeLinecap="round" />
        </svg>
      </span>
      FakeRadar
    </span>
  );
}
