
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ts=require("typescript");
function moduleAt(path,mocks={},extra={}) {
 const source=fs.readFileSync(path,"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(js,{exports,require:name=>{if(name==="server-only")return {};if(name in mocks)return mocks[name];throw Error("Unexpected import "+name);},
  Response,Request,AbortSignal,Uint8Array,Date,console,setTimeout,process:{env:{}},...extra},{filename:path});
 return exports;
}
const contract=moduleAt("apps/web/src/lib/feedback-contract.ts");
test("Six grounded questions include failures and things to preserve",()=>{
 const answers=[];
 for(let i=0;i<6;i++) {
  const question=contract.nextFeedbackQuestion(answers,true);
  assert.equal(typeof question,"string");answers.push({question,answer:"Concrete negative experience"});
 }
 assert.equal(contract.nextFeedbackQuestion(answers,true),null);
 assert.match(contract.nextFeedbackQuestion([answers[0]],false),/stopped/);
 assert.match(answers[2].question,/nothing needed changing/);
 assert.match(answers[5].question,/if anything/);
 assert.equal(contract.FEEDBACK_CREDITS,200);
});
test("Negative feedback is not an abuse flag; repeated answers prompt review",()=>{
 const answers=Array.from({length:6},(_,i)=>({question:"q",answer:"The room failed on a different task "+i+" and I had to retry."}));
 assert.equal(contract.feedbackFlags(answers,2).length,0);
 answers[1]=answers[0];
 assert.ok(contract.feedbackFlags(answers,2).some(f=>f.includes("Repeated")));
});
test("Runtimes share the human contract; quotes and code are protected",()=>{
 const core="apps/hermes-core/src/core/human-writing.ts";
 assert.equal(fs.readFileSync(core,"utf8"),fs.readFileSync("apps/web/src/generated/human-writing.ts","utf8"));
 const rules=moduleAt(core);
 assert.ok(rules.writingViolations("This is a game changer").length);
 const fence=String.fromCharCode(96).repeat(3);
 assert.equal(rules.writingViolations('  > A game changer\n"game changer"\n'+fence+"\nconst s='game changer';\n"+fence).length,0);
 assert.equal(rules.writingViolations("Room में reply नहीं आया, task दोबारा भेजा।").length,0);
});
test("Feedback endpoint rejects anonymous access without storage access",async()=>{
 const api=moduleAt("apps/web/src/app/api/feedback/route.ts",{
  "@/lib/auth":{requireApiUser:async()=>({ok:false,response:Response.json({error:"Sign in"},{status:401})})},
  "@/lib/supabase/admin":{createAdminClient:()=>{throw Error("should not query");}},
  "@/lib/feedback-contract":contract,"@/lib/rate-limit":{rateLimit:()=>({allowed:true})},
 });
 assert.equal((await api.GET()).status,401);
 assert.equal((await api.POST(new Request("https://test/api/feedback",{method:"POST",body:"{}"}))).status,401);
});
test("Owner scoping and version conflicts prevent overwrite",async()=>{
 const calls=[];
 const session={id:"s",user_id:"owner",status:"draft",version:2,answers:[],usage_snapshot:{outputs:1}};
 const query={select(){return this},eq(...v){calls.push(v);return this},maybeSingle:async()=>({data:session,error:null})};
 const api=moduleAt("apps/web/src/app/api/feedback/route.ts",{
  "@/lib/auth":{requireApiUser:async()=>({ok:true,session:{userId:"owner"}})},
  "@/lib/supabase/admin":{createAdminClient:()=>({from:()=>query})},
  "@/lib/feedback-contract":contract,"@/lib/rate-limit":{rateLimit:()=>({allowed:true})},
 });
 const response=await api.POST(new Request("https://test/api/feedback",{method:"POST",body:JSON.stringify({action:"answer",version:1,user_id:"victim",answer:"x",credits:99999})}));
 assert.equal(response.status,409);
 assert.ok(calls.some(([k,v])=>k==="user_id"&&v==="owner"));
});
test("Ordinary users cannot access admin grant RPC",async()=>{
 const api=moduleAt("apps/web/src/app/api/admin/feedback/route.ts",{
  "@/lib/auth":{requireApiUser:async()=>({ok:true,session:{profile:{is_admin:false}}})},
  "@/lib/plans":{isAdmin:p=>p.is_admin},
  "@/lib/supabase/admin":{createAdminClient:()=>{throw Error("should not query");}},
 });
 assert.equal((await api.POST(new Request("https://test",{method:"POST",body:"{}"}))).status,404);
});
test("Monid-only research works; failed fetches are not evidence",async()=>{
 let real=true;
 const mocks={
  "./supabase/admin":{},"./connectors":{loadConnectors:async()=>({monid:"test"}),houseFirecrawlKey:async()=>null,houseMonidKey:async()=>null,houseXKey:async()=>null},
  "./platform-keys":{platformMonidKey:()=>null},
  "./monid-capabilities":{runCapability:async()=>({ok:real,rows:real?[{title:"A concrete retrieved source with facts",url:"https://example.com/source"}]:[],via:"test"}),rowsBlock:rows=>JSON.stringify(rows)},
  "./firecrawl":{scrape:async()=>null,search:async()=>[]},"./xquik":{searchX:async()=>[]},
 };
 const research=moduleAt("apps/web/src/lib/research.ts",mocks);
 const result=await research.gatherLiveResearch({},"owner",{},"research onboarding");
 assert.equal(result.used,true);assert.match(result.text,/Monid/);
 real=false;
 const failed=await research.gatherLiveResearch({},"owner",{},"https://example.com");
 assert.equal(failed.used,false);assert.equal(failed.hasSource,true);
});
test("Fish validates config and hides provider response bodies",async()=>{
 const env={FISH_AUDIO_API_KEY:"test",FISH_AUDIO_VOICE_ID:"voice",FISH_AUDIO_MODEL:"invalid"};
 let fetched=false;
 const fish=moduleAt("apps/web/src/lib/fish-audio.ts",{},{
  process:{env},fetch:async()=>{fetched=true;return new Response("private upstream body",{status:401});},
 });
 await assert.rejects(()=>fish.synthesizeVoice("hello"),/Unsupported/);assert.equal(fetched,false);
 env.FISH_AUDIO_MODEL="s2.1-pro-free";
 await assert.rejects(()=>fish.synthesizeVoice("hello"),e=>e.message.includes("401")&&!e.message.includes("private"));
 delete env.FISH_AUDIO_VOICE_ID;
 assert.equal(fish.fishConfigured(),false);
});
