# 🧬 DONADS — Decentralized On-chain Neural Agent Dispatch System

> **GrokBot reimagined for the Monad blockchain.** A multi-agent AI infrastructure where 10 hyper-specialized bots operate natively on Monad mainnet — each with a singular, irreplaceable on-chain capability that no generic assistant can replicate.

---

## 📋 Table of Contents

- [Vision](#vision)
- [Why Monad?](#why-monad)
- [Architecture Overview](#architecture-overview)
- [The 10 Specialist Bots](#the-10-specialist-bots)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Development Roadmap](#development-roadmap)
- [Deployment & CI/CD](#deployment--cicd)
- [Contributing](#contributing)
- [License](#license)

---

## Vision

Donads is **not** another chatbot wrapper. It is a **full-fledged autonomous agent dispatch system** built ground-up for the Monad EVM ecosystem. Each of the 10 bots is a **domain-locked specialist** — it does one thing that is deeply intertwined with blockchain state, MEV dynamics, smart contract internals, or cryptographic primitives. These are tasks that *cannot* exist outside of a blockchain context.

The platform functions similarly to GrokBot in terms of user interaction (conversational interface, task dispatch, persistent memory) but diverges entirely in *what* the agents actually do. Every agent is a first-class on-chain actor with its own wallet, execution context, and specialization.

---

## Why Monad?

| Property | Benefit for Donads |
|---|---|
| **10,000 TPS** | Agents can fire parallel on-chain transactions without congestion bottlenecks |
| **1s Block Time** | Near-real-time agent response loops; bots react to state changes within a single block |
| **EVM Compatibility** | Full Solidity/Vyper toolchain; deploy existing DeFi primitives alongside Rust-powered agent cores |
| **Parallel Execution** | Monad's optimistic parallel execution lets multiple agents operate concurrently without serial bottlenecks |
| **Low Gas Costs** | High-throughput design keeps per-tx costs negligible, enabling micro-transaction agent behaviors |
| **Mainnet Maturity** | Targeting **Monad Mainnet** — production-grade, not testnet prototyping |

**Chain ID:** Monad Mainnet (to be confirmed at launch)  
**RPC Endpoints:** Will be configured via environment variables for flexibility  
**Native Token:** MON (used for gas + agent staking)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     DONADS GATEWAY (API)                      │
│               Rust (Actix-Web / Axum) REST + WS              │
├──────────────────────────────────────────────────────────────┤
│                     DISPATCH ENGINE                           │
│         Task Router │ Priority Queue │ Agent Registry          │
├───────┬───────┬───────┬───────┬───────┬───────┬──────────────┤
│ Bot 1 │ Bot 2 │ Bot 3 │ Bot 4 │ Bot 5 │ Bot 6 │  ...Bot 10   │
│       │       │       │       │       │       │              │
│ Each bot runs as an isolated Rust microservice               │
│ with its own wallet, state store, and chain listener         │
├──────────────────────────────────────────────────────────────┤
│                  MONAD CHAIN INTERFACE                        │
│        ethers-rs │ alloy │ Custom RPC Middleware              │
├──────────────────────────────────────────────────────────────┤
│                  ON-CHAIN CONTRACTS                           │
│     Agent Registry │ Task Escrow │ Reputation System          │
│               (Solidity — deployed on Monad Mainnet)          │
└──────────────────────────────────────────────────────────────┘
```

**Key Architectural Principles:**
- **Each bot is a standalone Rust binary** communicating via gRPC with the dispatch engine
- **On-chain state is the single source of truth** — bots read chain state, not cached databases
- **Agent wallets are HD-derived** from a master seed per deployment
- **All inter-bot communication happens through on-chain events** (no off-chain message buses for critical paths)

---

## The 10 Specialist Bots

> ⚠️ These are **NOT** generic assistant tasks. Each bot performs a deeply technical, blockchain-native function that requires direct chain interaction, cryptographic operations, or real-time mempool analysis.

---

### 🤖 Bot #1 — SENTINEL (Rug-Pull & Exploit Early Warning System)

**Specialty:** Real-time smart contract threat detection and exploit prediction.

**What it does:**
- Monitors every newly deployed contract on Monad for known exploit patterns (reentrancy, access control gaps, storage collisions, proxy manipulation)
- Runs bytecode-level static analysis using symbolic execution (powered by Rust)
- Detects rug-pull signatures: hidden mint functions, ownership transfer traps, liquidity lock bypasses
- Issues on-chain "threat scores" that other protocols can consume as an oracle
- Fires preemptive alerts before exploits happen, not after

**Why this is unique:** This is NOT a "scan my contract" tool. Sentinel operates autonomously, scanning the entire Monad contract deployment stream in real-time. It's a living immune system for the chain.

**Core Rust Crates:** `revm` (EVM execution), `ethers-rs`, `alloy-primitives`, custom symbolic executor

---

### 🤖 Bot #2 — REAPER (MEV Extraction & Protection Agent)

**Specialty:** Mempool intelligence — detects, classifies, and optionally front-runs or protects against MEV attacks.

**What it does:**
- Connects directly to Monad's mempool (pending transaction pool)
- Classifies pending transactions: sandwich attacks, arbitrage, liquidation races, JIT liquidity
- **Protection mode:** Wraps user transactions in private bundles to avoid sandwich attacks
- **Extraction mode:** Identifies pure arbitrage opportunities (no user harm) and executes them
- Maintains a real-time MEV dashboard with per-block extraction metrics

**Why this is unique:** Dual-mode MEV agent — can be both shield and sword. Operates at the mempool layer, not the application layer.

**Core Rust Crates:** `mev-rs`, `ethers-rs`, `tokio` (async runtime), custom mempool subscriber

---

### 🤖 Bot #3 — ORACLE WEAVER (Cross-Chain Data Stitching Engine)

**Specialty:** Aggregates, verifies, and publishes cryptographically-attested cross-chain data feeds on Monad.

**What it does:**
- Pulls price feeds, TVL data, governance outcomes, and bridge states from 15+ chains
- Uses multi-source median with outlier rejection (not simple averaging)
- Publishes attested data on-chain with zk-proof-of-source (proves the data came from verified RPC endpoints)
- Other Donads bots (and external protocols) consume these feeds
- Self-heals: detects stale or manipulated feeds and auto-switches sources

**Why this is unique:** Not a Chainlink clone. Oracle Weaver produces *composite* cross-chain data objects (e.g., "ETH price weighted by volume across 5 DEXes on 3 chains") that don't exist anywhere else.

**Core Rust Crates:** `reqwest`, `serde`, `ark-groth16` (zk proofs), `alloy`

---

### 🤖 Bot #4 — PHANTOM (Liquidity Ghost Mapping & LP Autopsy)

**Specialty:** Deep forensic analysis of liquidity pool health, impermanent loss trajectories, and "ghost liquidity" detection.

**What it does:**
- Maps the *real* liquidity depth of any Monad DEX pool (not the displayed number — the actually executable depth)
- Detects "ghost liquidity" — positions that exist on paper but will be pulled before any large trade executes
- Performs LP autopsy: given a wallet, reconstructs the full history of LP positions, IL incurred, fees earned, and net P&L
- Identifies "toxic flow" pools where LPs are consistently losing to informed traders
- Generates liquidity heatmaps showing where real depth exists across price ranges

**Why this is unique:** Goes far beyond portfolio tracking. Phantom reverse-engineers the game theory of liquidity provision on Monad.

**Core Rust Crates:** `uniswap-v3-math` (tick math), `ethers-rs`, `plotters` (visualization), `rayon` (parallel computation)

---

### 🤖 Bot #5 — NECROMANCER (Dead Protocol Revival & Migration Agent)

**Specialty:** Identifies abandoned/dying protocols on Monad and autonomously migrates trapped user funds to safer alternatives.

**What it does:**
- Monitors protocol health signals: declining TVL velocity, developer commit frequency, governance inactivity, oracle staleness
- Detects "zombie protocols" — contracts still holding user funds but with no active development or governance
- Proposes migration paths: identifies equivalent protocols and generates migration transaction bundles
- For protocols with governance, submits wind-down proposals with fund-return plans
- Maintains a "protocol graveyard" registry on-chain

**Why this is unique:** No one builds for the *death* of protocols. Necromancer is a digital archaeologist that ensures user funds don't get trapped in abandoned smart contracts.

**Core Rust Crates:** `ethers-rs`, `alloy`, `tokio-cron-scheduler`, custom protocol health scoring engine

---

### 🤖 Bot #6 — SIGIL (On-Chain Identity & Reputation Cryptography Engine)

**Specialty:** Non-transferable, cryptographic reputation attestations that prove on-chain behavioral history without revealing wallet addresses.

**What it does:**
- Builds zero-knowledge reputation proofs: "This wallet has executed 500+ DeFi transactions without a single liquidation" — provable without revealing the wallet
- Issues Soulbound Attestation Tokens (SATs) on Monad — non-transferable NFTs encoding behavioral traits
- Powers undercollateralized lending: protocols can trust a reputation score without knowing the borrower
- Detects Sybil clusters: identifies when multiple wallets are controlled by the same entity using transaction graph analysis
- Provides privacy-preserving KYC-equivalent signals for DeFi compliance

**Why this is unique:** Combines ZK cryptography with on-chain behavioral analysis to create a reputation layer that didn't exist before on Monad.

**Core Rust Crates:** `ark-circom`, `ark-bn254`, `petgraph` (graph analysis), `ethers-rs`

---

### 🤖 Bot #7 — CHRONOS (Time-Locked Transaction Orchestration & Scheduling)

**Specialty:** Complex conditional and time-dependent transaction orchestration that executes based on on-chain state transitions.

**What it does:**
- Users define transaction DAGs (Directed Acyclic Graphs): "If ETH price hits X AND pool TVL exceeds Y, execute swap Z, then stake the output, then..."
- Executes multi-step transaction chains atomically using Monad's parallel execution capabilities
- Supports time-locks, deadlines, and fallback paths (if step 3 fails, execute recovery path B)
- Maintains a keeper network for guaranteed execution even if the user is offline
- Provides formal verification of transaction DAGs before execution (proves the DAG cannot result in fund loss)

**Why this is unique:** This is not "schedule a transaction." Chronos handles arbitrary conditional logic with formal safety guarantees. It's a programmable transaction state machine.

**Core Rust Crates:** `petgraph`, `z3` (SMT solver for verification), `ethers-rs`, `tokio`

---

### 🤖 Bot #8 — FLUX (Gas Economy Optimizer & Transaction Surgeon)

**Specialty:** Hyper-optimizes gas consumption by rewriting transaction calldata, batching operations, and exploiting Monad's parallel execution model.

**What it does:**
- Accepts a user's intended transaction and returns a gas-optimized version (sometimes 40-60% cheaper)
- Rewrites calldata: replaces expensive SSTORE patterns with cheaper alternatives, merges redundant calls
- Batches multiple user operations into single multicall transactions
- Exploits Monad-specific optimizations: parallel execution slots, optimistic state access patterns
- Maintains a gas price prediction model specific to Monad's block production dynamics
- Provides "gas X-ray" — visual breakdown of where gas is spent in any transaction

**Why this is unique:** Not a gas tracker. Flux is a transaction *surgeon* that rewrites your transactions to be fundamentally cheaper.

**Core Rust Crates:** `revm`, `alloy-sol-types`, `ethers-rs`, custom calldata optimizer

---

### 🤖 Bot #9 — PANOPTICON (Governance Intelligence & Vote Simulation Engine)

**Specialty:** Deep analysis of DAO governance proposals — simulates outcomes, detects voter collusion, and models economic impact before votes conclude.

**What it does:**
- Monitors all governance proposals across Monad-based DAOs
- Simulates proposal execution: forks current chain state, applies the proposal, and reports *exactly* what would change (balances, permissions, contract upgrades)
- Detects voter collusion: identifies coordinated voting patterns, bribe contracts, and vote buying schemes
- Models economic impact: "If this proposal passes, token X price will likely move Y% based on supply/demand changes"
- Generates plain-language summaries of highly technical governance proposals
- Tracks delegate behavior and voting consistency scores

**Why this is unique:** Not a governance aggregator. Panopticon *simulates the future* of each proposal and detects hidden manipulation.

**Core Rust Crates:** `revm` (state forking), `ethers-rs`, `ndarray` (numerical modeling), `petgraph`

---

### 🤖 Bot #10 — BASILISK (Smart Contract Mutation Testing & Adversarial Fuzzer)

**Specialty:** Autonomous adversarial testing of live smart contracts — finds vulnerabilities by *attacking* contracts in a sandboxed fork.

**What it does:**
- Takes any deployed Monad contract and runs thousands of adversarial test scenarios against a local fork
- Mutation testing: systematically modifies contract bytecode and checks if the test suite (if any) catches the mutation
- Grammar-aware fuzzing: generates valid but adversarial inputs based on the contract's ABI
- Finds edge cases that standard audits miss: integer boundaries, re-entrancy chains deeper than 3 levels, cross-function state corruption
- Produces a detailed vulnerability report with proof-of-concept exploit transactions
- Can be triggered by Sentinel (Bot #1) when a suspicious contract is detected

**Why this is unique:** Not a static analyzer. Basilisk *actively attacks* contracts in a sandbox. It's a red team bot.

**Core Rust Crates:** `revm`, `proptest` (property-based testing), `arbitrary` (structured fuzzing), `ethers-rs`

---

## Tech Stack

### Core Language: **Rust** 🦀

Rust is the backbone of Donads. Every bot core, the dispatch engine, and the chain interface are written in Rust. Reasons:

- **Memory safety without GC** — critical for long-running agents holding wallet keys
- **Fearless concurrency** — each bot handles hundreds of concurrent chain subscriptions
- **`revm` ecosystem** — the best EVM tooling exists in Rust
- **Performance** — mempool scanning and bytecode analysis require native speed
- **WASM compilation** — bot logic can be compiled to WASM for on-chain verification

### Full Stack Breakdown

| Layer | Technology | Purpose |
|---|---|---|
| **Bot Cores** | Rust (tokio async runtime) | All 10 bot implementations |
| **Dispatch Engine** | Rust (Axum or Actix-Web) | API gateway, task routing, agent registry |
| **Inter-Bot Communication** | gRPC (tonic) | High-performance bot-to-bot messaging |
| **Chain Interface** | ethers-rs / alloy | Monad RPC, transaction signing, event streaming |
| **EVM Simulation** | revm | Local EVM execution for simulation & analysis |
| **Smart Contracts** | Solidity (Foundry) | On-chain agent registry, escrow, reputation |
| **ZK Proofs** | arkworks (Rust) | Sigil bot's reputation attestations |
| **Database** | RocksDB (Rust) | Local bot state, indexed chain data |
| **Message Queue** | NATS / Redis Streams | Non-critical async communication |
| **Frontend** | Next.js + TypeScript | User dashboard, bot interaction UI |
| **Monitoring** | Prometheus + Grafana | Bot health, chain metrics, performance |
| **CI/CD** | GitHub Actions | Automated testing, deployment |

### Key Rust Dependencies

```toml
[workspace.dependencies]
# Async Runtime
tokio = { version = "1", features = ["full"] }
# Web Framework
axum = "0.7"
# Chain Interaction
ethers = { version = "2", features = ["rustls"] }
alloy = "0.1"
# EVM Simulation
revm = { version = "9", features = ["std"] }
# gRPC
tonic = "0.11"
prost = "0.12"
# ZK Proofs
ark-bn254 = "0.4"
ark-groth16 = "0.4"
ark-circom = "0.1"
# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"
# Database
rocksdb = "0.22"
# Logging
tracing = "0.1"
tracing-subscriber = "0.3"
# Testing
proptest = "1"
```

---

## Project Structure

```
Donads/
├── PROJECT.md                  # This file
├── README.md                   # Quick start guide
├── Cargo.toml                  # Workspace root
├── .github/
│   └── workflows/
│       ├── ci.yml              # Continuous integration
│       └── deploy.yml          # Deployment pipeline
├── crates/
│   ├── donads-core/            # Shared types, traits, utilities
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── types.rs        # Common types across all bots
│   │   │   ├── traits.rs       # Bot trait definitions
│   │   │   ├── chain.rs        # Monad chain interface
│   │   │   ├── wallet.rs       # HD wallet derivation
│   │   │   └── config.rs       # Configuration management
│   │   └── Cargo.toml
│   ├── donads-dispatch/        # Dispatch engine & API gateway
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── router.rs       # Task routing logic
│   │   │   ├── registry.rs     # Agent registry
│   │   │   └── api.rs          # REST + WebSocket endpoints
│   │   └── Cargo.toml
│   ├── bot-sentinel/           # Bot #1 — Rug-Pull Scanner
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── analyzer.rs
│   │   │   └── patterns.rs
│   │   └── Cargo.toml
│   ├── bot-reaper/             # Bot #2 — MEV Agent
│   ├── bot-oracle-weaver/      # Bot #3 — Cross-Chain Oracle
│   ├── bot-phantom/            # Bot #4 — Liquidity Forensics
│   ├── bot-necromancer/        # Bot #5 — Dead Protocol Revival
│   ├── bot-sigil/              # Bot #6 — ZK Reputation
│   ├── bot-chronos/            # Bot #7 — Transaction Orchestration
│   ├── bot-flux/               # Bot #8 — Gas Optimizer
│   ├── bot-panopticon/         # Bot #9 — Governance Intelligence
│   └── bot-basilisk/           # Bot #10 — Adversarial Fuzzer
├── contracts/
│   ├── foundry.toml
│   ├── src/
│   │   ├── AgentRegistry.sol   # On-chain bot registry
│   │   ├── TaskEscrow.sol      # Payment escrow for tasks
│   │   ├── ReputationSBT.sol   # Soulbound reputation tokens
│   │   └── ThreatOracle.sol    # Sentinel's threat score feed
│   ├── test/
│   └── script/
├── proto/
│   └── donads.proto            # gRPC service definitions
├── frontend/                   # Next.js dashboard
│   ├── package.json
│   ├── src/
│   └── public/
├── config/
│   ├── default.toml            # Default configuration
│   ├── mainnet.toml            # Monad mainnet config
│   └── testnet.toml            # Testnet config
├── scripts/
│   ├── deploy.sh               # Contract deployment
│   └── setup.sh                # Dev environment setup
└── docs/
    ├── architecture.md
    ├── bot-specs/
    │   ├── sentinel.md
    │   ├── reaper.md
    │   └── ...
    └── api-reference.md
```

---

## Coding Standards

### Rust Standards (MANDATORY)

1. **Zero `unwrap()` in production code.** Use `?` operator, `anyhow::Result`, or `thiserror` for typed errors. Every `unwrap()` in non-test code will be rejected in review.

2. **All public functions must have doc comments.** Use `///` with examples where applicable. Run `cargo doc --no-deps` and verify documentation compiles.

3. **Clippy must pass at `pedantic` level:**
   ```bash
   cargo clippy --workspace --all-targets -- -D warnings -W clippy::pedantic
   ```

4. **Format with `rustfmt`** — no exceptions. CI will reject unformatted code.
   ```bash
   cargo fmt --all -- --check
   ```

5. **Test coverage minimum: 80%.** Each bot must have:
   - Unit tests for all core logic
   - Integration tests against a local `revm` fork
   - Property-based tests (using `proptest`) for critical paths

6. **No `unsafe` blocks** without a `// SAFETY:` comment explaining why it's necessary and why it's sound.

7. **Dependency audit:** Run `cargo audit` before every PR. No known vulnerabilities allowed in the dependency tree.

8. **Error handling hierarchy:**
   - `thiserror` for library errors (typed, matchable)
   - `anyhow` for application errors (context-rich, displayable)
   - Never use `String` as an error type

9. **Logging with `tracing`** — structured logging only. No `println!` in production code.
   ```rust
   tracing::info!(bot = "sentinel", contract = %address, "Threat detected");
   ```

10. **Async discipline:**
    - Use `tokio` as the sole async runtime
    - Never block the async runtime (`tokio::task::spawn_blocking` for CPU-heavy work)
    - All chain interactions must be async with configurable timeouts

### Solidity Standards

1. **Foundry-only toolchain** — no Hardhat, no Truffle
2. **NatSpec comments** on all public/external functions
3. **100% test coverage** on all contract functions
4. **Gas optimization:** Storage packing, `calldata` over `memory`, minimal `SSTORE` operations
5. **Upgradeable contracts** use UUPS proxy pattern (not transparent proxy)
6. **All contracts must pass `slither` and `mythril` static analysis**

### Git Workflow

- **Branch naming:** `feat/<bot-name>/<feature>`, `fix/<bot-name>/<issue>`, `docs/<topic>`
- **Commit messages:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- **PR requirements:** At least 1 approval, all CI checks passing, no merge commits
- **Main branch is always deployable**

---

## Development Roadmap

### Phase 0 — Foundation (Weeks 1-3)
- [ ] Initialize Rust workspace with `donads-core` crate
- [ ] Define `Bot` trait and `Task` types
- [ ] Set up Monad mainnet chain interface (ethers-rs / alloy)
- [ ] HD wallet derivation for agent wallets
- [ ] Dispatch engine skeleton (Axum)
- [ ] gRPC proto definitions
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Deploy basic `AgentRegistry.sol` on Monad testnet

### Phase 1 — First Wave Bots (Weeks 4-8)
- [ ] **Sentinel** (Bot #1) — Contract threat scanner
- [ ] **Reaper** (Bot #2) — MEV agent
- [ ] **Flux** (Bot #8) — Gas optimizer
- [ ] Integration tests against Monad testnet
- [ ] Basic frontend dashboard

### Phase 2 — DeFi Intelligence Bots (Weeks 9-13)
- [ ] **Oracle Weaver** (Bot #3) — Cross-chain data feeds
- [ ] **Phantom** (Bot #4) — Liquidity forensics
- [ ] **Necromancer** (Bot #5) — Dead protocol recovery
- [ ] Deploy `TaskEscrow.sol` and `ThreatOracle.sol`

### Phase 3 — Advanced Capabilities (Weeks 14-18)
- [ ] **Sigil** (Bot #6) — ZK reputation system
- [ ] **Chronos** (Bot #7) — Transaction orchestration
- [ ] **Panopticon** (Bot #9) — Governance intelligence
- [ ] **Basilisk** (Bot #10) — Adversarial fuzzer
- [ ] Deploy `ReputationSBT.sol`

### Phase 4 — Mainnet Launch (Weeks 19-22)
- [ ] Full security audit (external)
- [ ] Migrate all contracts to Monad mainnet
- [ ] Load testing with all 10 bots running concurrently
- [ ] Public API launch
- [ ] Documentation finalization
- [ ] Push final release to production

---

## Deployment & CI/CD

### GitHub Repository

**Remote:** `https://github.com/Aditya-linux/Donads.git`

```bash
# Initial setup
git init
git remote add origin https://github.com/Aditya-linux/Donads.git
git branch -M main

# Development workflow
git checkout -b feat/sentinel/bytecode-analyzer
# ... code ...
git add .
git commit -m "feat(sentinel): add bytecode pattern matching engine"
git push origin feat/sentinel/bytecode-analyzer
# Open PR → Review → Merge
```

### CI Pipeline (GitHub Actions)

Every PR triggers:
1. `cargo fmt --check` — formatting
2. `cargo clippy --workspace -- -D warnings` — linting
3. `cargo test --workspace` — all tests
4. `cargo audit` — dependency vulnerabilities
5. `forge test` — Solidity contract tests
6. `slither .` — contract static analysis

### Environment Configuration

```bash
# .env (NEVER commit this file)
MONAD_RPC_URL=https://mainnet.monad.xyz/rpc
MONAD_WS_URL=wss://mainnet.monad.xyz/ws
MASTER_SEED=<encrypted_seed>
AGENT_REGISTRY_ADDRESS=0x...
TASK_ESCROW_ADDRESS=0x...
DATABASE_PATH=./data/donads.db
LOG_LEVEL=info
```

---

## Key Awareness Items

> Things the team must keep in mind throughout development.

1. **Monad mainnet is the target** — all development should account for mainnet gas costs, block times, and finality guarantees. Do not assume testnet behavior matches mainnet.

2. **Private key security is paramount.** Agent wallets hold real funds. Use HSM or encrypted keystores. Never log private keys. Never hardcode seeds.

3. **Rate limiting on RPC endpoints.** Monad mainnet RPCs will have rate limits. Implement exponential backoff, connection pooling, and failover to multiple RPC providers.

4. **MEV protection for our own transactions.** Donads bots submit transactions to mainnet — they must protect their own transactions from being sandwich attacked. Use private transaction submission where available.

5. **Legal compliance.** MEV extraction (Reaper bot) and governance analysis (Panopticon bot) touch regulatory grey areas. Document all ethical guidelines and implement kill switches.

6. **Rust compilation times.** A 10-crate workspace will have long compile times. Use `cargo-nextest` for parallel test execution and `sccache` for compile caching.

7. **On-chain costs are real.** Every bot that writes to chain costs MON. Implement budgets per bot, spending alerts, and automatic pause when budgets are exceeded.

8. **Idempotency is mandatory.** Bots may crash and restart. Every on-chain operation must be idempotent — re-executing the same task must not double-spend or corrupt state.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `feat/<bot-name>/<feature>`
3. Write tests first (TDD encouraged)
4. Ensure all CI checks pass
5. Open a PR with a clear description
6. Address review feedback
7. Squash and merge

---

## License

TBD — To be determined based on project governance decisions.

---

*Built with 🦀 Rust and ⛓️ Monad. Donads is not just bots — it's an autonomous on-chain intelligence network.*
