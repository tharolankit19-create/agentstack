"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, Coins, X } from "lucide-react";

interface PaywallState {
  open: (reason?: string) => void;
  /** Runs a fetch and opens the credit dialog on 402. Returns null when walled. */
  guard: <T>(run: () => Promise<Response>, reason?: string) => Promise<T | null>;
  /** Kept for call-site compatibility. PAYG accounts are usable once signed in. */
  isPaid: boolean;
}

const PaywallContext = createContext<PaywallState | null>(null);

export function usePaywall(): PaywallState {
  const context = useContext(PaywallContext);
  if (!context) {
    throw new Error("usePaywall must be used inside <PaywallProvider>.");
  }
  return context;
}

export function PaywallProvider({
  isPaid,
  children,
}: {
  isPaid: boolean;
  children: ReactNode;
}) {
  const [reason, setReason] = useState<string | null>(null);

  const open = useCallback((why?: string) => {
    setReason(why ?? "Add credits to keep Kryx working.");
  }, []);

  const guard = useCallback(
    async <T,>(run: () => Promise<Response>, why?: string): Promise<T | null> => {
      const response = await run();

      if (response.status === 402) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setReason(payload.error ?? why ?? "Add credits to keep Kryx working.");
        return null;
      }

      const payload = (await response.json().catch(() => ({}))) as T & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Something went wrong.");
      }
      return payload;
    },
    [],
  );

  return (
    <PaywallContext.Provider value={{ open, guard, isPaid }}>
      {children}
      {reason ? (
        <CreditDialog reason={reason} onClose={() => setReason(null)} />
      ) : null}
    </PaywallContext.Provider>
  );
}

function CreditDialog({
  reason,
  onClose,
}: {
  reason: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add Kryx credits"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="animate-in-up w-full max-w-md rounded-[24px] border border-line bg-surface p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#4f6bff]/10 text-[#4f6bff]">
            <Coins className="size-5" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid size-9 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg-strong"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-fg-strong">
          {reason}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Your setup stays exactly where it is. Add prepaid credits and Kryx
          resumes the metered specialist work. No subscription and no
          auto-renewal.
        </p>

        <div className="mt-5 rounded-2xl border border-line bg-surface-2 p-4">
          <p className="text-sm font-bold text-fg-strong">100 credits = $1</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Purchased credits do not expire, and work pauses before the balance
            can go negative.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/dashboard/usage"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-fg-strong px-4 text-sm font-bold text-bg"
          >
            Add credits <ArrowRight className="size-4" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-line px-4 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-fg-strong"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
