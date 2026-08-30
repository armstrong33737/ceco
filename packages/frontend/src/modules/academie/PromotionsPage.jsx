// packages/frontend/src/modules/academie/PromotionsPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
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
import Modal from "../../design-system/overlays/Modal";
import ConfirmDialog from "../../design-system/overlays/ConfirmDialog";

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ filiereId: "", academicYearId: "", label: "", expectedEndYear: "2028" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const [promoData, fData, yData] = await Promise.all([
        apiFetch("/promotions"),
        apiFetch("/filieres"),
        apiFetch("/academic-years"),
      ]);
      setPromotions(promoData || []);
      setFilieres(fData || []);
      setAcademicYears(yData || []);
    } catch (err) {
      showToast(err.message || "Erreur de chargement des promotions.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filteredPromotionsrest = useMemo(() => {
    if (!search.trim()) return promotions;
    const q = search.toLowerCase();
    return promotions.filter((p) => p.label.toLowerCase().includes(q) || p.filiere?.name.toLowerCase().includes(q));
  }, [promotions, search]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await apiFetch(`/promotions/${editingItem.id}`, { method: "PUT", body: JSON.stringify({ label: form.label, expectedEndYear: form.expectedEndYear }) });
        showToast("Promotion mise à jour.", "success");
      } else {
        await apiFetch("/promotions", { method: "POST", body: JSON.stringify(form) });
        showToast("Nouvelle promotion enregistrée avec succès.", "success");
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/promotions/${deleteTarget.id}`, { method: "DELETE" });
      showToast("Promotion supprimée.", "info");
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
        contextBadge={<Badge variant="brand">Structure Académique • Cohortes</Badge>}
        title="Promotions &amp; Cohortes d'Entrée"
        subtitle="Regroupement longitudinal des apprenants depuis leur rentrée jusqu'à l'année de diplomation finale"
        actions={
          <Button
            variant="primary"
            icon="add"
            onClick={() => {
              setEditingItem(null);
              const f = filieres[0];
              const y = academicYears.find((ay) => ay.isCurrent) || academicYears[0];
              setForm({ filiereId: f?.id || "", academicYearId: y?.id || "", label: `Promotion ${y?.label || "2026-2028"}`, expectedEndYear: "2028" });
              setModal(true);
            }}
          >
            Nouvelle Promotion
          </Button>
        }
      />

      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-border-dark">
          <div>
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Registre des Cohortes</h3>
            <p className="text-caption text-ink-muted">Historique des entrées par filière et diplomations prévisionnelles.</p>
          </div>
          <Input
            placeholder="Rechercher promotion..."
            value={search}
            leftIcon="search"
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Promotion (Cohorte)</TableHeaderCell>
              <TableHeaderCell>Filière &amp; Cycle</TableHeaderCell>
              <TableHeaderCell className="w-36">Session d'Entrée</TableHeaderCell>
              <TableHeaderCell className="w-36">Sortie Prévue</TableHeaderCell>
              <TableHeaderCell className="w-28">Effectif Inscrits</TableHeaderCell>
              <TableHeaderCell align="right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPromotionsrest.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold text-ink-primary dark:text-white">{p.label}</TableCell>
                <TableCell>
                  <span>{p.filiere?.name}</span>
                  <span className="font-mono text-caption text-brand-900 font-bold ml-1.5 dark:text-brand-500">({p.filiere?.programType?.code})</span>
                </TableCell>
                <TableCell className="font-mono">{p.academicYear?.label}</TableCell>
                <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{p.expectedEndYear || "—"}</TableCell>
                <TableCell className="font-mono font-bold">{p._count?.inscriptions || 0}</TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingItem(p);
                        setForm({ label: p.label, expectedEndYear: p.expectedEndYear || "" });
                        setModal(true);
                      }}
                    >
                      Renommer
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      icon="delete"
                      className="text-error"
                      onClick={() => setDeleteTarget(p)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editingItem ? "Renommer la Promotion" : "Nouvelle Promotion d'Entrée"}
        icon="school"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={saving}>Enregistrer</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingItem && (
            <>
              <Select
                required
                label="Filière de formation"
                value={form.filiereId}
                onChange={(e) => setForm({ ...form, filiereId: e.target.value })}
              >
                {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
              </Select>

              <Select
                required
                label="Session d'entrée"
                value={form.academicYearId}
                onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
              >
                {academicYears.map((ay) => <option key={ay.id} value={ay.id}>{ay.label}</option>)}
              </Select>
            </>
          )}

          <Input required label="Libellé de la cohorte" placeholder="Ex: Promotion 2026-2028" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <Input label="Année de diplomation prévue" placeholder="Ex: 2028" value={form.expectedEndYear} onChange={(e) => setForm({ ...form, expectedEndYear: e.target.value })} />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer la promotion"
        description={`Supprimer définitivement la promotion "${deleteTarget?.label}" ?`}
      />
    </motion.div>
  );
}