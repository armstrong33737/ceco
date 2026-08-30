// packages/frontend/src/design-system/layout/PageHeader.jsx
import React from "react";
import Badge from "../primitives/Badge";

export default function PageHeader({
  contextBadge,
  title,
  subtitle,
  actions,
  className = "",
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface p-6 rounded border border-border shadow-xs dark:bg-surface-dark dark:border-border-dark ${className}`}>
      <div className="space-y-1">
        {contextBadge && (
          <div className="flex items-center gap-2 mb-1">
            {typeof contextBadge === "string" ? (
              <Badge variant="brand">{contextBadge}</Badge>
            ) : (
              contextBadge
            )}
          </div>
        )}
        <h1 className="text-h3 font-heading font-semibold text-ink-primary tracking-tight dark:text-ink-primary-dark">
          {title}
        </h1>
        {subtitle && <p className="text-body text-ink-secondary dark:text-ink-secondary-dark">{subtitle}</p>}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">{actions}</div>}
    </div>
  );
}