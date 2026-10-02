// packages/frontend/src/modules/academie/SallesPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel } from "../../design-system/layout/Card";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Badge from "../../design-system/primitives/Badge";
import Modal from "../../design-system/overlays/Modal";
import ConfirmDialog from "../../design-system/overlays/ConfirmDialog";
import Icon from "../../components/Icon";

export default function SallesPage() {
  const [salles, setSalles] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modales CRUD
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: "", capacity: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Modale Importation CSV
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importReport, setImportReport] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const sData = await apiFetch("/salles");
      setSalles(sData || []);
    } catch (err) {
      showToast(err.message || "Erreur de chargement des salles.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filteredSalles = useMemo(() => {
    if (!search.trim()) return salles;
    const q = search.toLowerCase();
    return salles.filter((s) => s.name.toLowerCase().includes(q));
  }, [salles, search]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await apiFetch(`/salles/${editingItem.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: form.name, capacity: form.capacity ? parseInt(form.capacity, 10) : null }),
        });
        showToast("Salle mise à jour avec succès.", "success");
      } else {
        await apiFetch("/salles", {
          method: "POST",
          body: JSON.stringify({ name: form.name, capacity: form.capacity ? parseInt(form.capacity, 10) : null }),
        });
        showToast("Nouvelle salle créée avec succès.", "success");
      }
      setModal(false);
      setEditingItem(null);
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function handleCsvFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        setImportError("Fichier CSV vide ou invalide.");
        return;
      }
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/[;,]/).map((p) => p.replace(/^"|"$/g, "").trim());
        if (parts[0]) {
          parsed.push({
            name: parts[0],
            capacity: parts[1] ? parseInt(parts[1], 10) : null,
          });
        }
      }
      setImportRows(parsed);
      setImportReport(null);
      setImportError(null);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleExecuteImport(e) {
    e.preventDefault();
    if (importRows.length === 0) {
      setImportError("Veuillez sélectionner un fichier CSV valide.");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const res = await apiFetch("/salles/import", {
        method: "POST",
        body: JSON.stringify({ salles: importRows }),
      });
      setImportReport(res);
      showToast(res.message, "success");
      await loadData();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/salles/${deleteTarget.id}`, { method: "DELETE" });
      showToast("Salle supprimée.", "info");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
      setDeleteTarget(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Structure Académique • Espaces de Cours</Badge>}
        title="Salles &amp; Ateliers de Formation"
        subtitle="Gestion des infrastructures d'apprentissage, capacités d'accueil et affectations de classes"
        actions={
          <>
            <Button
              variant="secondary"
              icon="upload_file"
              onClick={() => {
                setImportRows([]);
                setImportReport(null);
                setImportError(null);
                setShowImport(true);
              }}
            >
              Importer CSV
            </Button>
            <Button
              variant="primary"
              icon="add"
              onClick={() => {
                setEditingItem(null);
                setForm({ name: "", capacity: "" });
                setModal(true);
              }}
            >
              Nouvelle Salle
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface p-4 rounded border border-border shadow-xs dark:bg-surface-dark dark:border-border-dark">
        <div>
          <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Inventaire des Espaces</h3>
          <p className="text-caption text-ink-muted">Suivi des capacités et des classes hébergées.</p>
        </div>
        <Input
          placeholder="Rechercher salle..."
          value={search}
          leftIcon="search"
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSalles.map((s) => (
          <StructuredPanel
            key={s.id}
            title={s.name}
            subtitle={`Capacité : ${s.capacity ? `${s.capacity} places` : "Non spécifiée"}`}
            icon="meeting_room"
            headerAction={
              <div className="flex items-center gap-1">
                <Button
                  variant="tertiary"
                  size="sm"
                  icon="edit"
                  onClick={() => {
                    setEditingItem(s);
                    setForm({ name: s.name, capacity: s.capacity || "" });
                    setModal(true);
                  }}
                />
                <Button
                  variant="tertiary"
                  size="sm"
                  icon="delete"
                  className="text-error"
                  onClick={() => setDeleteTarget(s)}
                />
              </div>
            }
          >
            <div className="flex items-center justify-between text-body-sm">
              <span className="text-ink-secondary dark:text-ink-secondary-dark">Classes hébergées :</span>
              <Badge variant="brand">{s._count?.classes || 0} classe(s)</Badge>
            </div>
          </StructuredPanel>
        ))}
      </div>

      {/* Modale Création / Édition */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editingItem ? "Modifier la Salle" : "Nouvelle Salle / Atelier"}
        icon="meeting_room"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={saving}>Enregistrer</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input required label="Nom officiel de la salle / atelier" placeholder="Ex: Salle B04" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input type="number" label="Capacité d'accueil maximale (places)" placeholder="30" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        </form>
      </Modal>

      {/* Modale Importation CSV */}
      <Modal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Importer des Salles &amp; Ateliers par CSV"
        subtitle="Importation en masse avec détection automatique des doublons"
        icon="upload_file"
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImport(false)}>Fermer</Button>
            <Button variant="primary" onClick={handleExecuteImport} isLoading={importing} disabled={importRows.length === 0}>
              Lancer l'Importation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-6 border-2 border-dashed border-border rounded text-center bg-[#F5F7FA] space-y-2 dark:bg-[#07111D] dark:border-border-dark">
            <Icon name="file_upload" className="text-3xl text-brand-900 dark:text-brand-500" />
            <p className="text-body-md font-semibold text-ink-primary dark:text-white">Sélectionner un fichier CSV</p>
            <p className="text-caption text-ink-muted">Colonnes attendues : Nom; Capacite (ex: Salle B04; 35)</p>
            <input type="file" accept=".csv,text/csv" onChange={handleCsvFileSelect} className="text-caption mx-auto pt-2" />
          </div>

          {importRows.length > 0 && !importReport && (
            <Badge variant="brand">{importRows.length} salle(s) détectée(s) prête(s) pour l'import</Badge>
          )}

          {importReport && (
            <div className="p-4 rounded bg-surface border border-border space-y-2 text-body-sm dark:bg-surface-dark dark:border-border-dark">
              <div className="font-semibold text-success flex items-center gap-1.5">
                <Icon name="check_circle" className="text-[18px]" />
                <span>{importReport.createdCount} salle(s) importée(s) sur {importReport.totalCount} lignes.</span>
              </div>
              {importReport.errors?.length > 0 && (
                <div className="space-y-1 text-error text-caption">
                  <p className="font-bold">{importReport.errors.length} anomalie(s) détectée(s) :</p>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto font-mono">
                    {importReport.errors.map((err, i) => (
                      <li key={i}>Ligne {err.row} : {err.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {importError && (
            <p className="rounded bg-error-subtle p-3 text-error border border-error/30 text-caption font-medium">{importError}</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer la salle"
        description={`Supprimer définitivement "${deleteTarget?.name}" ?`}
      />
    </motion.div>
  );
}