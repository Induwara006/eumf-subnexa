"use client";
import { useEffect, useState } from "react";

export default function AdminVerifyPage() {
  const [status, setStatus] = useState("Completing secure administrator verification…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("proof") || "";
    const state = params.get("state") || "";
    const error = params.get("error") || "";
    window.history.replaceState(null, "", "/admin/verify");
    const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("subnexa-admin-verify-v6") : null;
    const payload = error ? {type:"subnexa-admin-oauth-error",code:error} : {type:"subnexa-admin-proof",token,state};
    if (!error && (!/^[A-Za-z0-9_-]{16,96}$/.test(state) || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))) {
      setStatus("Invalid Google verification result. Close this window and retry from /admin.");
      channel?.close(); return;
    }
    let acknowledged = false;
    if (channel) channel.onmessage = event => {
      if (event.data?.type === "subnexa-admin-ack" && event.data.state === state) {
        acknowledged = true;
        setStatus("Verification received. You can close this window.");
        window.close();
      }
    };
    const deliver = () => {
      if (acknowledged) return;
      channel?.postMessage(payload);
      if (window.opener && !window.opener.closed) window.opener.postMessage(payload, window.location.origin);
    };
    deliver();
    const repeat = window.setInterval(deliver, 700);
    const stop = window.setTimeout(() => {
      window.clearInterval(repeat);
      if (!acknowledged) setStatus(error ? `Google verification failed: ${error}. Close this popup and retry.` : "Verification finished but the admin tab has not acknowledged it. Return to the admin tab and retry.");
    }, 20000);
    return () => {window.clearInterval(repeat); window.clearTimeout(stop); channel?.close();};
  }, []);
  return <main style={{fontFamily:"sans-serif",padding:24,background:"#101010",color:"white",minHeight:"100vh"}}><h2>SubNexa admin verification</h2><p>{status}</p></main>;
}
