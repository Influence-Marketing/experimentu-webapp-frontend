// The five protocols as the stations capture them for the November 2026 U Score (scoring
// schema 2): which blueprint fields each screen asks for, in which groups, and when a
// protocol is complete. Mirrors resources/blueprints/forms/protocol_*.yaml in the backend.
// The backend scores; nothing here works out points.
import type { DomainInputState, FieldOption, MeasureUnit, Protocol, ProtocolsConfig } from "./types";

const has = (v: unknown) => v !== null && v !== undefined && v !== "" && v !== false;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The measure unit a protocol's `units` field is set to ("Inches" / "Centimetres" option keys). */
export function measureUnit(inputs: DomainInputState): MeasureUnit {
  const u = String(inputs.units ?? "Inches").toLowerCase();
  return u.startsWith("c") ? "cm" : "in";
}

const QUALITY: FieldOption[] = [
  { key: "very good", label: "Very good" },
  { key: "good", label: "Good" },
  { key: "fair", label: "Fair" },
  { key: "poor", label: "Poor" },
];

const WHO5_SCALE: FieldOption[] = ["At no time", "Some of the time", "Less than half the time", "More than half the time", "Most of the time", "All of the time"].map(
  (label, i) => ({ key: String(i), label }),
);

const UCLA_SCALE: FieldOption[] = [
  { key: "1", label: "Hardly ever" },
  { key: "2", label: "Some of the time" },
  { key: "3", label: "Often" },
];

const WHO5 = [
  ["i_have_felt_cheerful_and_in_good_spirits", "I have felt cheerful and in good spirits"],
  ["i_have_felt_calm_and_relaxed", "I have felt calm and relaxed"],
  ["i_have_felt_active_and_vigorous", "I have felt active and vigorous"],
  ["i_woke_up_feeling_fresh_and_rested", "I woke up feeling fresh and rested"],
  ["my_daily_life_has_been_filled_with_things_that_interest_me", "My daily life has been filled with things that interest me"],
] as const;

const UCLA = [
  ["ucla_1", "How often do you feel that you lack companionship?"],
  ["ucla_2", "How often do you feel left out?"],
  ["ucla_3", "How often do you feel isolated from others?"],
] as const;

const protocols: Protocol[] = [
  {
    id: "nervous",
    numeral: "I",
    order: 1,
    name: "Nervous System",
    metric: "HRV + sleep",
    shortMetric: "Nervous",
    color: "cranberry",
    tagline: "How your nervous system shifts gears.",
    stepTitle: "The protocol",
    howTo: [
      "Ask about heart medication, a pacemaker or an irregular heartbeat: Yes, No or Not sure. Yes and Not sure are recorded, not scored.",
      "Seated and at rest, before any breathwork: a two-minute HRV reading from the wrist strap, as RMSSD in milliseconds. Record the seated resting heart rate twice; it is not scored.",
      "Answer the two sleep questions about the past month.",
    ],
    form: { handle: "protocol_i_nervous_system" },
    notScored: "hr_not_scored",
    groups: [
      {
        title: "Heart",
        fields: [
          { handle: "hrv_ms", kind: "number", label: "HRV (RMSSD)", unit: "ms", min: 1, max: 300, step: 1, placeholder: "32", width: "half" },
          {
            handle: "hr_not_scored",
            kind: "select",
            label: "Heart medication, pacemaker or irregular heartbeat?",
            opt: "No: leave blank. Yes or Not sure: recorded, not scored",
            blankLabel: "No",
            width: "half",
            options: [
              { key: "rate-lowering heart medication", label: "Yes: heart medication (beta-blocker etc.)" },
              { key: "pacemaker", label: "Yes: pacemaker" },
              { key: "irregular pulse", label: "Yes: atrial fibrillation or irregular heartbeat" },
              { key: "not sure", label: "Not sure" },
              { key: "no reading", label: "No reading: the wrist strap did not work" },
            ],
          },
          { handle: "rhr_seated_1", kind: "number", label: "Resting heart rate, seated", opt: "reading 1, recorded only", unit: "bpm", min: 30, max: 220, placeholder: "68", width: "half" },
          { handle: "rhr_seated_2", kind: "number", label: "Resting heart rate, seated", opt: "reading 2, recorded only", unit: "bpm", min: 30, max: 220, placeholder: "66", width: "half" },
        ],
      },
      {
        title: "Sleep",
        note: "Over the past month.",
        fields: [
          { handle: "sleep_hours", kind: "number", label: "Hours of sleep on an average night", unit: "hours", min: 0, max: 16, step: 0.5, placeholder: "7" },
          { handle: "sleep_quality", kind: "choice", label: "How would you rate your sleep overall?", options: QUALITY },
          { handle: "snoring", kind: "toggle", label: "Do you snore loudly, or has anyone seen you stop breathing in your sleep?" },
        ],
      },
    ],
    complete: (i) => (has(i.hrv_ms) || has(i.rhr_seated_1) || has(i.hr_not_scored)) && num(i.sleep_hours) !== null && has(i.sleep_quality),
  },
  {
    id: "movement",
    numeral: "II",
    order: 2,
    name: "Movement",
    metric: "Sit-to-stand + grip + activity",
    shortMetric: "Movement",
    color: "sage",
    tagline: "Functional strength you can count.",
    stepTitle: "The protocol",
    howTo: [
      "Standard chair, arms crossed: count full stands in 30 seconds. Tick the box if the first five stands took more than 15 seconds.",
      "Three grip squeezes on the dynamometer with the dominant hand. The best one is scored.",
      "Answer the three activity questions about a typical week.",
    ],
    form: { handle: "protocol_ii_movement" },
    notScored: "movement_not_scored",
    groups: [
      {
        title: "Sit-to-stand",
        fields: [
          { handle: "full_stands_in_30_seconds", kind: "number", label: "Full stands in 30 seconds", unit: "stands", min: 0, max: 60, placeholder: "14", width: "half" },
          // Alex, 18 November: no time is recorded for the first five stands, only this optional box (ticked scores needs attention).
          { handle: "five_over_15s", kind: "toggle", label: "Took more than 15 seconds for the first 5 stands" },
          { handle: "used_arms", kind: "toggle", label: "Needed arms to stand" },
        ],
      },
      {
        title: "Grip strength",
        fields: [
          { handle: "grip_1", kind: "number", label: "Squeeze 1", opt: "dominant hand", unit: "kg", min: 1, max: 100, step: 0.5, placeholder: "28", width: "third" },
          { handle: "grip_2", kind: "number", label: "Squeeze 2", opt: "dominant hand", unit: "kg", min: 1, max: 100, step: 0.5, placeholder: "29", width: "third" },
          { handle: "grip_3", kind: "number", label: "Squeeze 3", opt: "dominant hand", unit: "kg", min: 1, max: 100, step: 0.5, placeholder: "27", width: "third" },
        ],
      },
      {
        title: "Physical activity",
        note: "In a typical week.",
        fields: [
          { handle: "activity_days", kind: "number", label: "Days of moderate or vigorous exercise", opt: "like a brisk walk or harder", unit: "days", min: 0, max: 7, placeholder: "3", width: "third" },
          { handle: "activity_minutes", kind: "number", label: "Minutes on those days", unit: "min", min: 0, max: 300, step: 5, placeholder: "30", width: "third" },
          { handle: "strength_days", kind: "number", label: "Days of muscle-strengthening exercise", unit: "days", min: 0, max: 7, placeholder: "1", width: "third" },
        ],
      },
      {
        fields: [
          {
            handle: "movement_not_scored",
            kind: "select",
            label: "Movement not scored because",
            opt: "leave blank unless one applies; a guest who can do only one of the two strength tests is not scored on Movement",
            blankLabel: "Nothing applies",
            options: [
              { key: "cannot attempt the chair test safely", label: "Cannot attempt the chair test safely" },
              { key: "cannot do the grip test", label: "Cannot do the grip test" },
              { key: "declined", label: "Declined" },
            ],
          },
        ],
      },
    ],
    complete: (i) =>
      has(i.movement_not_scored) ||
      ((num(i.full_stands_in_30_seconds) !== null || i.used_arms === true) &&
        [i.grip_1, i.grip_2, i.grip_3].some((g) => num(g) !== null) &&
        num(i.activity_days) !== null &&
        num(i.activity_minutes) !== null &&
        num(i.strength_days) !== null),
  },
  {
    id: "metabolism",
    numeral: "III",
    order: 3,
    name: "Metabolism",
    metric: "Waist-to-height + fibre",
    shortMetric: "Metabolism",
    color: "gold",
    tagline: "Where your body stores fat, and how your metabolism responds to food.",
    stepTitle: "The protocol",
    howTo: [
      "Tape midway between the lowest rib and the top of the hip bone, standing relaxed.",
      "Height from the start of the day, in the same units as the waist. The hip is not measured.",
      "Answer the three fibre questions about a typical day and week.",
    ],
    form: { handle: "protocol_iii_metabolism" },
    notScored: "metabolism_not_scored",
    groups: [
      {
        title: "Waist and height",
        fields: [
          {
            handle: "units",
            kind: "units",
            label: "Units",
            options: [
              { key: "Inches", label: "Inches" },
              { key: "Centimetres", label: "Centimetres" },
            ],
          },
          { handle: "waist_at_navel", kind: "number", label: "Waist", width: "third", byUnit: { in: { min: 18, max: 80, placeholder: "31" }, cm: { min: 45, max: 205, placeholder: "79" } } },
          { handle: "height", kind: "number", label: "Height", width: "third", byUnit: { in: { min: 48, max: 84, placeholder: "65" }, cm: { min: 120, max: 215, placeholder: "165" } } },
        ],
      },
      {
        title: "Fibre",
        fields: [
          { handle: "fibre_grains", kind: "number", label: "Whole-grain servings on a typical day", unit: "a day", min: 0, max: 10, placeholder: "2", width: "third" },
          { handle: "fibre_fruit_veg", kind: "number", label: "Fruit and vegetable servings on a typical day", unit: "a day", min: 0, max: 15, placeholder: "4", width: "third" },
          { handle: "fibre_legumes", kind: "number", label: "Times a week you eat beans, lentils, nuts or seeds", unit: "a week", min: 0, max: 21, placeholder: "3", width: "third" },
        ],
      },
      {
        fields: [
          {
            handle: "metabolism_not_scored",
            kind: "select",
            label: "Waist not measured because",
            opt: "leave blank unless one applies",
            blankLabel: "Nothing applies",
            options: [
              { key: "pregnant or under six months postpartum", label: "Pregnant, or under six months postpartum" },
              { key: "ostomy or hernia", label: "Ostomy or hernia" },
              { key: "recent abdominal surgery", label: "Recent abdominal surgery" },
              { key: "declined", label: "Declined" },
            ],
          },
        ],
      },
      {
        title: "Glucose sensor",
        note: "A learning demonstration. Recorded, never scored.",
        fields: [
          { handle: "wearing_a_cgm", kind: "toggle", label: "Wearing the glucose sensor?" },
          { handle: "average_glucose", kind: "number", label: "Sensor reading", unit: "mg/dL", min: 40, max: 400, placeholder: "95", showIf: (i) => i.wearing_a_cgm === true },
        ],
      },
    ],
    derived: [
      {
        handle: "waist_height",
        label: "Waist ÷ height",
        placeholder: "0.——",
        hint: "You measure. We divide. Same units both sides, and the ratio never lies.",
        compute: (i) => {
          const w = num(i.waist_at_navel);
          const h = num(i.height);
          return w !== null && h !== null && h > 0 ? (w / h).toFixed(2) : null;
        },
      },
    ],
    complete: (i) =>
      has(i.metabolism_not_scored) ||
      (num(i.waist_at_navel) !== null &&
        num(i.height) !== null &&
        num(i.fibre_grains) !== null &&
        num(i.fibre_fruit_veg) !== null &&
        num(i.fibre_legumes) !== null),
    derivePayload: (i) => ({ wearing_a_cgm: i.wearing_a_cgm === true && num(i.average_glucose) !== null }),
  },
  {
    id: "evidence",
    numeral: "IV",
    order: 4,
    name: "Evidence",
    metric: "Body fat",
    shortMetric: "Evidence",
    color: "blue",
    tagline: "What the scan says.",
    stepTitle: "The protocol",
    howTo: [
      "InBody scan, as displayed, to one decimal.",
      "Not measured with a pacemaker or ICD, or in pregnancy.",
      "Ask the weight-loss question.",
    ],
    form: { handle: "protocol_iv_evidence" },
    notScored: "evidence_not_scored",
    groups: [
      {
        fields: [
          { handle: "body_fat_percentage", kind: "number", label: "Body fat percentage", unit: "%", min: 2, max: 70, step: 0.1, placeholder: "31.5" },
          { handle: "weight_loss", kind: "toggle", label: "Lost more than 5% of body weight in the last 6 to 12 months without trying" },
          {
            handle: "evidence_not_scored",
            kind: "select",
            label: "Body fat not measured because",
            opt: "leave blank unless one applies",
            blankLabel: "Nothing applies",
            options: [
              { key: "pacemaker or ICD", label: "Pacemaker or ICD" },
              { key: "pregnant", label: "Pregnant" },
              { key: "declined", label: "Declined" },
            ],
          },
        ],
      },
    ],
    complete: (i) => num(i.body_fat_percentage) !== null || has(i.evidence_not_scored),
    derivePayload: (i) => ({ at_the_inbody_station: num(i.body_fat_percentage) !== null }),
  },
  {
    id: "mindset",
    numeral: "V",
    order: 5,
    name: "Mindset",
    metric: "WHO-5 + connection",
    shortMetric: "Mindset",
    color: "lavender",
    tagline: "How the last two weeks actually felt.",
    stepTitle: "The protocol",
    howTo: [
      "Think about the past two weeks.",
      "Rate each WHO-5 statement from 0 (at no time) to 5 (all of the time).",
      "Then three questions about connection. Answer honestly — no one grades this but you.",
    ],
    form: { handle: "protocol_v_mindset" },
    notScored: "mindset_not_scored",
    groups: [
      {
        title: "Wellbeing (WHO-5)",
        fields: WHO5.map(([handle, label]) => ({ handle, kind: "scale" as const, label, options: WHO5_SCALE, scaleLabels: ["At no time", "All of the time"] as [string, string] })),
      },
      {
        title: "Social connection",
        fields: UCLA.map(([handle, label]) => ({ handle, kind: "scale" as const, label, options: UCLA_SCALE, scaleLabels: ["Hardly ever", "Often"] as [string, string] })),
      },
      {
        fields: [
          {
            handle: "mindset_not_scored",
            kind: "select",
            label: "Mindset not scored because",
            opt: "leave blank unless the guest declined",
            blankLabel: "Nothing applies",
            options: [{ key: "declined", label: "Declined" }],
          },
        ],
      },
    ],
    complete: (i) => has(i.mindset_not_scored) || [...WHO5, ...UCLA].every(([handle]) => has(i[handle])),
  },
];

export const protocolsConfig: ProtocolsConfig = {
  version: "2.0.0",
  protocols,
};

export const protocolById = (id: string, config: ProtocolsConfig = protocolsConfig) => config.protocols.find((p) => p.id === id);
