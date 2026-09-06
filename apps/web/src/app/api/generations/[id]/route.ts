import { requireOperatorApiUser, requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body?.action !== "approve") return Response.json({ error: "Choose an action." }, { status: 400 });
  const { data, error } = await createAdminClient().from("generations")
    .update({ approved: true }).eq("id", id).eq("user_id", auth.session.userId)
    .select("id").maybeSingle();
  if (error) return Response.json({ error: "Approval could not be saved. Try again." }, { status: 500 });
  if (!data) return Response.json({ error: "Output not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { data, error } = await createAdminClient().from("generations").select("content")
    .eq("id", id).eq("user_id", auth.session.userId).maybeSingle();
  if (error || !data) return Response.json({ error: "Output not found." }, { status: 404 });
  return new Response(data.content, { headers: {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Disposition": `attachment; filename="deliverable-${id.replace(/[^a-z0-9-]/gi, "")}.md"`,
    "Cache-Control": "private, no-store",
  } });
}
