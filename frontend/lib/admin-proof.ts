"use client";
let proof = "";
let expires = 0;
let pending: Promise<string> | null = null;
let adminSessionUntil = 0;
export function clearAdminProof() { proof = ""; expires = 0; }
export function clearAdminSession() { adminSessionUntil = 0; clearAdminProof(); }
export function markAdminSession() { adminSessionUntil = Date.now() + 14 * 60 * 1000; }
export async function ensureAdminSession(key: string) {
  if (Date.now() < adminSessionUntil) return;
  await ensureAdminProof();
  const response = await fetch("/api/library/admin/check", {method:"POST",headers:adminProofHeaders(key)});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {clearAdminSession(); throw new Error(result.detail || "Admin verification failed.");}
  clearAdminProof(); markAdminSession();
}
export function currentAdminProof() { return Date.now() < expires ? proof : ""; }
export function adminProofHeaders(key: string): Record<string,string> {
  return {"X-Library-Admin-Key": key, "X-SubNexa-Admin-Proof": currentAdminProof()};
}
export function ensureAdminProof(): Promise<string> {
  if (currentAdminProof()) return Promise.resolve(proof);
  if (pending) return pending;
  const backend = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "https://subnexa-backend-x7qa.onrender.com" : "http://localhost:8000")).replace(/\/$/, "");
  const origin = new URL(backend.startsWith("http") ? backend : "https://subnexa-backend-x7qa.onrender.com").origin;
  const state = Array.from(crypto.getRandomValues(new Uint8Array(24)), x => x.toString(16).padStart(2,"0")).join("");
  const popup = window.open(`${origin}/subnexa-auth/admin/handoff?state=${encodeURIComponent(state)}&origin=${encodeURIComponent(window.location.origin)}`, "subnexa-admin-verify", "width=540,height=660");
  if (!popup) return Promise.reject(new Error("Allow popups to verify your Google admin login."));
  pending = new Promise<string>((resolve,reject) => {
    const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("subnexa-admin-verify-v6") : null;
    let timeout: number;
    let finished = false;
    const finish = (err?: Error, token?: string) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", onWindowMessage);
      channel?.close();
      clearTimeout(timeout);
      pending = null;
      if (err) reject(err); else resolve(token!);
    };
    const accept = (data: any) => {
      if (data?.type === "subnexa-admin-oauth-error") { finish(new Error("Google verification failed: " + String(data.code || "unknown"))); return; }
      if (data?.type !== "subnexa-admin-proof" || data.state !== state || typeof data.token !== "string") return;
      proof = data.token; expires = Date.now() + 75000;
      channel?.postMessage({ type: "subnexa-admin-ack", state });
      finish(undefined, proof);
    };
    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== popup || (event.origin !== origin && event.origin !== window.location.origin)) return;
      accept(event.data);
    };
    if (channel) channel.onmessage = event => accept(event.data);
    window.addEventListener("message", onWindowMessage);
    timeout = window.setTimeout(() => finish(new Error("Admin verification did not arrive. Check the verification popup.")), 60000);
  });
  return pending;
}
