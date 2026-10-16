"use client";

import { useRouter } from "next/navigation";
import { scoringConfig } from "@/lib/scoring-config";
import { intakeComplete } from "@/lib/storage";
import { useFlow } from "./FlowProvider";
import { NumberField } from "./ui/NumberField";
import { SegToggle } from "./ui/SegToggle";
import type { Phase } from "@/lib/types";

export function WelcomeForm() {
  const router = useRouter();
  const { flow, setParticipant } = useFlow();
  const p = flow.participant;
  const ready = intakeComplete(p);

  return (
    <div>
      <div className="welcome-hero">
        <span className="u-glyph rise" style={{ "--i": 0 }}>
          U.
        </span>
        <h1 className="rise" style={{ "--i": 1 }}>
          Advice is cheap.
          <br />
          <em>Evidence</em> is yours.
        </h1>
        <p className="lede rise" style={{ "--i": 2 }}>
          Five measurements. Five minutes. One number that marks where your experiment begins — and what
          to remeasure in eight weeks.
        </p>
      </div>
      <div className="protocol-strip rise" style={{ "--i": 3 }}>
        {scoringConfig.domains.map((d) => (
          <div key={d.id} className="chip" style={{ "--chip-color": `var(--${d.color}-deep)` }}>
            <span className="n">{d.numeral}</span>
            <span className="t">{d.name.split(" ")[0]}</span>
          </div>
        ))}
      </div>
      <div className="rise" style={{ "--i": 4 }}>
        <div className="field-block phase-select">
          <label className="field-label">Session</label>
          <SegToggle
            options={["baseline", "week8"] as Phase[]}
            labels={["Baseline", "Week-8 retest"]}
            value={p.phase}
            onChange={(phase) => setParticipant({ phase })}
          />
        </div>
        <div className="field-block">
          <label className="field-label">First name</label>
          <input
            className="text-input"
            type="text"
            autoComplete="given-name"
            placeholder="Jen"
            value={p.firstName}
            onChange={(e) => setParticipant({ firstName: e.target.value })}
          />
        </div>
        <div className="field-block">
          <label className="field-label">
            Email <span className="opt">— for your sealed report</span>
          </label>
          <input
            className="text-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={p.email}
            onChange={(e) => setParticipant({ email: e.target.value })}
          />
        </div>
        <div className="field-block">
          <label className="field-label">Age</label>
          <NumberField
            value={p.age}
            onChange={(age) => setParticipant({ age })}
            min={18}
            max={105}
            unit="yrs"
            placeholder="52"
            ariaLabel="Age in years"
          />
        </div>
        <div className="field-block">
          <label className="field-label">
            One word <span className="opt">— your biggest health fear</span>
          </label>
          <input
            className="text-input"
            type="text"
            placeholder="invisible"
            maxLength={24}
            value={p.fearWord}
            onChange={(e) => setParticipant({ fearWord: e.target.value.split(/\s+/)[0] || "" })}
          />
          <p className="fear-note">Anonymous. Your word joins the fear wall — never with your name on it.</p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="primary-btn"
            disabled={!ready}
            onClick={() => router.push(`/protocol/${scoringConfig.domains[0].id}`)}
          >
            Begin Protocol I
          </button>
        </div>
      </div>
    </div>
  );
}
