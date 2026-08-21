// packages/frontend/src/pages/Pedagogie.jsx
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import useAuthStore from "../store/authStore";
import Icon from "../components/Icon";

const inputCls = "h-10 rounded-md bg-surface px-3.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full";

export default function Pedagogie() {
  const { hasPermission } = useAuthStore();
  const [tab, setTab] = useState("saisie"); // "saisie" | "maquettes" | "matieres" | "formateurs" | "ponderation"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Données globales
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [formateurs, setFormateurs] = useState([]);
  const [gradingPolicies, setGradingPolicies] = useState([]);

  // État de la Grille de Saisie
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classOfferings, setClassOfferings] = useState([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [gridData, setGridData] = useState(null);
  const [inputGrades, setInputGrades] = useState({});
  const [savingGrades, setSavingGrades] = useState(false);

  // Modales
  const [modalType, setModalType] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [formPayload, setFormPayload] = useState({});
  const [savingModal, setSavingModal] = useState(false);

  async function loadInitialData() {
    setLoading(true);
    setError(null);
    try {
      const [clsData, subData, formData, polData] = await Promise.all([
        apiFetch("/classes"),
        apiFetch("/subjects"),
        apiFetch("/formateurs"),
        apiFetch("/grading-policies").catch(() => []),
      ]);
      setClasses(clsData || []);
      setSubjects(subData || []);
      setFormateurs(formData || []);
      setGradingPolicies(polData || []);

      if (clsData?.length > 0 && !selectedClassId) {
        setSelectedClassId(clsData[0].id);
      }
    } catch (err) {
      setError(err.message || "Erreur de chargement des données pédagogiques.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadInitialData(); }, []);

  // Charge les matières de la classe sélectionnée
  useEffect(() => {
    if (!selectedClassId) return;
    apiFetch(`/classes/${selectedClassId}/offerings`)
      .then((data) => {
        setClassOfferings(data || []);
        if (data?.length > 0) {
          setSelectedOfferingId(data[0].id);
        } else {
          setSelectedOfferingId("");
          setGridData(null);
        }
      })
      .catch(() => setClassOfferings([]));
  }, [selectedClassId]);

  // Charge la grille de notes pour la matière active
  useEffect(() => {
    if (!selectedOfferingId) {
      setGridData(null);
      return;
    }
    apiFetch(`/grades/grid?offeringId=${selectedOfferingId}`)
      .then((data) => {
        setGridData(data);
        // Pré-remplit les inputs
        const initialInputs = {};
        data.students?.forEach((st) => {
          const stGrades = data.grades?.filter((g) => g.studentId === st.id) || [];
          const cc1 = stGrades.find((g) => g.label === "CC1")?.value;
          const cc2 = stGrades.find((g) => g.label === "CC2")?.value;
          const norm = stGrades.find((g) => g.evaluationType === "NORMALE")?.value;
          const ratt = stGrades.find((g) => g.evaluationType === "RATTRAPAGE")?.value;

          initialInputs[st.id] = {
            cc1: cc1 !== undefined ? cc1 : "",
            cc2: cc2 !== undefined ? cc2 : "",
            normale: norm !== undefined ? norm : "",
            rattrapage: ratt !== undefined ? ratt : "",
          };
        });
        setInputGrades(initialInputs);
      })
      .catch((err) => setError(err.message));
  }, [selectedOfferingId]);

  function handleGradeChange(studentId, field, val) {
    setInputGrades((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: val },
    }));
  }

  // Calcul instantané de prévisualisation dans la grille
  function computeRowPreview(studentId) {
    const row = inputGrades[studentId] || {};
    const cc1 = parseFloat(row.cc1);
    const cc2 = parseFloat(row.cc2);
    const ccs = [cc1, cc2].filter((v) => !isNaN(v));
    const ccAvg = ccs.length > 0 ? ccs.reduce((a, b) => a + b, 0) / ccs.length : null;

    let exam = parseFloat(row.normale);
    const ratt = parseFloat(row.rattrapage);
    if (!isNaN(ratt) && (!isNaN(exam) ? ratt > exam : true)) {
      exam = ratt;
    }

    const ccW = gridData?.gradingPolicy?.ccWeight || 0.30;
    const normW = gridData?.gradingPolicy?.normalWeight || 0.70;

    let finalGrade = null;
    if (ccAvg !== null && !isNaN(exam)) {
      finalGrade = (ccAvg * ccW) + (exam * normW);
    } else if (!isNaN(exam)) {
      finalGrade = exam;
    } else if (ccAvg !== null) {
      finalGrade = ccAvg;
    }

    return {
      ccAvg: ccAvg !== null ? ccAvg.toFixed(2) : "—",
      finalGrade: finalGrade !== null ? finalGrade.toFixed(2) : "—",
      isValid: finalGrade !== null && finalGrade >= 10.0,
    };
  }

  async function handleSaveGradesGrid() {
    setSavingGrades(true);
    setError(null);
    try {
      const payload = Object.entries(inputGrades).map(([studentId, vals]) => ({
        studentId,
        cc1: vals.cc1 !== "" ? parseFloat(vals.cc1) : null,
        cc2: vals.cc2 !== "" ? parseFloat(vals.cc2) : null,
        normale: vals.normale !== "" ? parseFloat(vals.normale) : null,
        rattrapage: vals.rattrapage !== "" ? parseFloat(vals.rattrapage) : null,
      }));

      await apiFetch("/grades/batch", {
        method: "POST",
        body: JSON.stringify({ offeringId: selectedOfferingId, gradesList: payload }),
      });

      setSuccessMsg("Notes enregistrées et moyennes calculées avec succès.");
      setTimeout(() => setSuccessMsg(""), 3000);
      // Recharge la grille
      const refreshed = await apiFetch(`/grades/grid?offeringId=${selectedOfferingId}`);
      setGridData(refreshed);
    } catch (err) {
      setError(err.message || "Erreur d'enregistrement des notes.");
    } finally {
      setSavingGrades(false);
    }
  }

  async function handleToggleLock() {
    const currentLocked = gridData?.results?.some((r) => r.isLocked);
    try {
      await apiFetch("/grades/lock", {
        method: "POST",
        body: JSON.stringify({ offeringId: selectedOfferingId, lock: !currentLocked }),
      });
      setSuccessMsg(currentLocked ? "Notes déverrouillées." : "Notes verrouillées officiellement.");
      setTimeout(() => setSuccessMsg(""), 3000);
      const refreshed = await apiFetch(`/grades/grid?offeringId=${selectedOfferingId}`);
      setGridData(refreshed);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSyncClassTemplate() {
    try {
      const res = await apiFetch(`/classes/${selectedClassId}/sync-template`, { method: "POST" });
      setSuccessMsg(res.message);
      setTimeout(() => setSuccessMsg(""), 4000);
      const offerings = await apiFetch(`/classes/${selectedClassId}/offerings`);
      setClassOfferings(offerings || []);
      if (offerings?.length > 0) setSelectedOfferingId(offerings[0].id);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="text-sm text-on-surface-variant font-medium">Chargement du module pédagogique...</p>;

  const isGridLocked = gridData?.results?.some((r) => r.isLocked);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-md max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-on-surface">Gestion Pédagogique &amp; Évaluations (V3)</h1>
            <span className="rounded-md bg-primary-light text-primary font-bold text-[11px] px-2 py-0.5">
              Pondération active : {((gridData?.gradingPolicy?.ccWeight || 0.30) * 100).toFixed(0)}% CC / {((gridData?.gradingPolicy?.normalWeight || 0.70) * 100).toFixed(0)}% Examen
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Matières, maquettes semestrielles, formateurs, bordereaux de saisie matricielle et clôture des notes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tab === "saisie" && gridData && (
            <button
              onClick={handleSaveGradesGrid}
              disabled={savingGrades || isGridLocked}
              className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Icon name="save" className="text-[16px]" />
              <span>{savingGrades ? "Calcul en cours..." : "Enregistrer les Notes"}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-error-container p-md text-sm text-error border border-error/20 flex items-center justify-between">
          <p className="text-xs font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-bold underline">Fermer</button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-md bg-success-light p-md text-sm text-success border border-success/20 flex items-center justify-between">
          <p className="text-xs font-semibold">{successMsg}</p>
          <button onClick={() => setSuccessMsg("")} className="text-xs font-bold underline">Fermer</button>
        </div>
      )}

      {/* Onglets Pédagogiques V3 */}
      <div className="flex gap-1.5 p-1 bg-surface-container-lowest rounded-md border border-outline-variant/30 shadow-xs overflow-x-auto">
        <button
          onClick={() => setTab("saisie")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "saisie" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="edit_note" className="text-[16px]" />
          <span>Bordereau de Saisie Rapide (Notes)</span>
        </button>

        <button
          onClick={() => setTab("maquettes")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "maquettes" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="auto_stories" className="text-[16px]" />
          <span>Maquettes de Classes &amp; Cours</span>
        </button>

        <button
          onClick={() => setTab("matieres")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "matieres" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="category" className="text-[16px]" />
          <span>Référentiel Matières &amp; Groupes ({subjects.length})</span>
        </button>

        <button
          onClick={() => setTab("formateurs")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "formateurs" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="badge" className="text-[16px]" />
          <span>Formateurs &amp; Enseignants ({formateurs.length})</span>
        </button>
      </div>

      {/* =====================================================================
          VOLET 1 : GRILLE DE SAISIE MATRICIELLE RAPIDE (EXCEL-LIKE)
          ===================================================================== */}
      {tab === "saisie" && (
        <div className="space-y-md">
          {/* Sélecteurs de Classe et de Matière */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">1. Classe concernée</label>
              <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className={inputCls}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.label} ({c._count?.inscriptions || 0} élèves)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">2. Matière &amp; Semestre</label>
              <select value={selectedOfferingId} onChange={(e) => setSelectedOfferingId(e.target.value)} className={inputCls} disabled={classOfferings.length === 0}>
                {classOfferings.length === 0 ? (
                  <option value="">Aucune matière configurée pour cette classe</option>
                ) : (
                  classOfferings.map((co) => (
                    <option key={co.id} value={co.id}>
                      {co.gradePeriod?.label} — {co.subject?.name} (Coef {co.coefficient}) {co.formateur ? `• ${co.formateur.lastName}` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Tableau de saisie */}
          {!gridData ? (
            <div className="rounded-md bg-surface-container-lowest p-lg border border-outline-variant/30 text-center space-y-2">
              <p className="text-xs text-on-surface-variant">Sélectionnez une classe et une matière pour ouvrir le bordereau de saisie.</p>
              {classOfferings.length === 0 && selectedClassId && (
                <button onClick={handleSyncClassTemplate} className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-xs">
                  Instancier la maquette de filière en 1 clic
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-3">
              <div className="p-md border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <span>{gridData.offering?.subject?.name}</span>
                    <span className="text-xs font-mono font-normal text-primary">({gridData.offering?.subject?.category})</span>
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {gridData.offering?.classe?.label} • {gridData.offering?.gradePeriod?.label} • Coef {gridData.offering?.coefficient} • Formateur : {gridData.offering?.formateur?.lastName || "Non assigné"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {hasPermission("grades.validate") && (
                    <button
                      onClick={handleToggleLock}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 shadow-xs ${
                        isGridLocked ? "bg-amber-500 text-white" : "bg-surface border border-outline-variant text-on-surface"
                      }`}
                    >
                      <Icon name={isGridLocked ? "lock" : "lock_open"} className="text-[16px]" />
                      <span>{isGridLocked ? "Déverrouiller la saisie" : "Verrouiller le bordereau"}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-outline-variant/30 font-bold uppercase text-on-surface-variant bg-surface">
                      <th className="px-3 py-2.5 w-10 text-center">N°</th>
                      <th className="px-3 py-2.5 w-28">Matricule</th>
                      <th className="px-3 py-2.5">Nom &amp; Prénom</th>
                      <th className="px-3 py-2.5 w-24 text-center">CC 1 /20</th>
                      <th className="px-3 py-2.5 w-24 text-center">CC 2 /20</th>
                      <th className="px-3 py-2.5 w-24 text-center text-primary">Moy. CC</th>
                      <th className="px-3 py-2.5 w-28 text-center">Examen /20</th>
                      <th className="px-3 py-2.5 w-28 text-center">Rattrapage /20</th>
                      <th className="px-3 py-2.5 w-28 text-center bg-primary-light text-primary font-bold">Moyenne Finale</th>
                      <th className="px-3 py-2.5 w-24 text-center">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/15">
                    {gridData.students?.map((st, idx) => {
                      const rowVals = inputGrades[st.id] || { cc1: "", cc2: "", normale: "", rattrapage: "" };
                      const calc = computeRowPreview(st.id);

                      return (
                        <tr key={st.id} className="hover:bg-surface-container/20">
                          <td className="px-3 py-2 text-center font-mono text-on-surface-variant">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-bold text-primary">{st.matricule}</td>
                          <td className="px-3 py-2 font-semibold text-on-surface">{st.lastName} {st.firstName}</td>

                          {/* Saisie CC1 */}
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.25"
                              disabled={isGridLocked}
                              value={rowVals.cc1}
                              onChange={(e) => handleGradeChange(st.id, "cc1", e.target.value)}
                              placeholder="—"
                              className="w-16 h-8 text-center rounded border border-outline-variant/40 bg-surface font-mono font-bold focus:border-primary focus:bg-white outline-none"
                            />
                          </td>

                          {/* Saisie CC2 */}
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.25"
                              disabled={isGridLocked}
                              value={rowVals.cc2}
                              onChange={(e) => handleGradeChange(st.id, "cc2", e.target.value)}
                              placeholder="—"
                              className="w-16 h-8 text-center rounded border border-outline-variant/40 bg-surface font-mono font-bold focus:border-primary focus:bg-white outline-none"
                            />
                          </td>

                          {/* Moyenne CC automatique */}
                          <td className="px-3 py-2 text-center font-mono font-bold text-primary bg-surface/50">
                            {calc.ccAvg}
                          </td>

                          {/* Saisie Examen Session Normale */}
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.25"
                              disabled={isGridLocked}
                              value={rowVals.normale}
                              onChange={(e) => handleGradeChange(st.id, "normale", e.target.value)}
                              placeholder="—"
                              className="w-16 h-8 text-center rounded border border-outline-variant/40 bg-surface font-mono font-bold focus:border-primary focus:bg-white outline-none"
                            />
                          </td>

                          {/* Saisie Rattrapage */}
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.25"
                              disabled={isGridLocked}
                              value={rowVals.rattrapage}
                              onChange={(e) => handleGradeChange(st.id, "rattrapage", e.target.value)}
                              placeholder="—"
                              className="w-16 h-8 text-center rounded border border-amber-300 bg-amber-50 font-mono font-bold text-amber-900 focus:border-amber-500 outline-none"
                            />
                          </td>

                          {/* Note finale calculée */}
                          <td className="px-3 py-2 text-center font-mono font-bold bg-primary-light text-primary text-sm">
                            {calc.finalGrade}
                          </td>

                          {/* Validation du seuil */}
                          <td className="px-3 py-2 text-center">
                            {calc.finalGrade !== "—" ? (
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                calc.isValid ? "bg-success-light text-success" : "bg-error-container text-error"
                              }`}>
                                {calc.isValid ? "Validé" : "Non validé"}
                              </span>
                            ) : (
                              <span className="text-on-surface-variant/40 text-[10px]">En attente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-3 border-t border-outline-variant/15 flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-mono">
                  {gridData.students?.length || 0} apprenant(s) évalué(s) • Formule : ({((gridData.gradingPolicy?.ccWeight || 0.30) * 100).toFixed(0)}% CC + {((gridData.gradingPolicy?.normalWeight || 0.70) * 100).toFixed(0)}% Examen)
                </span>
                <button
                  onClick={handleSaveGradesGrid}
                  disabled={savingGrades || isGridLocked}
                  className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark shadow-xs disabled:opacity-50"
                >
                  {savingGrades ? "Calcul..." : "Enregistrer et Figer"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          VOLET 2 : MAQUETTES DE CLASSES & ENSEIGNANTS AFFECTÉS
          ===================================================================== */}
      {tab === "maquettes" && (
        <div className="space-y-md">
          <div className="flex justify-between items-center bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase text-on-surface-variant">Classe sélectionnée :</label>
              <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className={`${inputCls} w-72`}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <button
              onClick={handleSyncClassTemplate}
              className="rounded-md bg-primary-light border border-primary/20 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all shadow-xs flex items-center gap-1.5"
            >
              <Icon name="sync" className="text-[16px]" />
              <span>Instancier / Synchroniser depuis la maquette filière</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <div className="p-md border-b border-outline-variant/20 flex justify-between items-center">
              <h3 className="text-sm font-bold text-on-surface">Matières enseignées cette session ({classOfferings.length})</h3>
            </div>
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-outline-variant/30 font-bold uppercase text-on-surface-variant bg-surface">
                  <th className="px-md py-3">Semestre</th>
                  <th className="px-md py-3">Matière</th>
                  <th className="px-md py-3">Groupe / Catégorie</th>
                  <th className="px-md py-3 text-center">Coefficient</th>
                  <th className="px-md py-3 text-center">Volume Horaire</th>
                  <th className="px-md py-3">Formateur Assigné</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {classOfferings.map((co) => (
                  <tr key={co.id} className="hover:bg-surface-container/20">
                    <td className="px-md py-3 font-mono font-bold text-primary">{co.gradePeriod?.label}</td>
                    <td className="px-md py-3 font-bold text-on-surface">{co.subject?.name}</td>
                    <td className="px-md py-3 text-on-surface-variant">{co.subject?.category}</td>
                    <td className="px-md py-3 font-bold text-center font-mono">{co.coefficient}</td>
                    <td className="px-md py-3 text-center font-mono">{co.volumeHoraire ? `${co.volumeHoraire}h` : "—"}</td>
                    <td className="px-md py-3">
                      <select
                        value={co.formateurId || ""}
                        onChange={async (e) => {
                          await apiFetch(`/offerings/${co.id}`, { method: "PUT", body: JSON.stringify({ formateurId: e.target.value }) });
                          const refreshed = await apiFetch(`/classes/${selectedClassId}/offerings`);
                          setClassOfferings(refreshed);
                        }}
                        className="h-8 rounded bg-surface border border-outline-variant/40 px-2 text-xs font-semibold"
                      >
                        <option value="">Non assigné</option>
                        {formateurs.map((f) => (
                          <option key={f.id} value={f.id}>{f.lastName} {f.firstName} ({f.specialite || "Enseignant"})</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          VOLET 3 : RÉFÉRENTIEL DES MATIÈRES & GROUPES
          ===================================================================== */}
      {tab === "matieres" && (
        <div className="space-y-md">
          <div className="flex justify-between items-center bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-on-surface">Catalogue Universel des Matières</h3>
              <p className="text-xs text-on-surface-variant">Classées par 1er Groupe (Spécialité), 2ème Groupe (Général), 3ème Groupe (Stage).</p>
            </div>
            <button
              onClick={() => {
                setFormPayload({ name: "", code: "", category: "1er Groupe (Matières Professionnelles)" });
                setEditingItem(null);
                setModalType("subject");
              }}
              className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark shadow-xs flex items-center gap-1"
            >
              <Icon name="add" className="text-[16px]" />
              <span>Nouvelle Matière</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-outline-variant/30 font-bold uppercase text-on-surface-variant bg-surface">
                  <th className="px-md py-3">Code</th>
                  <th className="px-md py-3">Intitulé de la Discipline</th>
                  <th className="px-md py-3">Groupe / Catégorie d'Enseignement</th>
                  <th className="px-md py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-surface-container/20">
                    <td className="px-md py-3 font-mono font-bold text-primary">{sub.code || "—"}</td>
                    <td className="px-md py-3 font-bold text-on-surface">{sub.name}</td>
                    <td className="px-md py-3">
                      <span className="px-2 py-0.5 rounded-md font-semibold bg-surface border border-outline-variant/30">
                        {sub.category}
                      </span>
                    </td>
                    <td className="px-md py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setFormPayload({ name: sub.name, code: sub.code || "", category: sub.category });
                            setEditingItem(sub);
                            setModalType("subject");
                          }}
                          className="rounded-md border border-outline-variant px-2 py-1 text-on-surface font-semibold hover:bg-surface-container"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Supprimer la matière ${sub.name} ?`)) return;
                            try {
                              await apiFetch(`/subjects/${sub.id}`, { method: "DELETE" });
                              loadInitialData();
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                          className="text-error hover:bg-error-container/20 p-1 rounded-md"
                        >
                          <Icon name="delete" className="text-[16px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          VOLET 4 : ANNUAIRE DES FORMATEURS
          ===================================================================== */}
      {tab === "formateurs" && (
        <div className="space-y-md">
          <div className="flex justify-between items-center bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-on-surface">Annuaire des Formateurs &amp; Enseignants</h3>
              <p className="text-xs text-on-surface-variant">Gestion du corps professoral et liaison aux comptes utilisateurs.</p>
            </div>
            <button
              onClick={() => {
                setFormPayload({ firstName: "", lastName: "", email: "", phone: "", specialite: "" });
                setEditingItem(null);
                setModalType("formateur");
              }}
              className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark shadow-xs flex items-center gap-1"
            >
              <Icon name="person_add" className="text-[16px]" />
              <span>Nouveau Formateur</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
            {formateurs.map((f) => (
              <div key={f.id} className="p-md rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col justify-between space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary-light text-primary font-bold flex items-center justify-center border border-primary/20">
                    {f.lastName.charAt(0)}{f.firstName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-on-surface">{f.lastName} {f.firstName}</h4>
                    <p className="text-[11px] text-primary font-semibold">{f.specialite || "Formateur"}</p>
                  </div>
                </div>
                <div className="text-xs text-on-surface-variant space-y-0.5 font-mono">
                  <p>Tél : {f.phone || "—"}</p>
                  <p>Email : {f.email || "—"}</p>
                  <p className="text-[10px] text-primary pt-1">{f._count?.offerings || 0} cours dispensé(s)</p>
                </div>
                <div className="flex justify-end gap-1 pt-2 border-t border-outline-variant/20">
                  <button
                    onClick={() => {
                      setFormPayload({ firstName: f.firstName, lastName: f.lastName, email: f.email || "", phone: f.phone || "", specialite: f.specialite || "" });
                      setEditingItem(f);
                      setModalType("formateur");
                    }}
                    className="rounded-md border border-outline-variant px-2.5 py-1 text-xs font-semibold text-on-surface"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Supprimer le formateur ${f.lastName} ?`)) return;
                      try {
                        await apiFetch(`/formateurs/${f.id}`, { method: "DELETE" });
                        loadInitialData();
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                    className="text-error p-1 rounded-md"
                  >
                    <Icon name="delete" className="text-[16px]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALES D'ÉDITION (Matière & Formateur)
          ===================================================================== */}
      {modalType && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
          <motion.form
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingModal(true);
              try {
                if (modalType === "subject") {
                  if (editingItem) {
                    await apiFetch(`/subjects/${editingItem.id}`, { method: "PUT", body: JSON.stringify(formPayload) });
                  } else {
                    await apiFetch("/subjects", { method: "POST", body: JSON.stringify(formPayload) });
                  }
                } else if (modalType === "formateur") {
                  if (editingItem) {
                    await apiFetch(`/formateurs/${editingItem.id}`, { method: "PUT", body: JSON.stringify(formPayload) });
                  } else {
                    await apiFetch("/formateurs", { method: "POST", body: JSON.stringify(formPayload) });
                  }
                }
                setModalType(null);
                loadInitialData();
              } catch (err) {
                setError(err.message);
              } finally {
                setSavingModal(false);
              }
            }}
            className="w-full max-w-md rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md"
          >
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-bold text-on-surface">
                {editingItem ? "Modifier" : "Ajouter"} {modalType === "subject" ? "une Matière" : "un Formateur"}
              </h3>
              <button type="button" onClick={() => setModalType(null)}><Icon name="close" className="text-[18px]" /></button>
            </div>

            {modalType === "subject" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase block mb-1">Intitulé de la matière *</label>
                  <input required placeholder="Ex: Thermodynamique appliquée" value={formPayload.name} onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase block mb-1">Code Matière (optionnel)</label>
                  <input placeholder="Ex: THM101" value={formPayload.code} onChange={(e) => setFormPayload({ ...formPayload, code: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase block mb-1">Groupe / Catégorie d'enseignement *</label>
                  <select value={formPayload.category} onChange={(e) => setFormPayload({ ...formPayload, category: e.target.value })} className={inputCls}>
                    <option value="1er Groupe (Matières Professionnelles)">1er Groupe (Matières Professionnelles &amp; Spécialité)</option>
                    <option value="2ème Groupe (Enseignement Général)">2ème Groupe (Enseignement Général &amp; Transversal)</option>
                    <option value="3ème Groupe (Pratique &amp; Stage)">3ème Groupe (Pratique en Atelier &amp; Stage)</option>
                  </select>
                </div>
              </div>
            )}

            {modalType === "formateur" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold uppercase block mb-1">Nom *</label>
                    <input required placeholder="Nom" value={formPayload.lastName} onChange={(e) => setFormPayload({ ...formPayload, lastName: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase block mb-1">Prénom *</label>
                    <input required placeholder="Prénom" value={formPayload.firstName} onChange={(e) => setFormPayload({ ...formPayload, firstName: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase block mb-1">Spécialité / Discipline</label>
                  <input placeholder="Ex: Génie Mécanique / Froid" value={formPayload.specialite} onChange={(e) => setFormPayload({ ...formPayload, specialite: e.target.value })} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold uppercase block mb-1">Téléphone</label>
                    <input placeholder="Ex: 670000000" value={formPayload.phone} onChange={(e) => setFormPayload({ ...formPayload, phone: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase block mb-1">Email</label>
                    <input type="email" placeholder="prof@centre.cm" value={formPayload.email} onChange={(e) => setFormPayload({ ...formPayload, email: e.target.value })} className={inputCls} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setModalType(null)} className="rounded-md px-3 py-1.5 text-xs font-semibold border">Annuler</button>
              <button type="submit" disabled={savingModal} className="rounded-md bg-primary px-4 py-1.5 text-xs font-bold text-white shadow-xs">
                {savingModal ? "Enregistrement..." : "Valider"}
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </motion.div>
  );
}