"use client";

import { createElement, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-triggered reveal.
 *
 * IntersectionObserver rather than a scroll listener, so nothing runs on the
 * main thread between viewport crossings. Each element animates once and then
 * stops being observed — a page that keeps re-animating as you scroll back up
 * reads as a demo, not a product.
 *
 * Motion here is small on purpose: 12px and a fade. Anything bigger competes
 * with the words for attention, which is the opposite of the point.
 */
export function Reveal({
  children,
  delay = 0,
  y = 12,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  /** Milliseconds. Use to stagger siblings — 60ms apart reads as one motion. */
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "span";
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Anyone who asked for less motion gets the content, immediately, with none.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.unobserve(entry.target);
        }
      },
      // Fire slightly before the element arrives, so it is already settled by
      // the time it is properly in view.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // createElement rather than <Tag>, so one ref type serves every tag the
  // `as` prop allows instead of needing a cast per element type.
  return createElement(
    Tag,
    {
      ref,
      className: cn("motion-safe:transition-all motion-safe:duration-700", className),
      style: {
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${y}px)`,
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        transitionDelay: `${delay}ms`,
      },
    },
    children,
  );
}

/**
 * Counts up to a number when it scrolls into view.
 *
 * Used for the savings figure. A number that animates is read; a number that
 * is just printed is skimmed.
 */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  duration = 900,
  className,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);

          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            // Ease out: fast at first, so the final digits land deliberately.
            setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}
