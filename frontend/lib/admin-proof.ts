"use client";
let proof = "";
let expires = 0;
let adminSessionUntil = 0;
export function clearAdminProof() { proof = ""; expires = 0; }
export function clearAdminSession() { adminSessionUntil = 0; clearAdminProof(); }
export function markAdminSession() { adminSessionUntil = Date.now() + 14 * 60 * 1000; }
export async function ensureAdminSession(key: string, requireExistingProof = false) {
  if (Date.now() < adminSessionUntil) return;
  if (requireExistingProof && !currentAdminProof()) throw new Error("Google verification expired. Verify Google again before entering your password.");
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
export function acceptAdminReturn(): string {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.has("proof") && !params.has("error")) return "";
  const expected = sessionStorage.getItem("subnexa-admin-state");
  sessionStorage.removeItem("subnexa-admin-state");
  history.replaceState(null, "", window.location.pathname + window.location.search);
  if (params.has("error")) return "Google verification failed. Unlock to retry.";
  if (!expected || params.get("state") !== expected) return "Invalid verification return. Unlock to retry.";
  const token = params.get("proof") || "";
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 4096) return "Invalid verification return.";
  proof = token; expires = Date.now() + 75000;
  return "Google verified. Enter your admin password to unlock.";
}
export function ensureAdminProof(): Promise<string> {
  if (currentAdminProof()) return Promise.resolve(proof);
  const backend = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "https://subnexa-backend-x7qa.onrender.com" : "http://localhost:8000")).replace(/\/$/, "");
  const origin = new URL(backend, window.location.origin).origin;
  const base = backend.startsWith("/") ? backend : origin;
  const state = Array.from(crypto.getRandomValues(new Uint8Array(24)), x => x.toString(16).padStart(2,"0")).join("");
  sessionStorage.setItem("subnexa-admin-state", state);
  window.location.assign(`${base}/subnexa-auth/admin/handoff?state=${encodeURIComponent(state)}&origin=${encodeURIComponent(window.location.origin)}`);
  return new Promise<string>(() => {});
}
