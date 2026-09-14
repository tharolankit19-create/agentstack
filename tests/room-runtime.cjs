const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../apps/web/src/lib');
function load(file, mocks = {}) {
  const cache = new Map();
  function read(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} }; cache.set(filename, mod);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    function req(name) {
      if (name === 'server-only') return {};
      if (name in mocks) return mocks[name];
      if (name.startsWith('.')) return read(path.resolve(path.dirname(filename), name + '.ts'));
      return require(name);
    }
    new Function('require','module','exports', source)(req,mod,mod.exports);
    return mod.exports;
  }
  return read(path.join(root,file + '.ts'));
}
const head = { id:'head', user_id:'owner', name:'Seamus', template_id:'head-agent', paused:false, config:{} };
const writer = { ...head, id:'writer', name:'Otis', template_id:'content-agent' };
const roster = ['head-agent','research-agent','analytics-agent','content-agent','seo-agent','landing-agent','lead-agent','outreach-agent'];
const army = { HEAD_AGENT:{id:'head-agent',defaultName:'Seamus'}, rosterTemplateIds:()=>roster, ABSORBED_SKILLS:{'research-agent':['competitor-agent'],'content-agent':['blog-agent','newsletter-agent','ads-agent','video-script-agent'],'landing-agent':['review-agent']}, displayName:(_,name)=>name };
function database(failTable) {
  const writes=[];
  return { writes, from(table) {
    let operation='read', value;
    const q={ select(){return q}, eq(){return q}, order(){return q}, limit(){return q}, update(v){operation='update';value=v;return q}, insert(v){operation='insert';value=v;return q}, maybeSingle(){return Promise.resolve({data:writer,error:null})}, then(resolve,reject){
      if(operation!=='read')writes.push({table,value});
      return Promise.resolve({data:[], error:table===failTable ? {message:'offline'} : null}).then(resolve,reject);
    }}; return q;
  }};
}
function roomSetup({agents=[head,writer],failTable,modelFail=false}={}) {
  const db=database(failTable);let replies=0;let commands=0;
  const mod=load('room',{
    './supabase/admin':{createAdminClient:()=>db}, './army':army, './templates':{getTemplate:()=>({name:'Agent'})},
    './mention':{mentionableAgents:async()=>agents,nameOf:a=>a.name,findMention:(text,as)=>{const a=as.find(a=>text.startsWith('@'+a.name));return a ? {agent:a,name:a.name,instruction:text.slice(a.name.length+1).trim()} : null}},
    './chat-model':{chatKeyFor:async()=> 'test-key',respondAsAgent:async()=>{replies++;if(modelFail)throw Error('private provider failure');return 'Here is the actual answer.'}},
    './head-orchestrator':{executeHeadCommand:async()=>{commands++;return {handled:false}}},
  });
  return {db,mod,counts:()=>({replies,commands})};
}
for (const message of ['Hello team','@Seamus Hello','@Otis Hello']) test(`room answers and persists: ${message}`,async()=>{
  const {db,mod,counts}=roomSetup();const result=await mod.handleFounderMessage(db,'owner',message);
  assert.equal(result.problem,null);assert.equal(counts().replies,1);
  assert.equal(db.writes.filter(w=>w.table==='chat_messages').length,2);
  assert.equal(db.writes.filter(w=>w.table==='room_messages').length,2);
  assert.ok(db.writes.every(w=>w.value.user_id==='owner'));
});
test('paused recipient does not execute or save a false sent message',async()=>{
  const {db,mod,counts}=roomSetup({agents:[{...head,paused:true}]});const r=await mod.handleFounderMessage(db,'owner','Hello');
  assert.match(r.problem,/paused/);assert.equal(db.writes.length,0);assert.equal(counts().replies,0);
});
test('history failure prevents work',async()=>{
  const {db,mod,counts}=roomSetup({failTable:'chat_messages'});
  await assert.rejects(mod.handleFounderMessage(db,'owner','Hello'),/No work was started/);
  assert.equal(counts().replies,0);assert.equal(db.writes.length,0);
});
test('provider failure becomes a saved visible failure without private details',async()=>{
  const {db,mod}=roomSetup({modelFail:true});const r=await mod.handleFounderMessage(db,'owner','Hello');
  assert.ok(r.problem);assert.ok(db.writes.some(w=>w.table==='room_messages'&&w.value.body.includes('could not finish')));
  assert.ok(!JSON.stringify(db.writes).includes('private provider'));
});
const routes=load('head-orchestrator',{'./army':army,'./chat-model':{},'./run-agent':{},'./schedule':{},'./supabase/admin':{}});
for(const [prompt,expected] of [
 ['Research competitors','research-agent'],['Write a blog about leads','content-agent'],['Create video script','content-agent'],['Audit conversion rate','analytics-agent'],['Find leads','lead-agent'],['Draft cold email','outreach-agent'],['Write newsletter','content-agent'],['Check SEO','seo-agent'],['Audit my landing page','landing-agent'],['Check reviews','landing-agent'],['Hello',null]
])test(`routes ${prompt} to ${expected}`,()=>assert.equal(routes.routeFor(prompt),expected));
test('model credentials are not sent to a different provider',()=>{
  const previous={...process.env};
  for(const k of ['OPENROUTER_API_KEY','PLATFORM_OPENROUTER_KEY','PLATFORM_MODEL_KEY','ORCA_API_KEY','ZAI_API_KEY','AICREDITS_API_KEY'])delete process.env[k];
  process.env.AIROUTER_API_KEY='airouter-only';
  try{const model=load('agent-model-routing');const candidates=model.routeForAgent('head-agent','airouter-only');assert.ok(candidates.length);assert.ok(candidates.every(c=>c.provider==='airouter'));}
  finally{process.env=previous;}
});
function runSetup({saveFails=false,live=true,actionProblem=null}={}){
 const base=database();const admin={from(table){
  if(table!=='generations')return base.from(table);
  const query={insert(){return query},select(){return query},maybeSingle:async()=>({data:saveFails?null:{id:'saved-output'},error:saveFails?{message:'offline'}:null})};return query;
 }};
 let inferences=0,lookups=0;
 const mod=load('run-agent',{
 './supabase/admin':{createAdminClient:()=>admin},
 './chat-model':{chatKeyFor:async()=> 'test',chatComplete:async()=>{inferences++;return 'A concrete deliverable with verified sources.'},businessConfigFor:async()=>({icp:'founders'}),systemPromptFor:async()=> 'system'},
 './research':{gatherLiveResearch:async()=>({used:live,text:live?'Verified source':''})},
 './agent-activity':{markWorking:async()=>{}},'./templates':{getTemplate:()=>({scheduledTask:'Write something'})},
 './wiki':{wikiBlock:async()=>'',writeWiki:async()=>0,parseLearned:content=>({content,learned:[]}),LEARN_INSTRUCTION:''},
 './quality':{assess:()=>({passed:true})},'./apollo':{},'./monid-capabilities':{},
 './connectors':{loadConnectors:async()=>({}),houseMonidKey:async()=>null,houseFirecrawlKey:async()=>null},
 './agent-intel':{hasBrief:()=>false},
 './chat-actions':{detectAction:()=>null,runAction:async()=>{lookups++;return{problem:actionProblem,evidence:'real contacts',rows:2}},presentationRules:()=>''},
 './room':{postFromAgent:async()=>{},summarise:x=>x},
 });return {admin,mod,counts:()=>({inferences,lookups})};
}
test('failed output save cannot be reported as completed',async()=>{
 const {admin,mod}=runSetup({saveFails:true});const r=await mod.runAgentOnce(admin,writer,{instruction:'Write a post'});
 assert.equal(r.ok,false);assert.equal(r.generationId,null);assert.match(r.reason,/could not be saved/);
});
test('research without live sources fails before model can invent findings',async()=>{
 const {admin,mod,counts}=runSetup({live:false});const r=await mod.runAgentOnce(admin,{...writer,template_id:'research-agent'},{instruction:'Investigate this business'});
 assert.equal(r.ok,false);assert.equal(counts().inferences,0);
});
test('lead work uses the shared persistent lookup pipeline and surfaces failure',async()=>{
 const {admin,mod,counts}=runSetup({actionProblem:'Pipeline save failed'});const r=await mod.runAgentOnce(admin,{...writer,template_id:'lead-agent'},{instruction:'Find founders'});
 assert.equal(r.ok,false);assert.equal(counts().lookups,1);assert.equal(counts().inferences,0);
});
test('successful run returns the actual saved generation id',async()=>{
 const {admin,mod}=runSetup();const r=await mod.runAgentOnce(admin,writer,{instruction:'Write a post'});assert.equal(r.ok,true);assert.equal(r.generationId,'saved-output');
});
