# KryxAI Launch Film

54-second Remotion launch film built from the current Agent Stack / KryxAI product language and UI concepts.

## Creative direction

The film is intentionally not a generic neon "AI agents" montage. It uses KryxAI's actual product logic:

- Give Kryx a goal
- Mission Control
- live research / search / pipeline work
- evidence attached
- founder approval before consequential actions
- leads filtered before outreach
- one outcome instead of agent-log noise

The visual system follows the live product: warm-black background, paper-like surfaces, orange accent, green approval state, sharp grid lines, mono operational labels.

## Render

```bash
cd launch-film
npm install
npm run studio
npm run render:16x9
npm run render:9x16
```

Outputs:
- `out/kryx-launch-16x9.mp4`
- `out/kryx-launch-9x16.mp4`

No background music is included. Small UI sound effects are embedded in-code. Add music in the final edit if desired.

## Scene map

- 0–4s — Introducing KryxAI
- 4–10s — the founder tab-switching problem
- 10–16s — one goal in / finished work out
- 16–27s — Mission Control + approval queue
- 27–36s — specialist workstreams
- 36–43s — lead filtering
- 43–49s — approval boundary
- 49–54s — end card + URL
