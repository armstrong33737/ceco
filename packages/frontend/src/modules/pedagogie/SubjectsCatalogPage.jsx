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
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: "", code: "" });
  const [isCodeManual, setIsCodeManual] = useState(false);

  function load() {
    apiFetch("/subjects").then(setSubjects).catch((e) => showToast(e.message, "error"));
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
      </div>

      <Modal
        isOpen={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Modifier la Matière" : "Nouvelle Matière"}
        icon="library_books"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={!isCodeValid || !form.name.trim()}>
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