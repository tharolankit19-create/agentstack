import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

/** Log scheduling metadata only, never arbitrary endpoint response bodies. */
export function heartbeatSummary(value) {
  if(!value||typeof value!=='object'||!Array.isArray(value.dispatched)||!Array.isArray(value.skipped)||!Array.isArray(value.failed))throw new Error('Invalid heartbeat response');
  const names=items=>items.map(item=>{
    const name=typeof item==='string'?item:item?.worker;
    if(typeof name!=='string'||!/^[a-z][a-z0-9_]{0,31}$/.test(name))throw new Error('Invalid worker metadata');
    return name;
  });
  return {dispatched:names(value.dispatched),skipped:names(value.skipped),failed:names(value.failed),unconfirmed:names(value.unconfirmed??[])};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const summary=heartbeatSummary(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
    console.log(`Dispatched: ${summary.dispatched.length}; skipped: ${summary.skipped.length}; failed: ${summary.failed.length}; unconfirmed: ${summary.unconfirmed.length}`);
    if(summary.unconfirmed.length)console.log(`::warning::Worker response unconfirmed: ${summary.unconfirmed.join(', ')}. Check the clock and job records.`);
    if(summary.failed.length){console.error(`::error::Worker dispatch failed: ${summary.failed.join(', ')}`);process.exitCode=1;}
  } catch { console.error('::error::Heartbeat did not return valid scheduling metadata.');process.exitCode=1; }
}
