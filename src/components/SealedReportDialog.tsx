"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiSealedReport } from "@/lib/api/statamic";

function decodeBase64(text: string) {
  const binary = atob(text.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// The PDF is encrypted with the report's password, so the browser's own viewer would ask for it a
// second time (and phones often can't show a PDF inline at all). pdf.js opens it with the password
// and draws each page here instead; it is only loaded once a guest unlocks a report.
async function renderPages(bytes: Uint8Array, password: string, into: HTMLElement) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  // pdf.js hands its bytes to the worker, so the download keeps its own copy.
  const task = pdfjs.getDocument({ data: bytes.slice(), password });
  try {
    const doc = await task.promise;
    const ratio = window.devicePixelRatio || 1;
    // Measured once, before any page is added, so every page is drawn to the same width.
    const style = getComputedStyle(into);
    const width = into.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    into.replaceChildren();
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * ratio });
      const canvas = document.createElement("canvas");
      canvas.className = "sr-page";
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Report page ${n} of ${doc.numPages}`);
      into.appendChild(canvas);
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
    }
  } finally {
    await task.destroy();
  }
}

/**
 * The sealed report behind its password: the API's hint as the heading and a field for the
 * password. Once it matches, the report's pages show here and the PDF can be downloaded.
 */
export function SealedReportDialog({ report, onClose }: { report: ApiSealedReport | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const [answer, setAnswer] = useState("");
  const [stage, setStage] = useState<"locked" | "wrong" | "opening" | "open" | "failed">("locked");
  const bytes = useMemo(() => (report ? decodeBase64(report.pdf_base64) : null), [report]);
  const download = useMemo(() => (bytes ? URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })) : null), [bytes]);
  const unlocked = stage === "opening" || stage === "open" || stage === "failed";

  useEffect(() => () => (download ? URL.revokeObjectURL(download) : undefined), [download]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (report && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("#sealed-password")?.focus();
    }
    if (!report && dialog.open) dialog.close();
  }, [report]);

  useEffect(() => {
    if (stage !== "opening" || !report || !bytes || !pages.current) return;
    let live = true;
    renderPages(bytes, report.password, pages.current)
      .then(() => live && setStage("open"))
      .catch(() => live && setStage("failed"));
    return () => {
      live = false;
    };
  }, [stage, report, bytes]);

  const close = () => ref.current?.close();
  const unlock = () => setStage(answer.trim() === report?.password ? "opening" : "wrong");

  return (
    <dialog
      ref={ref}
      className={`notice-dialog sealed-dialog${unlocked ? " viewing" : ""}`}
      aria-labelledby="sealed-title"
      onClose={() => {
        setAnswer("");
        setStage("locked");
        onClose();
      }}
      // A click on the dialog element itself (not the card inside it) is a click on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {report ? (
        <div className="notice-card">
          <p className="notice-kicker">
            <span>●</span> Sealed report
          </p>
          {unlocked ? (
            <>
              <h2 id="sealed-title" className="sealed-hint">
                Your <em>sealed report</em>.
              </h2>
              {stage === "opening" ? <p className="notice-message">Opening your report…</p> : null}
              {stage === "failed" ? (
                <p className="form-error" role="alert">
                  We couldn&apos;t show the report here. Download it and open it with the same password.
                </p>
              ) : null}
              <div ref={pages} className="sr-pages" hidden={stage === "failed"} />
              <p className="field-hint">The downloaded PDF asks for the same password when you open it.</p>
              <div className="notice-actions">
                <button type="button" className="back-link" onClick={close}>
                  Close
                </button>
                {download ? (
                  <a className="primary-btn" href={download} download={report.filename}>
                    Download PDF
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                unlock();
              }}
            >
              <h2 id="sealed-title" className="sealed-hint">
                {report.password_hint}
              </h2>
              <div className="field-block">
                <label className="field-label" htmlFor="sealed-password">
                  Report password
                </label>
                <input
                  id="sealed-password"
                  className="text-input"
                  type="password"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="Enter the password"
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    if (stage === "wrong") setStage("locked");
                  }}
                />
                {stage === "wrong" ? (
                  <p className="field-error" role="alert">
                    That password doesn&apos;t match. Check the hint above and try again.
                  </p>
                ) : null}
              </div>
              <div className="notice-actions">
                <button type="button" className="back-link" onClick={close}>
                  Close
                </button>
                <button type="submit" className="primary-btn" disabled={!answer.trim()}>
                  Unlock report
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </dialog>
  );
}
