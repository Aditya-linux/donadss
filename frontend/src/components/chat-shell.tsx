"use client";

import {
  Menu,
  CircleDollarSign,
  Megaphone,
  MessageSquarePlus,
  Radar,
  ShoppingBag,
  Workflow,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";

import { GrowthWorkspace } from "@/components/growth-workspace";
import { CommerceWorkspace } from "@/components/commerce-workspace";
import { FlowWorkspace } from "@/components/flow-workspace";
import { MascotMark } from "@/components/mascot";
import { OperatorWorkspace } from "@/components/operator-workspace";
import { ScoutWorkspace } from "@/components/scout-workspace";
import { SentinelWorkspace } from "@/components/sentinel-workspace";
import {
  createAuthChallenge,
  setAccessToken,
  verifyWalletSignature,
} from "@/lib/donads-api";

type Agent = "scout" | "commerce" | "growth" | "flow" | "operator" | "sentinel";

const agentDetails = {
  scout: { name: "Scout", badge: "Read-only", icon: Radar },
  commerce: { name: "Commerce", badge: "Crypto only", icon: ShoppingBag },
  growth: { name: "Growth", badge: "Draft only", icon: Megaphone },
  flow: { name: "Flow", badge: "Intent only", icon: CircleDollarSign },
  operator: { name: "Operator", badge: "Permission bounded", icon: Workflow },
  sentinel: { name: "Sentinel", badge: "Read-only scan", icon: ShieldCheck },
} as const;

function SpecialistButton({
  active,
  icon,
  name,
  specialty,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  name: string;
  specialty: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Open ${name} specialist`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-muted" : ""}`}
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{specialty}</span>
      </span>
      <span className="size-2 rounded-full bg-primary" aria-label="Online" />
    </button>
  );
}

function Sidebar({
  open,
  agent,
  onClose,
  onAgentChange,
  onNewTask,
}: {
  open: boolean;
  agent: Agent;
  onClose: () => void;
  onAgentChange: (agent: Agent) => void;
  onNewTask: () => void;
}) {
  return (
    <>
      {open ? (
        <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[2px] lg:hidden" onClick={onClose} />
      ) : null}
      <aside aria-label="DONADS navigation" className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card p-3 transition-transform duration-200 motion-reduce:transition-none lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-12 items-center justify-between px-2">
          <div className="flex items-center gap-2.5"><MascotMark /><span className="font-semibold tracking-tight">DONADS</span></div>
          <button type="button" aria-label="Close sidebar" onClick={onClose} className="grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:hidden"><X className="size-4" aria-hidden="true" /></button>
        </div>
        <button type="button" onClick={onNewTask} className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><MessageSquarePlus className="size-4" aria-hidden="true" />New task</button>
        <nav className="mt-6 space-y-2" aria-label="Specialists">
          <p className="px-3 pb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Specialists</p>
          <SpecialistButton active={agent === "scout"} icon={<Radar className="size-4" aria-hidden="true" />} name="Scout" specialty="Cited research" onClick={() => onAgentChange("scout")} />
          <SpecialistButton active={agent === "commerce"} icon={<ShoppingBag className="size-4" aria-hidden="true" />} name="Commerce" specialty="Crypto purchase intents" onClick={() => onAgentChange("commerce")} />
          <SpecialistButton active={agent === "growth"} icon={<Megaphone className="size-4" aria-hidden="true" />} name="Growth" specialty="Campaign drafts" onClick={() => onAgentChange("growth")} />
          <SpecialistButton active={agent === "flow"} icon={<CircleDollarSign className="size-4" aria-hidden="true" />} name="Flow" specialty="Monad transfer intents" onClick={() => onAgentChange("flow")} />
          <SpecialistButton active={agent === "operator"} icon={<Workflow className="size-4" aria-hidden="true" />} name="Operator" specialty="Task orchestration" onClick={() => onAgentChange("operator")} />
          <SpecialistButton active={agent === "sentinel"} icon={<ShieldCheck className="size-4" aria-hidden="true" />} name="Sentinel" specialty="Bytecode triage" onClick={() => onAgentChange("sentinel")} />
        </nav>
        <div className="mt-auto rounded-xl bg-muted p-3">
          <div className="flex items-center gap-2 text-xs font-medium"><Sparkles className="size-4" aria-hidden="true" />2 agents awaiting approval</div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Operator coordinates approved specialists without gaining their permissions.</p>
        </div>
      </aside>
    </>
  );
}

export function ChatShell() {
  const [agent, setAgent] = useState<Agent>("scout");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const [signedInWallet, setSignedInWallet] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const details = agentDetails[agent];
  const AgentIcon = details.icon;

  function selectAgent(next: Agent) {
    setAgent(next);
    setSidebarOpen(false);
  }

  async function signIn() {
    const provider = window.ethereum;
    if (!provider) {
      setAuthError("Install an EVM wallet to sign in.");
      return;
    }
    setSigningIn(true);
    setAuthError(null);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("The wallet did not return an account.");
      const challenge = await createAuthChallenge(address);
      const signature = (await provider.request({
        method: "personal_sign",
        params: [challenge.message, address],
      })) as string;
      const session = await verifyWalletSignature(address, signature);
      setAccessToken(session.access_token);
      setSignedInWallet(session.owner_id);
    } catch (error) {
      setAccessToken(null);
      setAuthError(error instanceof Error ? error.message : "Wallet sign-in failed.");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <Sidebar open={sidebarOpen} agent={agent} onClose={() => setSidebarOpen(false)} onAgentChange={selectAgent} onNewTask={() => { setWorkspaceKey((value) => value + 1); setSidebarOpen(false); }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center border-b border-border px-3 sm:px-5">
          <button type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="mr-2 grid size-10 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:hidden"><Menu className="size-5" aria-hidden="true" /></button>
          <div className="flex min-h-10 items-center gap-2 px-2"><AgentIcon className="size-4" aria-hidden="true" /><span className="text-sm font-semibold">{details.name}</span></div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={signIn} disabled={signingIn} className="flex min-h-9 items-center gap-2 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-60">
              <WalletCards className="size-3.5" aria-hidden="true" />
              {signedInWallet ? `${signedInWallet.slice(0, 6)}…${signedInWallet.slice(-4)}` : signingIn ? "Signing in…" : "Sign in"}
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-primary" />{details.badge}</div>
          </div>
        </header>
        {authError ? <p role="alert" className="border-b border-border px-5 py-2 text-xs text-destructive">{authError}</p> : null}
        {agent === "scout" ? <ScoutWorkspace key={`scout-${workspaceKey}`} /> : null}
        {agent === "commerce" ? <CommerceWorkspace key={`commerce-${workspaceKey}`} /> : null}
        {agent === "growth" ? <GrowthWorkspace key={`growth-${workspaceKey}`} /> : null}
        {agent === "flow" ? <FlowWorkspace key={`flow-${workspaceKey}`} /> : null}
        {agent === "operator" ? <OperatorWorkspace key={`operator-${workspaceKey}`} /> : null}
        {agent === "sentinel" ? <SentinelWorkspace key={`sentinel-${workspaceKey}`} /> : null}
      </div>
    </div>
  );
}
