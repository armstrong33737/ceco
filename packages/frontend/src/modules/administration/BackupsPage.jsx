// packages/frontend/src/modules/administration/BackupsPage.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel } from "../../design-system/layout/Card";
import Button from "../../design-system/primitives/Button";
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
import ConfirmDialog from "../../design-system/overlays/ConfirmDialog";
import Icon from "../../components/Icon";

function formatSize(bytes) {
  if (!bytes) return "0 o";
  const num = Number(bytes);
  if (num < 1024) return `${num} o`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} Ko`;
  return `${(num / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState([]);
  const [frequency, setFrequency] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [list, config] = await Promise.all([
        apiFetch("/backups"),
        apiFetch("/backups/config"),
      ]);
      setBackups(list || []);
      if (config?.frequency) setFrequency(config.frequency);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleFrequency(val) {
    setFrequency(val);
    try {
      await apiFetch("/backups/config", { method: "PUT", body: JSON.stringify({ frequency: val }) });
      showToast("Cadence de sauvegarde automatique mise à jour.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleTriggerBackup() {
    setTriggering(true);
    try {
      const res = await apiFetch("/backups/trigger", { method: "POST" });
      showToast(`Archive hybride "${res.file}" créée avec succès.`, "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setTriggering(false);
    }
  }

  function handleDownloadBackup(filename) {
    const token = getToken();
    const url = `${API_BASE}/backups/${encodeURIComponent(filename)}/download?token=${token}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("Téléchargement de l'archive démarré.", "info");
  }

  async function confirmRestore() {
    if (!restoreTarget) return;
    setRestoring(true);
    const filename = restoreTarget.name;
    setRestoreTarget(null);
    try {
      await apiFetch("/backups/restore", { method: "POST", body: JSON.stringify({ filename }) });
      showToast(`Restauration intégrale effectuée depuis "${filename}".`, "success", 6000);
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Souveraineté • Sauvegardes</Badge>}
        title="Sauvegardes Hybrides &amp; Restauration"
        subtitle="Génération d'archives compressées autonomes (.zip) encapsulant PostgreSQL et les fichiers médias"
        actions={
          <Button variant="primary" icon="cloud_download" onClick={handleTriggerBackup} isLoading={triggering}>
            Créer une Sauvegarde
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StructuredPanel title="Planification Automatique" subtitle="Cadence des sauvegardes d'arrière-plan" icon="schedule">
          <Select label="Fréquence d'exécution" value={frequency} onChange={(e) => handleFrequency(e.target.value)}>
            <option value="daily">Quotidienne (Chaque nuit)</option>
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly">Mensuelle</option>
          </Select>
        </StructuredPanel>

        <StructuredPanel title="Format d'Archive Hybride" subtitle="Dump PostgreSQL + /storage médias" icon="folder_zip">
          <p className="text-body-sm text-ink-secondary leading-relaxed dark:text-ink-secondary-dark">
            Chaque archive regroupe l'intégrité relationnelle et les photographies, signatures et documents scannés dans un format universel ré-injectable.
          </p>
        </StructuredPanel>
      </div>

      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        <div className="p-4 border-b border-border flex items-center justify-between dark:border-border-dark">
          <div>
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Archives Disponibles (/backups)</h3>
            <p className="text-caption text-ink-muted">Téléchargez vos sauvegardes pour les sécuriser sur support externe (clé USB).</p>
          </div>
          <Badge variant="brand">{backups.length} archive(s)</Badge>
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nom de l'Archive</TableHeaderCell>
              <TableHeaderCell className="w-32">Taille</TableHeaderCell>
              <TableHeaderCell className="w-48">Date de Création</TableHeaderCell>
              <TableHeaderCell align="right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {backups.map((b) => (
              <TableRow key={b.name}>
                <TableCell className="font-mono font-semibold text-brand-900 dark:text-brand-500">{b.name}</TableCell>
                <TableCell className="font-mono text-caption">{formatSize(b.sizeBytes)}</TableCell>
                <TableCell className="text-caption text-ink-secondary dark:text-ink-secondary-dark">
                  {b.createdAt ? new Date(b.createdAt).toLocaleString("fr-FR") : "—"}
                </TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" icon="download" onClick={() => handleDownloadBackup(b.name)}>
                      Exporter .zip
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setRestoreTarget(b)}>
                      Restaurer
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        isOpen={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        onConfirm={confirmRestore}
        title="Confirmer la restauration système"
        description={`Attention : cette opération va écraser la base PostgreSQL locale actuelle et réinjecter les données telles qu'elles étaient à la création de "${restoreTarget?.name}".`}
        confirmLabel="Confirmer & Restaurer"
        isLoading={restoring}
      />
    </motion.div>
  );
}