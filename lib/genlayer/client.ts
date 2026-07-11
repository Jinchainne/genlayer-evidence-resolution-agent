import { createClient } from "genlayer-js";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";

import { GENLAYER_CONTRACT_SOURCE } from "@/lib/genlayer/contractSource";
import { DEFAULT_GENLAYER_NETWORK, GENLAYER_NETWORKS } from "@/lib/genlayer/networks";
import type { ClaimCase, GenLayerNetworkKey } from "@/lib/genlayer/types";

export function getReadClient(networkKey: GenLayerNetworkKey = DEFAULT_GENLAYER_NETWORK) {
  return createClient({
    chain: GENLAYER_NETWORKS[networkKey].chain
  });
}

export function getWriteClient(networkKey: GenLayerNetworkKey, account: `0x${string}`, provider: unknown) {
  return createClient({
    chain: GENLAYER_NETWORKS[networkKey].chain,
    account,
    provider: provider as never
  });
}

export async function ensureWalletNetwork(
  networkKey: GenLayerNetworkKey,
  account: `0x${string}`,
  provider: unknown
) {
  const client = getWriteClient(networkKey, account, provider);
  await client.connect(networkKey);
  return client;
}

export async function deployEvidenceContract(
  networkKey: GenLayerNetworkKey,
  account: `0x${string}`,
  provider: unknown
) {
  const walletClient = await ensureWalletNetwork(networkKey, account, provider);
  const hash = await walletClient.deployContract({
    code: GENLAYER_CONTRACT_SOURCE,
    args: []
  });
  const receipt = await walletClient.waitForTransactionReceipt({
    hash: hash as `0x${string}` & { length: 66 },
    status: TransactionStatus.ACCEPTED
  });

  const contractAddress =
    receipt.txDataDecoded && "contractAddress" in receipt.txDataDecoded
      ? (receipt.txDataDecoded.contractAddress as string | undefined)
      : undefined;

  if (!contractAddress) {
    throw new Error("Contract deployment receipt did not include a contract address.");
  }

  return {
    hash,
    contractAddress
  };
}

export async function submitClaimCase(
  networkKey: GenLayerNetworkKey,
  account: `0x${string}`,
  provider: unknown,
  contractAddress: `0x${string}`,
  draft: ClaimCase
) {
  const walletClient = await ensureWalletNetwork(networkKey, account, provider);
  const hash = await walletClient.writeContract({
    address: contractAddress,
    functionName: "create_case",
    args: [draft.title, draft.claim, JSON.stringify(draft.evidenceUrls), draft.criteria, draft.category],
    value: BigInt(0)
  });

  const receipt = await walletClient.waitForTransactionReceipt({
    hash: hash as `0x${string}` & { length: 66 },
    status: TransactionStatus.ACCEPTED
  });

  if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
    throw new Error("Claim submission was accepted by consensus but contract execution failed.");
  }

  return hash;
}

export async function resolveClaimCase(
  networkKey: GenLayerNetworkKey,
  account: `0x${string}`,
  provider: unknown,
  contractAddress: `0x${string}`,
  caseId: number
) {
  const walletClient = await ensureWalletNetwork(networkKey, account, provider);
  const hash = await walletClient.writeContract({
    address: contractAddress,
    functionName: "resolve_case",
    args: [caseId],
    value: BigInt(0)
  });

  const receipt = await walletClient.waitForTransactionReceipt({
    hash: hash as `0x${string}` & { length: 66 },
    status: TransactionStatus.ACCEPTED,
    retries: 120,
    interval: 4000
  });

  if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
    throw new Error("Resolution reached consensus but contract execution failed.");
  }

  return hash;
}

function normalizeCaseRecord(raw: Record<string, unknown>): ClaimCase {
  const toTimestamp = (value: unknown) => {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? Date.now() : parsed;
    }
    return Date.now();
  };

  const resolution = raw.resolution as Record<string, unknown> | null | undefined;
  return {
    id: Number(raw.id ?? 0),
    title: String(raw.title ?? ""),
    claim: String(raw.claim ?? ""),
    criteria: String(raw.criteria ?? ""),
    category: String(raw.category ?? ""),
    evidenceUrls: Array.isArray(raw.evidence_urls)
      ? raw.evidence_urls.map((entry) => String(entry))
      : [],
    status: String(raw.status ?? "SUBMITTED") as ClaimCase["status"],
    createdAt: toTimestamp(raw.created_at),
    submitter: raw.submitter ? String(raw.submitter) : undefined,
    source: "chain",
    resolution: resolution
      ? {
          verdict: String(resolution.verdict ?? "INCONCLUSIVE") as "SUPPORTED" | "REFUTED" | "INCONCLUSIVE",
          confidence: Number(resolution.confidence ?? 0),
          rationale: String(resolution.rationale ?? ""),
          citations: Array.isArray(resolution.citations)
            ? resolution.citations.map((entry) => String(entry))
            : [],
          resolver: resolution.resolver ? String(resolution.resolver) : undefined,
          resolvedAt: resolution.resolved_at ? toTimestamp(resolution.resolved_at) : undefined
        }
      : null
  };
}

export async function fetchClaimCases(networkKey: GenLayerNetworkKey, contractAddress: `0x${string}`) {
  const client = getReadClient(networkKey);
  const rawCount = await client.readContract({
    address: contractAddress,
    functionName: "get_case_count",
    args: []
  });
  const count = Number(rawCount ?? 0);

  if (!count) {
    return [] as ClaimCase[];
  }

  const rawPage = await client.readContract({
    address: contractAddress,
    functionName: "get_cases_page",
    args: [1, Math.min(count + 2, 24)]
  });
  const parsed = typeof rawPage === "string" ? (JSON.parse(rawPage) as Array<Record<string, unknown>>) : [];
  return parsed.map(normalizeCaseRecord).sort((a, b) => b.id - a.id);
}
