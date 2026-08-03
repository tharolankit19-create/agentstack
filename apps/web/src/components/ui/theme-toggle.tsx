"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

const KEY = "agentstack-theme";

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
    const stored = localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
      return;
    }
    setTheme(
      window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
    );
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
