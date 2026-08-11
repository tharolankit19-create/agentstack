import { SITE } from "@/lib/site";

/**
 * The mark.
 *
 * A chevron — the rank insignia — with a signal dot at its point. It reads as
 * "army" and "a message arriving" at the same time, which is the entire
 * product in one shape, and it survives being 20px in a sidebar because it is
 * two forms and no detail.
 *
 * Drawn rather than lettered. "A" in a rounded square was a placeholder and
 * looked like one; it also said nothing, and a logo that says nothing is a
 * logo you have to explain every time you use it.
 *
 * Inherits `currentColor`, so it works on light, on dark, and inverted inside
 * a filled badge without a second file.
 */
export function LogoMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={SITE.name}
      className={`shrink-0 ${className}`}
    >
      {/* Three chevrons, stacked. Rank. */}
      <path
        d="M6 11.5 L16 6 L26 11.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 18 L16 12.5 L26 18"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M6 24.5 L16 19 L26 24.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.28"
      />
    </svg>
  );
}

/**
 * The lockup: mark in a filled tile, then the name.
 *
 * One component so the header, the sidebar and the setup page cannot drift
 * into three slightly different versions of the same thing.
 */
export function LogoLockup({
  className = "",
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-fg-strong text-bg">
        <LogoMark size={20} />
      </span>
      {showName ? (
        <span className="text-[17px] font-extrabold leading-tight tracking-tight text-fg-strong">
          {SITE.name}
        </span>
      ) : null}
    </span>
  );
}

/** The name the rest of the app already imports it by. */
export { LogoLockup as Logo };
