"use client";

import { hasResult, ordinal, pathPlan, upgradePercentile } from "@/lib/scoring";
import type { Entry } from "@/lib/types";
import { useContent } from "./ContentProvider";

export function ReportSheet({ entry, onBack }: { entry: Entry; onBack: () => void }) {
  const { config } = useContent();
  const { result, participant, phase } = entry;
  const path = result.path ?? pathPlan(config, result);
  // Only domains that were scored, and only the parts of a result that have a value.
  const domains = result.domains.filter(hasResult);
  const flags = result.flags.filter((f) => f.title || f.message);
  const subtitle = [
    phase === "week8" ? "Week-8 retest" : "Baseline",
    participant.age != null ? `Age ${participant.age}` : null,
    entry.configVersion ? `Config v${entry.configVersion}` : null,
  ].filter(Boolean);
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
          <h1>{participant.firstName ? `${participant.firstName}’s U Score™` : "Your U Score™"}</h1>
          <p className="rt-sub">{subtitle.join(" · ")}</p>
        </div>
        <div className="report-scoreline">
          <div className="report-ring" style={{ "--score": result.total }}>
            {result.total}
          </div>
          <div className="rs-words">
            {result.quintile?.name ? <h2>{result.quintile.name}</h2> : null}
            {result.quintile?.meaning ? <p>{result.quintile.meaning}</p> : null}
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
        {flags.map((flag) => (
          <div key={flag.flagId} className={`flag-card${flag.severity === "check" ? " check" : ""}`}>
            <p className="flag-kicker">
              <span>●</span>{" "}
              {flag.severity === "urgent"
                ? "Seek care promptly"
                : flag.severity === "check"
                  ? "One check"
                  : "Talk to your doctor"}
            </p>
            {flag.title ? <h3>{flag.title}</h3> : null}
            {flag.message ? <p>{flag.message}</p> : null}
          </div>
        ))}
        {domains.length ? (
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
              {domains.map((d) => {
                const domain = config.domains.find((x) => x.id === d.id);
                const display =
                  d.value == null || d.value === "" || !domain
                    ? null
                    : domain.inputType === "bp-readings"
                      ? `${d.value} mmHg`
                      : domain.inputType === "who5"
                        ? `${d.value} / 25`
                        : `${d.value} ${domain.unit !== "ratio" ? domain.unit : ""}`.trim();
                return (
                  <tr key={d.id}>
                    <td className="rt-domain">
                      <b>
                        {d.numeral} — {d.name}
                      </b>
                      {d.metric ? <span>{d.metric}</span> : null}
                    </td>
                    <td className="rt-value">
                      {display ? <b>{display}</b> : null}
                      {domain?.inputType !== "who5" && d.bandLabel && d.bandLabel !== d.comparison ? (
                        <span>{d.bandLabel}</span>
                      ) : null}
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
        ) : null}
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
