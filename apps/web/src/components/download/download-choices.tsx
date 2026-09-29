"use client";

import { useEffect, useState } from "react";
import { Download, Laptop, TabletSmartphone } from "lucide-react";

type Platform = "mac" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("macintosh") || ua.includes("mac os")) return "mac";
  return "other";
}

function DownloadButton({
  href,
  label,
}: {
  href: string | null;
  label: string;
}) {
  if (!href) {
    return (
      <span className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-bold text-faint">
        Release URL not published yet
      </span>
    );
  }

  return (
    <a
      href={href}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-fg-strong px-4 text-sm font-extrabold text-bg"
    >
      <Download className="size-4" />
      {label}
    </a>
  );
}

export function DownloadChoices({
  macUrl,
  androidUrl,
  macVersion,
  androidVersion,
  macSize,
  androidSize,
}: {
  macUrl: string | null;
  androidUrl: string | null;
  macVersion: string;
  androidVersion: string;
  macSize: string | null;
  androidSize: string | null;
}) {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <article
        className={
          "rounded-[24px] border bg-surface p-6 " +
          (platform === "mac" ? "border-accent shadow-[var(--shadow)]" : "border-line")
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid size-11 place-items-center rounded-xl border border-line bg-surface-2">
            <Laptop className="size-5" />
          </div>
          {platform === "mac" ? (
            <span className="rounded-full bg-accent-wash px-2.5 py-1 text-[11px] font-bold text-accent">
              Recommended for this device
            </span>
          ) : null}
        </div>

        <h2 className="mt-6 text-2xl font-extrabold tracking-[-.035em] text-fg-strong">
          Kryx for Mac
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          macOS 13+ · Apple Silicon build. Intel build is not published yet.
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-faint">Version</dt>
            <dd className="mt-1 font-bold text-fg-strong">{macVersion}</dd>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-faint">File</dt>
            <dd className="mt-1 font-bold text-fg-strong">{macSize || "DMG"}</dd>
          </div>
        </dl>

        <div className="mt-5">
          <DownloadButton href={macUrl} label="Download for Mac" />
        </div>

        <p className="mt-4 text-xs leading-5 text-faint">
          Accessibility/browser permissions are requested separately when a mission needs them. Kryx does not copy browser passwords.
        </p>
      </article>

      <article
        className={
          "rounded-[24px] border bg-surface p-6 " +
          (platform === "android" ? "border-accent shadow-[var(--shadow)]" : "border-line")
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid size-11 place-items-center rounded-xl border border-line bg-surface-2">
            <TabletSmartphone className="size-5" />
          </div>
          {platform === "android" ? (
            <span className="rounded-full bg-accent-wash px-2.5 py-1 text-[11px] font-bold text-accent">
              Recommended for this device
            </span>
          ) : null}
        </div>

        <h2 className="mt-6 text-2xl font-extrabold tracking-[-.035em] text-fg-strong">
          Kryx for Android Tablet
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Android 13+ · tablet-first · Samsung DeX/resizable-window friendly.
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-faint">Version</dt>
            <dd className="mt-1 font-bold text-fg-strong">{androidVersion}</dd>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-faint">File</dt>
            <dd className="mt-1 font-bold text-fg-strong">{androidSize || "APK"}</dd>
          </div>
        </dl>

        <div className="mt-5">
          <DownloadButton href={androidUrl} label="Download APK" />
        </div>

        <p className="mt-4 text-xs leading-5 text-faint">
          Accessibility is opt-in. App access is a separate allow-list. Observer Mode is off by default and never records passwords or message bodies.
        </p>
      </article>
    </div>
  );
}
