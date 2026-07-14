# GenLayer Evidence Resolution Agent

GenLayer Evidence Resolution Agent is a GenLayer-native adjudication app for resolving evidence-based claims on-chain.

It gives builders and reviewers a complete flow to:

- connect a browser wallet
- deploy or import a GenLayer Intelligent Contract
- submit a claim with live evidence URLs
- trigger on-chain resolution through GenLayer consensus
- inspect verdict, confidence, rationale, citations, and local activity history

## Live Project

- GitHub: https://github.com/Jinchainne/genlayer-evidence-resolution-agent
- Demo: https://genlayer-evidence-resolution-agent.vercel.app

## Why This Project Belongs on GenLayer

Traditional smart contracts are good at deterministic rules. They are weak at judgment-based decisions such as:

- is a claim supported by the current public evidence?
- do multiple sources materially agree or contradict each other?
- should the outcome be `SUPPORTED`, `REFUTED`, or `INCONCLUSIVE`?

This project is built around exactly that category of problem.

The intelligent contract uses GenLayer-native primitives:

- `gl.nondet.web.get(...)` to fetch live evidence inside the contract
- `gl.nondet.exec_prompt(...)` to produce structured adjudication output
- `gl.vm.run_nondet_unsafe(...)` to validate a meaningful non-deterministic result through leader and validator review

That means the verdict is not decorative UI output. It is part of the contract execution path and is written back to on-chain state after GenLayer consensus.

## What Makes This A Real Builder Submission

This repo is not just:

- a static UI
- a CLI-only contract demo
- an EVM app with AI wording on top

It already implements the full application-to-contract flow:

- wallet connection
- contract deployment from the frontend
- contract import by address
- claim submission through a real GenLayer client path
- claim resolution through a GenLayer intelligent contract
- on-chain reads for submitted and resolved cases

Important source files:

- frontend flow: `app/page.tsx`
- GenLayer client integration: `lib/genlayer/client.ts`
- intelligent contract: `contracts/GenLayerEvidenceResolutionAgent.py`
- direct tests: `tests/direct/test_genlayer_evidence_resolution_agent.py`
- Studio integration scaffold: `tests/integration/test_studio_claim_roundtrip.py`

## Product Walkthrough

### 1. Connect wallet

The app uses an injected browser wallet for write actions.

### 2. Deploy or import contract

You can either:

- deploy `GenLayerEvidenceResolutionAgent` from the dashboard
- paste an existing deployed contract address

### 3. Draft a case

Each case contains:

- title
- claim
- adjudication criteria
- category
- one to three evidence URLs

### 4. Submit on-chain

`create_case(...)` stores the case on-chain with status `SUBMITTED`.

### 5. Resolve through GenLayer

`resolve_case(case_id)` does the meaningful part:

- fetches live evidence from the submitted URLs
- generates a structured adjudication result
- checks the result through GenLayer's non-deterministic validation path
- persists the accepted resolution back into contract state

Stored resolution fields:

- verdict
- confidence
- rationale
- citations
- resolver metadata

## Architecture

### Frontend

- Next.js App Router
- React 19
- Tailwind CSS
- Recharts

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

- contract state stores case records as JSON strings keyed by case id
- browser storage keeps local drafts, selected network, imported contract address, and activity feed

## Repository Layout

```text
app/
components/ui/
contracts/
lib/genlayer/
scripts/
tests/direct/
tests/integration/
.github/workflows/
```

## Supported Networks

The app currently includes definitions for:

- `localnet`
- `studionet`
- `testnetBradbury`

Source:

```text
lib/genlayer/networks.ts
```

## Builder Setup

### Requirements

- Node.js 20+
- npm
- Python 3.12+
- a browser wallet compatible with the GenLayer flow

### Install dependencies

```bash
npm install
pip install -r requirements.txt
```

### Optional environment defaults

Copy the example file:

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

## Builder Demo Guide

If you want to show this project to a reviewer quickly, use this path:

### Demo path A: UI capability check

1. Open the deployed app
2. Show the wallet connection flow
3. Show the Contract Panel with deploy/import support
4. Show the claim composer with evidence URLs
5. Show that the app has `Submit On-Chain` and case resolution actions

### Demo path B: code proof

Point reviewers to:

- `app/page.tsx` for the user flow
- `lib/genlayer/client.ts` for deploy, read, and write contract calls
- `contracts/GenLayerEvidenceResolutionAgent.py` for web fetch, prompt execution, and validator-reviewed non-deterministic resolution

### Demo path C: local verification

Run:

```bash
npm run genlayer:check
npm run contract:check
npm run typecheck
npm run build
python -m pytest tests/direct -v
```

## Step-By-Step Usage

### Connect a wallet

Use a wallet compatible with the GenLayer flow. For local development, MetaMask Flask is the easiest route.

Reference:

- https://github.com/genlayerlabs/genlayer-wallet

### Deploy a contract

1. Start the app
2. Connect wallet
3. Choose a network such as `studionet` or `localnet`
4. Click `Deploy Contract`
5. Save the returned contract address

### Import an existing contract

1. Paste the contract address into the Contract Panel
2. Refresh contract state
3. Review the loaded cases from chain

### Submit a case

1. Fill title, claim, and criteria
2. Add one to three evidence URLs
3. Click `Submit On-Chain`
4. Wait for transaction acceptance

### Resolve a case

1. Open the chain case list
2. Select a submitted case
3. Click the resolve action
4. Wait for GenLayer to accept the transaction
5. Review verdict, rationale, confidence, and citations

## Testing

### Direct tests

Run:

```bash
python -m pytest tests/direct -v
```

Coverage currently includes:

- case creation
- resolution persistence
- validator disagreement path
- citation filtering

### Studio Mode integration scaffold

Integration file:

```text
tests/integration/test_studio_claim_roundtrip.py
```

Run:

```bash
set RUN_STUDIO_TESTS=1
python -m pytest tests/integration -v -m studio
```

Prerequisites:

- GenLayer Studio or Localnet is running
- `gltest.config.yaml` is present
- Python environment includes `genlayer-test`
- `RUN_STUDIO_TESTS=1` is set

## CI

Workflow:

```text
.github/workflows/ci.yml
```

Current CI covers:

- `npm run genlayer:check`
- `npm run contract:check`
- `npm run typecheck`
- `python -m pytest tests/direct -v`

## Deployment

This project is Vercel-friendly because the main write path is browser-wallet initiated.

Deploy:

```bash
npx vercel --prod
```

No backend signer is required for the core MVP flow.

## Why Reviewers Should Care

This repo demonstrates:

- a real GenLayer use case centered on adjudication
- live web evidence fetched inside the contract
- meaningful non-deterministic reasoning reviewed through GenLayer consensus
- a complete builder flow from deploy to submit to resolve
- direct contract reads and writes through a real GenLayer client path
- test coverage and CI rather than a mock-only prototype

## Current Scope

This is an MVP and does not yet include:

- appeal flow
- counter-evidence flow
- multi-role dispute handling
- trust-weighted evidence domains
- fully automated Studio-to-testnet end-to-end coverage

## Recommended Next Iterations

- add appeal and counter-evidence support
- add role-based claimant/respondent structure
- add evidence weighting or domain trust scoring
- add richer Studio integration coverage
- add better receipt and timeline inspection in the UI

## References

- [GenLayer Docs](https://docs.genlayer.com/)
- [GenLayerJS](https://docs.genlayer.com/api-references/genlayer-js)
- [GenLayer Testing Suite](https://docs.genlayer.com/api-references/genlayer-test)
- [GenLayer Wallet](https://github.com/genlayerlabs/genlayer-wallet)
- [GenVM Linter](https://github.com/genlayerlabs/genvm-linter)
- [GenLayer Studio](https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-studio)

## Submission Positioning

### Short version

GenLayer Evidence Resolution Agent is a GenLayer-native adjudication app where an intelligent contract fetches live evidence, produces a structured verdict through validator-reviewed non-deterministic reasoning, and writes the accepted result back on-chain.

### Builder version

This project shows a complete GenLayer product loop: a user can deploy an intelligent contract, submit an evidence-backed claim, have the contract fetch live public sources and resolve the case through GenLayer consensus, then read the accepted verdict back from chain in the frontend.
