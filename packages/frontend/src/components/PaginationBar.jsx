// packages/frontend/src/components/PaginationBar.jsx
import Icon from "./Icon";

export default function PaginationBar({ pagination, onPageChange, onLimitChange }) {
  if (!pagination || pagination.total === 0) return null;

  const { page, limit, total, totalPages, hasNext, hasPrev } = pagination;
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-surface-container-lowest rounded-md border border-outline-variant/30 text-xs text-on-surface">
      {/* Indicateur de volume */}
      <div className="flex items-center gap-2">
        <span className="text-on-surface-variant">
          Affichage de <strong className="text-on-surface font-mono">{startItem}</strong> à <strong className="text-on-surface font-mono">{endItem}</strong> sur <strong className="text-primary font-mono">{total}</strong> enregistrement(s)
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Sélecteur de taille de page */}
        <div className="flex items-center gap-1.5">
          <span className="text-on-surface-variant text-[11px]">Par page :</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value))}
            className="h-8 rounded bg-surface border border-outline-variant/40 px-2 text-xs font-semibold outline-none focus:border-primary"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Boutons de navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onPageChange(1)}
            className="w-8 h-8 rounded border border-outline-variant/40 flex items-center justify-center hover:bg-surface-container disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Première page"
          >
            <Icon name="first_page" className="text-[18px]" />
          </button>

          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onPageChange(page - 1)}
            className="w-8 h-8 rounded border border-outline-variant/40 flex items-center justify-center hover:bg-surface-container disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Page précédente"
          >
            <Icon name="chevron_left" className="text-[18px]" />
          </button>

          <span className="px-2.5 py-1 font-mono font-bold text-xs bg-primary-light text-primary rounded border border-primary/20">
            {page} / {totalPages}
          </span>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(page + 1)}
            className="w-8 h-8 rounded border border-outline-variant/40 flex items-center justify-center hover:bg-surface-container disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Page suivante"
          >
            <Icon name="chevron_right" className="text-[18px]" />
          </button>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(totalPages)}
            className="w-8 h-8 rounded border border-outline-variant/40 flex items-center justify-center hover:bg-surface-container disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Dernière page"
          >
            <Icon name="last_page" className="text-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}