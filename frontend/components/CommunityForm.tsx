"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { openAuthPopup } from "@/lib/auth-popup";
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");
export default function CommunityForm({kind,title=""}:{kind:"request"|"report";title?:string}) {
 const [name,setName]=useState(title),[details,setDetails]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[login,setLogin]=useState(false);
 const event = useRef<string | null>(null);
 const label = kind === "request" ? "Request a subtitle" : "Report a translation issue";
 const description = kind === "request"
   ? "Tell us the movie or series, year, season and episode. Requests are reviewed; delivery is not guaranteed."
   : "Include the subtitle number, original English line, current Sinhala line and your suggested correction. Reports are reviewed before glossary changes.";
 async function submit(e: React.FormEvent) {
  e.preventDefault(); if (busy) return;
  setBusy(true);setMessage("");setLogin(false);
  event.current ||= crypto.randomUUID();
  try {
   const response=await fetch(`${API}/community`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,title:name.trim(),details:details.trim(),event_id:event.current})});
   const data=await response.json();
   if(response.status===401){setLogin(true);throw new Error("Sign in to send your request or report.");}
   if(!response.ok)throw new Error(typeof data.detail === "string" ? data.detail : "Could not send. Please try again.");
   setMessage("Thank you! Your submission is saved for review.");setDetails("");event.current=null;
  } catch(error) {setMessage(error instanceof Error ? error.message : "Could not send. Try again.");}
  finally{setBusy(false);}
 }
 return (
  <section className="w-full rounded-[5px] border border-border bg-[var(--next-gray-200)] p-5">
   <div>
    <h3 className="text-sm font-semibold text-ink">{label}</h3>
    <p className="mt-1 max-w-xl text-xs leading-relaxed text-body">{description}</p>
   </div>
   <form onSubmit={submit} className="mt-4 space-y-3">
    <label className="block text-xs">
     <span className="font-medium text-body">Movie or series title</span>
     <input
      required
      maxLength={160}
      disabled={busy}
      value={name}
      onChange={e=>{setName(e.target.value);event.current=null;}}
      placeholder="e.g. Interstellar (2014)"
      className="mt-1.5 w-full rounded-[5px] border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ring disabled:opacity-60"
     />
    </label>
    <label className="block text-xs">
     <span className="font-medium text-body">Details</span>
     <textarea
      required
      maxLength={2000}
      rows={4}
      disabled={busy}
      value={details}
      onChange={e=>{setDetails(e.target.value);event.current=null;}}
      placeholder={kind === "request" ? "Season, episode, release year or any helpful details…" : "Subtitle number, the line that needs fixing and your suggestion…"}
      className="mt-1.5 w-full resize-y rounded-[5px] border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ring disabled:opacity-60"
     />
    </label>
    <p className="text-[11px] leading-relaxed text-content-tertiary">Visible to the site team only. Do not include API keys or other private information. Up to 10 submissions per day.</p>
    <div className="flex flex-wrap items-center gap-3">
     <Button type="submit" disabled={busy||!name.trim()||!details.trim()}>{busy?"Sending…":"Send"}</Button>
     {message&&<p role="status" className="text-xs text-body">{message}</p>}
    </div>
    {login&&<a className="block text-xs text-primary underline underline-offset-4" href={`${API}/subnexa-auth/login`} onClick={(event) => { event.preventDefault(); openAuthPopup(`${API}/subnexa-auth/login`); }}>Sign in with Google</a>}
   </form>
  </section>
 );
}
