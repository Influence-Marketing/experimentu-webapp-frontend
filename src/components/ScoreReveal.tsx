"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AreaScore, Entry, Flag, ScoreResult } from "@/lib/types";
import { useContent } from "./ContentProvider";
import { useFlow } from "./FlowProvider";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function FlagCard({ flag, style }: { flag: Flag; style?: React.CSSProperties }) {
  const soft = flag.severity === "note" || flag.severity === "retake";
  return (
    <div className={`flag-card rise${soft ? " check" : ""}${flag.critical ? " critical" : ""}`} style={style}>
      <p className="flag-kicker">
        <span>●</span> {flag.eyebrow}
      </p>
      {flag.title ? <h3>{flag.title}</h3> : null}
      {flag.message ? <p>{flag.message.charAt(0).toUpperCase() + flag.message.slice(1)}</p> : null}
    </div>
  );
}

/** One area: its points out of 20 (or "not scored"), the paragraph, and each component on a line. */
export function AreaCard({ area, color, drawn, index, showDelta }: { area: AreaScore; color: string; drawn: boolean; index: number; showDelta: boolean }) {
  const scored = area.points !== null;
  return (
    <div className="area-card" style={{ "--bar-color": `var(--${color}-deep)` }}>
      <div className="bar-head">
        <span className="bh-name">
          <span className="bh-numeral">{area.numeral}</span>
          {area.name}
        </span>
        <span className="bh-pts">
          {scored ? area.points : "—"}
          <small>/ {area.max}</small>
          {showDelta && area.delta !== null ? (
            <small className={`bh-delta${area.delta < 0 ? " down" : ""}`}>
              {area.delta >= 0 ? "+" : ""}
              {area.delta}
            </small>
          ) : null}
        </span>
      </div>
      <div className="bar-track">
        <div
          className={`bar-fill${drawn ? " drawn" : ""}`}
          style={{ "--bar-pct": (area.points ?? 0) / area.max, "--bar-delay": `${index * 140}ms` }}
        />
      </div>
      {!scored && area.notScored ? <p className="area-not-scored">Not scored — {area.notScored}</p> : null}
      {area.paragraph ? <p className="area-para">{area.paragraph}</p> : null}
      {area.components.length ? (
        <ul className="component-list">
          {area.components.map((c) => (
            <li key={c.measure} className={c.flag ? "flagged" : ""}>
              <span className="c-measure">{c.measure}</span>
              <span className="c-value">{c.value}</span>
              <span className="c-standing">
                {c.label}
                {c.line ? <span className="c-line">{c.line}</span> : null}
                {c.note ? <span className="c-note">{c.note}</span> : null}
              </span>
              <span className="c-pts">
                {c.points === null ? "—" : c.points} / {c.max}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ScoreReveal({ entry }: { entry: Entry & { result: ScoreResult } }) {
  const router = useRouter();
  const { reset, setCurrentEntryId } = useFlow();
  const { config } = useContent();
  const { result, participant, phase } = entry;
  const [display, setDisplay] = useState(0);
  const [barsDrawn, setBarsDrawn] = useState(false);
  const frame = useRef<number | null>(null);
  const colors = Object.fromEntries(config.protocols.map((p) => [p.id, p.color]));
  const sameScale = result.baselineOutOf !== null && result.baselineOutOf === result.outOf;
  const delta = result.deltaTotal;
  const unscored = result.areas.filter((a) => a.points === null).length;

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
      <div className="rise" style={{ "--i": 1 }}>
        <div className="score-ring-xl" style={{ "--ringScore": (display / result.outOf) * 100 }}>
          <span className="score-num">{display}</span>
          <span className="score-of">
            {result.scoreLabel ?? "Your U Score™"} / {result.outOf}
          </span>
        </div>
      </div>
      {result.word ? (
        <h1 className="quintile-word rise" style={{ "--i": 2 }}>
          {result.word}
          <span className="full-stop">.</span>
        </h1>
      ) : (
        <h1 className="quintile-word rise" style={{ "--i": 2 }}>
          {result.total} of {result.outOf}
          <span className="full-stop">.</span>
        </h1>
      )}
      {result.word && result.cohortScale.length ? (
        <div className="quintile-scale rise" style={{ "--i": 3 }} aria-label="Where your score lands">
          {result.cohortScale.map((q) => (
            <div key={q.name} className={`qs-band${q.current ? " here" : ""}`}>
              <span className="qs-range">{q.range ?? `${q.min}–${q.max ?? 100}`}</span>
              <span className="qs-name">{q.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      {!result.word ? (
        <p className="reveal-framing rise" style={{ "--i": 3 }}>
          {unscored} of your five areas {unscored === 1 ? "was" : "were"} not scored today, so there is no total word. Each area below stands on its own.
        </p>
      ) : null}
      {result.cohortDetail?.tagline ? (
        <p className="quintile-meaning rise" style={{ "--i": 3 }}>
          {result.cohortDetail.tagline}
        </p>
      ) : null}
      <p className="reveal-framing rise" style={{ "--i": 4 }}>
        {result.overall ?? result.resultEyebrow}
      </p>
      {entry.phase === "week8" && result.baselineTotal !== null ? (
        sameScale && delta !== null ? (
          <div className={`delta-chip rise${delta < 0 ? " down" : ""}`} style={{ "--i": 4 }}>
            {delta >= 0 ? "▲" : "▼"} {delta >= 0 ? "+" : ""}
            {delta} since your baseline ({result.baselineTotal})
          </div>
        ) : (
          <div className="delta-chip rise" style={{ "--i": 4 }}>
            Baseline {result.baselineTotal} of {result.baselineOutOf} — compare each area below, not the totals.
          </div>
        )
      ) : null}
      {result.flags.map((flag, i) => (
        <FlagCard key={flag.id} flag={flag} style={{ "--i": 5 + i }} />
      ))}
      {result.flags.length && result.flagsFraming ? (
        <p className="flag-framing rise" style={{ "--i": 6 }}>
          {result.flagsFraming}
        </p>
      ) : null}
      <div className="breakdown rise" style={{ "--i": 6 }}>
        <p className="breakdown-label">Five areas · 20 points each</p>
        {result.areas.map((area, i) => (
          <AreaCard key={area.key} area={area} color={colors[area.key] ?? "cranberry"} drawn={barsDrawn} index={i} showDelta={entry.phase === "week8"} />
        ))}
      </div>
      {result.recorded.length ? (
        <div className="report-extras rise" style={{ "--i": 7 }}>
          <h4>Also recorded — on your report, not scored</h4>
          {result.recorded.map((r) => (
            <p key={r.key}>
              <b>{r.label}:</b> {r.value} · {r.standing}
              {r.note ? ` · ${r.note}` : ""}
            </p>
          ))}
        </div>
      ) : null}
      {result.cohortDetail?.body ? (
        <div className="path-card rise" style={{ "--i": 8 }}>
          <p className="path-kicker">{result.cohortDetail.name}</p>
          <p className="mv-what">{result.cohortDetail.body}</p>
        </div>
      ) : null}
      {result.membership.headline ? (
        <div className="membership rise" style={{ "--i": 9 }}>
          {result.membership.eyebrow ? <p className="m-kicker">{result.membership.eyebrow}</p> : null}
          <h3>{result.membership.headline}</h3>
          {result.membership.body ? <p>{result.membership.body}</p> : null}
          {result.membership.bullets.length ? (
            <ul>
              {result.membership.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
          {result.membership.button ? (
            <button type="button" className="primary-btn" onClick={(e) => e.preventDefault()}>
              {result.membership.button}
            </button>
          ) : null}
          {result.membership.priceNote ? <p className="m-price">{result.membership.priceNote}</p> : null}
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
      {result.disclaimer ? (
        <p className="honesty rise" style={{ "--i": 11 }}>
          {result.disclaimer}
        </p>
      ) : null}
    </div>
  );
}
