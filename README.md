# DONADS

DONADS is a crypto-native agent system for Monad. It turns a user goal into bounded specialist tasks, requires exact authorization for sensitive actions, and reports only externally verifiable results.

## Product rule

DONADS uses crypto only. The project contains no fiat payment provider, Razorpay integration, Cashfree integration, gift-card workaround, or simulated successful payment. A purchase can execute only when the merchant directly accepts the configured crypto asset or exposes an authorized crypto checkout API. Unsupported retailers must fail closed.

The current repository can request a user-approved native MON transaction through an injected wallet and verify its mined receipt. It does **not** place merchant orders. Commerce remains an exact, approval-bound intent until an authorized crypto merchant is connected.

## Current specialists

| Bot | Working now | Still missing |
| --- | --- | --- |
| Scout | Fetches up to five supplied public URLs, extracts evidence, and returns citations | Live search provider, browser navigation, product discovery, authenticated sessions |
| Commerce | Validates user-supplied crypto offers, selects an in-stock offer within an atomic-unit budget, and binds approval to the exact asset and amount | Crypto merchant adapter, wallet request, transaction receipt verification, merchant order receipt |
| Growth | Creates deterministic campaign drafts from a stored brand profile and cited evidence | LLM-backed drafting, Telegram/Gmail/X publishing with approval and verified message IDs |
| Flow | Connects an injected wallet, enforces Monad Testnet, broadcasts an exact native MON transfer, and verifies its mined receipt server-side | Policy-vault enforcement, delegated KMS signer, ERC-20 transfers, replacement and recovery UI |
| Operator | Validates dependency graphs, runs approved specialist steps, persists state, supports cancellation and retry | Sentinel pre-flight gate, durable production queue, real external-action recovery |
| Sentinel | Provides clickable bytecode triage and mandatory Flow pre-flight checks for network, sender, recipient, asset, and exact amount | Merchant/domain allowlists, policy-vault state checks, prompt-injection defenses |

The ten-bot target has not been reached. Six bots exist; four additional bots must be specified and approved before implementation.

## Non-mock completion standard

A crypto transfer is complete only after DONADS has:

1. Obtained exact user or policy-vault authorization.
2. Received a real wallet signature.
3. Broadcast the raw transaction to the configured Monad network.
4. Received a successful transaction receipt from Monad RPC.
5. Verified chain ID, recipient, asset, amount, nonce, and transaction status.

A purchase is complete only after the above transaction proof **and** a real merchant order ID or signed merchant receipt are available. A transaction hash alone is not an order.

## Architecture

- Rust workspace for specialists, task persistence, routing, and Monad RPC health checks.
- Next.js interface for specialist workspaces and approval boundaries.
- Monad testnet is the only permitted execution target until the security and recovery test suite passes.
- JSON persistence is development-only and must be replaced with a transactional database before production.

## Run locally

Requirements: current stable Rust, Node.js, and npm.

```powershell
Copy-Item .env.example .env
cargo run -p donads-dispatch
```

In a second terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The API binds to `127.0.0.1:8080` by default.

## Configuration

See `.env.example`. Never commit seed phrases, private keys, browser session data, OAuth tokens, or merchant credentials. Production signing must use a user-controlled wallet or a narrowly delegated key stored in KMS/HSM.

## Required implementation sequence

1. Execute and record the first funded native MON testnet acceptance transfer.
2. Run `DonadsPolicyVault.sol` behavioral tests with Foundry, audit it, and deploy it to testnet.
3. Extend the mandatory Sentinel Flow gate with deployed policy-vault state and merchant-domain checks.
4. Add recovery for delayed, dropped, replaced, and reverted transactions.
5. Add ERC-20 transfer support with exact token/decimal validation.
6. Integrate one authorized crypto-accepting test merchant.
7. Verify a real merchant order receipt and implement refund/recovery behavior.
8. Replace JSON files with PostgreSQL and a durable job queue.
9. Add authentication, task ownership, restrictive CORS, rate limits, encrypted secrets, monitoring, and backups.
10. Complete contract audit, penetration testing, prompt-injection testing, and testnet acceptance before considering mainnet.

## Verification

```powershell
cargo test --workspace
Set-Location frontend
npm test -- --run
npm run lint
npm run build
```

Contract checks:

```powershell
Set-Location contracts
npm install
npm run compile
npm test
npm audit
```

Unit-test doubles are retained inside test files. They verify failure handling and UI behavior; they are not product execution paths and never create user-visible transaction or order claims.
