"use client";

import { createContext, useContext } from "react";
import { leadFormConfig } from "@/lib/lead-form-config";
import { scoringConfig } from "@/lib/scoring-config";
import type { SiteContent } from "@/lib/types";

const ContentContext = createContext<SiteContent>({
  config: scoringConfig,
  leadForm: leadFormConfig,
  source: "static",
});

export function ContentProvider({ content, children }: { content: SiteContent; children: React.ReactNode }) {
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export function useContent() {
  return useContext(ContentContext);
}
