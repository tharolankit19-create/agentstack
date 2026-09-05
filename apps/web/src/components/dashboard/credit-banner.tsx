import Link from "next/link";
import { AlertTriangle, BatteryLow } from "lucide-react";
import { COST } from "@/lib/credits-public";

/**
 * What happens when the balance runs down, said before it does.
 *
 * Agents stop by going quiet. There is no crash and no error page — a cron tick
 * finds no credits, skips the account, and the founder's morning is simply
 * emptier than yesterday's. That is the worst possible failure for a product
 * whose whole claim is that work happens while you sleep, so the warning has to
 * arrive while there is still something in the account.
 *
 * Two thresholds, and both are stated in work rather than in credits: nobody
 * knows what 180 credits is, everybody knows what "about a week of lead
 * searches" is.
 */

/** Under this, the founder is days from silence. */
const LOW = COST.lead_search * 8; // 200 — roughly a week and a half of mornings.

export function CreditBanner({ balance }: { balance: number }) {
  if (balance > LOW) return null;

  const empty = balance <= 0;
  const mornings = Math.floor(balance / COST.lead_search);

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        empty
          ? "border-danger/40 bg-danger/10"
          : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        {empty ? (
          <AlertTriangle className="text-danger mt-0.5 size-5 shrink-0" aria-hidden />
        ) : (
          <BatteryLow className="text-muted mt-0.5 size-5 shrink-0" aria-hidden />
        )}
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {empty
              ? "Your agents have stopped."
              : `About ${mornings === 1 ? "one more morning" : `${mornings} more mornings`} of work left.`}
          </p>
          <p className="text-muted text-sm">
            {empty
              ? "Nothing was lost — everything they made is still here, and they start again the moment there are credits."
              : "Top up before it runs out and nothing pauses."}
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/usage"
        className="bg-fg text-bg shrink-0 rounded-lg px-4 py-2 text-center text-sm font-medium"
      >
        Add credits
      </Link>
    </div>
  );
}
