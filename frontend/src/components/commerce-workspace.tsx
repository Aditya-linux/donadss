"use client";

import { ShieldCheck, ShoppingBag } from "lucide-react";
import { FormEvent, useState } from "react";
import { applyCommerceAction, CommerceCompletedTask, createCommerceTask, waitForTask } from "@/lib/donads-api";

const inputClass = "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring";

export function CommerceWorkspace() {
  const [objective, setObjective] = useState("");
  const [budget, setBudget] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("MON");
  const [name, setName] = useState("");
  const [merchant, setMerchant] = useState("");
  const [url, setUrl] = useState("");
  const [task, setTask] = useState<CommerceCompletedTask | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault(); setWorking(true); setError(null);
    try {
      const created = await createCommerceTask({ objective, budget_atomic: budget, asset, offers: [{ id: "offer-1", name, merchant, source_url: url, checkout_url: url, total_atomic: amount, asset, in_stock: true, rating: null, evidence_note: "User-supplied crypto merchant offer.", crypto_payment_supported: true }] });
      const completed = await waitForTask(created.id);
      if (completed.status.state !== "completed" || completed.bot !== "commerce") throw new Error("Commerce did not return a completed intent.");
      setTask(completed);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Commerce failed."); }
    finally { setWorking(false); }
  }

  async function act(action: "approve" | "reject") {
    if (!task) return; setWorking(true); setError(null);
    try { setTask(await applyCommerceAction(task.id, action === "approve" ? { action, approved_total_atomic: task.status.data.workflow.total_atomic } : { action })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Action failed."); }
    finally { setWorking(false); }
  }

  const workflow = task?.status.data.workflow;
  return <main className="flex-1 overflow-y-auto p-4 sm:p-8">
    <div className="mx-auto max-w-2xl space-y-6">
      <header><div className="flex items-center gap-3"><ShoppingBag className="size-7"/><h1 className="text-3xl font-semibold tracking-tight">Crypto commerce intent</h1></div><p className="mt-2 text-sm text-muted-foreground">Select and authorize only merchants that explicitly accept crypto. DONADS does not claim an order until a real Monad transaction and merchant receipt are verified.</p></header>
      {!workflow ? <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <label className="block text-sm font-medium">Purchase goal<textarea required rows={3} value={objective} onChange={e=>setObjective(e.target.value)} className={`${inputClass} mt-1 py-2`}/></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Asset<input required value={asset} onChange={e=>setAsset(e.target.value.toUpperCase())} className={`${inputClass} mt-1 font-mono`}/></label><label className="text-sm font-medium">Budget in atomic units<input required inputMode="numeric" value={budget} onChange={e=>setBudget(e.target.value)} className={`${inputClass} mt-1 font-mono`}/></label></div>
        <label className="block text-sm font-medium">Product<input required value={name} onChange={e=>setName(e.target.value)} className={`${inputClass} mt-1`}/></label>
        <label className="block text-sm font-medium">Crypto-accepting merchant<input required value={merchant} onChange={e=>setMerchant(e.target.value)} className={`${inputClass} mt-1`}/></label>
        <label className="block text-sm font-medium">Merchant evidence/checkout URL<input required type="url" value={url} onChange={e=>setUrl(e.target.value)} className={`${inputClass} mt-1 font-mono`}/></label>
        <label className="block text-sm font-medium">Exact total in atomic units<input required inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} className={`${inputClass} mt-1 font-mono`}/></label>
        <button disabled={working} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-40">{working ? "Checking…" : "Prepare crypto intent"}</button>
      </form> : <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Selected offer</p><h2 className="mt-1 text-xl font-semibold">{workflow.selected_offer.name}</h2><p className="text-sm text-muted-foreground">{workflow.selected_offer.merchant} · {workflow.total_atomic} {workflow.asset} atomic units</p></div>
        <div className="rounded-xl bg-muted p-4 text-sm"><ShieldCheck className="mb-2 size-5"/>State: <span className="font-mono">{workflow.state}</span>. Authorization does not sign, broadcast, or place an order.</div>
        {workflow.state === "awaiting_approval" ? <div className="flex gap-3"><button disabled={working} onClick={()=>void act("approve")} className="min-h-11 rounded-xl bg-primary px-4 text-sm text-primary-foreground">Authorize exact intent</button><button disabled={working} onClick={()=>void act("reject")} className="min-h-11 rounded-xl border border-border px-4 text-sm">Reject</button></div> : null}
      </section>}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  </main>;
}
