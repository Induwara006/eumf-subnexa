"use client";
import {useEffect, useState} from "react";
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");
type Stats = {completed_files: number; tracking_since: string};
export default function ProfileTranslationStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState("Loading translation statistics…");
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function refresh() {
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal;
      try {
        const r = await fetch(`${API}/profile/stats`, {credentials:"include",cache:"no-store",signal});
        if (!active || signal.aborted) return;
        if (r.status === 401) {setStats(null);setSignedOut(true);return;}
        if (!r.ok) throw new Error();
        const value: Stats = await r.json();
        if (!active || signal.aborted) return;
        if (!Number.isSafeInteger(value.completed_files) || value.completed_files < 0 || !Number.isFinite(Date.parse(value.tracking_since))) throw new Error();
        setSignedOut(false);setStats(value);setStatus("");
      } catch {
        if (active && !signal.aborted) {setStats(null);setStatus("Translation statistics are temporarily unavailable.");}
      }
    }
    function sessionChanged() {setStats(null);setStatus("Loading translation statistics…");void refresh();}
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("subnexa-library-updated", refresh);
    window.addEventListener("subnexa-session-changed", sessionChanged);
    return () => {active=false;controller?.abort();window.removeEventListener("focus",refresh);window.removeEventListener("subnexa-library-updated",refresh);window.removeEventListener("subnexa-session-changed",sessionChanged);};
  }, []);
  if (signedOut) return null;
  return <section className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4" aria-label="Your translation statistics">
    <h3 className="text-sm font-semibold">Completed subtitle files</h3>
    {stats ? <><p className="mt-2 text-3xl font-bold text-primary">{stats.completed_files.toLocaleString()}</p>
      <p className="mt-2 text-xs text-muted-foreground">Recorded since {new Date(stats.tracking_since).toLocaleDateString("en-GB", {timeZone:"Asia/Colombo"})}. Earlier translations are not included.</p>
      <p className="mt-1 text-xs text-muted-foreground">Completed translations only. Resuming or exporting the same translation again does not add another file.</p></> : <p role="status" className="mt-2 text-xs text-muted-foreground">{status}</p>}
  </section>;
}
