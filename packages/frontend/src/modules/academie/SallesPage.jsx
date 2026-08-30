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

export default function SallesPage() {
  const [salles, setSalles] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: "", capacity: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
        await apiFetch(`/salles/${editingItem.id}`, { method: "PUT", body: JSON.stringify({ name: form.name, capacity: form.capacity ? parseInt(form.capacity, 10) : null }) });
        showToast("Salle mise à jour.", "success");
      } else {
        await apiFetch("/salles", { method: "POST", body: JSON.stringify({ name: form.name, capacity: form.capacity ? parseInt(form.capacity, 10) : null }) });
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
        subtitle="Gestion des infrastructures d'apprentissage et des capacités d'accueil"
        actions={
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