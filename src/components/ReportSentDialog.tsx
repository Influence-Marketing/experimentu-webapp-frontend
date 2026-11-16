"use client";

import { useEffect, useRef } from "react";

/**
 * Shown from "View your sealed report": the report goes out by email once the session is scored,
 * so this tells the guest where to find it and how to open the password-protected PDF.
 */
export function ReportSentDialog({ email, open, onClose }: { email: string; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>(".primary-btn")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => ref.current?.close();
  return (
    <dialog
      ref={ref}
      className="notice-dialog"
      aria-labelledby="report-sent-title"
      onClose={onClose}
      // A click on the dialog element itself (not the card inside it) is a click on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {open ? (
        <div className="notice-card">
          <p className="notice-kicker">
            <span>●</span> Sealed report
          </p>
          <h2 id="report-sent-title">
            Your report is <em>in your inbox</em>.
          </h2>
          <p className="notice-message">
            We&apos;ve sent your sealed report to {email ? <b>{email}</b> : "the email you entered"}. It can take a few minutes to
            arrive; if you don&apos;t see it, check your spam or promotions folder.
          </p>
          <button type="button" className="primary-btn" onClick={close}>
            Got it
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
