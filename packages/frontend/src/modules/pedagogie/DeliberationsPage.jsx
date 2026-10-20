// packages/frontend/src/modules/pedagogie/DeliberationsPage.jsx
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
import DocumentViewerModal from "../documents/components/DocumentViewerModal";
import Icon from "../../components/Icon";

export default function DeliberationsPage() {
  const [classes, setClasses] = useState([]);
  const [classSearch, setClassSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [scope, setScope] = useState("ANNUEL");
  const [juryDate, setJuryDate] = useState(new Date().toISOString().split("T")[0]);

  const [delibTab, setDelibTab] = useState("tableau");
  const [delibData, setDelibData] = useState(null);
  const [studentDecisions, setStudentDecisions] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [centerWideModal, setCenterWideModal] = useState(false);
  const [runningCenterWide, setRunningCenterWide] = useState(false);
  const [centerWideReport, setCenterWideReport] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);

  useEffect(() => {
    Promise.all([apiFetch("/classes"), apiFetch("/academic-years")]).then(([clsList, years]) => {
      const activeYear = years?.find((y) => y.isCurrent) || years?.[0];
      const activeClasses = (clsList || []).filter(
        (c) => c.academicYearId === activeYear?.id || c.academicYear?.isCurrent
      );
      setClasses(activeClasses);
      if (activeClasses.length > 0) setSelectedClassId(activeClasses[0].id);

      const pList = activeYear?.gradePeriods || [];
      setPeriods(pList);
      if (pList.length > 0) {
        const def = scope === "ANNUEL"
          ? pList.find((p) => p.type === "ANNUEL") || pList[0]
          : pList.find((p) => p.type === "SEMESTRE") || pList[0];
        setSelectedPeriodId(def.id);
      }
    }).catch((e) => showToast(e.message, "error"));
  }, [scope]);

  const filteredClasses = useMemo(() => {
    if (!classSearch.trim()) return classes;
    return classes.filter((c) => c.label.toLowerCase().includes(classSearch.toLowerCase()));
  }, [classes, classSearch]);

  function loadDeliberation() {
    if (!selectedClassId || !selectedPeriodId) return;
    setLoading(true);
    apiFetch(`/deliberations?classeId=${selectedClassId}&gradePeriodId=${selectedPeriodId}&scope=${scope}`)
      .then((data) => {
        setDelibData(data);
        if (data.juryDate) setJuryDate(new Date(data.juryDate).toISOString().split("T")[0]);

        const decisionsMap = {};
        data.results?.forEach((st) => {
          decisionsMap[st.studentId] = {
            decision: st.decision,
            moyenne: st.moyenne,
            rang: st.rang || st.calculatedRank,
          };
        });
        setStudentDecisions(decisionsMap);
      })
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDeliberation();
  }, [selectedClassId, selectedPeriodId, scope]);

  function handleDecisionChange(studentId, newDecision) {
    setStudentDecisions((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        decision: newDecision,
      },
    }));
  }

  async function handleExecuteCenterWideDeliberation() {
    setRunningCenterWide(true);
    try {
      const res = await apiFetch("/deliberations/center-wide-run", {
        method: "POST",
        body: JSON.stringify({ scope, juryDate }),
      });
      setCenterWideReport(res.report);
      showToast(res.message, "success");
      loadDeliberation();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setRunningCenterWide(false);
    }
  }

  // VALIDATION & SCELLEMENT AVEC SYNCHRONISATION INSTANTANÉE
  async function handleSaveManualDeliberation() {
    setSaving(true);
    try {
      const payloadResults = Object.entries(studentDecisions).map(([studentId, d]) => ({
        studentId,
        decision: d.decision,
        rang: d.rang,
      }));

      const res = await apiFetch("/deliberations/run", {
        method: "POST",
        body: JSON.stringify({
          classeId: selectedClassId,
          gradePeriodId: selectedPeriodId,
          scope,
          juryDate,
          results: payloadResults,
        }),
      });

      showToast(res.message, "success");
      loadDeliberation();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrintPvDeliberation(forceRegenerate = false) {
    try {
      const res = await apiFetch(`/grades/classes/${selectedClassId}/semester-sheet`, {
        method: "POST",
        body: JSON.stringify({ gradePeriodId: selectedPeriodId, forceRegenerate }),
      });
      const token = getToken();
      const titleLabel = scope === "ANNUEL" ? "PV de Délibération Annuelle (A4 Paysage)" : "PV de Délibération Semestrielle (A4 Paysage)";
      setPdfModal({
        title: `${titleLabel} — ${delibData?.classe?.label}`,
        previewUrl: `${API_BASE}${res.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.downloadUrl}?token=${token}`,
        pvType: "deliberation",
        reused: res.reused,
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handlePrintPvContinuousAssessment(forceRegenerate = false) {
    try {
      const res = await apiFetch(`/grades/classes/${selectedClassId}/cc-sheet`, {
        method: "POST",
        body: JSON.stringify({ gradePeriodId: selectedPeriodId, forceRegenerate }),
      });
      const token = getToken();
      setPdfModal({
        title: `PV du Contrôle Continu CC (A4 Paysage) — ${delibData?.classe?.label}`,
        previewUrl: `${API_BASE}${res.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.downloadUrl}?token=${token}`,
        pvType: "cc",
        reused: res.reused,
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  const summaryStats = useMemo(() => {
    const list = Object.values(studentDecisions);
    if (scope === "ANNUEL") {
      return {
        admis: list.filter((d) => d.decision === "admis").length,
        diplome: list.filter((d) => d.decision === "diplome").length,
        redouble: list.filter((d) => d.decision === "redouble").length,
        ajourne: list.filter((d) => d.decision === "ajourne").length,
      };
    }
    return {
      valide: list.filter((d) => d.decision === "valide").length,
      ajourne: list.filter((d) => d.decision === "ajourne").length,
    };
  }, [studentDecisions, scope]);

  const failedStudentsDetails = useMemo(() => {
    if (!delibData?.results) return [];
    return delibData.results
      .map((st) => {
        const failedSubjects = (st.subjectsDetail || []).filter(
          (sub) => sub.grade !== null && (sub.grade < 10.0 || (sub.isEliminatory && sub.grade < 8.0))
        );
        const missingSubjects = (st.subjectsDetail || []).filter((sub) => sub.grade === null);
        return {
          ...st,
          currentDecision: studentDecisions[st.studentId]?.decision || st.decision,
          failedSubjects,
          missingSubjects,
        };
      })
      .filter((st) => st.failedSubjects.length > 0 || st.missingSubjects.length > 0 || st.currentDecision === "ajourne" || st.currentDecision === "redouble");
  }, [delibData, studentDecisions]);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Pédagogie • Jurys de Délibération</Badge>}
        title="Délibérations &amp; Arbitrage Pédagogique"
        subtitle="Arrêtez souverainement les décisions d'admission, de redoublement et d'ajournement de chaque promotion"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon="sync"
              onClick={loadDeliberation}
              disabled={loading}
              title="Recalculer les moyennes d'après les dernières saisies de notes"
            >
              Recalculer les Moyennes
            </Button>
            <Button variant="primary" icon="bolt" onClick={() => { setCenterWideReport(null); setCenterWideModal(true); }}>
              Délibérer Tout le Centre
            </Button>
          </div>
        }
      />

      <StructuredPanel
        title="Configuration de la Délibération"
        subtitle="Sélectionnez la classe, la portée temporelle et la date du procès-verbal"
        icon="gavel"
        headerAction={
          <div className="flex p-0.5 bg-[#F5F7FA] rounded border border-border h-[36px] dark:bg-[#07111D] dark:border-border-dark">
            <button
              type="button"
              onClick={() => setScope("ANNUEL")}
              className={`px-3 text-body-sm font-semibold rounded-[2px] transition-colors ${
                scope === "ANNUEL" ? "bg-brand-900 text-white shadow-xs dark:bg-brand-500" : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Annuelle (Cumul S1 + S2)
            </button>
            <button
              type="button"
              onClick={() => setScope("SEMESTRE")}
              className={`px-3 text-body-sm font-semibold rounded-[2px] transition-colors ${
                scope === "SEMESTRE" ? "bg-brand-900 text-white shadow-xs dark:bg-brand-500" : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Semestrielle
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-caption font-semibold uppercase tracking-wider text-ink-secondary select-none dark:text-ink-secondary-dark">
                Classe (Session Active)
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
              {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <Select label="Période Évaluée" value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}>
            {periods.filter((p) => (scope === "ANNUEL" ? p.type === "ANNUEL" : p.type === "SEMESTRE")).map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </Select>

          <Input type="date" label="Date Officielle du Jury" value={juryDate} onChange={(e) => setJuryDate(e.target.value)} />
        </div>
      </StructuredPanel>

      {/* Badges Synthétiques */}
      {delibData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {scope === "ANNUEL" ? (
            <>
              <div className="p-4 rounded bg-surface border border-border flex items-center justify-between dark:bg-surface-dark dark:border-border-dark">
                <span className="text-body-sm text-ink-secondary">Admis (Niv+1) :</span>
                <span className="font-heading font-bold text-h4 text-success">{summaryStats.admis}</span>
              </div>
              <div className="p-4 rounded bg-surface border border-border flex items-center justify-between dark:bg-surface-dark dark:border-border-dark">
                <span className="text-body-sm text-ink-secondary">Diplômés :</span>
                <span className="font-heading font-bold text-h4 text-brand-900 dark:text-brand-500">{summaryStats.diplome}</span>
              </div>
              <div className="p-4 rounded bg-surface border border-border flex items-center justify-between dark:bg-surface-dark dark:border-border-dark">
                <span className="text-body-sm text-ink-secondary">Ajournés :</span>
                <span className="font-heading font-bold text-h4 text-warning">{summaryStats.ajourne}</span>
              </div>
              <div className="p-4 rounded bg-surface border border-border flex items-center justify-between dark:bg-surface-dark dark:border-border-dark">
                <span className="text-body-sm text-ink-secondary">Redoublants :</span>
                <span className="font-heading font-bold text-h4 text-error">{summaryStats.redouble}</span>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 rounded bg-surface border border-border flex items-center justify-between dark:bg-surface-dark dark:border-border-dark">
                <span className="text-body-sm text-ink-secondary">Validés (≥10) :</span>
                <span className="font-heading font-bold text-h4 text-success">{summaryStats.valide}</span>
              </div>
              <div className="p-4 rounded bg-surface border border-border flex items-center justify-between dark:bg-surface-dark dark:border-border-dark">
                <span className="text-body-sm text-ink-secondary">Ajournés (&lt;10) :</span>
                <span className="font-heading font-bold text-h4 text-warning">{summaryStats.ajourne}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Onglets Synoptique vs Ajournements */}
      <div className="flex gap-1.5 p-1 bg-[#F5F7FA] rounded border border-border overflow-x-auto dark:bg-[#07111D] dark:border-border-dark">
        <button
          type="button"
          onClick={() => setDelibTab("tableau")}
          className={`flex items-center gap-2 h-[36px] px-4 rounded text-body-md font-medium transition-colors ${
            delibTab === "tableau" ? "bg-brand-900 text-white font-semibold shadow-xs dark:bg-brand-500" : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          <Icon name="table_chart" className="text-[18px]" />
          <span>Tableau Synoptique du Jury</span>
        </button>

        <button
          type="button"
          onClick={() => setDelibTab("ajournes")}
          className={`flex items-center gap-2 h-[36px] px-4 rounded text-body-md font-medium transition-colors ${
            delibTab === "ajournes" ? "bg-brand-900 text-white font-semibold shadow-xs dark:bg-brand-500" : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          <Icon name="rule" className="text-[18px]" />
          <span>Relevé des Ajournements &amp; Matières Manquantes ({failedStudentsDetails.length})</span>
        </button>
      </div>

      {loading ? (
        <p className="text-caption text-ink-muted text-center py-8">Calcul des résultats en cours...</p>
      ) : delibData && (
        <>
          {delibTab === "tableau" && (
            <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
              <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-border-dark">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans">
                      {delibData.classe?.label} — Délibération {scope === "ANNUEL" ? "Annuelle (Cumul S1 + S2)" : delibData.period?.label}
                    </h3>
                    <Badge variant={delibData.isDeliberated ? "success" : "warning"}>
                      {delibData.isDeliberated ? "Scellé" : "Brouillon"}
                    </Badge>
                  </div>
                  <p className="text-caption text-ink-muted mt-0.5">
                    {delibData.results?.length || 0} apprenant(s) évalué(s) • Total Coefs Prescrits : <strong>{delibData.totalPrescribedCoeffs}</strong> • Seuil d'admission : 10.00 / 20
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="secondary" size="sm" icon="print" onClick={() => handlePrintPvContinuousAssessment(false)}>
                    PV Contrôle Continu (CC)
                  </Button>

                  <Button variant="secondary" size="sm" icon="print" onClick={() => handlePrintPvDeliberation(false)}>
                    {scope === "ANNUEL" ? "PV Délibération Annuelle" : "PV Délibération Semestre"}
                  </Button>

                  <Button variant="primary" size="sm" icon="lock" onClick={handleSaveManualDeliberation} isLoading={saving}>
                    Valider &amp; Sceller
                  </Button>
                </div>
              </div>

              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell className="w-16 text-center">Rang</TableHeaderCell>
                    <TableHeaderCell className="w-28">Matricule</TableHeaderCell>
                    <TableHeaderCell>Apprenant</TableHeaderCell>
                    <TableHeaderCell className="w-32 text-center">Total Points</TableHeaderCell>
                    <TableHeaderCell className="w-28 text-center">Moyenne /20</TableHeaderCell>
                    <TableHeaderCell className="w-48 text-center">Alertes &amp; Éliminatoires</TableHeaderCell>
                    <TableHeaderCell className="w-48">Décision du Jury</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {delibData.results?.map((st) => {
                    const currentDec = studentDecisions[st.studentId]?.decision || (scope === "ANNUEL" ? "redouble" : "ajourne");

                    return (
                      <TableRow key={st.studentId}>
                        <TableCell align="center" className="font-mono font-bold text-brand-900 dark:text-brand-500">
                          {st.rang ? `${st.rang}e` : `${st.calculatedRank}e`}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{st.matricule}</TableCell>
                        <TableCell className="font-semibold text-ink-primary dark:text-white">{st.lastName} {st.firstName}</TableCell>
                        <TableCell align="center" className="font-mono text-caption text-ink-secondary">
                          {st.totalPoints} / {delibData.totalPrescribedCoeffs * 20} pts
                        </TableCell>
                        <TableCell align="center" className="font-mono font-bold text-body-md text-brand-900 bg-brand-500/5 dark:text-brand-500">
                          {st.moyenne !== null ? `${st.moyenne}` : "—"}
                        </TableCell>

                        {/* ALERTES PÉDAGOGIQUES : DÉTECTION DES NOTES MANQUANTES ET ÉLIMINATOIRES */}
                        <TableCell align="center">
                          <div className="flex flex-col items-center gap-1">
                            {st.hasMissingGrades && (
                              <Badge variant="warning" className="text-[10px]">
                                {st.missingGradesCount} matière(s) non notée(s)
                              </Badge>
                            )}
                            {st.hasEliminatoryGrade && (
                              <Badge variant="error" className="text-[10px]">
                                Note &lt; 08 (Spécialité)
                              </Badge>
                            )}
                            {!st.hasMissingGrades && !st.hasEliminatoryGrade && (
                              <span className="text-caption text-success font-semibold">Conforme</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          {scope === "ANNUEL" ? (
                            <select
                              value={currentDec}
                              onChange={(e) => handleDecisionChange(st.studentId, e.target.value)}
                              className="h-[32px] rounded bg-surface px-2 text-caption font-semibold border border-border outline-none dark:bg-surface-dark dark:border-border-dark"
                            >
                              <option value="admis" disabled={st.hasMissingGrades}>Admis (Niveau Supérieur)</option>
                              <option value="diplome" disabled={st.hasMissingGrades}>Diplômé (Fin de cycle)</option>
                              <option value="ajourne">Ajourné (Rattrapage)</option>
                              <option value="redouble">Redouble (Même niveau)</option>
                              <option value="exclu">Exclu (Disciplinaire)</option>
                            </select>
                          ) : (
                            <select
                              value={currentDec}
                              onChange={(e) => handleDecisionChange(st.studentId, e.target.value)}
                              className="h-[32px] rounded bg-surface px-2 text-caption font-semibold border border-border outline-none dark:bg-surface-dark dark:border-border-dark"
                            >
                              <option value="valide" disabled={st.hasMissingGrades}>Semestre Validé (≥ 10.00)</option>
                              <option value="ajourne">Semestre Ajourné (&lt; 10.00)</option>
                            </select>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {delibTab === "ajournes" && (
            <div className="space-y-4">
              <StructuredPanel
                title="Apprenants Ajournés, Matières Insuffisantes &amp; Modules Manquants"
                subtitle="Modules sous le seuil d'admission (< 10.00), éliminatoires (< 08.00) ou non encore évalués"
                icon="rule"
                headerAction={<Badge variant="warning">{failedStudentsDetails.length} apprenant(s) concerné(s)</Badge>}
              >
                {failedStudentsDetails.length === 0 ? (
                  <div className="p-8 text-center bg-success-subtle rounded border border-success/30 text-success text-body-sm font-semibold dark:bg-success-subtle-dark dark:text-success-dark">
                    ✓ Aucun apprenant ajourné : toute la classe a validé l'ensemble des modules au-dessus du seuil requis.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {failedStudentsDetails.map((st) => (
                      <div key={st.studentId} className="p-4 rounded bg-[#F5F7FA] border border-border space-y-3 dark:bg-[#07111D] dark:border-border-dark">
                        <div className="flex items-center justify-between border-b border-border pb-2.5 dark:border-border-dark">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-brand-900 dark:text-brand-500">{st.matricule}</span>
                            <span className="font-semibold text-body text-ink-primary dark:text-white">{st.lastName} {st.firstName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="brand">Moyenne : {st.moyenne}/20</Badge>
                            <Badge variant="warning">{st.currentDecision}</Badge>
                          </div>
                        </div>

                        {st.missingSubjects?.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-caption font-semibold uppercase tracking-wider text-warning-dark block">
                              ⚠️ Modules sans note enregistrée ({st.missingSubjects.length}) :
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {st.missingSubjects.map((sub, i) => (
                                <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-warning-subtle text-warning-dark border border-warning/30 font-medium">
                                  [{sub.subjectCode}] {sub.subjectName} (Coef {sub.coefficient})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {st.failedSubjects?.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <span className="text-caption font-semibold uppercase tracking-wider text-ink-secondary block">
                              Modules sous la moyenne (&lt; 10.00 / 20) :
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                              {st.failedSubjects.map((sub, sidx) => (
                                <div key={sidx} className="p-2.5 rounded bg-surface border border-border flex items-center justify-between text-body-sm dark:bg-surface-dark dark:border-border-dark">
                                  <div>
                                    <div className="font-semibold text-ink-primary dark:text-white">{sub.subjectName}</div>
                                    <div className="text-caption text-ink-muted font-mono">{sub.categoryName} • Coef {sub.coefficient}</div>
                                  </div>
                                  <div className="text-right">
                                    <span className={`font-mono font-bold ${sub.grade < 8.0 ? "text-error" : "text-warning"}`}>
                                      {sub.grade !== null ? `${sub.grade} / 20` : "—"}
                                    </span>
                                    {sub.grade < 8.0 && <Badge variant="error" className="mt-0.5 block">Éliminatoire</Badge>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </StructuredPanel>
            </div>
          )}
        </>
      )}

      {/* Modale Délibération Tout le Centre */}
      <Modal
        isOpen={centerWideModal}
        onClose={() => setCenterWideModal(false)}
        title="Délibération de Tout l'Établissement"
        subtitle={`Exécution en 1 clic pour toutes les classes de la session (${classes.length} classes)`}
        icon="bolt"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCenterWideModal(false)}>
              {centerWideReport ? "Fermer" : "Annuler"}
            </Button>
            {!centerWideReport && (
              <Button variant="primary" icon="bolt" onClick={handleExecuteCenterWideDeliberation} isLoading={runningCenterWide}>
                Lancer Délibération Globale
              </Button>
            )}
          </>
        }
      >
        {!centerWideReport ? (
          <div className="space-y-3 text-body-sm text-ink-secondary dark:text-ink-secondary-dark">
            <p>
              Cette opération va calculer automatiquement les moyennes et attribuer les décisions pour <strong>toutes les classes de la session active</strong>.
            </p>
            <div className="p-3.5 rounded bg-[#F5F7FA] border border-border space-y-1 font-mono text-caption dark:bg-[#07111D] dark:border-border-dark">
              <div>Portée : {scope === "ANNUEL" ? "Délibération Annuelle (Mise à jour des statuts)" : "Délibération Semestrielle"}</div>
              <div>Date Officielle : {juryDate}</div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded bg-success-subtle border border-success/30 space-y-3 dark:bg-success-subtle-dark">
            <div className="font-semibold text-success flex items-center gap-1.5">
              <Icon name="check_circle" className="text-[18px]" />
              <span>Délibération globale terminée avec succès !</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-caption font-mono text-ink-primary dark:text-white">
              <div>Classes traitées : <strong>{centerWideReport.totalClasses}</strong></div>
              <div>Apprenants évalués : <strong>{centerWideReport.totalStudents}</strong></div>
              <div>Admis (Niv+1) : <strong className="text-success">{centerWideReport.totalAdmis}</strong></div>
              <div>Diplômés : <strong className="text-brand-900 dark:text-brand-500">{centerWideReport.totalDiplomes}</strong></div>
              <div>Redoublants : <strong className="text-error">{centerWideReport.totalRedoublants}</strong></div>
              <div>Ajournés : <strong className="text-warning">{centerWideReport.totalAjournes}</strong></div>
            </div>
          </div>
        )}
      </Modal>

      <DocumentViewerModal
        isOpen={Boolean(pdfModal)}
        title={pdfModal?.title}
        previewUrl={pdfModal?.previewUrl}
        downloadUrl={pdfModal?.downloadUrl}
        isReused={pdfModal?.reused}
        onForceRegenerate={() => {
          if (pdfModal?.pvType === "cc") handlePrintPvContinuousAssessment(true);
          else handlePrintPvDeliberation(true);
        }}
        onClose={() => setPdfModal(null)}
      />
    </motion.div>
  );
}