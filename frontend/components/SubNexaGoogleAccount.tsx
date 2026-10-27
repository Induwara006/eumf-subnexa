"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Session = {
  signed_in: boolean;
  connected: boolean;
  provider?: "gemini" | "cloudflare" | "gemini_cloudflare";
  primary_configured?: boolean | null;
  backup_configured?: boolean | null;
  name?: string;
  email?: string;
  project_id?: string | null;
  personal_key_connected?: boolean;
  personal_project_id?: string | null;
  remaining_credits?: number | null;
  quota_notice?: string;
};

// Use the same-origin Vercel proxy in production, matching app/page.tsx.
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL ||
  (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");

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
      setError("");
    } catch {
      setError("Cannot connect to the authentication server.");
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
      const data: unknown = await response.json().catch(() => null);
      if (typeof data !== "object" || data === null) {
        throw new Error(response.ok
          ? "The authentication server returned an invalid authorization response."
          : "Cloud authorization failed");
      }
      if (!response.ok) {
        const detail = "detail" in data ? data.detail : null;
        throw new Error(typeof detail === "string" ? detail : "Cloud authorization failed");
      }
      if (!("authorize_url" in data) || typeof data.authorize_url !== "string") {
        throw new Error("The authentication server returned an invalid authorization URL.");
      }
      window.location.assign(data.authorize_url);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Cannot connect to Google Cloud");
    } finally {
      setBusy(false);
    }
  }

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
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
              {(session.name || session.email || "G").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session.name || session.email}</p>
              {session.email && session.name && <p className="truncate text-[11px] text-muted-foreground">{session.email}</p>}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <span className="text-sm font-medium">Your Google Cloud project</span>
              <Badge variant="outline" className="text-[10px]">
                {session.personal_key_connected ? "Connected" : "Not connected"}
              </Badge>
            </div>
            {session.personal_key_connected ? (
              <div className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
                <p className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-3.5" /> Your authorized project is recorded.
                </p>
                {session.personal_project_id && <p>
                  Project: <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-foreground">{session.personal_project_id}</code>
                </p>}
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />Open Google AI Studio
                  </a>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Eligible adults can separately authorize an existing Google Cloud project they own.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="subnexa-project-id" className="text-[11px]">Your Google Cloud project ID</Label>
                  <Input
                    id="subnexa-project-id"
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                    placeholder="my-google-project-123"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Checkbox id="subnexa-eligible" checked={eligible} onCheckedChange={value => setEligible(value === true)} className="mt-0.5" />
                    <Label htmlFor="subnexa-eligible" className="text-[11px] font-normal leading-relaxed text-muted-foreground">
                      I am 18+ and eligible to use the Gemini API.
                    </Label>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Checkbox id="subnexa-terms" checked={terms} onCheckedChange={value => setTerms(value === true)} className="mt-0.5" />
                    <Label htmlFor="subnexa-terms" className="text-[11px] font-normal leading-relaxed text-muted-foreground">
                      I agree to the applicable Gemini API terms and authorize key creation in my Cloud project.
                    </Label>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Checkbox id="subnexa-costs" checked={costs} onCheckedChange={value => setCosts(value === true)} className="mt-0.5" />
                    <Label htmlFor="subnexa-costs" className="text-[11px] font-normal leading-relaxed text-muted-foreground">
                      I understand my project&apos;s usage may count toward quotas or incur charges if billing is enabled.
                    </Label>
                  </div>
                </div>
                <Button size="lg" className="h-10 w-full gap-2"
                  disabled={busy || !eligible || !terms || !costs || !projectId.trim()}
                  onClick={connect}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  {busy ? "Connecting…" : "Authorize Cloud & Create Key"}
                </Button>
              </div>
            )}
          </div>

          <Separator />

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
