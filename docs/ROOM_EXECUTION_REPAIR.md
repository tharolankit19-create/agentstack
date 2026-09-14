# Room and agent execution repair

The room previously saved plain messages and messages addressed to the head agent, then returned success without generating any reply. The command router also targeted retired standalone roles even though the current roster folds their skills into eight agents.

## Execution

Room and direct chat now invoke the same bounded command router. Ordinary conversation calls the recipient's role-specific model. Work commands resolve to an existing roster role, execute the shared run pipeline, save the result, and report into the room. The head posts an explicit handoff when it delegates. Reports do not automatically trigger other agents.

- Founder and assistant turns are saved to the recipient's chat. Room summaries link to full, owner-scoped output pages.
- Paused agents do not start from chat or room commands.
- Failed reads, writes, live lookups and output persistence are surfaced instead of being reported as completed work.
- Lead searches use the shared persistence path, including connected Apollo search before Monid fallback. Pipeline write failures stop successful completion.
- Specialist configuration inherits nonempty business context from the head.
- Each completion has a 90-second total model budget and at most 25 seconds per candidate. Role-specific model preferences remain unchanged. A provider key is not reused as another provider's legacy credential.

## Interaction

The room shows the founder's message and working state immediately, polls saved updates every five seconds while visible, retains messages during connection failures, and marks unconfirmed delivery. There is no automatic task retry after uncertain delivery. Polling does not repeatedly scroll a founder reading older messages.

Starter prompts explain common tasks. Full-name mentions work at the cursor. Missing roster roles can be added from the room using the existing plan- and quota-gated setup endpoint. Existing roles are not duplicated deliberately or resumed by this setup action. Room, Mission Control, Leads and Scheduled are now reachable from mobile navigation. Navigation gets pending indicators and the dashboard gets a loading boundary. React request-local session caching removes duplicate auth/profile reads during a server render.

## Validation and limits

- `node --test tests/room-runtime.cjs`: 22 passing regression checks with mocked providers/database, including silent-head regression, paused agents, persistence failures, role routing and credential isolation.
- `npm run build --workspace apps/web`: successful production compilation and TypeScript validation.
- Modified TypeScript/TSX lint: no errors.
- Live Supabase/model-provider execution and authenticated end-to-end browser behavior are not verified in this workspace. Chromium was absent; its download was rejected by the environment's network proxy (502).

Execution still runs inside bounded HTTP requests. This change does not add a durable background queue, exactly-once execution across clients, or automatic retry after serverless termination. The browser explicitly advises checking saved messages/output before manually retrying an interrupted request.
