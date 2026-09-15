"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, X } from "lucide-react";
import { FeedbackChat } from "./feedback-chat";

const KEY = "kryx-feedback-invite-v2";
const DAY = 24 * 60 * 60 * 1000;
const MAX_AUTO_IMPRESSIONS = 2;
const GAP = 48 * 60 * 60 * 1000;

type InviteState = { impressions: number; lastShownAt: number };

function readState(): InviteState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { impressions: 0, lastShownAt: 0 };
    const parsed = JSON.parse(raw) as Partial<InviteState>;
    return {
      impressions: Number(parsed.impressions) || 0,
      lastShownAt: Number(parsed.lastShownAt) || 0,
    };
  } catch {
    return { impressions: 0, lastShownAt: 0 };
  }
}

function writeState(state: InviteState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private browsing: the modal still works for this visit.
  }
}

export function FeedbackInvite({
  accountCreatedAt,
  outputCount,
}: {
  accountCreatedAt: string;
  outputCount: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (outputCount < 1) return;

    const created = Date.parse(accountCreatedAt);
    if (!Number.isFinite(created) || Date.now() - created < DAY) return;

    const state = readState();
    if (state.impressions >= MAX_AUTO_IMPRESSIONS) return;
    if (Date.now() - state.lastShownAt < GAP) return;

    const id = window.setTimeout(() => {
      const next = {
        impressions: state.impressions + 1,
        lastShownAt: Date.now(),
      };
      writeState(next);
      setOpen(true);
    }, 12_000);

    return () => window.clearTimeout(id);
  }, [accountCreatedAt, outputCount]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] grid place-items-end bg-black/30 p-3 backdrop-blur-[2px] sm:place-items-center sm:p-6">
      <div className="max-h-[min(42rem,calc(100dvh-2rem))] w-full max-w-lg overflow-hidden rounded-[24px] border border-line bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-sm font-extrabold text-fg-strong">
              You have used Kryx. Now tell us where it wasted your time.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Six concrete questions. Useful negative feedback qualifies too.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close feedback"
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-muted hover:text-fg-strong"
          >
            <X className="size-4" />
          </button>
        </header>
        <FeedbackChat />
      </div>
    </div>
  );
}

export function FeedbackOffer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="rounded-[24px] border border-line bg-surface p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-fg-strong">
            <MessageSquareText className="size-5" />
          </span>
          <div>
            <p className="font-extrabold text-fg-strong">Before you buy more credits</p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
              Tell us what actually worked, what you had to redo, and what would
              make the next purchase worth it. Completed feedback can earn 200
              credits after review.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-fg-strong px-4 text-sm font-bold text-bg sm:mt-0"
        >
          Give product feedback
        </button>
      </section>

      {open ? (
        <div className="fixed inset-0 z-[110] grid place-items-end bg-black/30 p-3 backdrop-blur-[2px] sm:place-items-center sm:p-6">
          <div className="max-h-[min(42rem,calc(100dvh-2rem))] w-full max-w-lg overflow-hidden rounded-[24px] border border-line bg-surface shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <p className="font-extrabold text-fg-strong">Founder feedback</p>
                <p className="mt-1 text-xs text-muted">
                  We want examples, not compliments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close feedback"
                className="grid size-9 place-items-center rounded-xl border border-line text-muted hover:text-fg-strong"
              >
                <X className="size-4" />
              </button>
            </header>
            <FeedbackChat />
          </div>
        </div>
      ) : null}
    </>
  );
}
