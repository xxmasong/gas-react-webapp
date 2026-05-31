import React from 'react';

type Props = {
  label: string;
  value: number;
  dirty?: boolean;
  onChange: (n: number) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  bare?: boolean;
};

export const StockInput: React.FC<Props> = ({
  label,
  value,
  dirty = false,
  onChange,
  onKeyDown,
  bare = false,
}) => {
  const input = (
    <input
      className={`stock-in ${dirty ? 'dirty' : ''}`.trim()}
      type="number"
      inputMode="numeric"
      min={0}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      onKeyDown={onKeyDown}
    />
  );

  if (bare) return input;

  return (
    <label className="stock-field">
      <span>{label}</span>
      {input}
    </label>
  );
};
