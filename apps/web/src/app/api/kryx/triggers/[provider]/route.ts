import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { after } from "next/server";
import { advanceOperator } from "@/lib/operator/runner";
export const maxDuration = 300;
import { createAdminClient } from "@/lib/supabase/admin";
import { Store } from "@/lib/operator/store";
import { redact } from "@/lib/operator/policy";
const providers = [
  "github",
  "stripe",
  "dodo",
  "lead_reply",
  "competitor",
  "analytics",
];
// Canonical bridge envelope. Native provider adapters verify vendor signatures before forwarding.
const envelope = z
  .object({
    user_id: z.uuid(),
    event_id: z.string().min(1).max(200),
    routine_id: z.uuid(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();
export async function POST(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;
  const secret = process.env.KRYX_TRIGGER_BRIDGE_SECRET,
    timestamp = req.headers.get("x-kryx-timestamp") || "",
    signature = req.headers.get("x-kryx-signature") || "";
  if (
    !providers.includes(provider) ||
    !secret ||
    secret.length < 32 ||
    !/^[0-9]+$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp) * 1000) > 300000
  )
    return Response.json({ error: "Invalid signed trigger" }, { status: 401 });
  const text = await req.text();
  if (text.length > 50000)
    return Response.json({ error: "Payload too large" }, { status: 413 });
  const expected = Buffer.from(
      createHmac("sha256", secret)
        .update(timestamp + "." + text)
        .digest("hex"),
    ),
    received = Buffer.from(signature);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  )
    return Response.json(
      { error: "Invalid trigger signature" },
      { status: 401 },
    );
  try {
    const e = envelope.parse(JSON.parse(text)),
      store = new Store(createAdminClient());
    const q = await store.db
      .from("kryx_routines")
      .select("*")
      .eq("id", e.routine_id)
      .eq("user_id", e.user_id)
      .eq("enabled", true)
      .single();
    if (q.error)
      return Response.json(
        { error: "Enabled routine not found" },
        { status: 404 },
      );
    const event = await store.db.from("kryx_trigger_events").upsert(
      {
        user_id: e.user_id,
        provider,
        event_key: e.event_id,
        payload: redact(e.payload),
      },
      { onConflict: "user_id,provider,event_key", ignoreDuplicates: true },
    );
    if (event.error) throw new Error(event.error.message);
    const id = await store.rpc("kryx_create_goal", {
      p_user: e.user_id,
      p_objective: q.data.objective,
      p_context: {
        ...q.data.context,
        routine_id: e.routine_id,
        trigger: { provider, event_id: e.event_id, payload: redact(e.payload) },
      },
      p_budget: 100,
      p_key: `event:${provider}:${e.event_id}`,
    });
    after(async () => {
      try {
        await advanceOperator(3);
      } catch {}
    });
    return Response.json({ id }, { status: 202 });
  } catch {
    return Response.json(
      { error: "Trigger was not accepted" },
      { status: 400 },
    );
  }
}
