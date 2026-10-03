import { Webhook } from "standardwebhooks";
import { z } from "zod";
import { loadConnectors } from "@/lib/connectors";
import { createAdminClient } from "@/lib/supabase/admin";
const eventSchema = z
  .object({
    type: z.string(),
    data: z
      .object({ email_id: z.string(), to: z.array(z.email()).optional() })
      .passthrough(),
  })
  .passthrough();
export async function POST(
  req: Request,
  ctx: { params: Promise<{ user: string }> },
) {
  const { user } = await ctx.params;
  if (!z.uuid().safeParse(user).success)
    return Response.json({ error: "Invalid workspace" }, { status: 400 });
  const db = createAdminClient(),
    keys = await loadConnectors(db, user),
    raw = await req.text();
  if (raw.length > 50000 || !keys.resend_webhook)
    return Response.json({ error: "Webhook not configured" }, { status: 401 });
  let event;
  try {
    event = eventSchema.parse(
      new Webhook(keys.resend_webhook).verify(raw, {
        "webhook-id": req.headers.get("svix-id") || "",
        "webhook-timestamp": req.headers.get("svix-timestamp") || "",
        "webhook-signature": req.headers.get("svix-signature") || "",
      }),
    );
  } catch {
    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }
  const id = req.headers.get("svix-id")!;
  const r = await db.rpc("kryx_email_event", {
    p_user: user,
    p_event: id,
    p_provider_id: event.data.email_id,
    p_type: event.type,
  });
  if (r.error || r.data !== true)
    return Response.json({ error: "Event was not stored" }, { status: 503 });
  return Response.json({ ok: true });
}
