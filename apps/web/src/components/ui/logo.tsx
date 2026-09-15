import { SITE } from "@/lib/site";

export function LogoMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/brand/kryx/kryx-mark.webp"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={`shrink-0 rounded-[28%] object-cover ring-1 ring-line ${className}`}
    />
  );
}

export function LogoLockup({
  className = "",
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={34} />
      {showName ? (
        <span className="text-[17px] font-extrabold leading-tight tracking-[-.025em] text-fg-strong">
          {SITE.name}
        </span>
      ) : null}
    </span>
  );
}

export { LogoLockup as Logo };
