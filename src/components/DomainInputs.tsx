"use client";

import { numberRange, visibleFields } from "@/lib/fields";
import type { DomainInputState, FieldSpec, FieldValue, Protocol } from "@/lib/types";
import { FieldLabel } from "./ui/FieldLabel";
import { NumberField } from "./ui/NumberField";
import { SegToggle } from "./ui/SegToggle";

type FieldProps = {
  field: FieldSpec;
  value: FieldValue | undefined;
  inputs: DomainInputState;
  onChange: (value: FieldValue) => void;
};

function ScaleField({ field, value, onChange }: FieldProps) {
  const options = field.options ?? [];
  const current = value == null ? null : String(value);
  const index = options.findIndex((o) => o.key === current);
  // Arrow keys move and select within a statement; Tab moves between statements (roving tabindex).
  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>, n: number) => {
    const moves: Record<string, number> = { ArrowRight: n + 1, ArrowDown: n + 1, ArrowLeft: n - 1, ArrowUp: n - 1, Home: 0, End: options.length - 1 };
    const target = moves[e.key];
    if (target === undefined) return;
    e.preventDefault();
    const clamped = Math.min(options.length - 1, Math.max(0, target));
    onChange(options[clamped].key);
    (e.currentTarget.parentElement?.children[clamped] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className={`who5-card${current !== null ? " answered" : ""}`}>
      <p className="statement">{field.label}</p>
      <div className="scale-dots" role="radiogroup" aria-label={field.label}>
        {options.map((o, n) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={current === o.key}
            aria-label={`${o.key} — ${o.label}`}
            tabIndex={current === o.key || (current === null && n === 0) ? 0 : -1}
            className={current === o.key ? "selected" : ""}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => onKey(e, n)}
          >
            {o.key}
          </button>
        ))}
      </div>
      {field.scaleLabels ? (
        <div className="scale-caption">
          <span>{field.scaleLabels[0]}</span>
          <span>{field.scaleLabels[1]}</span>
        </div>
      ) : null}
      <p className="who5-selected-label">{index >= 0 ? options[index].label : " "}</p>
    </div>
  );
}

function ChoiceField({ field, value, onChange }: FieldProps) {
  const options = field.options ?? [];
  const current = value == null ? null : String(value);
  return (
    <div className="field-block">
      <FieldLabel label={field.label} opt={field.opt} />
      <div className="choice-row" role="radiogroup" aria-label={field.label}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={current === o.key}
            className={`choice${current === o.key ? " selected" : ""}`}
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {field.hint ? <p className="field-hint">{field.hint}</p> : null}
    </div>
  );
}

function SelectField({ field, value, onChange }: FieldProps) {
  const id = `field-${field.handle}`;
  return (
    <div className="field-block">
      <FieldLabel label={field.label} opt={field.opt} htmlFor={id} />
      <select
        id={id}
        className="text-input select-input"
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      >
        <option value="">{field.blankLabel ?? "—"}</option>
        {(field.options ?? []).map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      {field.hint ? <p className="field-hint">{field.hint}</p> : null}
    </div>
  );
}

function ToggleField({ field, value, onChange }: FieldProps) {
  return (
    <div className="field-block">
      <label className="consent-check">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <span>{field.label}</span>
      </label>
      {field.hint ? <p className="field-hint">{field.hint}</p> : null}
    </div>
  );
}

function UnitsField({ field, value, onChange }: FieldProps) {
  const options = field.options ?? [];
  const keys = options.map((o) => o.key);
  const current = value == null ? keys[0] : String(value);
  return (
    <div className="field-block">
      <FieldLabel label={field.label} opt={field.opt} />
      <SegToggle options={keys} labels={options.map((o) => o.label)} value={current} onChange={onChange} ariaLabel={field.label} />
    </div>
  );
}

function NumberInputField({ field, value, inputs, onChange }: FieldProps) {
  const range = numberRange(field, inputs);
  const id = `field-${field.handle}`;
  const aria = field.opt ? `${field.label} ${field.opt}` : field.label;
  return (
    <div className="field-block">
      <FieldLabel label={field.label} opt={field.opt} htmlFor={id} />
      <NumberField
        id={id}
        value={typeof value === "number" ? value : null}
        onChange={onChange}
        min={range.min}
        max={range.max}
        step={range.step}
        unit={range.unit}
        placeholder={range.placeholder}
        ariaLabel={aria}
      />
      {field.hint ? <p className="field-hint">{field.hint}</p> : null}
    </div>
  );
}

function Field(props: FieldProps) {
  switch (props.field.kind) {
    case "number":
      return <NumberInputField {...props} />;
    case "choice":
      return <ChoiceField {...props} />;
    case "select":
      return <SelectField {...props} />;
    case "toggle":
      return <ToggleField {...props} />;
    case "scale":
      return <ScaleField {...props} />;
    case "units":
      return <UnitsField {...props} />;
    default:
      return null;
  }
}

const WIDTH_CLASS: Record<NonNullable<FieldSpec["width"]>, string> = { half: "w-half", third: "w-third", quarter: "w-quarter" };

/** A protocol's groups of fields, with its readouts (waist ÷ height) under the group they come from. */
export function DomainFields({
  protocol,
  inputs,
  onInputs,
}: {
  protocol: Protocol;
  inputs: DomainInputState;
  onInputs: (next: DomainInputState) => void;
}) {
  const shown = new Set(visibleFields(protocol, inputs).map((f) => f.handle));
  const set = (field: FieldSpec, value: FieldValue) => {
    const next = { ...inputs, [field.handle]: value };
    // Switching units clears the measurements that were entered in the other unit.
    if (field.kind === "units") {
      for (const f of protocol.groups.flatMap((g) => g.fields)) if (f.byUnit) next[f.handle] = null;
    }
    onInputs(next);
  };
  return (
    <>
      {protocol.groups.map((group, gi) => {
        const fields = group.fields.filter((f) => shown.has(f.handle));
        if (!fields.length) return null;
        const last = gi === protocol.groups.length - 1;
        return (
          <section className="field-group" key={group.title ?? gi}>
            {group.title ? <h3 className="field-group-title">{group.title}</h3> : null}
            {group.note ? <p className="field-group-note">{group.note}</p> : null}
            <div className="field-grid">
              {fields.map((field) => (
                <div key={field.handle} className={field.width ? WIDTH_CLASS[field.width] : "w-full"}>
                  <Field field={field} value={inputs[field.handle]} inputs={inputs} onChange={(v) => set(field, v)} />
                </div>
              ))}
            </div>
            {gi === 0 || last
              ? (protocol.derived ?? []).map((readout) => {
                  const value = readout.compute(inputs);
                  if (gi !== 0) return null;
                  return (
                    <div key={readout.label}>
                      <div className="derived-readout">
                        <span className="dr-label">{readout.label}</span>
                        <span className={`dr-value${value == null ? " placeholder" : ""}`}>{value ?? readout.placeholder}</span>
                      </div>
                      {readout.hint ? <p className="field-hint">{readout.hint}</p> : null}
                    </div>
                  );
                })
              : null}
          </section>
        );
      })}
    </>
  );
}
