// packages/frontend/src/modules/pedagogie/SubjectsCatalogPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Badge from "../../design-system/primitives/Badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "../../design-system/data-grid/Table";
import Modal from "../../design-system/overlays/Modal";
import ConfirmDialog from "../../design-system/overlays/ConfirmDialog";
import Icon from "../../components/Icon";

function derive5CharCode(name, existingList = [], currentId = null) {
  if (!name || !name.trim()) return "";
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  let prefix = clean.substring(0, 3);
  if (prefix.length < 3) prefix = (prefix + "MAT").substring(0, 3);

  let num = 1;
  let code = `${prefix}${String(num).padStart(2, "0")}`;
  const otherSubjects = existingList.filter((s) => s.id !== currentId);

  while (otherSubjects.some((s) => s.code === code)) {
    num++;
    code = `${prefix}${String(num).padStart(2, "0")}`;
  }
  return code;
}

export default function SubjectsCatalogPage() {
  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modales CRUD
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: "", code: "" });
  const [isCodeManual, setIsCodeManual] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modale Importation CSV
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importReport, setImportReport] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  function load() {
    setLoading(true);
    apiFetch("/subjects")
      .then((data) => setSubjects(data || []))
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleNameChange(newName) {
    const updatedForm = { ...form, name: newName };
    if (!isCodeManual) {
      updatedForm.code = derive5CharCode(newName, subjects, modal?.item?.id);
    }
    setForm(updatedForm);
  }

  function handleCodeChange(newCode) {
    setIsCodeManual(true);
    setForm({ ...form, code: newCode.toUpperCase().slice(0, 5) });
  }

  const isCodeValid = /^[A-Z0-9]{5}$/.test(form.code.trim());

  const filteredSubjects = useMemo(() => {
    if (!search.trim()) return subjects;
    const q = search.toLowerCase();
    return subjects.filter((s) => s.name.toLowerCase().includes(q) || (s.code || "").toLowerCase().includes(q));
  }, [subjects, search]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isCodeValid) {
      showToast("Le code matière doit comporter exactement 5 caractères majuscules (ex: THM01).", "warning");
      return;
    }

    setSaving(true);
    try {
      if (modal.mode === "edit") {
        await apiFetch(`/subjects/${modal.item.id}`, { method: "PUT", body: JSON.stringify(form) });
        showToast("Matière mise à jour.", "success");
      } else {
        await apiFetch("/subjects", { method: "POST", body: JSON.stringify(form) });
        showToast("Nouvelle matière enregistrée avec succès.", "success");
      }
      setModal(null);
      load();
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
        if (parts.length >= 2) {
          parsed.push({ code: parts[0], name: parts[1] });
        } else if (parts[0]) {
          parsed.push({ code: "", name: parts[0] });
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
      const res = await apiFetch("/subjects/import", {
        method: "POST",
        body: JSON.stringify({ subjects: importRows }),
      });
      setImportReport(res);
      showToast(res.message, "success");
      load();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function confirmDeleteSubject() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/subjects/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast("Matière supprimée du référentiel.", "info");
      load();
    } catch (err) {
      showToast(err.message, "error");
      setDeleteTarget(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Pédagogie • Catalogue Universel</Badge>}
        title="Référentiel des Matières &amp; Disciplines"
        subtitle="Catalogue des modules avec codes normalisés à 5 caractères pour les procès-verbaux"
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
                setForm({ name: "", code: "" });
                setIsCodeManual(false);
                setModal({ mode: "create" });
              }}
            >
              Nouvelle Matière
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface p-4 rounded border border-border shadow-xs dark:bg-surface-dark dark:border-border-dark">
        <div>
          <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Disciplines Disponibles</h3>
          <p className="text-caption text-ink-muted">Total : {subjects.length} matière(s) enregistrée(s).</p>
        </div>

        <Input
          placeholder="Rechercher matière ou code..."
          value={search}
          leftIcon="search"
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        {loading ? (
          <p className="p-8 text-caption text-ink-muted text-center">Chargement du catalogue...</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="w-32">Code (5 Car.)</TableHeaderCell>
                <TableHeaderCell>Intitulé de la Discipline</TableHeaderCell>
                <TableHeaderCell className="w-36 text-center">Cours Actifs</TableHeaderCell>
                <TableHeaderCell align="right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSubjects.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{sub.code || "—"}</TableCell>
                  <TableCell className="font-semibold text-ink-primary dark:text-white">{sub.name}</TableCell>
                  <TableCell align="center" className="font-mono">{sub._count?.offerings || 0}</TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setForm({ name: sub.name, code: sub.code || "" });
                          setIsCodeManual(true);
                          setModal({ mode: "edit", item: sub });
                        }}
                      >
                        Modifier
                      </Button>
                      <Button
                        variant="tertiary"
                        size="sm"
                        icon="delete"
                        className="text-error"
                        onClick={() => setDeleteTarget(sub)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modale Création / Édition */}
      <Modal
        isOpen={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Modifier la Matière" : "Nouvelle Matière"}
        icon="library_books"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={saving} disabled={!isCodeValid || !form.name.trim()}>
              Enregistrer
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            required
            label="Intitulé de la matière"
            placeholder="Ex: Thermodynamique appliquée"
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
          />

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-caption font-semibold uppercase tracking-wider text-ink-secondary select-none dark:text-ink-secondary-dark">
                Code à 5 caractères (ex: THM01)
              </label>
              <span className={`font-mono text-[10px] font-bold ${isCodeValid ? "text-success" : "text-error"}`}>
                {form.code.length} / 5 car. {isCodeValid ? "✓ Conforme" : "(Format A-Z 0-9)"}
              </span>
            </div>
            <input
              required
              maxLength={5}
              placeholder="Ex: THM01"
              value={form.code}
              onChange={(e) => handleCodeChange(e.target.value)}
              className={`h-[40px] w-full rounded bg-surface px-3 py-2 font-mono uppercase font-bold text-body text-ink-primary border outline-none dark:bg-surface-dark dark:border-border-dark dark:text-white ${
                !isCodeValid && form.code ? "border-error focus:border-error" : "border-border focus:border-brand-700"
              }`}
            />
          </div>
        </form>
      </Modal>

      {/* Modale Importation CSV */}
      <Modal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Importer des Matières par Fichier CSV"
        subtitle="Auto-génération des codes à 5 caractères si non renseignés"
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
            <p className="text-caption text-ink-muted">Colonnes attendues : Code; Intitule (ou Intitule seul pour code auto)</p>
            <input type="file" accept=".csv,text/csv" onChange={handleCsvFileSelect} className="text-caption mx-auto pt-2" />
          </div>

          {importRows.length > 0 && !importReport && (
            <Badge variant="brand">{importRows.length} matière(s) détectée(s) prête(s) pour l'import</Badge>
          )}

          {importReport && (
            <div className="p-4 rounded bg-surface border border-border space-y-2 text-body-sm dark:bg-surface-dark dark:border-border-dark">
              <div className="font-semibold text-success flex items-center gap-1.5">
                <Icon name="check_circle" className="text-[18px]" />
                <span>{importReport.createdCount} matière(s) importée(s) sur {importReport.totalCount} lignes.</span>
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
        onConfirm={confirmDeleteSubject}
        title="Supprimer la matière"
        description={`Supprimer définitivement la matière "${deleteTarget?.name}" (${deleteTarget?.code || ""}) du catalogue ?`}
      />
    </motion.div>
  );
}