import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The one page that works when nothing else does.
 *
 * It touches no database, constructs no Supabase client, and reads env vars
 * only to report whether they are present — so it renders even when the app is
 * completely unconfigured. That is the point: the previous failure mode was a
 * blank 500 on every route with no way to find out why.
 *
 * Booleans only. Never a value, never a fragment of one.
 */
export default function SetupPage() {
  const checks: { key: string; label: string; ok: boolean; why: string }[] = [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase project URL",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      why: "Supabase → Project Settings → API → Project URL",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Supabase publishable key",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      why: "Supabase → Project Settings → API → the publishable (anon) key. Without this nobody can sign in.",
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Supabase secret key",
      ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      why: "Same page, the secret key. Server only — never prefix it with NEXT_PUBLIC_.",
    },
    {
      key: "SECRETS_ENCRYPTION_KEY",
      label: "Secret vault key",
      ok: Boolean(process.env.SECRETS_ENCRYPTION_KEY),
      why: `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    },
    {
      key: "NEXT_PUBLIC_APP_URL",
      label: "App URL",
      ok: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      why: "Your production URL, no trailing slash.",
    },
  ];

  const missing = checks.filter((check) => !check.ok);

  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-black text-accent-fg">
          A
        </span>
        <span className="font-bold">AgentStack</span>
      </Link>

      <h1 className="mt-8 text-4xl font-extrabold">
        {missing.length > 0 ? "Almost there." : "Two things left."}
      </h1>
      <p className="mt-3 text-[17px] leading-relaxed text-muted">
        {missing.length > 0
          ? "Some environment variables are missing, so signing in cannot work yet. Add them in Vercel and redeploy."
          : "The environment looks complete. If sign-in still fails, the database schema is the usual reason."}
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-wider text-faint">
          Environment
        </h2>
        <ul className="mt-4 divide-y divide-[var(--line)] border-y border-line">
          {checks.map((check) => (
            <li key={check.key} className="flex items-start gap-3 py-3.5">
              <span
                aria-hidden
                className={
                  check.ok
                    ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--live-wash)] text-xs text-live"
                    : "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--danger-wash)] text-xs text-danger"
                }
              >
                {check.ok ? "✓" : "!"}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">
                  {check.label}{" "}
                  <code className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-normal text-muted">
                    {check.key}
                  </code>
                </p>
                {!check.ok ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {check.why}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-wider text-faint">
          Database
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">
          The tables have to be created once, by hand. A project API key can
          read and write rows but cannot create tables, so this cannot be done
          from here.
        </p>
        <ol className="mt-4 space-y-2.5 text-[15px]">
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-xs font-bold text-fg-strong">
              1
            </span>
            Supabase dashboard → <b>SQL Editor</b> → New query
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-xs font-bold text-fg-strong">
              2
            </span>
            Paste the whole of{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-sm">
              supabase/schema.sql
            </code>{" "}
            and hit Run
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-xs font-bold text-fg-strong">
              3
            </span>
            Reload this page
          </li>
        </ol>
      </section>

      <section className="mt-10 rounded-2xl border border-line bg-surface-2 p-6">
        <h2 className="font-bold">Check it worked</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          <Link href="/api/health" className="font-semibold underline">
            /api/health
          </Link>{" "}
          reports every variable and whether the schema exists. It returns 503
          until both are right, and it never prints a secret.
        </p>
      </section>

      <p className="mt-10 text-sm text-faint">
        Full walkthrough in <code>docs/SETUP.md</code>.
      </p>
    </main>
  );
}
