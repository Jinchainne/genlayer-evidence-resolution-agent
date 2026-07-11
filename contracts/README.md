# Contracts

This folder contains the GenLayer Intelligent Contract used by the MVP.

- `GenLayerEvidenceResolutionAgent.py`

What it does:

- stores claim-review cases
- fetches live web evidence from supplied URLs
- resolves cases through GenLayer's non-deterministic consensus path
- stores verdict, confidence, rationale, and citations on-chain

This is intentionally a GenLayer-native Python contract, not an EVM helper contract.
