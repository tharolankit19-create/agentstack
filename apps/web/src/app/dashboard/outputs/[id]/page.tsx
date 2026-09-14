import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { GenerationList } from "@/components/dashboard/generation-list";
import type { Generation } from "@/lib/supabase/types";

export default async function OutputPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser(`/dashboard/outputs/${id}`);
  const { data, error } = await createAdminClient().from("generations").select("*")
    .eq("id", id).eq("user_id", session.userId).maybeSingle<Generation>();
  if (error) throw new Error("This output is temporarily unavailable.");
  if (!data) notFound();
  return <div className="max-w-3xl space-y-5"><Link href="/dashboard/room" className="text-sm text-muted">← Team room</Link><h1 className="text-2xl font-bold text-fg-strong">Your agent’s output</h1><GenerationList generations={[data]} /></div>;
}
