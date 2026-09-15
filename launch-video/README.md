# KryxAI launch film

Editable Remotion source for the 58-second KryxAI product launch film.

## Commands

```bash
npm install
npm run studio
npm run render
```

The final H.264 render is written to `out/kryxai-launch.mp4`.
The render scripts include a localhost-only Node shim for managed containers
that block `uv_interface_addresses()`; it is never bundled into the film.

## Editorial guardrails

- No customer, revenue, conversion, or growth metrics are claimed.
- Agent names, roles, product language, mission flow, evidence model, and approval behavior come from the KryxAI repository.
- Demo-style deliverables are generic and never attributed to a real customer.
- No music is included. The audio track contains only original interface and transition sound effects.
