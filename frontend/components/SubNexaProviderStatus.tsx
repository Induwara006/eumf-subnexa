"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Connection = {
  signed_in: boolean;
  connected: boolean;
  provider?: "gemini" | "cloudflare" | "gemini_cloudflare";
  primary_configured?: boolean | null;
  backup_configured?: boolean | null;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    : kind === "connected" ? (connection?.provider === "gemini_cloudflare" ? "Gemini + Cloudflare backup configured" : connection?.provider === "cloudflare" ? "Cloudflare configured (unverified)" : "AI project connected") : "AI provider not connected";
  const explanation = kind === "checking" ? "Checking your account securely…"
    : kind === "offline" ? "Check that the FastAPI backend is running and the API URL is correct."
    : kind === "signed-out" ? "Sign in with Google using the account panel to access your workspace."
    : kind === "connected" ? (connection?.provider === "gemini_cloudflare"
      ? "Gemini is primary; Cloudflare takes over on temporary outages. Live quota is not verified."
      : connection?.provider === "cloudflare"
      ? "Cloudflare server token is configured, but live model access and quota are not yet verified."
      : "A project key is stored. Actual model access is checked when you translate.")
    : (connection?.provider === "cloudflare"
      ? "Cloudflare credentials are missing on the backend; translation cannot start yet."
      : "Google Login succeeded, but no usable translation key is linked to this account. Translation cannot start yet.");
  const providerLabel = connection?.provider === "gemini_cloudflare"
    ? "Gemini + Cloudflare"
    : connection?.provider === "cloudflare" ? "Cloudflare" : "Gemini";

  return (
    <Alert
      aria-label="AI provider connection status"
      aria-live="polite"
      className={cn(
        "flex flex-col gap-3 border-white/10 bg-[#181818] py-3 pr-3 sm:flex-row sm:items-center sm:justify-between",
        kind === "connected" && "border-success/30",
        (kind === "offline" || kind === "disconnected") && "border-warning/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          kind === "checking" && "animate-pulse bg-warning",
          kind === "connected" && "bg-success",
          (kind === "offline" || kind === "disconnected") && "bg-warning",
          kind === "signed-out" && "bg-muted-foreground/60",
        )} />
        <div className="min-w-0">
          <AlertTitle className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {heading}
            {!checking && connection?.signed_in && (
              <Badge variant="outline" className="h-4 border-white/20 px-1.5 text-[9px] font-normal text-muted-foreground">
                {providerLabel}
              </Badge>
            )}
          </AlertTitle>
          <AlertDescription className="mt-1 text-[11px] leading-relaxed">{explanation}</AlertDescription>
          {!checking && connection?.signed_in && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Remaining provider allowance:{" "}
              <span className="text-foreground">
                {typeof connection.remaining_credits === "number" && Number.isFinite(connection.remaining_credits)
                  ? connection.remaining_credits : "Not verified"}
              </span>
              {connection.connected && connection.project_id ? ` · Project: ${connection.project_id}` : ""}
            </p>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 shrink-0 gap-1 self-start text-[11px] sm:self-auto"
        onClick={() => { void refresh(); }}
        disabled={checking}
        aria-label="Recheck AI connection"
      >
        {checking ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
        {checking ? "Checking…" : "Check again"}
      </Button>
    </Alert>
  );
}
