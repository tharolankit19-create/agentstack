import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { hasPaid } from "@/lib/plans";
import { PaymentWatcher } from "@/components/auth/payment-watcher";

export const metadata: Metadata = {
  title: "Payment received",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where Dodo returns the customer.
 *
 * The plan is granted by the webhook, not by this page, so a payment cannot be
 * faked by opening this URL. The webhook usually lands first; when it does not,
 * the watcher below polls until it does.
 */
export default async function CheckoutSuccessPage() {
  const session = await getSession().catch(() => null);
  const paid = Boolean(session && hasPaid(session.profile.plan));

  return (
    <main className="surface-dark grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--color-accent)] text-2xl">
          ✓
        </div>

        <h1 className="mt-6 text-3xl font-extrabold text-white">
          Payment received.
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-zinc-400">
          {paid
            ? "Your agents are unlocked. Pick your first one."
            : "Unlocking your dashboard. This takes a few seconds."}
        </p>

        <div className="mt-8">
          <PaymentWatcher initiallyPaid={paid} />
        </div>
      </div>
    </main>
  );
}
