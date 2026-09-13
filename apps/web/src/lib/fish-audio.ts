import "server-only";

const FISH_TTS_URL = "https://api.fish.audio/v1/tts";

export interface FishVoiceOptions {
  referenceId?: string;
  model?: string;
  format?: "mp3" | "wav" | "pcm" | "opus";
}

export function fishConfigured(): boolean {
  return Boolean(process.env.FISH_AUDIO_API_KEY?.trim());
}

/**
 * Hosted Fish Audio adapter. Keep this separate from the open-source
 * fish-speech server contract: a founder can later self-host without changing
 * chat/Telegram code.
 */
export async function synthesizeVoice(
  text: string,
  options: FishVoiceOptions = {},
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const apiKey = process.env.FISH_AUDIO_API_KEY?.trim();
  if (!apiKey) throw new Error("FISH_AUDIO_API_KEY is not configured.");

  const cleanText = text.trim().slice(0, 6_000);
  if (!cleanText) throw new Error("Nothing to speak.");

  const model = options.model || process.env.FISH_AUDIO_MODEL?.trim() || "s2.1-pro-free";
  const referenceId = options.referenceId || process.env.FISH_AUDIO_VOICE_ID?.trim();
  const format = options.format || "mp3";

  const response = await fetch(FISH_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      model,
    },
    body: JSON.stringify({
      text: cleanText,
      ...(referenceId ? { reference_id: referenceId } : {}),
      format,
    }),
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`Fish Audio TTS failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error("Fish Audio returned empty audio.");
  const contentType = response.headers.get("content-type") || (format === "mp3" ? "audio/mpeg" : `audio/${format}`);
  return { bytes, contentType };
}
