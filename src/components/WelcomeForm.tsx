"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { leadFieldByHandle, toLeadPayload } from "@/lib/api/mappers";
import { captureAttribution } from "@/lib/attribution";
import { isKiosk } from "@/lib/kiosk";
import { LEAD_FORM, submitForm } from "@/lib/api/statamic";
import { intakeComplete, latestEntryFor } from "@/lib/storage";
import { RecaptchaCheckbox, type RecaptchaHandle } from "./RecaptchaCheckbox";
import { SubmissionNoticeDialog, type SubmissionNotice } from "./SubmissionNoticeDialog";
import { TextCaptcha } from "./TextCaptcha";
import { useContent } from "./ContentProvider";
import { useFlow } from "./FlowProvider";
import { FieldLabel } from "./ui/FieldLabel";
import { NumberField } from "./ui/NumberField";
import { SegToggle } from "./ui/SegToggle";
import type { Participant, Phase } from "@/lib/types";

type FieldErrors = Partial<Record<keyof Participant, string>>;

// Google reCAPTCHA v2 site key; without one the lead form uses the built-in TextCaptcha instead.
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="field-error">{message}</p> : null;
}

/** The intake's headline and protocol strip. Static, so it renders on the server, before the saved flow loads. */
export function WelcomeHero() {
  const { config } = useContent();
  return (
    <>
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
    </>
  );
}

export function WelcomeForm() {
  const router = useRouter();
  const { config, leadForm } = useContent();
  const { flow, setParticipant, markSubmitted } = useFlow();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<SubmissionNotice | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const captcha = useRef<RecaptchaHandle>(null);
  const p = flow.participant;
  const ready = intakeComplete(p) && (RECAPTCHA_SITE_KEY ? captchaToken != null : captchaPassed);
  const kiosk = isKiosk();
  const viaRetestLink = flow.retestToken != null;

  // Keep the arrival URL's UTM / referrer / event from the first visit, before any navigation drops them.
  useEffect(() => {
    captureAttribution();
  }, []);
  const firstProtocol = config.domains[0];
  const target = "/protocol/1";

  const update = (patch: Partial<Participant>) => {
    setParticipant(patch);
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key as keyof Participant];
      return next;
    });
  };

  // The email the other fields were last filled in for, so they can be cleared again if it changes.
  const filledFor = useRef<string | null>(null);

  // A returning guest's email fills in their details from their last session on this device; any
  // other email leaves the fields as typed, clearing only what was filled in for a previous match.
  const updateEmail = (email: string) => {
    const known = kiosk ? null : latestEntryFor(email);
    if (known) {
      const { firstName, age, fearWord, marketingOptIn, dataConsent } = known.participant;
      filledFor.current = email.trim().toLowerCase();
      update({ email, firstName, age, fearWord, marketingOptIn, dataConsent });
    } else if (filledFor.current) {
      filledFor.current = null;
      update({ email, firstName: "", age: null, fearWord: "", marketingOptIn: false, dataConsent: false });
    } else {
      update({ email });
    }
  };

  // `retestConfirmed` resends after the "already submitted" popup, telling the API to go ahead.
  const begin = async (retestConfirmed = false) => {
    // First-touch UTM / referrer / event ride along, as does the retest link's token.
    const payload = toLeadPayload(p, {
      ...captureAttribution(),
      ...(flow.retestToken ? { retest_token: flow.retestToken } : {}),
    });
    const key = JSON.stringify(payload);
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    // The token rides along but stays out of `key`, which only says who the lead was for.
    const result = await submitForm(LEAD_FORM, {
      ...payload,
      ...(retestConfirmed ? { retest_confirmed: true } : {}),
      ...(captchaToken ? { recaptcha_token: captchaToken } : {}),
    });
    setSubmitting(false);
    if (!result.ok) {
      // A token the API turned down can't be used again: the guest ticks the box afresh.
      if (result.fieldErrors.recaptcha_token) captcha.current?.reset();
      if (result.alreadySubmitted) {
        setNotice({ kind: "already-submitted", message: result.message, ...result.alreadySubmitted });
        return;
      }
      if (result.retestRequired) {
        setFormError(result.message);
        return;
      }
      if (result.retestNotOpen) {
        setNotice({
          kind: "retest-not-open",
          message: result.message,
          submissionDate: null,
          retestDate: result.retestNotOpen.retestDate,
        });
        return;
      }
      const mapped: FieldErrors = {};
      for (const [handle, message] of Object.entries(result.fieldErrors)) {
        const field = leadFieldByHandle[handle];
        // Don't repeat under the field what the banner already says.
        if (field && message !== result.message) mapped[field] = message;
      }
      setFieldErrors(mapped);
      setFormError(
        Object.keys(mapped).length ? result.message : (Object.values(result.fieldErrors)[0] ?? result.message),
      );
      return;
    }
    markSubmitted(LEAD_FORM, key, { token: result.token, participantId: result.participantId });
    router.push(target);
  };

  return (
    <div>
      <div className="rise" style={{ "--i": 4 }}>
        <div className="field-block phase-select">
          <span className="field-label" id="lead-session-label">
            {leadForm.session.label}
          </span>
          <SegToggle
            options={["baseline", "week8"] as Phase[]}
            labels={[leadForm.session.baselineLabel, leadForm.session.week8Label]}
            value={viaRetestLink ? "week8" : p.phase}
            onChange={(phase) => update({ phase })}
            disabled={viaRetestLink}
            ariaLabel={leadForm.session.label}
          />
          {viaRetestLink ? (
            <p className="field-hint">
              Your Week-8 retest is open from your personal link.{p.email ? "" : " Enter the email you used for your baseline."}
            </p>
          ) : p.phase === "week8" ? (
            <p className="field-hint">The Week-8 retest opens from the link in your report email. Typing an email alone will not open it.</p>
          ) : null}
          <FieldError message={fieldErrors.phase} />
        </div>
        <div className="field-block">
          <FieldLabel label={leadForm.firstName.label} opt={leadForm.firstName.opt} htmlFor="lead-first-name" />
          <input
            id="lead-first-name"
            className="text-input"
            type="text"
            autoComplete={kiosk ? "off" : "given-name"}
            aria-invalid={Boolean(fieldErrors.firstName) || undefined}
            placeholder={leadForm.firstName.placeholder}
            maxLength={leadForm.firstName.maxLength}
            value={p.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
          />
          <FieldError message={fieldErrors.firstName} />
        </div>
        <div className="field-block">
          <FieldLabel label={leadForm.email.label} opt={leadForm.email.opt} htmlFor="lead-email" />
          <input
            id="lead-email"
            className="text-input"
            type="email"
            inputMode="email"
            aria-invalid={Boolean(fieldErrors.email) || undefined}
            autoComplete={kiosk ? "off" : "email"}
            placeholder={leadForm.email.placeholder}
            maxLength={leadForm.email.maxLength}
            value={p.email}
            onChange={(e) => updateEmail(e.target.value)}
          />
          <FieldError message={fieldErrors.email} />
        </div>
        <div className="field-block">
          <FieldLabel label={leadForm.age.label} opt={leadForm.age.opt} htmlFor="lead-age" />
          <NumberField
            id="lead-age"
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
          <FieldLabel label={leadForm.fearWord.label} opt={leadForm.fearWord.opt} htmlFor="lead-fear-word" />
          <input
            id="lead-fear-word"
            className="text-input"
            type="text"
            autoComplete="off"
            aria-invalid={Boolean(fieldErrors.fearWord) || undefined}
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
        {RECAPTCHA_SITE_KEY ? (
          <RecaptchaCheckbox ref={captcha} siteKey={RECAPTCHA_SITE_KEY} onChange={setCaptchaToken} />
        ) : (
          <TextCaptcha onChange={setCaptchaPassed} />
        )}
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="btn-row">
          <button type="button" className="primary-btn" disabled={!ready || submitting} onClick={() => begin()}>
            {submitting ? "Saving…" : `Begin Protocol ${firstProtocol.numeral}`}
          </button>
        </div>
      </div>
      <SubmissionNoticeDialog
        notice={notice}
        onClose={() => setNotice(null)}
        onContinue={() => begin(true)}
      />
    </div>
  );
}
