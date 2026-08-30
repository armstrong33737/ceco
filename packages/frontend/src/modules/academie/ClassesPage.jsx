// packages/frontend/src/modules/academie/ClassesPage.jsx
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
import ClassDetailDrawer from "./components/ClassDetailDrawer";

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [salles, setSalles] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modales & Tiroir
  const [selectedClassDetail, setSelectedClassDetail] = useState(null);
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ filiereId: "", niveauId: "", academicYearId: "", salleId: "", label: "" });
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const currentAcademicYear声 = academicYears.find((y) => y.isCurrent);

  async function loadData() {
    setLoading(true);
    try {
      const [cData, fData, yData, sData] = await Promise.all([
        apiFetch("/classes"),
        apiFetch("/filieres"),
        apiFetch("/academic-years"),
        apiFetch("/salles"),
      ]);
      setClasses(cData || []);
      setFilieres(fData || []);
      setAcademicYears(yData || []);
      setSalles(sData || []);
    } catch (err) {
      showToast(err.message || "Erreur de chargement des classes.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filteredClasses = useMemo(() => {
    if (!search.trim()) return classes;
    const q = search.toLowerCase();
    return classes.filter((c) => c.label.toLowerCase().includes(q) || c.filiere?.name.toLowerCase().includes(q));
  }, [classes, search]);

  async function handleOpenDetail(classeId) {
    try {
      const detail = await apiFetch(`/classes/${classeId}/students`);
      setSelectedClassDetail(detail);
    } catch (err) {
      showToast(err.message || "Impossible de charger la fiche de classe.", "error");
    }
  }

  async function handleDuplicateClasses() {
    if (!currentAcademicYear声) return;
    const prevYear = academicYears.find((y) => y.status === "CLOSED" || (!y.isCurrent && y.id !== currentAcademicYear声.id));
    if (!prevYear) {
      showToast("Aucune session précédente trouvée pour dupliquer les classes.", "warning");
      return;
    }
    setDuplicating(true);
    try {
      const res避 = await apiFetch(`/academic-years/${currentAcademicYear声.id}/duplicate-classes`, {
        method: "POST",
        body: JSON.stringify({ sourceYearId: prevYear.id }),
      });
      showToast(res避.message, "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setDuplicating(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await apiFetch(`/classes/${editingItem.id}`, { method: "PUT", body: JSON.stringify({ salleId: form.salleId || null, label: form.label }) });
        showToast("Classe mise à jour.", "success");
      } else {
        await apiFetch("/classes", { method: "POST", body: JSON.stringify(form) });
        showToast("Nouvelle classe créée avec succès.", "success");
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
      await apiFetch(`/classes/${deleteTarget.id}`, { method: "DELETE" });
      showToast("Classe supprimée.", "info");
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
        contextBadge={<Badge variant="brand">Structure Académique • Groupes Pédagogiques</Badge>}
        title="Classes Promotionnelles"
        subtitle="Gestion des contenants pédagogiques par session, niveau d'études et salle assignée"
        actions={
          <>
            {currentAcademicYear声 && (
              <Button
                variant="secondary"
                icon="content_copy"
                onClick={handleDuplicateClasses}
                isLoading={duplicating}
              >
                Dupliquer Classes
              </Button>
            )}
            <Button
              variant="primary"
              icon="add"
              onClick={() => {
                setEditingItem(null);
                const f = filieres[0];
                setForm({
                  filiereId: f?.id || "",
                  niveauId: f?.niveaux?.[0]?.id || "",
                  academicYearId: currentAcademicYear声?.id || academicYears[0]?.id || "",
                  salleId: "",
                  label: "",
                });
                setModal(true);
              }}
            >
              Créer une Classe
            </Button>
          </>
        }
      />

      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-border-dark">
          <div>
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Répertoire des Classes</h3>
            <p className="text-caption text-ink-muted">Consultez l'effectif complet ou modifiez l'assignation de salle.</p>
          </div>
          <Input
            placeholder="Rechercher classe..."
            value={search}
            leftIcon="search"
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Classe</TableHeaderCell>
              <TableHeaderCell className="w-36">Session</TableHeaderCell>
              <TableHeaderCell>Niveau &amp; Filière</TableHeaderCell>
              <TableHeaderCell className="w-36">Salle</TableHeaderCell>
              <TableHeaderCell className="w-28">Effectif</TableHeaderCell>
              <TableHeaderCell align="right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredClasses.map((c) => {
              const isClosed = c.academicYear?.status === "CLOSED" || (!c.academicYear?.isCurrent && c.academicYear?.status !== "UPCOMING");

              return (
                <TableRow key={c.id} className={isClosed ? "opacity-60 bg-[#F5F7FA]/40" : ""}>
                  <TableCell className="font-semibold text-ink-primary dark:text-white">
                    {c.label}
                    {c.niveau?.order === 1 && (
                      <Badge variant="brand" className="ml-2">Niveau 1 Auto</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {c.academicYear?.label} {isClosed ? "(Clôturée)" : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">Niveau {c.niveau?.order}</Badge>
                    <span className="ml-2 text-ink-secondary dark:text-ink-secondary-dark">{c.filiere?.name}</span>
                  </TableCell>
                  <TableCell>{c.salle?.name || "Non assignée"}</TableCell>
                  <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{c._count?.inscriptions || 0}</TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="groups"
                        onClick={() => handleOpenDetail(c.id)}
                      >
                        Effectif
                      </Button>
                      {!isClosed ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingItem(c);
                              setForm({ salleId: c.salleId || "", label: c.label });
                              setModal(true);
                            }}
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="tertiary"
                            size="sm"
                            icon="delete"
                            className="text-error"
                            onClick={() => setDeleteTarget(c)}
                          />
                        </>
                      ) : (
                        <span className="text-caption text-ink-muted italic px-2">Archive scellée</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* TIROIR LATÉRAL D'INSPECTION D'EFFECTIF (ClassDetailDrawer) */}
      <ClassDetailDrawer
        isOpen={Boolean(selectedClassDetail)}
        onClose={() => setSelectedClassDetail(null)}
        classDetail={selectedClassDetail}
      />

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editingItem ? "Modifier la Classe" : "Créer une Classe"}
        icon="groups"
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
                label="Filière"
                value={form.filiereId}
                onChange={(e) => {
                  const fil = filieres.find((f) => f.id === e.target.value);
                  setForm({ ...form, filiereId: e.target.value, niveauId: fil?.niveaux?.[0]?.id || "" });
                }}
              >
                {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
              </Select>

              <Select
                required
                label="Niveau d'études"
                value={form.niveauId}
                onChange={(e) => setForm({ ...form, niveauId: e.target.value })}
              >
                {filieres.find((f) => f.id === form.filiereId)?.niveaux?.map((n) => (
                  <option key={n.id} value={n.id}>Niveau {n.order}</option>
                ))}
              </Select>

              <Select
                required
                label="Session Académique"
                value={form.academicYearId}
                onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
              >
                {academicYears.filter((y) => y.status !== "CLOSED").map((y) => (
                  <option key={y.id} value={y.id}>{y.label} ({y.isCurrent ? "Active" : "Préparatoire"})</option>
                ))}
              </Select>
            </>
          )}

          <Select
            label="Salle assignée"
            value={form.salleId}
            onChange={(e) => setForm({ ...form, salleId: e.target.value })}
          >
            <option value="">Aucune salle assignée</option>
            {salles.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.capacity || "?"} places)</option>)}
          </Select>

          <Input label="Libellé personnalisé (Optionnel)" placeholder="Laisser vide pour auto-génération" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer la classe"
        description={`Supprimer définitivement la classe "${deleteTarget?.label}" ?`}
      />
    </motion.div>
  );
}