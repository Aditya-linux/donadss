"use client";

import { Bell, CircleDollarSign, Clock3, Coins, Gauge, Link2, Menu, Megaphone, MessageSquarePlus, Radar, ShieldCheck, ShoppingBag, WalletCards, Workflow, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MascotLoader, MascotMark, SpecialistMark } from "@/components/mascot";
import { UnifiedTaskWorkspace } from "@/components/unified-task-workspace";
import { ConnectionsDialog } from "@/components/connections-dialog";
import { createAuthChallenge, getAiUsage, getPushConfig, getTask, getWalletBalance, getWalletTokenBalances, listPendingApprovals, listTaskHistory, restoreWalletSession, revokeWalletSession, setAccessToken, type AiUsage, type Task, type TokenBalance, type WalletBalance, verifyWalletSignature } from "@/lib/donads-api";
import type { PendingApproval } from "@/lib/approvals";
import { connectWalletProvider, disconnectWalletProvider, WalletConnectionCancelledError } from "@/lib/wallet-provider";
import { currentPushSubscription, disablePushNotifications, enablePushNotifications, pushSupported } from "@/lib/push-client";

const specialists = [
  { id: "scout", name: "Scout", specialty: "Cited research", summary: "Turns supplied public sources into concise findings with traceable citations.", goodAt: ["Source comparison", "Evidence extraction", "Research briefs"], prompts: ["Compare these three protocol docs", "Summarize this proposal with citations", "Find conflicts across these sources"], icon: Radar },
  { id: "commerce", name: "Commerce", specialty: "Crypto checkout", summary: "Validates crypto-accepting offers and prepares an approval-bounded purchase workflow.", goodAt: ["Offer verification", "Exact-budget checks", "Order receipt tracking"], prompts: ["Verify this product and crypto checkout", "Compare these merchant offers", "Prepare a purchase under my MON budget"], icon: ShoppingBag },
  { id: "growth", name: "Growth", specialty: "Campaign drafts", summary: "Builds structured, review-ready campaign drafts from a goal, audience, and evidence.", goodAt: ["Campaign calendars", "Channel-specific drafts", "Brand-safe messaging"], prompts: ["Create a 7-day launch campaign", "Draft an X and LinkedIn announcement", "Turn this research into campaign copy"], icon: Megaphone },
  { id: "flow", name: "Flow", specialty: "Monad payments", summary: "Prepares an exact Monad Testnet transfer and verifies the mined receipt after wallet approval.", goodAt: ["Exact transfer intents", "Wallet confirmation", "Receipt verification"], prompts: ["Send 0.01 MON to this address", "Prepare a contributor payment", "Verify this Monad transaction"], icon: CircleDollarSign },
  { id: "operator", name: "Operator", specialty: "Cross-agent coordination", summary: "Breaks a goal into bounded specialist steps, resolves dependencies, and tracks completion.", goodAt: ["Task decomposition", "Parallel execution", "Cross-agent handoffs"], prompts: ["Research this project and create a campaign", "Coordinate research before payment preparation", "Run this saved multi-step routine"], icon: Workflow },
  { id: "sentinel", name: "Sentinel", specialty: "Security triage", summary: "Performs deterministic EVM bytecode triage and enforces transaction policy boundaries.", goodAt: ["Opcode risk signals", "Transfer policy checks", "Fail-closed validation"], prompts: ["Scan this EVM bytecode", "Check this transfer against policy", "Explain the bytecode risk signals"], icon: ShieldCheck },
] as const;

type Specialist = (typeof specialists)[number];

function SpecialistDialog({ specialist, onClose }: { specialist: Specialist; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);
  const Icon = specialist.icon;
  return <dialog ref={ref} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-sm">
    <div className="p-6 sm:p-7"><div className="flex items-start gap-4"><SpecialistMark icon={Icon} size={48} /><div className="min-w-0 flex-1"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{specialist.specialty}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{specialist.name}</h2></div><button type="button" aria-label="Close specialist details" onClick={onClose} className="grid size-10 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><X className="size-4" aria-hidden="true" /></button></div>
      <p className="mt-5 text-sm leading-6 text-muted-foreground">{specialist.summary}</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2"><section><h3 className="text-sm font-semibold">What it is good at</h3><ul className="mt-3 space-y-2">{specialist.goodAt.map((item) => <li key={item} className="flex gap-2 text-sm"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{item}</li>)}</ul></section><section><h3 className="text-sm font-semibold">Questions to ask</h3><ul className="mt-3 space-y-2">{specialist.prompts.map((item) => <li key={item} className="rounded-lg bg-muted px-3 py-2 text-xs leading-5">{item}</li>)}</ul></section></div>
      <p className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">You still submit every request through the main task box. Operator adds this specialist automatically when the goal requires it.</p>
    </div>
  </dialog>;
}

function resetLabel(resetsAtMs: number): string { const minutes = Math.max(0, Math.ceil((resetsAtMs - Date.now()) / 60_000)); return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }

function ApprovalDialog({ approvals, onClose, onReview }: { approvals: PendingApproval[]; onClose: () => void; onReview: (approval: PendingApproval) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);
  return <dialog ref={ref} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-sm">
    <div className="flex items-start gap-3 border-b border-border p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Bell className="size-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold tracking-tight">Action needed</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">These checkpoints are synced to this wallet across phone and desktop.</p></div><button type="button" aria-label="Close action inbox" onClick={onClose} className="grid size-10 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden="true" /></button></div>
    <div className="max-h-[58dvh] overflow-y-auto p-3">{approvals.length ? <ul className="space-y-2">{approvals.map((approval) => <li key={`${approval.task_id}-${approval.kind}`} className="rounded-xl border border-border p-4"><div className="flex items-start gap-3"><span className={`mt-1 size-2 shrink-0 rounded-full ${approval.reminder_due ? "bg-destructive" : "bg-primary"}`} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{approval.title}</h3>{approval.reminder_due ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive"><Clock3 className="size-3" aria-hidden="true" />Waiting</span> : null}</div><p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{approval.summary}</p><p className="mt-2 text-[11px] capitalize text-muted-foreground">{approval.bot} · {approval.state.replaceAll("_", " ")}</p></div></div><button type="button" onClick={() => onReview(approval)} className="mt-3 min-h-10 w-full rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px">Review checkpoint</button></li>)}</ul> : <div className="px-4 py-10 text-center"><p className="text-sm font-medium">Nothing needs you right now</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Long-running work continues without creating unnecessary approvals.</p></div>}</div>
    <PushControl />
  </dialog>;
}

function PushControl() {
  const supported = pushSupported();
  const [ready, setReady] = useState(!supported);
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; if (!supported) return; void Promise.all([getPushConfig(), currentPushSubscription()]).then(([config, subscription]) => { if (!active) return; setConfigured(config.configured); setEnabled(Boolean(subscription)); setReady(true); }).catch((reason) => { if (active) { setError(reason instanceof Error ? reason.message : "Phone alert status failed."); setReady(true); } }); return () => { active = false; }; }, [supported]);
  async function toggle() { setWorking(true); setError(null); try { if (enabled) await disablePushNotifications(); else await enablePushNotifications(); setEnabled(!enabled); } catch (reason) { setError(reason instanceof Error ? reason.message : "Phone alerts could not be updated."); } finally { setWorking(false); } }
  return <div className="border-t border-border p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold">Phone lock-screen alerts</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Only says a checkpoint is waiting; transaction details stay inside DONADS.</p></div><button type="button" disabled={!ready || working || !configured || !supported} aria-busy={working} onClick={() => void toggle()} className="min-h-10 shrink-0 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50">{working ? "Updating…" : enabled ? "Disable" : configured ? "Enable" : "Keys pending"}</button></div>{error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}</div>;
}

function BalanceDialog({ native, tokens, onClose }: { native: WalletBalance; tokens: TokenBalance[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (!dialog) return; if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", ""); }, []);
  return <dialog ref={ref} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-sm">
    <div className="flex items-start gap-3 border-b border-border p-5"><span className="grid size-10 place-items-center rounded-xl bg-muted"><Coins className="size-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold">Testnet balances</h2><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{native.address}</p></div><button type="button" aria-label="Close balances" onClick={onClose} className="grid size-10 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><X className="size-4" aria-hidden="true" /></button></div>
    <div className="space-y-2 p-4"><div className="flex items-baseline justify-between rounded-xl bg-muted p-4"><span className="text-sm font-medium">MON</span><span className="font-mono text-sm tabular-nums">{Number(native.balance_mon).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span></div>{tokens.map((token) => <div key={token.contract} className="rounded-xl border border-border p-4"><div className="flex items-baseline justify-between gap-3"><span className="text-sm font-medium">{token.symbol}</span><span className="font-mono text-sm tabular-nums">{token.balance_formatted}</span></div><p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{token.contract}</p></div>)}{!tokens.length ? <p className="px-2 py-6 text-center text-xs leading-5 text-muted-foreground">No ERC-20 contracts in this wallet’s DONADS history yet. Prepare a token transfer to add its verified balance.</p> : null}<p className="px-1 pt-2 text-[11px] text-muted-foreground">Monad Testnet · live RPC values</p></div>
  </dialog>;
}

function Sidebar({ open, onClose, onNewTask, onSpecialist, onHistory, history, historyReady, aiUsage }: { open: boolean; onClose: () => void; onNewTask: () => void; onSpecialist: (specialist: Specialist) => void; onHistory: (task: Task) => void; history: Task[]; historyReady: boolean; aiUsage: AiUsage | null }) {
  return <>
    {open ? <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[2px] lg:hidden" onClick={onClose} /> : null}
    <aside aria-label="DONADS navigation" className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card p-3 transition-transform duration-200 motion-reduce:transition-none lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-12 items-center justify-between px-2"><div className="flex items-center gap-2.5"><MascotMark size={36} /><span className="font-semibold tracking-tight">DONADS</span></div><button type="button" aria-label="Close sidebar" onClick={onClose} className="grid size-10 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:hidden"><X className="size-4" aria-hidden="true" /></button></div>
      <button type="button" onClick={onNewTask} className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px"><MessageSquarePlus className="size-4" aria-hidden="true" />New task</button>
      <section className="mt-6" aria-labelledby="specialists-title"><p id="specialists-title" className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Specialists</p><ul className="space-y-1">{specialists.map((specialist) => { const Icon = specialist.icon; return <li key={specialist.id}><button type="button" onClick={() => onSpecialist(specialist)} aria-label={`Learn about ${specialist.name}`} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px"><SpecialistMark icon={Icon} size={36} /><span className="min-w-0"><span className="block text-sm font-medium">{specialist.name}</span><span className="block truncate text-xs text-muted-foreground">{specialist.specialty}</span></span></button></li>; })}</ul></section>
      <section className="mt-5 min-h-0" aria-label="Task history"><p className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">History</p>{!historyReady ? <div className="space-y-2 px-3" aria-label="Loading task history">{[1,2].map((item) => <div key={item} className="h-10 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />)}</div> : history.length ? <ol className="max-h-40 space-y-1 overflow-y-auto">{history.map((task) => <li key={task.id}><button type="button" onClick={() => onHistory(task)} className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><p className="truncate text-xs font-medium">{task.prompt}</p><p className="mt-0.5 text-xs capitalize text-muted-foreground">{task.bot} · {task.status.state}</p></button></li>)}</ol> : <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">No tasks yet. Your completed work will appear here.</p>}</section>
      {aiUsage ? <section className="mt-auto rounded-xl border border-border bg-background px-3 py-2.5" aria-label="AI usage"><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs font-medium"><Gauge className="size-4" aria-hidden="true" />AI</span><span className="font-mono text-xs tabular-nums"><strong>{aiUsage.remaining_today}</strong>/{aiUsage.limits.requestsPerDayPerWallet} today</span></div><p className="mt-1 truncate text-[11px] text-muted-foreground">Resets in {resetLabel(aiUsage.resets_at_ms)}{aiUsage.configured ? "" : " · API key pending"}</p></section> : null}
    </aside>
  </>;
}

export function ChatShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);
  const specialistTrigger = useRef<HTMLElement | null>(null);
  const [signedInWallet, setSignedInWallet] = useState<string | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [history, setHistory] = useState<Task[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [approvalInboxOpen, setApprovalInboxOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);

  async function loadWalletData() { const [tasks, walletBalance, tokenValues, usage, pending] = await Promise.all([listTaskHistory(30), getWalletBalance(), getWalletTokenBalances(), getAiUsage(), listPendingApprovals()]); setHistory(tasks); setBalance(walletBalance); setTokenBalances(tokenValues); setAiUsage(usage); setApprovals(pending); setHistoryReady(true); }

  useEffect(() => { let active = true; void restoreWalletSession().then(async (session) => { if (!active) return; setSignedInWallet(session.owner_id); await loadWalletData(); }).catch(() => { if (active) setHistoryReady(true); }); return () => { active = false; }; }, []);

  useEffect(() => {
    if (!signedInWallet) return;
    let active = true;
    const refresh = () => { if (document.visibilityState !== "visible") return; void listPendingApprovals().then((pending) => { if (active) setApprovals(pending); }).catch(() => undefined); };
    const interval = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [signedInWallet]);

  async function signIn() {
    setSigningIn(true); setAuthError(null);
    try { const provider = await connectWalletProvider(); const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[]; const address = accounts[0]; if (!address) throw new Error("The wallet did not return an account."); const challenge = await createAuthChallenge(address); const signature = await provider.request({ method: "personal_sign", params: [challenge.message, address] }) as string; const session = await verifyWalletSignature(address, signature); setAccessToken(session.access_token); setSignedInWallet(session.owner_id); await loadWalletData(); }
    catch (error) {
      setAccessToken(null); setSignedInWallet(null); setBalance(null); setTokenBalances([]); setAiUsage(null); setHistory([]); setHistoryReady(true);
      if (!(error instanceof WalletConnectionCancelledError)) setAuthError(error instanceof Error ? error.message : "Wallet sign-in failed.");
    }
    finally { setSigningIn(false); }
  }

  async function signOut() { setSigningIn(true); setAuthError(null); try { await revokeWalletSession(); await disconnectWalletProvider(); } catch (error) { setAuthError(error instanceof Error ? error.message : "Server logout failed; the local session was cleared."); } finally { setAccessToken(null); setSignedInWallet(null); setBalance(null); setTokenBalances([]); setAiUsage(null); setHistory([]); setApprovals([]); setApprovalInboxOpen(false); setBalanceDialogOpen(false); setHistoryReady(true); setSigningIn(false); } }

  async function reviewApproval(approval: PendingApproval) {
    setApprovalError(null);
    try {
      const task = await getTask(approval.task_id);
      setSelectedTask(task);
      setWorkspaceKey((value) => value + 1);
      setApprovalInboxOpen(false);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : "The checkpoint could not be opened.");
    }
  }

  function closeSpecialist() { setSelectedSpecialist(null); window.setTimeout(() => specialistTrigger.current?.focus(), 0); }

  return <div className="flex min-h-dvh bg-background text-foreground">
    {signingIn ? <MascotLoader label={signedInWallet ? "Closing your wallet session…" : "Opening the wallet chooser…"} /> : null}
    {selectedSpecialist ? <SpecialistDialog specialist={selectedSpecialist} onClose={closeSpecialist} /> : null}
    {approvalInboxOpen ? <ApprovalDialog approvals={approvals} onClose={() => setApprovalInboxOpen(false)} onReview={(approval) => void reviewApproval(approval)} /> : null}
    {balanceDialogOpen && balance ? <BalanceDialog native={balance} tokens={tokenBalances} onClose={() => setBalanceDialogOpen(false)} /> : null}
    {connectionsOpen ? <ConnectionsDialog onClose={() => setConnectionsOpen(false)} /> : null}
    <Sidebar open={sidebarOpen} history={history} historyReady={historyReady} aiUsage={aiUsage} onClose={() => setSidebarOpen(false)} onNewTask={() => { setSelectedTask(null); setWorkspaceKey((value) => value + 1); setSidebarOpen(false); }} onSpecialist={(specialist) => { specialistTrigger.current = document.activeElement as HTMLElement; setSelectedSpecialist(specialist); }} onHistory={(task) => { setSelectedTask(task); setWorkspaceKey((value) => value + 1); setSidebarOpen(false); }} />
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-5">
        <button type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="grid size-10 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:hidden"><Menu className="size-5" aria-hidden="true" /></button>
        <div className="flex items-center gap-2 text-sm font-semibold"><MascotMark size={28} /><span className="hidden sm:inline">Task workspace</span></div>
        <div className="ml-auto flex items-center gap-2">
          {signedInWallet ? <button type="button" aria-label="Open connected apps and mainnet readiness" onClick={() => setConnectionsOpen(true)} className="grid size-10 place-items-center rounded-full border border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Link2 className="size-4" aria-hidden="true" /></button> : null}
          {signedInWallet ? <button type="button" aria-label={`Open action inbox${approvals.length ? `, ${approvals.length} pending` : ""}`} onClick={() => setApprovalInboxOpen(true)} className="relative grid size-10 place-items-center rounded-full border border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Bell className="size-4" aria-hidden="true" />{approvals.length ? <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 font-mono text-[10px] font-semibold text-destructive-foreground">{Math.min(99, approvals.length)}</span> : null}</button> : null}
          {signedInWallet && balance ? <button type="button" aria-label="View Testnet token balances" onClick={() => setBalanceDialogOpen(true)} className="min-h-10 rounded-full bg-muted px-3 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><span className="hidden font-mono tabular-nums sm:inline">{Number(balance.balance_mon).toLocaleString(undefined, { maximumFractionDigits: 4 })} MON</span><span className="sm:ml-2 text-muted-foreground">Balances</span></button> : null}
          <button type="button" aria-label={signedInWallet ? "Sign out wallet session" : "Connect wallet"} onClick={() => void (signedInWallet ? signOut() : signIn())} disabled={signingIn} className="flex min-h-10 items-center gap-2 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:opacity-60"><WalletCards className="size-4" aria-hidden="true" />{signedInWallet ? `${signedInWallet.slice(0, 6)}…${signedInWallet.slice(-4)}` : "Connect wallet"}</button>
        </div>
      </header>
      {authError || approvalError ? <div role="alert" className="flex items-center justify-between gap-3 border-b border-border px-5 py-2 text-xs text-destructive"><span>{authError ?? approvalError}</span>{authError ? <button type="button" onClick={() => void signIn()} className="min-h-10 px-3 font-medium underline focus-visible:ring-2 focus-visible:ring-ring">Try again</button> : <button type="button" onClick={() => setApprovalError(null)} className="min-h-10 px-3 font-medium underline focus-visible:ring-2 focus-visible:ring-ring">Dismiss</button>}</div> : null}
      <UnifiedTaskWorkspace key={workspaceKey} signedIn={Boolean(signedInWallet)} walletAddress={signedInWallet} aiConfigured={Boolean(aiUsage?.configured)} initialTask={selectedTask} onTaskCompleted={() => void loadWalletData()} />
    </div>
  </div>;
}
