"use client";

import { useEffect, useRef } from "react";

export type SubmissionNotice = {
  /**
   * "already-submitted": this email already did this session (409); the participant can retest.
   * "retest-not-open": Week-8 Retest picked before it opens (422); nothing to do but wait.
   * "invalid": the API rejected some answers (422); `details` lists its messages.
   * "failed": the answers couldn't be saved for another reason (network, session, server).
   */
  kind: "already-submitted" | "retest-not-open" | "invalid" | "failed";
  message: string;
  submissionDate: string | null;
  retestDate: string | null;
  /** The API's message for each field it rejected. */
  details?: string[];
};

const COPY: Record<SubmissionNotice["kind"], { kicker: string; heading: React.ReactNode }> = {
  "already-submitted": {
    kicker: "Already submitted",
    heading: (
      <>
        You&apos;re <em>already</em> in.
      </>
    ),
  },
  "retest-not-open": {
    kicker: "Not open yet",
    heading: (
      <>
        Your retest is <em>on its way</em>.
      </>
    ),
  },
  invalid: {
    kicker: "Check your answers",
    heading: (
      <>
        A few answers <em>need a look</em>.
      </>
    ),
  },
  failed: {
    kicker: "Not saved",
    heading: (
      <>
        We couldn&apos;t <em>save that</em>.
      </>
    ),
  },
};

const DAY_MS = 86_400_000;

// The API sends date-only strings; read and format them in UTC so the day never shifts.
function parseDay(iso: string | null) {
  if (!iso) return null;
  const time = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(time) ? null : time;
}

function formatDay(iso: string | null) {
  const time = parseDay(iso);
  if (time == null) return iso;
  return new Date(time).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysUntil(iso: string | null) {
  const time = parseDay(iso);
  if (time == null) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((time - today) / DAY_MS);
}

export function SubmissionNoticeDialog({
  notice,
  onClose,
  onRetest,
  onContinue,
}: {
  notice: SubmissionNotice | null;
  onClose: () => void;
  /** Resubmits with retest_confirmed; offered only for "already-submitted". */
  onRetest?: () => void;
  /** Carries on with the token this browser already holds; offered only for "already-submitted". */
  onContinue?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (notice && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>(".primary-btn")?.focus();
    }
    if (!notice && dialog.open) dialog.close();
  }, [notice]);

  const close = () => ref.current?.close();
  const copy = notice ? COPY[notice.kind] : null;
  const submitted = notice ? formatDay(notice.submissionDate) : null;
  const retest = notice ? formatDay(notice.retestDate) : null;
  const daysLeft = notice ? daysUntil(notice.retestDate) : null;
  const canRetest = notice?.kind === "already-submitted" && onRetest != null;
  const canContinue = notice?.kind === "already-submitted" && onContinue != null;

  return (
    <dialog
      ref={ref}
      className="notice-dialog"
      aria-labelledby="notice-title"
      onClose={onClose}
      // A click on the dialog element itself (not the card inside it) is a click on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {notice && copy ? (
        <div className="notice-card">
          <p className="notice-kicker">
            <span>●</span> {copy.kicker}
          </p>
          <h2 id="notice-title">{copy.heading}</h2>
          <p className="notice-message">{notice.message}</p>
          {notice.details?.length ? (
            <ul className="notice-details">
              {notice.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
          {submitted || retest ? (
            <div className={`notice-dates${submitted && retest ? "" : " single"}`}>
              {submitted ? (
                <div className="notice-date">
                  <span className="nd-label">Submitted</span>
                  <span className="nd-value">{submitted}</span>
                </div>
              ) : null}
              {retest ? (
                <div className="notice-date next">
                  <span className="nd-label">Week-8 retest</span>
                  <span className="nd-value">{retest}</span>
                  {daysLeft != null && daysLeft > 0 ? (
                    <span className="nd-meta">
                      {daysLeft} {daysLeft === 1 ? "day" : "days"} to go
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {canRetest || canContinue ? (
            <div className="notice-actions">
              <button type="button" className="back-link" onClick={close}>
                Close
              </button>
              {canRetest ? (
                <button
                  type="button"
                  // With Continue on offer, carrying on is the main action and retesting the alternative.
                  className={canContinue ? "ghost-btn" : "primary-btn"}
                  onClick={() => {
                    close();
                    onRetest?.();
                  }}
                >
                  Retest
                </button>
              ) : null}
              {canContinue ? (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    close();
                    onContinue?.();
                  }}
                >
                  Continue
                </button>
              ) : null}
            </div>
          ) : (
            <button type="button" className="primary-btn" onClick={close}>
              Got it
            </button>
          )}
        </div>
      ) : null}
    </dialog>
  );
}
