"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
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
import { cn } from "@/lib/utils";

type Session = {
  signed_in: boolean;
  connected: boolean;
  provider?: "gemini" | "cloudflare" | "gemini_cloudflare";
  primary_configured?: boolean | null;
  backup_configured?: boolean | null;
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
      setError("");
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
      await refresh();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Could not log out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const connectedTone = session?.connected ? "text-success" : "text-warning";

  return (
    <div className="space-y-5">
      {!session?.signed_in ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-background/40 p-4">
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
          <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
              {(session.name || session.email || "G").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session.name || session.email}</p>
              {session.email && session.name && <p className="truncate text-[11px] text-muted-foreground">{session.email}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn("h-5 gap-1 border-border/80 px-2 text-[10px] font-normal", connectedTone)}
                >
                  <span className={cn("size-1.5 rounded-full", session.connected ? "bg-success" : "bg-warning")} />
                  {session.connected ? "Connected" : "Not connected"}
                </Badge>
                <Badge variant="outline" className="h-5 border-border/80 px-2 text-[10px] font-normal text-muted-foreground">
                  {session.provider === "gemini_cloudflare" ? "Gemini + Cloudflare" : session.provider === "cloudflare" ? "Cloudflare" : "Gemini"}
                </Badge>
              </div>
            </div>
          </div>

          {session.provider === "gemini_cloudflare" ? (
            <div className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
              <p className={cn("flex items-center gap-1.5", connectedTone)}>
                <CheckCircle2 className="size-3.5" />
                Gemini primary / Cloudflare backup: {session.connected ? "Configured" : "Not configured"}
              </p>
              <p>Gemini primary: <strong className="text-foreground">{session.primary_configured ? "Configured" : "Not configured"}</strong>.</p>
              <p>Cloudflare backup: <strong className="text-foreground">{session.backup_configured ? "Configured" : "Not configured"}</strong>.</p>
              <p>When Gemini is temporarily unavailable, SubNexa automatically continues using Cloudflare. Completed subtitle lines remain saved; no provider balance is assumed.</p>
            </div>
          ) : session.provider === "cloudflare" ? (
            <div className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
              <p className={cn("flex items-center gap-1.5", connectedTone)}>
                <Cloud className="size-3.5" />
                Cloudflare Workers AI (server-managed): {session.connected ? "Configured" : "Not configured"}
              </p>
              <p>Google Login keeps translation jobs private. This provider uses the site&apos;s shared daily allocation, not a personal Gemini key.</p>
              <p>Remaining Cloudflare Neurons: <strong className="text-foreground">Not verified</strong>. Live access is tested only by an actual translation request.</p>
              <p>Cloudflare setup is performed securely on the backend. No provider token is collected in the browser.</p>
            </div>
          ) : session.connected ? (
            <div className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
              <p className="flex items-center gap-1.5 text-success"><CheckCircle2 className="size-3.5" />Your Google Cloud Gemini key is connected.</p>
              <p>Project: <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground">{session.project_id}</code></p>
              <p>Remaining quota: <strong className="text-foreground">Not verified by SubNexa</strong>.</p>
              <p>Google measures rate limits per project and model. View exact limits in your own Google AI Studio dashboard.</p>
              <Button asChild variant="outline" size="sm" className="mt-1 h-8 gap-1.5 text-xs">
                <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />Open Google AI Studio
                </a>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Connect an <strong className="text-foreground">existing Google Cloud project you own</strong>. Google will ask for separate Cloud permissions before creating a Gemini key. This is for eligible adults only.
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
                    I agree to Google&apos;s Gemini API terms and explicitly authorize creation of a key in my Cloud project.
                  </Label>
                </div>
                <div className="flex items-start gap-2.5">
                  <Checkbox id="subnexa-costs" checked={costs} onCheckedChange={value => setCosts(value === true)} className="mt-0.5" />
                  <Label htmlFor="subnexa-costs" className="text-[11px] font-normal leading-relaxed text-muted-foreground">
                    I understand this can consume my project quota and might incur charges if my project has billing enabled.
                  </Label>
                </div>
              </div>
              <Button
                size="lg"
                className="h-10 w-full gap-2"
                disabled={busy || !eligible || !terms || !costs || !projectId.trim()}
                onClick={connect}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {busy ? "Connecting…" : "Authorize Cloud & Create Key"}
              </Button>
            </div>
          )}

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
        API secrets remain server-side. Google Cloud admin permissions are not granted by Google Login alone.
      </p>
    </div>
  );
}
