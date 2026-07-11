export type GenLayerNetworkKey = "studionet" | "testnetBradbury" | "localnet";

export type ClaimVerdict = "SUPPORTED" | "REFUTED" | "INCONCLUSIVE";
export type ClaimStatus = "DRAFT" | "SUBMITTED" | "RESOLVED";

export type ClaimResolution = {
  verdict: ClaimVerdict;
  confidence: number;
  rationale: string;
  citations: string[];
  resolver?: string;
  resolvedAt?: number;
};

export type ClaimCase = {
  id: number;
  title: string;
  claim: string;
  criteria: string;
  category: string;
  evidenceUrls: string[];
  status: ClaimStatus;
  createdAt: number;
  submitter?: string;
  resolution?: ClaimResolution | null;
  source: "local" | "chain";
  submitTxHash?: string;
  resolveTxHash?: string;
};

export type ClaimDraft = {
  title: string;
  claim: string;
  criteria: string;
  category: string;
  evidenceUrls: string[];
};

export type ActivityTone = "info" | "good" | "bad";

export type AgentActivity = {
  id: string;
  message: string;
  tone: ActivityTone;
  timestamp: number;
  txHash?: string;
};
