"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Laptop,
  Monitor,
  Smartphone,
  TabletSmartphone,
  TerminalSquare,
} from "lucide-react";

type Platform = "mac" | "windows" | "linux" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();

  if (ua.includes("android")) return "android";
  if (ua.includes("windows") || platform.includes("win")) return "windows";
  if (ua.includes("linux") || platform.includes("linux")) return "linux";
  if (ua.includes("macintosh") || ua.includes("mac os") || platform.includes("mac")) return "mac";
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
        Release not published yet
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

function Card({
  title,
  body,
  platform,
  current,
  icon,
  version,
  file,
  href,
  cta,
  note,
}: {
  title: string;
  body: string;
  platform: Platform;
  current: Platform;
  icon: React.ReactNode;
  version: string;
  file: string;
  href: string | null;
  cta: string;
  note: string;
}) {
  const recommended = current === platform;

  return (
    <article
      className={
        "rounded-[24px] border bg-surface p-6 " +
        (recommended ? "border-accent shadow-[var(--shadow)]" : "border-line")
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid size-11 place-items-center rounded-xl border border-line bg-surface-2">
          {icon}
        </div>
        {recommended ? (
          <span className="rounded-full bg-accent-wash px-2.5 py-1 text-[11px] font-bold text-accent">
            Recommended for this device
          </span>
        ) : null}
      </div>

      <h2 className="mt-6 text-2xl font-extrabold tracking-[-.035em] text-fg-strong">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-xs text-faint">Version</dt>
          <dd className="mt-1 font-bold text-fg-strong">{version}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-xs text-faint">File</dt>
          <dd className="mt-1 font-bold text-fg-strong">{file}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <DownloadButton href={href} label={cta} />
      </div>

      <p className="mt-4 text-xs leading-5 text-faint">{note}</p>
    </article>
  );
}

export function DownloadChoices({
  macUrl,
  androidUrl,
  windowsUrl,
  linuxUrl,
  macVersion,
  androidVersion,
  windowsVersion,
  linuxVersion,
  macSize,
  androidSize,
  windowsSize,
  linuxSize,
}: {
  macUrl: string | null;
  androidUrl: string | null;
  windowsUrl: string | null;
  linuxUrl: string | null;
  macVersion: string;
  androidVersion: string;
  windowsVersion: string;
  linuxVersion: string;
  macSize: string | null;
  androidSize: string | null;
  windowsSize: string | null;
  linuxSize: string | null;
}) {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card
        title="Kryx for Mac"
        body="macOS 13+ · menu-bar control · real local Chrome session · approved native apps."
        platform="mac"
        current={platform}
        icon={<Laptop className="size-5" />}
        version={macVersion}
        file={macSize || "DMG"}
        href={macUrl}
        cta="Download for Mac"
        note="macOS Accessibility/browser permissions stay separate. Kryx never asks for your Google password."
      />

      <Card
        title="Kryx for Windows"
        body="Windows 11 · system tray control · UI Automation through the same Kryx device runtime."
        platform="windows"
        current={platform}
        icon={<Monitor className="size-5" />}
        version={windowsVersion}
        file={windowsSize || "EXE"}
        href={windowsUrl}
        cta="Download for Windows"
        note="Foreground/global input remains off by default. External actions still use Kryx approvals."
      />

      <Card
        title="Kryx for Linux"
        body="Modern desktop Linux · AppImage · AT-SPI accessibility-first device control."
        platform="linux"
        current={platform}
        icon={<TerminalSquare className="size-5" />}
        version={linuxVersion}
        file={linuxSize || "AppImage"}
        href={linuxUrl}
        cta="Download for Linux"
        note="Requires a signed-in graphical desktop session with AT-SPI support. Global pointer fallback stays off by default."
      />

      <Card
        title="Kryx for Android Phone"
        body="Android 13+ · optional floating Kryx button · approval-first app control."
        platform="android"
        current={platform}
        icon={<Smartphone className="size-5" />}
        version={androidVersion}
        file={androidSize || "APK"}
        href={androidUrl}
        cta="Download Android APK"
        note="Every app open asks first unless you choose Always allow for that specific app. Sending/posting remains separately approval-gated."
      />

      <Card
        title="Kryx for Android Tablet"
        body="Same adaptive Android app · two-pane tablet layout · DeX/resizable-window friendly."
        platform="android"
        current={platform}
        icon={<TabletSmartphone className="size-5" />}
        version={androidVersion}
        file={androidSize || "APK"}
        href={androidUrl}
        cta="Download Tablet APK"
        note="Phone and tablet use the same Kryx package, account, credits, missions and safety policies."
      />
    </div>
  );
}
