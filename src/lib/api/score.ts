// Maps GET api/participants/{id}/score onto the app's ScoreResult, so the score and report pages
// show the backend's numbers and copy. The response's own cohort scale is used when it sends one;
// next-step moves come from the backend's scoring config (api/scoring-config) so they agree with
// those numbers. The static config only fills in colours, units and anything the API leaves blank.
import type {
  DomainId,
  Entry,
  Flag,
  PathMove,
  Quintile,
  ScoreDisplay,
  ScoreResult,
  ScoringConfig,
} from "@/lib/types";
import type {
  ApiBpCategory,
  ApiDomainKey,
  ApiDomainScore,
  ApiMaxBand,
  ApiParticipantScore,
  ApiScoringConfig,
  ApiSessionScore,
} from "./statamic";

// The app calls the mindset domain "recovery".
const API_KEY: Record<DomainId, ApiDomainKey> = {
  nervous: "nervous",
  movement: "movement",
  metabolism: "metabolism",
  evidence: "evidence",
  recovery: "mindset",
};

const SEVERITY: Record<string, Flag["severity"]> = {
  critical: "urgent",
  urgent: "urgent",
  warning: "doctor",
  info: "check",
};

// The API sends null or "" for copy it has no value for yet.
const text = (s: string | null | undefined) => (s && s.trim() ? s : null);

/** The response's cohort scale as min–max ranges (an open max runs to the next tier's min). */
function cohortScale(session: ApiSessionScore, config: ScoringConfig): Quintile[] {
  const tiers = [...(session.cohort_scale ?? [])].sort((a, b) => a.min - b.min);
  return tiers.map((tier, i) => {
    const max = tier.max ?? (i < tiers.length - 1 ? tiers[i + 1].min - 1 : config.totalMax);
    return {
      min: tier.min,
      max,
      name: tier.name,
      meaning: tier.current ? (text(session.cohort_detail?.tagline) ?? "") : "",
      range: text(tier.range) ?? `${tier.min}–${max}`,
    };
  });
}

/** The backend's cohort tiers as min–max ranges, borrowing the static set's meanings by position. */
export function cohortTiers(scoring: ApiScoringConfig, config: ScoringConfig): Quintile[] {
  const meanings = config.quintiles.sets[config.quintiles.active].map((q) => q.meaning);
  const tiers = [...scoring.cohorts.tiers].sort((a, b) => a.min - b.min);
  return tiers.map((tier, i) => ({
    min: tier.min,
    max: i < tiers.length - 1 ? tiers[i + 1].min - 1 : config.totalMax,
    name: tier.name,
    meaning: tiers.length === meanings.length ? meanings[i] : "",
  }));
}

/** "56–62", "≤55", "0.40–0.49": the values a max-ordered band covers, at `decimals` precision. */
function maxBandRange(bands: ApiMaxBand[], index: number, decimals: number) {
  const step = 10 ** -decimals;
  const fmt = (n: number) => n.toFixed(decimals);
  const upper = bands[index].max;
  const prev = index > 0 ? bands[index - 1].max : null;
  let lower: number | null = null;
  if (prev != null) {
    const ceiled = Math.ceil(prev / step - 1e-9) * step;
    lower = ceiled > prev ? ceiled : ceiled + step;
  }
  if (upper == null) return `${fmt(lower ?? 0)}+`;
  const floored = Math.floor(upper / step + 1e-9) * step;
  return lower == null ? `≤${fmt(floored)}` : `${fmt(lower)}–${fmt(floored)}`;
}

/** "<120/80", "120–129 and <80", "130–139 or 80–89", "140+ or 90+". */
function bpReading(rule: ApiBpCategory["rule"]) {
  const { systolicMin, systolicMax, diastolicMin, diastolicMax } = rule;
  if (systolicMin == null && diastolicMin == null) return `<${(systolicMax ?? 0) + 1}/${(diastolicMax ?? 0) + 1}`;
  const sys = systolicMax != null ? `${systolicMin}–${systolicMax}` : `${systolicMin}+`;
  if (diastolicMin == null) return `${sys} and <${(diastolicMax ?? 0) + 1}`;
  const dia = diastolicMax != null ? `${diastolicMin}–${diastolicMax}` : `${diastolicMin}+`;
  return `${sys} or ${dia}`;
}

/** The nearest step in a ladder that is worth more points than the current one. */
function nextStep<T extends { points: number; band: string }>(ladder: T[], current: ApiDomainScore) {
  const here = ladder.findIndex((step) => step.band === current.band);
  return ladder
    .map((step, i) => ({ step, i, distance: here < 0 ? 0 : Math.abs(i - here) }))
    .filter(({ step }) => step.points > current.points)
    .sort((a, b) => a.distance - b.distance || a.step.points - b.step.points)[0];
}

/** One domain's smallest move up, scored against the backend's bands. */
function nextMove(key: ApiDomainKey, current: ApiDomainScore, session: ApiSessionScore, scoring: ApiScoringConfig) {
  const gain = (points: number) => points - current.points;
  switch (key) {
    case "nervous":
    case "metabolism": {
      const bands = scoring.domains[key].bands;
      const next = nextStep(bands, current);
      if (!next) return null;
      const range = maxBandRange(bands, next.i, key === "nervous" ? 0 : 2);
      return {
        gain: gain(next.step.points),
        requirement: `reach ${next.step.band} (${range}${key === "nervous" ? " bpm" : ""})`,
      };
    }
    case "movement": {
      const { ageBands } = scoring.domains.movement;
      const band =
        ageBands.find((b) => b.label === session.derived.age_band) ??
        ageBands.find((b) => session.age >= b.minAge && session.age <= b.maxAge);
      const next = band ? nextStep(band.bands, current) : undefined;
      return next
        ? { gain: gain(next.step.points), requirement: `reach ${next.step.band} (${next.step.min}+ reps)` }
        : null;
    }
    case "evidence": {
      const next = nextStep(scoring.domains.evidence.categories, current);
      return next
        ? { gain: gain(next.step.points), requirement: `reach ${next.step.band} (${bpReading(next.step.rule)})` }
        : null;
    }
    case "mindset": {
      const raw = typeof current.value === "number" ? current.value : (session.derived.who5_raw ?? 0);
      for (let r = raw + 1; r <= 25; r++) {
        const points = Math.round(r * scoring.domains.mindset.multiplier);
        if (points > current.points) {
          return { gain: gain(points), requirement: `lift your two-week answers to ${r} / 25` };
        }
      }
      return null;
    }
  }
}

/** One API session as the app's ScoreResult; `retest` marks the Week-8 session. */
export function toScoreResult(
  session: ApiSessionScore,
  response: ApiParticipantScore,
  scoring: ApiScoringConfig | null,
  config: ScoringConfig,
  retest: boolean,
): ScoreResult {
  const cohorts = session.cohort_scale?.length
    ? cohortScale(session, config)
    : scoring
      ? cohortTiers(scoring, config)
      : [];
  const current = session.cohort_scale?.find((tier) => tier.current)?.name ?? session.cohort;
  const idFor = (key: ApiDomainKey) => config.domains.find((d) => API_KEY[d.id] === key);

  const flags: Flag[] = session.flags.flatMap((flag) => {
    const domain = idFor(flag.domain);
    return domain
      ? [
          {
            domainId: domain.id,
            domainName: domain.name,
            flagId: flag.id,
            severity: SEVERITY[flag.severity] ?? "doctor",
            title: flag.title,
            message: flag.message,
          },
        ]
      : [];
  });

  const domains = config.domains.map((domain) => {
    const key = API_KEY[domain.id];
    const api = session.domains[key];
    const value = api?.value ?? undefined;
    return {
      id: domain.id,
      numeral: text(api?.numeral) ?? domain.numeral,
      name: text(api?.name) ?? domain.name,
      metric: domain.metric,
      shortMetric: domain.shortMetric,
      color: domain.color,
      lever: session.levers.find((l) => l.domain === key)?.copy || domain.lever,
      max: api?.max ?? config.domainMax,
      points: api?.points ?? 0,
      bandLabel: api?.band ?? undefined,
      comparison: api?.band ?? null,
      description: text(api?.description),
      flag: flags.find((f) => f.domainId === domain.id)?.flagId ?? null,
      value,
      // Only a percentile the API sends; the app no longer works its own out.
      percentile: typeof api?.percentile === "number" ? { pct: api.percentile, source: "", peerLabel: "" } : null,
    };
  });

  const gap = session.path_to_next?.points_needed ?? 0;
  const next = session.path_to_next
    ? (cohorts.find((c) => c.name === session.path_to_next!.cohort) ?? {
        min: session.total + gap,
        max: config.totalMax,
        name: session.path_to_next.cohort,
        meaning: "",
      })
    : null;
  const moves: PathMove[] = next
    ? config.domains
        .flatMap((domain) => {
          const key = API_KEY[domain.id];
          // A protocol not submitted yet has no band to move up from.
          const move =
            scoring && session.domains[key] && !session.missing.includes(key)
              ? nextMove(key, session.domains[key], session, scoring)
              : null;
          return move
            ? [
                {
                  domainId: domain.id,
                  numeral: domain.numeral,
                  name: domain.name,
                  shortMetric: domain.shortMetric,
                  color: domain.color,
                  ...move,
                },
              ]
            : [];
        })
        .sort((a, b) => b.gain - a.gain)
    : [];

  const membership = session.membership;
  const display: ScoreDisplay = {
    firstName: text(response.participant?.first_name),
    date: text(session.date),
    age: session.age ?? null,
    eyebrow: text(session.result_eyebrow),
    cohortRange: text(session.cohort_detail?.range),
    cohortTagline: text(session.cohort_detail?.tagline),
    domainsHeading: text(response.copy?.domains_heading),
    cohortCard: session.cohort_card
      ? {
          eyebrow: text(session.cohort_card.eyebrow),
          title: text(session.cohort_card.title),
          body: text(session.cohort_card.body),
        }
      : null,
    levers: session.levers.flatMap((lever) => {
      const domain = idFor(lever.domain);
      return domain
        ? [
            {
              domainId: domain.id,
              numeral: text(lever.numeral) ?? domain.numeral,
              label: text(lever.label) ?? domain.name,
              points: lever.points,
              copy: lever.copy,
              color: domain.color,
            },
          ]
        : [];
    }),
    leversHeading: text(response.copy?.levers_heading),
    leversFooter: text(session.levers_footer),
    membership: membership
      ? {
          mode: membership.mode,
          eyebrow: text(membership.eyebrow),
          headline: text(membership.headline),
          body: text(membership.body),
          bullets: (membership.bullets ?? []).filter((b) => text(b)),
          button: text(membership.button),
          url: text(membership.url),
          priceNote: text(membership.price_note),
        }
      : null,
    notMedicalNotice: text(response.copy?.not_medical_notice),
    disclaimer: text(session.disclaimer),
    reportButton: text(response.copy?.report_button),
    delta: retest ? (response.delta_from_baseline?.total ?? null) : null,
    derived: {
      rhrBpm: session.derived?.rhr_bpm ?? null,
      ageBand: text(session.derived?.age_band),
      waistToHeight: session.derived?.waist_to_height_ratio ?? null,
      systolic: session.derived?.systolic ?? null,
      diastolic: session.derived?.diastolic ?? null,
      bpCategory: text(session.derived?.bp_category),
      who5Raw: session.derived?.who5_raw ?? null,
      who5Percent: session.derived?.who5_percent ?? null,
    },
  };

  return {
    total: session.total,
    quintile: cohorts.find((c) => c.name === current) ?? {
      min: 0,
      max: config.totalMax,
      name: session.cohort,
      meaning: text(session.cohort_detail?.tagline) ?? "",
    },
    domains,
    flags,
    cohorts,
    path: { next, gap, moves },
    leverIds: session.levers.flatMap((l) => idFor(l.domain)?.id ?? []),
    display,
  };
}

/** The entry fields to replace with the API's score for that entry's session; null when it has none. */
export function apiScorePatch(
  entry: Entry,
  api: ApiParticipantScore,
  scoring: ApiScoringConfig | null,
  config: ScoringConfig,
): Partial<Entry> | null {
  const retest = entry.phase === "week8";
  const session = retest ? api.week_8_retest : api.baseline;
  if (!session) return null;
  return {
    result: toScoreResult(session, api, scoring, config, retest),
    configVersion: session.config_version,
    baselineTotal: entry.phase === "week8" ? (api.baseline?.total ?? entry.baselineTotal) : entry.baselineTotal,
    scoreSource: "api",
  };
}
