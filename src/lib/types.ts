export type Phase = "baseline" | "week8";
export type DomainId =
  | "nervous"
  | "movement"
  | "metabolism"
  | "evidence"
  | "recovery";
export type InputType =
  | "readings"
  | "number"
  | "waist-height"
  | "bp-readings"
  | "who5";
export type MeasureUnit = "in" | "cm";

export type LabelText = { label: string; opt?: string };

export type Band = {
  max: number | null;
  points: number;
  label: string;
  comparison: string;
  flag?: string;
};

export type AgeThreshold = {
  min: number;
  points: number;
  label: string;
  comparison: string;
};

export type AgeBand = {
  ageMin: number;
  ageMax: number | null;
  label: string;
  thresholds: AgeThreshold[];
};

export type BpCategory = {
  id: string;
  label: string;
  reading: string;
  points: number;
  systolicMin: number | null;
  diastolicMin: number | null;
  flag?: string;
  comparison: string;
};

export type Who5ComparisonBand = {
  minRaw: number;
  comparison: string;
};

export type DomainUpgrade = {
  key: string;
  prompt: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  note: string;
};

export type ReadingsInput = {
  key: string;
  label: string;
  readingLabel: string;
  readingLabels?: LabelText[];
  averageLabel: string;
  minReadings: number;
  maxReadings: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  placeholder: string;
};

export type NumberInput = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  placeholder: string;
};

export type RangeSpec = {
  min: number;
  max: number;
  placeholder: string;
};

export type WaistHeightInput = {
  waistKey: string;
  heightKey: string;
  units: MeasureUnit[];
  unitsLabel: string;
  unitLabels: string[];
  defaultUnit: MeasureUnit;
  waist: { label: string; in: RangeSpec; cm: RangeSpec };
  height: { label: string; in: RangeSpec; cm: RangeSpec };
  ratioLabel: string;
  hint: string;
};

export type BpInput = {
  key: string;
  minReadings: number;
  maxReadings: number;
  readingLabels?: LabelText[];
  averageLabel: string;
  hint: string;
  systolic: { label: string; unit: string; min: number; max: number; placeholder: string };
  diastolic: { label: string; unit: string; min: number; max: number; placeholder: string };
};

export type Who5Input = {
  key: string;
  scaleMin: number;
  scaleMax: number;
  scaleLabels: string[];
  statements: string[];
};

export type DomainScoring =
  | { type: "bands"; roundValue: number; derived?: "waistOverHeight"; bands: Band[] }
  | {
      type: "age-bands";
      ageKey: "age";
      under50Rule: "use-first-band";
      under50Note: string;
      ageBands: AgeBand[];
    }
  | {
      type: "bp-category";
      note: string;
      citation: string;
      categories: BpCategory[];
    }
  | {
      type: "who5";
      multiplier: number;
      rounding: "half-up";
      comparisonBands: Who5ComparisonBand[];
    };

/** Statamic field handles a protocol's inputs are submitted under. */
export type ProtocolFormFields = {
  readings?: string[];
  bp?: Array<{ systolic: string; diastolic: string }>;
  value?: string;
  units?: string;
  waist?: string;
  height?: string;
  /** Derived readout: the readings average, BP "sys/dia", or waist ÷ height. */
  derived?: string;
  answers?: string[];
  upgradeToggle?: string;
  upgrade?: string;
};

export type ProtocolForm = { handle: string; fields: ProtocolFormFields };

export type Domain = {
  id: DomainId;
  numeral: string;
  order: number;
  name: string;
  metric: string;
  shortMetric: string;
  unit: string;
  color: string;
  tagline: string;
  stepTitle: string;
  howTo: string[];
  inputType: InputType;
  input: ReadingsInput | NumberInput | WaistHeightInput | BpInput | Who5Input;
  scoring: DomainScoring;
  lever: string;
  upgrade: DomainUpgrade | null;
  form: ProtocolForm;
};

export type Quintile = {
  min: number;
  max: number;
  name: string;
  meaning: string;
};

export type PercentileResult = {
  pct: number;
  source: string;
  peerLabel: string;
};

export type DomainScore = {
  id: DomainId;
  numeral: string;
  name: string;
  metric: string;
  shortMetric: string;
  color: string;
  max: number;
  lever: string;
  points: number;
  bandLabel?: string;
  flag?: string | null;
  comparison?: string | null;
  value?: number | string;
  ageBandLabel?: string;
  note?: string | null;
  categoryId?: string;
  categoryLabel?: string;
  systolic?: number;
  diastolic?: number;
  raw?: number;
  percentile: PercentileResult | null;
};

export type Flag = {
  domainId: DomainId;
  domainName: string;
  flagId: string;
  severity: "urgent" | "doctor" | "check";
  title: string;
  message: string;
};

export type ScoreResult = {
  total: number;
  quintile: Quintile;
  domains: DomainScore[];
  flags: Flag[];
};

export type PathMove = {
  domainId: DomainId;
  numeral: string;
  name: string;
  shortMetric: string;
  color: string;
  gain: number;
  requirement: string;
};

export type PathPlan = {
  next: Quintile | null;
  gap: number;
  moves: PathMove[];
};

export type Participant = {
  firstName: string;
  email: string;
  age: number | null;
  fearWord: string;
  phase: Phase;
  marketingOptIn: boolean;
  dataConsent: boolean;
};

export type BpReading = {
  systolic?: number | null;
  diastolic?: number | null;
};

export type DomainInputState = {
  readings?: Array<number | null> | BpReading[];
  value?: number | null;
  unit?: MeasureUnit;
  waist?: number | null;
  height?: number | null;
  answers?: Array<number | null>;
};

export type Entry = {
  id: string;
  createdAt: string;
  phase: Phase;
  configVersion: string;
  participant: Participant;
  inputs: Record<string, DomainInputState>;
  upgrades: Record<string, number | null>;
  result: ScoreResult;
  baselineId: string | null;
  baselineTotal: number | null;
};

export type FlowState = {
  participant: Participant;
  inputs: Record<string, DomainInputState>;
  upgrades: Record<string, number | null>;
  currentEntryId: string | null;
  /** Successful form POSTs by Statamic form handle; `key` is the payload that was sent. */
  submissions: Record<string, { key: string; submittedAt: string }>;
  /** Bearer token from the lead submission, sent with each protocol submission. */
  authToken: string | null;
};

export type ScoringConfig = {
  version: string;
  configId: string;
  updated: string;
  source: string;
  totalMax: number;
  domainMax: number;
  domains: Domain[];
  quintiles: {
    active: string;
    sets: Record<string, Quintile[]>;
  };
  percentiles: {
    enabled: boolean;
    note: string;
    disclosure: string;
    domains: Record<string, unknown>;
    upgrades: Record<string, unknown>;
  };
  path: {
    title: string;
    gapLine: string;
    combo: string;
    single: string;
    topTitle: string;
    topMessage: string;
  };
  flags: {
    framing: string;
    [flagId: string]:
      | string
      | { severity: Flag["severity"]; title: string; message: string };
  };
  resultCopy: {
    scoreLabel: string;
    framing: string;
    retestFraming: string;
    leverIntro: string;
  };
  honesty: {
    footer: string;
    bpCitation: string;
  };
  comparison: {
    mode: string;
    note: string;
    compositeNote: string;
  };
  features: {
    percentiles: boolean;
    percentilesNote: string;
  };
};

export type LeadTextField = LabelText & {
  placeholder: string;
  maxLength?: number;
  note?: string;
};

export type LeadConsentField = {
  text: string;
  required: boolean;
  /** Value sent inside the checkboxes array when ticked. */
  value: string;
};

export type LeadFormContent = {
  session: { label: string; baselineLabel: string; week8Label: string };
  firstName: LeadTextField;
  email: LeadTextField;
  age: LeadTextField;
  fearWord: LeadTextField;
  marketingOptIn: LeadConsentField;
  dataConsent: LeadConsentField;
};

export type SiteContent = {
  config: ScoringConfig;
  leadForm: LeadFormContent;
  source: "cms" | "static";
};
