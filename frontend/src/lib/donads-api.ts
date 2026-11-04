export type TaskEvent = {
  sequence: number;
  kind: string;
  message: string;
  at_ms: number;
};

export type ScoutFinding = { text: string; citations: number[] };

export type ScoutSource = {
  id: number;
  title: string;
  url: string;
  status: "fetched" | "failed";
  error: string | null;
};

export type ScoutReport = {
  title: string;
  findings: ScoutFinding[];
  sources: ScoutSource[];
  limitations: string;
};

export type BrandProfile = {
  id: string;
  project_name: string;
  product_description: string;
  target_audience: string;
  preferred_tone: string;
  terminology: string[];
  value_propositions: string[];
  approved_links: string[];
  prohibited_terms: string[];
  previous_approved_examples: string[];
  version: number;
  updated_at_ms: number;
};

export type CampaignDay = {
  day: number;
  date: string;
  platform: "x" | "linkedin" | "community" | "email";
  format: string;
  objective: string;
  draft: string;
  call_to_action: string;
  visual_asset: string;
  status: "draft";
  evidence_urls: string[];
};

export type GrowthCampaign = {
  project_name: string;
  objective: string;
  target_audience: string;
  tone: string;
  message_pillars: string[];
  calendar: CampaignDay[];
  required_asset_count: number;
  restrictions_applied: string[];
  status: "draft";
  publishing: "disabled";
};

export type FlowPayout = {
  recipient_name: string;
  recipient_address: string;
  asset: string;
  amount: string;
  milestone: string;
  deadline: string | null;
};

export type PaymentWorkflow = {
  id: string;
  title: string;
  purpose: string;
  payer: string;
  network: "Monad Testnet";
  chain_id: 10143;
  state:
    | "awaiting_approval"
    | "authorized"
    | "confirmed"
    | "rejected";
  payouts: FlowPayout[];
  totals: Array<{ asset: string; amount: string }>;
  approval_conditions: string[];
  linked_task_id: string | null;
  approval: { decision: string; note: string; decided_at_ms: number } | null;
  execution: {
    transaction_hash: string;
    block_number: number;
    confirmed_at_ms: number;
  } | null;
  audit_history: Array<{
    sequence: number;
    event: string;
    detail: string;
    at_ms: number;
  }>;
};

export type CommerceOffer = {
  id: string;
  name: string;
  merchant: string;
  source_url: string;
  checkout_url: string;
  total_atomic: string;
  asset: string;
  in_stock: boolean;
  rating: number | null;
  evidence_note: string;
  crypto_payment_supported: boolean;
};

export type CommerceWorkflow = {
  id: string;
  objective: string;
  state:
    | "awaiting_approval"
    | "authorized"
    | "invoice_created"
    | "payment_submitted"
    | "completed"
    | "rejected"
    ;
  selected_offer: CommerceOffer;
  alternatives_considered: number;
  budget_atomic: string;
  total_atomic: string;
  asset: string;
  approval_id: string | null;
  approved_at_ms: number | null;
  merchant_invoice?: {
    provider: string;
    invoice_id: string;
    checkout_url: string;
    asset: string;
    amount_atomic: string;
    expires_at_ms: number | null;
  } | null;
  payment_proof?: {
    invoice_id: string;
    transaction_hash: string;
    confirmed_at_ms: number;
  } | null;
  order_receipt?: {
    provider: string;
    order_id: string;
    receipt_url: string;
    status: string;
    verified_at_ms: number;
  } | null;
  audit_history: Array<{
    sequence: number;
    event: string;
    detail: string;
    at_ms: number;
  }>;
};

export type OperatorStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

export type OperatorWorkflow = {
  id: string;
  objective: string;
  target_date: string | null;
  state:
    | "planned"
    | "running"
    | "cancelling"
    | "completed"
    | "partial_failure"
    | "failed"
    | "cancelled";
  steps: Array<{
    id: string;
    order: number;
    title: string;
    bot: "scout" | "growth" | "flow" | "commerce";
    prompt: string;
    input: unknown;
    depends_on: string[];
    status: OperatorStepStatus;
    task_id: string | null;
    summary: string | null;
    error: string | null;
  }>;
  cancellation_requested: boolean;
  started_at_ms: number | null;
  completed_at_ms: number | null;
  audit_history: Array<{
    sequence: number;
    event: string;
    detail: string;
    at_ms: number;
  }>;
  permissions: {
    external_writes: false;
    publishing_available: false;
    signing_available: false;
    fund_movement_available: false;
  };
};

export type TaskBase = {
  id: string;
  owner_id: string;
  prompt: string;
  bot: string;
  input: unknown;
  events: TaskEvent[];
  created_at_ms: number;
  updated_at_ms: number;
  feedback: { rating: number; note: string | null; submitted_at_ms: number } | null;
};

export type ScoutCompletedTask = TaskBase & {
  bot: "scout";
  status: {
    state: "completed";
    summary: string;
    data: {
      report: ScoutReport;
      agent_version: string;
      read_only: boolean;
    };
    latency_ms: number;
  };
};

export type GrowthCompletedTask = TaskBase & {
  bot: "growth";
  status: {
    state: "completed";
    summary: string;
    data: {
      campaign: GrowthCampaign;
      agent_version: string;
      external_actions: false;
    };
    latency_ms: number;
  };
};

export type FlowCompletedTask = TaskBase & {
  bot: "flow";
  status: {
    state: "completed";
    summary: string;
    data: {
      workflow: PaymentWorkflow;
      agent_version: string;
      execution_available: false;
      blocked_reason: string;
    };
    latency_ms: number;
  };
};

export type CommerceCompletedTask = TaskBase & {
  bot: "commerce";
  status: {
    state: "completed";
    summary: string;
    data: {
      workflow: CommerceWorkflow;
      agent_version: "commerce-crypto-order-v2";
      execution_available: false;
      blocked_reason: string;
    };
    latency_ms: number;
  };
};

export type OperatorCompletedTask = TaskBase & {
  bot: "operator";
  status: {
    state: "completed";
    summary: string;
    data: {
      workflow: OperatorWorkflow;
      agent_version: "operator-orchestration-v2";
      external_actions: false;
    };
    latency_ms: number;
  };
};

export type SentinelCompletedTask = TaskBase & {
  bot: "sentinel";
  status: {
    state: "completed";
    summary: string;
    data: {
      threat_score: number;
      bytecode_bytes: number;
      findings: Array<{
        id: string;
        severity: string;
        title: string;
        evidence: string;
      }>;
      scope: string;
      disclaimer: string;
    };
    latency_ms: number;
  };
};

export type CompletedTask =
  | ScoutCompletedTask
  | GrowthCompletedTask
  | FlowCompletedTask
  | CommerceCompletedTask
  | OperatorCompletedTask
  | SentinelCompletedTask;

type PendingTask = TaskBase & { status: { state: "queued" | "running" } };
type FailedTask = TaskBase & {
  status: { state: "failed"; error: string; latency_ms: number };
};
export type Task = CompletedTask | PendingTask | FailedTask;

function isCompletedTask(task: Task): task is CompletedTask {
  return task.status.state === "completed";
}

function isFailedTask(task: Task): task is FailedTask {
  return task.status.state === "failed";
}

const API_URL =
  process.env.NEXT_PUBLIC_DONADS_API_URL ?? "/api";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return globalThis.fetch(input, { ...init, headers });
}

export async function createAuthChallenge(address: string): Promise<{ message: string }> {
  const response = await globalThis.fetch(`${API_URL}/v1/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  return readJson<{ message: string }>(response);
}

export async function verifyWalletSignature(
  address: string,
  signature: string,
): Promise<{ access_token: string; owner_id: string; expires_at: string }> {
  const response = await globalThis.fetch(`${API_URL}/v1/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature }),
  });
  return readJson(response);
}

export async function revokeWalletSession(): Promise<void> {
  const response = await apiFetch(`${API_URL}/v1/auth/logout`, { method: "POST" });
  if (!response.ok && response.status !== 401) {
    await readJson(response);
  }
  setAccessToken(null);
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function extractSourceUrls(prompt: string): string[] {
  const candidates = prompt.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const unique = new Set<string>();
  for (const candidate of candidates) {
    const cleaned = candidate.replace(/[),.;!?\]}]+$/g, "");
    try {
      const url = new URL(cleaned);
      if (url.protocol === "http:" || url.protocol === "https:") {
        unique.add(url.toString());
      }
    } catch {
      // The API performs the authoritative URL validation.
    }
  }
  if (unique.size === 0) {
    throw new ApiError(
      "Add at least one public http:// or https:// source for Scout to research.",
    );
  }
  if (unique.size > 5) {
    throw new ApiError("Scout accepts up to 5 sources per task.");
  }
  return [...unique];
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new ApiError(payload.error ?? `Request failed with ${response.status}.`);
  }
  return payload;
}

export async function createScoutTask(
  prompt: string,
  signal?: AbortSignal,
): Promise<Task> {
  const sources = extractSourceUrls(prompt);
  const response = await apiFetch(`${API_URL}/v1/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, bot: "scout", input: { sources } }),
    signal,
  });
  return readJson<Task>(response);
}

export async function createSentinelTask(
  bytecode: string,
  signal?: AbortSignal,
): Promise<Task> {
  const response = await apiFetch(`${API_URL}/v1/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Analyze supplied EVM bytecode",
      bot: "sentinel",
      input: { bytecode },
    }),
    signal,
  });
  return readJson<Task>(response);
}

export type GrowthTaskInput = {
  objective: string;
  start_date: string;
  duration_days: number;
  platforms: Array<"x" | "linkedin" | "community" | "email">;
  profile: BrandProfile;
  evidence?: Array<{ text: string; source_url: string }>;
};

export async function saveBrandProfile(
  profile: BrandProfile,
  signal?: AbortSignal,
): Promise<BrandProfile> {
  const response = await apiFetch(
    `${API_URL}/v1/brand-profiles/${encodeURIComponent(profile.id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
      signal,
    },
  );
  return readJson<BrandProfile>(response);
}

export async function getBrandProfile(
  id: string,
  signal?: AbortSignal,
): Promise<BrandProfile> {
  const response = await apiFetch(
    `${API_URL}/v1/brand-profiles/${encodeURIComponent(id)}`,
    { signal },
  );
  return readJson<BrandProfile>(response);
}

export async function createGrowthTask(
  input: GrowthTaskInput,
  signal?: AbortSignal,
): Promise<Task> {
  const response = await apiFetch(`${API_URL}/v1/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: input.objective,
      bot: "growth",
      input,
    }),
    signal,
  });
  return readJson<Task>(response);
}

export type FlowTaskInput = {
  title: string;
  purpose: string;
  payer: string;
  payouts: FlowPayout[];
  approval_conditions: string[];
  linked_task_id: string | null;
};

export async function createFlowTask(
  input: FlowTaskInput,
  signal?: AbortSignal,
): Promise<Task> {
  const response = await apiFetch(`${API_URL}/v1/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: input.purpose, bot: "flow", input }),
    signal,
  });
  return readJson<Task>(response);
}

export type CommerceTaskInput = {
  objective: string;
  budget_atomic: string;
  asset: string;
  offers: CommerceOffer[];
};

export async function createCommerceTask(
  input: CommerceTaskInput,
  signal?: AbortSignal,
): Promise<Task> {
  const response = await apiFetch(`${API_URL}/v1/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: input.objective, bot: "commerce", input }),
    signal,
  });
  return readJson<Task>(response);
}

export type CommerceAction =
  | { action: "approve"; approved_total_atomic: string }
  | { action: "reject" };

export async function applyCommerceAction(
  taskId: string,
  action: CommerceAction,
  signal?: AbortSignal,
): Promise<CommerceCompletedTask> {
  const response = await apiFetch(`${API_URL}/v1/tasks/${taskId}/commerce-actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
    signal,
  });
  return readJson<CommerceCompletedTask>(response);
}

export type FlowAction =
  | { action: "approve"; note?: string }
  | { action: "reject"; reason: string };

export async function applyFlowAction(
  taskId: string,
  action: FlowAction,
  signal?: AbortSignal,
): Promise<{ task: FlowCompletedTask; duplicate_prevented: boolean }> {
  const response = await apiFetch(`${API_URL}/v1/tasks/${taskId}/flow-actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
    signal,
  });
  return readJson<{ task: FlowCompletedTask; duplicate_prevented: boolean }>(
    response,
  );
}

export async function confirmFlowTransaction(
  taskId: string,
  transactionHash: string,
  signal?: AbortSignal,
): Promise<FlowCompletedTask> {
  const response = await apiFetch(`${API_URL}/v1/tasks/${taskId}/flow-transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction_hash: transactionHash }),
    signal,
  });
  return readJson<FlowCompletedTask>(response);
}

export type OperatorStepInput = {
  id: string;
  title: string;
  bot: "scout" | "growth" | "flow" | "commerce";
  prompt: string;
  input: unknown;
  depends_on: string[];
};

export type OperatorTaskInput = {
  objective: string;
  target_date: string | null;
  steps: OperatorStepInput[];
};

export type OperatorRoutine = {
  id: string;
  name: string;
  description: string;
  version: number;
  created_at_ms: number;
  updated_at_ms: number;
  input: OperatorTaskInput;
};

export async function createOperatorTask(
  input: OperatorTaskInput,
  signal?: AbortSignal,
): Promise<Task> {
  const response = await apiFetch(`${API_URL}/v1/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: input.objective, bot: "operator", input }),
    signal,
  });
  return readJson<Task>(response);
}

export type OperatorAction =
  | { action: "start" }
  | { action: "cancel" }
  | { action: "retry_failed" };

export async function applyOperatorAction(
  taskId: string,
  action: OperatorAction,
  signal?: AbortSignal,
): Promise<OperatorCompletedTask> {
  const response = await apiFetch(
    `${API_URL}/v1/tasks/${taskId}/operator-actions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
      signal,
    },
  );
  return readJson<OperatorCompletedTask>(response);
}

export async function captureOperatorRoutine(
  taskId: string,
  input: { id: string; name: string; description: string },
  signal?: AbortSignal,
): Promise<OperatorRoutine> {
  const response = await apiFetch(`${API_URL}/v1/tasks/${taskId}/routine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  return readJson<OperatorRoutine>(response);
}

export async function listOperatorRoutines(
  signal?: AbortSignal,
): Promise<OperatorRoutine[]> {
  const response = await apiFetch(`${API_URL}/v1/routines`, { signal });
  return readJson<OperatorRoutine[]>(response);
}

export async function runOperatorRoutine(
  routineId: string,
  signal?: AbortSignal,
): Promise<Task> {
  const response = await apiFetch(
    `${API_URL}/v1/routines/${encodeURIComponent(routineId)}/runs`,
    { method: "POST", signal },
  );
  return readJson<Task>(response);
}

export async function waitForOperator(
  id: string,
  onProgress?: (task: OperatorCompletedTask) => void,
  signal?: AbortSignal,
): Promise<OperatorCompletedTask> {
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    const task = await getTask(id, signal);
    if (task.status.state === "failed") throw new ApiError(task.status.error);
    if (task.status.state === "completed" && task.bot === "operator") {
      const operatorTask = task as OperatorCompletedTask;
      onProgress?.(operatorTask);
      if (
        ["completed", "partial_failure", "failed", "cancelled"].includes(
          operatorTask.status.data.workflow.state,
        )
      ) {
        return operatorTask;
      }
    }
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(resolve, 200);
      signal?.addEventListener(
        "abort",
        () => {
          window.clearTimeout(timeout);
          reject(new DOMException("Request aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }
  throw new ApiError("Operator did not finish within 60 seconds. Try again.");
}

export async function getTask(id: string, signal?: AbortSignal): Promise<Task> {
  const response = await apiFetch(`${API_URL}/v1/tasks/${id}`, { signal });
  return readJson<Task>(response);
}

export async function listTaskHistory(
  limit = 20,
  signal?: AbortSignal,
): Promise<Task[]> {
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  const response = await apiFetch(`${API_URL}/v1/tasks?limit=${safeLimit}`, {
    signal,
  });
  return readJson<Task[]>(response);
}

export async function submitTaskFeedback(
  id: string,
  rating: 1 | 5,
  signal?: AbortSignal,
): Promise<Task> {
  const response = await apiFetch(`${API_URL}/v1/tasks/${id}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
    signal,
  });
  return readJson<Task>(response);
}

export async function waitForTask(
  id: string,
  onProgress?: (task: Task) => void,
  signal?: AbortSignal,
): Promise<CompletedTask> {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    const task = await getTask(id, signal);
    onProgress?.(task);
    if (isCompletedTask(task)) return task;
    if (isFailedTask(task)) throw new ApiError(task.status.error);
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(resolve, 200);
      signal?.addEventListener(
        "abort",
        () => {
          window.clearTimeout(timeout);
          reject(new DOMException("Request aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }
  throw new ApiError("The agent did not finish within 30 seconds. Try again.");
}
