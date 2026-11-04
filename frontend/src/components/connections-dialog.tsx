"use client";

import { CheckCircle2, Link2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getMainnetReadiness, listConnectors, type ConnectorSummary, type MainnetReadiness } from "@/lib/donads-api";

export function ConnectionsDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [connectors, setConnectors] = useState<ConnectorSummary[] | null>(null);
  const [readiness, setReadiness] = useState<MainnetReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [apps, mainnet] = await Promise.all([listConnectors(), getMainnetReadiness()]);
      setConnectors(apps);
      setReadiness(mainnet);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connection status could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    void load();
  }, []);

  return <dialog ref={ref} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-sm">
    <div className="flex items-start gap-3 border-b border-border p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Link2 className="size-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold tracking-tight">Apps and launch readiness</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Connections cannot sign transactions or approve financial actions.</p></div><button type="button" aria-label="Close apps and readiness" onClick={onClose} className="grid size-10 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><X className="size-4" aria-hidden="true" /></button></div>
    <div className="max-h-[72dvh] space-y-7 overflow-y-auto p-5">
      {loading ? <div className="space-y-3" aria-label="Loading connection status">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}</div> : null}
      {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"><p className="text-sm font-medium text-destructive">Couldn&apos;t load connection status</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{error}</p><button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><RefreshCw className="size-4" aria-hidden="true" />Try again</button></div> : null}
      {!loading && !error && connectors ? <section aria-labelledby="connected-apps-title"><div className="flex items-baseline justify-between gap-3"><h3 id="connected-apps-title" className="text-sm font-semibold">Connected apps</h3><span className="text-xs text-muted-foreground">Least privilege</span></div><ul className="mt-3 grid gap-2 sm:grid-cols-2">{connectors.map((connector) => <li key={connector.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{connector.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{connector.purpose}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${connector.configured ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{connector.configured ? "Server ready" : "Setup required"}</span></div><p className="mt-3 text-[11px] leading-5 text-muted-foreground">{connector.capabilities.join(" · ")}</p>{!connector.configured ? <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Missing server placeholders: {connector.required_environment.join(", ")}</p> : <p className="mt-2 text-[11px] leading-5 text-muted-foreground">OAuth activation remains disabled until callback and encrypted-token tests pass.</p>}</li>)}</ul></section> : null}
      {!loading && !error && readiness ? <section aria-labelledby="mainnet-title"><div className="flex items-center gap-2"><ShieldAlert className="size-4" aria-hidden="true" /><h3 id="mainnet-title" className="text-sm font-semibold">Mainnet gate</h3><span className="ml-auto rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">Disabled</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Mainnet cannot be enabled from this screen. Every gate needs independent evidence.</p><ul className="mt-3 space-y-2">{readiness.gates.map((gate) => <li key={gate.id} className="flex items-start gap-3 rounded-xl border border-border p-3">{gate.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> : <span className="mt-1 size-3 shrink-0 rounded-full border border-border" aria-hidden="true" />}<div><p className="text-xs font-medium">{gate.title}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{gate.evidence}</p></div></li>)}</ul></section> : null}
    </div>
  </dialog>;
}
