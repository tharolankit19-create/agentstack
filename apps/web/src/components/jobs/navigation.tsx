"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Plus, LoaderCircle, CircleAlert, CheckCheck, CalendarClock, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
const items = [
  { href: "/dashboard", label: "New Task", icon: Plus, view: null },
  { href: "/dashboard/jobs?view=working", label: "Working", icon: LoaderCircle, view: "working" },
  { href: "/dashboard/jobs?view=needs_you", label: "Needs You", icon: CircleAlert, view: "needs_you" },
  { href: "/dashboard/jobs?view=finished", label: "Finished", icon: CheckCheck, view: "finished" },
  { href: "/dashboard/jobs?view=scheduled", label: "Scheduled", icon: CalendarClock, view: "scheduled" },
  { href: "/dashboard/settings", label: "You", icon: UserRound, view: "you" },
];
export function JobNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const query = useSearchParams();
  return <nav className="space-y-1" aria-label="Kryx">
    {items.map(({ href, label, icon: Icon, view }) => {
      const active = view === null ? path === "/dashboard" : view === "you" ? path.startsWith("/dashboard/settings") : path === "/dashboard/jobs" && (query.get("view") ?? "working") === view;
      return <Link key={href} href={href} onClick={onNavigate} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm", active ? "bg-fg-strong text-bg" : "text-muted hover:bg-surface-2")}><Icon className="size-4" />{label}</Link>;
    })}
  </nav>;
}
