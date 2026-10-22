// Small shadcn-style primitives (hand-rolled to keep the prototype dependency-light).
import clsx from "clsx";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "success";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-ink shadow-sm",
  outline: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  success: "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-xl border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
      aria-hidden
    />
  );
}
