"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leadFieldByHandle, toLeadPayload } from "@/lib/api/mappers";
import { LEAD_FORM, submitForm } from "@/lib/api/statamic";
import { intakeComplete } from "@/lib/storage";
import { useContent } from "./ContentProvider";
import { useFlow } from "./FlowProvider";
import { FieldLabel } from "./ui/FieldLabel";
import { NumberField } from "./ui/NumberField";
import { SegToggle } from "./ui/SegToggle";
import type { Participant, Phase } from "@/lib/types";

type FieldErrors = Partial<Record<keyof Participant, string>>;

function FieldError({ message }: { message?: string }) {
  return message ? <p className="field-error">{message}</p> : null;
}

export function WelcomeForm() {
  const router = useRouter();
  const { config, leadForm } = useContent();
  const { flow, setParticipant, markSubmitted } = useFlow();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const p = flow.participant;
  const ready = intakeComplete(p);
  const firstProtocol = config.domains[0];

  const update = (patch: Partial<Participant>) => {
    setParticipant(patch);
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key as keyof Participant];
      return next;
    });
  };

  const begin = async () => {
    const payload = toLeadPayload(p, leadForm);
    const key = JSON.stringify(payload);
    const target = `/protocol/${firstProtocol.id}`;
    // Coming back to intake and continuing unchanged shouldn't create a second submission.
    if (flow.submissions[LEAD_FORM]?.key === key) {
      router.push(target);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    const result = await submitForm(LEAD_FORM, payload);
    setSubmitting(false);
    if (!result.ok) {
      const mapped: FieldErrors = {};
      for (const [handle, message] of Object.entries(result.fieldErrors)) {
        const field = leadFieldByHandle[handle];
        if (field) mapped[field] = message;
      }
      setFieldErrors(mapped);
      setFormError(
        Object.keys(mapped).length ? result.message : (Object.values(result.fieldErrors)[0] ?? result.message),
      );
      return;
    }
    markSubmitted(LEAD_FORM, key, result.token);
    router.push(target);
  };

  return (
    <div>
      <div className="welcome-hero">
        <span className="u-glyph rise" style={{ "--i": 0 }}>
          U.
        </span>
        <h1 className="rise" style={{ "--i": 1 }}>
          Advice is cheap.
          <br />
          <em>Evidence</em> is yours.
        </h1>
        <p className="lede rise" style={{ "--i": 2 }}>
          Five measurements. Five minutes. One number that marks where your experiment begins — and what
          to remeasure in eight weeks.
        </p>
      </div>
      <div className="protocol-strip rise" style={{ "--i": 3 }}>
        {config.domains.map((d) => (
          <div key={d.id} className="chip" style={{ "--chip-color": `var(--${d.color}-deep)` }}>
            <span className="n">{d.numeral}</span>
            <span className="t">{d.name.split(" ")[0]}</span>
          </div>
        ))}
      </div>
      <div className="rise" style={{ "--i": 4 }}>
        <div className="field-block phase-select">
          <label className="field-label">{leadForm.session.label}</label>
          <SegToggle
            options={["baseline", "week8"] as Phase[]}
            labels={[leadForm.session.baselineLabel, leadForm.session.week8Label]}
            value={p.phase}
            onChange={(phase) => update({ phase })}
          />
          <FieldError message={fieldErrors.phase} />
        </div>
        <div className="field-block">
          <FieldLabel label={leadForm.firstName.label} opt={leadForm.firstName.opt} />
          <input
            className="text-input"
            type="text"
            autoComplete="given-name"
            placeholder={leadForm.firstName.placeholder}
            maxLength={leadForm.firstName.maxLength}
            value={p.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
          />
          <FieldError message={fieldErrors.firstName} />
        </div>
        <div className="field-block">
          <FieldLabel label={leadForm.email.label} opt={leadForm.email.opt} />
          <input
            className="text-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={leadForm.email.placeholder}
            maxLength={leadForm.email.maxLength}
            value={p.email}
            onChange={(e) => update({ email: e.target.value })}
          />
          <FieldError message={fieldErrors.email} />
        </div>
        <div className="field-block">
          <FieldLabel label={leadForm.age.label} opt={leadForm.age.opt} />
          <NumberField
            value={p.age}
            onChange={(age) => update({ age })}
            min={18}
            max={105}
            unit="yrs"
            placeholder={leadForm.age.placeholder}
            ariaLabel="Age in years"
          />
          <FieldError message={fieldErrors.age} />
        </div>
        <div className="field-block">
          <FieldLabel label={leadForm.fearWord.label} opt={leadForm.fearWord.opt} />
          <input
            className="text-input"
            type="text"
            placeholder={leadForm.fearWord.placeholder}
            maxLength={leadForm.fearWord.maxLength}
            value={p.fearWord}
            onChange={(e) => update({ fearWord: e.target.value.split(/\s+/)[0] || "" })}
          />
          {leadForm.fearWord.note ? <p className="fear-note">{leadForm.fearWord.note}</p> : null}
          <FieldError message={fieldErrors.fearWord} />
        </div>
        <div className="field-block consents">
          <label className="consent-check">
            <input
              type="checkbox"
              checked={p.marketingOptIn === true}
              onChange={(e) => update({ marketingOptIn: e.target.checked })}
            />
            <span>{leadForm.marketingOptIn.text}</span>
          </label>
          <FieldError message={fieldErrors.marketingOptIn} />
          <label className="consent-check">
            <input
              type="checkbox"
              required={leadForm.dataConsent.required}
              checked={p.dataConsent === true}
              onChange={(e) => update({ dataConsent: e.target.checked })}
            />
            <span>{leadForm.dataConsent.text}</span>
          </label>
          <FieldError message={fieldErrors.dataConsent} />
        </div>
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="btn-row">
          <button type="button" className="primary-btn" disabled={!ready || submitting} onClick={begin}>
            {submitting ? "Saving…" : `Begin Protocol ${firstProtocol.numeral}`}
          </button>
        </div>
      </div>
    </div>
  );
}
