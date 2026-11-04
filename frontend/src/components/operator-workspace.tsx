"use client";

import {
  ArrowRight,
  CalendarClock,
  Check,
  CircleDot,
  CircleX,
  GitBranch,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
} from "lucide-react";
import { FormEvent, useRef, useState } from "react";

import { FeedbackControls } from "@/components/feedback-controls";
import { MascotLoader } from "@/components/mascot";
import {
  ApiError,
  OperatorCompletedTask,
  OperatorStepInput,
  applyOperatorAction,
  createOperatorTask,
  extractSourceUrls,
  waitForOperator,
  waitForTask,
} from "@/lib/donads-api";

const inputClass =
  "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const today = new Date().toISOString().slice(0, 10);

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function StepStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <Check className="size-4" aria-hidden="true" />;
  if (status === "running") return <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />;
  if (["failed", "blocked", "cancelled"].includes(status)) {
    return <CircleX className="size-4" aria-hidden="true" />;
  }
  return <CircleDot className="size-4" aria-hidden="true" />;
}

function PlanView({
  task,
  working,
  onStart,
  onCancel,
  onRetry,
}: {
  task: OperatorCompletedTask;
  working: boolean;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const workflow = task.status.data.workflow;
  const terminal = ["completed", "partial_failure", "failed", "cancelled"].includes(
    workflow.state,
  );
  const canRetry =
    ["partial_failure", "failed", "cancelled"].includes(workflow.state) &&
    workflow.steps.some((step) =>
      ["failed", "blocked", "cancelled"].includes(step.status),
    );

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Orchestration plan
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{workflow.objective}</h1>
            </div>
            <span className="rounded-full border border-border px-3 py-1.5 text-xs font-medium capitalize">
              {statusLabel(workflow.state)}
            </span>
          </div>
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">
            {workflow.target_date ? `Target ${workflow.target_date}. ` : ""}
            Dependencies run in order. Completed work is retained if another step fails.
          </p>
        </section>

        <section aria-labelledby="plan-steps" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="plan-steps" className="text-sm font-semibold">Execution steps</h2>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {workflow.steps.filter((step) => step.status === "completed").length}/{workflow.steps.length}
            </span>
          </div>
          <ol className="space-y-3">
            {workflow.steps.map((step) => (
              <li key={step.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                    <StepStatusIcon status={step.status} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-medium">{step.order}. {step.title}</h3>
                      <span className="font-mono text-xs uppercase text-muted-foreground">{step.bot}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.prompt}</p>
                    {step.depends_on.length ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <GitBranch className="size-3.5" aria-hidden="true" />
                        After {step.depends_on.join(", ")}
                      </p>
                    ) : null}
                    {step.summary ? <p className="mt-3 text-sm">{step.summary}</p> : null}
                    {step.error ? <p role="alert" className="mt-3 text-sm text-destructive">{step.error}</p> : null}
                    {step.task_id ? (
                      <p className="mt-2 break-all font-mono text-xs text-muted-foreground">Task {step.task_id}</p>
                    ) : null}
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{statusLabel(step.status)}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl bg-muted p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-medium">Permission boundary</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Operator can create DONADS child tasks. Publishing, code changes, signing, external writes, and fund movement remain unavailable.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {workflow.state === "planned" ? (
            <button type="button" disabled={working} onClick={onStart} aria-busy={working} className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40">
              <Play className="size-4" aria-hidden="true" />Start plan
            </button>
          ) : null}
          {["running", "cancelling"].includes(workflow.state) ? (
            <button type="button" disabled={working || workflow.state === "cancelling"} onClick={onCancel} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40">
              <Square className="size-4" aria-hidden="true" />Stop after current step
            </button>
          ) : null}
          {canRetry ? (
            <button type="button" disabled={working} onClick={onRetry} className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40">
              <RotateCcw className="size-4" aria-hidden="true" />Retry incomplete steps
            </button>
          ) : null}
        </div>
      </div>
      {terminal ? <FeedbackControls taskId={task.id} /> : null}
    </main>
  );
}

export function OperatorWorkspace() {
  const [objective, setObjective] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [useScout, setUseScout] = useState(true);
  const [useGrowth, setUseGrowth] = useState(true);
  const [useFlow, setUseFlow] = useState(false);
  const [sources, setSources] = useState("");
  const [projectName, setProjectName] = useState("DONADS");
  const [productDescription, setProductDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [campaignStart, setCampaignStart] = useState(today);
  const [payer, setPayer] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [milestone, setMilestone] = useState("");
  const [task, setTask] = useState<OperatorCompletedTask | null>(null);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  function buildSteps(): OperatorStepInput[] {
    const steps: OperatorStepInput[] = [];
    if (useScout) {
      steps.push({
        id: "research",
        title: "Research the objective",
        bot: "scout",
        prompt: `${objective}\n\nSources:\n${sources}`,
        input: { sources: extractSourceUrls(sources) },
        depends_on: [],
      });
    }
    if (useGrowth) {
      steps.push({
        id: "campaign",
        title: "Prepare campaign drafts",
        bot: "growth",
        prompt: objective,
        input: {
          objective,
          start_date: campaignStart,
          duration_days: 7,
          platforms: ["x", "linkedin", "community", "email"],
          profile: {
            id: `operator-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"}`,
            project_name: projectName,
            product_description: productDescription,
            target_audience: audience,
            preferred_tone: "precise and playful",
            terminology: [],
            value_propositions: [valueProposition],
            approved_links: useScout ? extractSourceUrls(sources) : [],
            prohibited_terms: [],
            previous_approved_examples: [],
          },
          evidence: [],
        },
        depends_on: useScout ? ["research"] : [],
      });
    }
    if (useFlow) {
      const dependency = useGrowth ? "campaign" : useScout ? "research" : null;
      steps.push({
        id: "payment",
        title: "Prepare milestone payment",
        bot: "flow",
        prompt: `Prepare an exact Monad transfer intent for ${milestone}`,
        input: {
          title: `${projectName} milestone payment`,
          purpose: objective,
          payer,
          payouts: [{
            recipient_name: recipient,
            recipient_address: recipientAddress,
            asset: "MON",
            amount,
            milestone,
            deadline: targetDate || null,
          }],
          approval_conditions: ["Milestone reviewed and approved"],
          linked_task_id: null,
        },
        depends_on: dependency ? [dependency] : [],
      });
    }
    return steps;
  }

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!useScout && !useGrowth && !useFlow) {
      setError("Select at least one specialist.");
      return;
    }
    setWorking(true);
    setProgress("Validating the dependency graph…");
    controller.current?.abort();
    controller.current = new AbortController();
    try {
      const queued = await createOperatorTask(
        { objective, target_date: targetDate || null, steps: buildSteps() },
        controller.current.signal,
      );
      const planned = await waitForTask(queued.id, undefined, controller.current.signal);
      if (planned.bot !== "operator") throw new ApiError("Operator returned an unexpected result.");
      setTask(planned);
      setProgress("");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Could not create the plan. Try again.");
    } finally {
      setWorking(false);
    }
  }

  async function run(action: "start" | "retry_failed") {
    if (!task) return;
    setWorking(true);
    setError(null);
    setProgress(action === "start" ? "Starting the first eligible step…" : "Retrying incomplete steps…");
    controller.current?.abort();
    controller.current = new AbortController();
    try {
      const started = await applyOperatorAction(task.id, { action }, controller.current.signal);
      setTask(started);
      setWorking(false);
      const completed = await waitForOperator(
        task.id,
        (next) => {
          setTask(next);
          const active = next.status.data.workflow.steps.find((step) => step.status === "running");
          setProgress(active ? `${active.bot} is working on ${active.title.toLowerCase()}…` : "Resolving dependencies…");
        },
        controller.current.signal,
      );
      setTask(completed);
      setProgress("");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Operator could not continue. Try again.");
    } finally {
      setWorking(false);
    }
  }

  async function cancel() {
    if (!task) return;
    setWorking(true);
    setError(null);
    try {
      const updated = await applyOperatorAction(task.id, { action: "cancel" });
      setTask(updated);
      setProgress("Stopping after the current specialist step…");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not cancel the run. Try again.");
    } finally {
      setWorking(false);
    }
  }

  if (task) {
    return (
      <>
        {error ? <div role="alert" className="mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-4xl items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm"><span>{error}</span><button type="button" onClick={() => setError(null)} className="min-h-10 rounded-lg px-3 text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">Dismiss</button></div> : null}
        {working && progress ? <div className="mx-auto mt-3 w-[calc(100%-2rem)] max-w-4xl"><MascotLoader label={progress} compact /></div> : null}
        <PlanView task={task} working={working} onStart={() => void run("start")} onCancel={() => void cancel()} onRetry={() => void run("retry_failed")} />
      </>
    );
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <form onSubmit={createPlan} aria-busy={working} className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        <section className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Operator</p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">One objective. Ordered work.</h1>
          <p className="mt-4 max-w-prose text-sm leading-6 text-muted-foreground">Choose the approved specialists. Operator builds the dependencies, preserves every child task, and stops downstream work when a requirement fails.</p>
        </section>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">Objective and timing</legend>
          <label className="block space-y-1.5 text-sm font-medium"><span>Objective <span className="text-muted-foreground">· required</span></span><textarea required rows={3} value={objective} onChange={(event) => setObjective(event.target.value)} className={`${inputClass} resize-y py-2 leading-6`} /></label>
          <label className="block max-w-xs space-y-1.5 text-sm font-medium"><span>Target date <span className="font-normal text-muted-foreground">· optional</span></span><input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className={inputClass} /></label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">Specialists</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Scout", "Source-linked research", useScout, setUseScout],
              ["Growth", "Draft-only campaign", useGrowth, setUseGrowth],
              ["Flow", "Crypto transfer intent", useFlow, setUseFlow],
            ].map(([name, description, checked, setter]) => (
              <label key={String(name)} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm focus-within:ring-2 focus-within:ring-ring">
                <input type="checkbox" checked={Boolean(checked)} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} className="size-4 accent-primary" />
                <span><span className="block font-medium">{String(name)}</span><span className="mt-0.5 block text-xs text-muted-foreground">{String(description)}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        {useScout ? <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4"><legend className="px-1 text-sm font-semibold">Scout brief</legend><label className="block space-y-1.5 text-sm font-medium"><span>Public sources <span className="text-muted-foreground">· required</span></span><textarea required rows={3} value={sources} onChange={(event) => setSources(event.target.value)} placeholder="https://docs.example.com" spellCheck={false} className={`${inputClass} resize-y py-2 font-mono text-xs leading-6`} /><span className="block text-xs font-normal text-muted-foreground">One to five HTTP(S) URLs. Scout remains read-only.</span></label></fieldset> : null}

        {useGrowth ? <fieldset className="space-y-4 rounded-xl border border-border bg-card p-4"><legend className="px-1 text-sm font-semibold">Growth brief</legend><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium"><span>Project name</span><input required value={projectName} onChange={(event) => setProjectName(event.target.value)} autoComplete="organization" className={inputClass} /></label><label className="space-y-1.5 text-sm font-medium"><span>Target audience</span><input required value={audience} onChange={(event) => setAudience(event.target.value)} autoComplete="off" className={inputClass} /></label><label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>Product description</span><textarea required rows={2} value={productDescription} onChange={(event) => setProductDescription(event.target.value)} className={`${inputClass} resize-y py-2`} /></label><label className="space-y-1.5 text-sm font-medium"><span>Primary value proposition</span><input required value={valueProposition} onChange={(event) => setValueProposition(event.target.value)} autoComplete="off" className={inputClass} /></label><label className="space-y-1.5 text-sm font-medium"><span>Campaign start</span><input required type="date" value={campaignStart} onChange={(event) => setCampaignStart(event.target.value)} className={inputClass} /></label></div></fieldset> : null}

        {useFlow ? <fieldset className="space-y-4 rounded-xl border border-border bg-card p-4"><legend className="px-1 text-sm font-semibold">Flow brief</legend><p className="text-xs leading-5 text-muted-foreground">Operator only prepares an exact crypto transfer intent. It cannot approve, sign, broadcast, or move funds.</p><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium"><span>Payer label</span><input required value={payer} onChange={(event) => setPayer(event.target.value)} autoComplete="organization" className={inputClass} /></label><label className="space-y-1.5 text-sm font-medium"><span>Recipient name</span><input required value={recipient} onChange={(event) => setRecipient(event.target.value)} autoComplete="name" className={inputClass} /></label><label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>Recipient address</span><input required value={recipientAddress} onChange={(event) => setRecipientAddress(event.target.value)} autoComplete="off" spellCheck={false} placeholder="0x…" className={`${inputClass} font-mono text-xs`} /></label><label className="space-y-1.5 text-sm font-medium"><span>Amount in MON</span><input required type="text" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} autoComplete="off" className={`${inputClass} font-mono`} /></label><label className="space-y-1.5 text-sm font-medium"><span>Milestone</span><input required value={milestone} onChange={(event) => setMilestone(event.target.value)} className={inputClass} /></label></div></fieldset> : null}

        {error ? <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm"><span>{error}</span><button type="button" onClick={() => setError(null)} className="min-h-10 rounded-lg px-3 text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">Dismiss</button></div> : null}
        {working ? <MascotLoader label={progress} /> : null}
        <div className="flex flex-col gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="size-4" aria-hidden="true" />Review required before execution</p><button type="submit" disabled={working} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40">Build plan<ArrowRight className="size-4" aria-hidden="true" /></button></div>
      </form>
    </main>
  );
}
