"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

const KEY = "kryxai-theme";
const LEGACY_KEY = "agentstack-theme";

/**
 * Flips the theme and remembers the choice.
 *
 * The icon can only be drawn once we know which theme is actually on, and that
 * lives in localStorage and the OS preference — neither of which exists on the
 * server. So the button renders as an empty box of the right size until it
 * mounts. Reserving the space is the point: a toggle that pops into existence
 * shoves the whole header sideways.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    } catch {
      stored = null;
    }

    const apply = (next: Theme) => {
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };

    if (stored === "dark" || stored === "light") {
      apply(stored);
      try {
        localStorage.setItem(KEY, stored);
        localStorage.removeItem(LEGACY_KEY);
      } catch {}
      return;
    }

    apply(media.matches ? "light" : "dark");
    const onChange = (event: MediaQueryListEvent) => apply(event.matches ? "light" : "dark");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function flip() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private browsing. The theme still applies for this page view.
    }
  }

  const base =
    "grid size-9 place-items-center rounded-lg border border-line text-muted " +
    "transition-colors hover:text-fg hover:border-line-strong active:scale-95";

  if (theme === null) {
    return <span aria-hidden className={`${base} ${className}`} />;
  }

  return (
    <button
      type="button"
      onClick={flip}
      className={`${base} ${className}`}
      aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
    >
      {theme === "light" ? (
        <Moon className="size-4" aria-hidden />
      ) : (
        <Sun className="size-4" aria-hidden />
      )}
    </button>
  );
}
