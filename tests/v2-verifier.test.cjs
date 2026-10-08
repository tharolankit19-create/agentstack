require('./load-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { completionContract } = require('../apps/web/src/lib/jobs/contracts.ts');
const { verifyLeadList, digest, leadCsv } = require('../apps/web/src/lib/jobs/verification.ts');
function fixture(count=20) {
  const leads = Array.from({length:count}, (_,i) => ({name:`Founder Person ${i}`, company:`Company ${i}`, role:'Founder', sourceUrl:`https://example.com/company-${i}`, identityQuote:`Founder Person ${i} is the founder of Company ${i}.`, fitQuote:`Company ${i} sells SaaS software to independent businesses.`, fitReason:'A SaaS founder selling to independent businesses matches the supplied ICP.', confidence:0.9, draft:`Hello Founder Person ${i}, I saw your software for independent businesses. Could we discuss how you research growth opportunities?`, draftQuote:`Company ${i} sells SaaS software to independent businesses.`}));
  const sources = leads.map(l => {const text=l.identityQuote+' '+l.fitQuote+' These are public facts on the company about page with enough supporting details.';return {url:l.sourceUrl,status:200,text,sha256:digest(text),capturedAt:new Date().toISOString()};});
  const output={leads}; const content=leadCsv(leads);
  return {contract:completionContract('Find 20 SaaS founders and prepare personalized outreach.',{}),output,sources,semantic:leads.map((_,index)=>({index,identitySupported:true,fitSupported:true,claimsSupported:true,reason:'Explicitly supported in independently fetched page.'})),artifact:{content,sha256:digest(content)},workerRunId:'worker',verifierRunId:'independent'};
}
test('correct 20 leads with independent sources and matching CSV pass',()=>assert.equal(verifyLeadList(fixture()).passed,true));
test('20 claimed but 17 present fails',()=>assert.ok(verifyLeadList(fixture(17)).failedPredicates.includes('exact_lead_count')));
test('duplicates differing only by punctuation/case fail',()=>{const f=fixture();f.output.leads[1].name=f.output.leads[0].name.toUpperCase()+'!';assert.ok(verifyLeadList(f).failedPredicates.includes('unique_people_and_companies'));});
test('duplicate company with different people fails',()=>{const f=fixture();f.output.leads[1].company=f.output.leads[0].company;assert.equal(verifyLeadList(f).passed,false);});
test('broken source must fail',()=>{const f=fixture();f.sources[0].status=404;assert.ok(verifyLeadList(f).failedPredicates.includes('sources_accessible'));});
test('invented founder quote fails even if semantic verifier says yes',()=>{const f=fixture();f.output.leads[0].identityQuote='Fake Person is the founder of Imaginary SaaS.';assert.equal(verifyLeadList(f).passed,false);});
test('unsupported outreach claim fails independent verifier',()=>{const f=fixture();f.semantic[0].claimsSupported=false;assert.ok(verifyLeadList(f).failedPredicates.includes('claims_supported'));});
test('missing/duplicate semantic verdicts fail closed',()=>{const f=fixture();f.semantic[1]=f.semantic[0];assert.equal(verifyLeadList(f).passed,false);});
test('worker cannot approve itself',()=>{const f=fixture();f.verifierRunId=f.workerRunId;assert.ok(verifyLeadList(f).failedPredicates.includes('independent_verifier'));});
test('wrong or tampered artifact fails',()=>{const f=fixture();f.artifact.content+='invented';assert.ok(verifyLeadList(f).failedPredicates.includes('artifact_exists'));});
test('unsupported contract predicate fails closed',()=>{const f=fixture();f.contract.predicates.push({id:'new_gate',kind:'UNSUPPORTED'});assert.ok(verifyLeadList(f).failedPredicates.includes('new_gate'));});
test('empty or invalid fields fail',()=>{const f=fixture();f.output.leads[0].name='';assert.equal(verifyLeadList(f).passed,false);});
test('no unrequested self-reported success field is accepted',()=>{const f=fixture();f.output.completed=true;assert.equal(verifyLeadList(f).passed,false);});
test('CSV prevents spreadsheet formulas',()=>{const f=fixture();f.output.leads[0].company='=HYPERLINK("evil")';assert.match(leadCsv(f.output.leads),/"'=HYPERLINK/);});
