# DONADS

![DONADS mascot](frontend/public/brand/donads-mascot-tile.png)

**Decentralized On-chain Neural Agent Dispatch System** — a crypto-native agent workspace for Monad that turns a user goal into coordinated, permission-bounded work and reports completion only when the result can be verified.

## The problem

General AI assistants can recommend actions, but recommendations are not completed tasks. Commerce, payments, research, campaigns, and long-running workflows need authenticated tools, durable state, explicit approval, recovery, and receipts. DONADS is building that execution layer without taking custody of a user's seed phrase or disguising a mock as a real result.

## Why DONADS instead of a general-purpose agent

Grok Bot is currently the broader product: it provides persistent cloud computers, authenticated browsers, connected apps, parallel bots, learned routines, and background work. DONADS does not claim to outperform that general-purpose automation layer today.

DONADS is purpose-built for crypto execution on Monad. Its differentiation is not another chatbot or a different mascot; it is an approval and verification system around agent work:

- A wallet remains user-controlled, and a login signature can never authorize a payment.
- Financial steps are represented as exact, reviewable intents instead of natural-language permission.
- Sentinel and Flow validate chain, sender, recipient, asset, amount, calldata, and mined receipt outside the language model.
- Commerce requires both verified on-chain payment and a real merchant order receipt before reporting completion.
- Operator can coordinate specialists, but cannot inherit wallet-signing authority or silently move funds.
- Task history, evidence, child-agent events, transaction receipts, and PDF reports create an auditable completion record.
- The policy vault provides revocable session permissions with recipient, per-transaction, daily, expiry, replay, pause, owner-withdrawal, and exact owner-authorized action controls on Monad Testnet.

The product thesis is focused: use a general agent for broad browser and office work; use DONADS when a Monad task needs constrained authority, explicit wallet consent, deterministic validation, and cryptographic proof of completion. The immediate goal is to make that focused path excellent before expanding into a general cloud-computer platform.

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
| Flow | Routes exact native MON and ERC-20 transfers; deploys owner-controlled policy vaults; configures/revokes bounded sessions; creates funded P2P escrows; and implements guarded Uniswap approval, swap, and receipt verification | Official live testnet DEX bytecode, saved contract-action history, replacement/dropped-transaction recovery |
| Operator | Validates dependency graphs, runs independent specialists in parallel, persists child tasks, supports cancel/retry, and captures versioned routines | Durable distributed queue, schedules/triggers, isolated cloud workers |
| Sentinel | Runs preflight phishing/scam checks before task execution, triages bytecode, detects dangerous token/NFT approvals, and enforces Flow network, sender, recipient, asset, and amount policy checks | Live reputation feeds, downloaded-file malware scanning, deployed-vault state, broader merchant/domain policy |

Six specialists exist. The planned ten-bot catalog is intentionally incomplete: a new bot will only be specified and built after explicit product-owner approval.

## Current completion standard

A Monad transfer is complete only when the configured RPC proves it is on the expected chain, the user approves the exact intent in their wallet, and DONADS verifies the successful mined receipt, sender, recipient, amount, block, and absence of calldata.

ERC-20 chat commands use the explicit form `Send 10 USDC token 0xTOKEN_CONTRACT to 0xRECIPIENT`. Flow reads the contract code, symbol, decimals, and balances from Monad Testnet; rejects symbol, precision, or balance mismatches; builds the standard `transfer(address,uint256)` calldata; and requires the mined transaction plus exact recipient balance delta to match before completion. The balance control shows live MON plus every verified token contract present in that wallet's DONADS history.

The Uniswap v3 adapter uses the Monad Testnet QuoterV2 and SwapRouter02 addresses from Uniswap's official deployment feed. The explicit chat form is `Swap 1 USDC token 0xINPUT for DAI token 0xOUTPUT max 0.5% slippage`. Quotes are persisted with a ten-minute expiry and pre-swap balances. After an accepted quote, the wallet approves only the exact input, submits exact router calldata, and the server certifies both receipts, sender, token, router, calldata, quote block time, input delta, and minimum output. On 2026-11-03 the official Monad Testnet RPC still returned zero bytecode for the listed QuoterV2, SwapRouter02, and Universal Router, so this execution path remains correctly fail-closed until those official deployments actually exist.

P2P escrow is available through `Create escrow 1 MON for 0xSELLER with arbiter 0xARBITER refund after 24 hours terms Product delivered as agreed`. The connected buyer wallet deploys and funds a dedicated contract. Its full lifecycle is chat-native through `Release escrow 0xESCROW`, `Cooperative refund escrow 0xESCROW`, `Timeout refund escrow 0xESCROW`, `Dispute escrow 0xESCROW evidence ...`, and `Resolve escrow 0xESCROW to seller|buyer resolution ...`. The contract enforces the caller's buyer, seller, or arbiter role and emits on-chain receipts for every state transition.

Restricted session permissions are wallet-driven. `Deploy my policy vault` deploys a vault owned by the connected user. A session address held in an external wallet or secure signer can then be bounded with `Allow session 0xSESSION on vault 0xVAULT to send up to 0.1 MON per transaction and 1 MON per day for 24 hours to 0xRECIPIENT`, or immediately disabled with `Revoke session 0xSESSION on vault 0xVAULT`. Delegated native execution additionally requires an owner-authorized action bound to the chain, vault, session, recipient, amount, Mission identifier, nonce, and expiry. DONADS never creates, receives, or stores the session private key.

The unified chat accepts a complete command such as `Send 0.01 MON to 0x… for testing`. Financial values bypass the language model and are parsed deterministically. Flow then exposes the exact intent in the conversation. Its lifecycle is `awaiting approval → authorized → submitted → confirmed`; the submitted transaction hash is checkpointed server-side and temporarily retained in the originating browser so a refresh, slow receipt, or interrupted API call resumes verification instead of broadcasting a duplicate payment.

A commerce task is complete only when an authorized merchant integration returns a real invoice, the exact on-chain payment is confirmed, and the merchant returns a verifiable order ID/receipt. Until the first merchant connector is configured, Commerce truthfully stops at a verified purchase intent and approval boundary.

### Cross-device action checkpoints

After signing in with the same wallet on a phone, DONADS restores that wallet's task history and shows an **Action needed** inbox. The inbox is derived from persisted workflow state, so phone and desktop cannot disagree about whether a task is actually paused. It currently covers Flow intent review, wallet signing, receipt verification, Commerce intent review, and planned Operator runs.

The inbox refreshes while the app is visible and marks an existing checkpoint as waiting after two minutes. Time alone never creates an approval and never grants authority. Opening a financial checkpoint reveals the exact task; the connected mobile wallet must still display and sign the final transaction.

Opt-in Web Push is implemented for browsers that support service workers and Push API. It stores wallet-owned subscriptions, removes expired endpoints, and sends privacy-minimized checkpoint alerts that never expose amounts or addresses on the lock screen. It remains visibly disabled until `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are configured in Vercel. On iOS, the user must install DONADS to the Home Screen before Web Push is available.

## Frozen testnet delivery sequence

The approved product scope will be implemented in this order without adding a new specialist:

1. ERC-20 transfers through chat, including exact token contract, recipient, amount, simulation, wallet signature, and receipt/balance verification.
2. Native MON and allowlisted token balances with chain and freshness labels.
3. One allowlisted Monad Testnet DEX adapter.
4. Deterministic swap quote, minimum output, slippage and price-impact policy, simulation, explicit wallet signing, and receipt verification.
5. P2P escrow with fund, release, refund/timeout, and milestone receipts.
6. Scout evidence records containing source URL, retrieval time, extracted evidence, and content hash.
7. One authorized physical-product merchant integration that returns both payment and order receipts.
8. Restricted, expiring, revocable session-wallet permissions backed by the policy vault.

Every financial workflow must also support simulation mode, explainable Sentinel blocking, and a proof-of-completion record containing the workflow steps, approvals, evidence, transaction hashes, balance changes, and final status. The security audit remains a mandatory mainnet gate but is intentionally deferred while the testnet feature pipeline is completed.

### Final manual acceptance suite

The feature set is not called complete until a user can run and preserve evidence for at least these testnet cases:

1. Confirm a native MON chat transfer.
2. Reject a native MON intent without broadcasting.
3. Resume a submitted transfer after refresh without duplicate broadcast.
4. Confirm an ERC-20 chat transfer and exact balance delta.
5. Simulate a swap without broadcasting.
6. Confirm an allowlisted DEX swap within minimum-output policy.
7. Block a swap whose slippage or price impact exceeds policy, with a precise reason.
8. Fund and release or refund a P2P escrow.
9. Produce source-hashed Scout research that drives a later workflow.
10. Open a paused checkpoint on a phone and finish it with the same wallet.
11. Complete a real crypto merchant order with both chain and merchant receipts.
12. Grant, exercise, revoke, and prove expiry of a restricted session permission.

Each case needs an automated test where practical and a saved manual receipt. A feature is not complete when only its UI, intent, mock, or transaction hash exists.

## Wallet and payment model

DONADS agents do **not** currently own wallets, private keys, or independent funds. Wallet sign-in proves task ownership but cannot move money. For a payment, Flow creates an exact intent containing the Monad network, payer, recipient, asset, and amount. Sentinel validates that intent, the browser wallet shows the final transaction for explicit user approval, and the wallet signs and broadcasts it. DONADS then reads the transaction from Monad RPC and records completion only after the receipt and exact values match.

Operator can coordinate Flow or Commerce, but it cannot sign on their behalf. Its permission model explicitly disables signing and fund movement. A user can now deploy a policy vault from chat and delegate a separately secured session address with recipient, per-transaction, daily, expiry, pause, and replay limits. The user remains owner and can revoke the session at any time. DONADS does not host session private keys; production autonomous execution still requires an approved KMS or wallet signer and the deferred security audit.

Chat-directed swap execution is fully wired behind a live-code guard. It remains unavailable while the official testnet router addresses contain no bytecode. Autonomous session-key signing remains disabled until a secure signer is selected; contract permissions alone never expose or custody a private key.

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

Every newly accepted task now creates a normalized, versioned Mission with an append-only event timeline, a specialist step and an execution attempt. Flow Missions additionally persist typed transaction intents, approval evidence, wallet submission state, and independently verified receipts. The original task API remains compatible while the Mission API provides the durable audit model at `GET /api/v1/missions`.

Unfinished connector placeholders are not exposed in the product. Telegram appears in the Action needed panel only after its bot, username, signed webhook secret and public app URL are configured server-side. It delivers status and approval deep-links but cannot approve or sign transactions. Other OAuth connectors remain fail-closed until encrypted token storage, callback state/PKCE, webhook authenticity and disconnect tests are complete. Mainnet readiness remains an authenticated evidence endpoint and cannot enable execution.

Architecture and release evidence:

- [`docs/architecture/current-state.md`](docs/architecture/current-state.md)
- [`docs/architecture/decisions.md`](docs/architecture/decisions.md)
- [`docs/acceptance-matrix.md`](docs/acceptance-matrix.md)
- [`docs/connected-apps.md`](docs/connected-apps.md)
- [`docs/mainnet-runbook.md`](docs/mainnet-runbook.md)

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

The Gemini gateway is provider-ready and remains disabled while `GEMINI_API_KEY` is empty. `GEMINI_MODEL` defaults to the stable `gemini-2.5-flash` identifier and can be changed without altering specialist code. When configured, Gemini produces schema-constrained routing, cited Scout summaries, Growth draft improvements, and image/PDF understanding. Missing keys, exhausted quota, timeouts, and provider failures fall back to the deterministic specialists. Sentinel, Flow, Commerce policy, transaction validation, and all signing remain outside model authority.

Sentinel screens every signed chat request before model planning or wallet activity. It fails closed on deterministic high-risk signals such as credential-hiding URLs, protected-brand lookalikes, punycode/IP/shortened destinations, executable downloads, seed/private-key social engineering, unlimited ERC-20 approvals, and NFT `setApprovalForAll`. A clean deterministic result is not a guarantee of safety; live reputation, malware scanning, and contract simulation remain separate integrations.

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

1. Use `Deploy my policy vault` with a funded test wallet, then record its verified address; never share either owner or session private keys.
2. Add dropped, replaced, reverted, duplicate, and delayed transaction recovery.
3. Integrate one authorized merchant that sells physical products and directly accepts supported crypto through a documented checkout API.
4. Bind merchant invoice, wallet payment, fulfillment, order receipt, refund, and support status into one idempotent workflow.
5. Add production monitoring, database backups, browser isolation, and encrypted connector credentials.
6. Load-test Postgres connection quotas, Workflow retries, concurrent users, and RPC failover.
7. Complete at least 5–10 recorded testnet acceptance tasks, including failure and recovery cases.
8. Run contract audit, application penetration testing, prompt-injection testing, and load testing before mainnet.

The remaining external testnet gates are a live official DEX deployment, user-approved funding/deployment transactions, and an externally secured session signer. The merchant connector remains seventh in the frozen delivery sequence and extends Commerce; it does not add a new bot.
