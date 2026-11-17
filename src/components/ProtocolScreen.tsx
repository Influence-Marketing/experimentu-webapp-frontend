"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getFormSubmission, LEAD_FORM, submitForm } from "@/lib/api/statamic";
import { fromProtocolValues, rangeIssues, toProtocolPayload } from "@/lib/fields";
import { intakeComplete } from "@/lib/storage";
import type { DomainId } from "@/lib/types";
import { useContent } from "./ContentProvider";
import { useFlow } from "./FlowProvider";
import { DomainFields } from "./DomainInputs";
import { LoadingOverlay } from "./LoadingOverlay";
import { SubmissionNoticeDialog, type SubmissionNotice } from "./SubmissionNoticeDialog";

export function ProtocolScreen({ domainId }: { domainId: DomainId }) {
  const router = useRouter();
  const { config } = useContent();
  const { flow, setDomainInputs, markSubmitted, clearAuthToken, ready } = useFlow();
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<SubmissionNotice | null>(null);
  const index = config.protocols.findIndex((p) => p.id === domainId);
  const protocol = config.protocols[index];
  const n = index + 1;
  const total = config.protocols.length;
  const inputs = useMemo(() => flow.inputs[protocol.id] || {}, [flow.inputs, protocol.id]);
  const issues = useMemo(() => rangeIssues(protocol, inputs), [protocol, inputs]);
  const notScored = protocol.notScored ? inputs[protocol.notScored] : null;
  const canContinue = useMemo(() => protocol.complete(inputs) && issues.length === 0, [protocol, inputs, issues]);

  const allowed = intakeComplete(flow.participant) && flow.submissions[LEAD_FORM] != null;

  useEffect(() => {
    if (ready && !allowed) router.replace("/");
  }, [ready, allowed, router]);

  // Prefill with what this token already submitted to this protocol in its session, unless the
  // guest starts editing before the answer arrives.
  const edited = useRef(false);
  const [prefilling, setPrefilling] = useState(false);
  useEffect(() => {
    if (!ready || !allowed || !flow.authToken) return;
    edited.current = false;
    let cancelled = false;
    setPrefilling(true);
    getFormSubmission(protocol.form.handle, flow.authToken).then((values) => {
      if (cancelled) return;
      setPrefilling(false);
      if (!values || edited.current) return;
      setDomainInputs(protocol.id, fromProtocolValues(protocol, values));
    });
    return () => {
      cancelled = true;
    };
  }, [ready, allowed, flow.authToken, protocol, setDomainInputs]);

  if (!ready || !allowed) return null;

  const goBack = () => {
    if (index === 0) router.push("/");
    else router.push(`/protocol/${index}`);
  };

  const goNext = async () => {
    const payload = toProtocolPayload(protocol, inputs);
    setSubmitting(true);
    setNotice(null);
    const result = await submitForm(protocol.form.handle, payload, flow.authToken);
    setSubmitting(false);
    if (!result.ok) {
      if (result.unauthorized) clearAuthToken();
      // The API's validation messages go in the popup; anything else shows its own message there.
      const details = [...new Set(Object.values(result.fieldErrors))];
      setNotice({
        kind: details.length ? "invalid" : "failed",
        message: details.length ? "Fix the answers below, then save again." : result.message,
        details,
        submissionDate: null,
        retestDate: null,
      });
      return;
    }
    markSubmitted(protocol.form.handle, JSON.stringify(payload));
    // The result page scores the session from its submissions.
    router.push(n === total ? "/result" : `/protocol/${n + 1}`);
  };

  return (
    <div style={{ "--domain-color": `var(--${protocol.color}-deep)` }}>
      <LoadingOverlay show={prefilling} label="Loading your saved answers" />
      <div className="progress-rail rise" style={{ "--i": 0 }}>
        {config.protocols.map((p, i) => (
          <span key={p.id} className={`seg${i + 1 < n ? " done" : i + 1 === n ? " current" : ""}`} />
        ))}
        <span className="progress-count">
          {n} / {total}
        </span>
      </div>
      <div className="protocol-head rise" style={{ "--i": 1 }}>
        <span className="ghost-numeral">{protocol.numeral}</span>
        <div className="kicker">
          <span>Protocol {protocol.numeral}</span>
          <span className="accent">{protocol.name}</span>
        </div>
        <h1>{protocol.metric}</h1>
        <p className="tagline">{protocol.tagline}</p>
      </div>
      <div className="howto rise" style={{ "--i": 2 }}>
        <p className="howto-label">{protocol.stepTitle}</p>
        <ol>
          {protocol.howTo.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <div className="rise" style={{ "--i": 3 }}>
        <DomainFields
          protocol={protocol}
          inputs={inputs}
          onInputs={(next) => {
            edited.current = true;
            setDomainInputs(protocol.id, next);
          }}
        />
      </div>
      {notScored ? (
        <p className="field-hint not-scored-hint" role="status">
          This area will show as <b>not scored</b> ({String(notScored)}). It is left out of the total, which is then out of 80.
        </p>
      ) : null}
      <SubmissionNoticeDialog notice={notice} onClose={() => setNotice(null)} />
      {issues.length ? (
        <p className="form-error" role="alert">
          {issues[0].message}
        </p>
      ) : null}
      <div className="btn-row rise" style={{ "--i": 5 }}>
        <button type="button" className="back-link" onClick={goBack}>
          Back
        </button>
        <button type="button" className="primary-btn" disabled={!canContinue || submitting} onClick={goNext}>
          {submitting
            ? "Saving…"
            : n === total
              ? "Reveal my U Score™"
              : `Continue to Protocol ${config.protocols[n].numeral}`}
        </button>
      </div>
    </div>
  );
}
