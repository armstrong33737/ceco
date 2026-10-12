// packages/frontend/src/modules/administration/BackupsPage.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel } from "../../design-system/layout/Card";
import Button from "../../design-system/primitives/Button";
import Badge from "../../design-system/primitives/Badge";
import Modal from "../../design-system/overlays/Modal";
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
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  // Restauration
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Suppression
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Importation
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const list = await apiFetch("/backups");
      setBackups(list || []);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

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

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".zip")) {
      showToast("Veuillez sélectionner un fichier archive au format .zip", "warning");
      return;
    }
    setUploadFile(file);
  }

  async function handleUploadBackupSubmit(e) {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const res = await apiFetch("/backups/upload", {
            method: "POST",
            body: JSON.stringify({
              filename: uploadFile.name,
              fileDataBase64: evt.target.result,
            }),
          });
          showToast(res.message, "success");
          setShowUploadModal(false);
          setUploadFile(null);
          await loadData();
        } catch (err) {
          showToast(err.message || "Échec lors de l'importation de l'archive.", "error");
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        showToast("Impossible de lire le fichier local sélectionné.", "error");
        setUploading(false);
      };
      reader.readAsDataURL(uploadFile);
    } catch (err) {
      showToast(err.message, "error");
      setUploading(false);
    }
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/backups/${encodeURIComponent(deleteTarget.name)}`, { method: "DELETE" });
      showToast(`Archive "${deleteTarget.name}" supprimée du disque.`, "info");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Souveraineté • Sauvegardes & Restauration</Badge>}
        title="Sauvegardes Hybrides & Continuité d'Activité"
        subtitle="Exportation et importation manuelles d'archives universelles autonomes (.zip) encapsulant PostgreSQL et les fichiers médias"
        actions={
          <div className="flex gap-2.5">
            <Button variant="secondary" icon="upload_file" onClick={() => { setUploadFile(null); setShowUploadModal(true); }}>
              Importer Sauvegarde (.zip)
            </Button>
            <Button variant="primary" icon="archive" onClick={handleTriggerBackup} isLoading={triggering}>
              Créer une Sauvegarde
            </Button>
          </div>
        }
      />

      {/* Cartes d'information de souveraineté */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StructuredPanel title="Plan de Reprise d'Activité (PRA Local)" subtitle="Protocole de redondance physique" icon="security">
          <p className="text-body-sm text-ink-secondary leading-relaxed dark:text-ink-secondary-dark">
            Chaque centre de formation doit externaliser ses archives sur support physique externe (clé USB ou disque externe) en fin de journée. En cas de panne matérielle ou de changement d'ordinateur, réinstallez CECO et importez votre archive .zip pour retrouver l'intégralité de vos dossiers.
          </p>
        </StructuredPanel>

        <StructuredPanel title="Format d'Archive Hybride Universel" subtitle="Dump PostgreSQL + /storage médias" icon="folder_zip">
          <p className="text-body-sm text-ink-secondary leading-relaxed dark:text-ink-secondary-dark">
            L'archive combine le dump relationnel structuré JSON de la base de données et l'arborescence physique complète des photographies d'élèves, des signatures scannées et des documents légaux scellés.
          </p>
        </StructuredPanel>
      </div>

      {/* Tableau des sauvegardes disponibles sur le disque */}
      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        <div className="p-4 border-b border-border flex items-center justify-between dark:border-border-dark">
          <div>
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Archives Disponibles (/backups)</h3>
            <p className="text-caption text-ink-muted">Consultez, exportez ou restaurez vos sauvegardes locales.</p>
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
            {backups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-ink-muted py-8">
                  Aucune archive de sauvegarde disponible. Cliquez sur « Créer une Sauvegarde » ou « Importer Sauvegarde (.zip) ».
                </TableCell>
              </TableRow>
            ) : (
              backups.map((b) => (
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
                      <Button
                        variant="tertiary"
                        size="sm"
                        icon="delete"
                        className="text-error"
                        onClick={() => setDeleteTarget(b)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modale d'Importation d'Archive .zip */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Importer une Archive de Sauvegarde (.zip)"
        subtitle="Téléversez une archive CECO issue d'une clé USB ou d'un autre poste"
        icon="upload_file"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUploadModal(false)} disabled={uploading}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleUploadBackupSubmit} isLoading={uploading} disabled={!uploadFile}>
              Valider &amp; Importer
            </Button>
          </>
        }
      >
        <form onSubmit={handleUploadBackupSubmit} className="space-y-4">
          <div className="p-6 border-2 border-dashed border-border rounded text-center bg-[#F5F7FA] space-y-2 dark:bg-[#07111D] dark:border-border-dark">
            <Icon name="folder_zip" className="text-4xl text-brand-900 dark:text-brand-500" />
            <p className="text-body-md font-semibold text-ink-primary dark:text-white">Sélectionner une archive .zip</p>
            <p className="text-caption text-ink-muted">Format attendu : archive hybride générée par CECO Suite ERP</p>
            <input type="file" accept=".zip,application/zip" onChange={handleFileSelect} className="text-caption mx-auto pt-2" />
          </div>

          {uploadFile && (
            <div className="p-3 rounded bg-surface border border-border flex items-center justify-between text-body-sm dark:bg-surface-dark dark:border-border-dark">
              <span className="font-mono text-caption truncate max-w-[240px]">{uploadFile.name}</span>
              <span className="font-mono text-caption text-ink-muted">{formatSize(uploadFile.size)}</span>
            </div>
          )}
        </form>
      </Modal>

      {/* Confirmation Restauration */}
      <ConfirmDialog
        isOpen={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        onConfirm={confirmRestore}
        title="Confirmer la restauration système"
        description={`Attention : cette opération va écraser la base PostgreSQL locale actuelle et réinjecter les données telles qu'elles étaient à la création de "${restoreTarget?.name}".`}
        confirmLabel="Confirmer & Restaurer"
        isLoading={restoring}
      />

      {/* Confirmation Suppression */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer l'archive du disque"
        description={`Supprimer définitivement le fichier "${deleteTarget?.name}" ? Cette action libérera de l'espace sur votre disque dur.`}
        confirmLabel="Supprimer l'Archive"
        isLoading={deleting}
      />
    </motion.div>
  );
}