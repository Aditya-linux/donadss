"use client";

import { ArrowUp, ChevronRight, CircleDollarSign, Clock3, ExternalLink, FileText, ImageIcon, Megaphone, Paperclip, Radar, ShieldCheck, ShoppingBag, Workflow, X } from "lucide-react";
import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { decodeFunctionResult, encodeDeployData, encodeFunctionData, getAddress, keccak256, stringToHex } from "viem";

import { Mascot, MascotLoader, MascotMark, SpecialistMark } from "@/components/mascot";
import { ReportDownloadButton } from "@/components/report-download-button";
import {
  applyFlowAction,
  applyOperatorAction,
  confirmFlowTransaction,
  confirmSwapTransaction,
  createFlowTask,
  createGrowthTask,
  createOperatorTask,
  createScoutTask,
  createSentinelTask,
  getSwapQuote,
  type CompletedTask,
  type FlowCompletedTask,
  type AiAttachmentInput,
  type OperatorStepInput,
  type Task,
  type SwapQuote,
  waitForOperator,
  waitForTask,
  planAiTask,
  preflightThreats,
  recordFlowSubmission,
} from "@/lib/donads-api";
import { planUnifiedTask } from "@/lib/task-planner";
import { DONADS_AI_POLICY } from "@/lib/ai-policy";
import { forgetPendingFlowHash, readPendingFlowHash, rememberPendingFlowHash } from "@/lib/flow-submission";
import { connectWalletProvider, ensureMonadTestnet, erc20TransferData, monToWeiHex } from "@/lib/wallet-provider";
import { formatTaskDuration, MONAD_TESTNET_EXPLORER, taskCompletionTime } from "@/lib/task-receipt";
import { shouldOfferPdf, taskResponseText } from "@/lib/task-response";
import { DonadsEscrowAbi, DonadsEscrowBytecode, DonadsPolicyVaultAbi, DonadsPolicyVaultBytecode } from "@/contracts/generated";

type Message = { id: string; role: "user" | "assistant"; text: string; task?: CompletedTask; swapQuote?: SwapQuote; durationMs?: number; transactionHashes?: string[] };
type Attachment = { id: string; file: File; previewUrl: string | null; textContent: string | null };

const MAX_ATTACHMENTS = DONADS_AI_POLICY.maxAttachmentsPerTask;
const MAX_FILE_BYTES = DONADS_AI_POLICY.maxAttachmentBytes;
const MAX_TEXT_CHARACTERS = 40_000;

function quoteExpired(expiresAtMs: number): boolean {
  return new Date().getTime() >= expiresAtMs;
}

function unixNow(): number {
  return Math.floor(new Date().getTime() / 1_000);
}

function unixIso(value: bigint): string {
  return new Date(Number(value) * 1_000).toISOString();
}

function currentTimeMs(): number {
  return new Date().getTime();
}

function currentIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const examples = [
  "Research https://monad.xyz and summarize the key facts",
  "Research https://monad.xyz and create a 7-day launch campaign",
  "Scan this contract bytecode: 0x6000ff",
  "Send 0.01 MON to 0xYOUR_WALLET_ADDRESS for testing",
  "Deploy my policy vault",
  "Create escrow 1 MON for 0xSELLER with arbiter 0xARBITER refund after 24 hours terms Product delivered as agreed",
];

const specialistIcons = {
  scout: Radar,
  commerce: ShoppingBag,
  growth: Megaphone,
  flow: CircleDollarSign,
  operator: Workflow,
  sentinel: ShieldCheck,
} as const;

function historyMessages(task: Task | null): Message[] {
  if (!task) return [];
  const result = task.status.state === "completed" ? task as CompletedTask : null;
  const text = result ? taskResponseText(result) : task.status.state === "failed" ? `This task failed: ${task.status.error}` : `This task is ${task.status.state}.`;
  return [
    { id: `${task.id}-user`, role: "user", text: task.prompt },
    { id: `${task.id}-assistant`, role: "assistant", text, task: result ?? undefined },
  ];
}

function TaskTiming({ task, durationMs }: { task?: CompletedTask; durationMs?: number }) {
  const startedAt = task?.created_at_ms;
  const finishedAt = task ? taskCompletionTime(task) : undefined;
  const elapsed = durationMs ?? (startedAt !== undefined && finishedAt !== undefined ? finishedAt - startedAt : undefined);
  if (elapsed === undefined) return null;

  return <details className="group mt-3 w-fit text-xs text-muted-foreground">
    <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <Clock3 className="size-4" aria-hidden="true" />
      <span>Worked for {formatTaskDuration(elapsed)}</span>
      <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
    </summary>
    {startedAt !== undefined && finishedAt !== undefined ? <dl className="ml-8 grid gap-1 pb-1">
      <div><dt className="inline">Started </dt><dd className="inline font-mono">{new Date(startedAt).toLocaleString()}</dd></div>
      <div><dt className="inline">Finished </dt><dd className="inline font-mono">{new Date(finishedAt).toLocaleString()}</dd></div>
    </dl> : <p className="ml-8 pb-1">Measured through the confirmed wallet receipt.</p>}
  </details>;
}

function TransactionLinks({ hashes }: { hashes?: string[] }) {
  if (!hashes?.length) return null;
  return <div className="mt-2 flex flex-wrap gap-2">{hashes.map((hash, index) => <a key={hash} href={`${MONAD_TESTNET_EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    {hashes.length > 1 ? `View transaction ${index + 1}` : "View on MonadVision"}
    <ExternalLink className="size-3.5" aria-hidden="true" />
  </a>)}</div>;
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
    <div><p className="font-mono text-base font-semibold tabular-nums">{payout.amount} {payout.asset}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">To {payout.recipient_address}</p>{payout.token_contract ? <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">Token {payout.token_contract}</p> : null}</div>
    <p className="text-xs leading-5 text-muted-foreground">Your wallet must show this exact recipient and amount. DONADS reports completion only after the mined receipt matches both.</p>
    {actionable ? <div className="flex flex-wrap gap-2"><button type="button" disabled={working} aria-busy={working} onClick={onApprove} className="min-h-10 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50">{working ? "Working…" : workflow.state === "submitted" ? "Verify submitted transaction" : "Approve in wallet and send"}</button>{workflow.state === "awaiting_approval" ? <button type="button" disabled={working} onClick={onReject} className="min-h-10 rounded-lg border border-border px-3 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50">Reject</button> : null}</div> : null}
    {workflow.execution ? <a href={`${MONAD_TESTNET_EXPLORER}/tx/${workflow.execution.transaction_hash}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 text-xs font-medium underline underline-offset-4">View verified transaction <ExternalLink className="size-3.5" aria-hidden="true" /></a> : null}
  </div>;
}

function SwapQuoteCard({ quote, working, onExecute }: { quote: SwapQuote; working: boolean; onExecute: () => void }) {
  return <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">Uniswap v3 simulation</span><span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px]">Monad Testnet</span></div>
    <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-muted p-3"><p className="text-[11px] text-muted-foreground">Input</p><p className="mt-1 font-mono text-sm tabular-nums">{quote.token_in.amount} {quote.token_in.symbol}</p></div><div className="rounded-lg bg-muted p-3"><p className="text-[11px] text-muted-foreground">Quoted output</p><p className="mt-1 font-mono text-sm tabular-nums">{quote.token_out.quoted_amount} {quote.token_out.symbol}</p></div></div>
    <dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted-foreground">Minimum output</dt><dd className="mt-1 font-mono">{quote.token_out.minimum_amount} {quote.token_out.symbol}</dd></div><div><dt className="text-muted-foreground">Estimated impact</dt><dd className="mt-1 font-mono">{(quote.estimated_price_impact_bps / 100).toFixed(2)}%</dd></div><div><dt className="text-muted-foreground">Max slippage</dt><dd className="mt-1 font-mono">{(quote.slippage_bps / 100).toFixed(2)}%</dd></div><div><dt className="text-muted-foreground">Pool fee</dt><dd className="mt-1 font-mono">{(quote.fee / 10_000).toFixed(2)}%</dd></div></dl>
    {quote.blocked ? <p role="alert" className="rounded-lg bg-destructive/5 p-3 text-xs leading-5 text-destructive">{quote.blocked_reason}</p> : quote.execution ? <div className="rounded-lg bg-muted p-3 text-xs leading-5"><p className="font-medium">Verified swap completed</p><p className="mt-1 font-mono break-all text-muted-foreground">{quote.execution.swap_transaction_hash}</p></div> : <div className="space-y-2"><p className="rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">Quote passed policy. Your wallet will approve only the exact input amount, then submit the exact minimum-output swap.</p><button type="button" disabled={working} onClick={onExecute} className="min-h-10 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50">{working ? "Working…" : "Approve token and execute swap"}</button></div>}
    <a href={quote.source} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 text-xs font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring">Official deployment source <ExternalLink className="size-3.5" aria-hidden="true" /></a>
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
    const executionStartedAt = currentTimeMs();
    try {
      setProgress("Sentinel is checking links and scam signalsâ€¦");
      const preflight = await preflightThreats({ text: value }, signal);
      if (preflight.blocked) {
        const details = preflight.findings.slice(0, 3).map((finding) => `${finding.message} (${finding.evidence})`).join(" ");
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: `${preflight.summary} ${details} No wallet or browser action was started. This screening does not guarantee safety.` }]);
        return;
      }
      plan = (await planAiTask(value, modelAttachments)).plan;
      onTaskCompleted?.();
      if (plan.kind === "clarify") { const message = plan.message; setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: message }]); return; }
      if (plan.kind === "vault_deploy" || plan.kind === "session_configure" || plan.kind === "session_revoke" || plan.kind === "escrow_create" || plan.kind === "escrow_action") {
        if (!walletAddress) throw new Error("Reconnect your wallet before preparing this contract action.");
        const provider = await connectWalletProvider();
        await ensureMonadTestnet(provider);
        const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
        const from = accounts[0];
        if (!from || from.toLowerCase() !== walletAddress.toLowerCase()) throw new Error("Connected wallet does not match the signed-in DONADS wallet.");
        if (plan.kind === "vault_deploy") {
          setProgress("Flow is deploying your owner-controlled policy vault…");
          const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from, data: DonadsPolicyVaultBytecode, value: "0x0" }] }) as string;
          const receipt = await waitForWalletReceipt(provider, hash);
          if (!receipt.contractAddress) throw new Error("Vault deployment receipt did not contain a contract address.");
          setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: `Your policy vault was deployed at ${receipt.contractAddress}. You remain its owner.`, durationMs: currentTimeMs() - executionStartedAt, transactionHashes: [hash] }]);
          return;
        }
        if (plan.kind === "escrow_create") {
          if (plan.refundHours < 1 || plan.refundHours > 8_760) throw new Error("Escrow refund time must be between 1 hour and 365 days.");
          const refundAfter = BigInt(unixNow() + plan.refundHours * 3_600);
          const data = encodeDeployData({ abi: DonadsEscrowAbi, bytecode: DonadsEscrowBytecode, args: [getAddress(from), getAddress(plan.seller), getAddress(plan.arbiter), refundAfter, keccak256(stringToHex(plan.terms))] });
          setProgress("Flow is waiting for your escrow funding approval…");
          const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from, data, value: monToWeiHex(plan.amount) }] }) as string;
          const receipt = await waitForWalletReceipt(provider, hash);
          if (!receipt.contractAddress) throw new Error("Escrow deployment receipt did not contain a contract address.");
          const termsHash = keccak256(stringToHex(plan.terms));
          setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: `Funded escrow deployed at ${receipt.contractAddress}. Terms hash: ${termsHash}.`, durationMs: currentTimeMs() - executionStartedAt, transactionHashes: [hash] }]);
          return;
        }
        if (plan.kind === "escrow_action") {
          let data: `0x${string}`;
          if (plan.action === "release") data = encodeFunctionData({ abi: DonadsEscrowAbi, functionName: "release" });
          else if (plan.action === "cooperative_refund") data = encodeFunctionData({ abi: DonadsEscrowAbi, functionName: "cooperativeRefund" });
          else if (plan.action === "timeout_refund") data = encodeFunctionData({ abi: DonadsEscrowAbi, functionName: "timeoutRefund" });
          else if (plan.action === "dispute") {
            if (!plan.evidence) throw new Error("Disputing an escrow requires a concise evidence description.");
            data = encodeFunctionData({ abi: DonadsEscrowAbi, functionName: "raiseDispute", args: [keccak256(stringToHex(plan.evidence))] });
          } else {
            if (!plan.evidence) throw new Error("Resolving an escrow requires a concise resolution description.");
            data = encodeFunctionData({ abi: DonadsEscrowAbi, functionName: "resolve", args: [plan.action === "resolve_seller", keccak256(stringToHex(plan.evidence))] });
          }
          setProgress("Flow is requesting the escrow state transition…");
          const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to: plan.escrow, data, value: "0x0" }] }) as string;
          await waitForWalletReceipt(provider, hash);
          const action = plan.action.replaceAll("_", " ");
          const escrowAddress = plan.escrow;
          setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: `Escrow ${escrowAddress} completed the ${action} action.`, durationMs: currentTimeMs() - executionStartedAt, transactionHashes: [hash] }]);
          return;
        }
        if (plan.kind === "session_configure") {
          if (plan.durationHours < 1 || plan.durationHours > 8_760) throw new Error("Session duration must be between 1 hour and 365 days.");
          const perTransaction = BigInt(monToWeiHex(plan.perTransaction));
          const daily = BigInt(monToWeiHex(plan.daily));
          if (daily < perTransaction) throw new Error("Daily session limit must be at least the per-transaction limit.");
          const ownerCall = encodeFunctionData({ abi: DonadsPolicyVaultAbi, functionName: "owner" });
          const ownerResult = await provider.request({ method: "eth_call", params: [{ to: plan.vault, data: ownerCall }, "latest"] }) as `0x${string}`;
          const vaultOwner = decodeFunctionResult({ abi: DonadsPolicyVaultAbi, functionName: "owner", data: ownerResult });
          if (vaultOwner.toLowerCase() !== from.toLowerCase()) throw new Error("Connected wallet is not the owner of this policy vault.");
          const recipientData = encodeFunctionData({ abi: DonadsPolicyVaultAbi, functionName: "setRecipientAllowed", args: [getAddress(plan.recipient), true] });
          setProgress("Flow is requesting the recipient permission…");
          const recipientHash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to: plan.vault, data: recipientData, value: "0x0" }] }) as string;
          await waitForWalletReceipt(provider, recipientHash);
          const expiry = BigInt(unixNow() + plan.durationHours * 3_600);
          const sessionData = encodeFunctionData({ abi: DonadsPolicyVaultAbi, functionName: "configureSession", args: [getAddress(plan.sessionKey), expiry, perTransaction, daily] });
          setProgress("Flow is requesting the bounded session permission…");
          const sessionHash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to: plan.vault, data: sessionData, value: "0x0" }] }) as string;
          await waitForWalletReceipt(provider, sessionHash);
          const sessionKey = plan.sessionKey;
          setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: `Session ${sessionKey} is permitted until ${unixIso(expiry)}, only for the approved recipient and limits.`, durationMs: currentTimeMs() - executionStartedAt, transactionHashes: [recipientHash, sessionHash] }]);
          return;
        }
        if (plan.kind === "session_revoke") {
          const ownerCall = encodeFunctionData({ abi: DonadsPolicyVaultAbi, functionName: "owner" });
          const ownerResult = await provider.request({ method: "eth_call", params: [{ to: plan.vault, data: ownerCall }, "latest"] }) as `0x${string}`;
          const vaultOwner = decodeFunctionResult({ abi: DonadsPolicyVaultAbi, functionName: "owner", data: ownerResult });
          if (vaultOwner.toLowerCase() !== from.toLowerCase()) throw new Error("Connected wallet is not the owner of this policy vault.");
          const revokeData = encodeFunctionData({ abi: DonadsPolicyVaultAbi, functionName: "revokeSession", args: [getAddress(plan.sessionKey)] });
          setProgress("Flow is revoking the session permission…");
          const revokeHash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to: plan.vault, data: revokeData, value: "0x0" }] }) as string;
          await waitForWalletReceipt(provider, revokeHash);
          const { sessionKey: revokedSession, vault } = plan;
          setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: `Session ${revokedSession} was revoked on vault ${vault}.`, durationMs: currentTimeMs() - executionStartedAt, transactionHashes: [revokeHash] }]);
          return;
        }
      }
      if (plan.kind === "swap") {
        setProgress("Flow is querying and checking the allowlisted Uniswap pools…");
        const quote = await getSwapQuote({ token_in: plan.tokenIn, token_out: plan.tokenOut, amount: plan.amount, slippage_bps: plan.slippageBps, max_price_impact_bps: plan.maxPriceImpactBps }, signal);
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: quote.blocked ? quote.blocked_reason ?? "Sentinel blocked this quote." : "Flow produced a deterministic, non-broadcasting Uniswap v3 quote.", swapQuote: quote }]);
        return;
      }
      let completed: CompletedTask;
      if (plan.kind === "flow") {
        if (!walletAddress) throw new Error("Reconnect your wallet before preparing a transfer.");
        setProgress("Flow is validating the exact Monad transfer…");
        const queued = await createFlowTask({
          title: "Chat-initiated Monad transfer",
          purpose: plan.purpose,
          payer: walletAddress,
          payouts: [{ recipient_name: "Recipient", recipient_address: plan.recipient, asset: plan.asset, amount: plan.amount, milestone: plan.purpose, deadline: null, token_contract: plan.tokenContract }],
          approval_conditions: [`Exact sender, recipient, ${plan.asset} amount, token contract, and Monad Testnet chain approved`],
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
        const now = currentTimeMs();
        const queued = await createGrowthTask({
          objective: plan.objective,
          start_date: currentIsoDate(),
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
            objective: plan.objective, start_date: currentIsoDate(), duration_days: 7, platforms: ["x", "linkedin", "community"],
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
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: taskResponseText(completed), task: completed }]);
      onTaskCompleted?.();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "The task could not be completed.");
    } finally {
      setWorking(false);
    }
  }

  function updateFlowMessage(messageId: string, task: FlowCompletedTask) {
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, text: taskResponseText(task), task } : message));
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
          const transaction = payout.token_contract && payout.amount_atomic
            ? { from, to: payout.token_contract, value: "0x0", data: erc20TransferData(payout.recipient_address, payout.amount_atomic) }
            : { from, to: payout.recipient_address, value: monToWeiHex(payout.amount) };
          transactionHash = await provider.request({ method: "eth_sendTransaction", params: [transaction] }) as string;
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

  function updateSwapMessage(messageId: string, quote: SwapQuote, durationMs?: number, transactionHashes?: string[]) {
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, text: quote.execution ? "Flow verified the completed Uniswap v3 swap and its balance changes." : message.text, swapQuote: quote, durationMs, transactionHashes } : message));
    onTaskCompleted?.();
  }

  async function waitForWalletReceipt(provider: Awaited<ReturnType<typeof connectWalletProvider>>, hash: string): Promise<{ status?: string; contractAddress?: string }> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [hash] }) as { status?: string } | null;
      if (receipt) {
        if (receipt.status !== "0x1") throw new Error("Wallet transaction reverted on Monad Testnet.");
        return receipt;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
    }
    throw new Error("Transaction was not mined before the timeout. Check the explorer before retrying.");
  }

  async function executeSwap(messageId: string, quote: SwapQuote) {
    if (quote.blocked || quote.execution) return;
    const executionStartedAt = currentTimeMs();
    setWorking(true);
    setError(null);
    try {
      if (quoteExpired(quote.expires_at_ms)) throw new Error("This swap quote expired. Request a fresh quote before signing.");
      setProgress("Flow is requesting the exact token approval…");
      const provider = await connectWalletProvider();
      await ensureMonadTestnet(provider);
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      const from = accounts[0];
      if (!from || !walletAddress || from.toLowerCase() !== walletAddress.toLowerCase()) throw new Error("Connected wallet does not match the wallet that requested this quote.");
      const approvalHash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to: quote.token_in.contract, value: "0x0", data: quote.approval_calldata }] }) as string;
      await waitForWalletReceipt(provider, approvalHash);
      if (quoteExpired(quote.expires_at_ms)) throw new Error("The quote expired while approval was mining. The exact approval is safe, but request a fresh quote before swapping.");
      setProgress("Flow is requesting the exact minimum-output swap…");
      const swapHash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to: quote.router, value: "0x0", data: quote.swap_calldata }] }) as string;
      await waitForWalletReceipt(provider, swapHash);
      setProgress("Flow is verifying both receipts and token balance changes…");
      let lastError: Error | undefined;
      for (let attempt = 0; attempt < 15; attempt += 1) {
        try {
          updateSwapMessage(messageId, await confirmSwapTransaction({ quote_id: quote.quote_id, approval_transaction_hash: approvalHash, swap_transaction_hash: swapHash }), currentTimeMs() - executionStartedAt, [approvalHash, swapHash]);
          return;
        } catch (cause) {
          lastError = cause instanceof Error ? cause : new Error("Swap receipt verification failed.");
          if (!/not been mined/i.test(lastError.message)) throw lastError;
          await new Promise((resolve) => window.setTimeout(resolve, 2_000));
        }
      }
      throw lastError ?? new Error("Swap verification timed out.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The swap could not be completed.");
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
              <div className="min-w-0">
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.swapQuote ? <SwapQuoteCard quote={message.swapQuote} working={working} onExecute={() => void executeSwap(message.id, message.swapQuote!)} /> : null}
                {message.task?.bot === "flow" ? <FlowIntentCard task={message.task} working={working} onApprove={() => void authorizeFlow(message.id, message.task as FlowCompletedTask)} onReject={() => void rejectFlow(message.id, message.task as FlowCompletedTask)} /> : null}
                <TransactionLinks hashes={message.transactionHashes} />
                <TaskTiming task={message.task} durationMs={message.durationMs} />
                {message.task && shouldOfferPdf(message.task) ? <div className="mt-3"><ReportDownloadButton task={message.task} /></div> : null}
              </div>
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
