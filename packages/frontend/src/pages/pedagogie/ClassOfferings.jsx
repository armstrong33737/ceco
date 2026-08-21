// packages/frontend/src/pages/pedagogie/ClassOfferings.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import Icon from "../../components/Icon";
import PdfViewerModal from "../../components/PdfViewerModal";

const inputCls = "h-9 rounded bg-surface px-2.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary w-full";

export default function ClassOfferings() {
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [classes, setClasses] = useState([]);
  const [classSearch, setClassSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSemesterOrder, setSelectedSemesterOrder] = useState(1); // 1 ou 2

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
  const [successMsg, setSuccessMsg] = useState("");

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

  // Classes filtrées selon l'année sélectionnée
  const yearClasses = useMemo(() => {
    return classes.filter((c) => c.academicYearId === selectedYearId);
  }, [classes, selectedYearId]);

  // Classes filtrées par la recherche textuelle
  const filteredClasses = useMemo(() => {
    if (!classSearch.trim()) return yearClasses;
    return yearClasses.filter((c) => c.label.toLowerCase().includes(classSearch.toLowerCase()));
  }, [yearClasses, classSearch]);

  // Sélection de la première classe éligible
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

  // Matières filtrées par semestre
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
      setSuccessMsg(res.message);
      setTimeout(() => setSuccessMsg(""), 4000);
      loadClassOfferings(selectedClassId);
    } catch (err) {
      setError(err.message);
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
      setSuccessMsg("Matière ajoutée à la classe.");
      setTimeout(() => setSuccessMsg(""), 3000);
      loadClassOfferings(selectedClassId);
    } catch (err) {
      setError(err.message);
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
      setError(err.message);
    }
  }

  async function confirmDeleteOffering() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/offerings/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSuccessMsg("Matière retirée de la classe.");
      setTimeout(() => setSuccessMsg(""), 3000);
      loadClassOfferings(selectedClassId);
    } catch (err) {
      setError(err.message);
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
      setError(err.message);
    }
  }

  return (
    <div className="space-y-md">
      {/* Barre de sélection séquentielle */}
      <div className="bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2">
          <div>
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Icon name="auto_stories" className="text-primary text-[18px]" />
              <span>Maquettes Pédagogiques de Classes</span>
            </h3>
            <p className="text-xs text-on-surface-variant">
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
                  className="rounded-md bg-primary-light border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Icon name="bolt" className="text-[16px]" />
                  <span>Instancier les Maquettes</span>
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
                  className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-bold text-white flex items-center gap-1 shadow-xs disabled:opacity-50"
                >
                  <Icon name="add" className="text-[16px]" />
                  <span>Ajouter un Cours</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filtres Session, Classe et Semestre */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
          {/* 1. Session */}
          <div>
            <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">1. Session Académique</label>
            <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)} className={inputCls}>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label} {y.isCurrent ? "(Active)" : y.status === "CLOSED" ? "(🔒 Clôturée)" : "(Préparatoire)"}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Classe avec recherche rapide */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">2. Classe</label>
              <input
                type="text"
                placeholder="Filtrer classe..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="text-[9px] px-1.5 py-0.5 rounded border outline-none w-28 bg-surface"
              />
            </div>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className={inputCls}>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.label} ({c._count?.inscriptions || 0} élèves)</option>
              ))}
            </select>
          </div>

          {/* 3. Semestre */}
          <div>
            <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">3. Semestre Affiché</label>
            <div className="flex p-0.5 bg-surface rounded-md border border-outline-variant/30 h-9">
              <button
                type="button"
                onClick={() => setSelectedSemesterOrder(1)}
                className={`flex-1 rounded text-xs font-bold transition-all ${
                  selectedSemesterOrder === 1 ? "bg-primary text-white shadow-xs" : "text-on-surface-variant"
                }`}
              >
                Semestre 1
              </button>
              <button
                type="button"
                onClick={() => setSelectedSemesterOrder(2)}
                className={`flex-1 rounded text-xs font-bold transition-all ${
                  selectedSemesterOrder === 2 ? "bg-primary text-white shadow-xs" : "text-on-surface-variant"
                }`}
              >
                Semestre 2
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-error-container text-error text-xs rounded-md font-semibold">{error}</div>}
      {successMsg && <div className="p-3 bg-success-light text-success text-xs rounded-md font-semibold">{successMsg}</div>}

      {/* Tableau des matières de la classe */}
      <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-3">
        <div className="p-md border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-on-surface">
                {selectedClass?.label || "Classe"} — Semestre {selectedSemesterOrder} ({semesterOfferings.length} cours)
              </h3>
              {isClassClosed && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface border border-outline-variant/40 text-on-surface-variant">
                  🔒 Session Clôturée (Lecture Seule)
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Filière : {selectedClass?.filiere?.name} • Session : {selectedYear?.label}
            </p>
          </div>

          {/* Menu d'Impression des PVs */}
          <div className="flex items-center gap-2">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePrintPv(p.id)}
                className="px-3 py-1.5 rounded-md text-xs font-bold bg-surface border border-outline-variant hover:bg-surface-container text-on-surface flex items-center gap-1 shadow-xs"
              >
                <Icon name="print" className="text-[14px]" />
                <span>PV Paysage ({p.label})</span>
              </button>
            ))}
          </div>
        </div>

        {semesterOfferings.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs text-on-surface-variant">Aucune matière n'est configurée pour le Semestre {selectedSemesterOrder}.</p>
            {!isClassClosed && (
              <button
                onClick={() => {
                  setInstantiateForm({ mode: "FILIERE_TEMPLATE", scope: "SINGLE_CLASS" });
                  setShowInstantiateModal(true);
                }}
                className="px-4 py-2 bg-primary text-white font-bold text-xs rounded shadow-xs"
              >
                Instancier les matières automatiquement
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b font-bold uppercase text-on-surface-variant bg-surface">
                  <th className="px-md py-3 w-28">Code</th>
                  <th className="px-md py-3">Discipline</th>
                  <th className="px-md py-3">Catégorie / Groupe</th>
                  <th className="px-md py-3 w-28 text-center">Coefficient</th>
                  <th className="px-md py-3 w-28 text-center">Volume (h)</th>
                  <th className="px-md py-3">Formateur Assigné</th>
                  {!isClassClosed && <th className="px-md py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {semesterOfferings.map((co) => (
                  <tr key={co.id} className="hover:bg-surface-container/20">
                    <td className="px-md py-3 font-mono font-bold text-primary">{co.subject?.code || "—"}</td>
                    <td className="px-md py-3 font-bold text-on-surface">{co.subject?.name}</td>

                    {/* Catégorie contextuelle */}
                    <td className="px-md py-3">
                      {!isClassClosed ? (
                        <select
                          value={co.categoryId || ""}
                          onChange={(e) => handleUpdateField(co.id, "categoryId", e.target.value || null)}
                          className="h-8 rounded bg-surface border border-outline-variant/40 px-2 text-xs font-semibold"
                        >
                          <option value="">Général / Sans groupe</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-semibold text-on-surface">{co.category?.name || "Général"}</span>
                      )}
                    </td>

                    {/* Coef */}
                    <td className="px-md py-3 text-center">
                      {!isClassClosed ? (
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={co.coefficient}
                          onChange={(e) => handleUpdateField(co.id, "coefficient", e.target.value)}
                          className="w-16 h-7 text-center rounded border bg-surface font-mono font-bold"
                        />
                      ) : (
                        <span className="font-mono font-bold">{co.coefficient}</span>
                      )}
                    </td>

                    {/* Volume horaire */}
                    <td className="px-md py-3 text-center">
                      {!isClassClosed ? (
                        <input
                          type="number"
                          value={co.volumeHoraire || ""}
                          onChange={(e) => handleUpdateField(co.id, "volumeHoraire", e.target.value)}
                          placeholder="—"
                          className="w-16 h-7 text-center rounded border bg-surface font-mono"
                        />
                      ) : (
                        <span className="font-mono">{co.volumeHoraire ? `${co.volumeHoraire}h` : "—"}</span>
                      )}
                    </td>

                    {/* Formateur */}
                    <td className="px-md py-3">
                      {!isClassClosed ? (
                        <select
                          value={co.formateurId || ""}
                          onChange={(e) => handleUpdateField(co.id, "formateurId", e.target.value || null)}
                          className="h-8 rounded bg-surface border border-outline-variant/40 px-2 text-xs font-semibold"
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
                      <td className="px-md py-3 text-right">
                        <button
                          onClick={() => setDeleteTarget({ id: co.id, name: co.subject?.name, classe: selectedClass?.label })}
                          className="p-1 text-error hover:bg-error-container/20 rounded"
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

      {/* PORTAIL DES MODALES SANS VIDE SUPÉRIEUR */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* 1. MODALE INSTANCIATION GLOBALE INTELLIGENTE */}
          {showInstantiateModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleInstantiateSubmit}
                className="w-full max-w-lg bg-white p-md sm:p-lg rounded-md shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="bolt" className="text-primary text-[20px]" />
                    <h4 className="font-bold text-sm text-on-surface">Instanciation des Maquettes de Cours</h4>
                  </div>
                  <button type="button" onClick={() => setShowInstantiateModal(false)} className="text-on-surface-variant">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-on-surface uppercase block mb-1">1. Périmètre d'application</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setInstantiateForm({ ...instantiateForm, scope: "SINGLE_CLASS" })}
                        className={`p-2.5 rounded border text-left font-semibold transition-all ${
                          instantiateForm.scope === "SINGLE_CLASS" ? "bg-primary-light text-primary border-primary font-bold" : "bg-surface text-on-surface-variant"
                        }`}
                      >
                        <div>Classe Unique</div>
                        <div className="text-[10px] font-normal truncate">{selectedClass?.label}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setInstantiateForm({ ...instantiateForm, scope: "ALL_CENTER" })}
                        className={`p-2.5 rounded border text-left font-semibold transition-all ${
                          instantiateForm.scope === "ALL_CENTER" ? "bg-primary-light text-primary border-primary font-bold" : "bg-surface text-on-surface-variant"
                        }`}
                      >
                        <div>Tout l'Établissement</div>
                        <div className="text-[10px] font-normal">Toutes les classes de {selectedYear?.label}</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-on-surface uppercase block mb-1">2. Méthode d'instanciation</label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 p-2.5 rounded border bg-surface cursor-pointer">
                        <input
                          type="radio"
                          name="instantiateMode"
                          checked={instantiateForm.mode === "FILIERE_TEMPLATE"}
                          onChange={() => setInstantiateForm({ ...instantiateForm, mode: "FILIERE_TEMPLATE" })}
                          className="mt-0.5 accent-primary"
                        />
                        <div>
                          <div className="font-bold text-on-surface">Option A : Depuis le Cursus Filière Standard</div>
                          <div className="text-[11px] text-on-surface-variant">Injecte les matières, coefficients et volumes horaires par défaut de chaque niveau.</div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2 p-2.5 rounded border bg-surface cursor-pointer">
                        <input
                          type="radio"
                          name="instantiateMode"
                          checked={instantiateForm.mode === "PREVIOUS_SESSION"}
                          onChange={() => setInstantiateForm({ ...instantiateForm, mode: "PREVIOUS_SESSION" })}
                          className="mt-0.5 accent-primary"
                        />
                        <div>
                          <div className="font-bold text-on-surface">Option B : Reproduire la session précédente (Reconduire les Formateurs)</div>
                          <div className="text-[11px] text-on-surface-variant">Duplique la maquette de l'an dernier et réaffecte automatiquement les mêmes enseignants.</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setShowInstantiateModal(false)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" disabled={instantiating} className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">
                    {instantiating ? "Génération en cours..." : "Lancer l'instanciation"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 2. MODALE AJOUT MATIÈRE */}
          {showAddModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleAddOffering}
                className="w-full max-w-md bg-white p-md sm:p-lg rounded-md shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-bold text-sm text-on-surface">Ajouter une Matière à la Classe</h4>
                  <button type="button" onClick={() => setShowAddModal(false)} className="text-on-surface-variant">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold block mb-1">Semestre *</label>
                    <select
                      required
                      value={formPayload.gradePeriodId}
                      onChange={(e) => setFormPayload({ ...formPayload, gradePeriodId: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">Sélectionner un semestre</option>
                      {periods.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Discipline *</label>
                    <select required value={formPayload.subjectId} onChange={(e) => setFormPayload({ ...formPayload, subjectId: e.target.value })} className={inputCls}>
                      <option value="">Sélectionner une matière</option>
                      {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code || "—"})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Catégorie pour cette classe</label>
                    <select value={formPayload.categoryId} onChange={(e) => setFormPayload({ ...formPayload, categoryId: e.target.value })} className={inputCls}>
                      <option value="">Aucune catégorie (Général)</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Formateur assigné</label>
                    <select value={formPayload.formateurId} onChange={(e) => setFormPayload({ ...formPayload, formateurId: e.target.value })} className={inputCls}>
                      <option value="">Non assigné</option>
                      {formateurs.map((f) => <option key={f.id} value={f.id}>{f.lastName} {f.firstName}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold block mb-1">Coefficient</label>
                      <input type="number" step="0.5" min="0.5" value={formPayload.coefficient} onChange={(e) => setFormPayload({ ...formPayload, coefficient: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Volume Horaire (h)</label>
                      <input type="number" value={formPayload.volumeHoraire} onChange={(e) => setFormPayload({ ...formPayload, volumeHoraire: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">Ajouter</button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 3. MODALE SUPPRESSION */}
          {deleteTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-md bg-white p-md sm:p-lg shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center gap-2 text-error border-b pb-2">
                  <Icon name="warning" className="text-[20px]" />
                  <h3 className="text-sm font-bold text-on-surface">Retirer la matière</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Retirer la matière <strong>{deleteTarget.name}</strong> de la classe <strong>{deleteTarget.classe}</strong> ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button onClick={confirmDeleteOffering} className="px-3.5 py-1.5 bg-error text-white font-bold rounded text-xs shadow-xs">
                    Confirmer le retrait
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* 4. VISIONNEUSE PDF AVEC BOUTON RÉ-ÉMISSION */}
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