import type { ReactNode } from "react";

export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return <div className="kryx-route-enter">{children}</div>;
}
