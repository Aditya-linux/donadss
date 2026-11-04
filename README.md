# DONADS

![DONADS mascot](frontend/public/brand/donads-mascot.jpeg)

**Decentralized On-chain Neural Agent Dispatch System** — a crypto-native agent workspace for Monad that turns a user goal into coordinated, permission-bounded work and reports completion only when the result can be verified.

## The problem

General AI assistants can recommend actions, but recommendations are not completed tasks. Commerce, payments, research, campaigns, and long-running workflows need authenticated tools, durable state, explicit approval, recovery, and receipts. DONADS is building that execution layer without taking custody of a user's seed phrase or disguising a mock as a real result.

## Product vision

DONADS uses one minimal, playful task surface with the DONADS mascot while remaining crypto-first and Monad-native. Users do not open separate bot pages: they state a goal once, deterministic routing selects the required specialists, Operator coordinates dependent work, the loading interface names the active stage, and the conversation preserves results and evidence. The specialist catalog is informational and explains each capability and what to ask.

The target platform includes persistent cloud workers, authenticated browsers, connected applications, cross-bot coordination, learned routines, and long-running background work. Those are target capabilities, not claims about the current build. No measured benchmark currently proves DONADS faster or better than Grok Bot.

## Non-negotiable rules

- Crypto only: no Razorpay, fiat checkout, KYC integration, or gift-card workaround.
- Never request, transmit, or persist seed phrases or raw private keys.
- A wallet login signature authorizes a session only; it never authorizes a payment.
- Every payment or purchase requires a separate, exact, immediately visible confirmation.
- Unsupported merchants and unverifiable results fail closed.
- A transaction hash is not an order. A purchase completes only with verified chain payment and a real merchant order receipt.
- Mainnet remains disabled until testnet acceptance, security review, recovery tests, and contract audit pass.

## Specialists available today

| Specialist | Working end to end in this repository | Remaining production capability |
| --- | --- | --- |
| Scout | Fetches up to five user-supplied public URLs, blocks private-network targets, extracts evidence, and returns citations | Search provider, authenticated browser, broader live discovery |
| Commerce | Validates source-linked crypto offers and enforces offer → exact approval → invoice → confirmed payment → verified order-receipt state transitions | First authorized physical-product merchant adapter, authenticated checkout, shipping/refund recovery |
| Growth | Produces deterministic campaign drafts from a versioned brand profile and cited evidence | Model-backed iteration and approved publishing connectors with message receipts |
| Flow | Prepares an exact Monad Testnet MON transfer, requests the user's browser wallet, and verifies the mined receipt server-side | Deployed policy vault, ERC-20 support, replacement/dropped-transaction recovery |
| Operator | Validates dependency graphs, runs independent specialists in parallel, persists child tasks, supports cancel/retry, and captures versioned routines | Durable distributed queue, schedules/triggers, isolated cloud workers |
| Sentinel | Performs bytecode triage and enforces Flow network, sender, recipient, asset, and amount policy checks | Deployed-vault state, merchant/domain policy, prompt-injection controls |

Six specialists exist. The planned ten-bot catalog is intentionally incomplete: a new bot will only be specified and built after explicit product-owner approval.

## Current completion standard

A Monad transfer is complete only when the configured RPC proves it is on the expected chain, the user approves the exact intent in their wallet, and DONADS verifies the successful mined receipt, sender, recipient, amount, block, and absence of calldata.

A commerce task is complete only when an authorized merchant integration returns a real invoice, the exact on-chain payment is confirmed, and the merchant returns a verifiable order ID/receipt. Until the first merchant connector is configured, Commerce truthfully stops at a verified purchase intent and approval boundary.

## Wallet and payment model

DONADS agents do **not** currently own wallets, private keys, or independent funds. Wallet sign-in proves task ownership but cannot move money. For a payment, Flow creates an exact intent containing the Monad network, payer, recipient, asset, and amount. Sentinel validates that intent, the browser wallet shows the final transaction for explicit user approval, and the wallet signs and broadcasts it. DONADS then reads the transaction from Monad RPC and records completion only after the receipt and exact values match.

Operator can coordinate Flow or Commerce, but it cannot sign on their behalf. Its permission model explicitly disables signing and fund movement. The policy-vault contract is the future bounded-autonomy path: a user may fund a smart-contract vault and delegate a revocable session address with recipient, per-transaction, daily, expiry, and replay limits. That vault must be deployed, audited, funded, and approved on testnet before any agent-like automated payment is enabled.

Commerce adds merchant evidence around the payment: verified offer → exact user approval → merchant invoice → wallet payment → Monad receipt → merchant order receipt. Without both the chain receipt and merchant order receipt, the product remains unordered.

## Security and multi-user model

- Wallet sign-in uses an EIP-4361-shaped, Monad-chain-bound challenge and EIP-191 signature recovery.
- Challenges expire after five minutes and are single-use; sessions expire after twelve hours.
- Session tokens are stored server-side and restored through a 12-hour `HttpOnly`, `SameSite=Lax` cookie; they are never stored in local storage. Refreshing the page restores the authenticated wallet until expiry or explicit sign-out.
- Tasks, events, feedback, profiles, routines, payment actions, and orchestration actions are isolated by normalized wallet address.
- Wallet-scoped task history is available through `GET /v1/tasks`; selecting a history item reconstructs its request and verified result in the conversation surface.
- Sign-in challenges and authenticated sessions are rate limited; API responses include restrictive security headers.
- Operator child tasks inherit the parent owner; cross-wallet identifiers return `404` without revealing existence.
- The browser calls a same-origin `/api/v1` API, eliminating cross-origin deployment configuration. Monad chain ID and exact transfer values are revalidated inside transaction confirmation.

The Vercel deployment stores challenges, sessions, tasks, profiles, routines, and rate limits in Postgres. Operator runs through Vercel Workflows so execution can resume across function restarts and deployments.

## Architecture

- `frontend/`: the single Vercel project containing the Next.js interface and same-origin API.
- `frontend/src/server/`: Postgres persistence, EIP-191 authentication, specialist execution, policy checks, rate limits, and Monad receipt verification.
- `frontend/src/workflows/`: durable Vercel Operator workflows and parallel dependency waves.
- `crates/`: the tested Rust reference implementation and local conformance/acceptance runner.
- `contracts/`: policy-vault contract and Solidity tests.

Operator executes dependency waves in parallel. Saved routines create a fresh reviewable run; they never reuse a signature or silently repeat a purchase.

Every asynchronous workflow uses the DONADS canvas loader from the approved process design. Its status text changes with the real operation, animation stops when the operation ends, and reduced-motion users receive a stable idle pose.

Completed specialist results can be exported as structured PDF reports. Reports are generated locally in the browser, require no PDF service or API key, include task metadata, request fields, structured results, activity evidence, timestamps, and page numbers, and omit fields whose names indicate tokens, signatures, secrets, seed phrases, or private keys.

## Credentials and service requirements

The current local/testnet build requires **no paid API key**. It uses the public Monad Testnet RPC, the user's wallet, deterministic specialists, and local browser PDF generation. A free public Reown project ID enables the WalletConnect wallet chooser and QR modal; it is client configuration, not a secret.

| Capability | Required now | Production requirement |
| --- | --- | --- |
| Monad reads and receipt verification | Public `MONAD_RPC_URL`; no key | Dedicated authenticated Monad RPC endpoint with quotas and failover |
| Wallet authentication and payments | User-controlled EVM wallet plus public `NEXT_PUBLIC_REOWN_PROJECT_ID` | Same non-custodial model, plus audited policy-vault address for bounded automation |
| PDF reports | No key | No key unless reports are later archived to external storage |
| Public web deployment | One Vercel project and a Marketplace Postgres integration | Deployment/database credentials are injected by Vercel and never committed |
| Real product orders | Not configured | Documented crypto merchant API URL/token and webhook verification secret |
| Model-backed generation | Not configured | One approved LLM provider key, budgets, redaction, fallback, and evaluation suite |
| Web-wide search | Not configured; Scout reads supplied URLs | Approved search API key plus citation and source-quality controls |
| Connected applications | Not configured | Per-connector OAuth client ID/secret and encrypted, revocable user tokens |
| Multi-instance durability | Marketplace Postgres and Vercel Workflows | Retention, backups, connection quotas, and disaster-recovery testing |
| Monitoring | Local logs | Error-monitoring DSN, metrics, alerting, and privacy-safe audit retention |

Do not add unused provider secrets. Select a provider only when its connector is implemented and tested; use separate testnet and production credentials with the minimum permissions.

### Approved free-user AI policy

The model gateway is not active until an approved provider key is configured. When activated, these limits are mandatory and shared by every provider adapter:

- 3 model requests per minute per wallet.
- 30 model requests per UTC day per wallet.
- 1 running model request per wallet.
- 5 attachments per task, at most 10 MB each.
- 20,000 input tokens and 2,000 output tokens per task.
- 30-second provider timeout.
- 1 retry only for transient failures.
- No retry for invalid input or provider HTTP `429` responses.
- Deterministic specialist fallback when model quota or availability prevents inference.

The canonical values live in `frontend/src/lib/ai-policy.ts`. Server-side database leases and wallet-scoped counters enforce concurrency and request quotas; browser checks are usability aids, not the security boundary.

## Local setup

Requirements: Node.js, npm, a Postgres connection string, and a free Reown project ID. WalletConnect supports mobile/QR wallets; an injected EVM browser wallet is the fallback when Reown is not configured. Rust is optional unless running the reference implementation tests.

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Set `DATABASE_URL` and `NEXT_PUBLIC_REOWN_PROJECT_ID` in `frontend/.env.local`, open `http://localhost:3000`, select **Connect wallet**, and approve the message signature. The wallet chooser supports WalletConnect QR sessions. This signature is free and cannot move funds. The UI and API share the same local origin.

Configuration is documented in `.env.example`. Production credentials must use a secret manager/KMS reference; never commit wallet keys, browser profiles, OAuth tokens, or merchant credentials.

## Public testnet deployment

DONADS deploys as one Vercel project rooted at `frontend/`:

- `/` serves the Next.js product interface.
- `/api/v1/*` serves authentication, tasks, history, profiles, payments, receipts, and specialist APIs.
- `/.well-known/workflow/*` is managed by Vercel for durable Operator execution.
- A Neon or equivalent Postgres integration is provisioned from the Vercel Marketplace and injects `DATABASE_URL`.
- `MONAD_RPC_URL` defaults to the public Monad Testnet endpoint; production should use a dedicated authenticated endpoint.
- `GET /api/v1/health` is the deployment health check. No private key is configured anywhere.

To test a real transfer, connect a dedicated user-controlled wallet, select Monad Testnet (chain ID `10143`), fund that wallet with test MON from the official faucet, and submit a Flow task. The wallet address displayed by DONADS is the address to fund. There is no DONADS custody address and no agent private key.

## Verification

```powershell
cargo test --workspace --all-targets
cargo clippy --workspace --all-targets -- -D warnings

Set-Location frontend
npm test
npm run lint
npm run build

Set-Location ../contracts
npm run compile
npm test
npm audit
```

Unit-test doubles exist only inside tests. They validate failures and UI behavior and never create product-visible payment or order claims.

### Rust reference acceptance flow

With the optional Rust dispatcher running, execute:

```powershell
cargo run -p donads-dispatch --example acceptance
```

This generates an unfunded ephemeral wallet in memory, signs into the real API, completes a Sentinel bytecode task, verifies wallet-scoped history, logs out, and confirms the revoked session receives `401`. The key is never printed or persisted, and the flow never signs a transaction.

## Path to the first real product order

1. Deploy and audit the policy vault on Monad Testnet using a funded test wallet; never share its private key.
2. Add dropped, replaced, reverted, duplicate, and delayed transaction recovery.
3. Integrate one authorized merchant that sells physical products and directly accepts supported crypto through a documented checkout API.
4. Bind merchant invoice, wallet payment, fulfillment, order receipt, refund, and support status into one idempotent workflow.
5. Add production monitoring, database backups, browser isolation, and encrypted connector credentials.
6. Load-test Postgres connection quotas, Workflow retries, concurrent users, and RPC failover.
7. Complete at least 5–10 recorded testnet acceptance tasks, including failure and recovery cases.
8. Run contract audit, application penetration testing, prompt-injection testing, and load testing before mainnet.

The immediate next feature after this security foundation is the first real crypto merchant connector. It extends Commerce; it does not add a new bot.
