// First-touch lead source: UTM parameters, the external referrer and the event
// id from the URL the guest arrived on, kept on this device until a lead is
// sent. Later visits only fill blanks, so the first touch wins.

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  event_id?: string;
};

const KEY = "u-score-attribution-v1";
const MAX = 120;

const clean = (value: string | null | undefined) => {
  const v = (value ?? "").trim().slice(0, MAX);
  return v ? v : undefined;
};

export function loadAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}

/** Reads the current URL and referrer once per visit and merges them under what was stored first. */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  let referrer: string | undefined;
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    referrer = ref && ref.origin !== window.location.origin ? clean(ref.href.slice(0, 500)) : undefined;
  } catch {
    referrer = undefined;
  }
  const fresh: Attribution = {
    utm_source: clean(params.get("utm_source")),
    utm_medium: clean(params.get("utm_medium")),
    utm_campaign: clean(params.get("utm_campaign")),
    referrer,
    event_id: clean(params.get("event") ?? params.get("event_id")),
  };
  const stored = loadAttribution();
  const merged: Attribution = { ...stored };
  for (const key of Object.keys(fresh) as (keyof Attribution)[]) {
    if (!merged[key] && fresh[key]) merged[key] = fresh[key];
  }
  try {
    if (Object.values(merged).some(Boolean)) localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // Storage may be unavailable (private mode); attribution is best effort.
  }
  return merged;
}

export function clearAttribution() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
