# Fish Audio environment

Required on Vercel Production (and Preview when testing):

```text
FISH_AUDIO_API_KEY=<secret>
FISH_AUDIO_MODEL=s2.1-pro-free
FISH_AUDIO_VOICE_ID=8d21b053e2804e2a890e1cf62f267b6f
```

`FISH_AUDIO_API_KEY` is secret. `FISH_AUDIO_VOICE_ID` is a voice/reference id, not the base model id.

Hosted endpoints used by AgentStack:
- TTS: `POST https://api.fish.audio/v1/tts`
- ASR: `POST https://api.fish.audio/v1/asr`

The model remains env-overridable so the free developer model can be replaced without a code deploy.
