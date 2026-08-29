// packages/frontend/src/pages/AuditLogs.jsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import { showToast } from "../store/toastStore";
import Icon from "../components/Icon";
import PaginationBar from "../components/PaginationBar";

const ACTIONS_CATALOG = [
  { value: "", label: "Toutes les actions consignées" },
  { value: "UNLOCK_GRADES", label: "Déverrouillage de Notes (Urgence)" },
  { value: "RUN_DELIBERATION", label: "Délibération Manuelle du Jury" },
  { value: "AUTO_RUN_DELIBERATION", label: "Délibération Automatique de Classe" },
  { value: "CENTER_WIDE_DELIBERATION", label: "Délibération Tout l'Établissement" },
  { value: "RESTORE_STUDENT", label: "Restauration d'Apprenant Archivé" },
  { value: "ACTIVATE_OFFLINE_LICENSE", label: "Activation Licence Hors-Ligne" },
  { value: "CLOSE_ACADEMIC_YEAR", label: "Clôture de Session Académique" },
];

function getActionBadge(action) {
  switch (action) {
    case "UNLOCK_GRADES":
      return <span className="badge-amber">Déverrouillage Notes</span>;
    case "RUN_DELIBERATION":
    case "AUTO_RUN_DELIBERATION":
    case "CENTER_WIDE_DELIBERATION":
      return <span className="badge-blue">Délibération Jury</span>;
    case "RESTORE_STUDENT":
    case "ACTIVATE_OFFLINE_LICENSE":
      return <span className="badge-emerald">Sécurité &amp; Rétablissement</span>;
    case "CLOSE_ACADEMIC_YEAR":
      return <span className="badge-slate font-bold">Clôture Session</span>;
    default:
      return <span className="badge-slate">{action || "Opération"}</span>;
  }
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selectedAction, setSelectedAction] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedLog, setSelectedLog] = useState(null);

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(selectedAction ? { action: selectedAction } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      const res = await apiFetch(`/audit-logs?${params.toString()}`);
      setLogs(res.data || []);
      setPagination(res.pagination || null);
    } catch (err) {
      showToast(err.message || "Impossible de charger le journal d'audit.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [page, limit, selectedAction, search]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* En-tête et filtres */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-card">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Icon name="history" className="text-blue-700 text-[18px]" />
            <span>Journal d'Audit &amp; Traçabilité Système</span>
          </h3>
          <p className="text-xs text-slate-500">
            Registre immuable consignant les opérations souveraines (délibérations, déverrouillages, activations).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedAction}
            onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
            className="input-field w-56"
          >
            {ACTIONS_CATALOG.map((act) => (
              <option key={act.value} value={act.value}>{act.label}</option>
            ))}
          </select>

          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher action, cible..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field w-48 pl-8"
            />
            <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]" />
          </div>

          <button
            onClick={loadLogs}
            className="p-2 rounded border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Actualiser le journal"
          >
            <Icon name="refresh" className="text-[18px]" />
          </button>
        </div>
      </div>

      {/* Tableau des logs */}
      <div className="table-container">
        {loading && !pagination ? (
          <p className="p-8 text-xs text-slate-500 text-center">Chargement du journal d'audit...</p>
        ) : logs.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 text-center">Aucun événement ne correspond à vos critères de recherche.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell w-40">Date &amp; Heure</th>
                  <th className="table-header-cell w-48">Auteur / Compte</th>
                  <th className="table-header-cell w-48">Action Consignée</th>
                  <th className="table-header-cell">Contexte / Cible</th>
                  <th className="table-header-cell text-right">Détails JSON</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const dateStr = new Date(log.createdAt).toLocaleString("fr-FR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit", second: "2-digit",
                  });

                  return (
                    <tr key={log.id} className="table-body-row">
                      <td className="table-body-cell font-mono text-slate-900 font-bold">{dateStr}</td>
                      <td className="table-body-cell">
                        {log.author ? (
                          <div>
                            <span className="font-bold text-slate-900 block">{log.author.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{log.author.email}</span>
                          </div>
                        ) : (
                          <span className="font-mono text-slate-400 italic">Système Automatique</span>
                        )}
                      </td>
                      <td className="table-body-cell">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="table-body-cell text-slate-600">
                        {log.metadata?.classeLabel && (
                          <span className="font-bold text-slate-800 mr-1">{log.metadata.classeLabel}</span>
                        )}
                        {log.metadata?.subjectName && (
                          <span className="text-[11px] font-mono">({log.metadata.subjectName})</span>
                        )}
                        {log.metadata?.reason && (
                          <div className="text-[11px] italic text-slate-500 truncate max-w-xs">
                            « {log.metadata.reason} »
                          </div>
                        )}
                      </td>
                      <td className="table-body-cell text-right">
                        {log.metadata ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="btn-secondary text-[11px] px-2 py-1"
                          >
                            <Icon name="data_object" className="text-[14px]" />
                            <span>Payload</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination serveur */}
      <PaginationBar
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
      />

      {/* MODALE DÉTAILS JSON */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {selectedLog && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white p-5 rounded-xl shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="data_object" className="text-blue-700 text-[20px]" />
                    <h4 className="font-bold text-sm text-slate-900">Métadonnées de l'Événement</h4>
                  </div>
                  <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-700">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-1 font-mono text-[11px]">
                    <div><strong>Action :</strong> <span className="text-blue-700 font-bold">{selectedLog.action}</span></div>
                    <div><strong>Horodatage :</strong> {new Date(selectedLog.createdAt).toLocaleString("fr-FR")}</div>
                    <div><strong>Auteur :</strong> {selectedLog.author?.name || "Système"} ({selectedLog.author?.email || "N/A"})</div>
                    <div><strong>Entité :</strong> {selectedLog.entity} ({selectedLog.entityId || "N/A"})</div>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Payload JSON scellé :</span>
                    <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-lg overflow-x-auto max-h-48">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-200">
                  <button onClick={() => setSelectedLog(null)} className="btn-secondary">
                    Fermer
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}