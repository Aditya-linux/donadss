import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { getAddress, isAddress } from "viem";

import type {
  CommerceCompletedTask,
  CommerceOffer,
  FlowCompletedTask,
  GrowthCompletedTask,
  OperatorCompletedTask,
  OperatorTaskInput,
  ScoutCompletedTask,
  SentinelCompletedTask,
} from "@/lib/donads-api";
import { generateGeminiJson } from "@/server/gemini";

type RecordValue = Record<string, unknown>;
type CompletedStatus =
  | ScoutCompletedTask["status"]
  | GrowthCompletedTask["status"]
  | FlowCompletedTask["status"]
  | CommerceCompletedTask["status"]
  | OperatorCompletedTask["status"]
  | SentinelCompletedTask["status"];

function object(value: unknown, label = "input"): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as RecordValue;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error(`${label} must be a string array.`);
  return value;
}

function parseBytecode(value: unknown): Uint8Array {
  const source = text(value, "bytecode").replace(/^0x/i, "");
  if (!source || source.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(source)) throw new Error("Bytecode must be non-empty, even-length hexadecimal.");
  return Uint8Array.from(source.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function sentinel(input: unknown, started: number): SentinelCompletedTask["status"] {
  const bytes = parseBytecode(object(input).bytecode);
  const signals = new Map<number, { id: string; severity: string; title: string }>([
    [0xff, { id: "SELFDESTRUCT_REACHABLE", severity: "high", title: "Reachable SELFDESTRUCT opcode" }],
    [0xf4, { id: "DELEGATECALL_REACHABLE", severity: "medium", title: "Reachable DELEGATECALL opcode" }],
    [0xf2, { id: "CALLCODE_REACHABLE", severity: "medium", title: "Reachable CALLCODE opcode" }],
    [0x32, { id: "TX_ORIGIN_USED", severity: "low", title: "ORIGIN opcode is present" }],
  ]);
  const findings: SentinelCompletedTask["status"]["data"]["findings"] = [];
  let cursor = 0;
  while (cursor < bytes.length) {
    const opcode = bytes[cursor];
    const signal = signals.get(opcode);
    if (signal && !findings.some((finding) => finding.id === signal.id)) {
      findings.push({ ...signal, evidence: `Opcode 0x${opcode.toString(16).padStart(2, "0")} at byte offset ${cursor}.` });
    }
    cursor += opcode >= 0x60 && opcode <= 0x7f ? opcode - 0x5f + 1 : 1;
  }
  const score = Math.min(100, findings.reduce((total, finding) => total + (finding.severity === "high" ? 60 : finding.severity === "medium" ? 30 : 10), 0));
  return {
    state: "completed",
    summary: findings.length ? `Sentinel found ${findings.length} high-confidence risk signal(s); threat score ${score}/100.` : "Sentinel found no high-confidence opcode signals; threat score 0/100.",
    data: { threat_score: score, bytecode_bytes: bytes.length, findings, scope: "Executable EVM bytecode only", disclaimer: "Deterministic opcode triage is not a complete smart-contract audit." },
    latency_ms: Date.now() - started,
  };
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] >= 224;
}

async function validatePublicUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("Scout accepts public HTTP(S) URLs without embedded credentials.");
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) throw new Error("Scout blocks private-network sources.");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("Scout blocks private or reserved network sources.");
  return url;
}

async function fetchPublicSource(source: string): Promise<{ url: string; title: string; body: string }> {
  let url = await validatePublicUrl(source);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(url, { redirect: "manual", headers: { "user-agent": "DONADS-Scout/1.0" }, signal: AbortSignal.timeout(10_000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === 3) throw new Error("Source redirected too many times.");
      url = await validatePublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/") && !contentType.includes("json")) throw new Error("Source is not readable text.");
    const raw = (await response.text()).slice(0, 500_000);
    const title = raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || url.hostname;
    const body = raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    return { url: url.toString(), title, body };
  }
  throw new Error("Source could not be fetched.");
}

async function scout(input: unknown, started: number, ownerId?: string): Promise<ScoutCompletedTask["status"]> {
  const scoutInput = object(input);
  const sources = stringArray(scoutInput.sources ?? [], "sources").slice(0, 5);
  const attachments = Array.isArray(scoutInput.attachments) ? scoutInput.attachments.map((value) => {
    const item = object(value, "attachment");
    return { name: text(item.name, "attachment.name"), mimeType: text(item.mime_type, "attachment.mime_type"), data: text(item.data, "attachment.data") };
  }) : [];
  if (!sources.length && !attachments.length) throw new Error("Scout requires a public source URL or an AI-readable attachment.");
  const reportSources: ScoutCompletedTask["status"]["data"]["report"]["sources"] = [];
  const findings: ScoutCompletedTask["status"]["data"]["report"]["findings"] = [];
  await Promise.all(sources.map(async (source, index) => {
    try {
      const fetched = await fetchPublicSource(source);
      reportSources[index] = { id: index + 1, title: fetched.title, url: fetched.url, status: "fetched", error: null };
      findings[index] = { text: fetched.body.slice(0, 500) || "The source did not contain readable text.", citations: [index + 1] };
    } catch (cause) {
      reportSources[index] = { id: index + 1, title: "Source unavailable", url: source, status: "failed", error: cause instanceof Error ? cause.message : "Fetch failed." };
    }
  }));
  attachments.forEach((attachment, index) => { reportSources.push({ id: sources.length + index + 1, title: attachment.name, url: `attachment:${encodeURIComponent(attachment.name)}`, status: "fetched", error: null }); });
  let validFindings = findings.filter(Boolean);
  if (ownerId && (validFindings.length || attachments.length)) {
    try {
      const enhanced = await generateGeminiJson<{ findings: Array<{ text: string; citations: number[] }> }>({
        ownerId,
        system: "Summarize only the supplied source excerpts. Every finding must cite one or more valid source IDs. Do not add outside facts, URLs, or unsupported claims.",
        prompt: JSON.stringify(reportSources.map((source, index) => ({ id: source.id, title: source.title, excerpt: findings[index]?.text ?? "Analyze the attached file and cite this source ID." }))),
        schema: { type: "object", properties: { findings: { type: "array", items: { type: "object", properties: { text: { type: "string" }, citations: { type: "array", items: { type: "integer" } } }, required: ["text", "citations"], additionalProperties: false } } }, required: ["findings"], additionalProperties: false },
        attachments,
      });
      const validIds = new Set(reportSources.filter((source) => source.status === "fetched").map((source) => source.id));
      const checked = enhanced?.findings.filter((finding) => finding.text.trim() && finding.citations.length && finding.citations.every((id) => validIds.has(id)));
      if (checked?.length) validFindings = checked;
    } catch { /* Deterministic cited excerpts remain the fail-closed fallback. */ }
  }
  if (!validFindings.length && attachments.length) throw new Error("Scout could not analyze the attachment. Check the Gemini key, quota, and file format, then retry.");
  return { state: "completed", summary: `Scout reviewed ${reportSources.filter((source) => source.status === "fetched").length}/${sources.length} supplied sources and produced ${validFindings.length} cited finding(s).`, data: { report: { title: "Source-linked research report", findings: validFindings, sources: reportSources, limitations: "Scout summarizes only the supplied public sources. Verify important claims in the originals." }, agent_version: "scout-vercel-v1", read_only: true }, latency_ms: Date.now() - started };
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) throw new Error("start_date must be a valid ISO date.");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function growth(input: unknown, started: number, ownerId?: string): Promise<GrowthCompletedTask["status"]> {
  const data = object(input);
  const profile = object(data.profile, "profile");
  const project = text(profile.project_name, "profile.project_name");
  const objective = text(data.objective, "objective");
  const audience = text(profile.target_audience, "profile.target_audience");
  const tone = text(profile.preferred_tone, "profile.preferred_tone");
  const pillars = stringArray(profile.value_propositions, "profile.value_propositions");
  if (!pillars.length) throw new Error("At least one value proposition is required.");
  const platforms = stringArray(data.platforms, "platforms") as Array<"x" | "linkedin" | "community" | "email">;
  if (!platforms.length) throw new Error("At least one platform is required.");
  const duration = Math.min(30, Math.max(1, Number(data.duration_days)));
  const startDate = text(data.start_date, "start_date");
  const approvedLinks = stringArray(profile.approved_links ?? [], "profile.approved_links");
  const calendar = Array.from({ length: duration }, (_, index) => {
    const platform = platforms[index % platforms.length];
    const pillar = pillars[index % pillars.length];
    return { day: index + 1, date: addDays(startDate, index), platform, format: platform === "email" ? "Email brief" : "Short post", objective: index === 0 ? "Introduce the objective" : "Build evidence and understanding", draft: `${project}: ${pillar}. ${objective}. Built for ${audience}.`, call_to_action: "Review the cited material and share feedback.", visual_asset: `One ${tone} product visual for ${platform}.`, status: "draft" as const, evidence_urls: approvedLinks };
  });
  if (ownerId) {
    try {
      const enhanced = await generateGeminiJson<{ drafts: Array<{ day: number; draft: string; call_to_action: string }> }>({
        ownerId,
        system: "Improve campaign drafts using only the supplied brief. Preserve each day number. Return reviewable drafts only; never claim publishing, transactions, endorsements, or unverifiable results. Avoid prohibited terms.",
        prompt: JSON.stringify({ project, objective, audience, tone, pillars, prohibited_terms: profile.prohibited_terms ?? [], calendar }),
        schema: { type: "object", properties: { drafts: { type: "array", maxItems: duration, items: { type: "object", properties: { day: { type: "integer" }, draft: { type: "string" }, call_to_action: { type: "string" } }, required: ["day", "draft", "call_to_action"], additionalProperties: false } } }, required: ["drafts"], additionalProperties: false },
      });
      for (const draft of enhanced?.drafts ?? []) { const target = calendar.find((item) => item.day === draft.day); if (target && draft.draft.trim()) { target.draft = draft.draft.trim(); target.call_to_action = draft.call_to_action.trim() || target.call_to_action; } }
    } catch { /* Template drafts remain available when the model is unavailable. */ }
  }
  return { state: "completed", summary: `Growth prepared ${calendar.length} reviewable draft(s); no content was published.`, data: { campaign: { project_name: project, objective, target_audience: audience, tone, message_pillars: pillars, calendar, required_asset_count: calendar.length, restrictions_applied: stringArray(profile.prohibited_terms ?? [], "profile.prohibited_terms"), status: "draft", publishing: "disabled" }, agent_version: "growth-vercel-v1", external_actions: false }, latency_ms: Date.now() - started };
}

function decimalAmount(value: unknown): string {
  const amount = text(value, "amount");
  if (!/^\d+(?:\.\d{1,18})?$/.test(amount) || Number(amount) <= 0) throw new Error("MON amount must be positive with at most 18 decimal places.");
  return amount;
}

function flow(input: unknown, started: number): FlowCompletedTask["status"] {
  const data = object(input);
  const payer = text(data.payer, "payer");
  if (!isAddress(payer)) throw new Error("payer must be a valid EVM address.");
  if (!Array.isArray(data.payouts) || data.payouts.length !== 1) throw new Error("Flow currently requires exactly one payout.");
  const payout = object(data.payouts[0], "payout");
  const recipient = text(payout.recipient_address, "recipient_address");
  if (!isAddress(recipient)) throw new Error("recipient_address must be a valid EVM address.");
  const amount = decimalAmount(payout.amount);
  const now = Date.now();
  const workflow = { id: crypto.randomUUID(), title: text(data.title, "title"), purpose: text(data.purpose, "purpose"), payer: getAddress(payer).toLowerCase(), network: "Monad Testnet" as const, chain_id: 10143 as const, state: "awaiting_approval" as const, payouts: [{ recipient_name: text(payout.recipient_name, "recipient_name"), recipient_address: getAddress(recipient).toLowerCase(), asset: "MON", amount, milestone: text(payout.milestone, "milestone"), deadline: typeof payout.deadline === "string" ? payout.deadline : null }], totals: [{ asset: "MON", amount }], approval_conditions: stringArray(data.approval_conditions, "approval_conditions"), linked_task_id: typeof data.linked_task_id === "string" ? data.linked_task_id : null, approval: null, submission: null, execution: null, audit_history: [{ sequence: 1, event: "intent_created", detail: "Exact Monad Testnet transfer prepared; no signature requested.", at_ms: now }] };
  return { state: "completed", summary: "Flow prepared an exact Monad Testnet transfer intent and is waiting for explicit wallet approval.", data: { workflow, agent_version: "flow-vercel-v1", execution_available: false, blocked_reason: "The user must approve and broadcast the exact transaction in their browser wallet." }, latency_ms: Date.now() - started };
}

function commerce(input: unknown, started: number): CommerceCompletedTask["status"] {
  const data = object(input);
  const asset = text(data.asset, "asset").toUpperCase();
  const budget = BigInt(text(data.budget_atomic, "budget_atomic"));
  if (!Array.isArray(data.offers) || !data.offers.length) throw new Error("At least one merchant offer is required.");
  const offers = data.offers.map((value) => object(value, "offer") as unknown as CommerceOffer).filter((offer) => offer.in_stock && offer.crypto_payment_supported && offer.asset.toUpperCase() === asset && BigInt(offer.total_atomic) <= budget);
  if (!offers.length) throw new Error("No in-stock crypto offer fits the exact asset and budget.");
  offers.sort((left, right) => (BigInt(left.total_atomic) < BigInt(right.total_atomic) ? -1 : 1));
  const selected = offers[0];
  for (const field of [selected.source_url, selected.checkout_url]) {
    const url = new URL(field);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Merchant evidence URLs must use HTTP(S).");
  }
  const now = Date.now();
  const workflow = { id: crypto.randomUUID(), objective: text(data.objective, "objective"), state: "awaiting_approval" as const, selected_offer: selected, alternatives_considered: data.offers.length - 1, budget_atomic: budget.toString(), total_atomic: selected.total_atomic, asset, approval_id: null, approved_at_ms: null, merchant_invoice: null, payment_proof: null, order_receipt: null, audit_history: [{ sequence: 1, event: "offer_selected", detail: "Source-linked crypto offer selected within budget; no order placed.", at_ms: now }] };
  return { state: "completed", summary: "Commerce selected a source-linked crypto offer and is waiting for exact user authorization; no order has been placed.", data: { workflow, agent_version: "commerce-crypto-order-v2", execution_available: false, blocked_reason: "A configured merchant API, invoice, wallet payment, and verified merchant receipt are required to complete an order." }, latency_ms: Date.now() - started };
}

function operator(input: unknown, started: number): OperatorCompletedTask["status"] {
  const data = object(input) as unknown as OperatorTaskInput;
  if (!data.objective?.trim() || !Array.isArray(data.steps) || !data.steps.length) throw new Error("Operator requires an objective and at least one step.");
  const ids = new Set<string>();
  data.steps.forEach((step, index) => {
    if (!step.id || ids.has(step.id)) throw new Error("Operator step IDs must be unique.");
    if (step.depends_on.some((dependency) => !ids.has(dependency))) throw new Error("Each dependency must refer to an earlier step.");
    ids.add(step.id);
    if (!['scout', 'growth', 'flow', 'commerce'].includes(step.bot)) throw new Error(`Unsupported specialist at step ${index + 1}.`);
  });
  const now = Date.now();
  const workflow = { id: crypto.randomUUID(), objective: data.objective.trim(), target_date: data.target_date ?? null, state: "planned" as const, steps: data.steps.map((step, index) => ({ ...step, order: index + 1, status: "pending" as const, task_id: null, summary: null, error: null })), cancellation_requested: false, started_at_ms: null, completed_at_ms: null, audit_history: [{ sequence: 1, event: "plan_created", detail: "Dependency graph validated; execution requires explicit start.", at_ms: now }], permissions: { external_writes: false as const, publishing_available: false as const, signing_available: false as const, fund_movement_available: false as const } };
  return { state: "completed", summary: `Operator prepared ${workflow.steps.length} dependency-validated step(s).`, data: { workflow, agent_version: "operator-orchestration-v2", external_actions: false }, latency_ms: Date.now() - started };
}

export async function executeBot(bot: string, input: unknown, ownerId?: string): Promise<CompletedStatus> {
  const started = Date.now();
  switch (bot) {
    case "scout": return scout(input, started, ownerId);
    case "growth": return growth(input, started, ownerId);
    case "flow": return flow(input, started);
    case "commerce": return commerce(input, started);
    case "operator": return operator(input, started);
    case "sentinel": return sentinel(input, started);
    default: throw new Error(`Unknown specialist: ${bot}.`);
  }
}

export function monToWei(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(10) ** BigInt(18) + BigInt(fraction.padEnd(18, "0"));
}
