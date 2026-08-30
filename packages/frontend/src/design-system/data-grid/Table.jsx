// packages/frontend/src/design-system/data-grid/Table.jsx
import React from "react";

export function Table({ children, className = "" }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full text-left text-body whitespace-nowrap border-collapse ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className = "" }) {
  return (
    <thead className={`bg-[#F5F7FA] border-b border-border dark:bg-[#07111D] dark:border-border-dark ${className}`}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = "" }) {
  return <tbody className={`divide-y divide-border dark:divide-border-dark ${className}`}>{children}</tbody>;
}

export function TableRow({ children, className = "", isClickable = false, ...props }) {
  return (
    <tr
      className={`transition-colors duration-instant hover:bg-[#F5F7FA]/70 dark:hover:bg-[#13263A]/40 ${
        isClickable ? "cursor-pointer" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHeaderCell({ children, align = "left", className = "" }) {
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return (
    <th
      className={`px-4 py-3 text-caption font-semibold uppercase tracking-wider text-ink-secondary dark:text-ink-secondary-dark ${alignClass} ${className}`}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, align = "left", className = "" }) {
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return <td className={`px-4 py-3 text-body text-ink-primary dark:text-ink-primary-dark ${alignClass} ${className}`}>{children}</td>;
}