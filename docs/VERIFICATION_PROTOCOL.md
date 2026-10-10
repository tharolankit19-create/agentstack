# Evidence-Gated Completion Protocol

New jobs use contract `lead_list/1.1.0`; persisted `1.0.0` contracts remain readable/executable. Only Lead List is enabled in this rollout. An outreach requirement may be included in that same job; this is not separate Outreach Drafts class coverage.

Before execution, the server infers the class/count, retrieves founder context, and persists a contract. The founder reviews the estimate and cap. The worker produces strict structured rows. Each row requires a real named person, company, founder role, observed HTTPS source URL, identity quote, ICP evidence quote, fit reason, confidence >= 0.8, and draft/personalization evidence when requested. Counts are bounded to 1–50.

The verifier uses a different execution run and a separate model invocation. It receives the proposed output as potentially fabricated data and independently rereads every referenced source. It has no author reasoning transcript. Provider routing may select the same model for a separate invocation; model diversity is not guaranteed when only one route exists. Worker and verifier run IDs cannot match.

Deterministic predicates reject invalid schema, wrong count, normalized duplicate people/companies, inaccessible sources, mismatched source digests, missing evidence quotes, unsupported source mapping, missing drafts, and artifact-byte mismatch. The source-accessibility predicate explicitly requires a capture within 30 minutes of verification; invalid/future timestamps fail. Partial verifier checkpoints preserve separate run identity and source reads; expired reads are repeated and their old costs are excluded. Independent semantic verdicts must support identity, ICP fit, and factual personalization for every row. Missing, duplicate, negative, or malformed semantic verdicts fail closed. Unknown predicates fail closed.

A paused job cannot settle an old passing proof. Before finishing, the worker checks both the verdict timestamp and independent source captures against the contract freshness window. Expired proof rewinds only verification, creates a new verifier run, rereads sources, and excludes the obsolete verifier reads/model charge from billable work. Database persistence, settlement and the completion trigger independently reject stale, missing, invalid or future proof timestamps. Completed receipts remain historical evidence of the verification performed at completion.

The worker cannot supply arbitrary success fields. A separately computed verdict binds the output digest and contract version. `store_verified_job_result` validates the lease, independent run identity, contract binding, all required checks, and artifact SHA-256 before atomically storing the result. `complete_verified_job` then settles usage and creates the receipt. A database trigger rejects V2 completion without a matching passing verdict and artifact.

This is evidence checking, not proof of infallibility. Model entailment quality, source authority, confidence calibration, and false-positive rate are not measured by fixture tests. Do not publish a completion guarantee before the requested real-job evaluation. Source snapshots are retained for inspection; no model-only reasoning is presented as source evidence.

Tests: `tests/v2-verifier.test.cjs`, `v2-pipeline.test.cjs`, and `v2-database.test.cjs`. Fixtures are explicitly test data, never product/demo content.
