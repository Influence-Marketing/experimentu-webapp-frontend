"use client";

import { mean, scoreDomain } from "@/lib/scoring";
import type {
  BpInput,
  BpReading,
  Domain,
  DomainInputState,
  LabelText,
  MeasureUnit,
  NumberInput,
  Participant,
  ReadingsInput,
  WaistHeightInput,
  Who5Input,
} from "@/lib/types";
import { FieldLabel } from "./ui/FieldLabel";
import { NumberField } from "./ui/NumberField";
import { SegToggle } from "./ui/SegToggle";

function readingLabel(labels: LabelText[] | undefined, i: number, base: string, optional: string | null) {
  return labels?.[i] ?? { label: `${base} ${i + 1}`, opt: optional ?? undefined };
}

function ReadingsFields({
  domain,
  inputs,
  onInputs,
}: {
  domain: Domain;
  inputs: DomainInputState;
  onInputs: (next: DomainInputState) => void;
}) {
  const spec = domain.input as ReadingsInput;
  const readings = (inputs.readings as Array<number | null> | undefined) || [];
  const setReading = (index: number, value: number | null) => {
    const next = [...readings];
    next[index] = value;
    onInputs({ ...inputs, readings: next });
  };
  const avg = mean(readings);
  return (
    <>
      {Array.from({ length: spec.maxReadings }).map((_, i) => (
        <div className="field-block" key={i}>
          <FieldLabel
            {...readingLabel(spec.readingLabels, i, spec.readingLabel, i >= spec.minReadings ? "optional" : null)}
          />
          <NumberField
            value={readings[i] ?? null}
            onChange={(v) => setReading(i, v)}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            unit={spec.unit}
            placeholder={spec.placeholder}
            ariaLabel={`${spec.readingLabel} ${i + 1}`}
          />
        </div>
      ))}
      <div className="derived-readout">
        <span className="dr-label">{spec.averageLabel}</span>
        <span className={`dr-value${avg == null ? " placeholder" : ""}`}>
          {avg == null ? "——" : `${Math.round(avg)} ${spec.unit}`}
        </span>
      </div>
    </>
  );
}

function NumberFields({
  domain,
  inputs,
  onInputs,
  participant,
}: {
  domain: Domain;
  inputs: DomainInputState;
  onInputs: (next: DomainInputState) => void;
  participant: Participant;
}) {
  const spec = domain.input as NumberInput;
  const scoring = domain.scoring;
  const ageBands = scoring.type === "age-bands" ? scoring.ageBands : null;
  const age = participant.age ?? 0;
  const band = ageBands
    ? ageBands.find((b) => age >= b.ageMin && (b.ageMax === null || age <= b.ageMax)) || ageBands[0]
    : null;
  return (
    <>
      <div className="field-block">
        <label className="field-label">{spec.label}</label>
        <NumberField
          value={inputs.value ?? null}
          onChange={(value) => onInputs({ ...inputs, value })}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          unit={spec.unit}
          placeholder={spec.placeholder}
          ariaLabel={spec.label}
        />
      </div>
      {band ? (
        <p className="field-hint">
          Scored on the {band.label} table
          {age < 50 && scoring.type === "age-bands" ? ` — ${scoring.under50Note}` : ""}
        </p>
      ) : null}
    </>
  );
}

function WaistHeightFields({
  domain,
  inputs,
  onInputs,
}: {
  domain: Domain;
  inputs: DomainInputState;
  onInputs: (next: DomainInputState) => void;
}) {
  const spec = domain.input as WaistHeightInput;
  const unit = (inputs.unit || spec.defaultUnit) as MeasureUnit;
  const ratio =
    Number.isFinite(inputs.waist) && Number.isFinite(inputs.height) && (inputs.height ?? 0) > 0
      ? ((inputs.waist as number) / (inputs.height as number)).toFixed(2)
      : null;
  return (
    <>
      <div className="field-block">
        <label className="field-label">{spec.unitsLabel}</label>
        <SegToggle
          options={spec.units}
          labels={spec.unitLabels}
          value={unit}
          onChange={(next) => onInputs({ ...inputs, unit: next, waist: null, height: null })}
        />
      </div>
      <div className="field-row">
        <div className="field-block">
          <label className="field-label">{spec.waist.label}</label>
          <NumberField
            value={inputs.waist ?? null}
            onChange={(waist) => onInputs({ ...inputs, unit, waist })}
            min={spec.waist[unit].min}
            max={spec.waist[unit].max}
            step={unit === "cm" ? 1 : 0.5}
            unit={unit}
            placeholder={spec.waist[unit].placeholder}
            ariaLabel="Waist measurement"
          />
        </div>
        <div className="field-block">
          <label className="field-label">{spec.height.label}</label>
          <NumberField
            value={inputs.height ?? null}
            onChange={(height) => onInputs({ ...inputs, unit, height })}
            min={spec.height[unit].min}
            max={spec.height[unit].max}
            step={unit === "cm" ? 1 : 0.5}
            unit={unit}
            placeholder={spec.height[unit].placeholder}
            ariaLabel="Height measurement"
          />
        </div>
      </div>
      <div className="derived-readout">
        <span className="dr-label">{spec.ratioLabel}</span>
        <span className={`dr-value${ratio == null ? " placeholder" : ""}`}>{ratio ?? "0.——"}</span>
      </div>
      <p className="field-hint">{spec.hint}</p>
    </>
  );
}

function BpFields({
  domain,
  inputs,
  onInputs,
}: {
  domain: Domain;
  inputs: DomainInputState;
  onInputs: (next: DomainInputState) => void;
}) {
  const spec = domain.input as BpInput;
  const readings = ((inputs.readings as BpReading[] | undefined) || []).slice();
  while (readings.length < spec.maxReadings) readings.push({});
  const setReading = (index: number, key: "systolic" | "diastolic", value: number | null) => {
    const next = readings.map((r, i) => (i === index ? { ...r, [key]: value } : r));
    onInputs({ ...inputs, readings: next as BpReading[] });
  };
  const complete = readings.filter((r) => Number.isFinite(r.systolic) && Number.isFinite(r.diastolic));
  const sys = complete.length ? Math.round(mean(complete.map((r) => r.systolic))!) : null;
  const dia = complete.length ? Math.round(mean(complete.map((r) => r.diastolic))!) : null;
  return (
    <>
      {Array.from({ length: spec.maxReadings }).map((_, i) => (
        <div className="field-block" key={i}>
          <FieldLabel
            {...readingLabel(spec.readingLabels, i, "Reading", i >= spec.minReadings ? "optional, recommended" : null)}
          />
          <div className="field-row">
            <NumberField
              value={readings[i]?.systolic ?? null}
              onChange={(v) => setReading(i, "systolic", v)}
              min={spec.systolic.min}
              max={spec.systolic.max}
              unit={spec.systolic.unit}
              placeholder={spec.systolic.placeholder}
              ariaLabel={`Reading ${i + 1} systolic`}
            />
            <NumberField
              value={readings[i]?.diastolic ?? null}
              onChange={(v) => setReading(i, "diastolic", v)}
              min={spec.diastolic.min}
              max={spec.diastolic.max}
              unit={spec.diastolic.unit}
              placeholder={spec.diastolic.placeholder}
              ariaLabel={`Reading ${i + 1} diastolic`}
            />
          </div>
        </div>
      ))}
      <div className="derived-readout">
        <span className="dr-label">{spec.averageLabel}</span>
        <span className={`dr-value${sys == null ? " placeholder" : ""}`}>
          {sys == null ? "———/——" : `${sys}/${dia}`}
        </span>
      </div>
      <p className="field-hint">{spec.hint}</p>
    </>
  );
}

function Who5Fields({
  domain,
  inputs,
  onInputs,
}: {
  domain: Domain;
  inputs: DomainInputState;
  onInputs: (next: DomainInputState) => void;
}) {
  const spec = domain.input as Who5Input;
  const answers = inputs.answers || Array(spec.statements.length).fill(null);
  const setAnswer = (index: number, value: number) => {
    const next = [...answers];
    next[index] = value;
    onInputs({ ...inputs, answers: next });
  };
  return (
    <>
      {spec.statements.map((statement, i) => (
        <div className={`who5-card${Number.isFinite(answers[i]) ? " answered" : ""}`} key={statement}>
          <p className="statement">
            <em>0{i + 1}</em>
            {statement}
          </p>
          <div className="scale-dots" role="radiogroup" aria-label={statement}>
            {Array.from({ length: spec.scaleMax - spec.scaleMin + 1 }).map((_, n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={answers[i] === n}
                className={answers[i] === n ? "selected" : ""}
                onClick={() => setAnswer(i, n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="scale-caption">
            <span>{spec.scaleLabels[0]}</span>
            <span>{spec.scaleLabels[spec.scaleLabels.length - 1]}</span>
          </div>
          <p className="who5-selected-label">
            {Number.isFinite(answers[i]) ? spec.scaleLabels[answers[i] as number] : "\u00a0"}
          </p>
        </div>
      ))}
    </>
  );
}

export function DomainFields({
  domain,
  inputs,
  onInputs,
  participant,
}: {
  domain: Domain;
  inputs: DomainInputState;
  onInputs: (next: DomainInputState) => void;
  participant: Participant;
}) {
  switch (domain.inputType) {
    case "readings":
      return <ReadingsFields domain={domain} inputs={inputs} onInputs={onInputs} />;
    case "number":
      return (
        <NumberFields domain={domain} inputs={inputs} onInputs={onInputs} participant={participant} />
      );
    case "waist-height":
      return <WaistHeightFields domain={domain} inputs={inputs} onInputs={onInputs} />;
    case "bp-readings":
      return <BpFields domain={domain} inputs={inputs} onInputs={onInputs} />;
    case "who5":
      return <Who5Fields domain={domain} inputs={inputs} onInputs={onInputs} />;
    default:
      return null;
  }
}

export function domainReady(domain: Domain, inputs: DomainInputState, participant: Participant) {
  return scoreDomain(domain, inputs, participant) != null;
}
