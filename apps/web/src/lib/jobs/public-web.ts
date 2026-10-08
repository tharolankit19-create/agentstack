import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
import { load } from "cheerio";
import { JobFailure } from "./recovery";
import { digest, type SourceSnapshot } from "./verification";
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a,b] = address.split('.').map(Number);
    return !(a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&(b===168||b===0||b===2)) || (a===100&&b>=64&&b<=127) || (a===198&&(b===18||b===19||b===51)) || (a===203&&b===0));
  }
  // Allow global-unicast IPv6 only, excluding documentation and mapped IPv4.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !/^2002:/i.test(address) && !/^2001:(?:db8|0*0|0*2):/i.test(address);
}
export function publicUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port!=='443') || url.hostname==='localhost' || /\.(local|internal|localhost)$/i.test(url.hostname)) throw new JobFailure('source_unavailable','Only public HTTPS source URLs are allowed.');
  url.hash=''; return url;
}
export async function publicPage(raw: string, redirects=0): Promise<SourceSnapshot> {
  const url=publicUrl(raw);
  const host=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=isIP(host) ? [{address:host,family:isIP(host)}] : await lookup(host,{all:true});
  if (!addresses.length || addresses.some(a=>!publicAddress(a.address))) throw new JobFailure('source_unavailable','Source resolves to a private or reserved network.');
  const selected=addresses[0];
  const response=await new Promise<{status:number;location?:string;body:string;type:string}>((resolve,reject)=>{
    const req=request(url,{headers:{'User-Agent':'KryxSourceVerifier/2.0','Accept':'text/html,text/plain'},lookup:(_hostname,_options,callback)=>callback(null,selected.address,selected.family)},res=>{
      let bytes=0;const chunks:Buffer[]=[];
      res.on('data',(part:Buffer)=>{bytes+=part.length;if(bytes>2_000_000){res.destroy(new Error('Source exceeds size limit'));return;}chunks.push(part);});
      res.on('end',()=>resolve({status:res.statusCode??0,location:res.headers.location,body:Buffer.concat(chunks).toString('utf8'),type:res.headers['content-type']??''}));
      res.on('error',reject);
    });
    req.setTimeout(15_000,()=>req.destroy(new JobFailure('network_timeout','Source read timed out.')));
    req.on('error',reject);req.end();
  });
  if (response.status>=300&&response.status<400&&response.location) {
    if(redirects>=3) throw new JobFailure('source_unavailable','Source redirects exceeded the limit.');
    const followed=await publicPage(new URL(response.location,url).href,redirects+1);
    return {...followed,url:raw};
  }
  if((response.status===403 && /captcha|cf-chl-|challenge-platform/i.test(response.body)) || /<title[^>]*>\s*(?:just a moment|verify you are human|security verification)/i.test(response.body)) throw new JobFailure('captcha','The source requires human verification. Kryx paused without bypassing it.');
  if(response.status===401||response.status===403) throw new JobFailure('source_unavailable','Public source is restricted; do not bypass login or anti-bot checks.');
  let text=response.body;
  if(response.type.includes('html')) {const $=load(text);$('script,style,noscript,iframe,form').remove();text=$('body').text().replace(/\s+/g,' ').trim();}
  else if(!response.type.includes('text/plain')) throw new JobFailure('source_unavailable','Source format is not supported.');
  text=text.slice(0,16000);
  return {url:raw,status:response.status,text,sha256:digest(text),capturedAt:new Date().toISOString()};
}
