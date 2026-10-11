import { redirect } from "next/navigation";
import { JobsWorkspace } from "@/components/jobs/workspace";
import { jobFlags } from "@/lib/jobs/flags";
export const dynamic = "force-dynamic";
export default function JobsPage() {
  if (!jobFlags().jobs) redirect("/dashboard");
  return <JobsWorkspace />;
}
