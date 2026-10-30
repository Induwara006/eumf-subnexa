"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");
export default function CommunityForm({kind,title=""}:{kind:"request"|"report";title?:string}) {
 const [open,setOpen]=useState(false),[name,setName]=useState(title),[details,setDetails]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[login,setLogin]=useState(false);
 const event = useRef<string | null>(null);
 const label = kind === "request" ? "Request a subtitle" : "Report a translation issue";
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
 return <><Button variant="outline" onClick={()=>{setName(title);setOpen(true);}}>{label}</Button>
 <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent className="max-h-[85dvh] overflow-y-auto">
 <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>{kind === "request" ? "Tell us the movie or series, year, season and episode. Requests are reviewed; delivery is not guaranteed." : "Include the subtitle number, original English line, current Sinhala line and your suggested correction. Reports are reviewed before glossary changes."}</DialogDescription></DialogHeader>
 <form onSubmit={submit} className="space-y-4">
 <label className="block text-sm">Movie or series title<input required maxLength={160} disabled={busy} value={name} onChange={e=>{setName(e.target.value);event.current=null;}} className="mt-2 w-full rounded border border-white/20 bg-black/30 p-3" /></label>
 <label className="block text-sm">Details<textarea required maxLength={2000} rows={5} disabled={busy} value={details} onChange={e=>{setDetails(e.target.value);event.current=null;}} className="mt-2 w-full rounded border border-white/20 bg-black/30 p-3" /></label>
 <p className="text-xs text-muted-foreground">Visible to the site team only. Do not include API keys or other private information. Up to 10 submissions per day.</p>
 <Button type="submit" disabled={busy||!name.trim()||!details.trim()}>{busy?"Sending…":"Send"}</Button>
 {message&&<p role="status" className="text-sm">{message}</p>}
 {login&&<a className="block underline" href={`${API}/subnexa-auth/login`}>Sign in with Google</a>}
 </form></DialogContent></Dialog></>;
}
