// packages/frontend/src/design-system/layout/Card.jsx
import React from "react";
import Icon from "../../components/Icon";

export function StructuredPanel({
  title,
  subtitle,
  icon,
  headerAction,
  footer,
  children,
  className = "",
  bodyClassName = "",
}) {
  return (
    <div className={`rounded bg-surface border border-border shadow-xs dark:bg-surface-dark dark:border-border-dark ${className}`}>
      {(title || icon || headerAction) && (
        <div className="flex items-center justify-between border-b border-border px-6 py-4 dark:border-border-dark">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-brand-900/5 text-brand-900 dark:bg-brand-500/10 dark:text-brand-500">
                <Icon name={icon} className="text-[18px]" />
              </div>
            )}
            <div>
              {title && <h3 className="text-body-md font-semibold text-ink-primary font-sans dark:text-ink-primary-dark">{title}</h3>}
              {subtitle && <p className="text-caption text-ink-muted dark:text-ink-muted-dark">{subtitle}</p>}
            </div>
          </div>
          {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
        </div>
      )}

      <div className={`p-6 ${bodyClassName}`}>{children}</div>

      {footer && (
        <div className="border-t border-border bg-[#FAFBFD] px-6 py-3.5 dark:border-border-dark dark:bg-[#07111D]/40">
          {footer}
        </div>
      )}
    </div>
  );
}

export function DataModule({
  label,
  value,
  subtext,
  icon,
  badge,
  action,
  className = "",
}) {
  return (
    <div className={`flex flex-col justify-between rounded bg-surface border border-border p-5 shadow-xs dark:bg-surface-dark dark:border-border-dark ${className}`}>
      <div className="flex items-center justify-between text-ink-secondary dark:text-ink-secondary-dark">
        <span className="text-caption font-semibold uppercase tracking-wider">{label}</span>
        {icon && <Icon name={icon} className="text-[18px] text-ink-muted dark:text-ink-muted-dark" />}
      </div>

      <div className="mt-3">
        <div className="text-h2 font-heading font-semibold text-ink-primary tracking-tight dark:text-ink-primary-dark">{value}</div>
        {subtext && <p className="text-caption text-ink-muted mt-0.5 dark:text-ink-muted-dark">{subtext}</p>}
      </div>

      {(badge || action) && (
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between dark:border-border-dark">
          {badge}
          {action}
        </div>
      )}
    </div>
  );
}