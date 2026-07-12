# GenLayer Evidence Resolution Agent

GenLayer Evidence Resolution Agent is a GenLayer-native adjudication product for resolving evidence-based claims on-chain.

It gives builders a working terminal-style dashboard where they can:

- connect a browser wallet
- deploy or import a GenLayer Intelligent Contract
- submit a claim with live evidence URLs
- trigger on-chain resolution through GenLayer's non-deterministic consensus flow
- inspect verdicts, confidence, rationale, citations, and local activity history

This project was built specifically to match what GenLayer is good at: contracts that fetch live web data, use LLM judgment, and still reach consensus through validator review.

## Demo

- GitHub: https://github.com/Jinchainne/genlayer-evidence-resolution-agent
- Production: https://genlayer-evidence-resolution-agent.vercel.app

## What Problem It Solves

Normal smart contracts are strong at deterministic rules, but weak at subjective adjudication.

This project targets the class of problems where a contract must answer questions like:

- is this claim supported by current public evidence?
- do multiple sources materially agree or contradict each other?
- should the outcome be `SUPPORTED`, `REFUTED`, or `INCONCLUSIVE`?

Those are not good fits for classic EVM-only logic. They are good fits for GenLayer.

## Why This Is GenLayer-Native

This repo is intentionally not an EVM app with AI branding on top.

The contract uses GenLayer-native primitives:

- `gl.nondet.web.get(...)` to fetch live evidence inside the contract
- `gl.nondet.exec_prompt(...)` to produce structured adjudication output
- `gl.vm.run_nondet_unsafe(...)` to run a validator-reviewed consensus path

The validator does not merely accept a byte-for-byte identical response. It independently derives its own structured decision and compares it against the leader result using explicit rules:

- same verdict
- confidence difference within tolerance
- citation overlap for non-`INCONCLUSIVE` outcomes

That is the core reason this project aligns with GenLayer's adjudication model.

## Core Features

- Next.js dashboard with GenLayer builder UX
- Browser-wallet write flow through `genlayer-js`
- Deploy contract from UI
- Import existing contract address
- Create cases with title, claim, criteria, category, and up to 3 evidence URLs
- Resolve cases on-chain through GenLayer consensus
- Read back on-chain case state
- Local draft persistence
- Local activity tape
- Verdict mix and confidence charts
- Direct-mode contract tests
- Studio Mode integration test scaffolding
- CI workflow for config checks, contract checks, typecheck, and direct tests

## Product Flow

### 1. Connect wallet

The app uses an injected browser wallet for all write actions.

### 2. Deploy or import contract

You can deploy `GenLayerEvidenceResolutionAgent` directly from the dashboard or paste an existing deployed address.

### 3. Draft a case

Each case contains:

- title
- claim statement
- adjudication criteria
- category
- one to three evidence URLs

### 4. Submit on-chain

`create_case(...)` stores the claim in contract state as `SUBMITTED`.

### 5. Resolve through GenLayer

`resolve_case(case_id)` fetches live evidence, asks for a structured judgment, and stores the accepted result on-chain as:

- verdict
- confidence
- rationale
- citations
- resolver metadata

## Architecture

### Frontend

- Next.js App Router
- React 19 client-side dashboard
- Tailwind CSS retro terminal theme
- Recharts for small, bounded visualizations

### Contract

Main contract:

```text
contracts/GenLayerEvidenceResolutionAgent.py
```

Public methods:

- `create_case(...)`
- `resolve_case(case_id)`
- `get_case(case_id)`
- `get_case_count()`
- `get_cases_page(start, limit)`

### Storage

The contract stores case records as JSON strings keyed by case id.

The frontend stores local drafts, network selection, imported contract address, and activity feed in browser storage for a smoother builder workflow.

## Repository Layout

```text
app/
  layout.tsx
  page.tsx
components/ui/
contracts/
  GenLayerEvidenceResolutionAgent.py
lib/genlayer/
scripts/
tests/direct/
tests/integration/
```

## Supported Networks

The app currently supports:

- `studionet`
- `testnetBradbury`
- `localnet`

Network definitions live in:

```text
lib/genlayer/networks.ts
```

These defaults were aligned with the current GenLayer docs at the time of implementation.

## Local Setup

### Requirements

- Node.js 20+
- npm
- Python 3.12+
- browser wallet compatible with the GenLayer flow

### Wallet setup recommendation

For local development, use the documented wallet path from the official `genlayer-wallet` ecosystem:

- prefer `MetaMask Flask`
- use a dedicated development wallet
- connect to `localnet` or `studionet` before sending writes

Official reference:

- https://github.com/genlayerlabs/genlayer-wallet

### Install dependencies

```bash
npm install
pip install -r requirements.txt
```

### Configure environment

Copy the example env file:

```bash
cp .env.example .env.local
```

Optional frontend defaults:

```env
NEXT_PUBLIC_GENLAYER_DEFAULT_NETWORK=studionet
NEXT_PUBLIC_GENLAYER_DEFAULT_CONTRACT_ADDRESS=
```

### Start the app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Quick Builder Walkthrough

### Deploy a contract

1. Start the app
2. Connect wallet
3. Choose `studionet` or `localnet`
4. Click `Deploy Contract`
5. Save the returned contract address

### Submit a case

1. Load a template or draft a new claim
2. Fill claim, criteria, and evidence URLs
3. Click `Submit On-Chain`

### Resolve a case

1. Open the `Chain Cases` section
2. Click `Resolve On-Chain`
3. Wait for the transaction and GenLayer result
4. Review the stored verdict and supporting fields

## Verification

Before pushing or deploying, run:

```bash
npm run genlayer:check
npm run contract:check
npm run typecheck
npm run build
python -m pytest tests/direct -v
```

## Testing

This repo includes both fast direct-mode tests and Studio Mode integration scaffolding.

### Direct tests

Run:

```bash
npm run contract:check
python -m pytest tests/direct -v
```

Coverage includes:

- case creation
- resolution persistence
- validator disagreement path
- citation filtering

### Studio Mode integration tests

Integration file:

```text
tests/integration/test_studio_claim_roundtrip.py
```

Current Studio coverage includes:

- deploy contract through RPC
- create claim roundtrip
- read back stored claim
- mocked validator-based `resolve_case(...)`

Run:

```bash
set RUN_STUDIO_TESTS=1
python -m pytest tests/integration -v -m studio
```

Prerequisites:

- Studio or local GenLayer network is actually running
- `gltest.config.yaml` is present
- Python environment has `genlayer-test` installed
- `RUN_STUDIO_TESTS=1` is set

## Contract Tooling

The repo includes a Windows-safe wrapper for GenLayer lint and validation:

```bash
npm run contract:check
```

This runs `genvm-lint check` through:

```text
scripts/run-genvm-lint.py
```

It exists mainly to avoid Windows console encoding issues and keep local builder flow consistent with CI.

## CI

Workflow file:

```text
.github/workflows/ci.yml
```

Current CI runs:

- `npm run genlayer:check`
- `npm run contract:check`
- `npm run typecheck`
- `python -m pytest tests/direct -v`

## Deployment

This project deploys well on Vercel because the write path is browser-wallet initiated.

Typical deploy command:

```bash
npx vercel --prod
```

No hidden backend signer is required for the main MVP flow.

## Why This Is A Strong Builder Submission

This repo is positioned as a real GenLayer project, not just a contract snippet or UI mockup.

It demonstrates:

- a complete user flow from deploy to submit to resolve
- meaningful non-deterministic contract behavior
- validator-reviewed decision logic
- live web evidence fetched inside the contract
- browser-wallet signing instead of a fake backend signer
- testing and CI discipline

## Current Boundaries

This is a strong MVP, but it is still honest about scope.

Not included yet:

- autonomous backend runner
- appeal workflow
- trust-weighted evidence domains
- richer multi-party dispute roles
- full Studio-to-testnet end-to-end automation matrix

## Best Next Iterations

- add appeal and counter-evidence flow
- add role-based claimant/respondent case structure
- add domain trust scoring or evidence weighting
- add richer Studio integration coverage for more consensus branches
- add case timeline and receipt explorer panels
- add queue or leaderboard view for multiple active cases

## References

- [GenLayer Docs](https://docs.genlayer.com/)
- [GenLayerJS](https://docs.genlayer.com/api-references/genlayer-js)
- [GenLayer Testing Suite](https://docs.genlayer.com/api-references/genlayer-test)
- [GenLayer Wallet](https://github.com/genlayerlabs/genlayer-wallet)
- [GenVM Linter](https://github.com/genlayerlabs/genvm-linter)
- [GenLayer Studio](https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-studio)

## Submission Positioning

If you use this for a GenLayer builder submission, the strongest short positioning is:

- this is a GenLayer-native evidence adjudication agent
- the contract fetches live public web evidence
- the verdict depends on validator-reviewed non-deterministic reasoning
- the app exposes the full builder flow in a clear browser-wallet dashboard
