// Maps GET api/participants/{id}/score onto the app's ScoreResult. The backend scores and
// presents: five areas with their components and feedback paragraphs, flags with their
// eyebrow, readings recorded but not scored. The app only renders.
import type { Entry, ScoreResult } from "@/lib/types";
import type { ApiParticipantScore, ApiSessionScore } from "./statamic";

/** One API session as the app's ScoreResult; `baseline` is the API's baseline session for a Week-8 result. */
export function toScoreResult(
  session: ApiSessionScore,
  baseline: ApiSessionScore | null = null,
  delta: ApiParticipantScore["delta_from_baseline"] = null,
): ScoreResult {
  return {
    total: session.total,
    outOf: session.out_of ?? 100,
    word: session.word ?? session.cohort ?? null,
    overall: session.overall ?? null,
    totalNotScored: session.total_not_scored ?? null,
    retest: session.retest ?? null,
    scoreLabel: session.score_label ?? null,
    resultEyebrow: session.result_eyebrow ?? null,
    cohortDetail: session.cohort_detail ?? null,
    cohortScale: session.cohort_scale ?? [],
    areas: (session.areas ?? []).map((area) => ({
      key: area.key,
      numeral: area.numeral,
      name: area.name,
      heading: area.heading,
      points: area.points,
      max: area.max,
      notScored: area.not_scored,
      paragraph: area.paragraph,
      notes: area.notes ?? [],
      components: area.components.map((c) => ({
        key: c.key,
        measure: c.measure,
        value: c.value,
        band: c.band,
        label: c.label,
        points: c.points,
        max: c.max,
        flag: c.flag,
        note: c.note ?? "",
        questionnaire: c.questionnaire,
        line: c.line,
      })),
      delta: delta?.domains?.[area.key] ?? null,
    })),
    flags: (session.flags ?? []).map((f) => ({
      id: f.id,
      domain: f.domain,
      severity: f.severity,
      eyebrow: f.eyebrow,
      title: f.title,
      message: f.message,
      critical: Boolean(f.critical),
      paragraph: f.paragraph ?? null,
    })),
    flagsFraming: session.flags_framing ?? null,
    recorded: session.recorded ?? [],
    membership: {
      mode: session.membership?.mode ?? null,
      eyebrow: session.membership?.eyebrow ?? null,
      headline: session.membership?.headline ?? null,
      body: session.membership?.body ?? null,
      bullets: session.membership?.bullets ?? [],
      button: session.membership?.button ?? null,
      url: session.membership?.url ?? null,
      priceNote: session.membership?.price_note ?? null,
    },
    disclaimer: session.disclaimer ?? null,
    configVersion: session.config_version,
    deltaTotal: baseline ? (delta?.total ?? null) : null,
    baselineTotal: baseline?.total ?? null,
    baselineOutOf: baseline ? (baseline.out_of ?? 100) : null,
  };
}

/** The entry fields to replace with the API's score for that entry's session; null when it has none. */
export function apiScorePatch(entry: Entry, api: ApiParticipantScore): Partial<Entry> | null {
  const session = entry.phase === "week8" ? api.week_8_retest : api.baseline;
  if (!session) return null;
  const baseline = entry.phase === "week8" ? api.baseline : null;
  return {
    result: toScoreResult(session, baseline, entry.phase === "week8" ? api.delta_from_baseline : null),
    configVersion: session.config_version,
    baselineTotal: baseline?.total ?? entry.baselineTotal,
    scoreSource: "api",
  };
}
