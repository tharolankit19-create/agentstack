# Monid cost + quality policy

Kryx uses Monid as a server-side catalogue of data tools. The goal is not to
pick the absolute cheapest endpoint; it is to buy enough verified signal to
make an agent useful while keeping gross margin predictable.

## Key pool

Production may define `MONID_API_KEY` and any of
`MONID_API_KEY1` … `MONID_API_KEY100`.

The pool is for availability only:

- revoked/invalid key (401) -> try the next configured key;
- Monid timeout/5xx -> temporarily bench that key and try the next one;
- workspace payment/budget/quota block -> stop;
- rate limit -> stop;
- provider/tool failure after a run starts -> report it; do not hop keys.

This prevents a provider budget or promotional quota from becoming an
accidental "keep trying keys until one spends" loop.

## Autonomous endpoint policy

| Job | Preferred endpoint(s) | Vendor price supplied | Autonomous result cap | Kryx customer price |
| --- | --- | ---: | ---: | ---: |
| Read a page | TinyFish `/fetch`, Context.dev `/web/scrape/markdown`, Firecrawl `/scrape` | $0 to ~$0.001/call | 1 page per lookup | 3 credits |
| Market/web search | Best healthy verified endpoint under cap; Firecrawl fallback | <= $0.02 unit price | 5 | 6 credits |
| People/lead search | Ploid `/search` | $0.01/result | 5 people | 30 credits |
| Work-email lookup | ContactOut `/v1/people/enrich/work-email`, Hunter fallback | ~$0.02+ / call | 1 person | 15 credits |
| LinkedIn/social scan | Apify `/harvestapi/linkedin-post-search` | $0.018/result | 4 posts | 15 credits |
| Company profile | Ploid `/linkedin/company`, TikHub company profile | ~$0.01–$0.012/call | 1 company | 6 credits |
| Hiring signal | Apify `/harvestapi/linkedin-job-search` | $0.0015/result + $0.001 | 8 jobs | 6 credits |
| SERP sample | Ahrefs `/serp-overview/serp-overview` | $0.06/result | 2 results | 30 credits |
| Review scan | Best verified endpoint <= $0.02 unit price | capped | 5 reviews | 15 credits |

100 Kryx credits = $1. New accounts receive 100 credits once.

The customer price intentionally includes room for empty searches, model calls,
retries, orchestration, payment fees and provider variance. An empty Monid
search is not charged to the founder.

## Expensive tools: explicit action only

These are useful but should never run silently on a schedule:

- Ahrefs AI Answer Citations: $0.36 per result.
- People Data Labs enrichment: $0.30 per call.
- Clay mobile phone: $0.936 per call.
- ContactOut work-email-only calls around $0.10 when cheaper enrichment is not
  available.
- Saperly outbound calls: $0.005/sec = $0.30/min before model/telephony overhead.
- Saperly phone provisioning: $2 per number.

A future "deep SEO / AI visibility" action should be priced separately (at
least ~75 credits per citation result at the supplied $0.36 vendor cost).
Outbound AI calling should be explicit founder-approved work, not an autonomous
agent default; a reasonable starting retail floor is ~75 credits/min plus a
separate number fee.

## Routing order

For every autonomous lookup:

1. Check the founder can afford the fixed Kryx credit price.
2. Discover candidates.
3. Reject unknown-priced candidates and anything above the capability cap.
4. Prefer the known good endpoint for the job.
5. Then prefer verified, healthy/stable endpoints.
6. Then choose lower price and stronger catalogue relevance.
7. Inspect the real schema before spending.
8. Keep the result count small.
9. Charge Kryx credits only when usable rows are returned.
10. Never invent data when a lookup fails or returns nothing.

## Efficiency rules

- One live-data lookup per specialist job where possible.
- If agent-intel already used Monid, the generic live-research pass skips a
  second Monid search.
- Exact page reads use the direct Firecrawl key when configured and fall back
  to Monid content extraction.
- Research has a per-gather credit ceiling (20 credits by default).
- Lead searches return a small qualified set first; enrichment is a second,
  explicit step.
- Phone, AI-citation and premium enrichment tools stay out of background jobs.
