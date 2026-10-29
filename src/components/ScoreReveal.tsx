"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hasResult, ordinal } from "@/lib/scoring";
import type { DomainScore, Entry, ScoreDisplay, ScoringConfig } from "@/lib/types";
import { useContent } from "./ContentProvider";
import { useFlow } from "./FlowProvider";
import { ReportEmailDialog } from "./ReportEmailDialog";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * "67.7 bpm", "14 reps · age band 50–64", "0.109", "120/81 mmHg", "14 / 25 · 56%": a domain's
 * measurement with its unit, preferring the API's unrounded `derived` figures over the scored value.
 */
function valueLabel(d: DomainScore, config: ScoringConfig, derived: ScoreDisplay["derived"] | undefined) {
  const domain = config.domains.find((x) => x.id === d.id);
  const withUnit = (value: number | string) => {
    if (domain?.inputType === "bp-readings") return `${value} mmHg`;
    if (domain?.inputType === "who5") return `${value} / 25`;
    return domain && domain.unit !== "ratio" ? `${value} ${domain.unit}` : String(value);
  };
  const bp =
    derived?.systolic != null && derived.diastolic != null ? `${derived.systolic}/${derived.diastolic}` : null;
  const precise = {
    nervous: derived?.rhrBpm,
    metabolism: derived?.waistToHeight,
    evidence: bp,
    recovery: derived?.who5Raw,
    movement: null,
  }[d.id];
  const value = precise ?? d.value;
  const parts = value != null && value !== "" ? [withUnit(value)] : [];
  if (d.id === "recovery" && derived?.who5Percent != null) parts.push(`${derived.who5Percent}%`);
  if (d.id === "movement" && derived?.ageBand) parts.push(`age band ${derived.ageBand.replace("-", "–")}`);
  return parts.length ? parts.join(" · ") : null;
}

// The API sends the session date as YYYY-MM-DD; format it in UTC so the day never shifts.
function formatDay(value: string) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(day ? `${value}T00:00:00Z` : value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(day ? { timeZone: "UTC" } : {}),
  });
}

function FlagCard({
  flag,
  style,
}: {
  flag: Entry["result"]["flags"][number];
  style?: React.CSSProperties;
}) {
  const kicker =
    flag.severity === "urgent"
      ? "Seek care promptly"
      : flag.severity === "check"
        ? "One check"
        : "Talk to your doctor";
  return (
    <div className={`flag-card rise${flag.severity === "check" ? " check" : ""}`} style={style}>
      <p className="flag-kicker">
        <span>●</span> {kicker}
      </p>
      {flag.title ? <h3>{flag.title}</h3> : null}
      {flag.message ? <p>{flag.message}</p> : null}
    </div>
  );
}

export function ScoreReveal({ entry }: { entry: Entry }) {
  const router = useRouter();
  const { reset, setCurrentEntryId } = useFlow();
  const { result, participant, phase } = entry;
  const [display, setDisplay] = useState(0);
  const [barsDrawn, setBarsDrawn] = useState(false);
  const [reportNotice, setReportNotice] = useState(false);
  const frame = useRef<number | null>(null);
  const { config } = useContent();
  // Only the scoring API's result reaches this screen: its levers, cohort tiers, next cohort and the
  // copy it sends with them (`result.display`). Nothing the app works out itself (percentiles, move
  // suggestions, cohort descriptions) is shown, and any section whose value the API left out (e.g. a
  // protocol not submitted yet) is hidden. Static copy only stands in for headings and labels.
  const api = result.display;
  const delta = api?.delta ?? (entry.baselineTotal != null ? result.total - entry.baselineTotal : null);
  const scored = result.domains.filter(hasResult);
  const levers =
    api?.levers ??
    (result.leverIds ?? []).flatMap((id) =>
      scored
        .filter((d) => d.id === id && d.lever)
        .map((d) => ({ domainId: d.id, numeral: d.numeral, label: d.name, copy: d.lever, color: d.color })),
    );
  const next = result.path?.next ?? null;
  const gap = result.path?.gap ?? 0;
  const cohorts = result.cohorts ?? [];
  const flags = result.flags.filter((f) => f.title || f.message);
  const card = api?.cohortCard ?? null;
  const membership = api?.membership ?? null;
  const cohortLine = [api?.cohortRange, api?.cohortTagline].filter(Boolean).join(" · ");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(result.total);
      setBarsDrawn(true);
      return;
    }
    const start = performance.now();
    const duration = 2000;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(easeOutCubic(t) * result.total));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    const bars = setTimeout(() => setBarsDrawn(true), 900);
    const snap = setTimeout(() => setDisplay(result.total), duration + 150);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      clearTimeout(bars);
      clearTimeout(snap);
    };
  }, [result.total]);

  const date = formatDay(api?.date ?? entry.createdAt);

  return (
    <div className="reveal-stage">
      <p className="reveal-kicker rise" style={{ "--i": 0 }}>
        {[api?.firstName ?? participant.firstName, phase === "week8" ? "Week-8 retest" : "Baseline", date]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {Number.isFinite(result.total) ? (
        <div className="rise" style={{ "--i": 1 }}>
          <div className="score-ring-xl" style={{ "--ringScore": display }}>
            <span className="score-num">{display}</span>
            <span className="score-of">
              {config.resultCopy.scoreLabel} / 100
            </span>
          </div>
        </div>
      ) : null}
      {result.quintile?.name ? (
        <h1 className="quintile-word rise" style={{ "--i": 2 }}>
          {result.quintile.name}
          <span className="full-stop">.</span>
        </h1>
      ) : null}
      {cohortLine ? (
        <p className="quintile-meaning rise" style={{ "--i": 3 }}>
          {cohortLine}
        </p>
      ) : null}
      {cohorts.length ? (
        <div className="quintile-scale rise" style={{ "--i": 3 }} aria-label="Where your score lands">
          {cohorts.map((q) => (
            <div key={q.name} className={`qs-band${q.name === result.quintile?.name ? " here" : ""}`}>
              <span className="qs-range">{q.range ?? `${q.min}–${q.max}`}</span>
              <span className="qs-name">{q.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="reveal-framing rise" style={{ "--i": 4 }}>
        {api?.eyebrow ?? config.resultCopy.framing}
      </p>
      {delta != null ? (
        <div className={`delta-chip rise${delta < 0 ? " down" : ""}`} style={{ "--i": 4 }}>
          {delta >= 0 ? "▲" : "▼"} {delta >= 0 ? "+" : ""}
          {delta} since your baseline ({entry.baselineTotal})
        </div>
      ) : null}
      {flags.map((flag, i) => (
        <FlagCard key={flag.flagId} flag={flag} style={{ "--i": 5 + i }} />
      ))}
      {flags.length ? (
        <p className="flag-framing rise" style={{ "--i": 6 }}>
          {config.flags.framing}
        </p>
      ) : null}
      {scored.length ? (
        <div className="breakdown rise" style={{ "--i": 6 }}>
          <p className="breakdown-label">{api?.domainsHeading ?? "Five domains · 20 points each"}</p>
          {scored.map((d, i) => (
            <div key={d.id} className="bar-row" style={{ "--bar-color": `var(--${d.color}-deep)` }}>
              <div className="bar-head">
                <span className="bh-name">
                  <span className="bh-numeral">{d.numeral}</span>
                  {api ? d.name : d.shortMetric}
                </span>
                <span className="bh-pts">
                  {d.points}
                  <small>/ {d.max}</small>
                </span>
              </div>
              <div className="bar-track">
                <div
                  className={`bar-fill${barsDrawn ? " drawn" : ""}`}
                  style={{
                    "--bar-pct": (d.points || 0) / d.max,
                    "--bar-delay": `${i * 140}ms`,
                  }}
                />
              </div>
              {[d.comparison, api ? valueLabel(d, config, api.derived) : null].some(Boolean) ? (
                <p className="bar-comparison">
                  {[d.comparison, api ? valueLabel(d, config, api.derived) : null].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {d.percentile ? (
                <span className="standing">
                  <span className="pct">≈ {ordinal(d.percentile.pct)} percentile</span>
                  {d.percentile.peerLabel ? <span className="peer">· {d.percentile.peerLabel}</span> : null}
                </span>
              ) : null}
              {d.description ? <p className="bar-comparison">{d.description}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {!result.path ? null : next ? (
        <div className="path-card rise" style={{ "--i": 7 }}>
          <p className="path-kicker">{card?.eyebrow ?? "Your next cohort"}</p>
          <h3>
            {card?.title ?? (
              <>
                The path to <em>{next.name}</em>
              </>
            )}
          </h3>
          <div className="path-gap">
            <span className="gap-num">+{gap}</span>
            <span className="gap-words">{gap === 1 ? "point away" : "points away"}</span>
          </div>
          {card?.body ? (
            <p className="mv-what" style={{ marginTop: 8 }}>
              {card.body}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="path-card rise" style={{ "--i": 7 }}>
          <p className="path-kicker">{card?.eyebrow ?? "Your cohort"}</p>
          <h3>{card?.title ?? config.path.topTitle}</h3>
          <p className="mv-what" style={{ marginTop: 8 }}>
            {card?.body ?? config.path.topMessage}
          </p>
        </div>
      )}
      {levers.length ? (
        <div className="levers rise" style={{ "--i": 8 }}>
          <h3>{api?.leversHeading ?? config.resultCopy.leverIntro}</h3>
          {levers.map((lever) => (
            <div
              key={lever.domainId}
              className="lever-row"
              style={{ "--lever-color": `var(--${lever.color}-deep)` }}
            >
              <span className="ln">{lever.numeral}</span>
              <p>
                <b>{lever.label}.</b> {lever.copy}
              </p>
            </div>
          ))}
          <p className="field-hint" style={{ marginTop: 14 }}>
            {api?.leversFooter ?? config.resultCopy.retestFraming}
          </p>
        </div>
      ) : null}
      {membership ? (
        <div className="membership rise" style={{ "--i": 9 }} data-mode={membership.mode}>
          {membership.eyebrow ? <p className="m-kicker">{membership.eyebrow}</p> : null}
          {membership.headline ? <h3>{membership.headline}</h3> : null}
          {membership.body ? <p>{membership.body}</p> : null}
          {membership.bullets.length ? (
            <ul>
              {membership.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
          {membership.button ? (
            membership.url ? (
              <a className="primary-btn" href={membership.url} target="_blank" rel="noopener noreferrer">
                {membership.button}
              </a>
            ) : (
              <button type="button" className="primary-btn" onClick={(e) => e.preventDefault()}>
                {membership.button}
              </button>
            )
          ) : null}
          {membership.priceNote ? <p className="m-price">{membership.priceNote}</p> : null}
        </div>
      ) : null}
      <div className="btn-row rise no-print" style={{ "--i": 10 }}>
        <button
          type="button"
          className="back-link"
          onClick={() => {
            reset();
            router.push("/");
          }}
        >
          Done
        </button>
        <button type="button" className="ghost-btn" style={{ flex: 1 }} onClick={() => setReportNotice(true)}>
          {api?.reportButton ?? "View your sealed report"}
        </button>
      </div>
      <ReportEmailDialog
        open={reportNotice}
        onClose={() => setReportNotice(false)}
        onConfirm={() => {
          setCurrentEntryId(entry.id);
          router.push(`/report/${entry.id}`);
        }}
      />
      {api?.notMedicalNotice ? (
        <p className="honesty rise" style={{ "--i": 11 }}>
          {api.notMedicalNotice}
        </p>
      ) : null}
      <p className="honesty rise" style={{ "--i": 11 }}>
        {api?.disclaimer ?? `${config.honesty.footer} ${config.honesty.bpCitation}`}
      </p>
    </div>
  );
}
