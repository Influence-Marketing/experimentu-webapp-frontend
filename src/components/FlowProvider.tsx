"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LEAD_FORM } from "@/lib/api/statamic";
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
  updateEntry,
} from "@/lib/storage";
import type { Domain, DomainId, DomainInputState, Entry, FlowState, Participant } from "@/lib/types";
import { useContent } from "./ContentProvider";

type FlowContextValue = {
  ready: boolean;
  flow: FlowState;
  setParticipant: (patch: Partial<Participant> | Participant) => void;
  setDomainInputs: (id: DomainId, inputs: DomainInputState) => void;
  setUpgrade: (key: string, value: number | null) => void;
  /** Records a successful form POST; a lead submission also replaces the bearer token and participant id. */
  markSubmitted: (
    formHandle: string,
    key: string,
    lead?: { token: string | null; participantId: number | null },
  ) => void;
  /** Forgets a token the server rejected, so the next intake submit fetches a new one. */
  clearAuthToken: () => void;
  completeProtocols: () => Entry;
  currentEntry: Entry | null;
  setCurrentEntryId: (id: string | null) => void;
  reset: () => void;
  /** True while a return visit is being sent back to the step it left off on. */
  resuming: boolean;
};

const FlowContext = createContext<FlowContextValue | null>(null);

// Step pages a session can be resumed on. /score and /report are older paths a saved flow may
// still hold; both now redirect to /result and /report/{token}.
const isStepPath = (path: string) =>
  path.startsWith("/protocol/") ||
  path === "/result" ||
  path.startsWith("/report/") ||
  path === "/score" ||
  path === "/report";

/** A session is in progress from its intake until every protocol has been submitted after it. */
function inProgress(flow: FlowState, domains: Domain[]) {
  const lead = flow.submissions[LEAD_FORM];
  return lead != null && domains.some((d) => (flow.submissions[d.form.handle]?.submittedAt ?? "") <= lead.submittedAt);
}

export function FlowProvider({ children }: { children: React.ReactNode }) {
  const { config } = useContent();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [flow, setFlow] = useState<FlowState>(emptyFlow);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    const saved = loadFlow();
    setFlow(saved);
    // Opening the site at "/" mid-session goes back to the step it left off on. Only the page this
    // load opened on counts, so going back to the intake from Protocol I still works.
    if (pathname === "/" && saved.resumePath && isStepPath(saved.resumePath) && inProgress(saved, config.domains)) {
      setResuming(true);
    }
    setReady(true);
    // Runs once, on the page the site was opened on.
  }, []);

  useEffect(() => {
    if (ready) saveFlow(flow);
  }, [flow, ready]);

  useEffect(() => {
    if (!resuming) return;
    if (pathname === "/" && flow.resumePath) router.replace(flow.resumePath);
    else setResuming(false);
  }, [resuming, pathname, flow.resumePath, router]);

  // Remember the step page the guest is on while the session is in progress.
  const active = ready && inProgress(flow, config.domains);
  useEffect(() => {
    if (!active || !isStepPath(pathname)) return;
    setFlow((prev) => (prev.resumePath === pathname ? prev : { ...prev, resumePath: pathname }));
  }, [active, pathname]);

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

  const markSubmitted = useCallback(
    (formHandle: string, key: string, lead?: { token: string | null; participantId: number | null }) => {
      setFlow((prev) => ({
        ...prev,
        submissions: { ...prev.submissions, [formHandle]: { key, submittedAt: new Date().toISOString() } },
        authToken: lead ? lead.token : prev.authToken,
        participantId: lead ? lead.participantId : prev.participantId,
        // A new intake gets its own entry rather than updating the last session's, and starts
        // remembering its steps afresh.
        currentEntryId: lead ? null : prev.currentEntryId,
        resumePath: lead ? null : prev.resumePath,
      }));
    },
    [],
  );

  const clearAuthToken = useCallback(() => {
    setFlow((prev) => ({ ...prev, authToken: null }));
  }, []);

  const completeProtocols = useCallback(() => {
    const result = computeResult(flow.participant, flow.inputs, config);
    const baseline =
      flow.participant.phase === "week8" ? latestBaseline(flow.participant.email) : null;
    // Scoring again in the same session (e.g. /score after two protocols, then after all five)
    // updates that session's entry instead of adding another.
    const existing = flow.currentEntryId ? findEntry(flow.currentEntryId) : null;
    const own =
      existing && existing.participantId === flow.participantId && existing.phase === flow.participant.phase
        ? existing
        : null;
    const created: Entry = {
      id: own?.id ?? newId(),
      createdAt: own?.createdAt ?? new Date().toISOString(),
      phase: flow.participant.phase,
      configVersion: config.version,
      participant: { ...flow.participant },
      inputs: flow.inputs,
      upgrades: flow.upgrades,
      result,
      baselineId: baseline ? baseline.id : null,
      baselineTotal: baseline ? baseline.result.total : null,
      participantId: flow.participantId,
      scoreSource: "local",
    };
    if (own) updateEntry(own.id, created);
    else addEntry(created);
    // Functional update: the last protocol's submission is recorded just before this runs.
    setFlow((prev) => saveFlow({ ...prev, currentEntryId: created.id }));
    return created;
  }, [flow, config]);

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
      markSubmitted,
      clearAuthToken,
      completeProtocols,
      currentEntry,
      setCurrentEntryId,
      reset,
      resuming,
    }),
    [
      ready,
      flow,
      setParticipant,
      setDomainInputs,
      setUpgrade,
      markSubmitted,
      clearAuthToken,
      completeProtocols,
      currentEntry,
      setCurrentEntryId,
      reset,
      resuming,
    ],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow must be used inside FlowProvider");
  return ctx;
}
