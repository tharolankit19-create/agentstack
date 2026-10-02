// CI-only isolated-host verification. Never run this against a shared production host.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const docker = promisify(execFile), base = process.env.KRYX_COMPUTER_API_URL, token = process.env.KRYX_COMPUTER_API_KEY;
assert(process.env.KRYX_ISOLATION_TEST_HOST === "1", "Explicit isolated test host required");
assert(base && token, "Configured test broker required");
const workspaces = [0,1].map(()=> "isolation_" + randomUUID().replaceAll("-",""));
const hashes = workspaces.map(w=>createHash("sha256").update(w).digest("hex").slice(0,32));
const names = hashes.map(h=>"kryx-"+h), volumes = hashes.map(h=>"kryx-workspace-"+h);
const command = async(args)=>(await docker("docker",args,{timeout:60000,maxBuffer:1000000})).stdout;
async function request(path, input, expected = 200) {
  const r=await fetch(base+path,{method:input?"POST":"GET",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:input?JSON.stringify(input):undefined,signal:AbortSignal.timeout(90000)});
  assert.equal(r.status,expected,"Unexpected runtime response for "+path);
  return r.json();
}
try {
  for (const [i,workspace] of workspaces.entries())
    await request("/capture",{workspace,url:process.env.KRYX_SMOKE_URL||"https://example.com",mobile:!!i});
  const inspected=JSON.parse(await command(["inspect",...names]));
  assert.equal(inspected.length,2);
  for (let i=0;i<2;i++) {
    const state=inspected[i];
    assert.equal(state.HostConfig.ReadonlyRootfs,true);
    assert(state.HostConfig.CapDrop.includes("ALL"));
    assert.equal(state.HostConfig.NetworkMode,"kryx-computer-internal");
    assert.equal(Object.keys(state.NetworkSettings.Networks).length,1);
    assert.equal(state.HostConfig.Memory,1073741824);
    assert.equal(state.HostConfig.PidsLimit,128);
    assert.equal(state.Mounts.find(m=>m.Destination==="/workspace").Name,volumes[i]);
  }
  assert.notEqual(volumes[0],volumes[1]);
  await command(["exec",names[0],"node","-e",
    "require('node:fs').writeFileSync('/workspace/files/tenant-marker.txt','workspace-a-private-evidence'); require('node:fs').writeFileSync('/workspace/browser-profile/restart-marker','persistent-profile');"]);
  const a=await request("/files",{workspace:workspaces[0],path:"tenant-marker.txt"});
  assert.equal(Buffer.from(a.content,"base64").toString(),"workspace-a-private-evidence");
  await request("/files",{workspace:workspaces[1],path:"tenant-marker.txt"},400);
  await request("/files",{workspace:workspaces[0],path:"../browser-profile/restart-marker"},400);
  await request("/terminal",{workspace:workspaces[0],approved:true,command:"echo should-not-run"},400);
  const unauthorized=await fetch(base+"/health",{headers:{authorization:"Bearer incorrect-token"}});
  assert.equal(unauthorized.status,401);
  await command(["restart",names[0]]);
  const deadline=Date.now()+30000;
  let resumed=false;
  while(Date.now()<deadline) {
    try {
      const r=await fetch(base+"/files",{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({workspace:workspaces[0],path:"tenant-marker.txt"}),signal:AbortSignal.timeout(1500)});
      if(r.ok) {
        const body=await r.json();
        assert.equal(Buffer.from(body.content,"base64").toString(),"workspace-a-private-evidence");
        resumed=true;break;
      }
    } catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  assert(resumed,"Owned workspace files must survive runtime restart");
  assert.equal((await command(["exec",names[0],"node","-e","process.stdout.write(require('node:fs').readFileSync('/workspace/browser-profile/restart-marker','utf8'))"])).trim(),"persistent-profile");
  console.log("Two-tenant volume isolation, resource controls, traversal denial, disabled terminal and restart persistence passed");
} finally {
  await command(["rm","-f",...names]).catch(()=>{});
  await command(["volume","rm",...volumes]).catch(()=>{});
}
