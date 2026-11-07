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
 return (
  <aside className="mb-6 flex flex-col gap-3 rounded-[5px] border border-border bg-[var(--next-gray-200)] px-4 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between" aria-label="Your daily fair-use allowance">
   <div className="min-w-0">
    <p className="font-medium text-ink">Your daily allowance</p>
    {error ? <p role="status" className="mt-1 text-xs text-content-tertiary">{error}</p> : usage?.is_admin && usage.unlimited ? <p className="mt-1 text-xs text-content-tertiary">Admin · No personal daily limit. Provider quotas and rate limits still apply.</p> : usage ? <p className="mt-1 font-mono text-xs text-body">Files: {usage.files}/{usage.file_limit}</p> : <p className="mt-1 text-xs text-content-tertiary">Checking your allowance…</p>}
   </div>
   {usage && !error && !(usage.is_admin && usage.unlimited) && (
    <p className="max-w-2xl text-[11px] leading-relaxed text-content-tertiary sm:text-right">
     Next reset: {new Date(usage.reset_at || "").toLocaleString("en-GB",{timeZone:"Asia/Colombo",day:"numeric",month:"short",hour:"numeric",minute:"2-digit",hour12:true})} (Sri Lanka). Resuming the same job does not use another file slot. There is no personal AI request limit. Provider quotas still apply.
    </p>
   )}
  </aside>
 );
}
