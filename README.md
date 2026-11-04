# DONADS

![DONADS mascot](frontend/public/brand/donads-mascot-tile.png)

**Decentralized On-chain Neural Agent Dispatch System**

DONADS is a crypto-native AI task execution system for Monad. A user describes an outcome in chat, DONADS coordinates the specialists required for the task, pauses at explicit approval boundaries, and reports completion only after independently verifiable evidence exists.

- Live Testnet application: [donads.vercel.app](https://donads.vercel.app)
- Network: Monad Testnet, chain ID `10143`
- Status: Testnet product; Mainnet financial execution is intentionally disabled

## What problem does DONADS solve?

AI assistants are good at producing text, but a useful financial agent must do more than recommend an action. It must preserve state, coordinate tools, request consent, survive failures, verify external results and prove what happened.

Crypto workflows make this harder:

- Natural language is ambiguous, while transactions must be exact.
- A model must never receive a seed phrase or unrestricted signing authority.
- A transaction hash alone does not prove the intended outcome occurred.
- Long-running tasks need recovery, history and cross-device approvals.
- Research and websites can contain phishing, prompt injection or manipulated evidence.
- Payments, swaps, escrows and purchases require different proofs of completion.

Most assistants stop at an answer. DONADS is designed to continue from **request -> plan -> deterministic validation -> user approval -> execution -> independent verification -> receipt**.

## The solution

DONADS provides one chat workspace backed by six coordinated specialists. The language model can help interpret, plan and summarize, but it cannot authorize or sign financial actions.

```text
User goal
   |
   v
Operator selects the required specialists
   |
   +--> Scout gathers source-linked evidence
   +--> Sentinel checks threats and financial policy
   +--> Growth produces evidence-based communication
   +--> Commerce validates merchant and order state
   +--> Flow prepares deterministic on-chain actions
   |
   v
Exact checkpoint shown to the user
   |
   v
User-controlled wallet approves or rejects
   |
   v
DONADS verifies the mined receipt and resulting state
```

The system separates three kinds of authority:

1. **AI authority:** planning, routing, summarization and drafting.
2. **Policy authority:** deterministic checks for network, sender, recipient, asset, amount, calldata, limits and evidence.
3. **Wallet authority:** the user or a separately reviewed restricted session signer authorizes the final transaction.

An LLM response is never treated as financial authorization.

## Core use cases

- Send native MON or an ERC-20 token through chat after reviewing the exact intent.
- Pay multiple MON recipients while verifying every individual receipt.
- Display Monad Testnet MON and verified token balances.
- Prepare a guarded token swap with minimum output, slippage and price-impact limits.
- Deploy an owner-controlled policy vault and configure expiring, revocable permissions.
- Create, release, refund, dispute and resolve P2P escrow contracts.
- Screen escrow deliverables, store source hashes and prepare an exact release or dispute checkpoint.
- Research supplied public sources with citations, retrieval timestamps and content hashes.
- Detect phishing, dangerous approvals, malicious bytecode patterns and indirect prompt injection.
- Coordinate research, security, growth and financial steps as one persistent Mission.
- Restore wallet-scoped task history and continue interrupted work.
- Receive mobile Web Push or Telegram notifications when a task needs review.
- Export substantial results as structured PDF reports; ordinary questions remain readable chat responses.

## Who is DONADS for?

### Individual crypto users

Users who want to transact, inspect risk, research protocols or manage repeated on-chain work from a conversational interface without giving an AI their private key.

### DAO and community operators

Teams coordinating contributor payments, research, campaign preparation, milestone escrows and evidence-backed approvals.

### Crypto-native freelancers and merchants

Buyers and sellers who need milestone terms, P2P escrow, dispute evidence and verifiable payment records.

### DeFi users and protocol teams

Users who need explainable transaction preparation, deterministic policy controls, simulation and proof-of-completion records.

### Developers and operations teams

Teams building automated Monad workflows that require durable Missions, typed transaction intents, wallet-scoped history and auditable receipts.

## Market position

DONADS sits at the intersection of:

- AI agents and task automation;
- non-custodial wallets and smart accounts;
- DeFi execution and transaction simulation;
- crypto payments and merchant automation;
- P2P escrow and milestone coordination;
- security screening and verifiable agent activity.

The initial market is Monad users and teams that need safer conversational execution. The architecture can later support additional EVM networks, but Monad remains the first network and product focus.

DONADS does not claim a market-size figure or Mainnet readiness without independent evidence.

## Why use DONADS instead of a general-purpose agent?

General-purpose products such as Grok Bot have broader cloud-computer, browser and connected-app capabilities today. DONADS is intentionally more specialized.

DONADS focuses on crypto workflows where correctness and authority boundaries matter:

- The wallet remains non-custodial.
- Login signatures cannot authorize payments.
- Financial language is converted into typed, reviewable intents.
- Financial values bypass generative model output and use deterministic parsing.
- Sentinel and Flow verify transaction policy outside the model.
- Exact calldata and expected balance changes are shown before signing.
- Mined transactions are checked against the approved sender, target, amount and calldata.
- Escrow, merchant and research workflows preserve evidence, not only prose.
- Unsupported or unverifiable actions fail closed instead of returning simulated success.

The long-term advantage is **policy-controlled, verifiable crypto autonomy**, not a chatbot with a wallet attached.

## Specialists

Users submit one goal; they do not need to operate separate bot pages.

| Specialist | Responsibility | Working today | Important remaining work |
| --- | --- | --- | --- |
| **Scout** | Public-source research and evidence | Supplied URL retrieval, citations, content hashes, retrieval time and injection quarantine | Hardened outbound egress, search provider and authenticated browser worker |
| **Commerce** | Crypto-native purchasing | Offer and purchase-intent validation with payment/order completion rules | First authorized physical-product merchant connector and refund recovery |
| **Growth** | Evidence-based campaign drafting | Deterministic drafts and optional model enhancement | Approved publishing connectors and delivery receipts |
| **Flow** | Payments and Monad execution | Native MON, ERC-20, batches, balances, policy vault, escrow and guarded swap path | Live approved DEX deployment, full transaction-replacement recovery and secure session signer |
| **Operator** | Cross-specialist coordination | Dependency graphs, parallel waves, child tasks, retry/cancel and durable Mission state | Distributed schedules, triggers and isolated cloud workers |
| **Sentinel** | Security and policy enforcement | URL preflight, prompt-injection detection, bytecode triage, approval checks and transaction policy | Reputation feeds, malicious-file scanning and hardened browser isolation |

No additional specialist is added without an explicit product decision and acceptance criteria.

## What works today?

### Strict capability status

DONADS uses evidence-backed status labels. `Built` means the workflow exists and is tested; it does not mean mainnet authorization is enabled.

| Capability | Status | Enforced behavior |
| --- | --- | --- |
| Payments | Built on Monad Testnet | Native MON, verified ERC-20 transfers, batches of up to ten recipients, and escrow actions require exact review and wallet signatures. |
| Research | Built for supplied and official sources | Scout retrieves public sources, preserves URLs and hashes, and returns cited question-specific findings. Monad questions default to official Monad developer documentation; live chain state uses Monad JSON-RPC. |
| Multi-step jobs | Built | Operator executes dependency-safe specialist waves and persists child-task outcomes. |
| Phone approvals | Built for Web Push; Telegram code complete, credentials pending | Notifications deep-link to the exact DONADS checkpoint. Neither channel can approve or sign. |
| Always-on scheduled routines | Not built | Saved routines can be replayed manually. Calendar triggers and durable schedule polling must be implemented before this is labelled built. |
| Wallet watcher | Partial, not continuous | Sentinel detects phishing links, lookalike domains, unlimited approval calldata and supplied bytecode risks. Continuous wallet/event monitoring is still required. |

For Monad information, DONADS separates two source classes:

- **Live chain state:** official Monad-compatible JSON-RPC methods through the configured Testnet endpoint.
- **Technical explanations:** primary evidence from `docs.monad.xyz`, including the developer overview, network information and JSON-RPC reference.

Model output cannot replace either source. Scout must cite retrieved evidence, while financial decisions continue through deterministic validation.

### Wallet and authentication

- Reown/WalletConnect QR flow and injected EVM wallet support.
- Monad Testnet is the required WalletConnect chain.
- Wallet sign-in uses a short-lived, single-use challenge and cannot move funds.
- Sessions are stored in an `HttpOnly`, `SameSite=Lax` cookie and restored after refresh.
- Wallet-scoped task history is persisted in Postgres.

### Financial execution

- Native MON transfers and batches of up to ten unique recipients.
- ERC-20 transfers with contract code, metadata, precision, balance and receipt-delta verification.
- Exact wallet approval followed by independent mined-receipt verification.
- Policy-vault deployment and restricted-session policy configuration.
- P2P escrow lifecycle: create, release, cooperative refund, timeout refund, dispute and arbiter resolution.
- Swap quoting/execution code that fails closed when the approved router is unavailable.
- MonadScan links for confirmed transactions.

### Evidence and security

- Scout source URL, retrieval time, citation and SHA-256 content hash.
- Deterministic prompt-injection and transaction-hijack screening before model summarization.
- Escrow runtime-bytecode identity verification with Solidity immutable fields normalized.
- Human intent versus deterministic calldata panels before financial approval.
- Exact receipt verification before a task can be marked complete.

### Product experience

- One chat-native Mission workspace.
- Persistent, uniquely named wallet-scoped history with deletion controls.
- File and image attachment interface with enforced size/count limits.
- Mobile-responsive approval inbox and Web Push support.
- Telegram checkpoint connector when server-side configuration is complete.
- Structured PDF export for substantial reports.

## Website screenshots and previews in chat

This capability is **planned, not currently implemented**.

DONADS can support visual website evidence through an isolated browser worker:

1. Open an allowlisted public or user-authorized page in an isolated browser session.
2. Record the final URL, redirect chain, retrieval time, viewport and browser-worker version.
3. Run Sentinel checks on the URL, DOM and extracted text.
4. Capture a screenshot and compute its SHA-256 hash.
5. Store the image in private object storage under the wallet-owned Mission.
6. Render a short-lived signed preview directly inside chat.
7. Preserve the screenshot hash and relevant source evidence in the Mission report.

For authenticated websites, credentials and cookies must remain inside an encrypted, isolated browser session. They must never be exposed to the model, chat output, logs or screenshots.

Screenshots are evidence of what the browser displayed at a particular time; they are not proof that every claim on the page is true. OCR and vision-model output must be labelled as extracted interpretation, and financial actions must continue through deterministic validation and explicit approval.

Telegram should receive a privacy-safe status message and **Review in DONADS** deep link by default. Sending screenshots directly to Telegram should require explicit user opt-in, redaction and a sensitivity check.

## Telegram integration

Telegram is implemented as a mobile checkpoint channel, not a signing surface.

It can:

- link one private Telegram chat to a wallet-owned DONADS account;
- notify the user that a Mission requires attention;
- include a short checkpoint summary;
- open the exact task through a **Review in DONADS** button.

It cannot:

- approve or sign a transaction;
- receive a seed phrase or private key;
- silently execute a financial action;
- expose transaction details on the lock screen by default.

Required server configuration:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_USERNAME
TELEGRAM_WEBHOOK_SECRET
DONADS_PUBLIC_APP_URL
```

The webhook uses Telegram's secret token, link codes are hashed, single-use and expire after ten minutes, duplicate update IDs are rejected, and each chat is rate limited. Full activation steps are in [docs/connected-apps.md](docs/connected-apps.md).

## Wallet and custody model

DONADS specialists do not own unrestricted wallets.

- A user-controlled wallet signs ordinary transactions.
- DONADS never requests or stores the user's seed phrase or private key.
- Operator can coordinate Flow but cannot inherit signing permission.
- A policy vault can restrict a separate session address by recipient, amount, daily limit and expiry.
- DONADS does not currently host a session private key.
- Production automation requires a reviewed smart-account/session design and a secure signer such as KMS/HSM infrastructure.

Every payment remains separate from wallet login and must be independently authorized or covered by a previously reviewed, revocable policy.

## Completion rules

DONADS reports completion only when the requested outcome has matching evidence.

| Workflow | Completion evidence |
| --- | --- |
| Native MON transfer | Successful mined receipt with exact chain, sender, recipient, value and empty calldata |
| ERC-20 transfer | Successful receipt plus exact token calldata and recipient balance delta |
| Batch payment | Every individual recipient receipt verified; partial batches remain incomplete |
| Swap | Approved router/calldata, successful approval and swap receipts, input delta and minimum output |
| Escrow action | Verified DONADS runtime, correct role/state, exact action calldata and successful receipt |
| Research | Supplied source URLs, retrieval timestamps, citations, hashes and limitations |
| Product order | Merchant invoice, verified on-chain payment and merchant order receipt |

A transaction hash is not an order receipt. A screenshot is not contractual fulfillment. A model response is not authorization.

## Architecture

```text
Next.js interface and same-origin API (Vercel)
   |
   +-- Wallet authentication and approval checkpoints
   +-- Specialist execution and deterministic policy checks
   +-- Vercel Workflows for durable Operator runs
   +-- Postgres for sessions, Missions, events, history and rate limits
   +-- Monad RPC for state and independent receipt verification
   +-- Gemini gateway for bounded planning/summarization
```

Repository layout:

- `frontend/` - Next.js interface, API routes and deployment root.
- `frontend/src/server/` - authentication, persistence, specialists, policy, AI gateway and receipt verification.
- `frontend/src/workflows/` - durable Operator workflows.
- `contracts/` - policy vault and escrow contracts plus tests.
- `crates/` - Rust reference implementation and conformance tools.
- `docs/` - architecture decisions, acceptance evidence and launch runbooks.

## AI model policy

Gemini is used only when configured and useful. Missing quota, provider failure or timeout falls back to deterministic specialists.

Free-user limits:

- 3 model requests per minute per wallet.
- 30 model requests per UTC day per wallet.
- 1 running model request per wallet.
- 5 files per task, maximum 10 MB each.
- 20,000 maximum input tokens and 2,000 maximum output tokens.
- 30-second timeout.
- 1 retry for transient failures.
- No retry for invalid input or provider `429` responses.

Sentinel, Commerce financial validation, Flow policy, calldata construction, wallet signing and receipt verification remain outside model authority.

## Security principles

- Never request, transmit or persist seed phrases or raw private keys.
- Treat websites, attachments, screenshots and model output as untrusted input.
- Keep secrets server-side and out of browser bundles.
- Require ownership checks for every wallet-scoped task and connector.
- Use exact typed intents and idempotent execution.
- Fail closed for unsupported contracts, routers, merchants and unverifiable outcomes.
- Preserve an append-only Mission timeline and proof-of-completion record.
- Keep Mainnet disabled until every readiness gate has evidence.

Known security work before Mainnet includes hardened outbound web retrieval resistant to DNS rebinding, independent smart-contract review, application penetration testing and secure session-signer infrastructure.

## Mainnet status

Mainnet execution cannot be enabled from the interface. It requires evidence for all launch gates, including:

- ten or more independently verified Testnet receipts;
- successful native, ERC-20, vault, escrow and swap workflows;
- contract fuzz/invariant tests and independent contract review;
- application penetration and adversarial AI/file testing;
- two reliable Mainnet RPC providers with health-based failover;
- secure session signer or reviewed smart-account infrastructure;
- reorg, nonce, replacement and dropped-transaction recovery;
- multisig administration, pause/revocation and emergency drills;
- approved contract, token, merchant and DEX allowlists;
- backups, recovery drills, monitoring and incident response;
- limited-wallet beta and evidence-backed go/no-go review.

See [docs/mainnet-runbook.md](docs/mainnet-runbook.md).

## Required services

| Capability | Development/Testnet | Production requirement |
| --- | --- | --- |
| Database | Postgres/Neon | Backups, retention and recovery drills |
| Wallet connection | Reown project ID or injected wallet | Same non-custodial design |
| Monad RPC | Public Testnet RPC | Multiple authenticated providers with failover |
| AI enhancement | Optional Gemini key | Budgeting, monitoring and evaluation |
| Telegram | Optional bot configuration | Secret webhook, monitoring and support procedure |
| Web Push | Optional VAPID key pair | Delivery monitoring and privacy policy |
| Browser screenshots | Not implemented | Isolated workers, private object storage and signed previews |
| Product purchasing | Not configured | Authorized crypto merchant API, webhook and refund flow |

## Local development

Requirements: Node.js, npm, Postgres and a Reown project ID. Rust is optional unless running the reference workspace.

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Configure at minimum:

```text
DATABASE_URL
NEXT_PUBLIC_REOWN_PROJECT_ID
```

Optional services are documented in `frontend/.env.example`. Never commit `.env` files, private keys, OAuth tokens, merchant credentials or authenticated browser profiles.

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
npm audit --audit-level=high
```

Product-visible workflows do not use mock payment or order success. Test doubles exist only inside automated tests.

## Example prompts

```text
Research https://monad.xyz and summarize the key facts with citations.

Send 0.01 MON to 0xRECIPIENT for testing.

Send 0.01 MON each to 0xA, 0xB and 0xC.

Send 10 USDC token 0xTOKEN_CONTRACT to 0xRECIPIENT.

Deploy my policy vault.

Create escrow 1 MON for 0xSELLER with arbiter 0xARBITER refund after 24 hours terms Product delivered as agreed.

Verify escrow 0xESCROW with deliverable https://example.com/deliverable.

Scan this EVM bytecode and explain every deterministic security signal: 0x326000f46000f2ff
```

Use real Testnet addresses. DONADS intentionally rejects placeholders such as `0xRECIPIENT` until they are replaced with valid 42-character EVM addresses.

## Project documentation

- [Current architecture](docs/architecture/current-state.md)
- [Architecture decisions](docs/architecture/decisions.md)
- [Acceptance matrix](docs/acceptance-matrix.md)
- [Connected applications](docs/connected-apps.md)
- [Mainnet runbook](docs/mainnet-runbook.md)
- [Navigator/browser proposal](docs/NAVIGATOR_PHASE_5_PROPOSAL.md)

## Product principle

DONADS should not claim that a task is complete because an AI generated a convincing answer. Completion requires the requested real-world or on-chain state, the correct approval boundary and evidence that can be checked independently.
