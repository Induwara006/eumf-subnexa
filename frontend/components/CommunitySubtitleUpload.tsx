"use client";
import { useState } from "react";
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");
export default function CommunitySubtitleUpload() {
  const [title,setTitle] = useState(""), [year,setYear]=useState(""), [file,setFile]=useState<File|null>(null);
  const [message,setMessage]=useState(""), [busy,setBusy]=useState(false), [open,setOpen]=useState(false);
  async function submit(e:React.FormEvent) {
    e.preventDefault(); if(!file || busy)return; setBusy(true);setMessage("");
    const form=new FormData();form.append("title",title);form.append("year",year);form.append("subtitle",file);
    try { const res=await fetch(`${API}/community/subtitle`,{method:"POST",body:form,credentials:"include"});const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.detail||"Upload failed.");
      setMessage("Uploaded for review. It will only appear in the library if approved.");setTitle("");setYear("");setFile(null);
    } catch(err) {setMessage(err instanceof Error?err.message:"Upload failed. Please try again.");} finally{setBusy(false);}
  }
  return <section className="rounded-xl border border-white/15 p-3 text-sm">
    <button type="button" className="underline" onClick={()=>setOpen(!open)}>{open?"Close community upload":"Submit your Sinhala subtitles for review"}</button>
    {open&&<form className="mt-3 flex flex-col gap-3" onSubmit={submit}>
      <label>Title<input required maxLength={120} className="ml-2 rounded bg-white/10 p-2" value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label>Year (optional)<input maxLength={4} className="ml-2 w-24 rounded bg-white/10 p-2" value={year} onChange={e=>setYear(e.target.value.replace(/\D/g,""))}/></label>
      <input required aria-label="Choose SRT or ASS" type="file" accept=".srt,.ass" onChange={e=>setFile(e.target.files?.[0]||null)}/>
      <p className="text-xs text-white/60">Sign in first. Only upload files you have permission to share. Limit: 3 submissions per 24 hours. Files remain private until approved.</p>
      <button disabled={busy || !file} className="w-fit rounded bg-white px-4 py-2 font-semibold text-black disabled:opacity-50">{busy?"Submitting…":"Send for review"}</button>
    </form>}
    {message&&<p role="status" className="mt-2">{message}</p>}
  </section>
}
