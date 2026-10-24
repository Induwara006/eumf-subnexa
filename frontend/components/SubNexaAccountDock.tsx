"use client";

import { useEffect, useId, useState } from "react";
import SubNexaGoogleAccount from "./SubNexaGoogleAccount";

/**
 * Visual-only wrapper around the existing V4.2 Google Account component.
 * Does not change its OAuth, credentials, session, or translation logic.
 */
export default function SubNexaAccountDock() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="sn-account-dock">
      {!open && (
        <button
          className="sn-account-trigger"
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls={panelId}
          aria-label="Open Google account panel"
          title="Google account"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M4.5 20c.25-4.1 3.1-6.4 7.5-6.4s7.25 2.3 7.5 6.4" />
          </svg>
          <span>Google account</span>
          <span className="sn-account-trigger-arrow" aria-hidden="true">‹</span>
        </button>
      )}

      {open && (
        <>
          <button
            className="sn-account-scrim"
            type="button"
            tabIndex={-1}
            aria-label="Close Google account panel"
            onClick={() => setOpen(false)}
          />
          <aside className="sn-account-sidebar" id={panelId} role="dialog" aria-modal="true" aria-label="Google account">
            <div className="sn-account-sidebar-head">
              <div className="sn-account-sidebar-title">
                <span className="sn-account-identity-icon" aria-hidden="true">G</span>
                <div>
                  <strong>Google account</strong>
                  <small>SubNexa workspace</small>
                </div>
              </div>
              <button className="sn-account-close" type="button" onClick={() => setOpen(false)} aria-label="Close account panel" title="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
              </button>
            </div>
            <div className="sn-account-sidebar-body">
              <SubNexaGoogleAccount />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
