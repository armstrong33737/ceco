// packages/frontend/src/modules/academie/FilieresCyclesPage.jsx
import React, { useEffect, useState, useMemo } from "react";
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
import Modal from "../../design-system/overlays/Modal";
import ConfirmDialog from "../../design-system/overlays/ConfirmDialog";

export default function FilieresCyclesPage() {
  const [programTypes, setProgramTypes] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modales
  const [modalType, setModalType] = useState(null); // "cycle" | "filiere"
  const [editingItem, setEditingItem] = useState(null);
  const [cycleForm, setCycleForm] = useState({ code: "", label: "" });
  const [filiereForm, setFiliereForm] = useState({ name: "", programTypeId: "", durationInYears: 2 });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const [ptData, fData] = await Promise.all([
        apiFetch("/program-types"),
        apiFetch("/filieres"),
      ]);
      setProgramTypes(ptData || []);
      setFilieres(fData || []);
    } catch (err) {
      showToast(err.message || "Erreur de chargement des filières.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filteredFilieres = useMemo(() => {
    if (!search.trim()) return filieres;
    const q = search.toLowerCase();
    return filieres.filter((f) => f.name.toLowerCase().includes(q) || f.programType?.code?.toLowerCase().includes(q));
  }, [filieres, search]);

  async function handleCycleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await apiFetch(`/program-types/${editingItem.id}`, { method: "PUT", body: JSON.stringify(cycleForm) });
        showToast("Cycle ministériel mis à jour.", "success");
      } else {
        await apiFetch("/program-types", { method: "POST", body: JSON.stringify(cycleForm) });
        showToast("Nouveau cycle créé avec succès.", "success");
      }
      setModalType(null);
      setEditingItem(null);
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleFiliereSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await apiFetch(`/filieres/${editingItem.id}`, { method: "PUT", body: JSON.stringify(filiereForm) });
        showToast("Filière mise à jour.", "success");
      } else {
        await apiFetch("/filieres", { method: "POST", body: JSON.stringify(filiereForm) });
        showToast("Nouvelle filière créée avec succès (niveaux générés).", "success");
      }
      setModalType(null);
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
      await apiFetch(`/${deleteTarget.endpoint}/${deleteTarget.id}`, { method: "DELETE" });
      showToast("Élément supprimé.", "info");
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
        contextBadge={<Badge variant="brand">Structure Académique • Offre de Formation</Badge>}
        title="Cycles &amp; Filières d'Études"
        subtitle="Diplômes ministériels reconnus (DQP, CQP) et filières d'apprentissage pluriannuelles"
        actions={
          <>
            <Button
              variant="secondary"
              icon="add"
              onClick={() => {
                setEditingItem(null);
                setCycleForm({ code: "", label: "" });
                setModalType("cycle");
              }}
            >
              Nouveau Cycle
            </Button>
            <Button
              variant="primary"
              icon="add"
              onClick={() => {
                setEditingItem(null);
                setFiliereForm({ name: "", programTypeId: programTypes[0]?.id || "", durationInYears: 2 });
                setModalType("filiere");
              }}
            >
              Nouvelle Filière
            </Button>
          </>
        }
      />

      {/* Cartes des Cycles Ministériels */}
      <StructuredPanel
        title="Cycles Ministériels Reconnus (MINEFOP)"
        subtitle="Types de qualifications professionnelles délivrées"
        icon="school"
        headerAction={
          <Badge variant="brand">{programTypes.length} cycle(s)</Badge>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {programTypes.map((pt) => (
            <div key={pt.id} className="p-3.5 rounded bg-[#F5F7FA] border border-border flex items-center justify-between dark:bg-[#07111D] dark:border-border-dark">
              <div>
                <span className="font-mono font-bold text-body text-brand-900 dark:text-brand-500">{pt.code}</span>
                <p className="text-caption text-ink-secondary mt-0.5 dark:text-ink-secondary-dark">{pt.label}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="tertiary"
                  size="sm"
                  icon="edit"
                  onClick={() => {
                    setEditingItem(pt);
                    setCycleForm({ code: pt.code, label: pt.label });
                    setModalType("cycle");
                  }}
                />
                <Button
                  variant="tertiary"
                  size="sm"
                  icon="delete"
                  className="text-error"
                  onClick={() => setDeleteTarget({ endpoint: "program-types", id: pt.id, name: pt.code })}
                />
              </div>
            </div>
          ))}
        </div>
      </StructuredPanel>

      {/* Tableau des Filières */}
      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-border-dark">
          <div>
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Référentiel des Filières de Formation</h3>
            <p className="text-caption text-ink-muted">Chaque filière génère automatiquement ses niveaux correspondants (Niveau 1, 2, 3).</p>
          </div>
          <Input
            placeholder="Rechercher filière..."
            value={search}
            leftIcon="search"
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Filière de Formation</TableHeaderCell>
              <TableHeaderCell className="w-28">Cycle</TableHeaderCell>
              <TableHeaderCell className="w-28">Durée</TableHeaderCell>
              <TableHeaderCell>Niveaux d'Études Générés</TableHeaderCell>
              <TableHeaderCell align="right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredFilieres.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-semibold text-ink-primary dark:text-white">{f.name}</TableCell>
                <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{f.programType?.code}</TableCell>
                <TableCell>{f.durationInYears} An(s)</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {f.niveaux?.map((n) => (
                      <Badge key={n.id} variant="neutral">Niveau {n.order}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingItem(f);
                        setFiliereForm({ name: f.name, programTypeId: f.programTypeId, durationInYears: f.durationInYears });
                        setModalType("filiere");
                      }}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      icon="delete"
                      className="text-error"
                      onClick={() => setDeleteTarget({ endpoint: "filieres", id: f.id, name: f.name })}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modale Cycle */}
      <Modal
        isOpen={modalType === "cycle"}
        onClose={() => setModalType(null)}
        title={editingItem ? "Modifier le Cycle" : "Nouveau Cycle Ministériel"}
        icon="school"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalType(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleCycleSubmit} isLoading={saving}>Enregistrer</Button>
          </>
        }
      >
        <form onSubmit={handleCycleSubmit} className="space-y-4">
          <Input required label="Code court du cycle" placeholder="Ex: DQP" value={cycleForm.code} onChange={(e) => setCycleForm({ ...cycleForm, code: e.target.value })} />
          <Input required label="Intitulé officiel complet" placeholder="Ex: Diplôme de Qualification Professionnelle" value={cycleForm.label} onChange={(e) => setCycleForm({ ...cycleForm, label: e.target.value })} />
        </form>
      </Modal>

      {/* Modale Filière */}
      <Modal
        isOpen={modalType === "filiere"}
        onClose={() => setModalType(null)}
        title={editingItem ? "Modifier la Filière" : "Nouvelle Filière de Formation"}
        icon="account_tree"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalType(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleFiliereSubmit} isLoading={saving}>
              {editingItem ? "Enregistrer" : "Créer la Filière"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFiliereSubmit} className="space-y-4">
          <Select
            required
            label="Cycle d'appartenance"
            value={filiereForm.programTypeId}
            onChange={(e) => setFiliereForm({ ...filiereForm, programTypeId: e.target.value })}
          >
            {programTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.code} — {pt.label}</option>)}
          </Select>
          <Input required label="Nom officiel de la filière" placeholder="Ex: Froid et Climatisation" value={filiereForm.name} onChange={(e) => setFiliereForm({ ...filiereForm, name: e.target.value })} />
          <Select
            label="Durée du cursus"
            value={filiereForm.durationInYears}
            onChange={(e) => setFiliereForm({ ...filiereForm, durationInYears: parseInt(e.target.value, 10) })}
          >
            <option value={1}>1 an (Niveau 1)</option>
            <option value={2}>2 ans (Niveau 1 &amp; 2)</option>
            <option value={3}>3 ans (Niveau 1, 2 &amp; 3)</option>
          </Select>
        </form>
      </Modal>

      {/* Confirmation Suppression */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Confirmer la suppression"
        description={`Supprimer définitivement "${deleteTarget?.name}" ? Cette action est irréversible.`}
      />
    </motion.div>
  );
}