"use client";

// Shared state for the dashboard, backed by the engine API.
// FLOW: mount -> load from api -> render -> operator acts -> api write -> reload
// 1. there is no sample data anywhere; an unreachable API means empty lists and honest zeros
// 2. isLive tells the UI whether the engine answered, so it can say so plainly
// 3. no component calls fetch directly; everything goes through lib/api

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  type ApiChange,
  type ApiConversation,
  type ApiPolicy,
  type ApiStaff,
  type ApiStats,
  type ApiThread,
  type ApiUsage,
} from "./api";
import type { Policy, StructuredRecord, UnansweredQuestion } from "./domain";

export interface NewPolicyInput {
  text: string;
  labels: string[];
  sensitive: boolean;
  /** Where this came from. A parent can check it. */
  reference: string;
  /** Operator commentary. Never shown to a parent. */
  notes: string;
  /** Staff id who handles this. Required when sensitive is true. */
  ownerId: string | null;
  sourceQuestionId: string | null;
}

interface AppStateValue {
  policies: Policy[];
  unanswered: UnansweredQuestion[];
  conversations: ApiConversation[];
  threads: ApiThread[];
  structured: StructuredRecord[];
  stats: ApiStats | null;
  usage: ApiUsage | null;
  staff: ApiStaff[];
  /** The center's own name, from the engine. Null until it answers. */
  centerName: string | null;
  waitingCount: number;
  isLive: boolean;
  modelName: string | null;
  addPolicy: (input: NewPolicyInput) => Promise<void>;
  editPolicy: (
    id: string,
    input: { text: string; labels: string[]; sensitive: boolean; reference: string; notes: string },
  ) => Promise<void>;
  /** Changes waiting on a person. Nothing here is live yet. */
  changes: ApiChange[];
  approveChange: (id: string) => Promise<void>;
  rejectChange: (id: string) => Promise<void>;
  archivePolicy: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

/** Turn an engine policy into the shape the UI already renders. */
function toUiPolicy(entry: ApiPolicy): Policy {
  return {
    id: entry.id,
    version: entry.version,
    text: entry.text,
    labels: entry.labels,
    sensitive: entry.sensitive,
    owner: entry.ownerId,
    reference: entry.reference,
    notes: entry.notes,
    citeAs: entry.citeAs,
    approvedBy: entry.approvedBy,
    approvedOn: new Date(entry.approvedAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [unanswered, setUnanswered] = useState<UnansweredQuestion[]>([]);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [threads, setThreads] = useState<ApiThread[]>([]);
  const [structured, setStructured] = useState<StructuredRecord[]>([]);
  const [changes, setChanges] = useState<ApiChange[]>([]);
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [staff, setStaff] = useState<ApiStaff[]>([]);
  const [centerName, setCenterName] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const health = await api.health();
    if (health === null) {
      setIsLive(false);
      return;
    }

    setIsLive(true);
    setModelName(health.model);

    const [livePolicies, liveConversations, liveStats, liveCenter, liveUsage, liveChanges] =
      await Promise.all([
        api.policies(),
        api.conversations(),
        api.stats(),
        api.center(),
        api.usage(),
        api.changes(),
      ]);

    // Merge usage in, so a card can say how often it has actually answered a parent.
    const usageById = new Map((liveUsage?.policies ?? []).map((u) => [u.policyId, u]));
    setPolicies(
      livePolicies.policies.map((entry) => {
        const used = usageById.get(entry.id);
        return {
          ...toUiPolicy(entry),
          timesUsed: used?.timesUsed ?? 0,
          lastUsedAt: used?.lastUsedAt ?? null,
        };
      }),
    );
    setConversations(liveConversations.conversations);
    setThreads(liveConversations.threads);
    setStructured(livePolicies.structured);
    setChanges(liveChanges);
    setStats(liveStats);
    setUsage(liveUsage);
    setStaff(liveCenter?.staff ?? []);
    setCenterName(liveCenter?.name ?? null);

    if (liveStats !== null) {
      setUnanswered(
        liveStats.unanswered.map((item, index) => ({
          id: `u-${index}`,
          question: item.question,
          timesAsked: item.timesAsked,
        })),
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addPolicy = useCallback(async (input: NewPolicyInput): Promise<void> => {
    const created = await api.addPolicy({
      text: input.text,
      labels: input.labels,
      sensitive: input.sensitive,
      reference: input.reference,
      notes: input.notes,
      ownerId: input.ownerId,
    });

    // No offline fallback: if the engine did not accept it, nothing appears.
    if (created !== null) {
      setPolicies((current) => [{ ...toUiPolicy(created), isNew: true }, ...current]);
    }

    if (input.sourceQuestionId !== null) {
      setUnanswered((current) => current.filter((item) => item.id !== input.sourceQuestionId));
    }
  }, []);

  const editPolicy = useCallback(
    async (
      id: string,
      input: {
        text: string;
        labels: string[];
        sensitive: boolean;
        reference: string;
        notes: string;
      },
    ): Promise<void> => {
      await api.editPolicy(id, input);
      // The version moves on the engine, so refresh rather than guessing it here: a stale
      // citeAs in the UI would point at wording that is no longer approved.
      await refresh();
    },
    [refresh],
  );

  const approveChange = useCallback(
    async (id: string): Promise<void> => {
      await api.approveChange(id);
      await refresh();
    },
    [refresh],
  );

  const rejectChange = useCallback(
    async (id: string): Promise<void> => {
      await api.rejectChange(id);
      await refresh();
    },
    [refresh],
  );

  const archivePolicy = useCallback(async (id: string): Promise<void> => {
    await api.archivePolicy(id);
    setPolicies((current) => current.filter((p) => p.id !== id));
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      policies,
      unanswered,
      conversations,
      threads,
      structured,
      changes,
      stats,
      usage,
      staff,
      centerName,
      isLive,
      modelName,
      waitingCount: stats?.awaitingApproval ?? 0,
      addPolicy,
      editPolicy,
      archivePolicy,
      approveChange,
      rejectChange,
      refresh,
    }),
    [
      policies,
      unanswered,
      conversations,
      threads,
      structured,
      changes,
      stats,
      usage,
      staff,
      centerName,
      isLive,
      modelName,
      addPolicy,
      editPolicy,
      archivePolicy,
      approveChange,
      rejectChange,
      refresh,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return context;
}
