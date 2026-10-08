import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobDetail } from "@/lib/jobs/store";
import { jobFlags } from "@/lib/jobs/flags";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(); if (!auth.ok) return auth.response;
  if (!jobFlags().jobs) return Response.json({ error: "Jobs are disabled." }, { status: 404 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Invalid job." }, { status: 400 });
  try { const detail = await jobDetail(createAdminClient(), auth.session.userId, id); return detail ? Response.json(detail) : Response.json({ error: "Job not found." }, { status: 404 }); }
  catch { return Response.json({ error: "Job storage is unavailable." }, { status: 503 }); }
}
