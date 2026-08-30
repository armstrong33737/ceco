// packages/frontend/src/design-system/data-grid/TablePagination.jsx
import React from "react";
import Icon from "../../components/Icon";

export default function TablePagination({
  pagination,
  onPageChange,
  onLimitChange,
  className = "",
}) {
  if (!pagination || pagination.total === 0) return null;

  const { page, limit, total, totalPages, hasNext, hasPrev } = pagination;
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-surface rounded border border-border text-caption text-ink-primary dark:bg-surface-dark dark:border-border-dark dark:text-ink-primary-dark ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-ink-secondary dark:text-ink-secondary-dark">
          Affichage de <strong className="font-mono text-ink-primary dark:text-white">{startItem}</strong> à <strong className="font-mono text-ink-primary dark:text-white">{endItem}</strong> sur <strong className="font-mono text-brand-900 font-bold dark:text-brand-500">{total}</strong> enregistrement(s)
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-ink-muted text-[11px] uppercase font-semibold">Par page :</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
            className="h-8 rounded bg-surface border border-border px-2 text-caption font-semibold outline-none focus:border-brand-700 dark:bg-surface-dark dark:border-border-dark"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onPageChange(1)}
            className="w-8 h-8 rounded border border-border flex items-center justify-center hover:bg-[#F5F7FA] disabled:opacity-30 disabled:pointer-events-none transition-colors dark:border-border-dark dark:hover:bg-[#13263A]"
            title="Première page"
          >
            <Icon name="first_page" className="text-[18px]" />
          </button>

          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onPageChange(page - 1)}
            className="w-8 h-8 rounded border border-border flex items-center justify-center hover:bg-[#F5F7FA] disabled:opacity-30 disabled:pointer-events-none transition-colors dark:border-border-dark dark:hover:bg-[#13263A]"
            title="Page précédente"
          >
            <Icon name="chevron_left" className="text-[18px]" />
          </button>

          <span className="px-3 py-1 font-mono font-bold text-caption bg-brand-900/10 text-brand-900 rounded border border-brand-900/20 dark:bg-brand-500/20 dark:text-white dark:border-brand-500/40">
            {page} / {totalPages}
          </span>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(page + 1)}
            className="w-8 h-8 rounded border border-border flex items-center justify-center hover:bg-[#F5F7FA] disabled:opacity-30 disabled:pointer-events-none transition-colors dark:border-border-dark dark:hover:bg-[#13263A]"
            title="Page suivante"
          >
            <Icon name="chevron_right" className="text-[18px]" />
          </button>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(totalPages)}
            className="w-8 h-8 rounded border border-border flex items-center justify-center hover:bg-[#F5F7FA] disabled:opacity-30 disabled:pointer-events-none transition-colors dark:border-border-dark dark:hover:bg-[#13263A]"
            title="Dernière page"
          >
            <Icon name="last_page" className="text-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}