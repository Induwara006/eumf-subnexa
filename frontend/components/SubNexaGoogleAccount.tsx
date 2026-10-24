"use client";

import { useCallback, useEffect, useState } from "react";

type Session = {
  signed_in: boolean;
  connected: boolean;
  name?: string;
  email?: string;
  project_id?: string | null;
  remaining_credits?: number | null;
  quota_notice?: string;
};

// Use localhost consistently on both ends for local cookie auth.
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || "http://localhost:8000").replace(/\/$/, "");

export default function SubNexaGoogleAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [projectId, setProjectId] = useState("");
  const [eligible, setEligible] = useState(false);
  const [terms, setTerms] = useState(false);
  const [costs, setCosts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await fetch(`${API}/subnexa-auth/session`, {
        credentials: "include", cache: "no-store"
      });
      if (!result.ok) throw new Error("Login server is not available");
      setSession(await result.json());
    } catch {
      setError("Cannot connect to the authentication server.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/subnexa-auth/connect/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId.trim(), eligible_adult: eligible,
          accepts_terms: terms, acknowledges_costs: costs,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Cloud authorization failed");
      // This is generated server-side and always points to Google's OAuth consent.
      window.location.assign(data.authorize_url);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Cannot connect to Google Cloud");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch(`${API}/subnexa-auth/logout`, {
      method: "POST", credentials: "include"
    });
    setSession(null);
    void refresh();
  }

  return (
    <section style={{ background: "#201329", color: "#f8e9ff", border: "1px solid #6a437c",
      borderRadius: 16, padding: 20, maxWidth: 600, margin: "20px auto" }}>
      <h2 style={{ marginTop: 0 }}>SubNexa · Google Account</h2>
      {!session?.signed_in ? (
        <>
          <p>Sign in to manage your personal SubNexa workspace.</p>
          <a href={`${API}/subnexa-auth/login`} style={buttonStyle}>Continue with Google</a>
        </>
      ) : (
        <>
          <p>Signed in: <strong>{session.name || session.email}</strong></p>
          {session.connected ? (
            <>
              <p style={{ color: "#b1f4d0" }}>✓ Your Google Cloud Gemini key is connected.</p>
              <p>Project: <code>{session.project_id}</code></p>
              <p>Remaining quota: <strong>Not verified by SubNexa</strong>.</p>
              <p>Google measures rate limits per project and model. View exact limits
                in your own Google AI Studio dashboard.</p>
              <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={buttonStyle}>
                Open Google AI Studio
              </a>
            </>
          ) : (
            <>
              <p>Connect an <strong>existing Google Cloud project you own</strong>.
                Google will ask for separate Cloud permissions before creating a Gemini key.
                This is for eligible adults only.</p>
              <label style={{ display: "block", marginBottom: 8 }}>
                Your Google Cloud project ID
                <input value={projectId} onChange={e => setProjectId(e.target.value)}
                  placeholder="my-google-project-123" style={{ display: "block", width: "100%",
                    padding: 10, marginTop: 6, borderRadius: 8, color: "#222" }} />
              </label>
              <label style={checkStyle}><input type="checkbox" checked={eligible}
                onChange={e => setEligible(e.target.checked)} /> I am 18+ and eligible to use the Gemini API.</label>
              <label style={checkStyle}><input type="checkbox" checked={terms}
                onChange={e => setTerms(e.target.checked)} /> I agree to Google's Gemini API terms and explicitly authorize creation of a key in my Cloud project.</label>
              <label style={checkStyle}><input type="checkbox" checked={costs}
                onChange={e => setCosts(e.target.checked)} /> I understand this can consume my project quota and might incur charges if my project has billing enabled.</label>
              <button style={buttonStyle} disabled={busy || !eligible || !terms || !costs || !projectId.trim()}
                onClick={connect}>{busy ? "Connecting…" : "Authorize Cloud & Create Key"}</button>
            </>
          )}
          <button onClick={logout} style={{ marginLeft: 12, color: "#e8d4ee" }}>Log out</button>
        </>
      )}
      {error && <p role="alert" style={{ color: "#ff9aa4" }}>{error}</p>}
      <small style={{ display: "block", color: "#c7abc8", marginTop: 12 }}>
        API secrets remain server-side. Google Cloud admin permissions are not granted by Google Login alone.
      </small>
    </section>
  );
}

const buttonStyle: React.CSSProperties = {
  display: "inline-block", background: "#d52c61", color: "white", border: 0,
  borderRadius: 30, padding: "10px 20px", cursor: "pointer", textDecoration: "none",
};
const checkStyle: React.CSSProperties = { display: "block", margin: "10px 0", lineHeight: 1.5 };
