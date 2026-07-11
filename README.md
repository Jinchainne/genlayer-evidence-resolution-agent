# GenLayer Evidence Resolution Agent

GenLayer Evidence Resolution Agent is a GenLayer-native MVP for evidence-based claim review. It is a browser-wallet adjudication terminal where builders can deploy an Intelligent Contract, submit cases with live evidence URLs, and resolve those cases through GenLayer's non-deterministic consensus flow.

The core idea is simple:

- users submit a claim plus evidence URLs
- the GenLayer contract fetches live web data inside the contract
- the contract asks validators to judge the output with the Equivalence Principle
- the result is stored on-chain as a structured verdict

This is designed to fit GenLayer's strengths instead of forcing an EVM-style pattern onto GenLayer.

## Why This Fits GenLayer

The previous rejected GenLayer submission the user shared was rejected because the reviewed contract was deterministic and did not use GenLayer consensus for a meaningful non-deterministic result.

This repo addresses that directly:

- the contract is written in Python as an Intelligent Contract
- it uses `gl.nondet.web.get(...)` to fetch live evidence
- it uses a custom validator-reviewed non-deterministic judgment flow
- the verdict is validator-reviewed instead of being a fixed deterministic mapping

That makes the product structurally aligned with GenLayer's adjudication model.

## MVP Features

- GenLayer terminal-style dashboard in Next.js
- Browser wallet connection for GenLayerJS write actions
- Network switcher for `studionet`, `Bradbury`, and `localnet`
- Deploy contract from the UI
- Import an existing contract address
- Create claim cases with title, claim, category, criteria, and evidence URLs
- Resolve claim cases on-chain
- Local activity tape for transaction and operator feedback
- Local draft persistence in `localStorage`
- Verdict mix chart and confidence trend chart
- Direct-mode Python contract test scaffold for `genlayer-test`

## Product Flow

### 1. Connect wallet

The UI connects to an injected browser wallet and uses GenLayerJS for writes.

### 2. Deploy or import contract

You can deploy `GenLayerEvidenceResolutionAgent` from the dashboard or paste an already-deployed contract address.

### 3. Draft a case

Each case includes:

- title
- claim
- category
- adjudication criteria
- up to 3 evidence URLs

### 4. Submit case on-chain

The contract stores the claim and marks it `SUBMITTED`.

### 5. Resolve case through GenLayer

When `resolve_case(case_id)` runs:

- the contract fetches evidence from the supplied URLs
- the contract asks GenLayer validators to judge a meaningful verdict
- the verdict becomes `SUPPORTED`, `REFUTED`, or `INCONCLUSIVE`
- confidence, rationale, and citations are stored on-chain

## Contract Design

Main contract:

```text
contracts/GenLayerEvidenceResolutionAgent.py
```

Main methods:

- `create_case(...)`
- `resolve_case(case_id)`
- `get_case(case_id)`
- `get_case_count()`
- `get_cases_page(start, limit)`

### Non-deterministic resolution path

The important part is `resolve_case(...)`.

It uses:

- `gl.nondet.web.get(...)` for live evidence retrieval
- `gl.nondet.exec_prompt(...)` for structured judgment generation
- `gl.vm.run_nondet_unsafe(...)` for explicit validator-reviewed consensus logic

This is the core GenLayer-native behavior of the project.

## Stack

- Next.js App Router
- React 19
- Tailwind CSS
- Recharts
- `genlayer-js`
- Python Intelligent Contract for GenLayer

## Project Structure

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
```

## Local Setup

### Requirements

- Node.js 20+
- npm
- Python 3.12+ for contract-side tests
- a browser wallet compatible with GenLayer workflows

### Install frontend dependencies

```bash
npm install
```

### Run the app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment

Copy:

```bash
cp .env.example .env.local
```

Current MVP only needs optional frontend defaults:

```env
NEXT_PUBLIC_GENLAYER_DEFAULT_NETWORK=studionet
NEXT_PUBLIC_GENLAYER_DEFAULT_CONTRACT_ADDRESS=
```

Notes:

- this MVP is browser-wallet first
- no burner private key is required
- no hidden backend signer is used

## Supported Networks

The app currently ships with:

- `studionet`
- `testnetBradbury`
- `localnet`

Network metadata is defined in:

```text
lib/genlayer/networks.ts
```

Reference:

- Studionet RPC: `https://studio.genlayer.com/api`
- Studionet chain ID: `61999`
- Studionet explorer: `https://explorer-studio.genlayer.com`
- Bradbury RPC: `https://rpc-bradbury.genlayer.com`
- Bradbury chain ID: `4221`

These values were aligned with the current official GenLayer docs.

## How To Use The MVP

### Deploy a fresh contract

1. Start the app
2. Connect your wallet
3. Select `studionet`
4. Click the deploy action in the contract panel
5. Wait for the accepted transaction and returned contract address

### Submit a claim

1. Fill title, claim, category, criteria
2. Add one to three evidence URLs
3. Submit the case

### Resolve a claim

1. Click resolve for a submitted case
2. Wait for GenLayer consensus
3. Review verdict, rationale, citations, and confidence

## Builder Story

This repo is a strong GenLayer builder starting point because it demonstrates:

- a product UI, not just an isolated contract
- a contract that uses native web access
- a contract that uses meaningful non-deterministic consensus
- a visible on-chain user flow from deploy to submit to resolve

## Verification

Before pushing or deploying, run:

```bash
npm run genlayer:check
npm run typecheck
npm run build
```

## Contract Testing

The repo includes a first-pass direct-mode test scaffold for `genlayer-test`.

Suggested Python packages:

```bash
pip install genlayer-test pytest
```

Then run:

```bash
pytest tests/direct -v
```

Included test coverage focuses on:

- case creation
- resolution state transition
- validator agreement behavior
- citation filtering

## Deployment

### Vercel

This app can be deployed to Vercel because the main write path is browser-wallet initiated.

Typical flow:

```bash
npx vercel --prod
```

No secret backend signer is required for the MVP.

### GitHub

Create a new repository, commit, push, then connect the repo to Vercel.

## Known MVP Boundaries

- no autonomous backend runner yet
- no multi-user backend database
- no full Studio Mode integration test suite yet
- no appeals workflow yet
- no evidence source trust scoring yet

These are good follow-up milestones after the MVP is live.

## Next Recommended Iterations

- add appeal and counter-evidence flow
- add judge configuration presets by case type
- add trust weighting for evidence domains
- add Studio Mode integration tests
- add richer case timeline and receipt linking
- add hosted read-only leaderboard or queue explorer

## Useful References

- [GenLayer Introduction](https://docs.genlayer.com/developers/intelligent-contracts/introduction)
- [Your First Contract](https://docs.genlayer.com/developers/intelligent-contracts/first-contract)
- [Deploying Intelligent Contracts](https://docs.genlayer.com/developers/intelligent-contracts/deploying)
- [GenLayerJS](https://docs.genlayer.com/api-references/genlayer-js)
- [GenLayer Testing Suite](https://docs.genlayer.com/api-references/genlayer-test)

## Submission Positioning

If you submit this to a GenLayer builder track, the strongest positioning is:

- this is a GenLayer-native adjudication product
- the contract uses live web evidence
- the verdict depends on meaningful validator-reviewed non-deterministic reasoning
- the frontend makes the full deploy and resolve flow easy to inspect
