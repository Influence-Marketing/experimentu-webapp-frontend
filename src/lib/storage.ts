import type { Entry, FlowState, Participant } from "./types";

const ENTRIES_KEY = "u-score-entries-v1";
const FLOW_KEY = "u-score-flow-v1";

const emptyParticipant = (): Participant => ({
  firstName: "",
  email: "",
  age: null,
  fearWord: "",
  phase: "baseline",
  marketingOptIn: false,
  dataConsent: false,
});

export const emptyFlow = (): FlowState => ({
  participant: emptyParticipant(),
  inputs: {},
  upgrades: {},
  currentEntryId: null,
  submissions: {},
  authToken: null,
  participantId: null,
  retestToken: null,
  resumePath: null,
});

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadEntries(): Entry[] {
  return readJson<Entry[]>(ENTRIES_KEY, []);
}

export function saveEntries(entries: Entry[]) {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  return entries;
}

export function addEntry(entry: Entry) {
  const next = loadEntries();
  next.push(entry);
  return saveEntries(next);
}

export function updateEntry(id: string, patch: Partial<Entry>) {
  const next = loadEntries().map((e) => (e.id === id ? { ...e, ...patch } : e));
  return saveEntries(next);
}

export function deleteEntry(id: string) {
  return saveEntries(loadEntries().filter((e) => e.id !== id));
}

export function findEntry(id: string) {
  return loadEntries().find((e) => e.id === id) ?? null;
}

export function latestBaseline(email: string) {
  if (!email) return null;
  return (
    loadEntries()
      .filter((e) => e.phase === "baseline" && e.participant.email.toLowerCase() === email.toLowerCase())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
  );
}

/** The most recent session (either phase) completed on this device with this email. */
export function latestEntryFor(email: string) {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  return (
    loadEntries()
      .filter((e) => e.participant.email.trim().toLowerCase() === key)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
  );
}

export function newId() {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadFlow(): FlowState {
  // Flows saved by older builds lack newer keys (e.g. submissions); fill them from the defaults.
  const empty = emptyFlow();
  const stored = readJson<Partial<FlowState>>(FLOW_KEY, empty);
  return { ...empty, ...stored, participant: { ...empty.participant, ...stored.participant } };
}

export function saveFlow(flow: FlowState) {
  localStorage.setItem(FLOW_KEY, JSON.stringify(flow));
  return flow;
}

export function resetFlow() {
  const next = emptyFlow();
  saveFlow(next);
  return next;
}

/** Kiosk reset: forget the flow and the local report history, so the next guest sees nothing of the last. */
export function wipeDevice() {
  try {
    localStorage.removeItem(FLOW_KEY);
    localStorage.removeItem(ENTRIES_KEY);
  } catch {
    // ignore
  }
}

export function intakeComplete(p: Participant) {
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim());
  return (
    p.firstName.trim().length > 0 &&
    emailOk &&
    Number.isFinite(p.age) &&
    (p.age ?? 0) >= 18 &&
    (p.age ?? 0) <= 105 &&
    p.fearWord.trim().length > 0 &&
    p.dataConsent === true
  );
}
