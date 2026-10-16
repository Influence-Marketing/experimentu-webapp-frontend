"use client";

type Props<T extends string> = {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  labels?: string[];
};

export function SegToggle<T extends string>({ options, value, onChange, labels }: Props<T>) {
  return (
    <div className="seg-toggle" role="group">
      {options.map((option, i) => (
        <button
          key={option}
          type="button"
          className={value === option ? "active" : ""}
          onClick={() => onChange(option)}
        >
          {labels ? labels[i] : option}
        </button>
      ))}
    </div>
  );
}
