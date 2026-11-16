// Maps Statamic responses onto the app's types. The static protocol definitions stay the
// source of which fields a station enters; the CMS supplies copy: protocol titles, taglines,
// how-to steps, field labels and option wording.
import type {
  DomainId,
  FieldSpec,
  LabelText,
  LeadConsentField,
  LeadFormContent,
  LeadTextField,
  Participant,
  Protocol,
  ProtocolCopy,
  ProtocolsConfig,
  Sex,
} from "@/lib/types";
import type { LeadSubmissionPayload, StatamicField, StatamicForm, StatamicProtocolEntry } from "./statamic";

// The protocol blueprint's `domain` select → the app's domain ids ("recovery" was the prototype's name for Mindset).
const DOMAIN_IDS: Record<string, DomainId> = {
  nervous: "nervous",
  movement: "movement",
  metabolism: "metabolism",
  evidence: "evidence",
  mindset: "mindset",
  recovery: "mindset",
};

// lead_form blueprint handle → participant field, for showing server validation errors.
export const leadFieldByHandle: Record<string, keyof Participant> = {
  session: "phase",
  first_name: "firstName",
  email: "email",
  age: "age",
  sex: "sex",
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

const isRequired = (field: StatamicField) => Boolean(field.validate?.includes("required"));

function options(field: StatamicField | undefined) {
  if (!field?.options) return null;
  const list = Array.isArray(field.options)
    ? field.options
    : Object.entries(field.options).map(([key, value]) => ({ key, value }));
  return list.length ? list.map((o) => ({ key: String(o.key), label: text(o.value, String(o.key)) })) : null;
}

/** The CMS wording for one field: label, hint and option labels (keyed by the app's option keys). */
function fieldCopy(field: FieldSpec, form: StatamicForm | undefined): NonNullable<ProtocolCopy["fields"]>[string] | null {
  const cms = form?.fields[field.handle];
  if (!cms) return null;
  const label = splitLabel(cms.display, { label: field.label, opt: field.opt });
  const copy: NonNullable<ProtocolCopy["fields"]>[string] = { label: label.label, opt: label.opt, hint: cms.instructions?.trim() || undefined };
  // The units radio's CMS values are codes ("IN", "CM"); the app's words stay.
  const cmsOptions = field.kind === "units" ? null : options(cms);
  if (cmsOptions && field.options) {
    copy.options = Object.fromEntries(
      field.options.flatMap((o) => {
        const match = cmsOptions.find((c) => c.key === o.key);
        // A CMS option labelled with its own key ("3" → "3") says nothing; keep the app's wording.
        return match && match.label !== o.key ? [[o.key, match.label]] : [];
      }),
    );
  }
  return copy;
}

/** Server side: the CMS copy for a protocol (serialisable), from its entry and its form. */
export function protocolCopy(protocol: Protocol, entry?: StatamicProtocolEntry, form?: StatamicForm): ProtocolCopy {
  const copy: ProtocolCopy = {};
  if (entry) {
    const howTo = (entry.how_to ?? []).filter((step) => step?.trim());
    if (entry.numeral?.trim()) copy.numeral = entry.numeral.trim();
    if (Number.isFinite(entry.order)) copy.order = entry.order as number;
    // "Protocol I · Nervous System" → "Nervous System"
    if (entry.title?.includes("·")) copy.name = text(entry.title.split("·").pop(), protocol.name);
    if (entry.tagline_bold?.trim()) copy.metric = entry.tagline_bold.trim();
    if (entry.tagline_small?.trim()) copy.tagline = entry.tagline_small.trim();
    if (entry.step_title?.trim()) copy.stepTitle = entry.step_title.trim();
    if (howTo.length) copy.howTo = howTo;
    if (entry.form_field) copy.formHandle = entry.form_field.handle;
  }
  if (form) {
    copy.formHandle = form.handle;
    const fields: NonNullable<ProtocolCopy["fields"]> = {};
    for (const field of protocol.groups.flatMap((g) => g.fields)) {
      const c = fieldCopy(field, form);
      if (c) fields[field.handle] = c;
    }
    if (Object.keys(fields).length) copy.fields = fields;
  }
  return copy;
}

/** Server side: the CMS copy for every protocol, keyed by domain id. */
export function buildProtocolCopy(
  base: ProtocolsConfig,
  entries: StatamicProtocolEntry[],
  forms: Record<string, StatamicForm>,
): Partial<Record<DomainId, ProtocolCopy>> {
  const entryByDomain = new Map<DomainId, StatamicProtocolEntry>();
  for (const entry of entries) {
    const id = entry.domain ? DOMAIN_IDS[entry.domain.value] : undefined;
    if (id) entryByDomain.set(id, entry);
  }
  const out: Partial<Record<DomainId, ProtocolCopy>> = {};
  for (const protocol of base.protocols) {
    const entry = entryByDomain.get(protocol.id);
    const form = forms[entry?.form_field?.handle ?? protocol.form.handle];
    out[protocol.id] = protocolCopy(protocol, entry, form);
  }
  return out;
}

/** Client side: a static protocol with its CMS copy applied; the rules (complete, showIf, readouts) stay the app's. */
export function applyProtocolCopy(protocol: Protocol, copy: ProtocolCopy | undefined): Protocol {
  if (!copy) return protocol;
  return {
    ...protocol,
    numeral: copy.numeral ?? protocol.numeral,
    order: copy.order ?? protocol.order,
    name: copy.name ?? protocol.name,
    metric: copy.metric ?? protocol.metric,
    tagline: copy.tagline ?? protocol.tagline,
    stepTitle: copy.stepTitle ?? protocol.stepTitle,
    howTo: copy.howTo ?? protocol.howTo,
    form: copy.formHandle ? { handle: copy.formHandle } : protocol.form,
    groups: protocy(protocol, copy),
  };
}

function protocy(protocol: Protocol, copy: ProtocolCopy) {
  return protocol.groups.map((group) => ({
    ...group,
    fields: group.fields.map((field) => {
      const c = copy.fields?.[field.handle];
      if (!c) return field;
      return {
        ...field,
        label: c.label ?? field.label,
        opt: c.opt ?? field.opt,
        hint: c.hint ?? field.hint,
        options: field.options?.map((o) => ({ ...o, label: c.options?.[o.key] ?? o.label })),
      };
    }),
  }));
}

export function buildConfig(base: ProtocolsConfig, copy: Partial<Record<DomainId, ProtocolCopy>>): ProtocolsConfig {
  const protocols = base.protocols.map((p) => applyProtocolCopy(p, copy[p.id])).sort((a, b) => a.order - b.order);
  return { ...base, protocols };
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
  };
}

export function mapLeadForm(form: StatamicForm, base: LeadFormContent): LeadFormContent {
  const f = form.fields;
  const sexOptions = options(f.sex);
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
    sex: f.sex
      ? {
          label: text(f.sex.display, base.sex.label),
          options: base.sex.options.map((o) => ({ ...o, label: sexOptions?.find((c) => c.key === o.key)?.label ?? o.label })),
          note: text(f.sex.instructions, base.sex.note),
        }
      : base.sex,
    fearWord: textField(f.one_word, base.fearWord),
    marketingOptIn: consentField(f.promotional_email_agreement, base.marketingOptIn),
    dataConsent: consentField(f.data_consent, base.dataConsent),
  };
}

/** The lead payload; `extras` carries the retest token and first-touch attribution when there are any. */
export function toLeadPayload(p: Participant, extras: Partial<LeadSubmissionPayload> = {}): LeadSubmissionPayload {
  const present = Object.fromEntries(
    Object.entries(extras).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ) as Partial<LeadSubmissionPayload>;
  return {
    // The session radio's option keys on the lead_form blueprint.
    session: p.phase === "week8" ? "Week-8 Retest" : "Baseline",
    first_name: p.firstName.trim(),
    email: p.email.trim(),
    age: p.age,
    ...(p.sex ? { sex: p.sex as Sex } : {}),
    one_word: p.fearWord.trim(),
    promotional_email_agreement: p.marketingOptIn ? 1 : 0,
    data_consent: p.dataConsent ? 1 : 0,
    ...present,
  };
}
