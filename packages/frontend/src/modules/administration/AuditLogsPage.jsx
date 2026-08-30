// packages/frontend/src/modules/administration/AuditLogsPage.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel } from "../../design-system/layout/Card";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Select from "../../design-system/primitives/Select";
import Badge from "../../design-system/primitives/Badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "../../design-system/data-grid/Table";
import TablePagination from "../../design-system/data-grid/TablePagination";
import Drawer from "../../design-system/overlays/Drawer";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selectedAction, setSelectedAction] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [inspectLog, setInspectLog] = useState(null);

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
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLogs(); }, [page, limit, selectedAction, search]);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Traçabilité • Journal d'Audit</Badge>}
        title="Journal d'Audit &amp; Traçabilité Système"
        subtitle="Registre immuable des opérations sensibles (déverrouillages de notes, jurys de délibération, archivages)"
      />

      <StructuredPanel title="Filtres du Journal" subtitle="Recherche par action consigée et auteur" icon="filter_alt">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Action tracée" value={selectedAction} onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}>
            <option value="">Toutes les actions</option>
            <option value="UNLOCK_GRADES">Déverrouillage de Notes (Urgence)</option>
            <option value="AUTO_RUN_DELIBERATION">Délibération de Classe</option>
            <option value="CENTER_WIDE_DELIBERATION">Délibération Globale Centre</option>
            <option value="CLOSE_ACADEMIC_YEAR">Clôture de Session</option>
          </Select>
          <div className="sm:col-span-2">
            <Input label="Recherche par cible ou auteur" placeholder="Ex: Thermodynamique, Classe, Admin..." value={search} leftIcon="search" onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
      </StructuredPanel>

      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell className="w-44">Date &amp; Heure</TableHeaderCell>
              <TableHeaderCell className="w-48">Auteur / Compte</TableHeaderCell>
              <TableHeaderCell className="w-52">Action Consignée</TableHeaderCell>
              <TableHeaderCell>Contexte / Cible</TableHeaderCell>
              <TableHeaderCell align="right">Inspection</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} isClickable onClick={() => setInspectLog(log)}>
                <TableCell className="font-mono text-caption text-ink-primary dark:text-white">
                  {new Date(log.createdAt).toLocaleString("fr-FR")}
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-body-sm text-ink-primary dark:text-white">{log.author?.name || "Système Automatique"}</div>
                  <div className="text-[10px] font-mono text-ink-muted">{log.author?.email || "—"}</div>
                </TableCell>
                <TableCell><Badge variant="brand">{log.action}</Badge></TableCell>
                <TableCell className="text-caption text-ink-secondary dark:text-ink-secondary-dark">
                  {log.metadata?.classeLabel && <strong className="text-ink-primary mr-1 dark:text-white">{log.metadata.classeLabel}</strong>}
                  {log.metadata?.subjectName && <span>({log.metadata.subjectName})</span>}
                  {log.metadata?.reason && <span className="italic ml-1">« {log.metadata.reason} »</span>}
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="secondary" size="sm" icon="visibility" onClick={() => setInspectLog(log)}>
                    Payload JSON
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination pagination={pagination} onPageChange={setPage} onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }} />

      {/* TIROIR D'INSPECTION LATÉRAL DE L'AUDIT */}
      <Drawer
        isOpen={Boolean(inspectLog)}
        onClose={() => setInspectLog(null)}
        title="Détail de l'Événement d'Audit"
        subtitle={`Action : ${inspectLog?.action || ""}`}
        icon="history"
        width="max-w-xl"
        footer={<Button variant="secondary" onClick={() => setInspectLog(null)}>Fermer</Button>}
      >
        {inspectLog && (
          <div className="space-y-4">
            <div className="p-4 rounded bg-[#F5F7FA] border border-border space-y-1.5 text-body-sm dark:bg-[#07111D] dark:border-border-dark">
              <div><strong className="text-ink-secondary">Horodatage :</strong> {new Date(inspectLog.createdAt).toLocaleString("fr-FR")}</div>
              <div><strong className="text-ink-secondary">Auteur :</strong> {inspectLog.author?.name || "Système"} ({inspectLog.author?.email || "N/A"})</div>
              <div><strong className="text-ink-secondary">Entité affectée :</strong> {inspectLog.entity} ({inspectLog.entityId || "N/A"})</div>
            </div>

            <div className="space-y-1.5">
              <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold block">
                Charge Utile JSON Brute (Payload Immuable)
              </span>
              <pre className="p-4 rounded bg-brand-900 text-white font-mono text-[11px] overflow-x-auto max-h-72 border border-brand-800 dark:bg-black dark:border-border-dark">
                {JSON.stringify(inspectLog.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </motion.div>
  );
}