"use client";
import { useEffect } from "react";
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");
export default function UserPresence() {
  useEffect(() => {
    let ended = false, running = false, retryAt = 0;
    let controller: AbortController | null = null;
    const tick = async () => {
      if (ended || running || document.visibilityState !== "visible" || Date.now() < retryAt) return;
      running = true; controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch(`${API}/subnexa-auth/session`, {credentials:"include",cache:"no-store",signal:controller.signal});
        if (!response.ok || ended || document.visibilityState !== "visible") return;
        const session = await response.json();
        if (!session.signed_in) return;
        const ping = await fetch(`${API}/subnexa-auth/presence/ping`, {method:"POST",credentials:"include",cache:"no-store",signal:controller.signal});
        if (ping.status === 429) retryAt = Date.now() + 60000;
      } catch { /* Presence must never interrupt the site. */ }
      finally { window.clearTimeout(timeout); running = false; }
    };
    const visibility = () => { if (document.hidden) controller?.abort(); else void tick(); };
    void tick();
    const timer = window.setInterval(() => void tick(), 30000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("subnexa-session-changed", tick);
    return () => { ended = true; controller?.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("subnexa-session-changed", tick); };
  }, []);
  return null;
}
