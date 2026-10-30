"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Landing from "../components/Landing";
const Studio = dynamic(() => import("./Studio"), { loading: () => <div className="min-h-screen bg-[#141414] p-8 text-white" role="status">Opening your studio…</div>, ssr: false });
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");
type Session = { signed_in?: boolean; name?: string; email?: string };
export default function Home() {
 const [session,setSession] = useState<Session | null>(null);
 useEffect(() => {
  let cancelled = false;
  let active = false;
  const controller = new AbortController();
  const check = async () => {
   if (active) return;
   active = true;
   try {
    const response = await fetch(`${API}/subnexa-auth/session`, {credentials:"include", cache:"no-store", signal:controller.signal});
    if (!response.ok) { if (response.status === 401 && !cancelled) setSession(null); return; }
    const result = await response.json();
    if (!cancelled) setSession(result);
   } catch { /* Keep the landing page or existing studio during a network outage. */ }
   finally { active = false; }
  };
  void check();
  window.addEventListener("focus",check); window.addEventListener("subnexa-session-changed",check);
  return () => {cancelled=true;controller.abort();window.removeEventListener("focus",check);window.removeEventListener("subnexa-session-changed",check);};
 },[]);
 return session?.signed_in ? <Studio initialSession={session} /> : <Landing />;
}
