// packages/frontend/src/pages/pedagogie/GradesEntry.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import useAuthStore from "../../store/authStore";
import Icon from "../../components/Icon";
import PdfViewerModal from "../../components/PdfViewerModal";

const selectCls = "h-9 rounded-md bg-surface px-2.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary w-full";

export default function GradesEntry() {
  const { user, hasPermission } = useAuthStore();
  const isTeacher = user?.role?.name?.toLowerCase() === "formateur";

  // Entonnoir séquentiel en 4 étapes
  const [years, setYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [classes, setClasses] = useState([]);
  const [classSearch, setClassSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSemesterOrder, setSelectedSemesterOrder] = useState(1); // 1 ou 2
  const [offerings, setOfferings] = useState([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState("");

  // Données de la grille
  const [gridData, setGridData] = useState(null);
  const [inputGrades, setInputGrades] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Modales
  const [absenceModal, setAbsenceModal] = useState(null); // { studentId, field, currentReason }
  const [confirmLockModal, setConfirmLockModal] = useState(false);
  const [pdfModal, setPdfModal] = useState(null);

  // 1. Chargement des Sessions (Formateur limité à la session active)
  useEffect(() => {
    apiFetch("/academic-years")
      .then((yrs) => {
        setYears(yrs || []);
        const active = yrs?.find((y) => y.isCurrent) || yrs?.[0];
        if (active) setSelectedYearId(active.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  // 2. Chargement des Classes de la session
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

  // 3. Chargement des Matières de la classe
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

  // 4. Chargement de la Grille Matricielle du cours
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
          const gCc2 = stGrades.find((g) => g.label === "CC2");
          const gNorm = stGrades.find((g) => g.evaluationType === "NORMALE");
          const gRatt = stGrades.find((g) => g.evaluationType === "RATTRAPAGE");

          map[st.id] = {
            cc1: gCc1 ? (gCc1.isAbsent ? "" : String(gCc1.value)) : "",
            cc1Absent: gCc1?.isAbsent || false,
            cc1AbsenceReason: gCc1?.absenceReason || "UNJUSTIFIED",
            cc2: gCc2 ? (gCc2.isAbsent ? "" : String(gCc2.value)) : "",
            cc2Absent: gCc2?.isAbsent || false,
            cc2AbsenceReason: gCc2?.absenceReason || "UNJUSTIFIED",
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

  // CLAMPING STRICT DES NOTES ENTRE 0.00 ET 20.00 EN TEMPS RÉEL
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

  // NAVIGATION CLAVIER FLUIDE STYLE EXCEL (Flèches, Entrée, Tab)
  function handleKeyDown(e, stIdx, colIdx) {
    const totalStudents = gridData?.students?.length || 0;
    const totalCols = 4; // col 0: CC1, col 1: CC2, col 2: Normale, col 3: Rattrapage

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
    const validCcs = [];

    if (row.cc1Absent && row.cc1AbsenceReason === "UNJUSTIFIED") validCcs.push(0);
    else if (!row.cc1Absent && row.cc1 !== "" && !isNaN(row.cc1)) validCcs.push(parseFloat(row.cc1));

    if (row.cc2Absent && row.cc2AbsenceReason === "UNJUSTIFIED") validCcs.push(0);
    else if (!row.cc2Absent && row.cc2 !== "" && !isNaN(row.cc2)) validCcs.push(parseFloat(row.cc2));

    const ccAvg = validCcs.length > 0 ? validCcs.reduce((a, b) => a + b, 0) / validCcs.length : null;

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
    if (ccAvg !== null && exam !== null) final = (ccAvg * ccW) + (exam * normW);
    else if (exam !== null) final = exam;
    else if (ccAvg !== null) final = ccAvg;

    return {
      ccAvg: ccAvg !== null ? ccAvg.toFixed(2) : "—",
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
        ...vals,
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
      setSuccessMsg(isCurrentlyLocked ? "Bordereau déverrouillé." : "Bordereau officiellement scellé.");
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
        title: `Procès-Verbal Certifié — ${gridData.offering?.subject?.name}`,
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
    <div className="space-y-md">
      {/* ENTONNOIR SÉQUENTIEL EN 4 ÉTAPES */}
      <div className="bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
          Sélection Pédagogique Séquentielle
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-center">
          {/* 1. Session */}
          <div>
            <label className="text-[10px] font-bold text-on-surface-variant block mb-1">1. Session</label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              disabled={isTeacher}
              className={selectCls}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.label} {y.isCurrent ? "(Active)" : "(Clôturée)"}</option>
              ))}
            </select>
          </div>

          {/* 2. Classe avec recherche */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-on-surface-variant">2. Classe</label>
              <input
                type="text"
                placeholder="Filtrer..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="text-[9px] px-1.5 py-0.5 rounded border outline-none w-24 bg-surface"
              />
            </div>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className={selectCls}
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

          {/* 3. Semestre S1 / S2 */}
          <div>
            <label className="text-[10px] font-bold text-on-surface-variant block mb-1">3. Semestre</label>
            <div className="flex p-0.5 bg-surface rounded-md border border-outline-variant/30 h-9">
              <button
                type="button"
                onClick={() => setSelectedSemesterOrder(1)}
                className={`flex-1 rounded text-xs font-bold transition-all ${
                  selectedSemesterOrder === 1 ? "bg-primary text-white shadow-xs" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Semestre 1
              </button>
              <button
                type="button"
                onClick={() => setSelectedSemesterOrder(2)}
                className={`flex-1 rounded text-xs font-bold transition-all ${
                  selectedSemesterOrder === 2 ? "bg-primary text-white shadow-xs" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Semestre 2
              </button>
            </div>
          </div>

          {/* 4. Matière */}
          <div>
            <label className="text-[10px] font-bold text-on-surface-variant block mb-1">4. Matière</label>
            <select
              value={selectedOfferingId}
              onChange={(e) => setSelectedOfferingId(e.target.value)}
              className={selectCls}
              disabled={semesterOfferings.length === 0}
            >
              {semesterOfferings.length === 0 ? (
                <option value="">Aucune matière pour ce semestre</option>
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

      {error && <div className="p-3 bg-error-container text-error text-xs rounded-md font-semibold">{error}</div>}
      {successMsg && <div className="p-3 bg-success-light text-success text-xs rounded-md font-semibold">{successMsg}</div>}

      {/* GRILLE MATRICIELLE */}
      {!gridData ? (
        <div className="rounded-md bg-surface-container-lowest p-8 border border-outline-variant/30 text-center space-y-2">
          <p className="text-xs text-on-surface-variant">
            {semesterOfferings.length === 0
              ? "Aucune matière n'est configurée pour cette classe dans ce semestre."
              : "Sélectionnez une matière pour ouvrir le bordereau de saisie."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-3">
          <div className="p-md border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary bg-primary-light px-2 py-0.5 rounded border border-primary/20">
                  {gridData.offering?.subject?.code || "—"}
                </span>
                <h3 className="text-sm font-bold text-on-surface">{gridData.offering?.subject?.name}</h3>
                <span className="text-xs font-mono text-on-surface-variant">({gridData.offering?.category?.name || "Général"})</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {gridData.offering?.classe?.label} • Coef {gridData.offering?.coefficient} • Formateur : {gridData.offering?.formateur ? `${gridData.offering.formateur.firstName} ${gridData.offering.formateur.lastName}` : "Non assigné"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePrintBlankSheet(false)}
                className="px-3 py-1.5 rounded-md text-xs font-bold bg-surface border border-outline-variant hover:bg-surface-container flex items-center gap-1 shadow-xs"
                title="Imprimer un bordereau pour saisie manuscrite"
              >
                <Icon name="print" className="text-[16px]" />
                <span>Bordereau Vierge</span>
              </button>

              {hasPermission("grades.validate") && (
                <button
                  onClick={() => handlePrintCertifiedSheet(false)}
                  className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary-light border border-primary/20 text-primary hover:bg-primary hover:text-white flex items-center gap-1 shadow-xs"
                  title="Générer le PV officiel scellé par QR Code"
                >
                  <Icon name="verified" className="text-[16px]" />
                  <span>PV Scellé QR</span>
                </button>
              )}

              {hasPermission("grades.validate") && (
                <button
                  onClick={() => setConfirmLockModal(true)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 shadow-xs ${
                    isLocked ? "bg-amber-500 text-white" : "bg-surface border border-outline-variant text-on-surface"
                  }`}
                >
                  <Icon name={isLocked ? "lock" : "lock_open"} className="text-[16px]" />
                  <span>{isLocked ? "Déverrouiller" : "Verrouiller le PV"}</span>
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
                  <th className="px-3 py-2.5">Apprenant</th>
                  <th className="px-3 py-2.5 w-32 text-center">CC 1 /20</th>
                  <th className="px-3 py-2.5 w-32 text-center">CC 2 /20</th>
                  <th className="px-3 py-2.5 w-24 text-center text-primary">Moy. CC</th>
                  <th className="px-3 py-2.5 w-32 text-center">Examen /20</th>
                  <th className="px-3 py-2.5 w-28 text-center">Rattrapage /20</th>
                  <th className="px-3 py-2.5 w-28 text-center bg-primary-light text-primary font-bold">Note Finale</th>
                  <th className="px-3 py-2.5 w-24 text-center">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {gridData.students?.map((st, idx) => {
                  const row = inputGrades[st.id] || {};
                  const calc = computePreview(st.id);

                  return (
                    <tr key={st.id} className="hover:bg-surface-container/20">
                      <td className="px-3 py-2 text-center font-mono text-on-surface-variant">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono font-bold text-primary">{st.matricule}</td>
                      <td className="px-3 py-2 font-semibold text-on-surface">{st.lastName} {st.firstName}</td>

                      {/* CC1 */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            id={`grade-input-${idx}-0`}
                            type="number" min="0" max="20" step="0.25"
                            disabled={isLocked || row.cc1Absent}
                            value={row.cc1}
                            onChange={(e) => handleGradeValueChange(st.id, "cc1", e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                            placeholder="—"
                            className="w-14 h-8 text-center rounded border bg-surface font-mono font-bold focus:border-primary outline-none"
                          />
                          <button
                            type="button" disabled={isLocked}
                            onClick={() => handleOpenAbsenceModal(st.id, "cc1")}
                            className={`text-[9px] px-1.5 py-1 rounded font-bold transition-all ${
                              row.cc1Absent
                                ? (row.cc1AbsenceReason === "JUSTIFIED" ? "bg-amber-400 text-amber-950 font-bold" : "bg-error text-white font-bold")
                                : "bg-surface border text-on-surface-variant hover:bg-surface-container"
                            }`}
                            title={row.cc1Absent ? `Absent (${row.cc1AbsenceReason === "JUSTIFIED" ? "Justifiée" : "0.00"})` : "Marquer absent"}
                          >
                            ABS
                          </button>
                        </div>
                      </td>

                      {/* CC2 */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            id={`grade-input-${idx}-1`}
                            type="number" min="0" max="20" step="0.25"
                            disabled={isLocked || row.cc2Absent}
                            value={row.cc2}
                            onChange={(e) => handleGradeValueChange(st.id, "cc2", e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                            placeholder="—"
                            className="w-14 h-8 text-center rounded border bg-surface font-mono font-bold focus:border-primary outline-none"
                          />
                          <button
                            type="button" disabled={isLocked}
                            onClick={() => handleOpenAbsenceModal(st.id, "cc2")}
                            className={`text-[9px] px-1.5 py-1 rounded font-bold transition-all ${
                              row.cc2Absent
                                ? (row.cc2AbsenceReason === "JUSTIFIED" ? "bg-amber-400 text-amber-950 font-bold" : "bg-error text-white font-bold")
                                : "bg-surface border text-on-surface-variant hover:bg-surface-container"
                            }`}
                            title={row.cc2Absent ? `Absent (${row.cc2AbsenceReason === "JUSTIFIED" ? "Justifiée" : "0.00"})` : "Marquer absent"}
                          >
                            ABS
                          </button>
                        </div>
                      </td>

                      <td className="px-3 py-2 text-center font-mono font-bold text-primary bg-surface/50">{calc.ccAvg}</td>

                      {/* Examen Normale */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            id={`grade-input-${idx}-2`}
                            type="number" min="0" max="20" step="0.25"
                            disabled={isLocked || row.normaleAbsent}
                            value={row.normale}
                            onChange={(e) => handleGradeValueChange(st.id, "normale", e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx, 2)}
                            placeholder="—"
                            className="w-14 h-8 text-center rounded border bg-surface font-mono font-bold focus:border-primary outline-none"
                          />
                          <button
                            type="button" disabled={isLocked}
                            onClick={() => handleOpenAbsenceModal(st.id, "normale")}
                            className={`text-[9px] px-1.5 py-1 rounded font-bold transition-all ${
                              row.normaleAbsent
                                ? (row.normaleAbsenceReason === "JUSTIFIED" ? "bg-amber-400 text-amber-950 font-bold" : "bg-error text-white font-bold")
                                : "bg-surface border text-on-surface-variant hover:bg-surface-container"
                            }`}
                            title={row.normaleAbsent ? `Absent (${row.normaleAbsenceReason === "JUSTIFIED" ? "Justifiée" : "0.00"})` : "Marquer absent"}
                          >
                            ABS
                          </button>
                        </div>
                      </td>

                      {/* Rattrapage */}
                      <td className="px-2 py-1.5 text-center">
                        <input
                          id={`grade-input-${idx}-3`}
                          type="number" min="0" max="20" step="0.25" disabled={isLocked}
                          value={row.rattrapage}
                          onChange={(e) => handleGradeValueChange(st.id, "rattrapage", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 3)}
                          placeholder="—"
                          className="w-16 h-8 text-center rounded border border-amber-300 bg-amber-50 font-mono font-bold text-amber-950 focus:border-amber-500 outline-none"
                        />
                      </td>

                      {/* Note Finale */}
                      <td className="px-3 py-2 text-center font-mono font-bold bg-primary-light text-primary text-sm">{calc.final}</td>

                      <td className="px-3 py-2 text-center">
                        {calc.final !== "—" ? (
                          <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${calc.passed ? "bg-success-light text-success" : "bg-error-container text-error"}`}>
                            {calc.passed ? "Validé" : "Échec"}
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
              Pondération : ({((gridData.gradingPolicy?.ccWeight || 0.30) * 100).toFixed(0)}% CC + {((gridData.gradingPolicy?.normalWeight || 0.70) * 100).toFixed(0)}% Examen)
            </span>
            <button
              onClick={handleSave} disabled={saving || isLocked}
              className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer les Notes"}
            </button>
          </div>
        </div>
      )}

      {/* PORTAIL DES MODALES SANS VIDE SUPÉRIEUR */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* 1. MODALE ABSENCE */}
          {absenceModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-md bg-white p-md shadow-xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold text-on-surface">Motif d'Absence à l'Évaluation</h3>
                  <button onClick={() => setAbsenceModal(null)} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <p className="text-xs text-on-surface-variant">Précisez le type d'absence :</p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleConfirmAbsence("JUSTIFIED")}
                    className="w-full p-2.5 text-left rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors text-xs font-bold text-amber-950 flex items-center gap-2"
                  >
                    <Icon name="verified" className="text-[18px] text-amber-600" />
                    <div>
                      <div>Absence Justifiée (Certificat médical)</div>
                      <div className="text-[10px] font-normal text-amber-800">Non pénalisée au calcul de moyenne continue</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleConfirmAbsence("UNJUSTIFIED")}
                    className="w-full p-2.5 text-left rounded-md border border-error/30 bg-error-container hover:bg-error/20 transition-colors text-xs font-bold text-error flex items-center gap-2"
                  >
                    <Icon name="cancel" className="text-[18px] text-error" />
                    <div>
                      <div>Absence Injustifiée (Non excusée)</div>
                      <div className="text-[10px] font-normal text-error/80">Comptabilisée comme 0.00 / 20</div>
                    </div>
                  </button>
                </div>
                <div className="flex justify-end pt-2 border-t">
                  <button onClick={() => setAbsenceModal(null)} className="px-3 py-1.5 border rounded text-xs">Annuler</button>
                </div>
              </motion.div>
            </div>
          )}

          {/* 2. MODALE VERROUILLAGE */}
          {confirmLockModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md rounded-md bg-white p-md shadow-xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center gap-2 text-primary border-b pb-2">
                  <Icon name={isLocked ? "lock_open" : "lock"} className="text-[20px]" />
                  <h3 className="text-sm font-bold text-on-surface">
                    {isLocked ? "Déverrouiller le bordereau" : "Verrouiller définitivement le bordereau"}
                  </h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {isLocked
                    ? "Déverrouiller ce bordereau autorisera de nouvelles modifications de notes. Cette action sera consignée dans le journal d'audit."
                    : "Le verrouillage scelle les notes de cette matière. Les enseignants ne pourront plus modifier les notes sans autorisation de la direction."}
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={() => setConfirmLockModal(false)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button
                    onClick={handleToggleLock}
                    className={`px-4 py-1.5 text-xs font-bold text-white rounded shadow-xs ${
                      isLocked ? "bg-amber-500 hover:bg-amber-600" : "bg-primary hover:bg-primary-dark"
                    }`}
                  >
                    {isLocked ? "Confirmer le déverrouillage" : "Confirmer le verrouillage"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* 3. VISIONNEUSE PDF HARMONIQUE */}
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