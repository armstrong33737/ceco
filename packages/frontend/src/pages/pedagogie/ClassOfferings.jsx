// packages/frontend/src/pages/pedagogie/ClassOfferings.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import Icon from "../../components/Icon";
import PdfViewerModal from "../../components/PdfViewerModal";

export default function ClassOfferings() {
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

  // Modales
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

  const [error, setError] = useState(null);

  // Modale PV Paysage
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
      .catch((e) => setError(e.message));
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
      .catch((e) => setError(e.message));
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
    setError(null);
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
      showToast(err.message || "Échec de l'instanciation.", "error");
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
      showToast(err.message || "Erreur lors de l'ajout.", "error");
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
      showToast(err.message || "Erreur de mise à jour.", "error");
    }
  }

  async function confirmDeleteOffering() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/offerings/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast("Matière retirée de la classe.", "warning");
      loadClassOfferings(selectedClassId);
    } catch (err) {
      showToast(err.message || "Impossible de retirer ce cours.", "error");
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
      showToast(err.message || "Erreur lors de l'édition du PV.", "error");
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. Entonnoir de Sélection Séquentielle */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Icon name="auto_stories" className="text-blue-700 text-[18px]" />
              <span>Maquettes Pédagogiques de Classes</span>
            </h3>
            <p className="text-xs text-slate-500">
              Affectation des cours semestriels, coefficients, volumes horaires et attribution des enseignants.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isClassClosed && (
              <>
                <button
                  onClick={() => {
                    setInstantiateForm({ mode: "FILIERE_TEMPLATE", scope: "SINGLE_CLASS" });
                    setShowInstantiateModal(true);
                  }}
                  disabled={!selectedClassId}
                  className="btn-secondary text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  <Icon name="bolt" className="text-[16px]" />
                  <span>Instancier Maquette</span>
                </button>

                <button
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
                  className="btn-primary"
                >
                  <Icon name="add" className="text-[16px]" />
                  <span>Ajouter un Cours</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filtres */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">1. Session Académique</label>
            <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)} className="input-field w-full">
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label} {y.isCurrent ? "(Active)" : y.status === "CLOSED" ? "(🔒 Clôturée)" : "(Préparatoire)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase">2. Classe</label>
              <input
                type="text"
                placeholder="Filtrer..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="text-[9px] px-1.5 py-0.5 rounded border border-slate-300 outline-none w-24 bg-slate-50 focus:bg-white"
              />
            </div>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="input-field w-full">
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.label} ({c._count?.inscriptions || 0} élèves)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">3. Semestre</label>
            <div className="flex p-0.5 bg-slate-100 rounded border border-slate-200 h-9">
              <button
                type="button"
                onClick={() => setSelectedSemesterOrder(1)}
                className={`flex-1 rounded text-xs font-bold transition-all ${
                  selectedSemesterOrder === 1 ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semestre 1
              </button>
              <button
                type="button"
                onClick={() => setSelectedSemesterOrder(2)}
                className={`flex-1 rounded text-xs font-bold transition-all ${
                  selectedSemesterOrder === 2 ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semestre 2
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-semibold">{error}</div>}

      {/* 2. Tableau des Matières de la Classe */}
      <div className="table-container space-y-3">
        <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                {selectedClass?.label || "Classe"} — Semestre {selectedSemesterOrder} ({semesterOfferings.length} cours)
              </h3>
              {isClassClosed && (
                <span className="badge-slate">
                  🔒 Session Clôturée (Lecture Seule)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Filière : {selectedClass?.filiere?.name} • Session : {selectedYear?.label}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePrintPv(p.id)}
                className="btn-secondary text-[11px]"
              >
                <Icon name="print" className="text-[14px]" />
                <span>PV Paysage ({p.label})</span>
              </button>
            ))}
          </div>
        </div>

        {semesterOfferings.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs text-slate-500">Aucune matière n'est configurée pour le Semestre {selectedSemesterOrder}.</p>
            {!isClassClosed && (
              <button
                onClick={() => {
                  setInstantiateForm({ mode: "FILIERE_TEMPLATE", scope: "SINGLE_CLASS" });
                  setShowInstantiateModal(true);
                }}
                className="btn-primary"
              >
                Instancier les matières automatiquement
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell w-28">Code</th>
                  <th className="table-header-cell">Discipline</th>
                  <th className="table-header-cell">Groupe / Catégorie</th>
                  <th className="table-header-cell w-28 text-center">Coefficient</th>
                  <th className="table-header-cell w-28 text-center">Volume (h)</th>
                  <th className="table-header-cell">Formateur Assigné</th>
                  {!isClassClosed && <th className="table-header-cell text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {semesterOfferings.map((co) => (
                  <tr key={co.id} className="table-body-row">
                    <td className="table-body-cell font-mono font-bold text-blue-700">{co.subject?.code || "—"}</td>
                    <td className="table-body-cell font-bold text-slate-900">{co.subject?.name}</td>

                    <td className="table-body-cell">
                      {!isClassClosed ? (
                        <select
                          value={co.categoryId || ""}
                          onChange={(e) => handleUpdateField(co.id, "categoryId", e.target.value || null)}
                          className="h-8 rounded bg-white border border-slate-300 px-2 text-xs font-semibold"
                        >
                          <option value="">Général / Sans groupe</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-semibold text-slate-800">{co.category?.name || "Général"}</span>
                      )}
                    </td>

                    <td className="table-body-cell text-center">
                      {!isClassClosed ? (
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={co.coefficient}
                          onChange={(e) => handleUpdateField(co.id, "coefficient", e.target.value)}
                          className="w-16 h-7 text-center rounded border border-slate-300 bg-white font-mono font-bold"
                        />
                      ) : (
                        <span className="font-mono font-bold">{co.coefficient}</span>
                      )}
                    </td>

                    <td className="table-body-cell text-center">
                      {!isClassClosed ? (
                        <input
                          type="number"
                          value={co.volumeHoraire || ""}
                          onChange={(e) => handleUpdateField(co.id, "volumeHoraire", e.target.value)}
                          placeholder="—"
                          className="w-16 h-7 text-center rounded border border-slate-300 bg-white font-mono"
                        />
                      ) : (
                        <span className="font-mono">{co.volumeHoraire ? `${co.volumeHoraire}h` : "—"}</span>
                      )}
                    </td>

                    <td className="table-body-cell">
                      {!isClassClosed ? (
                        <select
                          value={co.formateurId || ""}
                          onChange={(e) => handleUpdateField(co.id, "formateurId", e.target.value || null)}
                          className="h-8 rounded bg-white border border-slate-300 px-2 text-xs font-semibold"
                        >
                          <option value="">Non assigné</option>
                          {formateurs.map((f) => (
                            <option key={f.id} value={f.id}>{f.lastName} {f.firstName} ({f.specialite || "Enseignant"})</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-semibold">{co.formateur ? `${co.formateur.firstName} ${co.formateur.lastName}` : "Non assigné"}</span>
                      )}
                    </td>

                    {!isClassClosed && (
                      <td className="table-body-cell text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setDeleteTarget({ id: co.id, name: co.subject?.name, classe: selectedClass?.label })}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Retirer ce cours"
                        >
                          <Icon name="delete" className="text-[16px]" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. PORTAIL DES MODALES */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* MODALE INSTANCIATION */}
          {showInstantiateModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleInstantiateSubmit}
                className="w-full max-w-lg bg-white p-5 rounded-xl shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="bolt" className="text-blue-700 text-[20px]" />
                    <h4 className="font-bold text-sm text-slate-900">Instanciation des Maquettes de Cours</h4>
                  </div>
                  <button type="button" onClick={() => setShowInstantiateModal(false)} className="text-slate-400 hover:text-slate-700">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 uppercase block mb-1">1. Périmètre d'application</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setInstantiateForm({ ...instantiateForm, scope: "SINGLE_CLASS" })}
                        className={`p-2.5 rounded border text-left font-semibold transition-all ${
                          instantiateForm.scope === "SINGLE_CLASS" ? "bg-blue-50 text-blue-700 border-blue-300 font-bold" : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        <div>Classe Unique</div>
                        <div className="text-[10px] font-normal truncate">{selectedClass?.label}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setInstantiateForm({ ...instantiateForm, scope: "ALL_CENTER" })}
                        className={`p-2.5 rounded border text-left font-semibold transition-all ${
                          instantiateForm.scope === "ALL_CENTER" ? "bg-blue-50 text-blue-700 border-blue-300 font-bold" : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        <div>Tout l'Établissement</div>
                        <div className="text-[10px] font-normal">Toutes les classes de {selectedYear?.label}</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 uppercase block mb-1">2. Méthode d'instanciation</label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 p-2.5 rounded border bg-slate-50 border-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name="instantiateMode"
                          checked={instantiateForm.mode === "FILIERE_TEMPLATE"}
                          onChange={() => setInstantiateForm({ ...instantiateForm, mode: "FILIERE_TEMPLATE" })}
                          className="mt-0.5 accent-blue-700"
                        />
                        <div>
                          <div className="font-bold text-slate-900">Depuis le Cursus Filière Standard</div>
                          <div className="text-[11px] text-slate-500">Injecte les matières, coefficients et volumes horaires par défaut de chaque niveau.</div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2 p-2.5 rounded border bg-slate-50 border-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name="instantiateMode"
                          checked={instantiateForm.mode === "PREVIOUS_SESSION"}
                          onChange={() => setInstantiateForm({ ...instantiateForm, mode: "PREVIOUS_SESSION" })}
                          className="mt-0.5 accent-blue-700"
                        />
                        <div>
                          <div className="font-bold text-slate-900">Reconduire la session précédente</div>
                          <div className="text-[11px] text-slate-500">Duplique la maquette de l'an dernier et réaffecte automatiquement les mêmes enseignants.</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setShowInstantiateModal(false)} className="btn-secondary">Annuler</button>
                  <button type="submit" disabled={instantiating} className="btn-primary">
                    {instantiating ? "Génération en cours..." : "Lancer l'instanciation"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* MODALE AJOUT COURS */}
          {showAddModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleAddOffering}
                className="w-full max-w-md bg-white p-5 rounded-xl shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900">Ajouter un Cours à la Classe</h4>
                  <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Semestre *</label>
                    <select
                      required
                      value={formPayload.gradePeriodId}
                      onChange={(e) => setFormPayload({ ...formPayload, gradePeriodId: e.target.value })}
                      className="input-field w-full"
                    >
                      <option value="">Sélectionner un semestre</option>
                      {periods.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Discipline *</label>
                    <select required value={formPayload.subjectId} onChange={(e) => setFormPayload({ ...formPayload, subjectId: e.target.value })} className="input-field w-full">
                      <option value="">Sélectionner une matière</option>
                      {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code || "—"})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Groupe / Catégorie</label>
                    <select value={formPayload.categoryId} onChange={(e) => setFormPayload({ ...formPayload, categoryId: e.target.value })} className="input-field w-full">
                      <option value="">Aucune catégorie (Général)</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Formateur assigné</label>
                    <select value={formPayload.formateurId} onChange={(e) => setFormPayload({ ...formPayload, formateurId: e.target.value })} className="input-field w-full">
                      <option value="">Non assigné</option>
                      {formateurs.map((f) => <option key={f.id} value={f.id}>{f.lastName} {f.firstName}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Coefficient</label>
                      <input type="number" step="0.5" min="0.5" value={formPayload.coefficient} onChange={(e) => setFormPayload({ ...formPayload, coefficient: e.target.value })} className="input-field w-full font-mono font-bold" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Volume Horaire (h)</label>
                      <input type="number" value={formPayload.volumeHoraire} onChange={(e) => setFormPayload({ ...formPayload, volumeHoraire: e.target.value })} className="input-field w-full font-mono" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Annuler</button>
                  <button type="submit" className="btn-primary">Ajouter le Cours</button>
                </div>
              </motion.form>
            </div>
          )}

          {/* MODALE SUPPRESSION */}
          {deleteTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center gap-2 text-rose-600 border-b border-slate-200 pb-2">
                  <Icon name="warning" className="text-[20px]" />
                  <h3 className="text-sm font-bold text-slate-900">Retirer le cours</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Retirer définitivement la matière <strong>{deleteTarget.name}</strong> de la classe <strong>{deleteTarget.classe}</strong> ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Annuler</button>
                  <button onClick={confirmDeleteOffering} className="btn-primary bg-rose-600 hover:bg-rose-700">
                    Confirmer le retrait
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* VISIONNEUSE PDF */}
          <PdfViewerModal
            isOpen={Boolean(pdfModal)}
            title={pdfModal?.title}
            previewUrl={pdfModal?.previewUrl}
            downloadUrl={pdfModal?.downloadUrl}
            isReused={pdfModal?.reused}
            onForceRegenerate={() => handlePrintPv(pdfModal.periodId, true)}
            onClose={() => setPdfModal(null)}
          />
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}