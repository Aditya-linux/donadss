import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const baseUrl = (process.env.DONADS_ACCEPTANCE_API_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

async function request(path, init = {}, token = null) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const payload = response.status === 204 ? null : await response.json();
  return { response, payload };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const account = privateKeyToAccount(generatePrivateKey());
const challenge = await request("/api/v1/auth/challenge", {
  method: "POST",
  body: JSON.stringify({ address: account.address }),
});
assert(challenge.response.status === 201, `Challenge failed: ${JSON.stringify(challenge.payload)}`);

const signature = await account.signMessage({ message: challenge.payload.message });
const verification = await request("/api/v1/auth/verify", {
  method: "POST",
  body: JSON.stringify({ address: account.address, signature }),
});
assert(verification.response.ok, `Verification failed: ${JSON.stringify(verification.payload)}`);
const token = verification.payload.access_token;
const sessionCookie = verification.response.headers.get("set-cookie");
assert(sessionCookie?.includes("donads_session="), "Wallet verification did not set a durable session cookie.");
assert(/HttpOnly/i.test(sessionCookie), "Wallet session cookie is not HttpOnly.");
const restored = await request("/api/v1/auth/session", { headers: { cookie: sessionCookie } });
assert(restored.response.ok && restored.payload.owner_id === account.address.toLowerCase(), "Wallet session did not restore from its secure cookie.");
const balance = await request("/api/v1/wallet/balance", {}, token);
assert(balance.response.ok && balance.payload.chain_id === 10143 && balance.payload.symbol === "MON", "Monad Testnet balance endpoint failed.");
const aiUsage = await request("/api/v1/ai/usage", {}, token);
assert(aiUsage.response.ok && aiUsage.payload.remaining_today >= 0 && aiUsage.payload.remaining_today <= 30, "AI usage endpoint failed.");

const created = await request("/api/v1/tasks", {
  method: "POST",
  body: JSON.stringify({ prompt: "Acceptance scan for executable SELFDESTRUCT", bot: "sentinel", input: { bytecode: "0x60ff00ff" } }),
}, token);
assert(created.response.status === 201, `Task creation failed: ${JSON.stringify(created.payload)}`);
assert(created.payload.status.state === "completed", "Sentinel task did not complete.");
assert(created.payload.status.data.findings[0]?.id === "SELFDESTRUCT_REACHABLE", "Expected Sentinel finding was absent.");

const operator = await request("/api/v1/tasks", {
  method: "POST",
  body: JSON.stringify({
    prompt: "Prepare a launch draft and a separate Monad Testnet transfer intent",
    bot: "operator",
    input: {
      objective: "Verify durable parallel DONADS coordination",
      target_date: null,
      steps: [
        {
          id: "campaign",
          title: "Prepare a launch draft",
          bot: "growth",
          prompt: "Draft one precise DONADS launch message",
          input: {
            objective: "Explain the verified Vercel deployment",
            start_date: "2026-10-31",
            duration_days: 1,
            platforms: ["x"],
            profile: {
              id: "acceptance-donads",
              project_name: "DONADS",
              product_description: "A Monad-native agent dispatch system",
              target_audience: "Monad builders",
              preferred_tone: "precise and playful",
              terminology: [],
              value_propositions: ["Verifiable task completion"],
              approved_links: [],
              prohibited_terms: [],
              previous_approved_examples: [],
            },
          },
          depends_on: [],
        },
        {
          id: "transfer-intent",
          title: "Prepare a transfer intent",
          bot: "flow",
          prompt: "Prepare, but do not execute, a 0.001 MON transfer intent",
          input: {
            title: "Acceptance transfer",
            purpose: "Verify Flow coordination without moving funds",
            payer: account.address,
            payouts: [{ recipient_name: "Acceptance recipient", recipient_address: "0x2222222222222222222222222222222222222222", asset: "MON", amount: "0.001", milestone: "Acceptance", deadline: null }],
            approval_conditions: ["No automatic payment"],
            linked_task_id: null,
          },
          depends_on: [],
        },
      ],
    },
  }),
}, token);
assert(operator.response.status === 201, `Operator plan failed: ${JSON.stringify(operator.payload)}`);
const started = await request(`/api/v1/tasks/${operator.payload.id}/operator-actions`, {
  method: "POST",
  body: JSON.stringify({ action: "start" }),
}, token);
assert(started.response.ok, `Operator start failed: ${JSON.stringify(started.payload)}`);
let operatorResult = started.payload;
for (let attempt = 0; attempt < 120; attempt += 1) {
  if (["completed", "partial_failure", "failed", "cancelled"].includes(operatorResult.status.data.workflow.state)) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
  const polled = await request(`/api/v1/tasks/${operator.payload.id}`, {}, token);
  assert(polled.response.ok, `Operator polling failed: ${JSON.stringify(polled.payload)}`);
  operatorResult = polled.payload;
}
assert(operatorResult.status.data.workflow.state === "completed", `Operator ended in ${operatorResult.status.data.workflow.state}.`);
assert(operatorResult.status.data.workflow.steps.every((step) => step.status === "completed" && step.task_id), "Operator did not persist both completed child tasks.");

const history = await request("/api/v1/tasks?limit=20", {}, token);
assert(history.response.ok, `History failed: ${JSON.stringify(history.payload)}`);
assert(history.payload.some((task) => task.id === created.payload.id), "Completed task was not persisted in wallet history.");

const logout = await request("/api/v1/auth/logout", { method: "POST" }, token);
assert(logout.response.status === 204, "Logout did not return 204.");
const revoked = await request(`/api/v1/tasks/${created.payload.id}`, {}, token);
assert(revoked.response.status === 401, "Revoked session was not rejected.");

console.log(JSON.stringify({
  base_url: baseUrl,
  wallet: account.address.toLowerCase(),
  task_id: created.payload.id,
  operator_task_id: operator.payload.id,
  operator_state: operatorResult.status.data.workflow.state,
  operator_completed_steps: operatorResult.status.data.workflow.steps.length,
  state: created.payload.status.state,
  finding: created.payload.status.data.findings[0].id,
  threat_score: created.payload.status.data.threat_score,
  history_contains_task: true,
  logout_status: logout.response.status,
  revoked_session_status: revoked.response.status,
  restored_session: true,
  balance_network: balance.payload.network,
  ai_remaining_today: aiUsage.payload.remaining_today,
  ai_configured: aiUsage.payload.configured,
}, null, 2));
