// Server-side: loads every GET endpoint into serialisable copy for the client, which merges
// it over the static protocol definitions (ContentProvider). Anything that fails to load
// falls back to the static copy for that piece only.
import { leadFormConfig } from "@/lib/lead-form-config";
import { protocolsConfig } from "@/lib/protocols";
import type { SiteContent } from "@/lib/types";
import { buildProtocolCopy, mapLeadForm } from "./mappers";
import {
  apiConfigured,
  getForm,
  getLeadForm,
  getProtocols,
  getScoringConfig,
  type StatamicForm,
} from "./statamic";

export const staticContent: SiteContent = {
  version: protocolsConfig.version,
  protocolCopy: {},
  leadForm: leadFormConfig,
  source: "static",
  scoring: null,
};

export async function getSiteContent(): Promise<SiteContent> {
  if (!apiConfigured()) return staticContent;

  const [leadForm, protocols, scoring] = await Promise.allSettled([
    getLeadForm(),
    getProtocols(),
    getScoringConfig(),
  ]);
  const entries = protocols.status === "fulfilled" ? protocols.value : [];
  // Every protocol form: the handles the CMS entries name, plus the app's own, so labels load either way.
  const handles = [
    ...new Set([
      ...entries.flatMap((e) => (e.form_field ? [e.form_field.handle] : [])),
      ...protocolsConfig.protocols.map((p) => p.form.handle),
    ]),
  ];
  const formResults = await Promise.allSettled(handles.map(getForm));

  const forms: Record<string, StatamicForm> = {};
  formResults.forEach((r, i) => {
    if (r.status === "fulfilled") forms[handles[i]] = r.value;
  });
  for (const r of [leadForm, protocols, scoring, ...formResults]) {
    if (r.status === "rejected") console.warn("[statamic] falling back to static content:", r.reason);
  }
  const apiScoring = scoring.status === "fulfilled" ? scoring.value : null;
  if (leadForm.status === "rejected" && protocols.status === "rejected" && !Object.keys(forms).length) {
    return { ...staticContent, scoring: apiScoring };
  }

  return {
    version: protocolsConfig.version,
    protocolCopy: buildProtocolCopy(protocolsConfig, entries, forms),
    leadForm: leadForm.status === "fulfilled" ? mapLeadForm(leadForm.value, leadFormConfig) : leadFormConfig,
    source: "cms",
    scoring: apiScoring,
  };
}
