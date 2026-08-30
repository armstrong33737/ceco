// packages/frontend/src/design-system/primitives/Button.jsx
import React from "react";
import Icon from "../../components/Icon";

export default function Button({
  variant = "primary", // "primary" | "secondary" | "tertiary" | "danger" | "ghost"
  size = "md",         // "sm" (30px) | "md" (36px) | "lg" (40px)
  icon,
  iconPosition = "left",
  isLoading = false,
  disabled = false,
  children,
  className = "",
  type = "button",
  ...props
}) {
  const baseClasses =
    "inline-flex items-center justify-center font-sans font-medium rounded select-none transition-colors duration-instant focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "h-[30px] px-3 text-caption gap-1.5",
    md: "h-[36px] px-4 text-body-md gap-2",
    lg: "h-[40px] px-5 text-body-md gap-2.5",
  };

  const variantClasses = {
    primary:
      "bg-brand-900 text-white hover:bg-brand-800 active:bg-[#051321] disabled:bg-[#D9E0E8] disabled:text-[#738195] dark:bg-brand-500 dark:hover:bg-brand-600 dark:disabled:bg-[#24384B] dark:disabled:text-[#8190A0]",
    secondary:
      "bg-transparent border border-border text-ink-primary hover:bg-[#F5F7FA] hover:border-border-strong-light active:bg-[#EAF0F6] disabled:border-border disabled:text-ink-muted dark:text-ink-primary-dark dark:border-border-dark dark:hover:bg-[#13263A]",
    tertiary:
      "bg-transparent text-ink-secondary hover:text-brand-900 hover:bg-[#F5F7FA] active:bg-[#EAF0F6] disabled:text-ink-muted dark:text-ink-secondary-dark dark:hover:text-white dark:hover:bg-[#13263A]",
    danger:
      "bg-error text-white hover:bg-[#B91C1C] active:bg-[#991B1B] disabled:bg-error-subtle disabled:text-error/40 dark:bg-error-dark dark:hover:bg-error",
    ghost:
      "bg-transparent text-ink-primary hover:bg-[#F5F7FA] active:bg-[#EAF0F6] dark:text-ink-primary-dark dark:hover:bg-[#13263A]",
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.primary} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Icon name="progress_activity" className="animate-spin text-[16px]" />
      ) : icon && iconPosition === "left" ? (
        <Icon name={icon} className="text-[16px]" />
      ) : null}

      {children && <span>{children}</span>}

      {!isLoading && icon && iconPosition === "right" ? (
        <Icon name={icon} className="text-[16px]" />
      ) : null}
    </button>
  );
}