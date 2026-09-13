# Realtime call boundary

Do not implement a fake call button.

The production call path must provide:

1. browser microphone stream
2. realtime transport with interruption/barge-in support
3. speech-to-text into the same durable Seamus conversation
4. Seamus five-provider model routing
5. streaming Fish Audio speech (`wss://api.fish.audio/v1/tts/live` or the supported SDK)
6. persisted transcript/meeting summary and explicit recording consent

The existing dashboard voice-note path is the non-realtime fallback. Wire this directory only when the realtime transport is configured.
