"use client";

import { useEffect, useRef } from "react";

/**
 * "View your sealed report": says the report also goes out by email, then "Got it" opens it.
 * Escape or a click on the backdrop only closes the dialog.
 */
export function ReportEmailDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
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
      aria-labelledby="report-email-title"
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
          <h2 id="report-email-title">
            Your report is <em>on its way</em>.
          </h2>
          <p className="notice-message">Report will be sent on your registered email Id</p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              close();
              onConfirm();
            }}
          >
            Got it
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
