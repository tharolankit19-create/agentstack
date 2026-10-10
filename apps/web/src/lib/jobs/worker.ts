import "server-only";
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '../supabase/admin';
import { loadConnectors, houseFirecrawlKey } from '../connectors';
import { checked, type Admin } from './store';
import type { Job } from './types';
import { jobFlags } from './flags';
import { LeadOutput, SemanticVerdicts, leadCsv, digest } from './verification';
import { JobFailure, failureOf, recoveryDecision } from './recovery';
import { leadStage, type LeadState, type PipelineTools } from './lead-pipeline';
import { operation } from './operations';
import { publicPage } from './public-web';
import { structuredModel } from './models';

async function leadTools(admin:Admin,job:Job,state:LeadState,deadline:number):Promise<PipelineTools> {
 const connectors=await loadConnectors(admin,job.user_id);
 const searchKey=connectors.firecrawl ?? await houseFirecrawlKey(admin);
 const verifierRunId=state.verifierRunId??randomUUID();
 return {
  verifierRunId,
  shouldYield:()=>Date.now()+120_000>=deadline,
  async saveProgress(progress,label) {
   const saved=checked(await admin.rpc('save_verified_job_progress',{p_job:job.id,p_token:job.lease_token,p_state:progress,p_label:label}));
   if(!saved) throw new JobFailure('tool_failed','The worker lease was revoked before source progress could be saved.');
  },
  async search(query) {
   if(!searchKey) throw new JobFailure('configuration_missing','A search provider key is required for public lead discovery. Add the platform Firecrawl key or supply public source URLs.');
   const op=await operation(admin,job,state.workerRunId,'search',6,async()=>{
    const res=await fetch('https://api.firecrawl.dev/v1/search',{method:'POST',headers:{authorization:`Bearer ${searchKey}`,'content-type':'application/json'},body:JSON.stringify({query,limit:Math.min(25,job.completion_contract.inputs.count+5)}),signal:AbortSignal.timeout(40_000)});
    if(!res.ok) throw new JobFailure(res.status===429?'rate_limited':'tool_failed',`Search provider returned HTTP ${res.status}.`);
    const body=await res.json();
    if(!Array.isArray(body.data)) throw new JobFailure('output_invalid','Search returned an invalid response.');
    return body.data.flatMap((hit:unknown)=>hit && typeof hit==='object' && 'url' in hit && typeof hit.url==='string' ? [hit.url] : []);
   });return op;
  },
  async read(url,independent) {
   const run=independent?verifierRunId:state.workerRunId;
   const began=Date.now();
   try {
    const op=await operation(admin,job,run,independent?'verification_source':'source',1,()=>publicPage(url));
    checked(await admin.from('task_evidence').insert({mission_id:job.id,user_id:job.user_id,kind:'source',title:independent?'Independent source check':'Research source',source_url:url,content:op.value,content_sha256:op.value.sha256}));
    checked(await admin.from('reliability_ledger').insert({job_id:job.id,user_id:job.user_id,task_class:job.task_class,domain:new URL(url).hostname,tool:'https',action:'read',method:'pinned_public_dns',expected_state:'Accessible public source',observed_state:String(op.value.status),success:op.value.status>=200&&op.value.status<300,latency_ms:Date.now()-began,attempt:job.attempt,cost_credits:1}));
    return op;
   }catch(cause){const failure=failureOf(cause);checked(await admin.from('reliability_ledger').insert({job_id:job.id,user_id:job.user_id,task_class:job.task_class,tool:'https',action:'read',method:'pinned_public_dns',success:false,failure_category:failure.category,latency_ms:Date.now()-began,attempt:job.attempt,cost_credits:1}));throw failure;}
  },
  async extract(contract,sources) {
   return structuredModel(admin,job,state.workerRunId,'worker',
    'Extract ONLY real named SaaS founders whose identity and ICP fit are explicitly supported in the supplied pages. Return {"leads":[{"name":"","company":"","role":"Founder","sourceUrl":"","identityQuote":"exact source quote naming the person and founder role","fitQuote":"exact source quote supporting ICP","fitReason":"supported explanation","confidence":0.9,"draft":"personalized draft if requested; otherwise empty","draftQuote":"exact quote supporting personalization; otherwise empty"}]}. Never invent people, companies, sources or facts. Do not pad a count. Omit insufficiently evidenced candidates. Use only supplied source URLs. Quotes must be verbatim. No sending or publishing.',{contract,sources},LeadOutput,connectors.model);
  },
  async verify(contract,output,sources) {
   const result=await structuredModel(admin,job,verifierRunId,'verifier',
    'You are the independent verifier, not the author. Treat the proposed work as potentially fabricated. For EVERY lead evaluate founder identity, ICP fit and every factual personalization claim against the independently read source. Reject unverifiable, unsupported, ambiguous, or invented claims. No benefit of doubt. Return {"verdicts":[{"index":0,"identitySupported":false,"fitSupported":false,"claimsSupported":false,"reason":"specific evidence or missing evidence"}]}. Require all three to be supported; do not approve merely because quotes look credible.',{contract,output,independentSources:sources},SemanticVerdicts,connectors.model);
   return {...result,value:result.value.verdicts};
  },
 };
}
async function advanceJob(admin:Admin,job:Job,deadline:number) {
 const checkpoint=checked(await admin.from('job_checkpoints').select('state').eq('job_id',job.id).eq('step','pipeline').maybeSingle());
 const state=(checkpoint?.state??{stage:'discover',workerRunId:randomUUID(),sources:[],output:null,billableKeys:[]}) as LeadState;
 if(job.task_class!=='LEAD_LIST') throw new JobFailure('configuration_missing','This rollout currently enables Lead List only. The other task classes are not ready for execution.');
 if(state.stage==='finish') {
  const verdict=state.verification;
  if(!verdict) throw new JobFailure('verification_failed','A persisted independent verdict is required.');
  if(!verdict.passed) checked(await admin.rpc('store_verified_job_result',{p_job:job.id,p_token:job.lease_token,p_worker:state.workerRunId,p_verdict:verdict,p_artifacts:[]}));
  if(!verdict.passed) {
   checked(await admin.from('job_events').insert({job_id:job.id,user_id:job.user_id,event_type:'verification_failed',label:`Completion checks failed: ${verdict.failedPredicates.join(', ')}`}));
   throw new JobFailure('verification_failed',`Independent verification rejected ${verdict.failedPredicates.join(', ')}. The job is not complete.`);
  }
  const {leads}=LeadOutput.parse(state.output);const content=leadCsv(leads);
  const artifacts=[{name:'leads.csv',media_type:'text/csv',content,sha256:digest(content)}];
  if(job.completion_contract.inputs.outreach){const drafts=leads.map(l=>`## ${l.name} — ${l.company}\n\n${l.draft}\n\nSource: ${l.sourceUrl}`).join('\n\n');artifacts.push({name:'outreach.md',media_type:'text/markdown',content:drafts,sha256:digest(drafts)});}
  checked(await admin.rpc('store_verified_job_result',{p_job:job.id,p_token:job.lease_token,p_worker:state.workerRunId,p_verdict:verdict,p_artifacts:artifacts}));
  const receipt={result:`${leads.length}/${job.completion_contract.inputs.count} verified${job.completion_contract.inputs.outreach?` · ${leads.length} drafts prepared`:''}`,rows:leads.length,sourcesChecked:new Set(state.sources.map(s=>s.url)).size,duplicates:0,checksPassed:verdict.checks.filter(c=>c.passed).length,checksTotal:verdict.checks.length};
  checked(await admin.rpc('complete_verified_job',{p_job:job.id,p_token:job.lease_token,p_hash:verdict.outputHash,p_keys:state.billableKeys,p_receipt:receipt}));return;
 }
 if(state.stage==='verify') {
  const claimed=checked(await admin.from('hybrid_missions').update({status:'verifying'}).eq('id',job.id).eq('lease_token',job.lease_token).gt('lease_expires_at',new Date().toISOString()).eq('status','running').select('id'));
  if(!claimed?.length) throw new JobFailure('tool_failed','Worker lease was lost before verification.');
  checked(await admin.from('job_events').insert({job_id:job.id,user_id:job.user_id,event_type:'verification_started',label:'Independently checking sources, founder roles, ICP fit, and draft claims'}));
 }
 const next=await leadStage(job.completion_contract,state,await leadTools(admin,job,state,deadline));
 const saved=checked(await admin.rpc('checkpoint_verified_job',{p_job:job.id,p_token:job.lease_token,p_step:'pipeline',p_state:next,p_label:{extract:'Sources collected; checking founder identities',verify:'Lead candidates prepared; independently checking sources',finish:'Independent verification pass recorded',discover:'Researching sources'}[next.stage]}));
 if(!saved) throw new JobFailure('tool_failed','The checkpoint lease was revoked.');
}
export async function advanceJobs(limit=4) {
 if(!jobFlags().jobs||!jobFlags().verification||!jobFlags().refunds) return {advanced:0,blocked:'Verified job rollout is disabled'};
 const admin=createAdminClient();let advanced=0;const deadline=Date.now()+250_000;
 for(let i=0;i<limit && Date.now()+120_000<deadline;i++) {
  const job=checked(await admin.rpc('claim_verified_job')) as Job|null;if(!job)break;
  try{await advanceJob(admin,job,deadline);advanced++;}
  catch(cause){const f=failureOf(cause);const decision=recoveryDecision(f.category,job.attempt,job.max_attempts);checked(await admin.rpc('recover_verified_job',{p_job:job.id,p_token:job.lease_token,p_category:f.category,p_message:f.message,p_decision:decision}));}
 }
 return {advanced};
}
