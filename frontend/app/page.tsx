"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Landing from "../components/Landing";
const Studio = dynamic(() => import("./Studio"), { loading: () => <div className="dark framer-landing grid min-h-screen place-items-center bg-background p-8 text-body" role="status">Opening your studio…</div>, ssr: false });
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");
type Session = { signed_in?: boolean; name?: string; email?: string };
export default function Home() {
 const [session,setSession] = useState<Session | null>(null);
 // subnexa-presence-cap-v1
 const [admissionMessage,setAdmissionMessage] = useState("");
 useEffect(() => {
   const code = new URLSearchParams(window.location.search).get("subnexa_error");
   if (code === "system_busy") setAdmissionMessage("System busy. Try again later.");
   if (code === "users_unavailable") setAdmissionMessage("Account registration temporarily unavailable. Please sign in again shortly.");
   if (code === "account_blocked") setAdmissionMessage("This account is blocked. Contact the site administrator.");
   if (code === "presence_unavailable") setAdmissionMessage("Login temporarily unavailable. Try again later.");
 }, []);
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
 return <>{admissionMessage && <div role="alert" className="fixed inset-x-4 top-4 z-[9999] mx-auto max-w-md rounded-xl border border-amber-500 bg-background p-4 text-center text-ink shadow-xl">{admissionMessage}</div>}{session?.signed_in ? <Studio initialSession={session} /> : <Landing />}</>;
}
