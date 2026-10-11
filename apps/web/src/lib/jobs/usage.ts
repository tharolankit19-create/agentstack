export interface JobUsageSummary {
  budgetUsed: number;
  completionCostSoFar: number;
  failedAttemptCredits: number;
  pendingCredits: number;
}
export function usageSummary(rows: {credits:number;outcome:string;operation_key:string}[],keys:unknown,isFree:boolean):JobUsageSummary {
  const eligible=new Set(Array.isArray(keys)?keys.filter((key):key is string=>typeof key==='string'):[]);
  return rows.reduce((summary,row)=>({
    budgetUsed:summary.budgetUsed+row.credits,
    completionCostSoFar:summary.completionCostSoFar+(!isFree&&row.outcome==='succeeded'&&eligible.has(row.operation_key)?row.credits:0),
    failedAttemptCredits:summary.failedAttemptCredits+(row.outcome==='failed'?row.credits:0),
    pendingCredits:summary.pendingCredits+(row.outcome==='started'?row.credits:0),
  }),{budgetUsed:0,completionCostSoFar:0,failedAttemptCredits:0,pendingCredits:0});
}
