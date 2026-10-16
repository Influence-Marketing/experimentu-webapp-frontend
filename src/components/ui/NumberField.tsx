"use client";

type Props = {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  ariaLabel?: string;
};

export function NumberField({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
  placeholder,
  ariaLabel,
}: Props) {
  const current = Number.isFinite(value) ? value : null;
  const nudge = (dir: number) => {
    const base = current ?? (placeholder ? Number(placeholder) : min);
    onChange(Math.min(max, Math.max(min, base + dir * step)));
  };
  return (
    <div className="num-field">
      <button type="button" className="num-step" aria-label="Decrease" onClick={() => nudge(-1)}>
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={current ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          if (e.target.value === "") return onChange(null);
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : null);
        }}
      />
      {unit ? <span className="unit">{unit}</span> : null}
      <button type="button" className="num-step" aria-label="Increase" onClick={() => nudge(1)}>
        +
      </button>
    </div>
  );
}
