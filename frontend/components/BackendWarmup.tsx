"use client";
import { useEffect, useState } from "react";
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");
export default function BackendWarmup() {
 const [state, setState] = useState<"checking"|"ready"|"starting">("checking");
 useEffect(() => {
   let active = true; let timer: ReturnType<typeof setTimeout> | undefined;
   let controller: AbortController | undefined;
   const probe = async (attempt: number) => {
     const current = new AbortController();
     controller = current;
     const timeout = setTimeout(() => current.abort(), 8000);
     try {
       const response = await fetch(`${API}/health`, { cache: "no-store", credentials: "omit", signal: current.signal });
       if (response.ok) { if (active) setState("ready"); return; }
     } catch { /* Server may still be waking. */ } finally { clearTimeout(timeout); }
     if (!active) return;
     setState("starting");
     if (attempt < 9) timer = setTimeout(() => void probe(attempt+1), Math.min(2000 + attempt*2000, 12000));
   };
   void probe(0);
   return () => { active = false; clearTimeout(timer); controller?.abort(); };
 }, []);
 if (state !== "starting") return null;
 return <div role="status" className="fixed bottom-4 left-4 z-[100] max-w-sm rounded-xl border border-amber-400/30 bg-[#202020] px-4 py-3 text-sm text-white shadow-xl">Server is starting… Translation and account actions may take a moment. We’ll retry automatically. <button className="ml-2 underline" onClick={() => window.location.reload()}>Retry</button></div>;
}
