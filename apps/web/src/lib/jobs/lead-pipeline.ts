import { LeadOutput, leadCsv, digest, verifyLeadList, type SourceSnapshot, type SemanticVerdict } from './verification';
import { JobFailure } from './recovery';
import type { CompletionContract, VerificationResult } from './types';
export interface LeadState {
  stage:'discover'|'extract'|'verify'|'finish'; workerRunId:string;
  discoveryKeys?:string[]; sources:SourceSnapshot[]; output:unknown; billableKeys:string[];
  discoveryUrls?:string[]; discoveryCursor?:number;
  verificationSources?:SourceSnapshot[]; verificationCursor?:number;
  verification?:VerificationResult; verifierRunId?:string;
}
export interface PipelineTools {
  search(query:string):Promise<{value:string[];key:string}>;
  read(url:string, independent:boolean):Promise<{value:SourceSnapshot;key:string}>;
  extract(contract:CompletionContract,sources:SourceSnapshot[]):Promise<{value:unknown;key:string}>;
  verify(contract:CompletionContract,output:unknown,sources:SourceSnapshot[]):Promise<{value:SemanticVerdict[];key:string}>;
  verifierRunId:string;
  saveProgress?(state:LeadState,label:string):Promise<void>;
  shouldYield?():boolean;
}
export async function leadStage(contract:CompletionContract,state:LeadState,tools:PipelineTools):Promise<LeadState> {
  const next:LeadState={...state,sources:[...state.sources],billableKeys:[...state.billableKeys],verificationSources:[...(state.verificationSources??[])]};
  const save=async(label:string)=>{await tools.saveProgress?.(next,label);};
  if(state.stage==='discover') {
    if(!next.discoveryUrls) {
      if(tools.shouldYield?.()) return next;
      let urls=contract.inputs.urls;
      if(!urls.length) {
        const found=await tools.search(`${contract.inputs.goal.replace(/and prepare.*$/i,'')} ${contract.inputs.icp} founder company about`);
        urls=found.value;next.billableKeys.push(found.key);
      }
      next.discoveryUrls=[...new Set(urls)].slice(0,Math.min(25,contract.inputs.count+5));
      next.discoveryCursor=0;
      await save(`Found ${next.discoveryUrls.length} candidate source pages`);
    }
    const candidates=next.discoveryUrls;
    for(let i=next.discoveryCursor??0;i<candidates.length;i+=3) {
      if(tools.shouldYield?.()) return next;
      const batch=candidates.slice(i,i+3).filter(url=>!next.sources.some(s=>s.url===url));
      const results=await Promise.allSettled(batch.map(url=>tools.read(url,false)));
      let blocker:JobFailure|undefined;
      for(const result of results) {
        if(result.status==='fulfilled' && result.value.value.status>=200 && result.value.value.status<300 && result.value.value.text.length>=100) {next.sources.push(result.value.value);next.billableKeys.push(result.value.key);}
        else if(result.status==='rejected' && result.reason instanceof JobFailure && ['credit_cap','configuration_missing','captcha','2fa_required','auth_expired'].includes(result.reason.category)) blocker??=result.reason;
      }
      next.discoveryCursor=blocker?i:Math.min(i+3,candidates.length);
      await save(`Collected ${next.sources.length} usable sources from ${candidates.length} candidate pages`);
      if(blocker) throw blocker;
    }
    if(!next.sources.length) throw new JobFailure('source_unavailable','No usable public sources were returned. Nothing has been verified.');
    next.discoveryKeys=[...next.billableKeys]; next.stage='extract'; return next;
  }
  if(state.stage==='extract') {
    if(tools.shouldYield?.()) return next;
    const extracted=await tools.extract(contract,state.sources);
    const parsed=LeadOutput.safeParse(extracted.value);
    if(!parsed.success || parsed.data.leads.length!==contract.inputs.count) throw new JobFailure('output_invalid',`The sources did not produce ${contract.inputs.count} schema-valid leads. No completion charge was made.`);
    next.output=parsed.data;next.billableKeys.push(extracted.key);next.stage='verify';return next;
  }
  if(state.stage==='verify') {
    const parsed=LeadOutput.parse(state.output);const fresh=next.verificationSources!;
    next.verifierRunId=tools.verifierRunId;
    const urls=[...new Set(parsed.leads.map(l=>l.sourceUrl))];
    // Source URLs must come from observed pages, never arbitrary model-invented locations.
    if(urls.some(url=>!state.sources.some(s=>s.url===url))) throw new JobFailure('verification_failed','A lead referenced an unobserved source.');
    await save('Independent source checks are in progress');
    for(let i=next.verificationCursor??0;i<urls.length;i+=3) {
      if(tools.shouldYield?.()) return next;
      const batch=urls.slice(i,i+3).filter(url=>!fresh.some(s=>s.url===url));
      const results=await Promise.allSettled(batch.map(url=>tools.read(url,true)));
      let blocker:JobFailure|undefined;
      for(const result of results) {
        if(result.status==='fulfilled'){fresh.push(result.value.value);next.billableKeys.push(result.value.key);}
        else if(result.reason instanceof JobFailure && ['credit_cap','captcha','2fa_required','auth_expired','configuration_missing'].includes(result.reason.category)) blocker??=result.reason;
      }
      next.verificationCursor=blocker?i:Math.min(i+3,urls.length);
      await save(`Independently checked ${fresh.length}/${urls.length} source pages`);
      if(blocker) throw blocker;
    }
    if(tools.shouldYield?.()) return next;
    const semantic=await tools.verify(contract,parsed,fresh);next.billableKeys.push(semantic.key);
    const content=leadCsv(parsed.leads);
    const verdict=verifyLeadList({contract,output:parsed,sources:fresh,semantic:semantic.value,artifact:{content,sha256:digest(content)},workerRunId:state.workerRunId,verifierRunId:tools.verifierRunId});
    next.verification=verdict;next.verifierRunId=tools.verifierRunId;next.stage='finish';return next;
  }
  return next;
}
