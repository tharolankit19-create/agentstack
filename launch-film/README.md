# KryxAI Launch Film v3

67-second Remotion launch film for KryxAI, rebuilt around the complete founder workflow instead of isolated feature cards.

## Story

1. **0–4s — Introducing KryxAI**
   A Mac-style product window flies toward camera and opens directly on the real dashboard shape. No dead title card.
2. **4–10s — Setup**
   One-question-at-a-time setup: head-agent name, reporting time, website, ICP, deploy.
3. **10–18s — First conversation**
   Founder tells Kryx to schedule a recurring lead/outreach workflow. Kryx confirms delegation and keeps outbound work behind approval.
4. **18–28s — Mission Control**
   Work moves through Needs you / In flight / Queued / Done today. Founder approves one consequential action.
5. **28–35s — Agent orchestration**
   Kryx bursts into a connected specialist network: Research, Leads, SEO, Content, Conversion, Outreach and Analytics, then collapses back into one head agent.
6. **35–42s — Receipts**
   Real demo-shaped outputs: found vs kept leads, sources saved, qualification evidence.
7. **42–51s — Telegram**
   Morning brief, detail request and status response on phone. Founder can review while away from the dashboard.
8. **51–58s — Pricing**
   Current PAYG pricing from the live product: $0/month, 100 signup credits, 100 credits = $1, top-up from $5, transparent specialist costs.
9. **58–67s — End card**
   “Give it a goal. Keep the final say.” + getkryxai.com with a full Mission Control product plate.

## Visual rules

- Product UI is the hero; text exists only to clarify the workflow.
- Warm paper/product surfaces replace the old black interstitials.
- Camera motion is physical: perspective, opening-lid movement, cursor travel, focused zooms.
- One visual action per beat.
- No fake metrics, customers or capabilities.
- No background music. Add music in the final edit if desired.
- Product copy and flows are based on the current KryxAI repo.

## Render

```bash
cd launch-film
npm install
npm run render:16x9
npm run render:9x16
```

Outputs:
- `out/kryx-launch-16x9.mp4`
- `out/kryx-launch-9x16.mp4`
