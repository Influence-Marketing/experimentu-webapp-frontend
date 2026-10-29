import type { LabelText } from "@/lib/types";

export function FieldLabel({ label, opt, htmlFor }: LabelText & { htmlFor?: string }) {
  return (
    <label className="field-label" htmlFor={htmlFor}>
      {label}
      {opt ? <span className="opt"> — {opt}</span> : null}
    </label>
  );
}
