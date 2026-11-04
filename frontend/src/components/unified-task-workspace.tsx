"use client";

import { ArrowUp, CheckCircle2, CircleDollarSign, ExternalLink, FileText, ImageIcon, Megaphone, Paperclip, Radar, ShieldCheck, ShoppingBag, Workflow, X } from "lucide-react";
import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

import { Mascot, MascotLoader, MascotMark, SpecialistMark } from "@/components/mascot";
import { ReportDownloadButton } from "@/components/report-download-button";
import {
  applyFlowAction,
  applyOperatorAction,
  confirmFlowTransaction,
  createFlowTask,
  createGrowthTask,
  createOperatorTask,
  createScoutTask,
  createSentinelTask,
  type CompletedTask,
  type FlowCompletedTask,
  type AiAttachmentInput,
  type OperatorStepInput,
  type Task,
  waitForOperator,
  waitForTask,
  planAiTask,
  recordFlowSubmission,
} from "@/lib/donads-api";
import { planUnifiedTask } from "@/lib/task-planner";
import { DONADS_AI_POLICY } from "@/lib/ai-policy";
import { forgetPendingFlowHash, readPendingFlowHash, rememberPendingFlowHash } from "@/lib/flow-submission";
import { connectWalletProvider, ensureMonadTestnet, monToWeiHex } from "@/lib/wallet-provider";

type Message = { id: string; role: "user" | "assistant"; text: string; task?: CompletedTask };
type Attachment = { id: string; file: File; previewUrl: string | null; textContent: string | null };

const MAX_ATTACHMENTS = DONADS_AI_POLICY.maxAttachmentsPerTask;
const MAX_FILE_BYTES = DONADS_AI_POLICY.maxAttachmentBytes;
const MAX_TEXT_CHARACTERS = 40_000;

const examples = [
  "Research https://monad.xyz and summarize the key facts",
  "Research https://monad.xyz and create a 7-day launch campaign",
  "Scan this contract bytecode: 0x6000ff",
  "Send 0.01 MON to 0xYOUR_WALLET_ADDRESS for testing",
];

const specialistIcons = {
  scout: Radar,
  commerce: ShoppingBag,
  growth: Megaphone,
  flow: CircleDollarSign,
  operator: Workflow,
  sentinel: ShieldCheck,
} as const;

function resultText(task: CompletedTask): string {
  if (task.bot === "operator") {
    const workflow = task.status.data.workflow;
    const completed = workflow.steps.filter((step) => step.status === "completed").length;
    return `${task.status.summary} ${completed}/${workflow.steps.length} specialist steps completed.`;
  }
  return task.status.summary;
}

function historyMessages(task: Task | null): Message[] {
  if (!task) return [];
  const result = task.status.state === "completed" ? task as CompletedTask : null;
  const text = result ? resultText(result) : task.status.state === "failed" ? `This task failed: ${task.status.error}` : `This task is ${task.status.state}.`;
  return [
    { id: `${task.id}-user`, role: "user", text: task.prompt },
    { id: `${task.id}-assistant`, role: "assistant", text, task: result ?? undefined },
  ];
}

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? ""); reader.onerror = () => reject(new Error(`Could not read ${file.name}.`)); reader.readAsDataURL(file); });
}

function FlowIntentCard({ task, working, onApprove, onReject }: { task: FlowCompletedTask; working: boolean; onApprove: () => void; onReject: () => void }) {
  const workflow = task.status.data.workflow;
  const payout = workflow.payouts[0];
  const actionable = ["awaiting_approval", "authorized", "submitted"].includes(workflow.state);
  return <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-4">
    <div className="flex items-center justify-between gap-3"><span className="font-medium">Exact Monad Testnet intent</span><span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] capitalize">{workflow.state.replaceAll("_", " ")}</span></div>
    <div><p className="font-mono text-base font-semibold tabular-nums">{payout.amount} MON</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">To {payout.recipient_address}</p></div>
    <p className="text-xs leading-5 text-muted-foreground">Your wallet must show this exact recipient and amount. DONADS reports completion only after the mined receipt matches both.</p>
    {actionable ? <div className="flex flex-wrap gap-2"><button type="button" disabled={working} aria-busy={working} onClick={onApprove} className="min-h-10 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50">{working ? "Working…" : workflow.state === "submitted" ? "Verify submitted transaction" : "Approve in wallet and send"}</button>{workflow.state === "awaiting_approval" ? <button type="button" disabled={working} onClick={onReject} className="min-h-10 rounded-lg border border-border px-3 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50">Reject</button> : null}</div> : null}
    {workflow.execution ? <a href={`https://testnet.monadexplorer.com/tx/${workflow.execution.transaction_hash}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 text-xs font-medium underline underline-offset-4">View verified transaction <ExternalLink className="size-3.5" aria-hidden="true" /></a> : null}
  </div>;
}

export function UnifiedTaskWorkspace({ signedIn, walletAddress = null, aiConfigured = false, initialTask = null, onTaskCompleted }: { signedIn: boolean; walletAddress?: string | null; aiConfigured?: boolean; initialTask?: Task | null; onTaskCompleted?: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => historyMessages(initialTask));
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("Understanding the goal…");
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => () => { previewUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  async function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    setAttachmentError(null);
    if (attachments.length + chosen.length > MAX_ATTACHMENTS) {
      setAttachmentError(`Attach up to ${MAX_ATTACHMENTS} files per task.`);
      return;
    }
    const tooLarge = chosen.find((file) => file.size > MAX_FILE_BYTES);
    if (tooLarge) {
      setAttachmentError(`${tooLarge.name} is larger than 10 MB.`);
      return;
    }
    const prepared = await Promise.all(chosen.map(async (file): Promise<Attachment> => {
      const isText = file.type.startsWith("text/") || /\.(md|txt|csv|json|js|jsx|ts|tsx|sol|rs|toml|yaml|yml|xml|html|css)$/i.test(file.name);
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      if (previewUrl) previewUrls.current.add(previewUrl);
      return { id: crypto.randomUUID(), file, previewUrl, textContent: isText ? (await file.text()).slice(0, MAX_TEXT_CHARACTERS) : null };
    }));
    setAttachments((current) => [...current, ...prepared]);
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => {
      if (attachment.id !== id) return true;
      if (attachment.previewUrl) { URL.revokeObjectURL(attachment.previewUrl); previewUrls.current.delete(attachment.previewUrl); }
      return false;
    }));
    setAttachmentError(null);
  }

  async function execute(value: string, modelAttachments: AiAttachmentInput[] = []) {
    let plan = planUnifiedTask(value);
    if (!signedIn) {
      if (plan.kind === "clarify") { const message = plan.message; setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: message }]); return; }
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: "Connect and sign in with your wallet first. This binds the task history and approvals to you." }]);
      return;
    }

    setWorking(true);
    setProgress("Operator is understanding the goal…");
    setError(null);
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    try {
      plan = (await planAiTask(value, modelAttachments)).plan;
      onTaskCompleted?.();
      if (plan.kind === "clarify") { const message = plan.message; setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: message }]); return; }
      let completed: CompletedTask;
      if (plan.kind === "flow") {
        if (!walletAddress) throw new Error("Reconnect your wallet before preparing a transfer.");
        setProgress("Flow is validating the exact Monad transfer…");
        const queued = await createFlowTask({
          title: "Chat-initiated Monad transfer",
          purpose: plan.purpose,
          payer: walletAddress,
          payouts: [{ recipient_name: "Recipient", recipient_address: plan.recipient, asset: "MON", amount: plan.amount, milestone: plan.purpose, deadline: null }],
          approval_conditions: ["Exact sender, recipient, MON amount, and Monad Testnet chain approved"],
          linked_task_id: null,
        }, signal);
        completed = await waitForTask(queued.id, undefined, signal);
        if (completed.bot !== "flow") throw new Error("Flow returned an unexpected task.");
      } else if (plan.kind === "scout") {
        setProgress("Scout is reading and citing the supplied sources…");
        const queued = await createScoutTask(plan.prompt, signal, modelAttachments);
        completed = await waitForTask(queued.id, (task) => setProgress(task.events.at(-1)?.message ?? "Scout is verifying the evidence…"), signal);
      } else if (plan.kind === "sentinel") {
        setProgress("Sentinel is triaging the bytecode…");
        const queued = await createSentinelTask(plan.bytecode, signal);
        completed = await waitForTask(queued.id, undefined, signal);
      } else if (plan.kind === "growth") {
        setProgress("Growth is building a review-ready campaign…");
        const now = Date.now();
        const queued = await createGrowthTask({
          objective: plan.objective,
          start_date: new Date().toISOString().slice(0, 10),
          duration_days: 7,
          platforms: ["x", "linkedin", "community"],
          profile: {
            id: "donads-default",
            project_name: "DONADS project",
            product_description: "The project described in the task",
            target_audience: "Web3 users and builders",
            preferred_tone: "precise, minimal, and playful",
            terminology: [], value_propositions: ["Clear, verifiable outcomes"], approved_links: [], prohibited_terms: [], previous_approved_examples: [],
            version: 1, updated_at_ms: now,
          },
        }, signal);
        completed = await waitForTask(queued.id, undefined, signal);
      } else {
        setProgress("Operator is selecting Scout and Growth…");
        const research: OperatorStepInput = { id: "research", title: "Verify source material", bot: "scout", prompt: plan.objective, input: { sources: plan.sources }, depends_on: [] };
        const campaign: OperatorStepInput = {
          id: "campaign", title: "Create the campaign", bot: "growth", prompt: plan.objective,
          input: {
            objective: plan.objective, start_date: new Date().toISOString().slice(0, 10), duration_days: 7, platforms: ["x", "linkedin", "community"],
            profile: { id: "donads-default", project_name: "DONADS project", product_description: "The sourced project in this task", target_audience: "Web3 users and builders", preferred_tone: "precise, minimal, and playful", terminology: [], value_propositions: ["Evidence-backed communication"], approved_links: plan.sources, prohibited_terms: [], previous_approved_examples: [] }, evidence: [],
          }, depends_on: ["research"],
        };
        const queued = await createOperatorTask({ objective: plan.objective, target_date: null, steps: [research, campaign] }, signal);
        const planned = await waitForTask(queued.id, undefined, signal);
        if (planned.bot !== "operator") throw new Error("Operator returned an unexpected task.");
        setProgress("Scout is verifying sources before Growth starts…");
        await applyOperatorAction(planned.id, { action: "start" }, signal);
        completed = await waitForOperator(planned.id, (task) => {
          const active = task.status.data.workflow.steps.find((step) => step.status === "running");
          setProgress(active ? `${active.bot} is completing ${active.title.toLowerCase()}…` : "Operator is verifying specialist outputs…");
        }, signal);
      }
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: resultText(completed), task: completed }]);
      onTaskCompleted?.();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "The task could not be completed.");
    } finally {
      setWorking(false);
    }
  }

  function updateFlowMessage(messageId: string, task: FlowCompletedTask) {
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, text: resultText(task), task } : message));
    onTaskCompleted?.();
  }

  async function rejectFlow(messageId: string, task: FlowCompletedTask) {
    if (task.status.data.workflow.state !== "awaiting_approval") return;
    setWorking(true);
    setProgress("Flow is rejecting the transfer intent…");
    setError(null);
    try {
      updateFlowMessage(messageId, (await applyFlowAction(task.id, { action: "reject", reason: "Rejected in DONADS chat" })).task);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The transfer intent could not be rejected.");
    } finally {
      setWorking(false);
    }
  }

  async function authorizeFlow(messageId: string, task: FlowCompletedTask) {
    setWorking(true);
    setProgress("Flow is waiting for your wallet and Monad confirmation…");
    setError(null);
    try {
      let current = task;
      if (current.status.data.workflow.state === "awaiting_approval") {
        current = (await applyFlowAction(task.id, { action: "approve", note: "Exact chat transfer approved." })).task;
        updateFlowMessage(messageId, current);
      }

      let transactionHash = current.status.data.workflow.submission?.transaction_hash ?? readPendingFlowHash(task.id);
      if (current.status.data.workflow.state === "authorized") {
        if (!transactionHash) {
          const provider = await connectWalletProvider();
          await ensureMonadTestnet(provider);
          const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
          const from = accounts[0];
          const workflow = current.status.data.workflow;
          if (!from || from.toLowerCase() !== workflow.payer.toLowerCase()) throw new Error("Connected wallet does not match the wallet bound to this intent.");
          const payout = workflow.payouts[0];
          transactionHash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to: payout.recipient_address, value: monToWeiHex(payout.amount) }] }) as string;
          rememberPendingFlowHash(task.id, transactionHash);
        }
        current = await recordFlowSubmission(task.id, transactionHash);
        updateFlowMessage(messageId, current);
      }

      if (!transactionHash) throw new Error("No wallet transaction has been submitted for this intent.");
      let lastError: Error | undefined;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
          const confirmed = await confirmFlowTransaction(task.id, transactionHash);
          forgetPendingFlowHash(task.id);
          updateFlowMessage(messageId, confirmed);
          return;
        } catch (cause) {
          lastError = cause instanceof Error ? cause : new Error("Receipt verification failed.");
          if (!/not been mined|not known/i.test(lastError.message)) throw lastError;
          await new Promise((resolve) => window.setTimeout(resolve, 2_000));
        }
      }
      throw lastError ?? new Error("The submitted transaction was not confirmed before the timeout. Retry verification; DONADS will not send it again.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The transaction could not be completed.");
    } finally {
      setWorking(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || working) return;
    const unsupported = attachments.filter((attachment) => attachment.textContent === null);
    if (unsupported.length && !aiConfigured) {
      setAttachmentError(`${unsupported.map((attachment) => attachment.file.name).join(", ")} can be selected and previewed, but image, PDF, and binary analysis needs the upcoming multimodal model API. Attach text or code for processing now.`);
      return;
    }
    const attachmentText = attachments.map((attachment) => `\n\nAttached text file: ${attachment.file.name}\n---\n${attachment.textContent}`).join("");
    const displayText = attachments.length ? `${value}\n\nAttached: ${attachments.map((attachment) => attachment.file.name).join(", ")}` : value;
    try {
      const modelAttachments = await Promise.all(unsupported.map(async (attachment) => ({ name: attachment.file.name, mime_type: attachment.file.type || "application/octet-stream", data: await fileAsBase64(attachment.file) })));
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: displayText }]);
      setPrompt("");
      setAttachments([]);
      void execute(`${value}${attachmentText}`, modelAttachments);
    } catch (cause) { setAttachmentError(cause instanceof Error ? cause.message : "Could not read the selected files."); }
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      {working ? <MascotLoader label={progress} /> : null}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-40 pt-8 sm:px-6">
        {!messages.length ? (
          <section className="my-auto flex flex-col items-center py-12 text-center">
            <Mascot size={120} />
            <h1 className="mt-7 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">What should DONADS complete?</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">One request in. The right specialists coordinate behind the scenes, with wallet approval reserved for you.</p>
            <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
              {examples.map((example) => <button key={example} type="button" onClick={() => setPrompt(example)} className="rounded-xl border border-border bg-card p-3 text-left text-xs leading-5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">{example}</button>)}
            </div>
          </section>
        ) : (
          <ol className="space-y-7 py-4" aria-live="polite">
            {messages.map((message) => <li key={message.id} className={message.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground" : "flex max-w-[92%] gap-3 text-sm leading-6"}>
              {message.role === "assistant" ? <span className="mt-0.5 shrink-0">{message.task ? <SpecialistMark icon={specialistIcons[message.task.bot]} size={32} /> : <MascotMark size={32} />}</span> : null}
              <div className="min-w-0"><p>{message.text}</p>{message.task?.bot === "flow" ? <FlowIntentCard task={message.task} working={working} onApprove={() => void authorizeFlow(message.id, message.task as FlowCompletedTask)} onReject={() => void rejectFlow(message.id, message.task as FlowCompletedTask)} /> : null}{message.task?.bot === "operator" ? <div className="mt-3 space-y-2">{message.task.status.data.workflow.steps.map((step) => <div key={step.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><CheckCircle2 className="size-4" /><span className="capitalize">{step.bot}</span><span className="text-muted-foreground">{step.title}</span></div>)}</div> : null}{message.task ? <div className="mt-3"><ReportDownloadButton task={message.task} /></div> : null}</div>
            </li>)}
          </ol>
        )}
        {error ? <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background to-transparent px-4 pb-5 pt-10 lg:left-72">
        <form onSubmit={submit} className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-2 shadow-lg" aria-describedby={attachmentError ? "attachment-error" : undefined}>
          {attachments.length ? <ul className="flex flex-wrap gap-2 border-b border-border px-1 pb-2" aria-label="Selected attachments">{attachments.map((attachment) => <li key={attachment.id} className="flex max-w-full items-center gap-2 rounded-lg bg-muted p-1.5 pr-1 text-xs">{attachment.previewUrl ? <Image src={attachment.previewUrl} alt="" width={32} height={32} unoptimized className="size-8 rounded-md object-cover" /> : <span className="grid size-8 place-items-center rounded-md bg-card"><FileText className="size-4" aria-hidden="true" /></span>}<span className="max-w-40 truncate">{attachment.file.name}</span><button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.file.name}`} className="grid size-10 place-items-center rounded-md hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden="true" /></button></li>)}</ul> : null}
          {attachmentError ? <div id="attachment-error" role="alert" className="mx-1 mt-1 flex items-start gap-2 rounded-lg bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive"><ImageIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{attachmentError}</span></div> : null}
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor="task-attachments">Attach files</label>
            <input ref={fileInput} id="task-attachments" type="file" multiple onChange={(event) => void selectFiles(event)} className="sr-only" />
            <button type="button" aria-label="Attach files" title="Attach files" onClick={() => fileInput.current?.click()} disabled={working || attachments.length >= MAX_ATTACHMENTS} className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:opacity-40"><Paperclip className="size-5" aria-hidden="true" /></button>
            <label className="sr-only" htmlFor="unified-task">Ask DONADS to complete a task</label>
            <textarea id="unified-task" rows={2} value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Describe the outcome, sources, and constraints…" className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-1 py-3 text-sm outline-none focus-visible:ring-0" />
            <button type="submit" aria-label="Start task" disabled={!prompt.trim() || working} className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:opacity-40"><ArrowUp className="size-5" aria-hidden="true" /></button>
          </div>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">DONADS prepares actions; your wallet confirms every transaction.</p>
      </div>
    </main>
  );
}
