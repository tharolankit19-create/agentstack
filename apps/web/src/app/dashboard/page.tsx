import LegacyHome from "@/components/dashboard/legacy-home";
import { JobsWorkspace } from "@/components/jobs/workspace";
import { jobFlags } from "@/lib/jobs/flags";

export const dynamic = "force-dynamic";
export default function DashboardPage() {
  return jobFlags().jobs ? <JobsWorkspace /> : <LegacyHome />;
}
