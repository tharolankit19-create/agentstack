const {test,before,after,beforeEach,afterEach}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');
const {build}=require('esbuild');const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');const A='00000000-0000-4000-8000-000000000101';const B='00000000-0000-4000-8000-000000000102';
let server,browser,origin,launchOptions;
const navigation=`import React,{useSyncExternalStore} from 'react';
 const subscribe=(fn)=>{window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn);};
 export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''));}
 export function useRouter(){return {push:(url)=>{history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'));}};}
 export default function Link({href,children,...props}){return React.createElement('a',{...props,href,onClick:(e)=>{e.preventDefault();history.pushState({},'',href);window.dispatchEvent(new PopStateEvent('popstate'));}},children);}`;
function fixture(overrides={}){
 const job={id:A,user_id:'fixture-owner',instruction:'Find 20 fixture SaaS founders',task_class:'LEAD_LIST',status:'waiting_for_user',blocker_category:'credit_cap',summary:'The job reached its hard credit cap.',hard_cap:90,estimated_credits:70,estimate_min:40,credits_used:0,reserved_credits:90,is_free:false,receipt:null,completion_contract:{predicates:[{id:'exact_lead_count',kind:'COUNT_EQUALS',value:20}]},...overrides};
 return {job,messages:[{id:'fixture-message',role:'user',content:job.instruction}],events:[],artifacts:[],verification:null,browser:null,usage:{budgetUsed:90,completionCostSoFar:23,failedAttemptCredits:7,pendingCredits:0}};
}
before(async()=>{
 const bundled=await build({entryPoints:[path.join(__dirname,'jobs-entry.tsx')],bundle:true,write:false,jsx:'automatic',format:'iife',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'test-next-context',setup(b){
  b.onResolve({filter:/^next\/(link|navigation)$/},()=>({path:'next-test',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:navigation,loader:'js',resolveDir:ROOT}));
  b.onResolve({filter:/^@\//},args=>({path:path.join(ROOT,'apps/web/src',args.path.slice(2)+'.ts')}));
 }}]});
 const js=bundled.outputFiles[0].text;const staticRoot=path.join(ROOT,'apps/web/.next/static');
 const cssFiles=[];function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(p.endsWith('.css'))cssFiles.push(p);}}
 scan(staticRoot);assert.ok(cssFiles.length,'Build the actual app CSS before browser QA');
 const css=cssFiles.map(p=>fs.readFileSync(p,'utf8')).join('\n');
 server=http.createServer((req,res)=>{
  if(req.url==='/ui.js'){res.setHeader('content-type','text/javascript');res.end(js);return;}
  if(req.url==='/ui.css'){res.setHeader('content-type','text/css');res.end(css);return;}
  if(req.url.startsWith('/_next/static/')||req.url.startsWith('/media/')){const relative=req.url.startsWith('/media/')?req.url.slice(1):req.url.slice('/_next/static/'.length);const file=path.resolve(staticRoot,relative);if(file.startsWith(staticRoot+path.sep)&&fs.existsSync(file)){if(file.endsWith('.woff2'))res.setHeader('content-type','font/woff2');res.end(fs.readFileSync(file));return;}res.writeHead(404);res.end();return;}
  res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"></head><body><main id="root" style="padding:20px"><script src="/ui.js"></script></main></body></html>');
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 launchOptions={headless:true};if(process.env.KRYX_UI_BROWSER_PACKAGE){const imported=require(process.env.KRYX_UI_BROWSER_PACKAGE);const runtime=imported.default??imported;launchOptions.executablePath=await runtime.executablePath();launchOptions.args=runtime.args.filter(arg=>!['--disable-web-security','--allow-running-insecure-content','--disable-site-isolation-trials'].includes(arg));}
});
beforeEach(async()=>{browser=await chromium.launch(launchOptions);});
afterEach(async()=>{await browser?.close();});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
test('cap recovery explains real usage, preserves edits across polling, and posts the explicitly chosen cap',async()=>{
 const page=await browser.newPage();let current=fixture(),requests=[];
 try{await page.route('**/api/jobs/**',async route=>{if(route.request().method()==='POST'){requests.push(route.request().postDataJSON());current=fixture({status:'queued',hard_cap:120,blocker_category:null});await route.fulfill({json:{ok:true}});}else await route.fulfill({json:current});});
  await page.goto(origin+`/dashboard/jobs?id=${A}`);await page.getByRole('region',{name:'Needs you'}).waitFor();assert.match(await page.locator('header').innerText(),/Work budget 90\/90/);
  assert.match(await page.locator('header').innerText(),/23 credits/);assert.match(await page.locator('header').innerText(),/7 failed-attempt credits excluded/);
  assert.equal(await page.getByRole('button',{name:'Resume',exact:true}).isEnabled(),false);
  await page.getByLabel('Hard credit cap').fill('120');await page.waitForTimeout(4200);assert.equal(await page.getByLabel('Hard credit cap').inputValue(),'120');
  assert.match(await page.getByRole('region',{name:'Needs you'}).innerText(),/Additional reservation: 30 credits/);
  await page.getByRole('button',{name:'Raise cap and resume'}).click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();assert.deepEqual(requests,[{action:'resume',hardCap:120}]);
 }finally{await page.close();}
});
test('invalid caps cannot start a job and verification can be paused',async()=>{
 const page=await browser.newPage();let current=fixture({status:'created',blocker_category:null});let writes=0;
 try{await page.route('**/api/jobs/**',async route=>{if(route.request().method()==='POST')writes++;await route.fulfill({json:current});});await page.goto(origin+`/dashboard/jobs?id=${A}`);
  await page.getByLabel('Hard credit cap').fill('30');assert.equal(await page.getByRole('button',{name:'Start job'}).isEnabled(),false);assert.equal(writes,0);
  current=fixture({status:'verifying',blocker_category:null});await page.reload();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();
 }finally{await page.close();}
});
test('expired passing evidence is clearly marked for rechecking and never shows a completion receipt',async()=>{
 const page=await browser.newPage();try{
  const data=fixture({status:'verifying',blocker_category:null});data.verification={passed:true,expired:true,checks:[{id:'sources_accessible',passed:true,detail:'Previously checked fixture sources.'}]};
  await page.route('**/api/jobs/**',route=>route.fulfill({json:data}));await page.goto(origin+`/dashboard/jobs?id=${A}`);
  await page.getByRole('heading',{name:'Verification expired',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Verification passed',exact:true}).count(),0);
  assert.equal(await page.getByRole('heading',{name:'Completion receipt',exact:true}).count(),0);assert.equal(await page.getByText('Kryx must check this evidence again before finishing.',{exact:true}).count(),1);
 }finally{await page.close();}
});
test('switching threads does not display a late response or receipt from the previous job',async()=>{
 const page=await browser.newPage();let release;const pending=new Promise(resolve=>{release=resolve;});
 try{await page.route('**/api/jobs/**',async route=>{if(route.request().url().endsWith(A)){await pending;try{await route.fulfill({json:fixture({instruction:'Old fixture receipt',status:'completed',receipt:{result:'Old fixture completed'}})});}catch{/* The obsolete GET is deliberately aborted by the real component. */}}else await route.fulfill({json:fixture({id:B,instruction:'Current fixture job',status:'running',blocker_category:null})});});
  await page.goto(origin+`/dashboard/jobs?id=${A}`);await page.getByRole('status').waitFor();await page.evaluate(id=>{history.pushState({},'',`/dashboard/jobs?id=${id}`);window.dispatchEvent(new PopStateEvent('popstate'));},B);
  await page.getByRole('heading',{name:'Current fixture job'}).waitFor();release();await page.waitForTimeout(100);assert.equal(await page.getByText('Old fixture receipt',{exact:true}).count(),0);
 }finally{release();await page.close();}
});
test('a rejected mutation remains visible after a successful polling refresh',async()=>{
 const page=await browser.newPage();try{await page.route('**/api/jobs/**',async route=>{if(route.request().method()==='POST')await route.fulfill({status:409,json:{error:'Not enough available credits to reserve this cap.'}});else await route.fulfill({json:fixture()});});
  await page.goto(origin+`/dashboard/jobs?id=${A}`);await page.getByLabel('Hard credit cap').fill('120');await page.getByRole('button',{name:'Raise cap and resume'}).click();await page.getByRole('alert').waitFor();await page.waitForTimeout(4200);assert.match(await page.getByRole('alert').innerText(),/Not enough available credits/);
 }finally{await page.close();}
});
test('the needs-you recovery controls fit a mobile viewport without horizontal overflow',async()=>{
 const page=await browser.newPage({viewport:{width:375,height:812}});try{await page.route('**/api/jobs/**',route=>route.fulfill({json:fixture()}));await page.goto(origin+`/dashboard/jobs?id=${A}`);await page.getByLabel('Hard credit cap').fill('120');await page.getByRole('button',{name:'Raise cap and resume'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const screenshotDir=process.env.KRYX_UI_SCREENSHOT_DIR;if(screenshotDir){fs.mkdirSync(screenshotDir,{recursive:true});await page.screenshot({path:path.join(screenshotDir,'needs-you-mobile.png'),fullPage:true});}
 }finally{await page.close();}
});
