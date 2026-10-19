"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toProtocolPayload } from "@/lib/api/mappers";
import { LEAD_FORM, submitForm } from "@/lib/api/statamic";
import { scoreDomain } from "@/lib/scoring";
import { intakeComplete } from "@/lib/storage";
import type { DomainId } from "@/lib/types";
import { useContent } from "./ContentProvider";
import { useFlow } from "./FlowProvider";
import { DomainFields } from "./DomainInputs";
import { NumberField } from "./ui/NumberField";

export function ProtocolScreen({ domainId }: { domainId: DomainId }) {
  const router = useRouter();
  const { config } = useContent();
  const { flow, setDomainInputs, setUpgrade, markSubmitted, completeProtocols, ready } = useFlow();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; details: string[] } | null>(null);
  const index = config.domains.findIndex((d) => d.id === domainId);
  const domain = config.domains[index];
  const n = index + 1;
  const total = config.domains.length;
  const inputs = flow.inputs[domain.id] || {};
  const upgradeValue = domain.upgrade ? (flow.upgrades[domain.upgrade.key] ?? null) : null;
  const canContinue = useMemo(
    () => scoreDomain(domain, inputs, flow.participant) != null,
    [domain, inputs, flow.participant],
  );

  const allowed = intakeComplete(flow.participant) && flow.submissions[LEAD_FORM] != null;

  useEffect(() => {
    if (ready && !allowed) router.replace("/");
  }, [ready, allowed, router]);

  if (!ready || !allowed) return null;

  const goBack = () => {
    if (index === 0) router.push("/");
    else router.push(`/protocol/${config.domains[index - 1].id}`);
  };

  const goNext = async () => {
    const payload = toProtocolPayload(domain, inputs, upgradeValue, flow.participant);
    const key = JSON.stringify(payload);
    // Unchanged answers (e.g. after Back) were already saved; don't create a duplicate submission.
    if (flow.submissions[domain.form.handle]?.key !== key) {
      setSubmitting(true);
      setSubmitError(null);
      const result = await submitForm(domain.form.handle, payload, flow.authToken);
      setSubmitting(false);
      if (!result.ok) {
        setSubmitError({ message: result.message, details: Object.values(result.fieldErrors) });
        return;
      }
      markSubmitted(domain.form.handle, key);
    }
    if (n === total) {
      completeProtocols();
      router.push("/score");
      return;
    }
    router.push(`/protocol/${config.domains[n].id}`);
  };

  return (
    <div style={{ "--domain-color": `var(--${domain.color}-deep)` }}>
      <div className="progress-rail rise" style={{ "--i": 0 }}>
        {config.domains.map((d, i) => (
          <span key={d.id} className={`seg${i + 1 < n ? " done" : i + 1 === n ? " current" : ""}`} />
        ))}
        <span className="progress-count">
          {n} / {total}
        </span>
      </div>
      <div className="protocol-head rise" style={{ "--i": 1 }}>
        <span className="ghost-numeral">{domain.numeral}</span>
        <div className="kicker">
          <span>Protocol {domain.numeral}</span>
          <span className="accent">{domain.name}</span>
        </div>
        <h1>{domain.metric}</h1>
        <p className="tagline">{domain.tagline}</p>
      </div>
      <div className="howto rise" style={{ "--i": 2 }}>
        <p className="howto-label">{domain.stepTitle}</p>
        <ol>
          {domain.howTo.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <div className="rise" style={{ "--i": 3 }}>
        <DomainFields
          domain={domain}
          inputs={inputs}
          onInputs={(next) => setDomainInputs(domain.id, next)}
          participant={flow.participant}
        />
      </div>
      {domain.upgrade ? (
        <div className={`upgrade rise${upgradeOpen ? " open" : ""}`} style={{ "--i": 4 }}>
          <button type="button" className="upgrade-toggle" onClick={() => setUpgradeOpen(!upgradeOpen)}>
            <span>{domain.upgrade.prompt}</span>
            <span className="chev">+</span>
          </button>
          {upgradeOpen ? (
            <div className="upgrade-body">
              <label className="field-label">{domain.upgrade.label}</label>
              <NumberField
                value={upgradeValue}
                onChange={(v) => setUpgrade(domain.upgrade!.key, v)}
                min={domain.upgrade.min}
                max={domain.upgrade.max}
                unit={domain.upgrade.unit}
                ariaLabel={domain.upgrade.label}
              />
              <p className="upgrade-note">{domain.upgrade.note}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {submitError ? (
        <div className="form-error" role="alert">
          {submitError.message}
          {submitError.details.length ? (
            <ul>
              {submitError.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
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
              : `Continue to Protocol ${config.domains[n].numeral}`}
        </button>
      </div>
    </div>
  );
}
