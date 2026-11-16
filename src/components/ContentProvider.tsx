"use client";

import { createContext, useContext, useMemo } from "react";
import { buildConfig } from "@/lib/api/mappers";
import { leadFormConfig } from "@/lib/lead-form-config";
import { protocolsConfig } from "@/lib/protocols";
import type { ResolvedContent, SiteContent } from "@/lib/types";

const fallback: ResolvedContent = {
  version: protocolsConfig.version,
  protocolCopy: {},
  config: protocolsConfig,
  leadForm: leadFormConfig,
  source: "static",
  scoring: null,
};

const ContentContext = createContext<ResolvedContent>(fallback);

/** Merges the server-loaded CMS copy over the static protocol definitions, rules included. */
export function ContentProvider({ content, children }: { content: SiteContent; children: React.ReactNode }) {
  const value = useMemo<ResolvedContent>(() => ({ ...content, config: buildConfig(protocolsConfig, content.protocolCopy) }), [content]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  return useContext(ContentContext);
}
