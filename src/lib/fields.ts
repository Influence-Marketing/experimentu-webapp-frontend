// Helpers over a protocol's field specs: the active range of a number field, the fields a
// screen should show, the payload a protocol submits and the inputs read back from a saved
// submission. The server validates again against its scoring config.
import type { ProtocolSubmissionPayload, ProtocolSubmissionValues } from "./api/statamic";
import { measureUnit } from "./protocols";
import type { DomainInputState, FieldSpec, FieldValue, Protocol } from "./types";

export type RangeIssue = { field: string; message: string };

/** A number field's min, max, unit and placeholder, following the protocol's units when it has them. */
export function numberRange(field: FieldSpec, inputs: DomainInputState) {
  if (field.byUnit) {
    const unit = measureUnit(inputs);
    return { ...field.byUnit[unit], unit, step: unit === "cm" ? 1 : 0.5 };
  }
  return { min: field.min ?? 0, max: field.max ?? 999, placeholder: field.placeholder ?? "", unit: field.unit ?? "", step: field.step ?? 1 };
}

export function visibleFields(protocol: Protocol, inputs: DomainInputState): FieldSpec[] {
  return protocol.groups.flatMap((g) => g.fields).filter((f) => !f.showIf || f.showIf(inputs));
}

export function rangeIssues(protocol: Protocol, inputs: DomainInputState): RangeIssue[] {
  const issues: RangeIssue[] = [];
  for (const field of visibleFields(protocol, inputs)) {
    if (field.kind !== "number") continue;
    const value = inputs[field.handle];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const { min, max, unit } = numberRange(field, inputs);
    if (value < min || value > max) {
      issues.push({ field: field.handle, message: `${field.label}: enter a value between ${min} and ${max}${unit ? ` ${unit}` : ""}.` });
    }
  }
  return issues;
}

/** A protocol's answers keyed by its form handles; empty answers are left out so the server sees them as blank. */
export function toProtocolPayload(protocol: Protocol, inputs: DomainInputState): ProtocolSubmissionPayload {
  const out: ProtocolSubmissionPayload = {};
  const put = (handle: string, value: FieldValue | undefined) => {
    if (value === null || value === undefined || value === "") return;
    if (typeof value === "number" && !Number.isFinite(value)) return;
    out[handle] = value;
  };
  const visible = new Set(visibleFields(protocol, inputs).map((f) => f.handle));
  for (const [handle, value] of Object.entries(inputs)) {
    if (visible.has(handle)) put(handle, value);
  }
  for (const readout of protocol.derived ?? []) {
    if (readout.handle) put(readout.handle, readout.compute(inputs));
  }
  for (const [handle, value] of Object.entries(protocol.derivePayload?.(inputs) ?? {})) put(handle, value);
  // A toggle left off is not sent (the server reads an absent toggle as off; "false" in some
  // channels would read as on), and a not-scored select left blank is not sent either.
  for (const field of protocol.groups.flatMap((g) => g.fields)) {
    if (field.kind === "toggle" && out[field.handle] === false) delete out[field.handle];
  }
  return out;
}

/** A saved submission (keyed by form handles) as screen inputs: toProtocolPayload in reverse. */
export function fromProtocolValues(protocol: Protocol, values: ProtocolSubmissionValues): DomainInputState {
  const inputs: DomainInputState = {};
  for (const field of protocol.groups.flatMap((g) => g.fields)) {
    const raw = values[field.handle];
    if (raw === null || raw === undefined || raw === "") continue;
    switch (field.kind) {
      case "number": {
        const n = Number(raw);
        if (Number.isFinite(n)) inputs[field.handle] = n;
        break;
      }
      case "toggle":
        inputs[field.handle] = [true, 1, "1", "true"].includes(raw as string | number | boolean);
        break;
      default:
        inputs[field.handle] = String(raw);
    }
  }
  return inputs;
}
