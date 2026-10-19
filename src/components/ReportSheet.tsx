"use client";

import { ordinal, pathPlan, upgradePercentile } from "@/lib/scoring";
import type { Entry } from "@/lib/types";
import { useContent } from "./ContentProvider";

export function ReportSheet({ entry, onBack }: { entry: Entry; onBack: () => void }) {
  const { config } = useContent();
  const { result, participant, phase } = entry;
  const path = pathPlan(config, result);
  const extras = config.domains
    .filter((d) => d.upgrade && Number.isFinite(entry.upgrades?.[d.upgrade.key]))
    .map((d) => ({
      ...d.upgrade!,
      value: entry.upgrades[d.upgrade!.key],
      percentile: upgradePercentile(
        config,
        d.upgrade!.key,
        entry.upgrades[d.upgrade!.key] as number,
        participant.age ?? 0,
      ),
    }));
  const date = new Date(entry.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <div className="report-sheet rise" style={{ "--i": 0 }}>
        <div className="report-masthead">
          <span className="rm-brand">Experiment U™ · Personal Health Report</span>
          <span className="rm-date">{date}</span>
        </div>
        <div className="report-title">
          <h1>{participant.firstName}’s U Score™</h1>
          <p className="rt-sub">
            {phase === "week8" ? "Week-8 retest" : "Baseline"} · Age {participant.age} · Config v
            {entry.configVersion}
          </p>
        </div>
        <div className="report-scoreline">
          <div className="report-ring" style={{ "--score": result.total }}>
            {result.total}
          </div>
          <div className="rs-words">
            <h2>{result.quintile.name}</h2>
            <p>{result.quintile.meaning}</p>
            {entry.baselineTotal != null ? (
              <p style={{ marginTop: 8 }}>
                Baseline {entry.baselineTotal} → {result.total} (
                {result.total - entry.baselineTotal >= 0 ? "+" : ""}
                {result.total - entry.baselineTotal})
              </p>
            ) : null}
          </div>
        </div>
        {path.next ? (
          <p className="report-pathline">
            {path.gap} {path.gap === 1 ? "point" : "points"} from {path.next.name} — your Week-8 target.
          </p>
        ) : (
          <p className="report-pathline">Top cohort. The Week-8 target is defending it.</p>
        )}
        {result.flags.map((flag) => (
          <div key={flag.flagId} className={`flag-card${flag.severity === "check" ? " check" : ""}`}>
            <p className="flag-kicker">
              <span>●</span>{" "}
              {flag.severity === "urgent"
                ? "Seek care promptly"
                : flag.severity === "check"
                  ? "One check"
                  : "Talk to your doctor"}
            </p>
            <h3>{flag.title}</h3>
            <p>{flag.message}</p>
          </div>
        ))}
        <table className="report-table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Result</th>
              <th>Compared to women your age</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {result.domains.map((d) => {
              const domain = config.domains.find((x) => x.id === d.id)!;
              const display =
                domain.inputType === "who5" || domain.inputType === "bp-readings"
                  ? domain.inputType === "bp-readings"
                    ? `${d.value} mmHg`
                    : `${d.value} / 25`
                  : `${d.value} ${domain.unit !== "ratio" ? domain.unit : ""}`.trim();
              return (
                <tr key={d.id}>
                  <td className="rt-domain">
                    <b>
                      {d.numeral} — {d.name}
                    </b>
                    <span>{d.metric}</span>
                  </td>
                  <td className="rt-value">
                    <b>{display}</b>
                    {domain.inputType !== "who5" ? <span>{d.bandLabel}</span> : null}
                  </td>
                  <td className="rt-comparison">
                    {d.comparison}
                    {d.percentile ? (
                      <span className="rt-standing">
                        ≈ {ordinal(d.percentile.pct)} percentile · {d.percentile.peerLabel}
                      </span>
                    ) : null}
                  </td>
                  <td className="rt-pts">
                    {d.points} / {d.max}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {extras.length ? (
          <div className="report-extras">
            <h4>Also captured — on record, not scored</h4>
            {extras.map((ex) => (
              <p key={ex.key}>
                {ex.label}: {ex.value} {ex.unit}
                {ex.percentile
                  ? ` — ≈ ${ordinal(ex.percentile.pct)} percentile, ${ex.percentile.peerLabel}`
                  : ""}
              </p>
            ))}
            <p className="ex-note">
              These metrics await validated scales before they join the score.
              {extras.some((ex) => ex.percentile)
                ? ` Grip standing: ${(config.percentiles.upgrades as { grip: { source: string } }).grip.source}.`
                : ""}
            </p>
          </div>
        ) : null}
        <p className="honesty">
          {config.honesty.footer} {config.honesty.bpCitation}{" "}
          {config.percentiles.enabled ? config.percentiles.disclosure : ""}
        </p>
      </div>
      <div className="btn-row no-print rise" style={{ "--i": 1 }}>
        <button type="button" className="back-link" onClick={onBack}>
          Back
        </button>
        <button type="button" className="ghost-btn" style={{ flex: 1 }} onClick={() => window.print()}>
          Print report
        </button>
      </div>
    </div>
  );
}
