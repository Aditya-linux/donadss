import { randomUUID } from "node:crypto";
import { start } from "workflow/api";
import { formatEther } from "viem";
import { DONADS_AI_POLICY } from "@/lib/ai-policy";
import { pendingApprovals } from "@/lib/approvals";

import type {
  BrandProfile,
  CommerceCompletedTask,
  FlowCompletedTask,
  OperatorCompletedTask,
  OperatorRoutine,
  OperatorTaskInput,
  Task,
} from "@/lib/donads-api";
import { authenticate, createChallenge, logout, SESSION_COOKIE, verifyChallenge } from "@/server/auth";
import { monToWei } from "@/server/bots";
import {
  getProfile,
  getAiUsageSince,
  getRoutine,
  getTask,
  deletePushSubscription,
  listRoutines,
  listTasks,
  putProfile,
  putRoutine,
  putPushSubscription,
  updateTask,
} from "@/server/database";
import { geminiConfigured } from "@/server/gemini";
import { planTask } from "@/server/ai-planner";
import { taskEvent } from "@/server/donads-types";
import { encodeErc20Transfer, formatTokenAmount, monadRpc, readErc20Balance } from "@/server/monad";
import { createAndExecuteTask } from "@/server/tasks";
import { operatorWorkflow } from "@/workflows/operator";
import { quoteUniswapSwap } from "@/server/uniswap";
import { publicVapidKey, sendCheckpointNotification } from "@/server/push";

export const maxDuration = 300;

type Context = { params: Promise<{ path?: string[] }> };

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function failure(cause: unknown): Response {
  const message = cause instanceof Error ? cause.message : "Unexpected DONADS API error.";
  if (message === "AUTH_REQUIRED") return json({ error: "Sign in with your wallet to continue." }, 401);
  if (/not found/i.test(message)) return json({ error: message }, 404);
  if (/DATABASE_URL/.test(message)) return json({ error: "Persistent storage is not connected to this deployment." }, 503);
  console.error("DONADS API error", cause);
  return json({ error: message }, 400);
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Request body must be a JSON object.");
  return value as Record<string, unknown>;
}

async function ownedTask(ownerId: string, id: string): Promise<Task> {
  const task = await getTask(ownerId, id);
  if (!task) throw new Error("Task not found.");
  return task;
}

async function commerceAction(ownerId: string, id: string, request: Request): Promise<Response> {
  const task = await ownedTask(ownerId, id) as CommerceCompletedTask;
  if (task.bot !== "commerce" || task.status.state !== "completed") throw new Error("Commerce task not found.");
  const action = await body(request);
  const workflow = task.status.data.workflow;
  if (workflow.state !== "awaiting_approval") return json(task);
  if (action.action === "approve") {
    if (String(action.approved_total_atomic) !== workflow.total_atomic) throw new Error("Approval amount does not match the exact selected total.");
    workflow.state = "authorized";
    workflow.approval_id = randomUUID();
    workflow.approved_at_ms = Date.now();
    workflow.audit_history.push({ sequence: workflow.audit_history.length + 1, event: "intent_authorized", detail: "User authorized the exact intent; no payment or order was submitted.", at_ms: Date.now() });
    task.status.summary = "Commerce recorded exact intent authorization. A merchant invoice and wallet payment are still required.";
  } else if (action.action === "reject") {
    workflow.state = "rejected";
    workflow.audit_history.push({ sequence: workflow.audit_history.length + 1, event: "intent_rejected", detail: "User rejected the commerce intent.", at_ms: Date.now() });
    task.status.summary = "Commerce intent rejected; no payment or order occurred.";
  } else throw new Error("Unsupported commerce action.");
  task.updated_at_ms = Date.now();
  task.events.push(taskEvent(task.events, String(action.action), task.status.summary));
  await updateTask(task);
  return json(task);
}

async function flowAction(ownerId: string, id: string, request: Request): Promise<Response> {
  const task = await ownedTask(ownerId, id) as FlowCompletedTask;
  if (task.bot !== "flow" || task.status.state !== "completed") throw new Error("Flow task not found.");
  const action = await body(request);
  const workflow = task.status.data.workflow;
  let duplicatePrevented = false;
  if (workflow.state !== "awaiting_approval") duplicatePrevented = true;
  else if (action.action === "approve") {
    workflow.state = "authorized";
    workflow.approval = { decision: "approved", note: typeof action.note === "string" ? action.note : "Exact transfer approved.", decided_at_ms: Date.now() };
    workflow.audit_history.push({ sequence: workflow.audit_history.length + 1, event: "intent_authorized", detail: "User authorized the exact transfer; wallet signature still required.", at_ms: Date.now() });
    task.status.summary = "Flow recorded approval and is waiting for the browser wallet transaction.";
  } else if (action.action === "reject") {
    workflow.state = "rejected";
    workflow.approval = { decision: "rejected", note: typeof action.reason === "string" ? action.reason : "Rejected.", decided_at_ms: Date.now() };
    workflow.audit_history.push({ sequence: workflow.audit_history.length + 1, event: "intent_rejected", detail: "User rejected the transfer intent.", at_ms: Date.now() });
    task.status.summary = "Flow transfer intent rejected; no funds moved.";
  } else throw new Error("Unsupported Flow action.");
  task.updated_at_ms = Date.now();
  task.events.push(taskEvent(task.events, String(action.action), task.status.summary));
  await updateTask(task);
  await sendCheckpointNotification(task).catch((error) => console.error("DONADS push notification failed", error));
  return json({ task, duplicate_prevented: duplicatePrevented });
}

async function recordFlowSubmission(ownerId: string, id: string, request: Request): Promise<Response> {
  const task = await ownedTask(ownerId, id) as FlowCompletedTask;
  if (task.bot !== "flow" || task.status.state !== "completed") throw new Error("Flow task not found.");
  const payload = await body(request);
  const hash = typeof payload.transaction_hash === "string" ? payload.transaction_hash.toLowerCase() : "";
  if (!/^0x[0-9a-f]{64}$/.test(hash)) throw new Error("A valid transaction hash is required.");
  const workflow = task.status.data.workflow;
  if (workflow.state === "submitted" && workflow.submission?.transaction_hash === hash) return json(task);
  if (workflow.state !== "authorized") throw new Error("The exact transfer must be authorized before recording a wallet submission.");
  workflow.state = "submitted";
  workflow.submission = { transaction_hash: hash, submitted_at_ms: Date.now() };
  workflow.audit_history.push({ sequence: workflow.audit_history.length + 1, event: "transaction_submitted", detail: "Wallet returned a transaction hash; receipt verification is pending.", at_ms: Date.now() });
  task.status.summary = "Flow recorded the wallet submission and is waiting for a matching Monad receipt.";
  task.updated_at_ms = Date.now();
  task.events.push(taskEvent(task.events, "transaction_submitted", task.status.summary));
  await updateTask(task);
  return json(task);
}

async function confirmFlow(ownerId: string, id: string, request: Request): Promise<Response> {
  const task = await ownedTask(ownerId, id) as FlowCompletedTask;
  if (task.bot !== "flow" || task.status.state !== "completed") throw new Error("Flow task not found.");
  const payload = await body(request);
  const hash = typeof payload.transaction_hash === "string" ? payload.transaction_hash.toLowerCase() : "";
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("A valid transaction hash is required.");
  const workflow = task.status.data.workflow;
  if (workflow.state === "confirmed" && workflow.execution?.transaction_hash === hash) return json(task);
  if (workflow.state !== "submitted" || workflow.submission?.transaction_hash !== hash) throw new Error("Transaction hash does not match the recorded wallet submission.");
  const transaction = await monadRpc("eth_getTransactionByHash", [hash]) as Record<string, string> | null;
  const receipt = await monadRpc("eth_getTransactionReceipt", [hash]) as Record<string, string> | null;
  if (!transaction || !receipt?.blockNumber) throw new Error("Transaction has not been mined yet.");
  if (receipt.status !== "0x1") throw new Error("Monad receipt reports a reverted transaction.");
  const payout = workflow.payouts[0];
  if (transaction.from?.toLowerCase() !== workflow.payer) throw new Error("Mined transaction sender does not match the approved payer.");
  let senderBalanceAfter: bigint | null = null;
  let recipientBalanceAfter: bigint | null = null;
  if (workflow.transfer_kind === "erc20" && workflow.token && payout.amount_atomic) {
    const expectedInput = encodeErc20Transfer(payout.recipient_address, BigInt(payout.amount_atomic)).toLowerCase();
    if (transaction.to?.toLowerCase() !== workflow.token.contract || BigInt(transaction.value ?? "0x0") !== BigInt(0) || transaction.input?.toLowerCase() !== expectedInput) throw new Error("Mined ERC-20 transaction does not match the approved contract, recipient, amount, or calldata policy.");
    [senderBalanceAfter, recipientBalanceAfter] = await Promise.all([
      readErc20Balance(workflow.token.contract, workflow.payer),
      readErc20Balance(workflow.token.contract, payout.recipient_address),
    ]);
    const amountAtomic = BigInt(payout.amount_atomic);
    if (recipientBalanceAfter - BigInt(workflow.token.recipient_balance_before_atomic) !== amountAtomic) throw new Error("Recipient token balance delta does not match the approved amount.");
    if (BigInt(workflow.token.sender_balance_before_atomic) - senderBalanceAfter < amountAtomic) throw new Error("Sender token balance did not decrease by the approved amount.");
  } else if (transaction.to?.toLowerCase() !== payout.recipient_address || BigInt(transaction.value) !== monToWei(payout.amount) || !["0x", "0x0", undefined].includes(transaction.input)) {
    throw new Error("Mined native transaction does not match the approved recipient, amount, or calldata policy.");
  }
  workflow.state = "confirmed";
  workflow.execution = { transaction_hash: hash.toLowerCase(), block_number: Number(BigInt(receipt.blockNumber)), confirmed_at_ms: Date.now(), ...(senderBalanceAfter === null ? {} : { sender_balance_after_atomic: senderBalanceAfter.toString(), recipient_balance_after_atomic: recipientBalanceAfter!.toString() }) };
  workflow.audit_history.push({ sequence: workflow.audit_history.length + 1, event: "transaction_confirmed", detail: `Monad receipt verified in block ${workflow.execution.block_number}.`, at_ms: Date.now() });
  task.status.summary = "Flow verified the successful Monad Testnet transaction and exact approved values.";
  task.updated_at_ms = Date.now();
  task.events.push(taskEvent(task.events, "transaction_confirmed", task.status.summary));
  await updateTask(task);
  return json(task);
}

async function operatorAction(ownerId: string, id: string, request: Request): Promise<Response> {
  const task = await ownedTask(ownerId, id) as OperatorCompletedTask;
  if (task.bot !== "operator" || task.status.state !== "completed") throw new Error("Operator task not found.");
  const payload = await body(request);
  if (payload.action === "cancel") {
    task.status.data.workflow.cancellation_requested = true;
    task.status.data.workflow.state = "cancelling";
    task.updated_at_ms = Date.now();
    await updateTask(task);
    return json(task);
  }
  if (payload.action === "retry_failed") {
    task.status.data.workflow.steps.filter((step) => ["failed", "blocked", "cancelled"].includes(step.status)).forEach((step) => { step.status = "pending"; step.error = null; step.summary = null; step.task_id = null; });
    task.status.data.workflow.cancellation_requested = false;
  } else if (payload.action !== "start") throw new Error("Unsupported Operator action.");
  task.status.data.workflow.state = "running";
  task.status.data.workflow.started_at_ms ??= Date.now();
  task.updated_at_ms = Date.now();
  await updateTask(task);
  await start(operatorWorkflow, [ownerId, task.id]);
  return json(task);
}

async function route(request: Request, context: Context): Promise<Response> {
  const segments = (await context.params).path ?? [];
  const method = request.method;
  if (method === "GET" && segments[0] === "health") return json({ status: "ok", network: "testnet", chain_id: 10143, persistence: "postgres", deployment: "vercel" });
  if (method === "GET" && segments[0] === "bots") return json(["scout", "commerce", "growth", "flow", "operator", "sentinel"]);
  if (method === "POST" && segments.join("/") === "auth/challenge") {
    const payload = await body(request);
    return json(await createChallenge(request, String(payload.address ?? "")), 201);
  }
  if (method === "POST" && segments.join("/") === "auth/verify") {
    const payload = await body(request);
    const session = await verifyChallenge(String(payload.address ?? ""), String(payload.signature ?? "") as `0x${string}`);
    const response = json(session);
    const secure = (request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "")) === "https";
    response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(session.access_token)}; Path=/; Max-Age=43200; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`);
    return response;
  }
  if (method === "POST" && segments.join("/") === "auth/logout") {
    await logout(request);
    return new Response(null, { status: 204, headers: { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` } });
  }

  const { ownerId } = await authenticate(request);
  if (method === "GET" && segments.join("/") === "auth/session") return json({ owner_id: ownerId });
  if (method === "GET" && segments.join("/") === "push/config") return json({ configured: Boolean(publicVapidKey()), public_key: publicVapidKey() });
  if (method === "POST" && segments.join("/") === "push/subscriptions") {
    const payload = await body(request); const endpoint = String(payload.endpoint ?? "");
    const keys = payload.keys && typeof payload.keys === "object" ? payload.keys as Record<string, unknown> : {};
    const p256dh = String(keys.p256dh ?? ""); const auth = String(keys.auth ?? "");
    if (!endpoint.startsWith("https://") || endpoint.length > 2_048) throw new Error("Push subscription endpoint is invalid.");
    if (!p256dh || !auth || p256dh.length > 512 || auth.length > 256) throw new Error("Push subscription keys are invalid.");
    await putPushSubscription(ownerId, { endpoint, keys: { p256dh, auth } }); return json({ subscribed: true }, 201);
  }
  if (method === "DELETE" && segments.join("/") === "push/subscriptions") {
    const payload = await body(request); await deletePushSubscription(ownerId, String(payload.endpoint ?? "")); return new Response(null, { status: 204 });
  }
  if (method === "GET" && segments.join("/") === "approvals") return json(pendingApprovals(await listTasks(ownerId, 100)));
  if (method === "GET" && segments.join("/") === "wallet/balance") {
    const value = String(await monadRpc("eth_getBalance", [ownerId, "latest"]));
    return json({ address: ownerId, chain_id: 10143, network: "Monad Testnet", symbol: "MON", balance_atomic: BigInt(value).toString(), balance_mon: formatEther(BigInt(value)) });
  }
  if (method === "GET" && segments.join("/") === "wallet/token-balances") {
    const tasks = await listTasks(ownerId, 100);
    const tokens = new Map<string, { contract: string; symbol: string; decimals: number }>();
    for (const task of tasks) {
      if (task.status.state !== "completed" || task.bot !== "flow") continue;
      const token = task.status.data.workflow.token;
      if (token) tokens.set(token.contract, { contract: token.contract, symbol: token.symbol, decimals: token.decimals });
    }
    const balances = await Promise.all([...tokens.values()].slice(0, 10).map(async (token) => {
      const value = await readErc20Balance(token.contract, ownerId);
      return { ...token, balance_atomic: value.toString(), balance_formatted: formatTokenAmount(value, token.decimals) };
    }));
    return json(balances);
  }
  if (method === "GET" && segments.join("/") === "ai/usage") {
    const now = new Date();
    const resetAtMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const used = await getAiUsageSince(ownerId, resetAtMs - 24 * 60 * 60 * 1_000);
    return json({
      configured: geminiConfigured(), provider: "gemini", model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
      used_today: used, remaining_today: Math.max(0, DONADS_AI_POLICY.requestsPerDayPerWallet - used), resets_at_ms: resetAtMs,
      limits: DONADS_AI_POLICY,
    });
  }
  if (method === "POST" && segments.join("/") === "ai/plan") {
    const payload = await body(request);
    const prompt = String(payload.prompt ?? "").trim();
    if (!prompt) throw new Error("A task prompt is required.");
    const attachments = Array.isArray(payload.attachments) ? payload.attachments.map((value) => {
      if (!value || typeof value !== "object") throw new Error("Invalid AI attachment.");
      const item = value as Record<string, unknown>; const data = String(item.data ?? ""); const mimeType = String(item.mime_type ?? "");
      if (!/^image\//.test(mimeType) && mimeType !== "application/pdf") throw new Error("Gemini attachments must be images or PDFs.");
      if (Buffer.byteLength(data, "base64") > DONADS_AI_POLICY.maxAttachmentBytes) throw new Error("An attachment exceeds the 10 MB limit.");
      return { name: String(item.name ?? "attachment"), mimeType, data };
    }) : [];
    if (attachments.length > DONADS_AI_POLICY.maxAttachmentsPerTask) throw new Error("A task accepts up to 5 attachments.");
    return json(await planTask(ownerId, prompt, attachments));
  }
  if (method === "POST" && segments.join("/") === "dex/quote") {
    const payload = await body(request);
    return json(await quoteUniswapSwap({
      tokenIn: String(payload.token_in ?? ""), tokenOut: String(payload.token_out ?? ""),
      amount: String(payload.amount ?? ""), recipient: ownerId,
      slippageBps: Number(payload.slippage_bps), maxPriceImpactBps: Number(payload.max_price_impact_bps),
    }));
  }
  if (segments[0] === "tasks" && segments.length === 1 && method === "POST") return json(await createAndExecuteTask(ownerId, await body(request)), 201);
  if (segments[0] === "tasks" && segments.length === 1 && method === "GET") return json(await listTasks(ownerId, Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? 20)))));
  if (segments[0] === "tasks" && segments.length === 2 && method === "GET") return json(await ownedTask(ownerId, segments[1]));
  if (segments[0] === "tasks" && segments[2] === "commerce-actions" && method === "POST") return commerceAction(ownerId, segments[1], request);
  if (segments[0] === "tasks" && segments[2] === "flow-actions" && method === "POST") return flowAction(ownerId, segments[1], request);
  if (segments[0] === "tasks" && segments[2] === "flow-submission" && method === "POST") return recordFlowSubmission(ownerId, segments[1], request);
  if (segments[0] === "tasks" && segments[2] === "flow-transaction" && method === "POST") return confirmFlow(ownerId, segments[1], request);
  if (segments[0] === "tasks" && segments[2] === "operator-actions" && method === "POST") return operatorAction(ownerId, segments[1], request);
  if (segments[0] === "tasks" && segments[2] === "feedback" && method === "POST") {
    const task = await ownedTask(ownerId, segments[1]);
    const payload = await body(request);
    if (![1, 5].includes(Number(payload.rating))) throw new Error("Feedback rating must be 1 or 5.");
    task.feedback = { rating: Number(payload.rating), note: typeof payload.note === "string" ? payload.note : null, submitted_at_ms: Date.now() };
    task.updated_at_ms = Date.now(); await updateTask(task); return json(task);
  }
  if (segments[0] === "brand-profiles" && segments.length === 2 && method === "GET") {
    const profile = await getProfile(ownerId, decodeURIComponent(segments[1]));
    if (!profile) throw new Error("Brand profile not found."); return json(profile);
  }
  if (segments[0] === "brand-profiles" && segments.length === 2 && method === "PUT") {
    const payload = await body(request) as unknown as BrandProfile;
    const previous = await getProfile(ownerId, decodeURIComponent(segments[1]));
    const profile = { ...payload, id: decodeURIComponent(segments[1]), version: (previous?.version ?? 0) + 1, updated_at_ms: Date.now() };
    await putProfile(ownerId, profile); return json(profile);
  }
  if (segments[0] === "tasks" && segments[2] === "routine" && method === "POST") {
    const task = await ownedTask(ownerId, segments[1]) as OperatorCompletedTask;
    if (task.bot !== "operator" || task.status.data.workflow.state !== "completed") throw new Error("Only a completed Operator run can become a routine.");
    const payload = await body(request); const id = String(payload.id ?? "").trim(); if (!id) throw new Error("Routine id is required.");
    const previous = await getRoutine(ownerId, id); const now = Date.now();
    const routine: OperatorRoutine = { id, name: String(payload.name ?? id), description: String(payload.description ?? ""), version: (previous?.version ?? 0) + 1, created_at_ms: previous?.created_at_ms ?? now, updated_at_ms: now, input: task.input as OperatorTaskInput };
    await putRoutine(ownerId, routine); return json(routine, 201);
  }
  if (segments[0] === "routines" && segments.length === 1 && method === "GET") return json(await listRoutines(ownerId));
  if (segments[0] === "routines" && segments[2] === "runs" && method === "POST") {
    const routine = await getRoutine(ownerId, decodeURIComponent(segments[1])); if (!routine) throw new Error("Routine not found.");
    return json(await createAndExecuteTask(ownerId, { prompt: routine.input.objective, bot: "operator", input: routine.input }), 201);
  }
  return json({ error: "Route not found." }, 404);
}

async function handle(request: Request, context: Context): Promise<Response> {
  try { return await route(request, context); } catch (cause) { return failure(cause); }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
