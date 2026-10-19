// Maps Statamic responses onto the app's types. The static config stays the source of
// scoring rules (bands, ranges, keys); the CMS supplies copy, labels, units and structure.
import { scoreDomain } from "@/lib/scoring";
import type {
  BpInput,
  BpReading,
  Domain,
  DomainId,
  DomainInputState,
  DomainUpgrade,
  LabelText,
  LeadConsentField,
  LeadFormContent,
  LeadTextField,
  NumberInput,
  Participant,
  ProtocolFormFields,
  ReadingsInput,
  ScoringConfig,
  WaistHeightInput,
  Who5Input,
} from "@/lib/types";
import type {
  LeadSubmissionPayload,
  ProtocolSubmissionPayload,
  StatamicField,
  StatamicForm,
  StatamicProtocolEntry,
} from "./statamic";

// The protocol blueprint's `domain` select → the app's domain ids.
const DOMAIN_IDS: Record<string, DomainId> = {
  nervous: "nervous",
  movement: "movement",
  metabolism: "metabolism",
  evidence: "evidence",
  mindset: "recovery",
};

// lead_form blueprint handle → participant field, for showing server validation errors.
export const leadFieldByHandle: Record<string, keyof Participant> = {
  session: "phase",
  first_name: "firstName",
  email: "email",
  age: "age",
  one_word: "fearWord",
  promotional_email_agreement: "marketingOptIn",
  data_consent: "dataConsent",
};

function text(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

/** "Email — for your sealed report" → { label: "Email", opt: "for your sealed report" } */
export function splitLabel(display: string | undefined, fallback: LabelText): LabelText {
  if (!display?.trim()) return fallback;
  const [label, ...rest] = display.split(/\s+[—–]\s+/);
  const opt = rest.join(" — ").trim();
  return opt ? { label: label.trim(), opt } : { label: label.trim() };
}

// The CMS appends units in caps ("BPM"); keep the config's casing when it's the same unit.
function unit(append: string | undefined, fallback: string) {
  if (!append?.trim()) return fallback;
  return append.trim().toLowerCase() === fallback.toLowerCase() ? fallback : append.trim();
}

const isRequired = (field: StatamicField) => Boolean(field.validate?.includes("required"));

function firstOptionKey(field: StatamicField) {
  const { options } = field;
  if (Array.isArray(options)) return options.length ? String(options[0].key) : null;
  return options ? (Object.keys(options)[0] ?? null) : null;
}

/** Optional captures are a toggle plus a field shown `if: { <toggle>: "equals true" }`. */
function findUpgrade(form: StatamicForm) {
  for (const field of Object.values(form.fields)) {
    const toggle = field.if ? form.fields[Object.keys(field.if)[0]] : undefined;
    if (toggle?.type === "toggle") return { toggle, field };
  }
  return null;
}

// Returns the CMS-labelled input spec plus the field handles each input is submitted under.
function applyInput(
  domain: Domain,
  form: StatamicForm,
  skip: StatamicField[],
): { input: Domain["input"]; fields: ProtocolFormFields } {
  const fields = Object.values(form.fields).filter((f) => !skip.includes(f));
  const numeric = fields.filter(
    (f) => f.type === "text" && f.input_type === "number" && f.visibility !== "computed",
  );
  const computed = fields.find((f) => f.visibility === "computed");
  const unchanged = { input: domain.input, fields: domain.form.fields };

  switch (domain.inputType) {
    case "readings": {
      const spec = domain.input as ReadingsInput;
      if (!numeric.length) return unchanged;
      const readingLabels = numeric.map((f, i) =>
        splitLabel(f.display, { label: `${spec.readingLabel} ${i + 1}` }),
      );
      return {
        input: {
          ...spec,
          readingLabel: readingLabels[0].label.replace(/\s*\d+$/, "") || spec.readingLabel,
          readingLabels,
          minReadings: Math.max(1, numeric.filter(isRequired).length),
          maxReadings: numeric.length,
          unit: unit(numeric[0].append, spec.unit),
          averageLabel: text(computed?.display, spec.averageLabel),
        },
        fields: { readings: numeric.map((f) => f.handle), derived: computed?.handle },
      };
    }
    case "number": {
      const spec = domain.input as NumberInput;
      const field = numeric[0];
      if (!field) return unchanged;
      return {
        input: { ...spec, label: text(field.display, spec.label), unit: unit(field.append, spec.unit) },
        fields: { value: field.handle },
      };
    }
    case "waist-height": {
      const spec = domain.input as WaistHeightInput;
      const waist = numeric.find((f) => f.handle.includes("waist"));
      const height = numeric.find((f) => f !== waist && f.handle.includes("height"));
      const units = fields.find((f) => f.type === "toggle");
      const readout = fields.find((f) => f.type === "text" && !f.input_type) ?? computed;
      const known = domain.form.fields;
      return {
        input: {
          ...spec,
          unitsLabel: text(units?.display, spec.unitsLabel),
          unitLabels: [
            text(units?.inline_label, spec.unitLabels[0]),
            text(units?.inline_label_when_true, spec.unitLabels[1]),
          ],
          waist: { ...spec.waist, label: text(waist?.display, spec.waist.label) },
          height: { ...spec.height, label: text(height?.display, spec.height.label) },
          ratioLabel: text(readout?.display, spec.ratioLabel),
          hint: text(readout?.instructions, spec.hint),
        },
        fields: {
          units: units?.handle ?? known.units,
          waist: waist?.handle ?? known.waist,
          height: height?.handle ?? known.height,
          derived: readout?.handle ?? known.derived,
        },
      };
    }
    case "bp-readings": {
      const spec = domain.input as BpInput;
      const readings = new Map<number, { sys?: StatamicField; dia?: StatamicField }>();
      for (const f of numeric) {
        const match = f.handle.match(/(\d+)_(sys|dia)$/);
        if (!match) continue;
        const n = Number(match[1]);
        readings.set(n, { ...readings.get(n), [match[2]]: f });
      }
      const rows = [...readings.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, r]) => r)
        .filter((r): r is { sys: StatamicField; dia: StatamicField } => Boolean(r.sys && r.dia));
      if (!rows.length) return unchanged;
      return {
        input: {
          ...spec,
          readingLabels: rows.map((r, i) => splitLabel(r.sys.display, { label: `Reading ${i + 1}` })),
          minReadings: Math.max(1, rows.filter((r) => isRequired(r.sys)).length),
          maxReadings: rows.length,
          averageLabel: text(computed?.display, spec.averageLabel),
          hint: text(computed?.instructions, spec.hint),
          systolic: { ...spec.systolic, unit: unit(rows[0].sys.append, spec.systolic.unit) },
          diastolic: { ...spec.diastolic, unit: unit(rows[0].dia.append, spec.diastolic.unit) },
        },
        fields: {
          bp: rows.map((r) => ({ systolic: r.sys.handle, diastolic: r.dia.handle })),
          derived: computed?.handle,
        },
      };
    }
    case "who5": {
      const spec = domain.input as Who5Input;
      const radios = fields.filter((f) => f.type === "radio");
      if (!radios.length) return unchanged;
      const keys = Array.isArray(radios[0].options)
        ? radios[0].options.map((o) => Number(o.key)).filter(Number.isFinite)
        : [];
      return {
        input: {
          ...spec,
          // "01 I have felt cheerful…" — the screen renders its own numbering
          statements: radios.map((f, i) => text(f.display?.replace(/^\d+[.)]?\s+/, ""), spec.statements[i] ?? "")),
          scaleMin: keys.length ? Math.min(...keys) : spec.scaleMin,
          scaleMax: keys.length ? Math.max(...keys) : spec.scaleMax,
        },
        fields: { answers: radios.map((f) => f.handle) },
      };
    }
    default:
      return unchanged;
  }
}

function applyUpgrade(
  upgrade: DomainUpgrade | null,
  found: ReturnType<typeof findUpgrade>,
): DomainUpgrade | null {
  // No capture in the CMS form hides it; a capture with no config key has nowhere to be stored.
  if (!found || !upgrade) return null;
  return {
    ...upgrade,
    prompt: text(found.toggle.display, upgrade.prompt),
    label: text(found.field.display, upgrade.label),
    unit: unit(found.field.append, upgrade.unit),
    note: text(found.field.instructions, upgrade.note),
  };
}

export function applyProtocol(domain: Domain, entry?: StatamicProtocolEntry, form?: StatamicForm): Domain {
  let next = domain;
  if (entry) {
    const howTo = (entry.how_to ?? []).filter((step) => step?.trim());
    next = {
      ...next,
      numeral: text(entry.numeral, next.numeral),
      order: Number.isFinite(entry.order) ? (entry.order as number) : next.order,
      // "Protocol I · Nervous System" → "Nervous System"
      name: entry.title?.includes("·") ? text(entry.title.split("·").pop(), next.name) : next.name,
      metric: text(entry.tagline_bold, next.metric),
      tagline: text(entry.tagline_small, next.tagline),
      stepTitle: text(entry.step_title, next.stepTitle),
      howTo: howTo.length ? howTo : next.howTo,
    };
  }
  if (form) {
    const upgrade = findUpgrade(form);
    const skip = upgrade ? [upgrade.toggle, upgrade.field] : [];
    const { input, fields } = applyInput(next, form, skip);
    next = {
      ...next,
      input,
      upgrade: applyUpgrade(next.upgrade, upgrade),
      form: {
        handle: form.handle,
        fields: { ...fields, upgradeToggle: upgrade?.toggle.handle, upgrade: upgrade?.field.handle },
      },
    };
  } else if (entry?.form_field) {
    next = { ...next, form: { ...next.form, handle: entry.form_field.handle } };
  }
  return next;
}

/** Inputs for one protocol, keyed by its Statamic form handles. Empty optional fields are left out. */
export function toProtocolPayload(
  domain: Domain,
  inputs: DomainInputState,
  upgradeValue: number | null,
  participant: Participant,
): ProtocolSubmissionPayload {
  const f = domain.form.fields;
  const out: ProtocolSubmissionPayload = {};
  const put = (handle: string | undefined, value: unknown) => {
    if (!handle) return;
    if (typeof value === "boolean" || typeof value === "string" || Number.isFinite(value)) {
      out[handle] = value as string | number | boolean;
    }
  };

  f.readings?.forEach((handle, i) => put(handle, (inputs.readings as Array<number | null> | undefined)?.[i]));
  put(f.value, inputs.value);
  f.bp?.forEach((row, i) => {
    const reading = (inputs.readings as BpReading[] | undefined)?.[i];
    put(row.systolic, reading?.systolic);
    put(row.diastolic, reading?.diastolic);
  });
  if (f.units) put(f.units, (inputs.unit ?? (domain.input as WaistHeightInput).defaultUnit) === "cm");
  put(f.waist, inputs.waist);
  put(f.height, inputs.height);
  f.answers?.forEach((handle, i) => put(handle, inputs.answers?.[i]));
  // Readings average, "sys/dia" or waist ÷ height, exactly as the screen shows it.
  put(f.derived, scoreDomain(domain, inputs, participant)?.value);
  if (f.upgradeToggle) put(f.upgradeToggle, upgradeValue != null);
  put(f.upgrade, upgradeValue);
  return out;
}

export function buildConfig(
  base: ScoringConfig,
  entries: StatamicProtocolEntry[],
  forms: Record<string, StatamicForm>,
): ScoringConfig {
  const entryByDomain = new Map<DomainId, StatamicProtocolEntry>();
  for (const entry of entries) {
    const id = entry.domain ? DOMAIN_IDS[entry.domain.value] : undefined;
    if (id) entryByDomain.set(id, entry);
  }
  const domains = base.domains
    .map((domain) => {
      const entry = entryByDomain.get(domain.id);
      const form = entry?.form_field ? forms[entry.form_field.handle] : undefined;
      return applyProtocol(domain, entry, form);
    })
    .sort((a, b) => a.order - b.order);
  return { ...base, domains };
}

function textField(field: StatamicField | undefined, fallback: LeadTextField): LeadTextField {
  if (!field) return fallback;
  const { label, opt } = splitLabel(field.display, fallback);
  return {
    label,
    opt,
    placeholder: text(field.placeholder, fallback.placeholder),
    maxLength: field.character_limit ?? fallback.maxLength,
    note: field.instructions?.trim() || fallback.note,
  };
}

function consentField(field: StatamicField | undefined, fallback: LeadConsentField): LeadConsentField {
  if (!field) return fallback;
  return {
    // `display` is the CP name ("Data Consent"); the guest-facing sentence lives in instructions
    text: text(field.instructions, fallback.text),
    required: isRequired(field),
    value: firstOptionKey(field) ?? fallback.value,
  };
}

export function mapLeadForm(form: StatamicForm, base: LeadFormContent): LeadFormContent {
  const f = form.fields;
  return {
    session: f.session
      ? {
          label: text(f.session.display, base.session.label),
          baselineLabel: text(f.session.inline_label, base.session.baselineLabel),
          week8Label: text(f.session.inline_label_when_true, base.session.week8Label),
        }
      : base.session,
    firstName: textField(f.first_name, base.firstName),
    email: textField(f.email, base.email),
    age: textField(f.age, base.age),
    fearWord: textField(f.one_word, base.fearWord),
    marketingOptIn: consentField(f.promotional_email_agreement, base.marketingOptIn),
    dataConsent: consentField(f.data_consent, base.dataConsent),
  };
}

export function toLeadPayload(p: Participant, lead: LeadFormContent): LeadSubmissionPayload {
  return {
    session: p.phase === "week8",
    first_name: p.firstName.trim(),
    email: p.email.trim(),
    age: p.age,
    one_word: p.fearWord.trim(),
    promotional_email_agreement: p.marketingOptIn ? [lead.marketingOptIn.value] : [],
    data_consent: p.dataConsent ? [lead.dataConsent.value] : [],
  };
}
