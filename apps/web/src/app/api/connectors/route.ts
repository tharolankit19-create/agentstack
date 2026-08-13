import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, requireOperatorApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  CONNECTORS,
  connectorStates,
  saveConnector,
  removeConnector,
  type ConnectorId,
} from "@/lib/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The founder's connectors — read the state, paste a key, forget a key.
 *
 * One envelope per founder holds every connector key; this route is the only
 * way in or out of it. It never returns a key: GET reports what is connected
 * and a masked hint, nothing more.
 */

const ids = CONNECTORS.map((c) => c.id) as [ConnectorId, ...ConnectorId[]];

const saveSchema = z.object({
  id: z.enum(ids),
  key: z.string().trim().min(3).max(500),
});

const removeSchema = z.object({ id: z.enum(ids) });

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const connectors = await connectorStates(admin, auth.session.userId);
  return NextResponse.json({ connectors });
}

export async function POST(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`connectors:${auth.session.userId}`, 20, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Give it a moment before trying again." },
      { status: 429 },
    );
  }

  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paste the whole key — it looks too short." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  await saveConnector(admin, auth.session.userId, parsed.data.id, parsed.data.key);

  const connectors = await connectorStates(admin, auth.session.userId);
  return NextResponse.json({ connectors, message: "Connected." });
}

export async function DELETE(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Which connector?" }, { status: 400 });
  }

  const admin = createAdminClient();
  await removeConnector(admin, auth.session.userId, parsed.data.id);

  const connectors = await connectorStates(admin, auth.session.userId);
  return NextResponse.json({ connectors, message: "Disconnected." });
}
