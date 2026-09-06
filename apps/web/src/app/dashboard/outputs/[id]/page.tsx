import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
export default async function OutputPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;
  const { data } = await createAdminClient().from("generations").select("agent_id")
    .eq("id", id).eq("user_id", session.userId).maybeSingle();
  if (!data?.agent_id) notFound();
  redirect(`/dashboard/agents/${data.agent_id}/chat?output=${id}#output-${id}`);
}
