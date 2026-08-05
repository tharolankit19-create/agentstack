"use client";

import { useState } from "react";

/**
 * A tool's own favicon, with a letter tile when there isn't one.
 *
 * Google's favicon service rather than an upload flow: there is no storage, no
 * admin screen, and no broken image when a company redesigns. The cost is a
 * third-party request per icon, which is why they are lazy and why the
 * fallback has to be good — a lot of them will fail, and a row with a hole in
 * it looks broken in a way a lettered tile does not.
 *
 * A plain <img>, not next/image: these are 32px third-party icons from a
 * domain we do not control, and putting them through the optimiser would mean
 * proxying every one of them for no gain.
 */
export function ToolIcon({
  domain,
  name,
  className = "size-6",
}: {
  domain?: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!domain || failed) {
    return (
      <span
        aria-hidden
        className={`${className} grid shrink-0 place-items-center rounded border border-line bg-surface-2 font-mono text-[10px] font-semibold uppercase text-muted`}
      >
        {name.slice(0, 1)}
      </span>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      alt=""
      loading="lazy"
      width={24}
      height={24}
      onError={() => setFailed(true)}
      className={`${className} shrink-0 rounded object-contain`}
    />
  );
}
