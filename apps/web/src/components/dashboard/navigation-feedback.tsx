"use client";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/** Must be rendered inside Link, so pending state belongs to this navigation. */
export function NavigationFeedback() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 role="status" aria-label="Opening page" className="ml-auto size-4 shrink-0 animate-spin" /> : null;
}
