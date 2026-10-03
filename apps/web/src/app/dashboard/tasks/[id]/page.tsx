import { TaskDetail } from "@/components/operator/workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <TaskDetail id={(await params).id} />;
}
