"use client";
import { useEffect, useRef, type ReactNode } from "react";
import clsx from "clsx";

/** Fades its children up into place the first time they scroll into view. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => {
      el.classList.add("is-visible");
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && show(), {
      threshold: 0.15,
      rootMargin: "0px 0px -40px 0px",
    });
    // A fast flick or a jump link can skip past an element without it ever "intersecting":
    // anything that is already above the bottom of the screen is shown regardless.
    const onScroll = () => el.getBoundingClientRect().top < window.innerHeight && show();
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return (
    <div ref={ref} className={clsx("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
