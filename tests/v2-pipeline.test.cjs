require('./load-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {completionContract}=require('../apps/web/src/lib/jobs/contracts.ts');
const {leadStage}=require('../apps/web/src/lib/jobs/lead-pipeline.ts');
const {digest}=require('../apps/web/src/lib/jobs/verification.ts');
const {recoveryDecision,JobFailure}=require('../apps/web/src/lib/jobs/recovery.ts');
function scenario(){
 const contract=completionContract('Find 2 SaaS founders and prepare personalized outreach.',{icp:'SaaS for independent businesses'});
 const leads=[0,1].map(i=>({name:`Real Fixture Founder ${i}`,company:`Fixture SaaS ${i}`,role:'Founder',sourceUrl:`https://example.com/founder-${i}`,identityQuote:`Real Fixture Founder ${i} is the founder of Fixture SaaS ${i}.`,fitQuote:`Fixture SaaS ${i} sells SaaS software to independent businesses.`,fitReason:'Sells SaaS to independent businesses, matching the provided ICP.',confidence:0.9,draft:`Hello Real Fixture Founder ${i}, I saw your software for independent businesses and would like to learn about your growth research.`,draftQuote:`Fixture SaaS ${i} sells SaaS software to independent businesses.`}));
 const source=(url)=>{const l=leads.find(l=>l.sourceUrl===url);const text=l.identityQuote+' '+l.fitQuote+' This is the independently sourced about-page fixture used only for automated testing.';return {url,status:200,text,sha256:digest(text),capturedAt:new Date().toISOString()};};
 const calls=[];let n=0;const key=()=>`operation-${++n}`;
 const tools={verifierRunId:'independent-run',search:async()=>({value:leads.map(l=>l.sourceUrl),key:key()}),read:async(url,independent)=>{calls.push({url,independent});return {value:source(url),key:key()};},extract:async()=>({value:{leads},key:key()}),verify:async()=>({value:leads.map((_,index)=>({index,identitySupported:true,fitSupported:true,claimsSupported:true,reason:'Fixture evidence is explicit.'})),key:key()})};
 const state={stage:'discover',workerRunId:'worker-run',sources:[],output:null,billableKeys:[]};return {contract,tools,state,calls,leads};
}
test('real production pipeline resumes checkpoints and independently rereads every source',async()=>{
 const s=scenario();let next=await leadStage(s.contract,s.state,s.tools);assert.equal(next.stage,'extract');
 next=JSON.parse(JSON.stringify(next));next=await leadStage(s.contract,next,s.tools);assert.equal(next.stage,'verify');assert.equal(next.verification,undefined);
 next=await leadStage(s.contract,JSON.parse(JSON.stringify(next)),s.tools);assert.equal(next.stage,'finish');assert.equal(next.verification.passed,true);
 assert.equal(s.calls.filter(c=>c.independent).length,2);assert.equal(next.billableKeys.length,7);
});
test('bad source and unsupported facts produce failed verdict rather than completion',async()=>{
 const s=scenario();let next=await leadStage(s.contract,s.state,s.tools);next=await leadStage(s.contract,next,s.tools);
 s.tools.read=async(url)=>({value:{url,status:404,text:'',sha256:digest(''),capturedAt:new Date().toISOString()},key:'broken-source'});
 next=await leadStage(s.contract,next,s.tools);assert.equal(next.verification.passed,false);assert.ok(next.verification.failedPredicates.includes('sources_accessible'));
});
test('unobserved model-generated source cannot become verified evidence',async()=>{
 const s=scenario();let next=await leadStage(s.contract,s.state,s.tools);next=await leadStage(s.contract,next,s.tools);next.output.leads[0].sourceUrl='https://invented.example/';
 await assert.rejects(()=>leadStage(s.contract,next,s.tools),/unobserved/);
});
test('20 claimed but fewer extracted rejects before creating a success receipt',async()=>{
 const s=scenario();s.contract.inputs.count=20;let next=await leadStage(s.contract,s.state,s.tools);await assert.rejects(()=>leadStage(s.contract,next,s.tools),/20 schema-valid/);
});
test('provider error, captcha and hard cap use bounded recovery decisions',()=>{
 assert.equal(recoveryDecision('provider_timeout',1,3),'retry');assert.equal(recoveryDecision('provider_timeout',3,3),'fail');
 for(const category of ['captcha','2fa_required','auth_expired','configuration_missing','credit_cap'])assert.equal(recoveryDecision(category,1,3),'needs_user');
});
test('CAPTCHA halts source collection instead of finding a way around it',async()=>{
 const s=scenario();s.tools.read=async()=>{throw new JobFailure('captcha','Human verification required');};await assert.rejects(()=>leadStage(s.contract,s.state,s.tools),/Human verification/);
});
