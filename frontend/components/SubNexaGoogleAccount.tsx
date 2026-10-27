"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Session = {
  signed_in: boolean;
  name?: string;
  email?: string;
};

// Use the same-origin Vercel proxy in production, matching app/page.tsx.
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL ||
  (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");

export default function SubNexaGoogleAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await fetch(`${API}/subnexa-auth/session`, {
        credentials: "include", cache: "no-store"
      });
      if (!result.ok) throw new Error("Login server is not available");
      setSession(await result.json());
      setError("");
    } catch {
      setError("Cannot connect to the authentication server.");
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/subnexa-auth/logout`, {
        method: "POST", credentials: "include"
      });
      if (!response.ok) throw new Error("Could not log out. Please try again.");
      setSession(null);
      window.dispatchEvent(new Event("subnexa-session-changed"));
      await refresh();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Could not log out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {!session?.signed_in ? (
        <div className="space-y-4">
          <div className="rounded-[4px] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-primary" />Private translation workspace
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Sign in to manage your personal SubNexa workspace. Translation jobs stay tied to your account.
            </p>
          </div>
          <Button asChild size="lg" className="h-10 w-full gap-2">
            <a href={`${API}/subnexa-auth/login`}>
              <KeyRound className="size-4" />Continue with Google
            </a>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-[4px] border border-white/10 bg-white/5 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
              <UserRound className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session.name || session.email}</p>
              {session.email && session.name && <p className="truncate text-[11px] text-muted-foreground">{session.email}</p>}
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-[4px] border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <p>Your account only links translation jobs to this workspace.</p>
          </div>

          <Button variant="outline" size="sm" className="h-8 w-full gap-2 text-xs" onClick={logout} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
            {busy ? "Please wait…" : "Log out"}
          </Button>
        </>
      )}

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-[11px]">{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Your Google account is used only to keep translation jobs tied to your workspace.
      </p>
    </div>
  );
}
