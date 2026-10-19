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
  session: boolean;
  first_name: string;
  email: string;
  age: number | null;
  one_word: string;
  promotional_email_agreement: string[];
  data_consent: string[];
};

/** Body for POST api/form/protocol_*\/submit, keyed by that protocol form's field handles. */
export type ProtocolSubmissionPayload = Record<string, string | number | boolean>;

export type SubmitResult =
  | { ok: true; token: string | null }
  | { ok: false; message: string; fieldErrors: Record<string, string> };

// `{{base_url}}` from the API list, e.g. http://127.0.0.1:8010/
const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

export const LEAD_FORM = "lead_form";

export const endpoints = {
  protocols: "api/collections/protocols/entries",
  // lead_form, protocol_i_nervous_system … protocol_v_mindset (handles come from each protocol entry's form_field)
  form: (handle: string) => `api/forms/${encodeURIComponent(handle)}`,
  submitForm: (handle: string) => `api/form/${encodeURIComponent(handle)}/submit`,
};

export function apiConfigured() {
  return BASE_URL.length > 0;
}

export function apiUrl(path: string) {
  return `${BASE_URL}/${path.replace(/^\/+/, "")}`;
}

// GETs run on the Next.js server (see ./content.ts), so they never appear in the browser's
// Network tab; in dev they're logged to the `next dev` terminal instead.
async function getData<T>(path: string): Promise<T> {
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
  const body = (await res.json()) as { data: T };
  return body.data;
}

export const getLeadForm = () => getData<StatamicForm>(endpoints.form(LEAD_FORM));
export const getProtocols = () => getData<StatamicProtocolEntry[]>(endpoints.protocols);
export const getForm = (handle: string) => getData<StatamicForm>(endpoints.form(handle));

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
    | { token?: string; message?: string; errors?: Record<string, string[] | string> }
    | null;
  if (res.ok) return { ok: true, token: typeof body?.token === "string" ? body.token : null };

  if (res.status === 422 && body?.errors) {
    const fieldErrors = Object.fromEntries(
      Object.entries(body.errors).map(([handle, messages]) => [
        handle,
        Array.isArray(messages) ? messages[0] : String(messages),
      ]),
    );
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, message: "Your session has expired. Start again from the intake screen.", fieldErrors: {} };
  }
  if (res.status === 429) {
    return { ok: false, message: "Too many attempts. Please wait a minute and try again.", fieldErrors: {} };
  }
  return { ok: false, message: "We couldn't save your answers. Please try again.", fieldErrors: {} };
}
