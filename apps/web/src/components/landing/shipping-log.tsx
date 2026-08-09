import { ArrowRight, Infinity as InfinityIcon, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { TEMPLATES } from "@/lib/templates";
import { countByVerdict } from "@/lib/replaceability";

/**
 * Why this is a subscription and not a one-time purchase.
 *
 * It is the fairest objection anyone has to a $29/month price: "I am buying a
 * fixed set of agents, so why am I paying every month?" The answer has to be a
 * fact rather than a promise, because a promise about future features is what
 * every dead product said too.
 *
 * So this section is about what keeps arriving, and it is careful about what
 * it claims. It does not invent a changelog with dates on it — that would be
 * fabricating a shipping history we do not have, and the first person to check
 * would catch it. It states the two things that are true today: the library
 * grows, and everything added is included at no extra cost, on every plan,
 * including the $29 one.
 *
 * The urgency is real too, and stated plainly rather than dressed up as a
 * countdown: the price goes up as the library grows, and whatever you join at
 * is what you keep. That is a normal thing for a growing product to do, and it
 * does not need a fake timer to be a reason to act now.
 */

const PROMISES = [
  {
    icon: RefreshCw,
    title: "New agents land most weeks",
    body:
      "Every tool in the directory is a candidate. When one gets an agent, it appears in your library that day — nothing to install, nothing to migrate.",
  },
  {
    icon: InfinityIcon,
    title: "Every update is included, forever",
    body:
      "Better prompts, new tools, faster runs. Your agents improve while you do nothing, and the price on your card does not move because of it.",
  },
];

export function ShippingLog() {
  const counts = countByVerdict();

  return (
    <section className="border-b border-line bg-surface-2 px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="microlabel">Why it is monthly</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
            You are not buying {TEMPLATES.length} agents.
            <br />
            You are buying every one we build next.
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            There are {counts.total} tools in our directory and {counts.yes} of
            them can already be replaced. We are working through the rest. Each
            one that lands shows up in your library, on whatever plan you are
            on, at no extra cost.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PROMISES.map((promise, index) => (
            <Reveal key={promise.title} delay={index * 90}>
              <div className="h-full rounded-2xl border border-line bg-surface p-6">
                <promise.icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-4 font-bold text-fg-strong">{promise.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">
                  {promise.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-accent/30 bg-accent/[0.07] px-6 py-5">
            <p className="min-w-0 flex-1 text-[15px] leading-relaxed">
              <span className="font-bold text-fg-strong">
                The price rises as the library does.
              </span>{" "}
              <span className="text-muted">
                Whatever you join at is the price you keep, for as long as you
                stay subscribed — including every agent added after you joined.
              </span>
            </p>
            <Link
              href="/replace"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-accent hover:underline"
            >
              See what is next
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
