"use client";
import { useEffect, useState } from "react";
type Usage={is_admin?:boolean;unlimited?:boolean;files:number|null;requests:number|null;file_limit:number|null;request_limit:number|null;reset_at:string|null};
export default function FairUse({api}:{api:string}) {
 const [usage,setUsage]=useState<Usage|null>(null),[error,setError]=useState("");
 useEffect(()=>{
  let stopped=false;let timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
  async function refresh(){
   try{const r=await fetch(`${api}/fair-use`,{credentials:"include",cache:"no-store",signal:controller.signal});const d=await r.json();if(!r.ok)throw new Error(typeof d.detail === "string"?d.detail:"Usage unavailable");if(!stopped){setUsage(d);setError("");}}
   catch(e){if(!stopped)setError(e instanceof Error?e.message:"Usage unavailable");}
   finally{if(!stopped)timer=setTimeout(refresh,30000);}
  }
  void refresh();return()=>{stopped=true;clearTimeout(timer);controller.abort();};
 },[api]);
 return <aside className="mb-5 rounded border border-white/10 bg-black/20 p-4 text-sm" aria-label="Your daily fair-use allowance">
 <p className="font-medium">Your daily allowance</p>
 {error?<p role="status">{error}</p>:usage?.is_admin && usage.unlimited?<><p className="mt-1">Admin · No personal daily limit</p><p className="mt-1 text-xs text-muted-foreground">Provider quotas and rate limits still apply.</p></>:usage?<><p className="mt-1">Files: {usage.files}/{usage.file_limit}</p>
 <p className="mt-1 text-xs text-muted-foreground">Next reset: {new Date(usage.reset_at || "").toLocaleString("en-GB",{timeZone:"Asia/Colombo",day:"numeric",month:"short",hour:"numeric",minute:"2-digit",hour12:true})} (Sri Lanka). Resuming the same job does not use another file slot. There is no personal AI request limit. Provider quotas still apply.</p></>:<p>Checking your allowance…</p>}
 </aside>;
}
