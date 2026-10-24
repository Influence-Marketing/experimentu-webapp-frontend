"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hasResult } from "@/lib/scoring";
import type { Entry } from "@/lib/types";
import { useContent } from "./ContentProvider";
import { useFlow } from "./FlowProvider";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
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
  const frame = useRef<number | null>(null);
  const { config } = useContent();
  const delta = entry.baselineTotal != null ? result.total - entry.baselineTotal : null;
  // Only the scoring API's result reaches this screen: its levers, cohort tiers and next cohort.
  // Nothing the app works out itself (percentiles, move suggestions, cohort descriptions) is shown,
  // and any section whose value the API left out (e.g. a protocol not submitted yet) is hidden.
  const scored = result.domains.filter(hasResult);
  const levers = (result.leverIds ?? []).flatMap((id) => scored.filter((d) => d.id === id && d.lever));
  const next = result.path?.next ?? null;
  const gap = result.path?.gap ?? 0;
  const cohorts = result.cohorts ?? [];
  const flags = result.flags.filter((f) => f.title || f.message);

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

  const date = new Date(entry.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="reveal-stage">
      <p className="reveal-kicker rise" style={{ "--i": 0 }}>
        {[participant.firstName, phase === "week8" ? "Week-8 retest" : "Baseline", date].filter(Boolean).join(" · ")}
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
      {cohorts.length ? (
        <div className="quintile-scale rise" style={{ "--i": 3 }} aria-label="Where your score lands">
          {cohorts.map((q) => (
            <div key={q.name} className={`qs-band${q.name === result.quintile?.name ? " here" : ""}`}>
              <span className="qs-range">
                {q.min}–{q.max}
              </span>
              <span className="qs-name">{q.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="reveal-framing rise" style={{ "--i": 4 }}>
        {config.resultCopy.framing}
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
          <p className="breakdown-label">Five domains · 20 points each</p>
          {scored.map((d, i) => (
            <div key={d.id} className="bar-row" style={{ "--bar-color": `var(--${d.color}-deep)` }}>
              <div className="bar-head">
                <span className="bh-name">
                  <span className="bh-numeral">{d.numeral}</span>
                  {d.shortMetric}
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
              {d.comparison ? <p className="bar-comparison">{d.comparison}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {!result.path ? null : next ? (
        <div className="path-card rise" style={{ "--i": 7 }}>
          <p className="path-kicker">Your next cohort</p>
          <h3>
            The path to <em>{next.name}</em>
          </h3>
          <div className="path-gap">
            <span className="gap-num">+{gap}</span>
            <span className="gap-words">points away</span>
          </div>
        </div>
      ) : (
        <div className="path-card rise" style={{ "--i": 7 }}>
          <p className="path-kicker">Your cohort</p>
          <h3>{config.path.topTitle}</h3>
          <p className="mv-what" style={{ marginTop: 8 }}>
            {config.path.topMessage}
          </p>
        </div>
      )}
      {levers.length ? (
        <div className="levers rise" style={{ "--i": 8 }}>
          <h3>{config.resultCopy.leverIntro}</h3>
          {levers.map((d) => (
            <div key={d.id} className="lever-row" style={{ "--lever-color": `var(--${d.color}-deep)` }}>
              <span className="ln">{d.numeral}</span>
              <p>
                <b>{d.name}.</b> {d.lever}
              </p>
            </div>
          ))}
          <p className="field-hint" style={{ marginTop: 14 }}>
            {config.resultCopy.retestFraming}
          </p>
        </div>
      ) : null}
      <div className="membership rise" style={{ "--i": 9 }}>
        <p className="m-kicker">Experiment U™ membership</p>
        <h3>
          This number is <em>day one</em>.
        </h3>
        <p>
          Members keep the experiment running: guided protocols between now and your Week-8 retest, and
          the delta that proves what changed.
        </p>
        <ul>
          <li>Your Week-8 retest and delta report</li>
          <li>Weekly protocols from Dr. Jen Ashton, built on your five domains</li>
          <li>Your sealed report, archived and compared over time</li>
        </ul>
        <button type="button" className="primary-btn" onClick={(e) => e.preventDefault()}>
          Continue your experiment
        </button>
        <p className="m-price">Membership pricing revealed at the event · prototype placeholder</p>
      </div>
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
        <button
          type="button"
          className="ghost-btn"
          style={{ flex: 1 }}
          onClick={() => {
            setCurrentEntryId(entry.id);
            router.push("/report");
          }}
        >
          View your sealed report
        </button>
      </div>
      <p className="honesty rise" style={{ "--i": 11 }}>
        {config.honesty.footer} {config.honesty.bpCitation}
      </p>
    </div>
  );
}
