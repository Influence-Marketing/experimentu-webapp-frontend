"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useContent } from "@/components/ContentProvider";
import { ScoreReveal } from "@/components/ScoreReveal";
import { useFlow } from "@/components/FlowProvider";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { apiScorePatch } from "@/lib/api/score";
import { getParticipantScore, LEAD_FORM } from "@/lib/api/statamic";
import { updateEntry } from "@/lib/storage";
import type { Entry } from "@/lib/types";

export default function ScorePage() {
  const router = useRouter();
  const { ready, currentEntry, flow, completeProtocols } = useFlow();
  const { config, scoring } = useContent();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  // Protocols submitted since the last intake, so /score can be opened before all five are done.
  const lead = flow.submissions[LEAD_FORM];
  const inSession =
    lead != null && config.domains.some((d) => (flow.submissions[d.form.handle]?.submittedAt ?? "") > lead.submittedAt);

  // Once per visit: rescore this session from what has been submitted so far, then show the scoring
  // API's result for it, kept on the entry so the report shows the same numbers. This page shows
  // only the API's score: without it (API, token, id or session missing) it says so.
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const target = inSession ? completeProtocols() : currentEntry;
    if (!target) {
      router.replace("/");
      return;
    }
    const participantId = target.participantId;
    // The scoring config only feeds the report's next-step moves; the response carries its own scale.
    if (!flow.authToken || participantId == null) {
      setFailed(true);
      return;
    }
    getParticipantScore(participantId, flow.authToken).then((api) => {
      const patch = api ? apiScorePatch(target, api, scoring, config) : null;
      if (!patch) {
        setFailed(true);
        return;
      }
      updateEntry(target.id, patch);
      setEntry({ ...target, ...patch });
    });
  }, [ready, inSession, completeProtocols, currentEntry, scoring, config, flow.authToken, router]);

  if (!ready || (!currentEntry && !inSession)) return null;

  return (
    <AppShell>
      <LoadingOverlay show={!entry && !failed} label="Calculating your U Score™" />
      {entry ? (
        <ScoreReveal entry={entry} />
      ) : failed ? (
        <div className="form-error" role="alert" style={{ textAlign: "center" }}>
          We couldn&apos;t load your U Score™ from the server. Check your connection and{" "}
          <button type="button" className="back-link" onClick={() => window.location.reload()}>
            try again
          </button>
          .
        </div>
      ) : null}
    </AppShell>
  );
}
