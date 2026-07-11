import { localnet, studionet, testnetBradbury } from "genlayer-js/chains";

import type { GenLayerNetworkKey } from "@/lib/genlayer/types";

export const GENLAYER_NETWORKS = {
  studionet: {
    key: "studionet",
    label: "Studionet",
    rpc: "https://studio.genlayer.com/api",
    chainId: 61999,
    currency: "GEN",
    explorer: "https://explorer-studio.genlayer.com",
    chain: studionet
  },
  testnetBradbury: {
    key: "testnetBradbury",
    label: "Bradbury",
    rpc: "https://rpc-bradbury.genlayer.com",
    chainId: 4221,
    currency: "GEN",
    explorer: "https://explorer-bradbury.genlayer.com",
    chain: testnetBradbury
  },
  localnet: {
    key: "localnet",
    label: "Localnet",
    rpc: "http://localhost:4000/api",
    chainId: 61127,
    currency: "GEN",
    explorer: "http://localhost:8080",
    chain: localnet
  }
} as const;

export const DEFAULT_GENLAYER_NETWORK: GenLayerNetworkKey = "studionet";

export const SAMPLE_CASE_TEMPLATES = [
  {
    title: "Exchange listing rumor",
    category: "Market Integrity",
    claim: "A major exchange has officially listed token XYZ for spot trading.",
    criteria: "SUPPORTED only if the listing is explicitly confirmed by the exchange or two high-trust primary sources.",
    evidenceUrls: ["https://www.reuters.com/", "https://www.coindesk.com/"]
  },
  {
    title: "Protocol exploit allegation",
    category: "Security Review",
    claim: "Protocol ABC suffered a live exploit affecting user funds today.",
    criteria: "REFUTED if evidence shows only a false alarm or test incident. INCONCLUSIVE if evidence conflicts.",
    evidenceUrls: ["https://www.theblock.co/", "https://github.com/"]
  },
  {
    title: "Governance proposal passed",
    category: "Governance",
    claim: "A governance proposal to raise staking yield has passed on-chain.",
    criteria: "SUPPORTED only if evidence includes the governance result or official governance communication.",
    evidenceUrls: ["https://snapshot.box/", "https://forum.arbitrum.foundation/"]
  }
] as const;
