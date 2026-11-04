import { createHash } from "node:crypto";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

import type { BrandProfile, OperatorRoutine, Task } from "@/lib/donads-api";

type ChallengeRow = {
  address: string;
  message: string;
  expires_at_ms: string | number;
  consumed: boolean;
};

let client: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

function connectionString(): string {
  const value = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!value) throw new Error("DATABASE_URL is not configured for DONADS.");
  return value;
}

export function sql(): NeonQueryFunction<false, false> {
  client ??= neon(connectionString());
  return client;
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    const db = sql();
    await db`CREATE TABLE IF NOT EXISTS donads_challenges (
      address TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      expires_at_ms BIGINT NOT NULL,
      consumed BOOLEAN NOT NULL DEFAULT FALSE
    )`;
    await db`CREATE TABLE IF NOT EXISTS donads_sessions (
      token_hash TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      expires_at_ms BIGINT NOT NULL,
      revoked BOOLEAN NOT NULL DEFAULT FALSE,
      created_at_ms BIGINT NOT NULL
    )`;
    await db`CREATE INDEX IF NOT EXISTS donads_sessions_owner_idx ON donads_sessions(owner_id)`;
    await db`CREATE TABLE IF NOT EXISTS donads_tasks (
      id UUID PRIMARY KEY,
      owner_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      bot TEXT NOT NULL,
      input JSONB NOT NULL,
      events JSONB NOT NULL,
      status JSONB NOT NULL,
      feedback JSONB,
      created_at_ms BIGINT NOT NULL,
      updated_at_ms BIGINT NOT NULL
    )`;
    await db`CREATE INDEX IF NOT EXISTS donads_tasks_owner_updated_idx ON donads_tasks(owner_id, updated_at_ms DESC)`;
    await db`CREATE TABLE IF NOT EXISTS donads_profiles (
      owner_id TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL,
      PRIMARY KEY(owner_id, id)
    )`;
    await db`CREATE TABLE IF NOT EXISTS donads_routines (
      owner_id TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL,
      PRIMARY KEY(owner_id, id)
    )`;
    await db`CREATE TABLE IF NOT EXISTS donads_rate_limits (
      key_hash TEXT NOT NULL,
      window_start_ms BIGINT NOT NULL,
      requests INTEGER NOT NULL,
      PRIMARY KEY(key_hash, window_start_ms)
    )`;
    await db`CREATE TABLE IF NOT EXISTS donads_ai_leases (
      owner_id TEXT PRIMARY KEY,
      request_id UUID NOT NULL,
      expires_at_ms BIGINT NOT NULL
    )`;
    await db`CREATE TABLE IF NOT EXISTS donads_ai_usage (
      request_id UUID PRIMARY KEY,
      owner_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at_ms BIGINT NOT NULL
    )`;
    await db`CREATE INDEX IF NOT EXISTS donads_ai_usage_owner_created_idx ON donads_ai_usage(owner_id, created_at_ms DESC)`;
  })();
  return schemaReady;
}

export async function putChallenge(address: string, message: string, expiresAtMs: number) {
  await ensureSchema();
  const db = sql();
  await db`INSERT INTO donads_challenges(address, message, expires_at_ms, consumed)
    VALUES (${address}, ${message}, ${expiresAtMs}, FALSE)
    ON CONFLICT(address) DO UPDATE SET message = EXCLUDED.message, expires_at_ms = EXCLUDED.expires_at_ms, consumed = FALSE`;
}

export async function getChallenge(address: string): Promise<ChallengeRow | null> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT address, message, expires_at_ms, consumed FROM donads_challenges
    WHERE address = ${address} AND consumed = FALSE AND expires_at_ms > ${Date.now()} LIMIT 1` as ChallengeRow[];
  return rows[0] ?? null;
}

export async function consumeChallenge(address: string, message: string): Promise<boolean> {
  await ensureSchema();
  const db = sql();
  const rows = await db`UPDATE donads_challenges SET consumed = TRUE
    WHERE address = ${address} AND message = ${message} AND consumed = FALSE AND expires_at_ms > ${Date.now()}
    RETURNING address` as Array<{ address: string }>;
  return rows.length === 1;
}

export async function takeRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  await ensureSchema();
  const db = sql();
  const keyHash = createHash("sha256").update(key).digest("hex");
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const rows = await db`INSERT INTO donads_rate_limits(key_hash, window_start_ms, requests)
    VALUES (${keyHash}, ${windowStart}, 1)
    ON CONFLICT(key_hash, window_start_ms) DO UPDATE SET requests = donads_rate_limits.requests + 1
    RETURNING requests` as Array<{ requests: number }>;
  return Number(rows[0]?.requests ?? limit + 1) <= limit;
}

export async function acquireAiLease(ownerId: string, requestId: string, expiresAtMs: number): Promise<boolean> {
  await ensureSchema();
  const db = sql();
  const rows = await db`INSERT INTO donads_ai_leases(owner_id, request_id, expires_at_ms)
    VALUES (${ownerId}, ${requestId}, ${expiresAtMs})
    ON CONFLICT(owner_id) DO UPDATE SET request_id = EXCLUDED.request_id, expires_at_ms = EXCLUDED.expires_at_ms
    WHERE donads_ai_leases.expires_at_ms <= ${Date.now()}
    RETURNING owner_id` as Array<{ owner_id: string }>;
  return rows.length === 1;
}

export async function releaseAiLease(ownerId: string, requestId: string): Promise<void> {
  await ensureSchema();
  const db = sql();
  await db`DELETE FROM donads_ai_leases WHERE owner_id = ${ownerId} AND request_id = ${requestId}`;
}

export async function recordAiUsage(input: { requestId: string; ownerId: string; provider: string; model: string; inputTokens: number; outputTokens: number; status: string }): Promise<void> {
  await ensureSchema();
  const db = sql();
  await db`INSERT INTO donads_ai_usage(request_id, owner_id, provider, model, input_tokens, output_tokens, status, created_at_ms)
    VALUES (${input.requestId}, ${input.ownerId}, ${input.provider}, ${input.model}, ${input.inputTokens}, ${input.outputTokens}, ${input.status}, ${Date.now()})
    ON CONFLICT(request_id) DO UPDATE SET input_tokens = EXCLUDED.input_tokens, output_tokens = EXCLUDED.output_tokens, status = EXCLUDED.status`;
}

export async function getAiUsageSince(ownerId: string, sinceMs: number): Promise<number> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT COUNT(*)::int AS requests FROM donads_ai_usage
    WHERE owner_id = ${ownerId} AND created_at_ms >= ${sinceMs}` as Array<{ requests: number }>;
  return Number(rows[0]?.requests ?? 0);
}

export async function createSession(token: string, ownerId: string, expiresAtMs: number) {
  await ensureSchema();
  const db = sql();
  await db`INSERT INTO donads_sessions(token_hash, owner_id, expires_at_ms, revoked, created_at_ms)
    VALUES (${tokenHash(token)}, ${ownerId}, ${expiresAtMs}, FALSE, ${Date.now()})`;
}

export async function sessionOwner(token: string): Promise<string | null> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT owner_id FROM donads_sessions
    WHERE token_hash = ${tokenHash(token)} AND revoked = FALSE AND expires_at_ms > ${Date.now()}
    LIMIT 1` as Array<{ owner_id: string }>;
  return rows[0]?.owner_id ?? null;
}

export async function revokeSession(token: string): Promise<void> {
  await ensureSchema();
  const db = sql();
  await db`UPDATE donads_sessions SET revoked = TRUE WHERE token_hash = ${tokenHash(token)}`;
}

export async function insertTask(task: Task): Promise<void> {
  await ensureSchema();
  const db = sql();
  await db`INSERT INTO donads_tasks(id, owner_id, prompt, bot, input, events, status, feedback, created_at_ms, updated_at_ms)
    VALUES (${task.id}, ${task.owner_id}, ${task.prompt}, ${task.bot}, ${JSON.stringify(task.input)}, ${JSON.stringify(task.events)}, ${JSON.stringify(task.status)}, ${JSON.stringify(task.feedback)}, ${task.created_at_ms}, ${task.updated_at_ms})`;
}

export async function updateTask(task: Task): Promise<void> {
  await ensureSchema();
  const db = sql();
  await db`UPDATE donads_tasks SET events = ${JSON.stringify(task.events)}, status = ${JSON.stringify(task.status)},
    feedback = ${JSON.stringify(task.feedback)}, updated_at_ms = ${task.updated_at_ms}
    WHERE id = ${task.id} AND owner_id = ${task.owner_id}`;
}

export async function getTask(ownerId: string, id: string): Promise<Task | null> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT id::text, owner_id, prompt, bot, input, events, status, feedback, created_at_ms, updated_at_ms
    FROM donads_tasks WHERE id = ${id} AND owner_id = ${ownerId} LIMIT 1` as Array<Record<string, unknown>>;
  return rows[0] ? hydrateTask(rows[0]) : null;
}

export async function listTasks(ownerId: string, limit: number): Promise<Task[]> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT id::text, owner_id, prompt, bot, input, events, status, feedback, created_at_ms, updated_at_ms
    FROM donads_tasks WHERE owner_id = ${ownerId} ORDER BY updated_at_ms DESC LIMIT ${limit}` as Array<Record<string, unknown>>;
  return rows.map(hydrateTask);
}

function hydrateTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    owner_id: String(row.owner_id),
    prompt: String(row.prompt),
    bot: String(row.bot),
    input: row.input,
    events: row.events as Task["events"],
    status: row.status as Task["status"],
    feedback: (row.feedback ?? null) as Task["feedback"],
    created_at_ms: Number(row.created_at_ms),
    updated_at_ms: Number(row.updated_at_ms),
  } as Task;
}

export async function putProfile(ownerId: string, profile: BrandProfile): Promise<void> {
  await ensureSchema();
  const db = sql();
  await db`INSERT INTO donads_profiles(owner_id, id, data) VALUES (${ownerId}, ${profile.id}, ${JSON.stringify(profile)})
    ON CONFLICT(owner_id, id) DO UPDATE SET data = EXCLUDED.data`;
}

export async function getProfile(ownerId: string, id: string): Promise<BrandProfile | null> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT data FROM donads_profiles WHERE owner_id = ${ownerId} AND id = ${id} LIMIT 1` as Array<{ data: BrandProfile }>;
  return rows[0]?.data ?? null;
}

export async function putRoutine(ownerId: string, routine: OperatorRoutine): Promise<void> {
  await ensureSchema();
  const db = sql();
  await db`INSERT INTO donads_routines(owner_id, id, data) VALUES (${ownerId}, ${routine.id}, ${JSON.stringify(routine)})
    ON CONFLICT(owner_id, id) DO UPDATE SET data = EXCLUDED.data`;
}

export async function getRoutine(ownerId: string, id: string): Promise<OperatorRoutine | null> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT data FROM donads_routines WHERE owner_id = ${ownerId} AND id = ${id} LIMIT 1` as Array<{ data: OperatorRoutine }>;
  return rows[0]?.data ?? null;
}

export async function listRoutines(ownerId: string): Promise<OperatorRoutine[]> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT data FROM donads_routines WHERE owner_id = ${ownerId} ORDER BY (data->>'updated_at_ms')::bigint DESC` as Array<{ data: OperatorRoutine }>;
  return rows.map((row) => row.data);
}
