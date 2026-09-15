
"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {Loader2,Square,Volume2} from "lucide-react";
const STOP_EVENT="kryx-stop-speech";
export function SpeakReplyButton({text}:{text:string}) {
 const [state,setState]=useState<"idle"|"loading"|"playing">("idle");
 const [error,setError]=useState("");
 const active=useRef(false), generation=useRef(0);
 const request=useRef<AbortController|null>(null), player=useRef<HTMLAudioElement|null>(null), url=useRef<string|null>(null);
 const stop=useCallback(()=>{
  generation.current++;active.current=false;request.current?.abort();request.current=null;
  if(player.current){player.current.onended=null;player.current.onerror=null;player.current.pause();player.current.src="";player.current=null;}
  if(url.current){URL.revokeObjectURL(url.current);url.current=null;}
  setState("idle");
 },[]);
 useEffect(()=>{
  window.addEventListener(STOP_EVENT,stop);
  return ()=>{window.removeEventListener(STOP_EVENT,stop);stop();};
 },[stop]);
 async function speak() {
  if(active.current){stop();return;}
  window.dispatchEvent(new Event(STOP_EVENT));
  const ticket=++generation.current;
  active.current=true;setError("");setState("loading");
  const controller=new AbortController();request.current=controller;
  try {
   const response=await fetch("/api/voice/tts",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({text:text.slice(0,6000)}),signal:controller.signal});
   if(!response.ok){const p=await response.json().catch(()=>({}));throw new Error(p.error||"Could not play this reply.");}
   const blob=await response.blob();if(ticket!==generation.current)return;
   if(!blob.size)throw new Error("No audio came back. Try again.");
   const objectUrl=URL.createObjectURL(blob);url.current=objectUrl;
   const audio=new Audio(objectUrl);player.current=audio;
   audio.onended=stop;audio.onerror=()=>{stop();setError("Audio could not play. Try again.");};
   await audio.play();if(ticket!==generation.current)return;setState("playing");
  }catch(e){
   if(ticket!==generation.current)return;
   stop();setError(e instanceof Error?e.message:"Could not play this reply.");
  }
 }
 return <span className="inline-flex flex-wrap items-center gap-2">
  <button type="button" onClick={()=>void speak()} aria-label={state==="idle"?"Listen to reply":"Stop audio"} aria-pressed={state!=="idle"}
   className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-3 hover:text-fg">
   {state==="loading"?<Loader2 className="size-3.5 animate-spin"/>:state==="playing"?<Square className="size-3.5"/>:<Volume2 className="size-3.5"/>}
   {state==="loading"?"Preparing audio…":state==="playing"?"Stop":"Listen"}
  </button>{error?<span role="alert" className="text-xs text-danger">{error}</span>:null}
 </span>;
}
