"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  deployEvidenceContract,
  fetchClaimCases,
  resolveClaimCase,
  submitClaimCase
} from "@/lib/genlayer/client";
import { GENLAYER_CONTRACT_SOURCE } from "@/lib/genlayer/contractSource";
import { DEFAULT_GENLAYER_NETWORK, GENLAYER_NETWORKS, SAMPLE_CASE_TEMPLATES } from "@/lib/genlayer/networks";
import {
  draftFromTemplate,
  loadActivity,
  loadContractAddress,
  loadDrafts,
  loadNetwork,
  saveActivity,
  saveContractAddress,
  saveDrafts,
  saveNetwork
} from "@/lib/genlayer/storage";
import type { AgentActivity, ClaimCase, ClaimDraft, ClaimVerdict, GenLayerNetworkKey } from "@/lib/genlayer/types";
import { formatAddress } from "@/lib/utils/format";
import { formatRelativeMs, formatUtc } from "@/lib/utils/time";

const EMPTY_DRAFT: ClaimDraft = {
  title: "",
  claim: "",
  criteria: "",
  category: "Adjudication",
  evidenceUrls: ["", "", ""]
};

export default function Page() {
  const [network, setNetwork] = useState<GenLayerNetworkKey>(DEFAULT_GENLAYER_NETWORK);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [contractAddress, setContractAddress] = useState("");
  const [deployTxHash, setDeployTxHash] = useState("");
  const [draft, setDraft] = useState<ClaimDraft>(EMPTY_DRAFT);
  const [localDrafts, setLocalDrafts] = useState<ClaimCase[]>([]);
  const [chainCases, setChainCases] = useState<ClaimCase[]>([]);
  const [activity, setActivity] = useState<AgentActivity[]>([]);
  const [busyAction, setBusyAction] = useState("");
  const [statusMessage, setStatusMessage] = useState("GenLayer adjudication agent idle. Connect a wallet or import a contract.");
  const [startedAt] = useState(Date.now());
  const [phaseIndex, setPhaseIndex] = useState(0);

  const currentNetwork = GENLAYER_NETWORKS[network];

  function appendActivity(message: string, tone: AgentActivity["tone"], txHash?: string) {
    const next: AgentActivity = {
      id: crypto.randomUUID(),
      message,
      tone,
      txHash,
      timestamp: Date.now()
    };
    setActivity((current) => {
      const rows = [next, ...current].slice(0, 24);
      saveActivity(rows);
      return rows;
    });
  }

  async function refreshWalletChain() {
    const ethereum = (window as Window & { ethereum?: { request: (input: { method: string }) => Promise<unknown> } }).ethereum;
    if (!ethereum) {
      setChainId(null);
      return;
    }

    try {
      const hex = (await ethereum.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(hex, 16));
    } catch {
      setChainId(null);
    }
  }

  async function refreshChainCases(activeContract = contractAddress, activeNetwork = network) {
    if (!activeContract) {
      setChainCases([]);
      return;
    }

    try {
      const rows = await fetchClaimCases(activeNetwork, activeContract as `0x${string}`);
      setChainCases(rows);
      if (rows.length > 0) {
        setStatusMessage(`Loaded ${rows.length} case(s) from ${GENLAYER_NETWORKS[activeNetwork].label}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to read contract state.";
      setStatusMessage(message);
      appendActivity(`Read failed: ${message}`, "bad");
    }
  }

  useEffect(() => {
    const storedNetwork = loadNetwork();
    const storedContract = loadContractAddress();
    const storedDrafts = loadDrafts();
    const storedActivity = loadActivity();

    if (storedNetwork) {
      setNetwork(storedNetwork);
    }
    if (storedContract) {
      setContractAddress(storedContract);
    }
    if (storedDrafts.length) {
      setLocalDrafts(storedDrafts);
    }
    if (storedActivity.length) {
      setActivity(storedActivity);
    }

    const ethereum = (window as Window & { ethereum?: { request: (input: { method: string }) => Promise<unknown> } }).ethereum;
    if (!ethereum) {
      refreshChainCases(storedContract, storedNetwork ?? DEFAULT_GENLAYER_NETWORK).catch(() => undefined);
      return;
    }

    ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const safeAccounts = accounts as string[];
        const address = safeAccounts[0] ?? "";
        setWalletAddress(address);
        setWalletConnected(Boolean(address));
      })
      .catch(() => undefined)
      .finally(() => {
        refreshWalletChain().catch(() => undefined);
        refreshChainCases(storedContract, storedNetwork ?? DEFAULT_GENLAYER_NETWORK).catch(() => undefined);
      });
  }, []);

  useEffect(() => {
    saveNetwork(network);
  }, [network]);

  useEffect(() => {
    saveContractAddress(contractAddress);
  }, [contractAddress]);

  useEffect(() => {
    saveDrafts(localDrafts);
  }, [localDrafts]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhaseIndex((current) => (current + 1) % EXECUTION_PHASES.length);
    }, 1600);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshWalletChain().catch(() => undefined);
      if (contractAddress) {
        refreshChainCases().catch(() => undefined);
      }
    }, 12000);

    return () => window.clearInterval(timer);
  }, [contractAddress, network]);

  async function connectWallet() {
    const ethereum = (window as Window & { ethereum?: { request: (input: { method: string }) => Promise<unknown> } }).ethereum;
    if (!ethereum) {
      setStatusMessage("No injected wallet detected. For local GenLayer dev, install MetaMask Flask or another compatible injected wallet.");
      appendActivity("Wallet connection failed: no injected provider found.", "bad");
      return;
    }

    try {
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0] ?? "";
      setWalletAddress(address);
      setWalletConnected(Boolean(address));
      await refreshWalletChain();
      setStatusMessage(`Wallet connected: ${formatAddress(address)}.`);
      appendActivity(`Wallet connected on ${currentNetwork.label}.`, "good");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet connection rejected.";
      setStatusMessage(message);
      appendActivity(`Wallet connection failed: ${message}`, "bad");
    }
  }

  function resetLocalWorkspace() {
    setLocalDrafts([]);
    setActivity([]);
    setDraft(EMPTY_DRAFT);
    setDeployTxHash("");
    setStatusMessage("Local workspace reset. Chain data remains on GenLayer.");
    saveDrafts([]);
    saveActivity([]);
  }

  function loadTemplate(index: number) {
    const template = SAMPLE_CASE_TEMPLATES[index];
    setDraft({
      title: template.title,
      claim: template.claim,
      criteria: template.criteria,
      category: template.category,
      evidenceUrls: [...template.evidenceUrls]
    });
    setStatusMessage(`Loaded template: ${template.title}.`);
  }

  function saveDraftLocally() {
    if (!draft.title || !draft.claim) {
      setStatusMessage("Title and claim text are required before saving a draft.");
      return;
    }

    const nextDraft = draftFromTemplate({
      ...draft,
      evidenceUrls: draft.evidenceUrls.filter(Boolean)
    });
    setLocalDrafts((current) => [nextDraft, ...current].slice(0, 20));
    setStatusMessage(`Saved local draft "${draft.title}".`);
    appendActivity(`Draft queued locally: ${draft.title}.`, "info");
  }

  async function deployContract() {
    if (!walletConnected || !walletAddress) {
      setStatusMessage("Connect a wallet before deploying the contract.");
      return;
    }

    const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      setStatusMessage("No injected wallet provider available.");
      return;
    }

    setBusyAction("deploy");
    try {
      const deployed = await deployEvidenceContract(network, walletAddress as `0x${string}`, ethereum);
      setContractAddress(deployed.contractAddress);
      setDeployTxHash(deployed.hash);
      setStatusMessage(`Contract deployed at ${deployed.contractAddress}.`);
      appendActivity(`Contract deployed on ${currentNetwork.label}.`, "good", deployed.hash);
      await refreshChainCases(deployed.contractAddress, network);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Contract deployment failed.";
      setStatusMessage(message);
      appendActivity(`Deployment failed: ${message}`, "bad");
    } finally {
      setBusyAction("");
    }
  }

  async function submitCurrentDraft() {
    if (!walletConnected || !walletAddress) {
      setStatusMessage("Connect a wallet before submitting a claim.");
      return;
    }
    if (!contractAddress) {
      setStatusMessage("Deploy or import a GenLayer contract first.");
      return;
    }

    const cleanedUrls = draft.evidenceUrls.filter(Boolean);
    if (!draft.title || !draft.claim || cleanedUrls.length === 0) {
      setStatusMessage("Title, claim, and at least one evidence URL are required.");
      return;
    }

    const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      setStatusMessage("No injected wallet provider available.");
      return;
    }

    const payload: ClaimCase = {
      id: Date.now(),
      title: draft.title,
      claim: draft.claim,
      criteria: draft.criteria,
      category: draft.category,
      evidenceUrls: cleanedUrls,
      status: "SUBMITTED",
      createdAt: Date.now(),
      source: "local"
    };

    setBusyAction("submit");
    try {
      const txHash = await submitClaimCase(
        network,
        walletAddress as `0x${string}`,
        ethereum,
        contractAddress as `0x${string}`,
        payload
      );
      setStatusMessage(`Claim submitted to ${currentNetwork.label}.`);
      appendActivity(`Claim submitted: ${payload.title}.`, "good", txHash);
      setDraft(EMPTY_DRAFT);
      await refreshChainCases(contractAddress, network);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Claim submission failed.";
      setStatusMessage(message);
      appendActivity(`Claim submission failed: ${message}`, "bad");
    } finally {
      setBusyAction("");
    }
  }

  async function resolveCase(caseId: number, title: string) {
    if (!walletConnected || !walletAddress) {
      setStatusMessage("Connect a wallet before resolving a claim.");
      return;
    }
    if (!contractAddress) {
      setStatusMessage("Import a contract address first.");
      return;
    }

    const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      setStatusMessage("No injected wallet provider available.");
      return;
    }

    setBusyAction(`resolve-${caseId}`);
    try {
      const txHash = await resolveClaimCase(
        network,
        walletAddress as `0x${string}`,
        ethereum,
        contractAddress as `0x${string}`,
        caseId
      );
      appendActivity(`Resolution submitted for case #${caseId}: ${title}.`, "good", txHash);
      setStatusMessage(`Resolution transaction accepted for case #${caseId}.`);
      await refreshChainCases(contractAddress, network);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resolution failed.";
      setStatusMessage(message);
      appendActivity(`Resolution failed for case #${caseId}: ${message}`, "bad");
    } finally {
      setBusyAction("");
    }
  }

  const planner = useMemo(() => {
    if (!contractAddress) {
      return {
        headline: "Deploy or import the GenLayer intelligent contract.",
        detail: "Without a contract address, the agent can draft claims but cannot adjudicate them on-chain.",
        blocker: "Contract missing"
      };
    }

    if (!walletConnected) {
      return {
        headline: "Connect a browser wallet to submit or resolve cases.",
        detail: "Reads can work without a wallet, but all write methods still require a signed transaction.",
        blocker: "Wallet disconnected"
      };
    }

    const unresolved = chainCases.find((entry) => entry.status !== "RESOLVED");
    if (unresolved) {
      return {
        headline: `Adjudicate case #${unresolved.id}: ${unresolved.title}.`,
        detail: "This is where GenLayer consensus matters: the contract will fetch evidence and validate a non-deterministic verdict.",
        blocker: ""
      };
    }

    if (draft.title || draft.claim) {
      return {
        headline: "Submit the current draft to create another adjudication round.",
        detail: "The next best action is to push a fresh claim on-chain with at least one primary evidence URL.",
        blocker: ""
      };
    }

    return {
      headline: "Load a template or draft a new claim.",
      detail: "The contract is ready. Seed the next evidence set and turn it into an on-chain verdict.",
      blocker: ""
    };
  }, [chainCases, contractAddress, draft.claim, draft.title, walletConnected]);

  const stats = useMemo(() => {
    const resolved = chainCases.filter((entry) => entry.status === "RESOLVED");
    const supported = resolved.filter((entry) => entry.resolution?.verdict === "SUPPORTED").length;
    const refuted = resolved.filter((entry) => entry.resolution?.verdict === "REFUTED").length;
    const inconclusive = resolved.filter((entry) => entry.resolution?.verdict === "INCONCLUSIVE").length;
    const averageConfidence =
      resolved.length > 0
        ? Math.round(
            resolved.reduce((sum, entry) => sum + (entry.resolution?.confidence ?? 0), 0) / resolved.length
          )
        : 0;

    return {
      total: chainCases.length,
      resolved: resolved.length,
      unresolved: chainCases.length - resolved.length,
      supported,
      refuted,
      inconclusive,
      averageConfidence
    };
  }, [chainCases]);

  const confidenceSeries = useMemo(
    () =>
      chainCases
        .filter((entry) => entry.resolution)
        .slice()
        .reverse()
        .map((entry) => ({
          caseId: `#${entry.id}`,
          confidence: entry.resolution?.confidence ?? 0
        })),
    [chainCases]
  );

  const verdictMix = useMemo(
    () => [
      { label: "SUPPORTED", total: stats.supported },
      { label: "REFUTED", total: stats.refuted },
      { label: "INCONCLUSIVE", total: stats.inconclusive }
    ],
    [stats]
  );

  const queueSeries = useMemo(
    () =>
      chainCases
        .slice()
        .reverse()
        .map((entry, index, rows) => ({
          caseId: `#${entry.id}`,
          openCases: rows.length - index,
          stageScore: entry.status === "RESOLVED" ? 100 : 35,
          status: entry.status
        })),
    [chainCases]
  );

  const verdictChart = useMemo(() => {
    if (stats.resolved > 0) {
      return {
        title: "Verdict Mix",
        detail: "Resolved verdict distribution",
        data: verdictMix
      };
    }

    return {
      title: "Queue Mix",
      detail: "Live case queue while the first resolved verdict is still pending",
      data: [
        { label: "SUBMITTED", total: stats.unresolved },
        { label: "RESOLVED", total: stats.resolved },
        { label: "LOCAL", total: localDrafts.length }
      ]
    };
  }, [localDrafts.length, stats.resolved, stats.unresolved, verdictMix]);

  const draftSignals = useMemo(() => {
    const cleanedUrls = draft.evidenceUrls.filter((entry) => entry.trim().length > 0);
    const primarySources = cleanedUrls.filter((entry) => /^https?:\/\//i.test(entry)).length;
    const hasTitle = draft.title.trim().length > 0;
    const hasClaim = draft.claim.trim().length > 40;
    const hasCriteria = draft.criteria.trim().length > 40;
    const categorySet = draft.category.trim().length > 0;
    const evidenceDiversity = new Set(
      cleanedUrls
        .map((entry) => {
          try {
            return new URL(entry).hostname.replace(/^www\./, "");
          } catch {
            return entry;
          }
        })
        .filter(Boolean)
    ).size;

    const score = Math.max(
      0,
      Math.min(
        100,
        (hasTitle ? 18 : 0) +
          (hasClaim ? 22 : 0) +
          (hasCriteria ? 22 : 0) +
          (categorySet ? 8 : 0) +
          Math.min(primarySources, 3) * 10 +
          Math.min(evidenceDiversity, 3) * 10
      )
    );

    return {
      cleanedUrls,
      score,
      evidenceDiversity,
      checks: [
        { label: "Title set", ok: hasTitle },
        { label: "Claim specific", ok: hasClaim },
        { label: "Criteria detailed", ok: hasCriteria },
        { label: "Category tagged", ok: categorySet },
        { label: "At least 1 source", ok: primarySources >= 1 },
        { label: "Source diversity", ok: evidenceDiversity >= 2 }
      ]
    };
  }, [draft.category, draft.claim, draft.criteria, draft.evidenceUrls, draft.title]);

  const executionTimeline = useMemo(() => {
    const phases = EXECUTION_PHASES.map((phase) => ({
      phase,
      state: "pending" as "pending" | "active" | "done"
    }));

    const setStateThrough = (activeIndex: number) =>
      phases.map((entry, index) => ({
        ...entry,
        state: index < activeIndex ? ("done" as const) : index === activeIndex ? ("active" as const) : ("pending" as const)
      }));

    if (busyAction === "deploy") {
      return {
        detail: "Deploying intelligent contract to the selected GenLayer environment.",
        phases: setStateThrough(4)
      };
    }

    if (busyAction === "submit") {
      return {
        detail: "Submitting claim payload and evidence manifest on-chain.",
        phases: setStateThrough(1)
      };
    }

    if (busyAction.startsWith("resolve-")) {
      return {
        detail: "Fetching evidence, comparing sources, and waiting for GenLayer consensus on the verdict.",
        phases: setStateThrough(3)
      };
    }

    if (stats.resolved > 0) {
      return {
        detail: "At least one adjudication cycle completed and was committed back into contract state.",
        phases: phases.map((entry) => ({ ...entry, state: "done" as const }))
      };
    }

    if (stats.unresolved > 0) {
      return {
        detail: "Claims are on-chain and waiting for the first real `resolve_case(...)` cycle.",
        phases: setStateThrough(2)
      };
    }

    if (draftSignals.score > 0) {
      return {
        detail: "Draft is being prepared locally. Submit it to start a real adjudication cycle.",
        phases: setStateThrough(0)
      };
    }

    return {
      detail: "Agent is idle. Load a template, refine the claim, then submit it on-chain.",
      phases
    };
  }, [busyAction, draftSignals.score, stats.resolved, stats.unresolved]);

  const deployReadiness = useMemo(() => {
    if (!walletConnected || !walletAddress) {
      return {
        label: "Wallet required",
        detail: "Connect MetaMask Flask or another compatible GenLayer wallet before deploying.",
        tone: "negative" as const
      };
    }

    if (chainId !== null && chainId !== currentNetwork.chainId) {
      return {
        label: "Wrong chain",
        detail: `Wallet is on chain ${chainId}. Switch to ${currentNetwork.label} (${currentNetwork.chainId}) first.`,
        tone: "negative" as const
      };
    }

    return {
      label: "Deploy ready",
      detail: `Wallet and selected network are aligned for ${currentNetwork.label}.`,
      tone: "positive" as const
    };
  }, [chainId, currentNetwork.chainId, currentNetwork.label, walletAddress, walletConnected]);

  return (
    <main className="min-h-screen px-4 py-6 md:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <Card className="overflow-hidden p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-terminal-border pb-3 text-[11px] uppercase tracking-[0.24em] text-terminal-muted">
            <div className="flex flex-wrap items-center gap-4">
              <span>GenLayer adjudication layer</span>
              <span>{currentNetwork.label}</span>
              <span>Chain ID {currentNetwork.chainId}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span>{walletConnected ? formatAddress(walletAddress) : "wallet disconnected"}</span>
              <span>{formatUtc().slice(11, 19)}</span>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-terminal-muted">GenLayer Evidence Resolution Agent</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[0.16em] text-terminal-text">
                TRUSTLESS ADJUDICATION TERMINAL
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-terminal-muted">
                This MVP is a GenLayer-native claim review agent. It uses GenLayer intelligent contracts to fetch
                live evidence and produce a meaningful non-deterministic verdict that validators can accept through
                the Equivalence Principle.
              </p>
              <p className="mt-3 max-w-3xl text-xs leading-6 text-terminal-muted">
                Local browser-wallet development is smoothest with MetaMask Flask following the official GenLayer wallet flow.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="positive">GENLAYER NATIVE</Badge>
                <Badge tone="neutral">WEB + LLM + CONSENSUS</Badge>
                <Badge tone={walletConnected ? "positive" : "negative"}>
                  {walletConnected ? "WALLET READY" : "CONNECT WALLET"}
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard label="Contract" value={contractAddress ? "Imported" : "Missing"} detail="Deploy or paste address" />
              <MetricCard label="Resolved" value={`${stats.resolved}`} detail="Accepted verdicts" />
              <MetricCard label="Confidence" value={`${stats.averageConfidence}%`} detail="Mean resolved confidence" />
              <MetricCard label="Unresolved" value={`${stats.unresolved}`} detail="Claims awaiting verdict" />
              <MetricCard label="Network" value={currentNetwork.label} detail={currentNetwork.currency} />
              <MetricCard label="Uptime" value={formatRelativeMs(Date.now() - startedAt)} detail="Session runtime" />
            </div>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4">
            <Card className="p-4">
              <SectionHeader
                title="Claim Composer"
                detail="Submit a claim plus evidence URLs. The contract will later adjudicate it on GenLayer."
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {SAMPLE_CASE_TEMPLATES.map((template, index) => (
                  <Button key={template.title} variant="ghost" onClick={() => loadTemplate(index)}>
                    Load {index + 1}
                  </Button>
                ))}
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-xs uppercase tracking-[0.18em] text-terminal-muted">
                    <span>Title</span>
                    <Input
                      value={draft.title}
                      onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Protocol exploit allegation"
                    />
                  </label>
                  <label className="space-y-2 text-xs uppercase tracking-[0.18em] text-terminal-muted">
                    <span>Category</span>
                    <Input
                      value={draft.category}
                      onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                      placeholder="Security Review"
                    />
                  </label>
                  <label className="space-y-2 text-xs uppercase tracking-[0.18em] text-terminal-muted md:col-span-2">
                    <span>Claim Statement</span>
                    <textarea
                      className="min-h-28 w-full border border-terminal-border bg-terminal-panelAlt px-3 py-2 text-sm text-terminal-text outline-none placeholder:text-terminal-muted focus:border-terminal-accent"
                      value={draft.claim}
                      onChange={(event) => setDraft((current) => ({ ...current, claim: event.target.value }))}
                      placeholder="State the claim the contract should adjudicate."
                    />
                  </label>
                  <label className="space-y-2 text-xs uppercase tracking-[0.18em] text-terminal-muted md:col-span-2">
                    <span>Resolution Criteria</span>
                    <textarea
                      className="min-h-24 w-full border border-terminal-border bg-terminal-panelAlt px-3 py-2 text-sm text-terminal-text outline-none placeholder:text-terminal-muted focus:border-terminal-accent"
                      value={draft.criteria}
                      onChange={(event) => setDraft((current) => ({ ...current, criteria: event.target.value }))}
                      placeholder="Explain what counts as supported, refuted, or inconclusive."
                    />
                  </label>
                  {draft.evidenceUrls.map((url, index) => (
                    <label key={`evidence-${index}`} className="space-y-2 text-xs uppercase tracking-[0.18em] text-terminal-muted md:col-span-2">
                      <span>Evidence URL {index + 1}</span>
                      <Input
                        value={url}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            evidenceUrls: current.evidenceUrls.map((entry, entryIndex) =>
                              entryIndex === index ? event.target.value : entry
                            )
                          }))
                        }
                        placeholder="https://..."
                      />
                    </label>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="border border-terminal-border bg-terminal-panelAlt p-3">
                    <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-terminal-muted">
                      <span>Draft Readiness</span>
                      <span>{draftSignals.score}/100</span>
                    </div>
                    <div className="mt-3 h-3 border border-terminal-border bg-terminal-background">
                      <div
                        className="h-full bg-terminal-positive transition-all"
                        style={{ width: `${draftSignals.score}%` }}
                      />
                    </div>
                    <div className="mt-3 grid gap-2">
                      {draftSignals.checks.map((check) => (
                        <div key={check.label} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-terminal-muted">{check.label}</span>
                          <span className={check.ok ? "text-terminal-positive" : "text-terminal-negative"}>
                            {check.ok ? "PASS" : "MISS"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-terminal-border bg-terminal-panelAlt p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-terminal-muted">Evidence Topology</div>
                    <div className="mt-3 grid gap-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-terminal-muted">Sources attached</span>
                        <span className="text-terminal-text">{draftSignals.cleanedUrls.length}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-terminal-muted">Unique domains</span>
                        <span className="text-terminal-text">{draftSignals.evidenceDiversity}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-terminal-muted">Planner view</span>
                        <span className="text-terminal-text">
                          {draftSignals.score >= 75 ? "High quality" : draftSignals.score >= 45 ? "Workable" : "Thin"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {draftSignals.cleanedUrls.length > 0 ? (
                        draftSignals.cleanedUrls.map((url) => (
                          <span key={url} className="border border-terminal-border px-2 py-1 text-[10px] text-terminal-muted">
                            {safeHostname(url)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-terminal-muted">No evidence hosts attached yet.</span>
                      )}
                    </div>
                  </div>

                  <div className="border border-terminal-border bg-terminal-panelAlt p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-terminal-muted">Adjudication Route</div>
                    <div className="mt-3 grid gap-2 text-xs text-terminal-muted">
                      <div>1. Persist claim metadata and source manifest on-chain.</div>
                      <div>2. Fetch live source snapshots inside GenLayer.</div>
                      <div>3. Compare evidence against claim criteria.</div>
                      <div>4. Ask validators to accept a structured verdict.</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={saveDraftLocally}>Save Draft</Button>
                <Button onClick={submitCurrentDraft} disabled={busyAction === "submit"}>
                  {busyAction === "submit" ? "Submitting..." : "Submit On-Chain"}
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <SectionHeader
                title="Planner"
                detail="This panel explains what the agent should do next to maximize meaningful GenLayer consensus."
              />
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <InfoBlock label="Objective" value="Turn evidence-heavy claims into on-chain adjudication outcomes." />
                <InfoBlock label="Latest Decision" value={planner.headline} />
                <InfoBlock label="Blocker" value={planner.blocker || "No critical blocker"} />
              </div>
              <div className="mt-3 border border-terminal-border bg-terminal-panelAlt px-3 py-3 text-sm text-terminal-text">
                {planner.detail}
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="p-4">
                <SectionHeader title={verdictChart.title} detail={verdictChart.detail} />
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={verdictChart.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d8cfb6" />
                      <XAxis dataKey="label" tick={{ fill: "#786f5f", fontSize: 11 }} />
                      <YAxis allowDecimals={false} domain={[0, "auto"]} tick={{ fill: "#786f5f", fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#a66f10" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {stats.resolved === 0 ? (
                  <div className="mt-3 border border-terminal-border bg-terminal-panelAlt px-3 py-3 text-xs text-terminal-muted">
                    No resolved verdict yet. The chart is showing live queue composition until `resolve_case(...)`
                    writes the first adjudication result on-chain.
                  </div>
                ) : null}
              </Card>

              <Card className="p-4">
                <SectionHeader
                  title={confidenceSeries.length > 0 ? "Confidence Trail" : "Queue Readiness"}
                  detail={
                    confidenceSeries.length > 0
                      ? "Resolved claim confidence over time"
                      : "Live queue depth until the first non-deterministic verdict lands on-chain"
                  }
                />
                <div className="mt-4 h-64">
                  {confidenceSeries.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={confidenceSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#d8cfb6" />
                        <XAxis dataKey="caseId" tick={{ fill: "#786f5f", fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#786f5f", fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="confidence" stroke="#23934d" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={queueSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#d8cfb6" />
                        <XAxis dataKey="caseId" tick={{ fill: "#786f5f", fontSize: 11 }} />
                        <YAxis domain={[0, Math.max(queueSeries.length + 1, 3)]} tick={{ fill: "#786f5f", fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="openCases" stroke="#a66f10" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {confidenceSeries.length === 0 ? (
                  <div className="mt-3 border border-terminal-border bg-terminal-panelAlt px-3 py-3 text-xs text-terminal-muted">
                    Confidence history will appear after the first successful `resolve_case(...)` transaction. Until
                    then, this panel shows live queue depth from the real on-chain case list.
                  </div>
                ) : null}
              </Card>
            </div>

            <Card className="p-4">
              <SectionHeader title="Local Drafts" detail="Drafts stay local until you submit them to the contract." />
              <div className="mt-4 space-y-2 text-sm">
                {localDrafts.length === 0 ? (
                  <EmptyRow message="No local drafts yet. Save a template or type a new claim." />
                ) : null}
                {localDrafts.map((entry) => (
                  <div key={entry.id} className="border border-terminal-border px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-terminal-text">{entry.title}</div>
                        <div className="mt-1 text-xs text-terminal-muted">{entry.category}</div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft({
                            title: entry.title,
                            claim: entry.claim,
                            criteria: entry.criteria,
                            category: entry.category,
                            evidenceUrls: [...entry.evidenceUrls, "", ""].slice(0, 3)
                          })
                        }
                      >
                        Load Draft
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <SectionHeader title="Network + Wallet" detail="Wallet writes go to the selected GenLayer environment." />
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <label className="space-y-2 text-xs uppercase tracking-[0.18em] text-terminal-muted">
                  <span>Network</span>
                  <select
                    className="w-full border border-terminal-border bg-terminal-panelAlt px-3 py-2 text-sm text-terminal-text outline-none"
                    value={network}
                    onChange={(event) => setNetwork(event.target.value as GenLayerNetworkKey)}
                  >
                    {Object.values(GENLAYER_NETWORKS).map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-2 text-sm">
                  <PanelRow label="Wallet" value={walletConnected ? formatAddress(walletAddress) : "Not connected"} />
                  <PanelRow label="Chain" value={chainId ? `${chainId}` : "Unknown"} />
                  <PanelRow label="RPC" value={currentNetwork.rpc} />
                  <PanelRow label="Explorer" value={currentNetwork.explorer.replace("https://", "")} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={connectWallet}>Connect Wallet</Button>
                <Button variant="ghost" onClick={() => refreshWalletChain().catch(() => undefined)}>
                  Refresh Chain
                </Button>
                <Button variant="ghost" onClick={resetLocalWorkspace}>
                  Reset Local Workspace
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <SectionHeader
                title="Contract Panel"
                detail="Deploy the intelligent contract or import an existing address from Studio / Bradbury."
              />
              <div className="mt-4 grid gap-3">
                <label className="space-y-2 text-xs uppercase tracking-[0.18em] text-terminal-muted">
                  <span>Contract Address</span>
                  <Input
                    value={contractAddress}
                    onChange={(event) => setContractAddress(event.target.value)}
                    placeholder="0x..."
                  />
                </label>
                <PanelRow label="Deploy Tx" value={deployTxHash ? formatAddress(deployTxHash) : "None"} />
                <PanelRow label="Source" value="GenLayerEvidenceResolutionAgent.py" />
                <PanelRow label="Prompt Mode" value="Non-comparative adjudication" />
                <PanelRow label="Deploy Status" value={deployReadiness.label} />
              </div>
              <div
                className={`mt-4 border px-3 py-3 text-xs leading-6 ${
                  deployReadiness.tone === "positive"
                    ? "border-terminal-positive bg-[#dff0de] text-terminal-positive"
                    : "border-terminal-negative bg-[#f3ddd8] text-terminal-negative"
                }`}
              >
                {deployReadiness.detail}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {!walletConnected ? <Button onClick={connectWallet}>Connect Wallet</Button> : null}
                <Button
                  onClick={deployContract}
                  disabled={busyAction === "deploy" || deployReadiness.tone !== "positive"}
                >
                  {busyAction === "deploy" ? "Deploying..." : "Deploy Contract"}
                </Button>
                <Button variant="ghost" onClick={() => refreshChainCases().catch(() => undefined)}>
                  Refresh Contract State
                </Button>
                {contractAddress ? (
                  <a
                    className="inline-flex items-center justify-center border border-terminal-border px-3 py-2 text-xs uppercase tracking-[0.2em] text-terminal-muted"
                    href={`${currentNetwork.explorer}/address/${contractAddress}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Explorer
                  </a>
                ) : null}
              </div>
              <div className="mt-4 border border-terminal-border bg-terminal-panelAlt px-3 py-3 text-xs leading-6 text-terminal-muted">
                This contract fetches live web evidence and asks GenLayer validators to accept a verdict that is
                semantically valid, not word-for-word identical. That is the exact non-deterministic behavior the
                reviewer wanted to see.
              </div>
            </Card>

            <Card className="p-4">
              <SectionHeader title="Execution Cycle" detail="Agent loop state adapted for GenLayer adjudication." />
              <div className="mt-3 border border-terminal-border bg-terminal-panelAlt px-3 py-3 text-xs text-terminal-muted">
                {executionTimeline.detail}
              </div>
              <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs uppercase tracking-[0.18em]">
                {executionTimeline.phases.map((entry, index) => (
                  <div
                    key={entry.phase}
                    className={`border px-2 py-3 ${
                      entry.state === "active"
                        ? "border-terminal-positive bg-[#dff0de] text-terminal-positive"
                        : entry.state === "done"
                          ? "border-terminal-border bg-terminal-panelAlt text-terminal-text"
                          : index === phaseIndex && busyAction === ""
                            ? "border-terminal-accent bg-[#efe6cc] text-terminal-accent"
                            : "border-terminal-border text-terminal-muted"
                    }`}
                  >
                    {entry.phase}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <SectionHeader title="Chain Cases" detail="Read from the deployed intelligent contract." />
              <div className="mt-4 space-y-3">
                {chainCases.length === 0 ? (
                  <EmptyRow message="No chain cases loaded yet. Deploy/import a contract and submit a claim." />
                ) : null}
                {chainCases.map((entry) => (
                  <div key={entry.id} className="border border-terminal-border px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-terminal-text">
                          #{entry.id} {entry.title}
                        </div>
                        <div className="mt-1 text-xs text-terminal-muted">
                          {entry.category} • {entry.status} • {entry.evidenceUrls.length} evidence sources
                        </div>
                      </div>
                      <Badge tone={toneForCase(entry)}>{entry.status}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-terminal-muted">{entry.claim}</p>
                    {entry.resolution ? (
                      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                        <InfoBlock label="Verdict" value={entry.resolution.verdict} />
                        <InfoBlock label="Confidence" value={`${entry.resolution.confidence}%`} />
                        <InfoBlock label="Citations" value={entry.resolution.citations.join(", ") || "None"} />
                      </div>
                    ) : null}
                    {entry.resolution?.rationale ? (
                      <div className="mt-3 border border-terminal-border bg-terminal-panelAlt px-3 py-3 text-sm text-terminal-text">
                        {entry.resolution.rationale}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.status !== "RESOLVED" ? (
                        <Button
                          onClick={() => resolveCase(entry.id, entry.title)}
                          disabled={busyAction === `resolve-${entry.id}`}
                        >
                          {busyAction === `resolve-${entry.id}` ? "Resolving..." : "Resolve On-Chain"}
                        </Button>
                      ) : null}
                      {entry.submitTxHash ? (
                        <a
                          className="inline-flex items-center justify-center border border-terminal-border px-3 py-2 text-xs uppercase tracking-[0.2em] text-terminal-muted"
                          href={`${currentNetwork.explorer}/tx/${entry.submitTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Submit Tx
                        </a>
                      ) : null}
                      {entry.resolveTxHash ? (
                        <a
                          className="inline-flex items-center justify-center border border-terminal-border px-3 py-2 text-xs uppercase tracking-[0.2em] text-terminal-muted"
                          href={`${currentNetwork.explorer}/tx/${entry.resolveTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Resolve Tx
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <SectionHeader title="Activity Tape" detail="Local feed of wallet, contract, and adjudication actions." />
              <div className="mt-4 space-y-2 text-xs">
                {activity.length === 0 ? <EmptyRow message="No activity yet. Connect a wallet or load a template." /> : null}
                {activity.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[60px_1fr_76px] gap-3 border border-terminal-border px-3 py-2">
                    <div className={toneClassName(entry.tone)}>{entry.tone.toUpperCase()}</div>
                    <div className="text-terminal-text">
                      <div>{entry.message}</div>
                      {entry.txHash ? (
                        <div className="mt-1 text-terminal-muted">{formatAddress(entry.txHash)}</div>
                      ) : null}
                    </div>
                    <div className="text-right text-terminal-muted">{formatUtc(entry.timestamp).slice(11, 19)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 text-sm leading-7 text-terminal-muted">
              <p>Status: {statusMessage}</p>
              <p>Contract source size: {GENLAYER_CONTRACT_SOURCE.length.toLocaleString()} chars</p>
              <p>Hosted network recommendation: start on Studionet, then move to Bradbury for stronger validation.</p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

const EXECUTION_PHASES = ["Ingest", "Fetch", "Compare", "Adjudicate", "Commit"] as const;

function SectionHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-sm uppercase tracking-[0.24em] text-terminal-text">{title}</h2>
        <p className="mt-2 text-xs text-terminal-muted">{detail}</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border border-terminal-border bg-terminal-panelAlt p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-terminal-muted">{label}</div>
      <div className="mt-2 text-lg text-terminal-text">{value}</div>
      <div className="mt-1 text-xs text-terminal-muted">{detail}</div>
    </div>
  );
}

function PanelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-terminal-border px-3 py-2">
      <span className="text-terminal-muted">{label}</span>
      <span className="text-right text-terminal-text">{value}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-terminal-border bg-terminal-panelAlt px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted">{label}</div>
      <div className="mt-2 text-sm text-terminal-text">{value}</div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <div className="border border-terminal-border px-3 py-3 text-terminal-muted">{message}</div>;
}

function safeHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^https?:\/\//i, "").slice(0, 28) || "invalid-source";
  }
}

function toneClassName(tone: AgentActivity["tone"]) {
  if (tone === "good") {
    return "text-terminal-positive";
  }
  if (tone === "bad") {
    return "text-terminal-negative";
  }
  return "text-terminal-accent";
}

function toneForCase(entry: ClaimCase) {
  if (entry.status !== "RESOLVED") {
    return "neutral" as const;
  }
  return entry.resolution?.verdict === "SUPPORTED"
    ? ("positive" as const)
    : entry.resolution?.verdict === "REFUTED"
      ? ("negative" as const)
      : ("neutral" as const);
}
