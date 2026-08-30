// packages/frontend/src/modules/pedagogie/FiliereCurriculumPage.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel } from "../../design-system/layout/Card";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Select from "../../design-system/primitives/Select";
import Badge from "../../design-system/primitives/Badge";
import Modal from "../../design-system/overlays/Modal";
import ConfirmDialog from "../../design-system/overlays/ConfirmDialog";

export default function FiliereCurriculumPage() {
  const [filieres, setFilieres] = useState([]);
  const [selectedFiliereId, setSelectedFiliereId] = useState("");
  const [curriculumData, setCurriculumData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAddModal, setShowAddModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formPayload, setFormPayload] = useState({ subjectId: "", categoryId: "", defaultCoefficient: 2, defaultVolumeHoraire: 45 });

  useEffect(() => {
    Promise.all([apiFetch("/filieres"), apiFetch("/subjects"), apiFetch("/categories")]).then(([fils, subs, cats]) => {
      setFilieres(fils || []);
      setSubjects(subs || []);
      setCategories(cats || []);
      if (fils?.length > 0) setSelectedFiliereId(fils[0].id);
    }).catch((e) => showToast(e.message, "error"));
  }, []);

  useEffect(() => {
    if (!selectedFiliereId) return;
    apiFetch(`/filieres/${selectedFiliereId}/curriculum`).then((data) => setCurriculumData(data)).catch((e) => showToast(e.message, "error"));
  }, [selectedFiliereId]);

  async function handleAddSubject(e) {
    e.preventDefault();
    try {
      await apiFetch(`/filieres/${selectedFiliereId}/subjects`, {
        method: "POST",
        body: JSON.stringify({
          niveauOrder: showAddModal.niveauOrder,
          semesterOrder: showAddModal.semesterOrder,
          ...formPayload,
        }),
      });
      setShowAddModal(null);
      showToast("Matière rattachée au cursus avec succès.", "success");
      const data = await apiFetch(`/filieres/${selectedFiliereId}/curriculum`);
      setCurriculumData(data);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function confirmDeleteSubject() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/filieres/subjects/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast("Matière retirée du cursus.", "info");
      const data = await apiFetch(`/filieres/${selectedFiliereId}/curriculum`);
      setCurriculumData(data);
    } catch (err) {
      showToast(err.message, "error");
      setDeleteTarget(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Pédagogie • Maquettes Types</Badge>}
        title="Cursus &amp; Programmes de Filière"
        subtitle="Définissez les matières, coefficients et volumes horaires standards par niveau et semestre"
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface p-4 rounded border border-border shadow-xs dark:bg-surface-dark dark:border-border-dark">
        <div className="flex items-center gap-3">
          <label className="text-caption font-semibold uppercase tracking-wider text-ink-secondary select-none dark:text-ink-secondary-dark">
            Filière d'études :
          </label>
          <select
            value={selectedFiliereId}
            onChange={(e) => setSelectedFiliereId(e.target.value)}
            className="h-[40px] rounded bg-surface px-3 py-2 text-body font-semibold text-ink-primary border border-border outline-none w-80 dark:bg-surface-dark dark:border-border-dark dark:text-white"
          >
            {filieres.map((f) => (
              <option key={f.id} value={f.id}>{f.name} ({f.programType?.code}) — {f.durationInYears} an(s)</option>
            ))}
          </select>
        </div>
      </div>

      {curriculumData?.curriculum?.map((niv) => (
        <StructuredPanel
          key={niv.niveauOrder}
          title={`NIVEAU ${niv.niveauOrder}`}
          subtitle={`Cycle pluriannuel de ${curriculumData.filiere?.durationInYears} an(s)`}
          icon="account_tree"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border -mx-6 -my-4 dark:divide-border-dark">
            {niv.semesters.map((sem) => (
              <div key={sem.semesterOrder} className="p-6 space-y-3">
                <div className="flex justify-between items-center pb-2.5 border-b border-border dark:border-border-dark">
                  <span className="font-heading font-semibold text-body-md text-brand-900 dark:text-brand-500">{sem.label}</span>
                  <Button
                    variant="tertiary"
                    size="sm"
                    icon="add"
                    onClick={() => {
                      setFormPayload({ subjectId: subjects[0]?.id || "", categoryId: categories[0]?.id || "", defaultCoefficient: 2, defaultVolumeHoraire: 45 });
                      setShowAddModal({ niveauOrder: niv.niveauOrder, semesterOrder: sem.semesterOrder });
                    }}
                  >
                    Ajouter Matière
                  </Button>
                </div>

                <div className="space-y-2">
                  {sem.subjects.length === 0 ? (
                    <p className="text-caption text-ink-muted italic py-4 text-center">Aucune matière affectée.</p>
                  ) : (
                    sem.subjects.map((fs) => (
                      <div key={fs.id} className="flex justify-between items-center p-3 rounded bg-[#F5F7FA] border border-border text-body-sm dark:bg-[#07111D] dark:border-border-dark">
                        <div>
                          <div className="font-semibold text-ink-primary dark:text-white flex items-center gap-2">
                            <Badge variant="brand">{fs.subject?.code || "—"}</Badge>
                            <span>{fs.subject?.name}</span>
                          </div>
                          <div className="text-caption text-ink-muted font-mono mt-1">
                            {fs.category?.name || "Sans groupe"} • Coef {fs.defaultCoefficient} • {fs.defaultVolumeHoraire ? `${fs.defaultVolumeHoraire}h` : "—"}
                          </div>
                        </div>
                        <Button
                          variant="tertiary"
                          size="sm"
                          icon="delete"
                          className="text-error"
                          onClick={() => setDeleteTarget({ id: fs.id, name: fs.subject?.name, code: fs.subject?.code, niveau: niv.niveauOrder, semester: sem.label })}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </StructuredPanel>
      ))}

      <Modal
        isOpen={Boolean(showAddModal)}
        onClose={() => setShowAddModal(null)}
        title={`Ajouter au Cursus (Niveau ${showAddModal?.niveauOrder} - S${showAddModal?.semesterOrder})`}
        icon="add"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleAddSubject}>Ajouter</Button>
          </>
        }
      >
        <form onSubmit={handleAddSubject} className="space-y-4">
          <Select
            required
            label="Matière"
            value={formPayload.subjectId}
            onChange={(e) => setFormPayload({ ...formPayload, subjectId: e.target.value })}
          >
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code || "—"})</option>)}
          </Select>

          <Select
            label="Catégorie / Groupe"
            value={formPayload.categoryId}
            onChange={(e) => setFormPayload({ ...formPayload, categoryId: e.target.value })}
          >
            <option value="">Aucune catégorie (Général)</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="0.5"
              min="0.5"
              label="Coefficient"
              value={formPayload.defaultCoefficient}
              onChange={(e) => setFormPayload({ ...formPayload, defaultCoefficient: e.target.value })}
            />
            <Input
              type="number"
              label="Volume Horaire (h)"
              value={formPayload.defaultVolumeHoraire}
              onChange={(e) => setFormPayload({ ...formPayload, defaultVolumeHoraire: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteSubject}
        title="Retirer du cursus"
        description={`Retirer la matière "${deleteTarget?.name}" du Niveau ${deleteTarget?.niveau} (${deleteTarget?.semester}) ?`}
      />
    </motion.div>
  );
}