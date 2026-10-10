require('./load-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {completionContract}=require('../apps/web/src/lib/jobs/contracts.ts');
const {leadStage}=require('../apps/web/src/lib/jobs/lead-pipeline.ts');
const {digest}=require('../apps/web/src/lib/jobs/verification.ts');
const {recoveryDecision,JobFailure}=require('../apps/web/src/lib/jobs/recovery.ts');
function scenario(count=2){
 const contract=completionContract(`Find ${count} SaaS founders and prepare personalized outreach.`,{icp:'SaaS for independent businesses'});
 const leads=Array.from({length:count},(_,i)=>({name:`Real Fixture Founder ${i}`,company:`Fixture SaaS ${i}`,role:'Founder',sourceUrl:`https://example.com/founder-${i}`,identityQuote:`Real Fixture Founder ${i} is the founder of Fixture SaaS ${i}.`,fitQuote:`Fixture SaaS ${i} sells SaaS software to independent businesses.`,fitReason:'Sells SaaS to independent businesses, matching the provided ICP.',confidence:0.9,draft:`Hello Real Fixture Founder ${i}, I saw your software for independent businesses and would like to learn about your growth research.`,draftQuote:`Fixture SaaS ${i} sells SaaS software to independent businesses.`}));
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
test('process loss after a source batch resumes without repeating discovery or completed reads',async()=>{
 const s=scenario(5);let persisted,searches=0;const search=s.tools.search;
 s.tools.search=async()=>{searches++;return search();};
 s.tools.saveProgress=async(state)=>{persisted=structuredClone(state);if(state.discoveryCursor===3)throw new Error('process stopped after durable write');};
 await assert.rejects(()=>leadStage(s.contract,s.state,s.tools),/process stopped/);
 assert.equal(persisted.sources.length,3);assert.equal(persisted.stage,'discover');
 s.tools.saveProgress=async(state)=>{persisted=structuredClone(state);};
 const resumed=await leadStage(s.contract,persisted,s.tools);
 assert.equal(resumed.stage,'extract');assert.equal(resumed.sources.length,5);assert.equal(searches,1);
 for(const lead of s.leads)assert.equal(s.calls.filter(c=>c.url===lead.sourceUrl&&!c.independent).length,1);
});
test('independent verification preserves separate identity and completed source reads across process loss',async()=>{
 const s=scenario(5);let next=await leadStage(s.contract,s.state,s.tools);next=await leadStage(s.contract,next,s.tools);
 let persisted;s.tools.saveProgress=async(state)=>{persisted=structuredClone(state);if(state.verificationCursor===3)throw new Error('verification process stopped');};
 await assert.rejects(()=>leadStage(s.contract,next,s.tools),/process stopped/);
 assert.equal(persisted.verifierRunId,'independent-run');assert.equal(persisted.verificationSources.length,3);
 s.tools.saveProgress=async()=>{};
 const resumed=await leadStage(s.contract,persisted,s.tools);assert.equal(resumed.verification.passed,true);
 assert.equal(resumed.billableKeys.length,new Set(resumed.billableKeys).size);
 for(const lead of s.leads)assert.equal(s.calls.filter(c=>c.url===lead.sourceUrl&&c.independent).length,1);
});
test('a security blocker preserves successful peers in the same batch and resumes only the blocked source',async()=>{
 const s=scenario(3);const read=s.tools.read;let persisted,blocked=true;
 s.tools.read=async(url,independent)=>{if(blocked&&url===s.leads[1].sourceUrl)throw new JobFailure('captcha','Human verification required');return read(url,independent);};
 s.tools.saveProgress=async(state)=>{persisted=structuredClone(state);};
 await assert.rejects(()=>leadStage(s.contract,s.state,s.tools),/Human verification/);
 assert.equal(persisted.sources.length,2);assert.equal(persisted.discoveryCursor,0);blocked=false;
 const resumed=await leadStage(s.contract,persisted,s.tools);assert.equal(resumed.sources.length,3);
 for(const lead of s.leads)assert.equal(s.calls.filter(c=>c.url===lead.sourceUrl&&!c.independent).length,1);
});
test('worker time budget yields safely with a resumable checkpoint and no completion or retry claim',async()=>{
 const s=scenario(5);let yieldNow=false;
 s.tools.shouldYield=()=>yieldNow;s.tools.saveProgress=async(state)=>{if(state.discoveryCursor===3)yieldNow=true;};
 const partial=await leadStage(s.contract,s.state,s.tools);assert.equal(partial.stage,'discover');assert.equal(partial.sources.length,3);assert.equal(partial.verification,undefined);
 yieldNow=false;s.tools.saveProgress=async()=>{};
 const resumed=await leadStage(s.contract,partial,s.tools);assert.equal(resumed.stage,'extract');assert.equal(resumed.sources.length,5);
});
test('expired verifier checkpoints reread sources and exclude obsolete read costs',async()=>{
 const s=scenario();let next=await leadStage(s.contract,s.state,s.tools);next=await leadStage(s.contract,next,s.tools);
 let yieldNow=false;s.tools.shouldYield=()=>yieldNow;s.tools.saveProgress=async(state)=>{if(state.verificationCursor===2)yieldNow=true;};
 const partial=await leadStage(s.contract,next,s.tools);assert.equal(partial.stage,'verify');const obsolete=partial.verificationSources.map(source=>source.operationKey);
 for(const source of partial.verificationSources)source.capturedAt=new Date(Date.now()-31*60_000).toISOString();
 yieldNow=false;s.tools.saveProgress=async()=>{};
 const resumed=await leadStage(s.contract,partial,s.tools);assert.equal(resumed.verification.passed,true);
 assert.ok(obsolete.every(key=>!resumed.billableKeys.includes(key)));assert.equal(s.calls.filter(call=>call.independent).length,4);
});
