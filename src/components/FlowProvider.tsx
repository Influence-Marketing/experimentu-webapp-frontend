"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { scoringConfig } from "@/lib/scoring-config";
import { computeResult } from "@/lib/scoring";
import {
  addEntry,
  emptyFlow,
  findEntry,
  latestBaseline,
  loadFlow,
  newId,
  resetFlow as resetStoredFlow,
  saveFlow,
} from "@/lib/storage";
import type { DomainId, DomainInputState, Entry, FlowState, Participant } from "@/lib/types";

type FlowContextValue = {
  ready: boolean;
  flow: FlowState;
  setParticipant: (patch: Partial<Participant> | Participant) => void;
  setDomainInputs: (id: DomainId, inputs: DomainInputState) => void;
  setUpgrade: (key: string, value: number | null) => void;
  completeProtocols: () => Entry;
  currentEntry: Entry | null;
  setCurrentEntryId: (id: string | null) => void;
  reset: () => void;
};

const FlowContext = createContext<FlowContextValue | null>(null);

export function FlowProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [flow, setFlow] = useState<FlowState>(emptyFlow);

  useEffect(() => {
    setFlow(loadFlow());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveFlow(flow);
  }, [flow, ready]);

  const setParticipant = useCallback((patch: Partial<Participant> | Participant) => {
    setFlow((prev) => ({
      ...prev,
      participant: { ...prev.participant, ...patch },
    }));
  }, []);

  const setDomainInputs = useCallback((id: DomainId, inputs: DomainInputState) => {
    setFlow((prev) => ({
      ...prev,
      inputs: { ...prev.inputs, [id]: inputs },
    }));
  }, []);

  const setUpgrade = useCallback((key: string, value: number | null) => {
    setFlow((prev) => ({
      ...prev,
      upgrades: { ...prev.upgrades, [key]: value },
    }));
  }, []);

  const completeProtocols = useCallback(() => {
    const result = computeResult(flow.participant, flow.inputs);
    const baseline =
      flow.participant.phase === "week8" ? latestBaseline(flow.participant.email) : null;
    const created: Entry = {
      id: newId(),
      createdAt: new Date().toISOString(),
      phase: flow.participant.phase,
      configVersion: scoringConfig.version,
      participant: { ...flow.participant },
      inputs: flow.inputs,
      upgrades: flow.upgrades,
      result,
      baselineId: baseline ? baseline.id : null,
      baselineTotal: baseline ? baseline.result.total : null,
    };
    addEntry(created);
    const next = { ...flow, currentEntryId: created.id };
    saveFlow(next);
    setFlow(next);
    return created;
  }, [flow]);

  const setCurrentEntryId = useCallback((id: string | null) => {
    setFlow((prev) => ({ ...prev, currentEntryId: id }));
  }, []);

  const reset = useCallback(() => {
    setFlow(resetStoredFlow());
  }, []);

  const currentEntry = useMemo(() => {
    if (!flow.currentEntryId) return null;
    return findEntry(flow.currentEntryId);
  }, [flow.currentEntryId, ready, flow]);

  const value = useMemo(
    () => ({
      ready,
      flow,
      setParticipant,
      setDomainInputs,
      setUpgrade,
      completeProtocols,
      currentEntry,
      setCurrentEntryId,
      reset,
    }),
    [
      ready,
      flow,
      setParticipant,
      setDomainInputs,
      setUpgrade,
      completeProtocols,
      currentEntry,
      setCurrentEntryId,
      reset,
    ],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow must be used inside FlowProvider");
  return ctx;
}
