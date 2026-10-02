import React from "react";
import { createRoot } from "react-dom/client";
import {
  OperatorHome,
  TaskDetail,
  ResourceView,
} from "../../apps/web/src/components/operator/workspace";
import { OperatorNav } from "../../apps/web/src/components/operator/navigation";
const path = location.pathname;
const id = path.startsWith("/dashboard/tasks/")
  ? path.split("/").pop()
  : undefined;
const resource = {
  routines: "routines",
  skills: "skills",
  memory: "memories",
  artifacts: "artifacts",
  activity: "task_events",
  computer: "computer_sessions",
}[path.split("/")[2]];
createRoot(document.getElementById("root")!).render(
  <>
    <div style={{ padding: "8px 20px", fontSize: 11, background: "#eee" }}>
      QA fixture providers · actual Kryx components and persistent PostgreSQL
      task state
    </div>
    <div
      style={{
        display: "flex",
        maxWidth: 1200,
        margin: "auto",
        minHeight: "100vh",
      }}
    >
      <aside style={{ width: 180, padding: "28px 12px" }}>
        <h2 style={{ padding: 12, fontSize: 18 }}>Kryx</h2>
        <OperatorNav />
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: "38px 28px" }}>
        {id ? (
          <TaskDetail id={id} />
        ) : resource ? (
          <ResourceView kind={resource} />
        ) : (
          <OperatorHome tasksOnly={path === "/dashboard/tasks"} />
        )}
      </main>
    </div>
  </>,
);
