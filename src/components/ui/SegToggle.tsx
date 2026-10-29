"use client";

type Props<T extends string> = {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  labels?: string[];
  disabled?: boolean;
  ariaLabel?: string;
};

export function SegToggle<T extends string>({ options, value, onChange, labels, disabled, ariaLabel }: Props<T>) {
  return (
    <div className="seg-toggle" role="group" aria-label={ariaLabel}>
      {options.map((option, i) => (
        <button
          key={option}
          type="button"
          className={value === option ? "active" : ""}
          aria-pressed={value === option}
          disabled={disabled}
          onClick={() => onChange(option)}
        >
          {labels ? labels[i] : option}
        </button>
      ))}
    </div>
  );
}
