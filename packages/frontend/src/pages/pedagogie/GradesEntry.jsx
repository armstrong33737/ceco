// packages/frontend/src/pages/pedagogie/GradesEntry.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import useAuthStore from "../../store/authStore";
import Icon from "../../components/Icon";
import PdfViewerModal from "../../components/PdfViewerModal";

export default function GradesEntry() {
  const { user, hasPermission } = useAuthStore();
  const isTeacher = user?.role?.name?.toLowerCase() === "formateur";

  // Entonnoir séquentiel en 4 étapes
  const [years, setYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [classes, setClasses] = useState([]);
  const [classSearch, setClassSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSemesterOrder, setSelectedSemesterOrder] = useState(1);
  const [offerings, setOfferings] = useState([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState("");

  // Données de la grille matricielle
  const [gridData, setGridData] = useState(null);
  const [inputGrades, setInputGrades] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Modales
  const [absenceModal, setAbsenceModal] = useState(null);
  const [confirmLockModal, setConfirmLockModal] = useState(false);
  const [pdfModal, setPdfModal] = useState(null);

  // 1. Chargement des Sessions
  useEffect(() => {
    apiFetch("/academic-years")
      .then((yrs) => {
        setYears(yrs || []);
        const active = yrs?.find((y) => y.isCurrent) || yrs?.[0];
        if (active) setSelectedYearId(active.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  // 2. Chargement des Classes
  useEffect(() => {
    if (!selectedYearId) return;
    apiFetch("/classes")
      .then((clsList) => {
        const filtered = (clsList || []).filter((c) => c.academicYearId === selectedYearId);
        setClasses(filtered);
        if (filtered.length > 0) {
          setSelectedClassId(filtered[0].id);
        } else {
          setSelectedClassId("");
          setOfferings([]);
          setSelectedOfferingId("");
          setGridData(null);
        }
      })
      .catch((e) => setError(e.message));
  }, [selectedYearId]);

  const filteredClasses = useMemo(() => {
    if (!classSearch.trim()) return classes;
    return classes.filter((c) => c.label.toLowerCase().includes(classSearch.toLowerCase()));
  }, [classes, classSearch]);

  // 3. Chargement des Matières
  useEffect(() => {
    if (!selectedClassId) return;
    apiFetch(`/classes/${selectedClassId}/offerings`)
      .then((data) => {
        const offs = Array.isArray(data) ? data : data.offerings || [];
        setOfferings(offs);
      })
      .catch(() => setOfferings([]));
  }, [selectedClassId]);

  const semesterOfferings = useMemo(() => {
    return offerings.filter((o) => o.gradePeriod?.order === selectedSemesterOrder);
  }, [offerings, selectedSemesterOrder]);

  useEffect(() => {
    if (semesterOfferings.length > 0) {
      setSelectedOfferingId(semesterOfferings[0].id);
    } else {
      setSelectedOfferingId("");
      setGridData(null);
    }
  }, [semesterOfferings]);

  // 4. Chargement de la Grille Matricielle
  useEffect(() => {
    if (!selectedOfferingId) {
      setGridData(null);
      return;
    }
    setError(null);
    apiFetch(`/grades/grid?offeringId=${selectedOfferingId}`)
      .then((data) => {
        setGridData(data);
        const map = {};
        data.students?.forEach((st) => {
          const stGrades = data.grades?.filter((g) => g.studentId === st.id) || [];
          const gCc1 = stGrades.find((g) => g.label === "CC1");
          const gNorm = stGrades.find((g) => g.evaluationType === "NORMALE");
          const gRatt = stGrades.find((g) => g.evaluationType === "RATTRAPAGE");

          map[st.id] = {
            cc1: gCc1 ? (gCc1.isAbsent ? "" : String(gCc1.value)) : "",
            cc1Absent: gCc1?.isAbsent || false,
            cc1AbsenceReason: gCc1?.absenceReason || "UNJUSTIFIED",
            normale: gNorm ? (gNorm.isAbsent ? "" : String(gNorm.value)) : "",
            normaleAbsent: gNorm?.isAbsent || false,
            normaleAbsenceReason: gNorm?.absenceReason || "UNJUSTIFIED",
            rattrapage: gRatt ? String(gRatt.value) : "",
            rattrapageAbsent: false,
          };
        });
        setInputGrades(map);
      })
      .catch((err) => {
        setError(err.message);
        setGridData(null);
      });
  }, [selectedOfferingId]);

  function handleGradeValueChange(studentId, field, rawVal) {
    if (rawVal === "" || rawVal === undefined || rawVal === null) {
      setInputGrades((prev) => ({
        ...prev,
        [studentId]: { ...prev[studentId], [field]: "" },
      }));
      return;
    }

    let num = parseFloat(rawVal);
    if (isNaN(num)) return;
    if (num > 20) num = 20;
    if (num < 0) num = 0;

    setInputGrades((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: String(num) },
    }));
  }

  // Navigation Clavier Fluide Type Tableur
  function handleKeyDown(e, stIdx, colIdx) {
    const totalStudents = gridData?.students?.length || 0;
    const totalCols = 3; // col 0: CC, col 1: Normale, col 2: Rattrapage

    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (stIdx + 1 < totalStudents) {
        document.getElementById(`grade-input-${stIdx + 1}-${colIdx}`)?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (stIdx - 1 >= 0) {
        document.getElementById(`grade-input-${stIdx - 1}-${colIdx}`)?.focus();
      }
    } else if (e.key === "ArrowRight") {
      if (e.target.selectionStart === e.target.value.length && colIdx + 1 < totalCols) {
        document.getElementById(`grade-input-${stIdx}-${colIdx + 1}`)?.focus();
      }
    } else if (e.key === "ArrowLeft") {
      if (e.target.selectionStart === 0 && colIdx - 1 >= 0) {
        document.getElementById(`grade-input-${stIdx}-${colIdx - 1}`)?.focus();
      }
    }
  }

  function handleOpenAbsenceModal(studentId, field) {
    const row = inputGrades[studentId] || {};
    const isCurrentlyAbsent = row[`${field}Absent`];
    const currentReason = row[`${field}AbsenceReason`] || "UNJUSTIFIED";

    if (isCurrentlyAbsent) {
      setInputGrades((prev) => ({
        ...prev,
        [studentId]: { ...prev[studentId], [`${field}Absent`]: false },
      }));
    } else {
      setAbsenceModal({ studentId, field, currentReason });
    }
  }

  function handleConfirmAbsence(reason) {
    if (!absenceModal) return;
    const { studentId, field } = absenceModal;
    setInputGrades((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: "",
        [`${field}Absent`]: true,
        [`${field}AbsenceReason`]: reason,
      },
    }));
    setAbsenceModal(null);
  }

  // Calcul mathématique instantané
  function computePreview(stId) {
    const row = inputGrades[stId] || {};
    let ccVal = null;
    if (row.cc1Absent && row.cc1AbsenceReason === "UNJUSTIFIED") ccVal = 0;
    else if (!row.cc1Absent && row.cc1 !== "" && !isNaN(row.cc1)) ccVal = parseFloat(row.cc1);

    let exam = null;
    if (row.normaleAbsent && row.normaleAbsenceReason === "UNJUSTIFIED") exam = 0;
    else if (!row.normaleAbsent && row.normale !== "" && !isNaN(row.normale)) exam = parseFloat(row.normale);

    if (!row.rattrapageAbsent && row.rattrapage !== "" && !isNaN(row.rattrapage)) {
      const r = parseFloat(row.rattrapage);
      if (exam === null || r > exam) exam = r;
    }

    const ccW = gridData?.gradingPolicy?.ccWeight || 0.30;
    const normW = gridData?.gradingPolicy?.normalWeight || 0.70;

    let final = null;
    if (ccVal !== null && exam !== null) final = (ccVal * ccW) + (exam * normW);
    else if (exam !== null) final = exam;
    else if (ccVal !== null) final = ccVal;

    return {
      ccVal: ccVal !== null ? ccVal.toFixed(2) : "—",
      final: final !== null ? final.toFixed(2) : "—",
      passed: final !== null && final >= 10.0,
    };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = Object.entries(inputGrades).map(([studentId, vals]) => ({
        studentId,
        cc1: vals.cc1 !== "" ? parseFloat(vals.cc1) : null,
        cc1Absent: vals.cc1Absent,
        cc1AbsenceReason: vals.cc1AbsenceReason,
        normale: vals.normale !== "" ? parseFloat(vals.normale) : null,
        normaleAbsent: vals.normaleAbsent,
        normaleAbsenceReason: vals.normaleAbsenceReason,
        rattrapage: vals.rattrapage !== "" ? parseFloat(vals.rattrapage) : null,
        rattrapageAbsent: false,
      }));

      await apiFetch("/grades/batch", {
        method: "POST",
        body: JSON.stringify({ offeringId: selectedOfferingId, gradesList: payload }),
      });

      setSuccessMsg("Notes enregistrées et moyennes de matière calculées avec succès.");
      setTimeout(() => setSuccessMsg(""), 3000);
      const res = await apiFetch(`/grades/grid?offeringId=${selectedOfferingId}`);
      setGridData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleLock() {
    try {
      const isCurrentlyLocked = gridData?.isLocked;
      const endpoint = isCurrentlyLocked ? "/grades/unlock" : "/grades/lock";
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ offeringId: selectedOfferingId, lock: !isCurrentlyLocked }),
      });
      setConfirmLockModal(false);
      setSuccessMsg(isCurrentlyLocked ? "Bordereau déverrouillé." : "Bordereau verrouillé.");
      setTimeout(() => setSuccessMsg(""), 3000);
      const res = await apiFetch(`/grades/grid?offeringId=${selectedOfferingId}`);
      setGridData(res);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePrintBlankSheet(forceRegenerate = false) {
    try {
      const res = await apiFetch(`/grades/offerings/${selectedOfferingId}/blank-sheet`, {
        method: "POST",
        body: JSON.stringify({ forceRegenerate }),
      });
      const token = getToken();
      setPdfModal({
        title: `Bordereau Vierge — ${gridData.offering?.subject?.name}`,
        previewUrl: `${API_BASE}${res.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.downloadUrl}?token=${token}`,
        type: "blank",
        reused: res.reused,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePrintCertifiedSheet(forceRegenerate = false) {
    try {
      const res = await apiFetch(`/grades/offerings/${selectedOfferingId}/certified-sheet`, {
        method: "POST",
        body: JSON.stringify({ forceRegenerate }),
      });
      const token = getToken();
      setPdfModal({
        title: `Procès-Verbal Officiel de Matière — ${gridData.offering?.subject?.name}`,
        previewUrl: `${API_BASE}${res.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.downloadUrl}?token=${token}`,
        type: "certified",
        reused: res.reused,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  const isLocked = gridData?.isLocked;

  return (
    <div className="space-y-4">
      {/* 1. Entonnoir Séquentiel de Sélection */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-card space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Sélection Pédagogique Séquentielle
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-center">
          {/* 1. Session */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">1. Session</label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              disabled={isTeacher}
              className="input-field w-full"
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.label} {y.isCurrent ? "(Active)" : "(Clôturée)"}</option>
              ))}
            </select>
          </div>

          {/* 2. Classe */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-600">2. Classe</label>
              <input
                type="text"
                placeholder="Filtrer..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="text-[9px] px-1.5 py-0.5 rounded border border-slate-300 outline-none w-24 bg-slate-50 focus:bg-white"
              />
            </div>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="input-field w-full"
              disabled={classes.length === 0}
            >
              {filteredClasses.length === 0 ? (
                <option value="">Aucune classe trouvée</option>
              ) : (
                filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.label} ({c._count?.inscriptions || 0} élèves)</option>
                ))
              )}
            </select>
          </div>

          {/* 3. Semestre */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">3. Semestre</label>
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

          {/* 4. Matière */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">4. Matière</label>
            <select
              value={selectedOfferingId}
              onChange={(e) => setSelectedOfferingId(e.target.value)}
              className="input-field w-full"
              disabled={semesterOfferings.length === 0}
            >
              {semesterOfferings.length === 0 ? (
                <option value="">Aucune matière configurée</option>
              ) : (
                semesterOfferings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.subject?.code || "—"} • {o.subject?.name} (Coef {o.coefficient})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-semibold">{error}</div>}
      {successMsg && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-semibold">{successMsg}</div>}

      {/* 2. Grille Matricielle de Saisie */}
      {!gridData ? (
        <div className="table-container p-8 text-center space-y-2">
          <p className="text-xs text-slate-500">
            {semesterOfferings.length === 0
              ? "Aucune matière n'est configurée pour cette classe dans ce semestre."
              : "Sélectionnez une matière pour ouvrir le bordereau de saisie."}
          </p>
        </div>
      ) : (
        <div className="table-container space-y-3">
          <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50">
            <div>
              <div className="flex items-center gap-2">
                <span className="badge-blue font-mono font-bold">
                  {gridData.offering?.subject?.code || "—"}
                </span>
                <h3 className="text-sm font-bold text-slate-900">{gridData.offering?.subject?.name}</h3>
                <span className="text-xs text-slate-500 font-medium">({gridData.offering?.category?.name || "Général"})</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {gridData.offering?.classe?.label} • Coef {gridData.offering?.coefficient} • Formateur : {gridData.offering?.formateur ? `${gridData.offering.formateur.firstName} ${gridData.offering.formateur.lastName}` : "Non assigné"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePrintBlankSheet(false)}
                className="btn-secondary text-[11px]"
                title="Imprimer un bordereau pour saisie manuscrite"
              >
                <Icon name="print" className="text-[16px]" />
                <span>Bordereau Vierge</span>
              </button>

              {hasPermission("grades.validate") && (
                <button
                  onClick={() => handlePrintCertifiedSheet(false)}
                  className="btn-secondary text-[11px] text-blue-700 border-blue-300 hover:bg-blue-50"
                  title="Générer le PV officiel certifié"
                >
                  <Icon name="verified" className="text-[16px]" />
                  <span>PV Certifié</span>
                </button>
              )}

              {hasPermission("grades.validate") && (
                <button
                  onClick={() => setConfirmLockModal(true)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 shadow-xs ${
                    isLocked ? "bg-amber-600 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon name={isLocked ? "lock" : "lock_open"} className="text-[16px]" />
                  <span>{isLocked ? "Déverrouiller" : "Verrouiller"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell w-10 text-center">N°</th>
                  <th className="table-header-cell w-28">Matricule</th>
                  <th className="table-header-cell">Apprenant</th>
                  <th className="table-header-cell w-36 text-center">Note CC /20</th>
                  <th className="table-header-cell w-36 text-center">Examen /20</th>
                  <th className="table-header-cell w-32 text-center">Rattrapage /20</th>
                  <th className="table-header-cell w-28 text-center bg-blue-50 text-blue-700 font-bold">Note Finale</th>
                  <th className="table-header-cell w-24 text-center">Validation</th>
                </tr>
              </thead>
              <tbody>
                {gridData.students?.map((st, idx) => {
                  const row = inputGrades[st.id] || {};
                  const calc = computePreview(st.id);

                  return (
                    <tr key={st.id} className="table-body-row">
                      <td className="table-body-cell text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="table-body-cell font-mono font-bold text-blue-700">{st.matricule}</td>
                      <td className="table-body-cell font-semibold text-slate-900">{st.lastName} {st.firstName}</td>

                      {/* Note CC Unique */}
                      <td className="table-body-cell text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            id={`grade-input-${idx}-0`}
                            type="number" min="0" max="20" step="0.25"
                            disabled={isLocked || row.cc1Absent}
                            value={row.cc1}
                            onChange={(e) => handleGradeValueChange(st.id, "cc1", e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                            placeholder="—"
                            className="w-16 h-8 text-center rounded border border-slate-300 bg-white font-mono font-bold focus:border-blue-700 outline-none"
                          />
                          <button
                            type="button" disabled={isLocked}
                            onClick={() => handleOpenAbsenceModal(st.id, "cc1")}
                            className={`text-[9px] px-1.5 py-1 rounded font-bold transition-all ${
                              row.cc1Absent
                                ? (row.cc1AbsenceReason === "JUSTIFIED" ? "bg-amber-400 text-amber-950 font-bold" : "bg-rose-600 text-white font-bold")
                                : "bg-white border border-slate-300 text-slate-500 hover:bg-slate-100"
                            }`}
                            title={row.cc1Absent ? `Absent (${row.cc1AbsenceReason === "JUSTIFIED" ? "Justifiée" : "0.00"})` : "Marquer absent"}
                          >
                            ABS
                          </button>
                        </div>
                      </td>

                      {/* Examen Session Normale */}
                      <td className="table-body-cell text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            id={`grade-input-${idx}-1`}
                            type="number" min="0" max="20" step="0.25"
                            disabled={isLocked || row.normaleAbsent}
                            value={row.normale}
                            onChange={(e) => handleGradeValueChange(st.id, "normale", e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                            placeholder="—"
                            className="w-16 h-8 text-center rounded border border-slate-300 bg-white font-mono font-bold focus:border-blue-700 outline-none"
                          />
                          <button
                            type="button" disabled={isLocked}
                            onClick={() => handleOpenAbsenceModal(st.id, "normale")}
                            className={`text-[9px] px-1.5 py-1 rounded font-bold transition-all ${
                              row.normaleAbsent
                                ? (row.normaleAbsenceReason === "JUSTIFIED" ? "bg-amber-400 text-amber-950 font-bold" : "bg-rose-600 text-white font-bold")
                                : "bg-white border border-slate-300 text-slate-500 hover:bg-slate-100"
                            }`}
                            title={row.normaleAbsent ? `Absent (${row.normaleAbsenceReason === "JUSTIFIED" ? "Justifiée" : "0.00"})` : "Marquer absent"}
                          >
                            ABS
                          </button>
                        </div>
                      </td>

                      {/* Rattrapage */}
                      <td className="table-body-cell text-center">
                        <input
                          id={`grade-input-${idx}-2`}
                          type="number" min="0" max="20" step="0.25" disabled={isLocked}
                          value={row.rattrapage}
                          onChange={(e) => handleGradeValueChange(st.id, "rattrapage", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 2)}
                          placeholder="—"
                          className="w-16 h-8 text-center rounded border border-amber-300 bg-amber-50 font-mono font-bold text-amber-950 focus:border-amber-500 outline-none"
                        />
                      </td>

                      {/* Note Finale */}
                      <td className="table-body-cell text-center font-mono font-bold bg-blue-50 text-blue-700 text-sm">
                        {calc.final}
                      </td>

                      {/* Validation */}
                      <td className="table-body-cell text-center">
                        {calc.final !== "—" ? (
                          <span className={calc.passed ? "badge-emerald" : "badge-rose"}>
                            {calc.passed ? "Validé" : "Échec"}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">En attente</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pied du Bordereau avec Formule de Pondération */}
          <div className="p-3 border-t border-slate-200 flex justify-between items-center text-xs bg-slate-50">
            <span className="text-slate-500 font-mono">
              Pondération active : {((gridData.gradingPolicy?.ccWeight || 0.30) * 100).toFixed(0)}% CC + {((gridData.gradingPolicy?.normalWeight || 0.70) * 100).toFixed(0)}% Examen
            </span>
            <button
              onClick={handleSave} disabled={saving || isLocked}
              className="btn-primary"
            >
              {saving ? "Enregistrement..." : "Enregistrer les Notes"}
            </button>
          </div>
        </div>
      )}

      {/* 3. PORTAIL DES MODALES */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* MODALE ABSENCE */}
          {absenceModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-bold text-slate-900">Motif d'Absence à l'Évaluation</h3>
                  <button onClick={() => setAbsenceModal(null)} className="text-slate-400 hover:text-slate-700"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => handleConfirmAbsence("JUSTIFIED")}
                    className="w-full p-2.5 text-left rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors font-bold text-amber-950 flex items-center gap-2"
                  >
                    <Icon name="verified" className="text-[18px] text-amber-600" />
                    <div>
                      <div>Absence Justifiée (Certificat médical)</div>
                      <div className="text-[10px] font-normal text-amber-800">Non pénalisée dans le calcul</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleConfirmAbsence("UNJUSTIFIED")}
                    className="w-full p-2.5 text-left rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 transition-colors font-bold text-rose-800 flex items-center gap-2"
                  >
                    <Icon name="cancel" className="text-[18px] text-rose-600" />
                    <div>
                      <div>Absence Injustifiée (Non excusée)</div>
                      <div className="text-[10px] font-normal text-rose-700">Comptabilisée comme 0.00 / 20</div>
                    </div>
                  </button>
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-200">
                  <button onClick={() => setAbsenceModal(null)} className="btn-secondary">Annuler</button>
                </div>
              </motion.div>
            </div>
          )}

          {/* MODALE VERROUILLAGE */}
          {confirmLockModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center gap-2 text-blue-700 border-b border-slate-200 pb-2">
                  <Icon name={isLocked ? "lock_open" : "lock"} className="text-[20px]" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {isLocked ? "Déverrouiller le bordereau" : "Verrouiller officiellement le bordereau"}
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isLocked
                    ? "Déverrouiller ce bordereau autorisera de nouvelles modifications. Cette action sera consignée dans le journal d'audit."
                    : "Le verrouillage scelle les notes de cette matière. Les enseignants ne pourront plus les modifier sans autorisation."}
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setConfirmLockModal(false)} className="btn-secondary">Annuler</button>
                  <button
                    onClick={handleToggleLock}
                    className={`btn-primary ${isLocked ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                  >
                    {isLocked ? "Confirmer le déverrouillage" : "Confirmer le verrouillage"}
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
            onForceRegenerate={() => {
              if (pdfModal?.type === "blank") handlePrintBlankSheet(true);
              else handlePrintCertifiedSheet(true);
            }}
            onClose={() => setPdfModal(null)}
          />
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}