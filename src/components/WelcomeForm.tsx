"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { leadFieldByHandle, toLeadPayload } from "@/lib/api/mappers";
import { captureAttribution } from "@/lib/attribution";
import { isKiosk } from "@/lib/kiosk";
import { checkRetest, LEAD_FORM, submitForm } from "@/lib/api/statamic";
import { intakeComplete, isEmail } from "@/lib/storage";
import { PageDialog, type LegalPageSlug } from "./PageDialog";
import { RecaptchaCheckbox, type RecaptchaHandle } from "./RecaptchaCheckbox";
import { retestNotice, SubmissionNoticeDialog, type SubmissionNotice } from "./SubmissionNoticeDialog";
import { TextCaptcha } from "./TextCaptcha";
import { useContent } from "./ContentProvider";
import { useFlow } from "./FlowProvider";
import { FieldLabel } from "./ui/FieldLabel";
import { NumberField } from "./ui/NumberField";
import { SegToggle } from "./ui/SegToggle";
import type { Participant, Phase } from "@/lib/types";

type FieldErrors = Partial<Record<keyof Participant, string>>;

/** The Week-8 retest check for one email: "closed" when it can't start now, "unreachable" when it couldn't be asked. */
type RetestCheckState = { email: string; status: "checking" | "open" | "closed" | "unreachable" };

const emailKey = (email: string) => email.trim().toLowerCase();

// Google reCAPTCHA v2 site key; without one the lead form uses the built-in TextCaptcha instead.
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="field-error">{message}</p> : null;
}

/**
 * CMS copy with one phrase turned into a link button. The button sits inside the consent's label, so
 * its click must not also tick the checkbox. Copy without the phrase shows as plain text.
 */
function LinkedPhrase({ text, phrase, onOpen }: { text: string; phrase: RegExp; onOpen: () => void }) {
  const match = phrase.exec(text);
  if (!match) return <>{text}</>;
  const end = match.index + match[0].length;
  return (
    <>
      {text.slice(0, match.index)}
      <button
        type="button"
        className="inline-link"
        onClick={(e) => {
          e.preventDefault();
          onOpen();
        }}
      >
        {match[0]}
      </button>
      {text.slice(end)}
    </>
  );
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
  const { flow, ready: flowReady, setParticipant, markSubmitted } = useFlow();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<SubmissionNotice | null>(null);
  const [openPage, setOpenPage] = useState<LegalPageSlug | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const [retestCheck, setRetestCheck] = useState<RetestCheckState | null>(null);
  const latestCheck = useRef<string | null>(null);
  const captcha = useRef<RecaptchaHandle>(null);
  const p = flow.participant;
  const kiosk = isKiosk();
  const viaRetestLink = flow.retestToken != null;
  // A Week-8 retest picked here, not opened from the email link, starts only once the API says it's
  // open for the email typed; the link was already checked on its own page.
  const needsRetestCheck = p.phase === "week8" && !viaRetestLink;
  const check = retestCheck?.email === emailKey(p.email) ? retestCheck : null;
  const ready =
    intakeComplete(p) &&
    (!needsRetestCheck || check?.status === "open") &&
    (RECAPTCHA_SITE_KEY ? captchaToken != null : captchaPassed);

  // Asks the API whether this email's Week-8 retest is open, every time it's called; any other answer
  // shows in the notice dialog.
  const checkWeek8 = async (email: string) => {
    const key = emailKey(email);
    if (!isEmail(key)) return;
    latestCheck.current = key;
    setRetestCheck({ email: key, status: "checking" });
    const result = await checkRetest(key);
    // A newer email was asked about in the meantime.
    if (latestCheck.current !== key) return;
    if (result.ok) {
      setRetestCheck({ email: key, status: "open" });
      return;
    }
    setRetestCheck({ email: key, status: result.reason === "unreachable" ? "unreachable" : "closed" });
    setNotice(retestNotice(result));
  };

  // Back on the intake mid-session (e.g. from Protocol I) with a Week-8 email already in: check it again.
  useEffect(() => {
    if (flowReady && needsRetestCheck) void checkWeek8(p.email);
    // Once the saved flow is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowReady]);

  const week8Hint =
    check?.status === "checking"
      ? "Checking your Week-8 retest…"
      : check?.status === "open"
        ? "Your Week-8 retest is open."
        : check?.status === "closed"
          ? "The Week-8 retest isn't available for this email yet."
          : check?.status === "unreachable"
            ? "We couldn't check your Week-8 retest. Leave the email field to try again."
            : "Enter the email you used for your baseline to check your Week-8 retest.";

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
            onChange={(phase) => {
              update({ phase });
              if (phase === "week8") void checkWeek8(p.email);
            }}
            disabled={viaRetestLink}
            ariaLabel={leadForm.session.label}
          />
          {viaRetestLink ? (
            <p className="field-hint">
              Your Week-8 retest is open from your personal link.{p.email ? "" : " Enter the email you used for your baseline."}
            </p>
          ) : p.phase === "week8" ? (
            <p className="field-hint" aria-live="polite">
              {week8Hint}
            </p>
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
            onChange={(e) => update({ email: e.target.value })}
            onBlur={(e) => {
              if (needsRetestCheck) void checkWeek8(e.target.value);
            }}
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
            <span>
              <LinkedPhrase
                text={leadForm.dataConsent.text}
                phrase={/health data collection/i}
                onOpen={() => setOpenPage("health-data-collection")}
              />
            </span>
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
      <PageDialog slug={openPage} onClose={() => setOpenPage(null)} />
      <SubmissionNoticeDialog
        notice={notice}
        onClose={() => setNotice(null)}
        onContinue={() => begin(true)}
      />
    </div>
  );
}
