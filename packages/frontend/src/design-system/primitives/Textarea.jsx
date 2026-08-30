// packages/frontend/src/design-system/primitives/Textarea.jsx
import React, { forwardRef } from "react";
import Icon from "../../components/Icon";

const Textarea = forwardRef(function Textarea(
  {
    label,
    id,
    error,
    helperText,
    required = false,
    rows = 3,
    className = "",
    wrapperClassName = "",
    disabled = false,
    ...props
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "_") : undefined);

  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-caption font-semibold uppercase tracking-wider text-ink-secondary select-none dark:text-ink-secondary-dark"
        >
          {label} {required && <span className="text-error font-bold">*</span>}
        </label>
      )}

      <textarea
        id={inputId}
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={`w-full rounded bg-surface px-3 py-2 text-body text-ink-primary outline-none border transition-colors duration-instant resize-y placeholder:text-ink-muted/50 dark:bg-surface-dark dark:text-ink-primary-dark ${
          error
            ? "border-error focus:border-error focus:ring-1 focus:ring-error"
            : "border-border hover:border-border-strong-light focus:border-brand-700 focus:ring-1 focus:ring-brand-700 dark:border-border-dark dark:focus:border-brand-500"
        } disabled:bg-[#F5F7FA] disabled:text-ink-muted disabled:cursor-not-allowed dark:disabled:bg-[#07111D] ${className}`}
        {...props}
      />

      {error ? (
        <p className="text-caption text-error font-medium flex items-center gap-1 dark:text-error-dark">
          <Icon name="error" className="text-[14px]" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="text-caption text-ink-muted dark:text-ink-muted-dark">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Textarea;