require('./load-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {usageSummary}=require('../apps/web/src/lib/jobs/usage.ts');
const rows=[
 {credits:7,outcome:'failed',operation_key:'failed'},
 {credits:5,outcome:'succeeded',operation_key:'abandoned'},
 {credits:23,outcome:'succeeded',operation_key:'contributing'},
 {credits:4,outcome:'started',operation_key:'pending'},
];
test('live budget includes internal attempts while estimated completion cost excludes failed, abandoned and pending work',()=>{
 assert.deepEqual(usageSummary(rows,['contributing','failed','pending','contributing'],false),{budgetUsed:39,completionCostSoFar:23,failedAttemptCredits:7,pendingCredits:4});
});
test('free completion still reports a real internal budget and never a billable cost',()=>{
 assert.equal(usageSummary(rows,['contributing'],true).completionCostSoFar,0);assert.equal(usageSummary(rows,undefined,true).budgetUsed,39);
});
