import { requireApiUser } from "@/lib/auth";
import { isAdmin } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!isAdmin(auth.session.profile)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  let body: { id?: string; decision?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (
    !body.id ||
    !/^[0-9a-f-]{36}$/i.test(body.id) ||
    !["approve", "reject"].includes(body.decision ?? "") ||
    typeof body.note !== "string" ||
    body.note.trim().length < 4 ||
    body.note.length > 1000
  ) {
    return Response.json(
      { error: "Choose approve/reject and add a short review note." },
      { status: 400 },
    );
  }

  const { data, error } = await createAdminClient().rpc("review_growth_reward", {
    p_submission_id: body.id,
    p_reviewer: auth.session.userId,
    p_decision: body.decision,
    p_note: body.note.trim(),
  });

  if (error) {
    return Response.json(
      { error: "Could not apply that reward decision." },
      { status: 409 },
    );
  }

  return Response.json(data);
}
