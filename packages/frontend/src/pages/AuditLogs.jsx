// packages/frontend/src/pages/AuditLogs.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";
import PaginationBar from "../components/PaginationBar";

const ACTIONS_CATALOG = [
  { value: "", label: "Toutes les actions tracées" },
  { value: "UNLOCK_GRADES", label: "Déverrouillage de Notes (Urgence)" },
  { value: "RUN_DELIBERATION", label: "Délibération Manuelle du Jury" },
  { value: "AUTO_RUN_DELIBERATION", label: "Délibération Automatique de Classe" },
  { value: "CENTER_WIDE_DELIBERATION", label: "Délibération Tout l'Établissement" },
  { value: "RESTORE_STUDENT", label: "Restauration d'Apprenant Archivé" },
];

function getActionBadge(action) {
  switch (action) {
    case "UNLOCK_GRADES":
      return { label: "Déverrouillage Notes", bg: "bg-amber-100 text-amber-950 border-amber-300" };
    case "RUN_DELIBERATION":
    case "AUTO_RUN_DELIBERATION":
    case "CENTER_WIDE_DELIBERATION":
      return { label: "Délibération Jury", bg: "bg-primary-light text-primary border-primary/20" };
    case "RESTORE_STUDENT":
      return { label: "Restauration Apprenant", bg: "bg-success-light text-success border-success/20" };
    case "DELETE_STUDENT":
      return { label: "Archivage Apprenant", bg: "bg-error-container text-error border-error/20" };
    default:
      return { label: action || "Opération", bg: "bg-surface border text-on-surface-variant" };
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
  const [error, setError] = useState(null);

  // Modale Détail Métadonnées
  const [selectedLog, setSelectedLog] = useState(null);

  async function loadLogs() {
    setLoading(true);
    setError(null);
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
      setError(err.message || "Impossible de charger le journal d'audit.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [page, limit, selectedAction, search]);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-md">
      {/* En-tête avec filtres et recherche rapide */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <Icon name="history" className="text-primary text-[18px]" />
            <span>Journal d'Audit &amp; Traçabilité Système</span>
          </h3>
          <p className="text-xs text-on-surface-variant">
            Registre immuable des actions sensibles (déverrouillages, délibérations, modifications souveraines).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedAction}
            onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
            className="h-9 rounded-md bg-surface border border-outline-variant/40 px-2.5 text-xs font-semibold outline-none focus:border-primary"
          >
            {ACTIONS_CATALOG.map((act) => (
              <option key={act.value} value={act.value}>{act.label}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Rechercher action, cible..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="text-xs px-3 py-2 rounded-md border border-outline-variant/40 outline-none w-48 bg-surface"
          />

          <button
            onClick={loadLogs}
            className="p-2 rounded-md border border-outline-variant hover:bg-surface-container text-on-surface-variant"
            title="Actualiser le journal"
          >
            <Icon name="refresh" className="text-[18px]" />
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-error-container text-error text-xs rounded-md font-semibold">{error}</div>}

      {/* Tableau des logs */}
      <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
        {loading && !pagination ? (
          <p className="p-8 text-xs text-on-surface-variant text-center">Chargement du journal d'audit...</p>
        ) : logs.length === 0 ? (
          <p className="p-8 text-xs text-on-surface-variant text-center">Aucun événement ne correspond à vos critères de recherche.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b font-bold uppercase text-on-surface-variant bg-surface">
                  <th className="px-md py-3 w-40">Date &amp; Heure</th>
                  <th className="px-md py-3 w-48">Auteur / Compte</th>
                  <th className="px-md py-3 w-48">Action Consignée</th>
                  <th className="px-md py-3">Cible / Contexte</th>
                  <th className="px-md py-3 text-right">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const dateStr = new Date(log.createdAt).toLocaleString("fr-FR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit", second: "2-digit",
                  });

                  return (
                    <tr key={log.id} className="hover:bg-surface-container/20">
                      <td className="px-md py-3 font-mono text-on-surface font-semibold">{dateStr}</td>
                      <td className="px-md py-3">
                        {log.author ? (
                          <div>
                            <div className="font-bold text-on-surface">{log.author.name}</div>
                            <div className="text-[10px] text-on-surface-variant font-mono">{log.author.email}</div>
                          </div>
                        ) : (
                          <span className="font-mono text-on-surface-variant/70 italic">Système Automatique</span>
                        )}
                      </td>
                      <td className="px-md py-3">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-md py-3 text-on-surface-variant">
                        {log.metadata?.classeLabel && (
                          <span className="font-bold text-on-surface mr-1">{log.metadata.classeLabel}</span>
                        )}
                        {log.metadata?.subjectName && (
                          <span className="text-[11px] font-mono">({log.metadata.subjectName})</span>
                        )}
                        {log.metadata?.reason && (
                          <div className="text-[11px] italic text-on-surface-variant truncate max-w-md">
                            « {log.metadata.reason} »
                          </div>
                        )}
                      </td>
                      <td className="px-md py-3 text-right">
                        {log.metadata ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-2.5 py-1 border rounded text-xs font-semibold hover:bg-surface-container flex items-center gap-1 ml-auto"
                          >
                            <Icon name="visibility" className="text-[14px]" />
                            <span>Voir Métadonnées</span>
                          </button>
                        ) : (
                          <span className="text-on-surface-variant/40">—</span>
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

      {/* MODALE DÉTAILS DES MÉTADONNÉES */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {selectedLog && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white p-md sm:p-lg rounded-md shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex justify-between items-center border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="data_object" className="text-primary text-[20px]" />
                    <h4 className="font-bold text-sm text-on-surface">Détails de l'Événement d'Audit</h4>
                  </div>
                  <button onClick={() => setSelectedLog(null)} className="text-on-surface-variant">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-surface rounded border space-y-1">
                    <div><strong>Action :</strong> <span className="font-mono text-primary">{selectedLog.action}</span></div>
                    <div><strong>Date &amp; Heure :</strong> {new Date(selectedLog.createdAt).toLocaleString("fr-FR")}</div>
                    <div><strong>Auteur :</strong> {selectedLog.author?.name || "Système"} ({selectedLog.author?.email || "N/A"})</div>
                    <div><strong>Entité affectée :</strong> {selectedLog.entity} ({selectedLog.entityId || "N/A"})</div>
                  </div>

                  <div>
                    <span className="font-bold block mb-1">Charge utile JSON (Payload) :</span>
                    <pre className="p-3 bg-ink text-white font-mono text-[10px] rounded-md overflow-x-auto max-h-48">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t">
                  <button onClick={() => setSelectedLog(null)} className="px-4 py-1.5 border rounded text-xs font-semibold">
                    Fermer
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}