// packages/frontend/src/modules/pedagogie/GradesEntryPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import useAuthStore from "../../store/authStore";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel } from "../../design-system/layout/Card";
import Button from "../../design-system/primitives/Button";
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
import DocumentViewerModal from "../documents/components/DocumentViewerModal";
import Icon from "../../components/Icon";

export default function GradesEntryPage() {
  const { user, hasPermission } = useAuthStore();
  const isTeacher = user?.role?.name?.toLowerCase() === "formateur";
  const [searchParams, setSearchParams] = useSearchParams();
  const queryOfferingId = searchParams.get("offeringId");

  // Mode Enseignant : Liste directe de ses cours assignés
  const [myOfferings, setMyOfferings] = useState([]);

  // Mode Administrateur : Entonnoir séquentiel 4 étapes
  const [years, setYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [classes, setClasses] = useState([]);
  const [classSearch, setClassSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSemesterOrder, setSelectedSemesterOrder] = useState(1);
  const [offerings, setOfferings] = useState([]);

  // Cours sélectionné & Données de la Grille Matricielle
  const [selectedOfferingId, setSelectedOfferingId] = useState(queryOfferingId || "");
  const [gridData, setGridData] = useState(null);
  const [inputGrades, setInputGrades] = useState({});
  const [saving, setSaving] = useState(false);

  // Modales
  const [absenceModal, setAbsenceModal] = useState(null);
  const [confirmLockModal, setConfirmLockModal] = useState(false);
  const [pdfModal, setPdfModal] = useState(null);

  // 1. CHARGEMENT SELON LE RÔLE
  useEffect(() => {
    if (isTeacher) {
      // Pour l'enseignant : chargement direct de ses cours sans passer par les registres d'administration
      apiFetch("/pedagogie/my-offerings")
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setMyOfferings(list);
          if (queryOfferingId && list.some((o) => o.id === queryOfferingId)) {
            setSelectedOfferingId(queryOfferingId);
          } else if (list.length > 0 && !selectedOfferingId) {
            setSelectedOfferingId(list[0].id);
          }
        })
        .catch((e) => showToast(e.message, "error"));
    } else {
      // Pour l'administrateur : chargement de l'entonnoir
      apiFetch("/academic-years")
        .then((yrs) => {
          setYears(yrs || []);
          const active = yrs?.find((y) => y.isCurrent) || yrs?.[0];
          if (active) setSelectedYearId(active.id);
        })
        .catch((e) => showToast(e.message, "error"));
    }
  }, [isTeacher, queryOfferingId]);

  // Chargement des classes (Mode Admin)
  useEffect(() => {
    if (isTeacher || !selectedYearId) return;
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
      .catch((e) => showToast(e.message, "error"));
  }, [selectedYearId, isTeacher]);

  const filteredClasses = useMemo(() => {
    if (!classSearch.trim()) return classes;
    return classes.filter((c) => c.label.toLowerCase().includes(classSearch.toLowerCase()));
  }, [classes, classSearch]);

  // Chargement des matières de la classe (Mode Admin)
  useEffect(() => {
    if (isTeacher || !selectedClassId) return;
    apiFetch(`/classes/${selectedClassId}/offerings`)
      .then((data) => {
        const offs = Array.isArray(data) ? data : data.offerings || [];
        setOfferings(offs);
      })
      .catch(() => setOfferings([]));
  }, [selectedClassId, isTeacher]);

  const semesterOfferings = useMemo(() => {
    return offerings.filter((o) => o.gradePeriod?.order === selectedSemesterOrder);
  }, [offerings, selectedSemesterOrder]);

  useEffect(() => {
    if (!isTeacher) {
      if (semesterOfferings.length > 0) {
        if (!queryOfferingId || !semesterOfferings.some((o) => o.id === queryOfferingId)) {
          setSelectedOfferingId(semesterOfferings[0].id);
        }
      } else {
        setSelectedOfferingId("");
        setGridData(null);
      }
    }
  }, [semesterOfferings, isTeacher, queryOfferingId]);

  // 2. CHARGEMENT DE LA GRILLE MATRICIELLE DU COURS SÉLECTIONNÉ
  useEffect(() => {
    if (!selectedOfferingId) {
      setGridData(null);
      return;
    }
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
        showToast(err.message, "error");
        setGridData(null);
      });
  }, [selectedOfferingId]);

  // CLAMPING STRICT DES NOTES (0.00 à 20.00)
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

  // NAVIGATION AU CLAVIER FLUIDE STYLE EXCEL
  function handleKeyDown(e, stIdx, colIdx) {
    const totalStudents = gridData?.students?.length || 0;
    const totalCols = 4;

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

  // CALCUL MATHÉMATIQUE INSTANTANÉ DE PRÉVISUALISATION
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
    try {
      const payload = Object.entries(inputGrades).map(([studentId, vals]) => ({
        studentId,
        ...vals,
      }));
      await apiFetch("/grades/batch", {
        method: "POST",
        body: JSON.stringify({ offeringId: selectedOfferingId, gradesList: payload }),
      });
      showToast("Notes enregistrées et moyennes calculées avec succès.", "success");
      const res = await apiFetch(`/grades/grid?offeringId=${selectedOfferingId}`);
      setGridData(res);
    } catch (err) {
      showToast(err.message, "error");
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
      showToast(isCurrentlyLocked ? "Bordereau déverrouillé." : "Bordereau scellé officiellement.", "info");
      const res = await apiFetch(`/grades/grid?offeringId=${selectedOfferingId}`);
      setGridData(res);
    } catch (err) {
      showToast(err.message, "error");
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
      showToast(err.message, "error");
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
      showToast(err.message, "error");
    }
  }

  const isLocked = gridData?.isLocked;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">{isTeacher ? "Espace Enseignant • Saisie Directe" : "Pédagogie • Saisie Matricielle"}</Badge>}
        title={isTeacher ? "Saisie de Mes Notes d'Évaluation" : "Saisie des Notes &amp; Évaluations"}
        subtitle={isTeacher
          ? "Sélectionnez directement votre cours assigné ci-dessous et remplissez les notes dans la grille"
          : "Bordereau matriciel type tableur (CC1, CC2, Examen, Rattrapage) avec verrouillage officiel"}
      />

      {/* SÉLECTEUR DE COURS (ADAPTATIF SELON LE RÔLE) */}
      <StructuredPanel
        title={isTeacher ? "Mon Cours à Évaluer" : "Sélection Séquentielle du Cours"}
        subtitle={isTeacher ? "Liste de vos cours assignés sur la session active" : "Session → Classe → Semestre → Discipline"}
        icon="tune"
      >
        {isTeacher ? (
          /* VUE ENSEIGNANT : SÉLECTEUR UNIQUE DIRECT EN 1 CLIC */
          <div className="space-y-2">
            {myOfferings.length === 0 ? (
              <div className="p-4 rounded bg-[#F5F7FA] border border-border text-caption text-ink-muted dark:bg-[#07111D] dark:border-border-dark">
                Aucun cours ne vous est actuellement assigné pour la session active. Contactez la direction des études.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-8">
                  <Select
                    label="Mes Cours Assignés (Session Active)"
                    value={selectedOfferingId}
                    onChange={(e) => {
                      setSelectedOfferingId(e.target.value);
                      setSearchParams({ offeringId: e.target.value });
                    }}
                  >
                    {myOfferings.map((o) => (
                      <option key={o.id} value={o.id}>
                        [{o.subjectCode}] {o.subjectName} • {o.classeLabel} • {o.semesterLabel} (Coef {o.coefficient})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="sm:col-span-4 flex items-end h-full pt-6">
                  <Badge variant={gridData?.isLocked ? "warning" : "success"} className="h-[40px] w-full justify-center text-body-sm font-semibold">
                    {gridData?.isLocked ? "🔒 Bordereau Verrouillé" : "✓ Saisie Active Autorisée"}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* VUE ADMINISTRATEUR : ENTONNOIR SÉQUENTIEL COMPLET */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              label="1. Session Académique"
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.label} {y.isCurrent ? "(Active)" : "(Clôturée)"}</option>
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

            <div>
              <label className="text-caption font-semibold uppercase tracking-wider text-ink-secondary block mb-1.5 select-none dark:text-ink-secondary-dark">
                3. Semestre
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

            <Select
              label="4. Matière / Cours"
              value={selectedOfferingId}
              onChange={(e) => setSelectedOfferingId(e.target.value)}
              disabled={semesterOfferings.length === 0}
            >
              {semesterOfferings.length === 0 ? (
                <option value="">Aucun cours configuré</option>
              ) : (
                semesterOfferings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.subject?.code || "—"} • {o.subject?.name} (Coef {o.coefficient})
                  </option>
                ))
              )}
            </Select>
          </div>
        )}
      </StructuredPanel>

      {/* GRILLE MATRICIELLE DE SAISIE */}
      {!gridData ? (
        <div className="rounded bg-surface p-12 border border-border text-center space-y-2 dark:bg-surface-dark dark:border-border-dark">
          <Icon name="table_rows" className="text-4xl text-ink-muted" />
          <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Bordereau en attente de sélection</h3>
          <p className="text-caption text-ink-muted">
            {isTeacher && myOfferings.length === 0
              ? "Aucun cours ne vous est assigné actuellement."
              : "Sélectionnez un cours ci-dessus pour ouvrir la saisie des notes."}
          </p>
        </div>
      ) : (
        <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-border-dark">
            <div>
              <div className="flex items-center gap-2.5">
                <Badge variant="brand">{gridData.offering?.subject?.code || "MAT"}</Badge>
                <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans">{gridData.offering?.subject?.name}</h3>
                <span className="text-caption text-ink-muted">({gridData.offering?.category?.name || "Général"})</span>
              </div>
              <p className="text-caption text-ink-muted mt-0.5">
                {gridData.offering?.classe?.label} • Coef {gridData.offering?.coefficient} • Formateur : {gridData.offering?.formateur ? `${gridData.offering.formateur.firstName} ${gridData.offering.formateur.lastName}` : "Non assigné"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" icon="print" onClick={() => handlePrintBlankSheet(false)}>
                Bordereau Vierge
              </Button>

              {hasPermission("grades.validate") && (
                <Button variant="secondary" size="sm" icon="verified" onClick={() => handlePrintCertifiedSheet(false)}>
                  PV Certifié QR
                </Button>
              )}

              {hasPermission("grades.validate") && (
                <Button
                  variant={isLocked ? "warning" : "secondary"}
                  size="sm"
                  icon={isLocked ? "lock" : "lock_open"}
                  onClick={() => setConfirmLockModal(true)}
                >
                  {isLocked ? "Déverrouiller" : "Verrouiller"}
                </Button>
              )}
            </div>
          </div>

          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="w-12 text-center">N°</TableHeaderCell>
                <TableHeaderCell className="w-28">Matricule</TableHeaderCell>
                <TableHeaderCell>Apprenant</TableHeaderCell>
                <TableHeaderCell className="w-32 text-center">CC 1 /20</TableHeaderCell>
                <TableHeaderCell className="w-32 text-center">CC 2 /20</TableHeaderCell>
                <TableHeaderCell className="w-24 text-center">Moy. CC</TableHeaderCell>
                <TableHeaderCell className="w-32 text-center">Examen /20</TableHeaderCell>
                <TableHeaderCell className="w-28 text-center">Rattrapage /20</TableHeaderCell>
                <TableHeaderCell className="w-28 text-center">Note Finale</TableHeaderCell>
                <TableHeaderCell className="w-24 text-center">Validation</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gridData.students?.map((st, idx) => {
                const row = inputGrades[st.id] || {};
                const calc = computePreview(st.id);

                return (
                  <TableRow key={st.id}>
                    <TableCell align="center" className="font-mono text-ink-muted text-caption">{idx + 1}</TableCell>
                    <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{st.matricule}</TableCell>
                    <TableCell className="font-semibold text-ink-primary dark:text-white">{st.lastName} {st.firstName}</TableCell>

                    {/* CC 1 */}
                    <TableCell align="center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          id={`grade-input-${idx}-0`}
                          type="number"
                          min="0"
                          max="20"
                          step="0.25"
                          disabled={isLocked || row.cc1Absent}
                          value={row.cc1}
                          onChange={(e) => handleGradeValueChange(st.id, "cc1", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                          placeholder="—"
                          className="w-14 h-8 text-center rounded border border-border bg-surface font-mono font-bold focus:border-brand-700 outline-none dark:bg-surface-dark dark:border-border-dark dark:text-white"
                        />
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleOpenAbsenceModal(st.id, "cc1")}
                          className={`h-7 px-1.5 rounded-[2px] text-[10px] font-bold border transition-colors ${
                            row.cc1Absent
                              ? (row.cc1AbsenceReason === "JUSTIFIED" ? "bg-warning-subtle text-warning border-warning" : "bg-error-subtle text-error border-error")
                              : "bg-surface border-border text-ink-muted hover:bg-[#F5F7FA] dark:bg-surface-dark dark:border-border-dark"
                          }`}
                          title={row.cc1Absent ? `Absent (${row.cc1AbsenceReason === "JUSTIFIED" ? "Justifiée" : "0.00"})` : "Marquer absent"}
                        >
                          ABS
                        </button>
                      </div>
                    </TableCell>

                    {/* CC 2 */}
                    <TableCell align="center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          id={`grade-input-${idx}-1`}
                          type="number"
                          min="0"
                          max="20"
                          step="0.25"
                          disabled={isLocked || row.cc2Absent}
                          value={row.cc2}
                          onChange={(e) => handleGradeValueChange(st.id, "cc2", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                          placeholder="—"
                          className="w-14 h-8 text-center rounded border border-border bg-surface font-mono font-bold focus:border-brand-700 outline-none dark:bg-surface-dark dark:border-border-dark dark:text-white"
                        />
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleOpenAbsenceModal(st.id, "cc2")}
                          className={`h-7 px-1.5 rounded-[2px] text-[10px] font-bold border transition-colors ${
                            row.cc2Absent
                              ? (row.cc2AbsenceReason === "JUSTIFIED" ? "bg-warning-subtle text-warning border-warning" : "bg-error-subtle text-error border-error")
                              : "bg-surface border-border text-ink-muted hover:bg-[#F5F7FA] dark:bg-surface-dark dark:border-border-dark"
                          }`}
                          title={row.cc2Absent ? `Absent (${row.cc2AbsenceReason === "JUSTIFIED" ? "Justifiée" : "0.00"})` : "Marquer absent"}
                        >
                          ABS
                        </button>
                      </div>
                    </TableCell>

                    <TableCell align="center" className="font-mono font-bold text-brand-900 bg-[#F5F7FA]/60 dark:text-brand-500 dark:bg-[#07111D]/40">
                      {calc.ccAvg}
                    </TableCell>

                    {/* Examen Normale */}
                    <TableCell align="center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          id={`grade-input-${idx}-2`}
                          type="number"
                          min="0"
                          max="20"
                          step="0.25"
                          disabled={isLocked || row.normaleAbsent}
                          value={row.normale}
                          onChange={(e) => handleGradeValueChange(st.id, "normale", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 2)}
                          placeholder="—"
                          className="w-14 h-8 text-center rounded border border-border bg-surface font-mono font-bold focus:border-brand-700 outline-none dark:bg-surface-dark dark:border-border-dark dark:text-white"
                        />
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleOpenAbsenceModal(st.id, "normale")}
                          className={`h-7 px-1.5 rounded-[2px] text-[10px] font-bold border transition-colors ${
                            row.normaleAbsent
                              ? (row.normaleAbsenceReason === "JUSTIFIED" ? "bg-warning-subtle text-warning border-warning" : "bg-error-subtle text-error border-error")
                              : "bg-surface border-border text-ink-muted hover:bg-[#F5F7FA] dark:bg-surface-dark dark:border-border-dark"
                          }`}
                          title={row.normaleAbsent ? `Absent (${row.normaleAbsenceReason === "JUSTIFIED" ? "Justifiée" : "0.00"})` : "Marquer absent"}
                        >
                          ABS
                        </button>
                      </div>
                    </TableCell>

                    {/* Rattrapage */}
                    <TableCell align="center">
                      <input
                        id={`grade-input-${idx}-3`}
                        type="number"
                        min="0"
                        max="20"
                        step="0.25"
                        disabled={isLocked}
                        value={row.rattrapage}
                        onChange={(e) => handleGradeValueChange(st.id, "rattrapage", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 3)}
                        placeholder="—"
                        className="w-16 h-8 text-center rounded border border-warning/40 bg-warning-subtle font-mono font-bold text-warning-dark focus:border-warning outline-none dark:bg-warning-subtle-dark dark:text-warning"
                      />
                    </TableCell>

                    <TableCell align="center" className="font-mono font-bold text-body-md text-brand-900 bg-brand-500/5 dark:text-brand-500">
                      {calc.final}
                    </TableCell>

                    <TableCell align="center">
                      {calc.final !== "—" ? (
                        <Badge variant={calc.passed ? "success" : "error"}>
                          {calc.passed ? "Validé" : "Échec"}
                        </Badge>
                      ) : (
                        <span className="text-caption text-ink-muted">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="p-4 border-t border-border bg-[#FAFBFD] flex items-center justify-between text-body-sm dark:border-border-dark dark:bg-[#07111D]/40">
            <span className="text-ink-secondary font-mono">
              Formule : ({((gridData.gradingPolicy?.ccWeight || 0.30) * 100).toFixed(0)}% CC + {((gridData.gradingPolicy?.normalWeight || 0.70) * 100).toFixed(0)}% Examen)
            </span>
            <Button variant="primary" onClick={handleSave} disabled={saving || isLocked} isLoading={saving}>
              Enregistrer les Notes
            </Button>
          </div>
        </div>
      )}

      {/* Modale Qualification Absence */}
      <Modal
        isOpen={Boolean(absenceModal)}
        onClose={() => setAbsenceModal(null)}
        title="Motif d'Absence à l'Évaluation"
        icon="verified_user"
        maxWidth="max-w-sm"
        footer={<Button variant="secondary" onClick={() => setAbsenceModal(null)}>Annuler</Button>}
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleConfirmAbsence("JUSTIFIED")}
            className="w-full p-3 text-left rounded border border-warning/40 bg-warning-subtle hover:bg-warning/20 transition-colors text-body-sm font-semibold text-warning-dark flex items-start gap-2.5 dark:bg-warning-subtle-dark dark:text-warning"
          >
            <Icon name="verified" className="text-[18px] text-warning flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Absence Justifiée (Certificat médical)</div>
              <div className="text-caption font-normal opacity-90">Non pénalisée dans le calcul de la moyenne continue</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleConfirmAbsence("UNJUSTIFIED")}
            className="w-full p-3 text-left rounded border border-error/40 bg-error-subtle hover:bg-error/20 transition-colors text-body-sm font-semibold text-error flex items-start gap-2.5 dark:bg-error-subtle-dark dark:text-error-dark"
          >
            <Icon name="cancel" className="text-[18px] text-error flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Absence Injustifiée (Non excusée)</div>
              <div className="text-caption font-normal opacity-90">Comptabilisée comme note 0.00 / 20</div>
            </div>
          </button>
        </div>
      </Modal>

      {/* Modale Verrouillage */}
      <Modal
        isOpen={confirmLockModal}
        onClose={() => setConfirmLockModal(false)}
        title={isLocked ? "Déverrouiller le bordereau" : "Verrouiller officiellement le bordereau"}
        icon={isLocked ? "lock_open" : "lock"}
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmLockModal(false)}>Annuler</Button>
            <Button variant={isLocked ? "warning" : "primary"} onClick={handleToggleLock}>
              {isLocked ? "Confirmer Déverrouillage" : "Confirmer Verrouillage"}
            </Button>
          </>
        }
      >
        <p className="text-body text-ink-secondary leading-relaxed dark:text-ink-secondary-dark">
          {isLocked
            ? "Déverrouiller ce bordereau autorisera à nouveau les modifications de notes. Cette action sera consignée dans le journal d'audit."
            : "Le verrouillage scelle définitivement les notes de ce cours. Les enseignants ne pourront plus les modifier sans visa de la direction."}
        </p>
      </Modal>

      {/* Visionneuse PDF */}
      <DocumentViewerModal
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
    </motion.div>
  );
}