// packages/frontend/src/modules/pedagogie/ClassOfferingsPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
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
import DocumentViewerModal from "../documents/components/DocumentViewerModal";

export default function ClassOfferingsPage() {
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [classes, setClasses] = useState([]);
  const [classSearch, setClassSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSemesterOrder, setSelectedSemesterOrder] = useState(1);

  const [offerings, setOfferings] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formateurs, setFormateurs] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showInstantiateModal, setShowInstantiateModal] = useState(false);
  const [instantiateForm, setInstantiateForm] = useState({ mode: "FILIERE_TEMPLATE", scope: "SINGLE_CLASS" });
  const [instantiating, setInstantiating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [formPayload, setFormPayload] = useState({
    subjectId: "",
    gradePeriodId: "",
    categoryId: "",
    formateurId: "",
    coefficient: 2.0,
    volumeHoraire: 45,
  });

  const [pdfModal, setPdfModal] = useState(null);

  function loadInitial() {
    Promise.all([
      apiFetch("/academic-years"),
      apiFetch("/classes"),
      apiFetch("/subjects"),
      apiFetch("/categories"),
      apiFetch("/formateurs"),
    ])
      .then(([years, cls, subs, cats, forms]) => {
        setAcademicYears(years || []);
        const activeY = (years || []).find((y) => y.isCurrent) || years?.[0];
        if (activeY) setSelectedYearId(activeY.id);

        setClasses(cls || []);
        setSubjects(subs || []);
        setCategories(cats || []);
        setFormateurs(forms || []);
      })
      .catch((e) => showToast(e.message, "error"));
  }

  useEffect(() => { loadInitial(); }, []);

  const yearClasses = useMemo(() => {
    return classes.filter((c) => c.academicYearId === selectedYearId);
  }, [classes, selectedYearId]);

  const filteredClasses = useMemo(() => {
    if (!classSearch.trim()) return yearClasses;
    return yearClasses.filter((c) => c.label.toLowerCase().includes(classSearch.toLowerCase()));
  }, [yearClasses, classSearch]);

  useEffect(() => {
    if (filteredClasses.length > 0) {
      if (!filteredClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(filteredClasses[0].id);
      }
    } else {
      setSelectedClassId("");
      setOfferings([]);
      setPeriods([]);
    }
  }, [filteredClasses]);

  function loadClassOfferings(classId) {
    if (!classId) return;
    apiFetch(`/classes/${classId}/offerings`)
      .then((data) => {
        const offs = Array.isArray(data) ? data : data.offerings || [];
        const per = data.periods || [];
        setOfferings(offs);
        setPeriods(per);
      })
      .catch((e) => showToast(e.message, "error"));
  }

  useEffect(() => {
    loadClassOfferings(selectedClassId);
  }, [selectedClassId]);

  const semesterOfferings = useMemo(() => {
    return offerings.filter((o) => o.gradePeriod?.order === selectedSemesterOrder);
  }, [offerings, selectedSemesterOrder]);

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedYear = academicYears.find((y) => y.id === selectedYearId);
  const isClassClosed = selectedYear?.status === "CLOSED" || (!selectedYear?.isCurrent && selectedYear?.status !== "UPCOMING");

  async function handleInstantiateSubmit(e) {
    e.preventDefault();
    setInstantiating(true);
    try {
      const res = await apiFetch("/classes/instantiate-template", {
        method: "POST",
        body: JSON.stringify({
          classeId: selectedClassId,
          targetYearId: selectedYearId,
          mode: instantiateForm.mode,
          scope: instantiateForm.scope,
        }),
      });
      setShowInstantiateModal(false);
      showToast(res.message, "success");
      loadClassOfferings(selectedClassId);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setInstantiating(false);
    }
  }

  async function handleAddOffering(e) {
    e.preventDefault();
    try {
      await apiFetch(`/classes/${selectedClassId}/offerings`, {
        method: "POST",
        body: JSON.stringify(formPayload),
      });
      setShowAddModal(false);
      showToast("Matière ajoutée à la classe.", "success");
      loadClassOfferings(selectedClassId);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleUpdateField(offeringId, field, value) {
    try {
      await apiFetch(`/offerings/${offeringId}`, {
        method: "PUT",
        body: JSON.stringify({ [field]: value }),
      });
      loadClassOfferings(selectedClassId);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function confirmDeleteOffering() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/offerings/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast("Matière retirée de la classe.", "info");
      loadClassOfferings(selectedClassId);
    } catch (err) {
      showToast(err.message, "error");
      setDeleteTarget(null);
    }
  }

  async function handlePrintPv(periodId, forceRegenerate = false) {
    try {
      const res = await apiFetch(`/grades/classes/${selectedClassId}/semester-sheet`, {
        method: "POST",
        body: JSON.stringify({ gradePeriodId: periodId, forceRegenerate }),
      });
      const token = getToken();
      setPdfModal({
        title: `PV de Délibération (A4 Paysage) — ${selectedClass?.label}`,
        previewUrl: `${API_BASE}${res.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.downloadUrl}?token=${token}`,
        periodId,
        reused: res.reused,
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Pédagogie • Maquettes de Cours</Badge>}
        title="Maquettes Pédagogiques de Classes"
        subtitle="Affectation des cours semestriels, coefficients, volumes horaires et attribution des enseignants"
        actions={
          !isClassClosed && (
            <>
              <Button
                variant="secondary"
                icon="bolt"
                onClick={() => {
                  setInstantiateForm({ mode: "FILIERE_TEMPLATE", scope: "SINGLE_CLASS" });
                  setShowInstantiateModal(true);
                }}
                disabled={!selectedClassId}
              >
                Instancier Maquettes
              </Button>

              <Button
                variant="primary"
                icon="add"
                onClick={() => {
                  const defaultP = periods.find((p) => p.order === selectedSemesterOrder) || periods[0];
                  setFormPayload({
                    subjectId: subjects[0]?.id || "",
                    gradePeriodId: defaultP?.id || "",
                    categoryId: categories[0]?.id || "",
                    formateurId: "",
                    coefficient: 2.0,
                    volumeHoraire: 45,
                  });
                  setShowAddModal(true);
                }}
                disabled={!selectedClassId || periods.length === 0}
              >
                Ajouter un Cours
              </Button>
            </>
          )
        }
      />

      <StructuredPanel
        title="Sélection de la Classe &amp; Semestre"
        subtitle="Visualisez les matières enseignées et leurs enseignants"
        icon="auto_stories"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="1. Session Académique"
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.label} {y.isCurrent ? "(Active)" : y.status === "CLOSED" ? "(🔒 Clôturée)" : "(Préparatoire)"}</option>
            ))}
          </Select>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-caption font-semibold uppercase tracking-wider text-ink-secondary select-none dark:text-ink-secondary-dark">
                2. Classe
              </label>
              <input
                type="text"
                placeholder="Filtrer..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="h-6 px-1.5 text-[11px] rounded bg-surface border border-border outline-none w-20 dark:bg-surface-dark dark:border-border-dark"
              />
            </div>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="h-[40px] w-full rounded bg-surface px-3 py-2 text-body text-ink-primary border border-border outline-none dark:bg-surface-dark dark:border-border-dark dark:text-white"
            >
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.label} ({c._count?.inscriptions || 0} élèves)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-caption font-semibold uppercase tracking-wider text-ink-secondary block mb-1.5 select-none dark:text-ink-secondary-dark">
              3. Semestre Affiché
            </label>
            <div className="flex p-0.5 bg-[#F5F7FA] rounded border border-border h-[40px] dark:bg-[#07111D] dark:border-border-dark">
              <button
                type="button"
                onClick={() => setSelectedSemesterOrder(1)}
                className={`flex-1 rounded-[2px] text-body-sm font-semibold transition-colors ${
                  selectedSemesterOrder === 1 ? "bg-brand-900 text-white shadow-xs dark:bg-brand-500" : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                Semestre 1
              </button>
              <button
                type="button"
                onClick={() => setSelectedSemesterOrder(2)}
                className={`flex-1 rounded-[2px] text-body-sm font-semibold transition-colors ${
                  selectedSemesterOrder === 2 ? "bg-brand-900 text-white shadow-xs dark:bg-brand-500" : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                Semestre 2
              </button>
            </div>
          </div>
        </div>
      </StructuredPanel>

      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-border-dark">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans">
                {selectedClass?.label || "Classe"} — Semestre {selectedSemesterOrder} ({semesterOfferings.length} cours)
              </h3>
              {isClassClosed && <Badge variant="neutral">🔒 Session Clôturée</Badge>}
            </div>
            <p className="text-caption text-ink-muted mt-0.5">
              Filière : {selectedClass?.filiere?.name} • Session : {selectedYear?.label}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {periods.map((p) => (
              <Button key={p.id} variant="secondary" size="sm" icon="print" onClick={() => handlePrintPv(p.id)}>
                PV Paysage ({p.label})
              </Button>
            ))}
          </div>
        </div>

        {semesterOfferings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-body-sm text-ink-muted">Aucune matière n'est configurée pour le Semestre {selectedSemesterOrder}.</p>
            {!isClassClosed && (
              <Button variant="primary" icon="bolt" onClick={() => { setInstantiateForm({ mode: "FILIERE_TEMPLATE", scope: "SINGLE_CLASS" }); setShowInstantiateModal(true); }}>
                Instancier Automatiquement
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="w-28">Code</TableHeaderCell>
                <TableHeaderCell>Discipline</TableHeaderCell>
                <TableHeaderCell>Catégorie / Groupe</TableHeaderCell>
                <TableHeaderCell className="w-28 text-center">Coefficient</TableHeaderCell>
                <TableHeaderCell className="w-28 text-center">Volume (h)</TableHeaderCell>
                <TableHeaderCell>Formateur Assigné</TableHeaderCell>
                {!isClassClosed && <TableHeaderCell align="right">Action</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {semesterOfferings.map((co) => (
                <TableRow key={co.id}>
                  <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{co.subject?.code || "—"}</TableCell>
                  <TableCell className="font-semibold text-ink-primary dark:text-white">{co.subject?.name}</TableCell>
                  <TableCell>
                    {!isClassClosed ? (
                      <select
                        value={co.categoryId || ""}
                        onChange={(e) => handleUpdateField(co.id, "categoryId", e.target.value || null)}
                        className="h-8 rounded bg-surface border border-border px-2 text-caption font-semibold outline-none dark:bg-surface-dark dark:border-border-dark dark:text-white"
                      >
                        <option value="">Général / Sans groupe</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-semibold text-ink-secondary">{co.category?.name || "Général"}</span>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {!isClassClosed ? (
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={co.coefficient}
                        onChange={(e) => handleUpdateField(co.id, "coefficient", e.target.value)}
                        className="w-16 h-7 text-center rounded border border-border bg-surface font-mono font-bold outline-none dark:bg-surface-dark dark:border-border-dark dark:text-white"
                      />
                    ) : (
                      <span className="font-mono font-bold">{co.coefficient}</span>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {!isClassClosed ? (
                      <input
                        type="number"
                        value={co.volumeHoraire || ""}
                        onChange={(e) => handleUpdateField(co.id, "volumeHoraire", e.target.value)}
                        placeholder="—"
                        className="w-16 h-7 text-center rounded border border-border bg-surface font-mono outline-none dark:bg-surface-dark dark:border-border-dark dark:text-white"
                      />
                    ) : (
                      <span className="font-mono">{co.volumeHoraire ? `${co.volumeHoraire}h` : "—"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!isClassClosed ? (
                      <select
                        value={co.formateurId || ""}
                        onChange={(e) => handleUpdateField(co.id, "formateurId", e.target.value || null)}
                        className="h-8 rounded bg-surface border border-border px-2 text-caption font-semibold outline-none dark:bg-surface-dark dark:border-border-dark dark:text-white"
                      >
                        <option value="">Non assigné</option>
                        {formateurs.map((f) => (
                          <option key={f.id} value={f.id}>{f.lastName} {f.firstName} ({f.specialite || "Enseignant"})</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-body-sm">{co.formateur ? `${co.formateur.firstName} ${co.formateur.lastName}` : "Non assigné"}</span>
                    )}
                  </TableCell>
                  {!isClassClosed && (
                    <TableCell align="right">
                      <Button
                        variant="tertiary"
                        size="sm"
                        icon="delete"
                        className="text-error"
                        onClick={() => setDeleteTarget({ id: co.id, name: co.subject?.name, classe: selectedClass?.label })}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modale Instanciation */}
      <Modal
        isOpen={showInstantiateModal}
        onClose={() => setShowInstantiateModal(false)}
        title="Instanciation des Maquettes de Cours"
        icon="bolt"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowInstantiateModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleInstantiateSubmit} isLoading={instantiating}>
              Lancer l'Instanciation
            </Button>
          </>
        }
      >
        <form onSubmit={handleInstantiateSubmit} className="space-y-4">
          <div>
            <label className="text-caption font-semibold uppercase tracking-wider text-ink-secondary block mb-2 dark:text-ink-secondary-dark">
              1. Périmètre d'application
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInstantiateForm({ ...instantiateForm, scope: "SINGLE_CLASS" })}
                className={`p-3 rounded border text-left transition-colors ${
                  instantiateForm.scope === "SINGLE_CLASS"
                    ? "bg-brand-900/10 border-brand-900 text-brand-900 font-bold dark:bg-brand-500/20 dark:text-white"
                    : "bg-surface text-ink-secondary border-border dark:bg-surface-dark dark:border-border-dark"
                }`}
              >
                <div>Classe Unique</div>
                <div className="text-caption font-normal truncate opacity-80">{selectedClass?.label}</div>
              </button>

              <button
                type="button"
                onClick={() => setInstantiateForm({ ...instantiateForm, scope: "ALL_CENTER" })}
                className={`p-3 rounded border text-left transition-colors ${
                  instantiateForm.scope === "ALL_CENTER"
                    ? "bg-brand-900/10 border-brand-900 text-brand-900 font-bold dark:bg-brand-500/20 dark:text-white"
                    : "bg-surface text-ink-secondary border-border dark:bg-surface-dark dark:border-border-dark"
                }`}
              >
                <div>Tout l'Établissement</div>
                <div className="text-caption font-normal opacity-80">Toutes les classes de {selectedYear?.label}</div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-caption font-semibold uppercase tracking-wider text-ink-secondary block mb-2 dark:text-ink-secondary-dark">
              2. Méthode d'instanciation
            </label>
            <div className="space-y-2.5">
              <label className="flex items-start gap-3 p-3 rounded border border-border bg-surface cursor-pointer dark:bg-surface-dark dark:border-border-dark">
                <input
                  type="radio"
                  name="instantiateMode"
                  checked={instantiateForm.mode === "FILIERE_TEMPLATE"}
                  onChange={() => setInstantiateForm({ ...instantiateForm, mode: "FILIERE_TEMPLATE" })}
                  className="mt-1 accent-brand-900"
                />
                <div>
                  <div className="font-semibold text-ink-primary dark:text-white">Option A : Cursus Filière Standard</div>
                  <div className="text-caption text-ink-muted">Injecte les matières, coefficients et volumes horaires par défaut de chaque niveau.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded border border-border bg-surface cursor-pointer dark:bg-surface-dark dark:border-border-dark">
                <input
                  type="radio"
                  name="instantiateMode"
                  checked={instantiateForm.mode === "PREVIOUS_SESSION"}
                  onChange={() => setInstantiateForm({ ...instantiateForm, mode: "PREVIOUS_SESSION" })}
                  className="mt-1 accent-brand-900"
                />
                <div>
                  <div className="font-semibold text-ink-primary dark:text-white">Option B : Reconduire la session précédente (avec Formateurs)</div>
                  <div className="text-caption text-ink-muted">Duplique la maquette de l'an dernier et réaffecte automatiquement les mêmes enseignants.</div>
                </div>
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modale Ajout Cours */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Ajouter une Matière à la Classe"
        icon="add"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleAddOffering}>Ajouter</Button>
          </>
        }
      >
        <form onSubmit={handleAddOffering} className="space-y-4">
          <Select
            required
            label="Semestre"
            value={formPayload.gradePeriodId}
            onChange={(e) => setFormPayload({ ...formPayload, gradePeriodId: e.target.value })}
          >
            <option value="">Sélectionner un semestre</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>

          <Select
            required
            label="Discipline"
            value={formPayload.subjectId}
            onChange={(e) => setFormPayload({ ...formPayload, subjectId: e.target.value })}
          >
            <option value="">Sélectionner une matière</option>
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

          <Select
            label="Formateur assigné"
            value={formPayload.formateurId}
            onChange={(e) => setFormPayload({ ...formPayload, formateurId: e.target.value })}
          >
            <option value="">Non assigné</option>
            {formateurs.map((f) => <option key={f.id} value={f.id}>{f.lastName} {f.firstName}</option>)}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="0.5"
              min="0.5"
              label="Coefficient"
              value={formPayload.coefficient}
              onChange={(e) => setFormPayload({ ...formPayload, coefficient: e.target.value })}
            />
            <Input
              type="number"
              label="Volume Horaire (h)"
              value={formPayload.volumeHoraire}
              onChange={(e) => setFormPayload({ ...formPayload, volumeHoraire: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteOffering}
        title="Retirer la matière"
        description={`Retirer la matière "${deleteTarget?.name}" de la classe "${deleteTarget?.classe}" ?`}
      />

      <DocumentViewerModal
        isOpen={Boolean(pdfModal)}
        title={pdfModal?.title}
        previewUrl={pdfModal?.previewUrl}
        downloadUrl={pdfModal?.downloadUrl}
        isReused={pdfModal?.reused}
        onForceRegenerate={() => handlePrintPv(pdfModal.periodId, true)}
        onClose={() => setPdfModal(null)}
      />
    </motion.div>
  );
}