import { scoringConfig } from "./scoring-config";
import type {
  Band,
  BpCategory,
  BpReading,
  Domain,
  DomainId,
  DomainInputState,
  DomainScore,
  Flag,
  Participant,
  PathPlan,
  PercentileResult,
  Quintile,
  ScoreResult,
  ScoringConfig,
} from "./types";

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function halfUp(value: number) {
  return Math.floor(value + 0.5);
}

export function mean(values: Array<number | null | undefined>) {
  const nums = values.filter((n): n is number => Number.isFinite(n));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function scoreBands(scoring: { roundValue?: number; bands: Band[] }, value: number) {
  const n = scoring.roundValue != null ? roundTo(value, scoring.roundValue) : value;
  for (const band of scoring.bands) {
    if (band.max === null || n <= band.max) {
      return {
        points: band.points,
        bandLabel: band.label,
        flag: band.flag || null,
        comparison: band.comparison || null,
        value: n,
      };
    }
  }
  return null;
}

function scoreAgeBands(
  scoring: Extract<Domain["scoring"], { type: "age-bands" }>,
  value: number,
  age: number,
) {
  const band =
    scoring.ageBands.find((b) => age >= b.ageMin && (b.ageMax === null || age <= b.ageMax)) ||
    scoring.ageBands[0];
  for (const t of band.thresholds) {
    if (value >= t.min) {
      return {
        points: t.points,
        bandLabel: t.label,
        ageBandLabel: band.label,
        flag: null as string | null,
        comparison: t.comparison || null,
        value,
        note: age < 50 ? scoring.under50Note : null,
      };
    }
  }
  return null;
}

function matchBpCategory(
  scoring: Extract<Domain["scoring"], { type: "bp-category" }>,
  systolic: number,
  diastolic: number,
): BpCategory {
  for (const cat of scoring.categories) {
    const sysHit = cat.systolicMin != null && systolic >= cat.systolicMin;
    const diaHit = cat.diastolicMin != null && diastolic >= cat.diastolicMin;
    const isNormal = cat.systolicMin == null && cat.diastolicMin == null;
    if (sysHit || diaHit || isNormal) return cat;
  }
  return scoring.categories[scoring.categories.length - 1];
}

function scoreBp(
  scoring: Extract<Domain["scoring"], { type: "bp-category" }>,
  readings: BpReading[],
) {
  const sys = Math.round(mean(readings.map((r) => r.systolic))!);
  const dia = Math.round(mean(readings.map((r) => r.diastolic))!);
  const cat = matchBpCategory(scoring, sys, dia);
  return {
    points: cat.points,
    bandLabel: cat.label,
    categoryId: cat.id,
    categoryLabel: cat.label,
    flag: cat.flag || null,
    comparison: cat.comparison || null,
    value: `${sys}/${dia}`,
    systolic: sys,
    diastolic: dia,
  };
}

function scoreWho5(scoring: Extract<Domain["scoring"], { type: "who5" }>, answers: number[]) {
  const raw = answers.reduce((a, b) => a + b, 0);
  const points = halfUp(raw * scoring.multiplier);
  const band = scoring.comparisonBands.find((b) => raw >= b.minRaw);
  return {
    points,
    bandLabel: `Raw ${raw} / 25`,
    raw,
    flag: null as string | null,
    comparison: band ? band.comparison : null,
    value: raw,
  };
}

export function scoreDomain(domain: Domain, inputs: DomainInputState, participant: Participant) {
  const scoring = domain.scoring;
  switch (scoring.type) {
    case "bands": {
      if (scoring.derived === "waistOverHeight") {
        const waist = inputs.waist;
        const height = inputs.height;
        if (!Number.isFinite(waist) || !Number.isFinite(height) || !height || height <= 0) return null;
        return scoreBands(scoring, waist! / height);
      }
      const readings = Array.isArray(inputs.readings)
        ? (inputs.readings as Array<number | null>)
        : [inputs.value];
      const avg = mean(readings);
      return avg == null ? null : scoreBands(scoring, avg);
    }
    case "age-bands":
      return Number.isFinite(inputs.value) && participant.age != null
        ? scoreAgeBands(scoring, inputs.value as number, participant.age)
        : null;
    case "bp-category": {
      const readings = ((inputs.readings || []) as BpReading[]).filter(
        (r) => Number.isFinite(r.systolic) && Number.isFinite(r.diastolic),
      );
      return readings.length ? scoreBp(scoring, readings) : null;
    }
    case "who5": {
      const answers = inputs.answers;
      if (!Array.isArray(answers) || answers.some((a) => !Number.isFinite(a))) return null;
      return scoreWho5(scoring, answers as number[]);
    }
    default:
      return null;
  }
}

function erfApprox(x: number, meanVal: number, sd: number) {
  const z = (x - meanVal) / (sd * Math.SQRT2);
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + (z >= 0 ? y : -y));
}

function clampPct(n: number) {
  return Math.min(99, Math.max(1, Math.round(n)));
}

function interpolate(table: Array<[number, number]>, x: number) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1];
    const [x1, y1] = table[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return table[table.length - 1][1];
}

type MovementPct = {
  mode: string;
  method: string;
  direction: string;
  resultKey: string;
  minAge?: number;
  source: string;
  peerLabel: string;
  bands: Array<{ ageMin: number; ageMax: number | null; mean: number; sd: number }>;
};

type RecoveryPct = {
  mode: string;
  method: string;
  resultKey: string;
  scaleMultiplier?: number;
  source: string;
  peerLabel: string;
  ageBands: Array<{ ageMin: number; ageMax: number | null; key: string }>;
  cumulative: Record<string, Array<[number, number]>>;
};

type GripPct = {
  method: string;
  direction: string;
  source: string;
  peerLabel: string;
  curve: Array<{ age: number; mean: number; sd: number }>;
};

function domainPercentile(
  config: ScoringConfig,
  domainId: string,
  scored: Record<string, unknown> | null,
  age: number,
): PercentileResult | null {
  const spec = (config.percentiles.domains as Record<string, unknown>)[domainId] as
    | MovementPct
    | RecoveryPct
    | { mode: string }
    | undefined;
  if (!config.percentiles.enabled || !spec || spec.mode !== "percentile" || !scored) return null;
  const key = "resultKey" in spec ? spec.resultKey : "value";
  const value = scored[key];
  if (!Number.isFinite(value)) return null;

  if ("method" in spec && spec.method === "normal") {
    const movement = spec as MovementPct;
    if (movement.minAge != null && age < movement.minAge) return null;
    const band = movement.bands.find((b) => age >= b.ageMin && (b.ageMax === null || age <= b.ageMax));
    if (!band) return null;
    const cdf = erfApprox(value as number, band.mean, band.sd);
    const pct = movement.direction === "lower" ? (1 - cdf) * 100 : cdf * 100;
    return { pct: clampPct(pct), source: movement.source, peerLabel: movement.peerLabel };
  }

  if ("method" in spec && spec.method === "cumulative-table") {
    const recovery = spec as RecoveryPct;
    const band = recovery.ageBands.find((b) => age >= b.ageMin && (b.ageMax === null || age <= b.ageMax));
    if (!band) return null;
    const scaled = (value as number) * (recovery.scaleMultiplier || 1);
    const pct = interpolate(recovery.cumulative[band.key], scaled);
    return { pct: clampPct(pct), source: recovery.source, peerLabel: recovery.peerLabel };
  }

  return null;
}

export function upgradePercentile(
  config: ScoringConfig,
  key: string,
  value: number,
  age: number,
): PercentileResult | null {
  const spec = (config.percentiles.upgrades as Record<string, unknown>)[key] as GripPct | undefined;
  if (!config.percentiles.enabled || !spec || !Number.isFinite(value)) return null;
  if (spec.method === "normal-by-age-curve") {
    const curve = spec.curve;
    const clamped = Math.min(Math.max(age, curve[0].age), curve[curve.length - 1].age);
    const meanVal = interpolate(
      curve.map((p) => [p.age, p.mean]),
      clamped,
    );
    const sd = interpolate(
      curve.map((p) => [p.age, p.sd]),
      clamped,
    );
    const cdf = erfApprox(value, meanVal, sd);
    const pct = spec.direction === "lower" ? (1 - cdf) * 100 : cdf * 100;
    return { pct: clampPct(pct), source: spec.source, peerLabel: spec.peerLabel };
  }
  return null;
}

export function ordinal(n: number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

export function quintileFor(config: ScoringConfig, total: number): Quintile {
  const set = config.quintiles.sets[config.quintiles.active];
  return set.find((q) => total >= q.min && total <= q.max) || set[0];
}

export function computeResult(
  participant: Participant,
  inputs: Record<string, DomainInputState>,
  config: ScoringConfig = scoringConfig,
): ScoreResult {
  const domains: DomainScore[] = config.domains.map((domain) => {
    const scored = scoreDomain(domain, inputs[domain.id] || {}, participant);
    const percentile = domainPercentile(config, domain.id, scored, participant.age ?? 0);
    return {
      id: domain.id,
      numeral: domain.numeral,
      name: domain.name,
      metric: domain.metric,
      shortMetric: domain.shortMetric,
      color: domain.color,
      max: config.domainMax,
      lever: domain.lever,
      ...scored,
      points: scored?.points ?? 0,
      percentile,
    };
  });
  const total = domains.reduce((sum, d) => sum + (d.points || 0), 0);
  const quintile = quintileFor(config, total);
  const flags: Flag[] = domains
    .filter((d) => d.flag)
    .map((d) => {
      const spec = config.flags[d.flag as string];
      if (!spec || typeof spec !== "object") return null;
      return {
        domainId: d.id,
        domainName: d.name,
        flagId: d.flag as string,
        severity: spec.severity,
        title: spec.title,
        message: spec.message,
      };
    })
    .filter((f): f is Flag => Boolean(f));
  return { total, quintile, domains, flags };
}

export function weakestDomains(result: ScoreResult, count = 2) {
  return [...result.domains]
    .filter((d) => Number.isFinite(d.points))
    .sort((a, b) => a.points - b.points)
    .slice(0, count);
}

function nextBandMove(domain: Domain, scored: DomainScore) {
  const scoring = domain.scoring;
  const points = scored.points;
  if (scoring.type === "bands") {
    const next = scoring.bands
      .filter((b) => b.points > points && !b.flag)
      .sort((a, b) => a.points - b.points)[0];
    return next ? { gain: next.points - points, requirement: `into ${next.label}` } : null;
  }
  if (scoring.type === "age-bands") {
    const band =
      scoring.ageBands.find((b) => scored.ageBandLabel === b.label) || scoring.ageBands[0];
    const next = band.thresholds.filter((t) => t.points > points).sort((a, b) => a.points - b.points)[0];
    return next ? { gain: next.points - points, requirement: `reach ${next.label}` } : null;
  }
  if (scoring.type === "bp-category") {
    const idx = scoring.categories.findIndex((c) => c.id === scored.categoryId);
    const next = scoring.categories
      .slice(idx + 1)
      .filter((c) => c.points > points)
      .sort((a, b) => a.points - b.points)[0];
    return next
      ? { gain: next.points - points, requirement: `reach ${next.label} (${next.reading})` }
      : null;
  }
  if (scoring.type === "who5") {
    if (points >= 20) return null;
    let raw = scored.raw ?? 0;
    while (raw < 25) {
      raw += 1;
      const nextPoints = Math.floor(raw * scoring.multiplier + 0.5);
      if (nextPoints > points) {
        return { gain: nextPoints - points, requirement: `lift your two-week answers to ${raw} / 25` };
      }
    }
    return null;
  }
  return null;
}

export function pathPlan(config: ScoringConfig, result: ScoreResult): PathPlan {
  const set = config.quintiles.sets[config.quintiles.active];
  const idx = set.findIndex((q) => q.name === result.quintile.name);
  const next = idx >= 0 && idx < set.length - 1 ? set[idx + 1] : null;
  if (!next) return { next: null, gap: 0, moves: [] };
  const gap = next.min - result.total;
  const moves = config.domains
    .map((domain) => {
      const scored = result.domains.find((d) => d.id === domain.id);
      if (!scored || !Number.isFinite(scored.points)) return null;
      const move = nextBandMove(domain, scored);
      return move
        ? {
            domainId: domain.id,
            numeral: domain.numeral,
            name: domain.name,
            shortMetric: domain.shortMetric,
            color: domain.color,
            ...move,
          }
        : null;
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .sort((a, b) => b.gain - a.gain);
  return { next, gap, moves };
}

export function domainById(id: DomainId, config: ScoringConfig = scoringConfig) {
  return config.domains.find((d) => d.id === id) ?? null;
}

export function domainBySlug(slug: string, config: ScoringConfig = scoringConfig) {
  return config.domains.find((d) => d.id === slug) ?? null;
}
