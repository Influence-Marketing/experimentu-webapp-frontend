"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { scoringConfig } from "@/lib/scoring-config";
import { scoreDomain } from "@/lib/scoring";
import { intakeComplete } from "@/lib/storage";
import type { Domain } from "@/lib/types";
import { useFlow } from "./FlowProvider";
import { DomainFields } from "./DomainInputs";
import { NumberField } from "./ui/NumberField";

export function ProtocolScreen({ domain }: { domain: Domain }) {
  const router = useRouter();
  const { flow, setDomainInputs, setUpgrade, completeProtocols, ready } = useFlow();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const index = scoringConfig.domains.findIndex((d) => d.id === domain.id);
  const n = index + 1;
  const total = scoringConfig.domains.length;
  const inputs = flow.inputs[domain.id] || {};
  const upgradeValue = domain.upgrade ? (flow.upgrades[domain.upgrade.key] ?? null) : null;
  const canContinue = useMemo(
    () => scoreDomain(domain, inputs, flow.participant) != null,
    [domain, inputs, flow.participant],
  );

  useEffect(() => {
    if (ready && !intakeComplete(flow.participant)) router.replace("/");
  }, [ready, flow.participant, router]);

  if (!ready || !intakeComplete(flow.participant)) return null;

  const goBack = () => {
    if (index === 0) router.push("/");
    else router.push(`/protocol/${scoringConfig.domains[index - 1].id}`);
  };

  const goNext = () => {
    if (n === total) {
      completeProtocols();
      router.push("/score");
      return;
    }
    router.push(`/protocol/${scoringConfig.domains[n].id}`);
  };

  return (
    <div style={{ "--domain-color": `var(--${domain.color}-deep)` }}>
      <div className="progress-rail rise" style={{ "--i": 0 }}>
        {scoringConfig.domains.map((d, i) => (
          <span key={d.id} className={`seg${i + 1 < n ? " done" : i + 1 === n ? " current" : ""}`} />
        ))}
        <span className="progress-count">
          {n} / {total}
        </span>
      </div>
      <div className="protocol-head rise" style={{ "--i": 1 }}>
        <span className="ghost-numeral">{domain.numeral}</span>
        <div className="kicker">
          <span>Protocol {domain.numeral}</span>
          <span className="accent">{domain.name}</span>
        </div>
        <h1>{domain.metric}</h1>
        <p className="tagline">{domain.tagline}</p>
      </div>
      <div className="howto rise" style={{ "--i": 2 }}>
        <p className="howto-label">The protocol</p>
        <ol>
          {domain.howTo.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <div className="rise" style={{ "--i": 3 }}>
        <DomainFields
          domain={domain}
          inputs={inputs}
          onInputs={(next) => setDomainInputs(domain.id, next)}
          participant={flow.participant}
        />
      </div>
      {domain.upgrade ? (
        <div className={`upgrade rise${upgradeOpen ? " open" : ""}`} style={{ "--i": 4 }}>
          <button type="button" className="upgrade-toggle" onClick={() => setUpgradeOpen(!upgradeOpen)}>
            <span>{domain.upgrade.prompt}</span>
            <span className="chev">+</span>
          </button>
          {upgradeOpen ? (
            <div className="upgrade-body">
              <label className="field-label">{domain.upgrade.label}</label>
              <NumberField
                value={upgradeValue}
                onChange={(v) => setUpgrade(domain.upgrade!.key, v)}
                min={domain.upgrade.min}
                max={domain.upgrade.max}
                unit={domain.upgrade.unit}
                ariaLabel={domain.upgrade.label}
              />
              <p className="upgrade-note">{domain.upgrade.note}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="btn-row rise" style={{ "--i": 5 }}>
        <button type="button" className="back-link" onClick={goBack}>
          Back
        </button>
        <button type="button" className="primary-btn" disabled={!canContinue} onClick={goNext}>
          {n === total
            ? "Reveal my U Score™"
            : `Continue to Protocol ${scoringConfig.domains[n].numeral}`}
        </button>
      </div>
    </div>
  );
}
