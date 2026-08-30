// packages/frontend/src/design-system/primitives/Toggle.jsx
import React from "react";

export default function Toggle({
  label,
  id,
  checked = false,
  onChange,
  disabled = false,
  className = "",
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "_") : undefined);

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex items-center gap-2.5 select-none ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${className}`}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only peer"
        {...props}
      />
      <div className="relative w-9 h-5 rounded-full border border-border bg-[#D9E0E8] peer-checked:bg-brand-900 peer-checked:border-brand-900 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 transition-colors duration-instant dark:border-border-dark dark:bg-[#24384B] dark:peer-checked:bg-brand-500 dark:peer-checked:border-brand-500">
        <div
          className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform duration-instant ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
      {label && <span className="text-body text-ink-primary font-medium dark:text-ink-primary-dark">{label}</span>}
    </label>
  );
}