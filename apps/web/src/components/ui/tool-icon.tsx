"use client";

import { useState } from "react";

/**
 * A tool's own favicon, with two fallbacks behind it.
 *
 * Third-party favicon services are the right call here — there is no storage,
 * no admin screen, and no broken image when a company redesigns — but any one
 * of them will miss, be rate-limited, or be unreachable on some network. A
 * directory of 800 rows with holes in it looks broken in a way that a single
 * missing icon does not, so this walks a chain instead of trusting one host:
 *
 *   1. Google's favicon service. Best coverage.
 *   2. DuckDuckGo's. Different infrastructure and a different cache, so it
 *      frequently has the ones Google is missing.
 *   3. A lettered tile. Always renders, never looks like a failure.
 *
 * A plain <img>, not next/image: these are 32px icons from domains we do not
 * control, and putting them through the optimiser would mean proxying every
 * one of them for no gain.
 */

function sources(domain: string): string[] {
  const host = encodeURIComponent(domain);
  return [
    `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
  ];
}

export function ToolIcon({
  domain,
  name,
  className = "size-6",
}: {
  domain?: string;
  name: string;
  className?: string;
}) {
  // Which link in the chain we are on. Past the end means give up and letter.
  const [attempt, setAttempt] = useState(0);

  const chain = domain ? sources(domain) : [];
  const src = chain[attempt];

  if (!src) {
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
      /* Keyed by src so a failed load actually remounts and refetches rather
         than React reusing the element with a stale broken state. */
      key={src}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      width={24}
      height={24}
      referrerPolicy="no-referrer"
      onError={() => setAttempt((current) => current + 1)}
      className={`${className} shrink-0 rounded object-contain`}
    />
  );
}
