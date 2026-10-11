// Uses the pre-V2 planner column so legacy routes still work before V2 migrations.
export const LEGACY_MISSION_FILTER='planner->>engine.is.null,planner->>engine.neq.verified_jobs_v2';
export function isVerifiedJobMission(mission:{planner?:unknown;task_class?:unknown}):boolean {
  const planner=mission.planner;
  return typeof mission.task_class==='string'||Boolean(planner&&typeof planner==='object'&&!Array.isArray(planner)&&'engine' in planner&&planner.engine==='verified_jobs_v2');
}
