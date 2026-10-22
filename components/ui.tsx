// Small shadcn-style primitives (hand-rolled to keep the prototype dependency-light).
import clsx from "clsx";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "success";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-ink shadow-soft hover:shadow-lift",
  outline: "border border-black/10 bg-white text-ink hover:bg-black/[0.03]",
  ghost: "text-ink/80 hover:bg-black/[0.04]",
  danger: "bg-fake text-white hover:bg-[#c8431f] shadow-soft",
  success: "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
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
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition duration-200 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3.5 text-sm",
        size === "md" && "h-10 px-5 text-sm",
        size === "lg" && "h-12 px-7 text-[17px]",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-2xl border border-black/[0.06] bg-white shadow-soft", className)} {...props} />;
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
