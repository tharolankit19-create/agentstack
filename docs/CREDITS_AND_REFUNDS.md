# Credits and refunds

V2 uses the existing prepaid wallet, payment history, and signed Dodo top-up flow. Public credit-pack conversion is unchanged in this slice. The $49 subscription is not launched here.

The contract is priced in predictable work units: estimate range before execution, an editable hard cap, and a reserved wallet budget. The whole paid-job cap is temporarily held, not charged as completed work. Reservation, settlement, release, and refund entries have unique `(job_id,kind)` keys and are transactional. Financial functions use a consistent profile-before-job lock order.

Only the first successful verified job is free. The account lock permits one active free reservation. A failed/cancelled free attempt does not use the successful completion entitlement. Completed free jobs prevent a second free completion. Free jobs still have internal work budgets. There is a three-active-job limit per founder.

Before every external source/search/model operation, the lease and total internal work-unit cap are checked atomically. Even failed or interrupted operations count toward the internal execution budget. This prevents endless retries. Successful checkpoint operation keys identify the work contributing to the final verified output. Failed operations and abandoned successful attempts are not in the billable key set.

On verified success, SQL sums eligible successful operations, applies the free entitlement when appropriate, returns the unused reservation, records a settlement, and overwrites receipt credit figures with real ledger totals. On failure/cancel, SQL returns the reservation exactly once. A "refund" entry here is a wallet reservation return, not a reversal of a previously settled Dodo payment. No fake payment refund is claimed.

Tokens returned by providers are recorded where available. Vendor dollar-cost fields remain null when unavailable. Work-unit totals are not vendor COGS or gross-margin measurements; live invoices/rates must validate retry economics before public guarantees.

Login no longer rewrites 500-credit legacy balances or refills zero balances. A zero available wallet can reflect a reservation. Profile repair inserts only when absent and reads an existing concurrent repair rather than resetting its wallet. Signup grants remain in account creation.

Tests exercise free completion, paid settlement, abandoned/failed exclusions, duplicate completion rejection, cap exhaustion, cancellation idempotency, failed-job return, cross-owner controls, pending-operation rejection, and paused worker fencing using a local PostgreSQL runtime. Multi-connection production contention and real payment/subscription lifecycle remain to be tested.
