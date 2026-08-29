// packages/frontend/src/components/PaginationBar.jsx
import Icon from "./Icon";

export default function PaginationBar({ pagination, onPageChange, onLimitChange }) {
  if (!pagination || pagination.total === 0) return null;

  const { page, limit, total, totalPages, hasNext, hasPrev } = pagination;
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-2xs text-xs text-slate-700 select-none">
      {/* 1. Indicateur de Volume Réel */}
      <div className="flex items-center gap-2">
        <span className="text-slate-500">
          Affichage de <strong className="text-slate-900 font-mono">{startItem}</strong> à <strong className="text-slate-900 font-mono">{endItem}</strong> sur <strong className="text-blue-700 font-mono font-bold">{total}</strong> enregistrement(s)
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* 2. Sélecteur de Lignes par Page */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-[11px] font-medium">Lignes par page :</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
            className="h-8 rounded bg-slate-50 border border-slate-300 px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-700 focus:bg-white"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* 3. Contrôles de Navigation Séquentielle */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onPageChange(1)}
            className="w-8 h-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Première page"
          >
            <Icon name="first_page" className="text-[18px]" />
          </button>

          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onPageChange(page - 1)}
            className="w-8 h-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Page précédente"
          >
            <Icon name="chevron_left" className="text-[18px]" />
          </button>

          <span className="px-2.5 py-1 font-mono font-bold text-xs bg-blue-50 text-blue-700 rounded border border-blue-200">
            {page} / {totalPages}
          </span>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(page + 1)}
            className="w-8 h-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Page suivante"
          >
            <Icon name="chevron_right" className="text-[18px]" />
          </button>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(totalPages)}
            className="w-8 h-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Dernière page"
          >
            <Icon name="last_page" className="text-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}