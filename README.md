# DONADS

![DONADS mascot](frontend/public/brand/donads-mascot.jpeg)

**Decentralized On-chain Neural Agent Dispatch System** — a crypto-native agent workspace for Monad that turns a user goal into coordinated, permission-bounded work and reports completion only when the result can be verified.

## The problem

General AI assistants can recommend actions, but recommendations are not completed tasks. Commerce, payments, research, campaigns, and long-running workflows need authenticated tools, durable state, explicit approval, recovery, and receipts. DONADS is building that execution layer without taking custody of a user's seed phrase or disguising a mock as a real result.

## Product vision

DONADS aims for a minimal, playful Grok Bot-style experience with the DONADS mascot, while being crypto-first and Monad-native. A user states a goal; Operator divides it into safe specialist steps, executes independent work in parallel, pauses at financial or external-write boundaries, and preserves the task history and evidence.

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
- Session tokens remain in browser memory and are stored server-side, not in local storage.
- Tasks, events, feedback, profiles, routines, payment actions, and orchestration actions are isolated by normalized wallet address.
- Wallet-scoped task history is available through `GET /v1/tasks` and appears in the recent-task sidebar.
- Sign-in challenges and authenticated sessions are rate limited; API responses include restrictive security headers.
- Operator child tasks inherit the parent owner; cross-wallet identifiers return `404` without revealing existence.
- CORS accepts only configured frontend origins. Monad chain ID is revalidated inside the transaction-confirmation path.

The current in-memory session registry and JSON task stores are appropriate for local/testnet development, not horizontal production. PostgreSQL, an encrypted session store, and a durable queue are required before multi-instance deployment.

## Architecture

- `frontend/`: Next.js interface, wallet sign-in, specialist workspaces, approval screens, and mascot motion.
- `crates/donads-dispatch/`: Axum API, authentication, ownership, routing, persistence, and background orchestration.
- `crates/bot-*`: bounded Scout, Commerce, Growth, Flow, Operator, and Sentinel implementations.
- `crates/donads-core/`: shared task model and verified Monad RPC client.
- `contracts/`: policy-vault contract and Solidity tests.

Operator executes dependency waves in parallel. Saved routines create a fresh reviewable run; they never reuse a signature or silently repeat a purchase.

Every asynchronous workflow uses the DONADS canvas loader from the approved process design. Its status text changes with the real operation, animation stops when the operation ends, and reduced-motion users receive a stable idle pose.

Completed specialist results can be exported as structured PDF reports. Reports are generated locally in the browser, require no PDF service or API key, include task metadata, request fields, structured results, activity evidence, timestamps, and page numbers, and omit fields whose names indicate tokens, signatures, secrets, seed phrases, or private keys.

## Credentials and service requirements

The current local/testnet build requires **no paid API key**. It uses the public Monad Testnet RPC, the user's browser wallet, deterministic specialists, and local browser PDF generation.

| Capability | Required now | Production requirement |
| --- | --- | --- |
| Monad reads and receipt verification | Public `MONAD_RPC_URL`; no key | Dedicated authenticated Monad RPC endpoint with quotas and failover |
| Wallet authentication and payments | User-controlled EVM wallet; no application key | Same non-custodial model, plus audited policy-vault address for bounded automation |
| PDF reports | No key | No key unless reports are later archived to external storage |
| Public web deployment | Vercel and persistent-backend accounts | Deployment tokens belong in each platform's secret store, never the repository |
| Real product orders | Not configured | Documented crypto merchant API URL/token and webhook verification secret |
| Model-backed generation | Not configured | One approved LLM provider key, budgets, redaction, fallback, and evaluation suite |
| Web-wide search | Not configured; Scout reads supplied URLs | Approved search API key plus citation and source-quality controls |
| Connected applications | Not configured | Per-connector OAuth client ID/secret and encrypted, revocable user tokens |
| Multi-instance durability | Not required for single-instance preview | PostgreSQL connection, encrypted Redis/session store, and durable job queue |
| Monitoring | Local logs | Error-monitoring DSN, metrics, alerting, and privacy-safe audit retention |

Do not add unused provider secrets. Select a provider only when its connector is implemented and tested; use separate testnet and production credentials with the minimum permissions.

## Local setup

Requirements: current stable Rust, Node.js, npm, and an EVM browser wallet configured for Monad Testnet.

```powershell
Copy-Item .env.example .env
cargo run -p donads-dispatch
```

In another terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open `http://localhost:3000`, select **Sign in**, and approve the message signature. This signature is free and cannot move funds. The API binds to `127.0.0.1:8080` by default.

Configuration is documented in `.env.example`. Production credentials must use a secret manager/KMS reference; never commit wallet keys, browser profiles, OAuth tokens, or merchant credentials.

## Public testnet preview

The web interface and dispatcher are deployed separately:

- Deploy `frontend/` to Vercel with `NEXT_PUBLIC_DONADS_API_URL` set to the public HTTPS dispatcher URL.
- Deploy the repository-root `Dockerfile` to a persistent container service. Attach a volume at `/app/data`; the current preview stores tasks, profiles, and routines there.
- Configure the dispatcher with `DONADS_AUTH_DOMAIN`, `DONADS_AUTH_URI`, and `DONADS_ALLOWED_ORIGINS` matching the exact Vercel hostname. Keep `DONADS_NETWORK=testnet` and `MONAD_RPC_URL=https://testnet-rpc.monad.xyz`.
- Use the service health check `GET /v1/health`. Never expose a private key as a deployment variable.

Vercel alone is not sufficient for the current backend: the dispatcher is a long-running Axum service and its preview persistence requires a mounted volume. The JSON stores and in-memory sessions remain single-instance preview infrastructure, not production infrastructure.

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

### Real local acceptance flow

With the dispatcher running, execute:

```powershell
cargo run -p donads-dispatch --example acceptance
```

This generates an unfunded ephemeral wallet in memory, signs into the real API, completes a Sentinel bytecode task, verifies wallet-scoped history, logs out, and confirms the revoked session receives `401`. The key is never printed or persisted, and the flow never signs a transaction.

## Path to the first real product order

1. Deploy and audit the policy vault on Monad Testnet using a funded test wallet; never share its private key.
2. Add dropped, replaced, reverted, duplicate, and delayed transaction recovery.
3. Integrate one authorized merchant that sells physical products and directly accepts supported crypto through a documented checkout API.
4. Bind merchant invoice, wallet payment, fulfillment, order receipt, refund, and support status into one idempotent workflow.
5. Replace JSON/in-memory infrastructure with PostgreSQL, Redis or an equivalent encrypted session store, and a durable job queue.
6. Add distributed edge quotas, monitoring, backups, browser isolation, and encrypted connector credentials.
7. Complete at least 5–10 recorded testnet acceptance tasks, including failure and recovery cases.
8. Run contract audit, application penetration testing, prompt-injection testing, and load testing before mainnet.

The immediate next feature after this security foundation is the first real crypto merchant connector. It extends Commerce; it does not add a new bot.
