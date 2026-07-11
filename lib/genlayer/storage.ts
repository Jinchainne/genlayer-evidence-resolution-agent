import type { AgentActivity, ClaimCase, ClaimDraft, GenLayerNetworkKey } from "@/lib/genlayer/types";

const DRAFTS_KEY = "genlayer.claimDrafts";
const ACTIVITY_KEY = "genlayer.activity";
const NETWORK_KEY = "genlayer.network";
const CONTRACT_KEY = "genlayer.contractAddress";

export function loadDrafts(): ClaimCase[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as ClaimCase[]) : [];
  } catch {
    return [];
  }
}

export function saveDrafts(drafts: ClaimCase[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export function loadActivity(): AgentActivity[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY);
    return raw ? (JSON.parse(raw) as AgentActivity[]) : [];
  } catch {
    return [];
  }
}

export function saveActivity(rows: AgentActivity[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(rows));
}

export function loadNetwork(): GenLayerNetworkKey | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(NETWORK_KEY) as GenLayerNetworkKey | null;
}

export function saveNetwork(value: GenLayerNetworkKey) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(NETWORK_KEY, value);
}

export function loadContractAddress() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(CONTRACT_KEY) ?? "";
}

export function saveContractAddress(value: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (value) {
    window.localStorage.setItem(CONTRACT_KEY, value);
  } else {
    window.localStorage.removeItem(CONTRACT_KEY);
  }
}

export function draftFromTemplate(template: ClaimDraft): ClaimCase {
  return {
    id: Date.now(),
    title: template.title,
    claim: template.claim,
    criteria: template.criteria,
    category: template.category,
    evidenceUrls: [...template.evidenceUrls],
    status: "DRAFT",
    createdAt: Date.now(),
    source: "local"
  };
}
