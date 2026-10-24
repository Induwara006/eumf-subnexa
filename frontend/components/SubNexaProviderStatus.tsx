"use client";

import { useCallback, useEffect, useState } from "react";

type Connection = {
  signed_in: boolean;
  connected: boolean;
  project_id?: string | null;
  remaining_credits?: number | null;
};

type Props = { apiBase: string };

/** Display server-reported connection status. Does not create keys, guess credits,
 * call Gemini, or change authentication state. */
export default function SubNexaProviderStatus({ apiBase }: Props) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [checking, setChecking] = useState(true);
  const [unreachable, setUnreachable] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch(`${apiBase}/subnexa-auth/session`, {
        credentials: "include", cache: "no-store",
      });
      if (!response.ok) throw new Error("Session status unavailable");
      const info = (await response.json()) as Connection;
      if (typeof info.signed_in !== "boolean" || typeof info.connected !== "boolean") {
        throw new Error("Unexpected session response");
      }
      setConnection(info);
      setUnreachable(false);
    } catch {
      setConnection(null);
      setUnreachable(true);
    } finally {
      setChecking(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const kind = checking ? "checking" : unreachable ? "offline"
    : !connection?.signed_in ? "signed-out" : connection.connected ? "connected" : "disconnected";
  const heading = kind === "checking" ? "Checking AI connection"
    : kind === "offline" ? "Cannot check AI connection"
    : kind === "signed-out" ? "Google sign-in required"
    : kind === "connected" ? "AI project connected" : "AI provider not connected";
  const explanation = kind === "checking" ? "Checking your account securely…"
    : kind === "offline" ? "Check that the FastAPI backend is running and the API URL is correct."
    : kind === "signed-out" ? "Sign in with Google using the account panel to access your workspace."
    : kind === "connected" ? "A project key is stored. Actual model access is checked when you translate."
    : "Google Login succeeded, but no usable translation key is linked to this account. Translation cannot start yet.";

  return (
    <section className={`sn-v43-status sn-v43-${kind}`} aria-label="AI provider connection status" aria-live="polite">
      <div className="sn-v43-status-copy">
        <span className="sn-v43-dot" aria-hidden="true" />
        <div>
          <strong>{heading}</strong>
          <p>{explanation}</p>
          {!checking && connection?.signed_in && (
            <small>
              Provider: Google Gemini · Remaining provider allowance: <b>
                {typeof connection.remaining_credits === "number" && Number.isFinite(connection.remaining_credits)
                  ? connection.remaining_credits : "Not verified"}
              </b>
              {connection.connected && connection.project_id ? ` · Project: ${connection.project_id}` : ""}
            </small>
          )}
        </div>
      </div>
      <button type="button" onClick={() => { void refresh(); }} disabled={checking} aria-label="Recheck AI connection">
        {checking ? "Checking…" : "Check again"}
      </button>
    </section>
  );
}
