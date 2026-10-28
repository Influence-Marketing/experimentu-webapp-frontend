// Client-side range checks for the protocol screens, from the same input specs
// the fields render with. The server validates again against its scoring
// config; this only stops a guest before a round trip.
import type {
  BpInput,
  BpReading,
  Domain,
  DomainInputState,
  MeasureUnit,
  NumberInput,
  ReadingsInput,
  WaistHeightInput,
} from "./types";

export type RangeIssue = { field: string; message: string };

export function inRange(value: number | null | undefined, min: number, max: number) {
  return value == null || !Number.isFinite(value) || (value >= min && value <= max);
}

export function rangeMessage(label: string, min: number, max: number, unit?: string) {
  const u = unit ? ` ${unit}` : "";
  return `${label}: enter a value between ${min} and ${max}${u}.`;
}

export function rangeIssues(domain: Domain, inputs: DomainInputState, upgradeValue: number | null): RangeIssue[] {
  const issues: RangeIssue[] = [];
  switch (domain.inputType) {
    case "readings": {
      const spec = domain.input as ReadingsInput;
      ((inputs.readings as Array<number | null> | undefined) ?? []).forEach((r, i) => {
        if (!inRange(r, spec.min, spec.max)) {
          issues.push({ field: `reading-${i}`, message: rangeMessage(`${spec.readingLabel} ${i + 1}`, spec.min, spec.max, spec.unit) });
        }
      });
      break;
    }
    case "number": {
      const spec = domain.input as NumberInput;
      if (!inRange(inputs.value, spec.min, spec.max)) {
        issues.push({ field: "value", message: rangeMessage(spec.label, spec.min, spec.max, spec.unit) });
      }
      break;
    }
    case "waist-height": {
      const spec = domain.input as WaistHeightInput;
      const unit = (inputs.unit ?? spec.defaultUnit) as MeasureUnit;
      if (!inRange(inputs.waist, spec.waist[unit].min, spec.waist[unit].max)) {
        issues.push({ field: "waist", message: rangeMessage(spec.waist.label, spec.waist[unit].min, spec.waist[unit].max, unit) });
      }
      if (!inRange(inputs.height, spec.height[unit].min, spec.height[unit].max)) {
        issues.push({ field: "height", message: rangeMessage(spec.height.label, spec.height[unit].min, spec.height[unit].max, unit) });
      }
      break;
    }
    case "bp-readings": {
      const spec = domain.input as BpInput;
      ((inputs.readings as BpReading[] | undefined) ?? []).forEach((r, i) => {
        if (!inRange(r?.systolic, spec.systolic.min, spec.systolic.max)) {
          issues.push({ field: `sys-${i}`, message: rangeMessage(`Reading ${i + 1} ${spec.systolic.label}`, spec.systolic.min, spec.systolic.max, spec.systolic.unit) });
        }
        if (!inRange(r?.diastolic, spec.diastolic.min, spec.diastolic.max)) {
          issues.push({ field: `dia-${i}`, message: rangeMessage(`Reading ${i + 1} ${spec.diastolic.label}`, spec.diastolic.min, spec.diastolic.max, spec.diastolic.unit) });
        }
      });
      break;
    }
    default:
      break;
  }
  if (domain.upgrade && !inRange(upgradeValue, domain.upgrade.min, domain.upgrade.max)) {
    issues.push({ field: "upgrade", message: rangeMessage(domain.upgrade.label, domain.upgrade.min, domain.upgrade.max, domain.upgrade.unit) });
  }
  return issues;
}
