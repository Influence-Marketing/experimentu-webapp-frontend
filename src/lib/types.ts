import type { ApiScoringConfig } from "./api/statamic";

export type Phase = "baseline" | "week8";
export type DomainId = "nervous" | "movement" | "metabolism" | "evidence" | "mindset";
/** "F" women's ranges, "M" men's ranges. Required: HRV, sit-to-stand, grip and body fat cannot be scored without it (client, 17 November). */
export type Sex = "F" | "M";
export type MeasureUnit = "in" | "cm";

export type LabelText = { label: string; opt?: string };

/** What a protocol field holds: a number, a choice key, a toggle, or nothing yet. */
export type FieldValue = number | string | boolean | null;

/** One protocol's answers, keyed by the Statamic form field handle they are submitted under. */
export type DomainInputState = Record<string, FieldValue>;

export type FieldOption = { key: string; label: string };

export type UnitRange = { min: number; max: number; placeholder: string };

export type FieldSpec = {
  /** The blueprint field handle; also the key in DomainInputState and the payload. */
  handle: string;
  kind: "number" | "choice" | "select" | "toggle" | "scale" | "units";
  label: string;
  opt?: string;
  hint?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** choice / select / scale / units */
  options?: FieldOption[];
  /** scale: the captions under the first and last option */
  scaleLabels?: [string, string];
  /** select: the option shown while nothing applies */
  blankLabel?: string;
  width?: "half" | "third" | "quarter";
  /** number: ranges and unit that follow the protocol's units field */
  byUnit?: Record<MeasureUnit, UnitRange>;
  /** Shown only when this returns true (e.g. a reading behind its toggle). */
  showIf?: (inputs: DomainInputState) => boolean;
};

export type FieldGroup = { title?: string; note?: string; fields: FieldSpec[] };

export type DerivedReadout = {
  /** The blueprint handle the readout is submitted under, when the form stores it. */
  handle?: string;
  label: string;
  placeholder: string;
  hint?: string;
  compute: (inputs: DomainInputState) => string | null;
};

export type Protocol = {
  id: DomainId;
  numeral: string;
  order: number;
  name: string;
  /** The measured test(s), as the step's heading. */
  metric: string;
  shortMetric: string;
  color: string;
  tagline: string;
  stepTitle: string;
  howTo: string[];
  form: { handle: string };
  groups: FieldGroup[];
  derived?: DerivedReadout[];
  /** The handle of this protocol's "not scored because" select, if it has one. */
  notScored?: string;
  /** Enough is entered to submit: mirrors the backend's required_without rules. */
  complete: (inputs: DomainInputState) => boolean;
  /** Values the app fills in itself on submit (implied toggles, readouts). */
  derivePayload?: (inputs: DomainInputState) => DomainInputState;
};

export type ProtocolsConfig = {
  /** The scoring design these screens capture for; the backend's config version is shown from the API. */
  version: string;
  protocols: Protocol[];
};

// ---- The score, as GET api/participants/{id}/score presents it (scoring schema 2) ----

export type ComponentScore = {
  key: string | null;
  measure: string;
  value: string;
  band: string | null;
  label: string;
  points: number | null;
  max: number;
  flag: boolean;
  note: string;
  questionnaire: boolean;
  /** The short report line for a questionnaire item. */
  line: string | null;
};

export type AreaScore = {
  key: DomainId;
  numeral: string;
  name: string;
  heading: string;
  points: number | null;
  max: number;
  notScored: string | null;
  paragraph: string | null;
  /** Lines that show with a flag in this area (snoring, weight loss, the wellbeing check-in). */
  notes: string[];
  components: ComponentScore[];
  /** Points change since the baseline on a Week-8 result; null when either side was not scored. */
  delta: number | null;
};

export type Flag = {
  id: string;
  domain: DomainId;
  severity: string;
  eyebrow: string;
  title: string;
  message: string;
  critical: boolean;
  /** The guest-facing line for the flag, when it has one; otherwise the card shows the message. */
  paragraph: string | null;
};

export type Recorded = {
  key: string;
  label: string;
  value: string;
  standing: string;
  note: string;
  paragraph: string | null;
};

export type CohortTier = {
  name: string;
  min: number;
  max: number | null;
  range: string | null;
  meaning: string | null;
  current: boolean;
};

export type Membership = {
  mode: string | null;
  eyebrow: string | null;
  headline: string | null;
  body: string | null;
  bullets: string[];
  button: string | null;
  url: string | null;
  priceNote: string | null;
};

export type ScoreResult = {
  total: number;
  outOf: number;
  /** The total word (Unfolding … Unstoppable); null when an area was not scored. */
  word: string | null;
  overall: string | null;
  /** Shown in place of the total word when an area was not scored. */
  totalNotScored: string | null;
  /** The retest line, under the overall line. */
  retest: string | null;
  scoreLabel: string | null;
  resultEyebrow: string | null;
  cohortDetail: { name: string; range: string | null; tagline: string | null; body: string | null } | null;
  cohortScale: CohortTier[];
  areas: AreaScore[];
  flags: Flag[];
  flagsFraming: string | null;
  recorded: Recorded[];
  membership: Membership;
  disclaimer: string | null;
  configVersion: string;
  /** Change in the total since baseline; null when the two totals are out of different numbers. */
  deltaTotal: number | null;
  baselineTotal: number | null;
  baselineOutOf: number | null;
};

export type Participant = {
  firstName: string;
  email: string;
  age: number | null;
  sex: Sex | null;
  fearWord: string;
  phase: Phase;
  marketingOptIn: boolean;
  dataConsent: boolean;
};

export type Entry = {
  id: string;
  createdAt: string;
  phase: Phase;
  configVersion: string;
  participant: Participant;
  inputs: Record<string, DomainInputState>;
  /** The scoring API's result for this session; null until it has been fetched. */
  result: ScoreResult | null;
  baselineId: string | null;
  baselineTotal: number | null;
  /** Participant id from the lead submission, for GET api/participants/{id}/score. */
  participantId?: number | null;
  scoreSource?: "api" | "pending";
};

export type FlowState = {
  participant: Participant;
  inputs: Record<string, DomainInputState>;
  currentEntryId: string | null;
  /** Successful form POSTs by Statamic form handle; `key` is the payload that was sent. */
  submissions: Record<string, { key: string; submittedAt: string }>;
  /** Bearer token from the lead submission, sent with each protocol submission. */
  authToken: string | null;
  /** Participant id from the lead submission. */
  participantId: number | null;
  /** The signed retest link's token, held from /retest until the Week-8 lead is accepted. */
  retestToken: string | null;
  /** The last step page (protocol, score or report) visited this session, reopened on return. */
  resumePath: string | null;
};

export type LeadTextField = LabelText & {
  placeholder: string;
  maxLength?: number;
  note?: string;
};

export type LeadConsentField = {
  text: string;
  required: boolean;
};

export type LeadFormContent = {
  session: { label: string; baselineLabel: string; week8Label: string };
  firstName: LeadTextField;
  email: LeadTextField;
  age: LeadTextField;
  sex: { label: string; options: { key: Sex; label: string }[]; note: string };
  fearWord: LeadTextField;
  marketingOptIn: LeadConsentField;
  dataConsent: LeadConsentField;
};

/** CMS copy for one protocol, merged over the static definition on the client (it must be serialisable). */
export type ProtocolCopy = {
  numeral?: string;
  order?: number;
  name?: string;
  metric?: string;
  tagline?: string;
  stepTitle?: string;
  howTo?: string[];
  formHandle?: string;
  /** Per field handle: label wording and option wording by option key. */
  fields?: Record<string, { label?: string; opt?: string; hint?: string; options?: Record<string, string> }>;
};

/** What the server loads and hands to the client: copy only, never the rules. */
export type SiteContent = {
  /** The scoring design the static protocol definitions capture for. */
  version: string;
  protocolCopy: Partial<Record<DomainId, ProtocolCopy>>;
  leadForm: LeadFormContent;
  source: "cms" | "static";
  /** The backend's scoring config (version, display copy); null when it couldn't be fetched. */
  scoring: ApiScoringConfig | null;
};

/** What components read: the static protocols with the CMS copy applied. */
export type ResolvedContent = SiteContent & { config: ProtocolsConfig };
