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
  defaultUnit: MeasureUnit;
  waist: { label: string; in: RangeSpec; cm: RangeSpec };
  height: { label: string; in: RangeSpec; cm: RangeSpec };
};

export type BpInput = {
  key: string;
  minReadings: number;
  maxReadings: number;
  systolic: { label: string; min: number; max: number; placeholder: string };
  diastolic: { label: string; min: number; max: number; placeholder: string };
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
  howTo: string[];
  inputType: InputType;
  input: ReadingsInput | NumberInput | WaistHeightInput | BpInput | Who5Input;
  scoring: DomainScoring;
  lever: string;
  upgrade: DomainUpgrade | null;
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
