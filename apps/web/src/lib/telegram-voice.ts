import "server-only";
import { botToken } from "./telegram";

export async function sendVoiceNote(chatId: string, bytes: Uint8Array, caption?: string): Promise<boolean> {
  const token = botToken();
  if (!token || !bytes.length) return false;

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("voice", new Blob([copy.buffer], { type: "audio/mpeg" }), "kryx.mp3");
  if (caption) form.set("caption", caption.slice(0, 1024));

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean };
    return payload.ok === true;
  } catch {
    return false;
  }
}
