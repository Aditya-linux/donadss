"use client";

import { CircleDollarSign, Menu, Megaphone, MessageSquarePlus, Radar, ShieldCheck, ShoppingBag, Sparkles, WalletCards, Workflow, X } from "lucide-react";
import { useState } from "react";
import { MascotLoader, MascotMark } from "@/components/mascot";
import { UnifiedTaskWorkspace } from "@/components/unified-task-workspace";
import { createAuthChallenge, listTaskHistory, revokeWalletSession, setAccessToken, type Task, verifyWalletSignature } from "@/lib/donads-api";
import { connectWalletProvider, disconnectWalletProvider } from "@/lib/wallet-provider";

const specialists = [
  { name: "Scout", specialty: "Cited research", ask: "Verify public sources.", icon: Radar },
  { name: "Commerce", specialty: "Crypto checkout", ask: "Verify a crypto-accepting offer.", icon: ShoppingBag },
  { name: "Growth", specialty: "Campaign drafts", ask: "Create a review-ready campaign.", icon: Megaphone },
  { name: "Flow", specialty: "Monad payments", ask: "Prepare an exact transfer.", icon: CircleDollarSign },
  { name: "Operator", specialty: "Cross-agent coordination", ask: "Run dependent specialist work.", icon: Workflow },
  { name: "Sentinel", specialty: "Bytecode triage", ask: "Scan supplied EVM bytecode.", icon: ShieldCheck },
] as const;

function Sidebar({ open, onClose, onNewTask, history, historyReady }: { open: boolean; onClose: () => void; onNewTask: () => void; history: Task[]; historyReady: boolean }) {
  return <>
    {open ? <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[2px] lg:hidden" onClick={onClose} /> : null}
    <aside aria-label="DONADS navigation" className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card p-3 transition-transform duration-200 lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-12 items-center justify-between px-2"><div className="flex items-center gap-2.5"><MascotMark /><span className="font-semibold tracking-tight">DONADS</span></div><button type="button" aria-label="Close sidebar" onClick={onClose} className="grid size-10 place-items-center rounded-lg hover:bg-muted lg:hidden"><X className="size-4" /></button></div>
      <button type="button" onClick={onNewTask} className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-3 text-sm font-medium hover:bg-muted"><MessageSquarePlus className="size-4" />New task</button>
      <section className="mt-6" aria-labelledby="specialists-title"><p id="specialists-title" className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Specialists</p><ul className="space-y-1">{specialists.map(({ name, specialty, ask, icon: Icon }) => <li key={name} title={`What to ask: ${ask}`} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Icon className="size-4" /></span><span className="min-w-0"><span className="block text-sm font-medium">{name}</span><span className="block truncate text-xs text-muted-foreground">{specialty} · {ask}</span></span></li>)}</ul></section>
      {historyReady ? <section className="mt-5 min-h-0" aria-label="Recent task history"><p className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Recent tasks</p>{history.length ? <ol className="max-h-36 space-y-1 overflow-y-auto">{history.map((task) => <li key={task.id} className="rounded-lg px-3 py-2 text-xs"><p className="truncate font-medium">{task.prompt}</p><p className="mt-0.5 capitalize text-muted-foreground">{task.bot} · {task.status.state}</p></li>)}</ol> : <p className="px-3 py-2 text-xs text-muted-foreground">No tasks yet.</p>}</section> : null}
      <div className="mt-auto rounded-xl bg-muted p-3"><div className="flex items-center gap-2 text-xs font-medium"><Sparkles className="size-4" />Specialists coordinate automatically</div><p className="mt-1.5 text-xs leading-5 text-muted-foreground">They do not hold unrestricted wallets. You approve every transaction.</p></div>
    </aside>
  </>;
}

export function ChatShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const [signedInWallet, setSignedInWallet] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [history, setHistory] = useState<Task[]>([]);
  const [historyReady, setHistoryReady] = useState(false);

  async function signIn() {
    setSigningIn(true); setAuthError(null);
    try {
      const provider = await connectWalletProvider();
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      const address = accounts[0]; if (!address) throw new Error("The wallet did not return an account.");
      const challenge = await createAuthChallenge(address);
      const signature = await provider.request({ method: "personal_sign", params: [challenge.message, address] }) as string;
      const session = await verifyWalletSignature(address, signature);
      setAccessToken(session.access_token); setSignedInWallet(session.owner_id); setHistory(await listTaskHistory(20)); setHistoryReady(true);
    } catch (error) {
      setAccessToken(null); setSignedInWallet(null); setHistory([]); setHistoryReady(false); setAuthError(error instanceof Error ? error.message : "Wallet sign-in failed.");
    } finally { setSigningIn(false); }
  }

  async function signOut() {
    setSigningIn(true); setAuthError(null);
    try { await revokeWalletSession(); await disconnectWalletProvider(); }
    catch (error) { setAuthError(error instanceof Error ? error.message : "Server logout failed; the local session was cleared."); }
    finally { setAccessToken(null); setSignedInWallet(null); setHistory([]); setHistoryReady(false); setSigningIn(false); }
  }

  return <div className="flex min-h-dvh bg-background text-foreground">
    {signingIn ? <MascotLoader label={signedInWallet ? "Closing your wallet session…" : "Opening the wallet chooser…"} /> : null}
    <Sidebar open={sidebarOpen} history={history} historyReady={historyReady} onClose={() => setSidebarOpen(false)} onNewTask={() => { setWorkspaceKey((value) => value + 1); setSidebarOpen(false); }} />
    <div className="flex min-w-0 flex-1 flex-col"><header className="flex h-16 shrink-0 items-center border-b border-border px-3 sm:px-5"><button type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="mr-2 grid size-10 place-items-center rounded-lg hover:bg-muted lg:hidden"><Menu className="size-5" /></button><div className="flex items-center gap-2 text-sm font-semibold"><Workflow className="size-4" />DONADS Operator</div><button type="button" aria-label={signedInWallet ? "Sign out wallet session" : "Connect wallet"} onClick={() => void (signedInWallet ? signOut() : signIn())} disabled={signingIn} className="ml-auto flex min-h-10 items-center gap-2 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-60"><WalletCards className="size-3.5" />{signedInWallet ? `${signedInWallet.slice(0, 6)}…${signedInWallet.slice(-4)} · Sign out` : "Connect wallet"}</button></header>{authError ? <p role="alert" className="border-b border-border px-5 py-2 text-xs text-destructive">{authError}</p> : null}<UnifiedTaskWorkspace key={workspaceKey} signedIn={Boolean(signedInWallet)} /></div>
  </div>;
}
