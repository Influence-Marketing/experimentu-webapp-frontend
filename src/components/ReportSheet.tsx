"use client";

import { useRef, useState } from "react";
import { downloadReportPdf } from "@/lib/report-pdf";
import type { Entry } from "@/lib/types";
import { FlagCard } from "./ScoreReveal";

/** "U-Score-Maya-2026-10-29.pdf", dated the day the measurements were taken. */
function pdfFileName(entry: Entry) {
  const created = new Date(entry.createdAt);
  const day = [created.getFullYear(), created.getMonth() + 1, created.getDate()]
    .map((n) => String(n).padStart(2, "0"))
    .join("-");
  const name = entry.participant.firstName.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  return `U-Score-${name || "report"}-${day}.pdf`;
}

export function ReportSheet({ entry, onBack }: { entry: Entry; onBack: () => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const { result, participant, phase } = entry;

  const downloadPdf = async () => {
    if (!sheet.current) return;
    setSavingPdf(true);
    setPdfError(null);
    try {
      await downloadReportPdf(sheet.current, pdfFileName(entry));
    } catch {
      setPdfError("We couldn't create the PDF. Use Print report and choose Save as PDF instead.");
    } finally {
      setSavingPdf(false);
    }
  };
  const subtitle = [
    phase === "week8" ? "Week-8 retest" : "Baseline",
    participant.age != null ? `Age ${participant.age}` : null,
    entry.configVersion ? `Config v${entry.configVersion}` : null,
  ].filter(Boolean);
  const date = new Date(entry.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (!result) {
    return (
      <div>
        <div className="report-sheet rise" style={{ "--i": 0 }}>
          <div className="report-title">
            <h1>{participant.firstName ? `${participant.firstName}’s U Score™` : "Your U Score™"}</h1>
            <p className="rt-sub">{subtitle.join(" · ")}</p>
          </div>
          <p className="form-error" role="alert">
            This session has not been scored yet. Open the score page to fetch it from the server.
          </p>
        </div>
        <div className="btn-row no-print rise" style={{ "--i": 1 }}>
          <button type="button" className="back-link" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const sameScale = result.baselineOutOf !== null && result.baselineOutOf === result.outOf;

  return (
    <div>
      <div ref={sheet} className="report-sheet rise" style={{ "--i": 0 }}>
        <div className="report-masthead">
          <span className="rm-brand">Experiment U™ · Personal Health Report</span>
          <span className="rm-date">{date}</span>
        </div>
        <div className="report-title">
          <h1>{participant.firstName ? `${participant.firstName}’s U Score™` : "Your U Score™"}</h1>
          <p className="rt-sub">{subtitle.join(" · ")}</p>
        </div>
        <div className="report-scoreline">
          <div className="report-ring" style={{ "--score": (result.total / result.outOf) * 100 }}>
            {result.total}
          </div>
          <div className="rs-words">
            <h2>{result.word ?? `${result.total} of ${result.outOf}`}</h2>
            {result.word && result.cohortDetail?.tagline ? <p>{result.cohortDetail.tagline}</p> : null}
            {!result.word ? <p>An area was not scored today, so the total is out of {result.outOf} and has no word.</p> : null}
            {phase === "week8" && result.baselineTotal !== null ? (
              <p style={{ marginTop: 8 }}>
                {sameScale && result.deltaTotal !== null
                  ? `Baseline ${result.baselineTotal} → ${result.total} (${result.deltaTotal >= 0 ? "+" : ""}${result.deltaTotal})`
                  : `Baseline ${result.baselineTotal} of ${result.baselineOutOf}; the totals are out of different numbers, so compare each area.`}
              </p>
            ) : null}
          </div>
        </div>
        {result.overall ? <p className="report-pathline">{result.overall}</p> : null}
        {result.cohortDetail?.body ? <p className="report-body">{result.cohortDetail.body}</p> : null}
        {result.flags.map((flag) => (
          <FlagCard key={flag.id} flag={flag} />
        ))}
        {result.areas.map((area) => (
          <section className="report-area" key={area.key}>
            <div className="report-area-head">
              <h3>{area.heading}</h3>
              <span className="rt-pts">
                {area.points === null ? "—" : area.points} / {area.max}
                {phase === "week8" && area.delta !== null ? (
                  <span className="rt-standing">
                    {" "}
                    {area.delta >= 0 ? "+" : ""}
                    {area.delta} vs baseline
                  </span>
                ) : null}
              </span>
            </div>
            {area.notScored ? <p className="report-not-scored">Not scored — {area.notScored}</p> : null}
            {area.paragraph ? <p className="report-para">{area.paragraph}</p> : null}
            {area.components.length ? (
              <table className="report-table">
                <tbody>
                  {area.components.map((c) => (
                    <tr key={c.measure}>
                      <td className="rt-domain">
                        <b>{c.measure}</b>
                      </td>
                      <td className="rt-value">
                        <b>{c.value}</b>
                      </td>
                      <td className="rt-comparison">
                        {c.label}
                        {c.line ? <span className="rt-standing">{c.line}</span> : null}
                        {c.note ? <span className="rt-standing">{c.note}</span> : null}
                      </td>
                      <td className="rt-pts">
                        {c.points === null ? "—" : c.points} / {c.max}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        ))}
        {result.recorded.length ? (
          <div className="report-extras">
            <h4>Also recorded — on your report, not scored</h4>
            {result.recorded.map((r) => (
              <p key={r.key}>
                {r.label}: {r.value} · {r.standing}
                {r.note ? ` · ${r.note}` : ""}
              </p>
            ))}
          </div>
        ) : null}
        {result.disclaimer ? <p className="honesty">{result.disclaimer}</p> : null}
      </div>
      <div className="btn-row no-print rise" style={{ "--i": 1 }}>
        <button type="button" className="back-link" onClick={onBack}>
          Back
        </button>
        <button type="button" className="ghost-btn" style={{ flex: 1 }} onClick={() => window.print()}>
          Print report
        </button>
        <button type="button" className="ghost-btn" style={{ flex: 1 }} disabled={savingPdf} onClick={downloadPdf}>
          {savingPdf ? "Preparing PDF…" : "Download PDF"}
        </button>
      </div>
      {pdfError ? (
        <p className="form-error no-print" role="alert">
          {pdfError}
        </p>
      ) : null}
    </div>
  );
}
