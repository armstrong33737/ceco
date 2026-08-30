// packages/frontend/src/modules/pedagogie/SubjectCategoriesPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Checkbox from "../../design-system/primitives/Checkbox";
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

export default function SubjectCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: "", code: "", order: 1, isEliminatory: false });

  function load() {
    apiFetch("/categories").then(setCategories).catch((e) => showToast(e.message, "error"));
  }

  useEffect(() => { load(); }, []);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q));
  }, [categories, search]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (modal.mode === "edit") {
        await apiFetch(`/categories/${modal.item.id}`, { method: "PUT", body: JSON.stringify(form) });
        showToast("Catégorie mise à jour.", "success");
      } else {
        await apiFetch("/categories", { method: "POST", body: JSON.stringify(form) });
        showToast("Catégorie créée avec succès.", "success");
      }
      setModal(null);
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/categories/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast("Catégorie supprimée.", "info");
      load();
    } catch (err) {
      showToast(err.message, "error");
      setDeleteTarget(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Pédagogie • Groupes d'Enseignement</Badge>}
        title="Catégories &amp; Groupes de Matières"
        subtitle="Personnalisez les groupes d'enseignement (Spécialité, Général, Pratique) et activez le seuil éliminatoire"
        actions={
          <Button
            variant="primary"
            icon="add"
            onClick={() => {
              setForm({ name: "", code: "", order: categories.length + 1, isEliminatory: false });
              setModal({ mode: "create" });
            }}
          >
            Nouvelle Catégorie
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface p-4 rounded border border-border shadow-xs dark:bg-surface-dark dark:border-border-dark">
        <div>
          <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Groupes Configurés</h3>
          <p className="text-caption text-ink-muted">Les catégories ordonnent les matières dans les bulletins et procès-verbaux.</p>
        </div>

        <Input
          placeholder="Rechercher catégorie..."
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
              <TableHeaderCell className="w-20 text-center">Ordre</TableHeaderCell>
              <TableHeaderCell>Intitulé du Groupe</TableHeaderCell>
              <TableHeaderCell className="w-32">Code Court</TableHeaderCell>
              <TableHeaderCell className="w-36 text-center">Éliminatoire</TableHeaderCell>
              <TableHeaderCell align="right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCategories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell align="center" className="font-mono font-bold text-brand-900 dark:text-brand-500">{cat.order}</TableCell>
                <TableCell className="font-semibold text-ink-primary dark:text-white">{cat.name}</TableCell>
                <TableCell className="font-mono">{cat.code || "—"}</TableCell>
                <TableCell align="center">
                  <Badge variant={cat.isEliminatory ? "error" : "neutral"}>
                    {cat.isEliminatory ? "Oui (< 08/20)" : "Non"}
                  </Badge>
                </TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setForm({ name: cat.name, code: cat.code || "", order: cat.order, isEliminatory: cat.isEliminatory });
                        setModal({ mode: "edit", item: cat });
                      }}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      icon="delete"
                      className="text-error"
                      onClick={() => setDeleteTarget(cat)}
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
        title={modal?.mode === "edit" ? "Modifier la Catégorie" : "Créer une Catégorie"}
        icon="category"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleSubmit}>Enregistrer</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            required
            label="Intitulé du groupe"
            placeholder="Ex: Matières Professionnelles"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Code court (optionnel)"
              placeholder="Ex: PRO"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              type="number"
              min="1"
              label="Ordre d'affichage"
              value={form.order}
              onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) })}
            />
          </div>

          <Checkbox
            label="Marquer comme groupe éliminatoire en délibération (< 08.00/20)"
            checked={form.isEliminatory}
            onChange={(e) => setForm({ ...form, isEliminatory: e.target.checked })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteCategory}
        title="Supprimer la catégorie"
        description={`Supprimer définitivement la catégorie "${deleteTarget?.name}" ?`}
      />
    </motion.div>
  );
}