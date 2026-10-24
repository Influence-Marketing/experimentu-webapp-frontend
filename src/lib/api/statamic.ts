// Statamic REST API: raw response shapes, endpoints and fetchers.
// Mapping these shapes onto the app's own types lives in ./mappers.ts.

export type StatamicOption = { key: string | number; value: string | null };

export type StatamicField = {
  handle: string;
  type: string;
  display?: string;
  instructions?: string;
  placeholder?: string;
  append?: string;
  input_type?: string;
  character_limit?: number;
  inline_label?: string;
  inline_label_when_true?: string;
  options?: StatamicOption[] | Record<string, string | null>;
  validate?: string[];
  visibility?: string;
  if?: Record<string, string>;
};

export type StatamicForm = {
  handle: string;
  title: string;
  fields: Record<string, StatamicField>;
};

export type StatamicProtocolEntry = {
  id: string;
  title: string;
  order: number | null;
  numeral: string | null;
  domain: { value: string; label: string } | null;
  tagline_bold: string | null;
  tagline_small: string | null;
  step_title: string | null;
  how_to: string[] | null;
  form_field: { handle: string; title: string; api_url: string } | null;
};

/** Body for POST api/form/lead_form/submit, keyed by the lead_form blueprint handles. */
export type LeadSubmissionPayload = {
  session: "Baseline" | "Week-8 Retest";
  first_name: string;
  email: string;
  age: number | null;
  one_word: string;
  promotional_email_agreement: 0 | 1;
  data_consent: 0 | 1;
  /** Resend after a 409 "already submitted" answer to submit anyway. */
  retest_confirmed?: boolean;
};

/** Body for POST api/form/protocol_*\/submit, keyed by that protocol form's field handles. */
export type ProtocolSubmissionPayload = Record<string, string | number | boolean>;

/** Saved values from GET api/form/protocol_*\/submission, keyed the same way; unanswered fields are null. */
export type ProtocolSubmissionValues = Record<string, string | number | boolean | null>;

/** lead_form's answer when this participant already has a submission; dates are YYYY-MM-DD. */
export type AlreadySubmitted = { submissionDate: string | null; retestDate: string | null };

export type ApiDomainKey = "nervous" | "movement" | "metabolism" | "evidence" | "mindset";

export type ApiMaxBand = { max: number | null; points: number; band: string };
export type ApiMinBand = { min: number; points: number; band: string };
export type ApiBpCategory = {
  id: string;
  band: string;
  points: number;
  rule: { systolicMin?: number; systolicMax?: number; diastolicMin?: number; diastolicMax?: number };
};

/** GET api/scoring-config (not wrapped in `data`), trimmed to what the score page reads. */
export type ApiScoringConfig = {
  version: string;
  cohorts: { set: string; tiers: { min: number; name: string }[] };
  domains: {
    nervous: { label: string; bands: ApiMaxBand[] };
    movement: {
      label: string;
      ageBands: { label: string; minAge: number; maxAge: number; bands: ApiMinBand[] }[];
    };
    metabolism: { label: string; bands: ApiMaxBand[] };
    evidence: { label: string; categories: ApiBpCategory[] };
    mindset: { label: string; multiplier: number; bands: { min: number; band: string }[] };
  };
};

export type ApiDomainScore = {
  points: number;
  band: string | null;
  value: number | string | null;
  max: number;
  percentile: number | null;
};

/** One session (Baseline or Week-8 Retest) of GET api/participants/{id}/score. */
export type ApiSessionScore = {
  date: string | null;
  age: number;
  complete: boolean;
  missing: ApiDomainKey[];
  total: number;
  cohort: string;
  domains: Record<ApiDomainKey, ApiDomainScore>;
  flags: { id: string; domain: ApiDomainKey; severity: string; title: string; message: string }[];
  levers: { domain: ApiDomainKey; label: string; points: number; copy: string }[];
  path_to_next: { cohort: string; points_needed: number } | null;
  config_version: string;
  derived: { age_band?: string; who5_raw?: number; bp_category?: string };
};

/** GET api/participants/{id}/score (not wrapped in `data`). */
export type ApiParticipantScore = {
  participant: { id: number; first_name: string };
  config_version: string;
  baseline: ApiSessionScore | null;
  week_8_retest: ApiSessionScore | null;
  delta_from_baseline: {
    total: number;
    domains: Record<ApiDomainKey, number>;
    baseline_cohort: string | null;
    current_cohort: string | null;
  } | null;
};

export type SubmitResult =
  | { ok: true; token: string | null; participantId: number | null }
  | {
      ok: false;
      message: string;
      fieldErrors: Record<string, string>;
      unauthorized?: boolean;
      alreadySubmitted?: AlreadySubmitted;
      /** Week-8 Retest picked before it opens; carries the opening date (YYYY-MM-DD). */
      retestNotOpen?: { retestDate: string };
    };

// `{{base_url}}` from the API list, e.g. http://127.0.0.1:8010/
const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

export const LEAD_FORM = "lead_form";

export const endpoints = {
  protocols: "api/collections/protocols/entries",
  // lead_form, protocol_i_nervous_system … protocol_v_mindset (handles come from each protocol entry's form_field)
  form: (handle: string) => `api/forms/${encodeURIComponent(handle)}`,
  submitForm: (handle: string) => `api/form/${encodeURIComponent(handle)}/submit`,
  formSubmission: (handle: string) => `api/form/${encodeURIComponent(handle)}/submission`,
  scoringConfig: "api/scoring-config",
  participantScore: (id: number) => `api/participants/${id}/score`,
};

export function apiConfigured() {
  return BASE_URL.length > 0;
}

export function apiUrl(path: string) {
  return `${BASE_URL}/${path.replace(/^\/+/, "")}`;
}

// GETs run on the Next.js server (see ./content.ts), so they never appear in the browser's
// Network tab; in dev they're logged to the `next dev` terminal instead.
async function getJson<T>(path: string): Promise<T> {
  const started = Date.now();
  const res = await fetch(apiUrl(path), {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(10_000),
  });
  if (process.env.NODE_ENV === "development") {
    console.log(`[statamic] GET ${apiUrl(path)} ${res.status} in ${Date.now() - started}ms`);
  }
  if (!res.ok) throw new Error(`GET ${path} responded ${res.status}`);
  return (await res.json()) as T;
}

// Statamic's own endpoints wrap their payload in `data`.
async function getData<T>(path: string): Promise<T> {
  return (await getJson<{ data: T }>(path)).data;
}

export const getLeadForm = () => getData<StatamicForm>(endpoints.form(LEAD_FORM));
export const getProtocols = () => getData<StatamicProtocolEntry[]>(endpoints.protocols);
export const getForm = (handle: string) => getData<StatamicForm>(endpoints.form(handle));
export const getScoringConfig = () => getJson<ApiScoringConfig>(endpoints.scoringConfig);

/** GET api/participants/{id}/score from the browser with the lead token; null when it can't be had. */
export async function getParticipantScore(participantId: number, token: string): Promise<ApiParticipantScore | null> {
  if (!apiConfigured()) return null;
  try {
    const res = await fetch(apiUrl(endpoints.participantScore(participantId)), {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? ((await res.json()) as ApiParticipantScore) : null;
  } catch {
    return null;
  }
}

/**
 * GET api/form/{handle}/submission from the browser with the lead token: what this participant
 * already submitted to that form in the token's session. Null when there is none or it can't be had.
 */
export async function getFormSubmission(handle: string, token: string): Promise<ProtocolSubmissionValues | null> {
  if (!apiConfigured()) return null;
  try {
    const res = await fetch(apiUrl(endpoints.formSubmission(handle)), {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { submission?: { values?: ProtocolSubmissionValues } | null };
    return body.submission?.values ?? null;
  } catch {
    return null;
  }
}

/**
 * POST {{base_url}}api/form/{handle}/submit from the browser. Sent as JSON rather than the
 * Postman form-data so toggles arrive as real booleans ("false" in form-data casts to true).
 */
export async function submitForm(
  handle: string,
  payload: LeadSubmissionPayload | ProtocolSubmissionPayload,
  token?: string | null,
): Promise<SubmitResult> {
  if (!apiConfigured()) {
    return { ok: false, message: "The API isn't configured (NEXT_PUBLIC_API_BASE_URL).", fieldErrors: {} };
  }
  let res: Response;
  try {
    res = await fetch(apiUrl(endpoints.submitForm(handle)), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, message: "We couldn't reach the server. Check your connection and try again.", fieldErrors: {} };
  }

  const body = (await res.json().catch(() => null)) as
    | {
        token?: string;
        participant_id?: number | string;
        message?: string;
        errors?: Record<string, string[] | string>;
        requires_confirmation?: boolean;
        submission_date?: string;
        retest_week_8_date?: string;
      }
    | null;
  // Checked before res.ok: the "already submitted" answer is identified by its body, not its status.
  if (body?.requires_confirmation) {
    return {
      ok: false,
      message: body.message ?? "You've already submitted.",
      fieldErrors: {},
      alreadySubmitted: {
        submissionDate: body.submission_date ?? null,
        retestDate: body.retest_week_8_date ?? null,
      },
    };
  }
  // Week-8 Retest before it opens: a 422 on `session` that carries the opening date.
  if (res.status === 422 && body?.retest_week_8_date && body.errors?.session) {
    return {
      ok: false,
      message: body.message ?? "Your Week-8 retest isn't open yet.",
      fieldErrors: {},
      retestNotOpen: { retestDate: body.retest_week_8_date },
    };
  }
  if (res.ok) {
    const participantId = body?.participant_id != null ? Number(body.participant_id) : NaN;
    return {
      ok: true,
      token: typeof body?.token === "string" ? body.token : null,
      participantId: Number.isFinite(participantId) ? participantId : null,
    };
  }

  if (res.status === 422 && body?.errors) {
    const fieldErrors = Object.fromEntries(
      Object.entries(body.errors).map(([handle, messages]) => [
        handle,
        Array.isArray(messages) ? messages[0] : String(messages),
      ]),
    );
    // Laravel's generic summary says nothing; a specific one (e.g. the Week-8 opening date) does.
    const specific = body.message && body.message !== "The given data was invalid." ? body.message : null;
    return { ok: false, message: specific ?? "Please check the highlighted fields.", fieldErrors };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      message: "Your session has expired. Start again from the intake screen.",
      fieldErrors: {},
      unauthorized: true,
    };
  }
  if (res.status === 429) {
    return { ok: false, message: "Too many attempts. Please wait a minute and try again.", fieldErrors: {} };
  }
  return { ok: false, message: "We couldn't save your answers. Please try again.", fieldErrors: {} };
}
