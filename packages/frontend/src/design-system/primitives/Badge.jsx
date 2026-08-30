// packages/frontend/src/design-system/primitives/Badge.jsx
import React from "react";

export default function Badge({
  variant = "neutral", // "success" | "error" | "warning" | "info" | "brand" | "neutral"
  withDot = false,
  children,
  className = "",
}) {
  const baseClasses =
    "inline-flex items-center gap-1.5 h-[24px] px-2 rounded-[2px] text-overline uppercase tracking-wider font-semibold border";

  const variantClasses = {
    success: "bg-success-subtle text-success border-success/30 dark:bg-success-subtle-dark dark:text-success-dark dark:border-success-dark/40",
    error: "bg-error-subtle text-error border-error/30 dark:bg-error-subtle-dark dark:text-error-dark dark:border-error-dark/40",
    warning: "bg-warning-subtle text-warning border-warning/30 dark:bg-warning-subtle-dark dark:text-warning-dark dark:border-warning-dark/40",
    info: "bg-info-subtle text-info border-info/30 dark:bg-info-subtle-dark dark:text-info-dark dark:border-info-dark/40",
    brand: "bg-brand-500/10 text-brand-900 border-brand-900/20 dark:bg-brand-500/20 dark:text-white dark:border-brand-500/40",
    neutral: "bg-[#F5F7FA] text-ink-secondary border-border dark:bg-[#13263A] dark:text-ink-secondary-dark dark:border-border-dark",
  };

  const dotClasses = {
    success: "bg-success dark:bg-success-dark",
    error: "bg-error dark:bg-error-dark",
    warning: "bg-warning dark:bg-warning-dark",
    info: "bg-info dark:bg-info-dark",
    brand: "bg-brand-900 dark:bg-brand-500",
    neutral: "bg-ink-muted dark:bg-ink-muted-dark",
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant] || variantClasses.neutral} ${className}`}>
      {withDot && <span className={`w-1.5 h-1.5 rounded-full ${dotClasses[variant] || dotClasses.neutral}`} />}
      <span>{children}</span>
    </span>
  );
}