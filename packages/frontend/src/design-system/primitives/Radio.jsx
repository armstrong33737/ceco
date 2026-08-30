// packages/frontend/src/design-system/primitives/Checkbox.jsx
import React from "react";
import Icon from "../../components/Icon";

export default function Checkbox({
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
      className={`inline-flex items-center gap-2 select-none ${
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
      <div className="w-4 h-4 rounded-[2px] border border-border bg-surface flex items-center justify-center peer-checked:bg-brand-900 peer-checked:border-brand-900 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 transition-colors duration-instant dark:bg-surface-dark dark:border-border-dark dark:peer-checked:bg-brand-500 dark:peer-checked:border-brand-500">
        {checked && <Icon name="check" className="text-[14px] text-white font-bold" />}
      </div>
      {label && <span className="text-body text-ink-primary dark:text-ink-primary-dark">{label}</span>}
    </label>
  );
}