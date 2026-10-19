import type { LabelText } from "@/lib/types";

export function FieldLabel({ label, opt }: LabelText) {
  return (
    <label className="field-label">
      {label}
      {opt ? <span className="opt"> — {opt}</span> : null}
    </label>
  );
}
