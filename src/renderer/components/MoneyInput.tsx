import { useId, type InputHTMLAttributes } from "react";

interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> {
  label: string;
  helperText?: string;
  error?: string;
}

export function MoneyInput({
  label,
  helperText,
  error,
  id,
  ...inputProps
}: MoneyInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const describedBy = error ? errorId : helperText ? helperId : undefined;

  return (
    <div className="field-group" data-invalid={Boolean(error)}>
      <label htmlFor={inputId}>{label}</label>
      <div className="money-input-wrap">
        <span aria-hidden="true">UGX</span>
        <input
          {...inputProps}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          id={inputId}
          inputMode="numeric"
          min={0}
          step={1}
          type="number"
        />
      </div>
      {helperText && !error ? <small id={helperId}>{helperText}</small> : null}
      {error ? (
        <small className="field-error" id={errorId}>
          {error}
        </small>
      ) : null}
    </div>
  );
}
