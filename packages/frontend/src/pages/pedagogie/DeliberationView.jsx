// packages/frontend/src/pages/pedagogie/DeliberationView.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import Icon from "../../components/Icon";
import PdfViewerModal from "../../components/PdfViewerModal";

export default function DeliberationView() {
  const [classes, setClasses] = useState([]);
  const [classSearch, setClassSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [scope, setScope] = useState("ANNUEL");
  const [juryDate, setJuryDate] = useState(new Date().toISOString().split("T")[0]);

  // Sous-onglets de délibération
  const [delibTab, setDelibTab] = useState("tableau"); // "tableau" | "ajournes"

  const [delibData, setDelibData] = useState(null);
  const [studentDecisions, setStudentDecisions] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Délibération globale tout l'établissement
  const [centerWideModal, setCenterWideModal] = useState(false);
  const [runningCenterWide, setRunningCenterWide] = useState(false);
  const [centerWideReport, setCenterWideReport] = useState(null);

  const [error, setError] = useState(null);

  // Visionneuse PDF
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
    }).catch((e) => setError(e.message));
  }, [scope]);

  const filteredClasses = useMemo(() => {
    if (!classSearch.trim()) return classes;
    return classes.filter((c) => c.label.toLowerCase().includes(classSearch.toLowerCase()));
  }, [classes, classSearch]);

  function loadDeliberation() {
    if (!selectedClassId || !selectedPeriodId) return;
    setLoading(true);
    setError(null);
    apiFetch(`/deliberations?classeId=${selectedClassId}&gradePeriodId=${selectedPeriodId}&scope=${scope}`)
      .then((data) => {
        setDelibData(data);
        if (data.juryDate) setJuryDate(new Date(data.juryDate).toISOString().split("T")[0]);

        const decisionsMap = {};
        data.results?.forEach((st) => {
          decisionsMap[st.studentId] = {
            decision: st.decision || (scope === "ANNUEL" ? "redouble" : "ajourne"),
            moyenne: st.moyenne,
            rang: st.rang || st.calculatedRank,
          };
        });
        setStudentDecisions(decisionsMap);
      })
      .catch((e) => setError(e.message))
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
    setError(null);
    try {
      const res = await apiFetch("/deliberations/center-wide-run", {
        method: "POST",
        body: JSON.stringify({
          scope,
          juryDate,
        }),
      });
      setCenterWideReport(res.report);
      showToast(res.message, "success");
      loadDeliberation();
    } catch (err) {
      showToast(err.message || "Erreur lors de la délibération globale.", "error");
    } finally {
      setRunningCenterWide(false);
    }
  }

  async function handleSaveManualDeliberation() {
    setSaving(true);
    setError(null);
    try {
      const payloadResults = Object.entries(studentDecisions).map(([studentId, d]) => ({
        studentId,
        moyenne: d.moyenne,
        rang: d.rang,
        decision: d.decision,
      }));

      await apiFetch("/deliberations/run", {
        method: "POST",
        body: JSON.stringify({
          classeId: selectedClassId,
          gradePeriodId: selectedPeriodId,
          scope,
          juryDate,
          results: payloadResults,
        }),
      });

      showToast("Délibération enregistrée et statuts officiellement scellés.", "success");
      loadDeliberation();
    } catch (err) {
      showToast(err.message || "Erreur lors du scellement.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrintPvLandscape(forceRegenerate = false) {
    try {
      const res = await apiFetch(`/grades/classes/${selectedClassId}/semester-sheet`, {
        method: "POST",
        body: JSON.stringify({ gradePeriodId: selectedPeriodId, forceRegenerate }),
      });
      const token = getToken();
      setPdfModal({
        title: `PV de Délibération (A4 Paysage) — ${delibData?.classe?.label}`,
        previewUrl: `${API_BASE}${res.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.downloadUrl}?token=${token}`,
        periodId: selectedPeriodId,
        reused: res.reused,
      });
    } catch (err) {
      showToast(err.message || "Erreur lors de l'édition du PV.", "error");
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
        return {
          ...st,
          currentDecision: studentDecisions[st.studentId]?.decision || st.decision,
          failedSubjects,
        };
      })
      .filter((st) => st.failedSubjects.length > 0 || st.currentDecision === "ajourne" || st.currentDecision === "redouble");
  }, [delibData, studentDecisions]);

  return (
    <div className="space-y-4">
      {/* 1. En-tête et Filtres Sélectifs */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Icon name="gavel" className="text-blue-700 text-[20px]" />
              <span>Session de Délibération Souveraine du Jury</span>
            </h3>
            <p className="text-xs text-slate-500">
              Arbitrage des résultats, application des seuils éliminatoires et scellement des admissions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCenterWideReport(null); setCenterWideModal(true); }}
              className="btn-primary"
            >
              <Icon name="bolt" className="text-[16px]" />
              <span>Délibérer Tout l'Établissement (1 Clic)</span>
            </button>

            <div className="flex p-0.5 bg-slate-100 rounded border border-slate-200 h-9">
              <button
                type="button"
                onClick={() => setScope("ANNUEL")}
                className={`px-3 rounded text-xs font-bold transition-all ${
                  scope === "ANNUEL" ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Annuelle
              </button>
              <button
                type="button"
                onClick={() => setScope("SEMESTRE")}
                className={`px-3 rounded text-xs font-bold transition-all ${
                  scope === "SEMESTRE" ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semestrielle
              </button>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase">Classe</label>
              <input
                type="text"
                placeholder="Rechercher..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="text-[9px] px-1.5 py-0.5 rounded border border-slate-300 outline-none w-24 bg-slate-50 focus:bg-white"
              />
            </div>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="input-field w-full">
              {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Période</label>
            <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)} className="input-field w-full">
              {periods.filter((p) => (scope === "ANNUEL" ? p.type === "ANNUEL" : p.type === "SEMESTRE")).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Date du Jury</label>
            <input type="date" value={juryDate} onChange={(e) => setJuryDate(e.target.value)} className="input-field w-full" />
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-semibold">{error}</div>}

      {/* 2. Badges de Synthèse */}
      {delibData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {scope === "ANNUEL" ? (
            <>
              <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Admis (Niveau Sup.)</span>
                <span className="badge-emerald font-mono font-bold text-xs">{summaryStats.admis}</span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Diplômés (Lauréats)</span>
                <span className="badge-blue font-mono font-bold text-xs">{summaryStats.diplome}</span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Ajournés (Rattrapage)</span>
                <span className="badge-amber font-mono font-bold text-xs">{summaryStats.ajourne}</span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Redoublants</span>
                <span className="badge-rose font-mono font-bold text-xs">{summaryStats.redouble}</span>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Semestres Validés ($\ge$10)</span>
                <span className="badge-emerald font-mono font-bold text-xs">{summaryStats.valide}</span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Ajournés (&lt;10)</span>
                <span className="badge-amber font-mono font-bold text-xs">{summaryStats.ajourne}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. Barre d'onglets interne */}
      <div className="flex gap-1 p-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => setDelibTab("tableau")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            delibTab === "tableau" ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Icon name="table_chart" className="text-[16px]" />
          <span>Tableau Synoptique du Jury</span>
        </button>

        <button
          type="button"
          onClick={() => setDelibTab("ajournes")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            delibTab === "ajournes" ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Icon name="rule" className="text-[16px]" />
          <span>Relevé des Ajournements ({failedStudentsDetails.length})</span>
        </button>
      </div>

      {/* 4. Table Synoptique */}
      {loading ? (
        <p className="text-xs text-slate-500 text-center py-8">Calcul des résultats en cours...</p>
      ) : delibData && (
        <>
          {delibTab === "tableau" && (
            <div className="table-container space-y-3">
              <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      {delibData.classe?.label} — Délibération {scope === "ANNUEL" ? "Annuelle (Cumul S1 + S2)" : delibData.period?.label}
                    </h4>
                    <span className={delibData.isDeliberated ? "badge-emerald" : "badge-amber"}>
                      {delibData.isDeliberated ? "Scellé en Base" : "Brouillon en Cours"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {delibData.results?.length || 0} apprenant(s) évalué(s) • Seuil de validation : 10.00 / 20
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintPvLandscape(false)}
                    className="btn-secondary text-[11px]"
                  >
                    <Icon name="print" className="text-[16px]" />
                    <span>Imprimer PV Paysage</span>
                  </button>

                  <button
                    onClick={handleSaveManualDeliberation}
                    disabled={saving}
                    className="btn-primary"
                  >
                    <Icon name="lock" className="text-[16px]" />
                    <span>{saving ? "Scellement..." : "Valider & Sceller"}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr>
                      <th className="table-header-cell w-14 text-center">Rang</th>
                      <th className="table-header-cell w-28">Matricule</th>
                      <th className="table-header-cell">Apprenant</th>
                      <th className="table-header-cell w-32 text-center">Total Points</th>
                      <th className="table-header-cell w-28 text-center bg-blue-50 text-blue-700 font-bold">Moyenne Générale</th>
                      <th className="table-header-cell w-36 text-center">Alerte Éliminatoire</th>
                      <th className="table-header-cell w-44">Décision Souveraine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delibData.results?.map((st) => {
                      const currentDec = studentDecisions[st.studentId]?.decision || (scope === "ANNUEL" ? "redouble" : "ajourne");

                      return (
                        <tr key={st.studentId} className="table-body-row">
                          <td className="table-body-cell text-center font-mono font-bold text-blue-700">
                            {st.rang ? `${st.rang}e` : `${st.calculatedRank}e`}
                          </td>
                          <td className="table-body-cell font-mono font-bold text-blue-700">{st.matricule}</td>
                          <td className="table-body-cell font-semibold text-slate-900">{st.lastName} {st.firstName}</td>
                          <td className="table-body-cell text-center font-mono">
                            {st.totalPoints} / {st.totalCoeffs * 20} pts
                          </td>

                          <td className="table-body-cell text-center font-mono font-bold bg-blue-50 text-blue-700 text-sm">
                            {st.moyenne !== null ? `${st.moyenne} / 20` : "—"}
                          </td>

                          <td className="table-body-cell text-center">
                            {st.hasEliminatoryGrade ? (
                              <span className="badge-rose">
                                Note &lt; 08 (Spécialité)
                              </span>
                            ) : (
                              <span className="badge-emerald">Conforme</span>
                            )}
                          </td>

                          <td className="table-body-cell" onClick={(e) => e.stopPropagation()}>
                            {scope === "ANNUEL" ? (
                              <select
                                value={currentDec}
                                onChange={(e) => handleDecisionChange(st.studentId, e.target.value)}
                                className="input-field font-bold text-xs h-8"
                              >
                                <option value="admis">Admis (Niveau Supérieur)</option>
                                <option value="diplome">Diplômé (Fin de cycle)</option>
                                <option value="ajourne">Ajourné (Rattrapage)</option>
                                <option value="redouble">Redouble (Même niveau)</option>
                                <option value="exclu">Exclu (Disciplinaire)</option>
                              </select>
                            ) : (
                              <select
                                value={currentDec}
                                onChange={(e) => handleDecisionChange(st.studentId, e.target.value)}
                                className="input-field font-bold text-xs h-8"
                              >
                                <option value="valide">Semestre Validé ($\ge$ 10.00)</option>
                                <option value="ajourne">Semestre Ajourné (&lt; 10.00)</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Relevé des Ajournements */}
          {delibTab === "ajournes" && (
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-card flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-slate-900">Apprenants Ajournés &amp; Disciplines à Rattraper</h4>
                  <p className="text-xs text-slate-500">Matières sous le seuil d'admission (&lt; 10.00) ou éliminatoires (&lt; 08.00).</p>
                </div>
                <span className="badge-amber font-mono font-bold text-xs">
                  {failedStudentsDetails.length} apprenant(s)
                </span>
              </div>

              {failedStudentsDetails.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-lg border border-slate-200 text-xs text-emerald-700 font-bold">
                  ✓ Aucun apprenant ajourné : toute la classe est au-dessus du seuil de validation.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {failedStudentsDetails.map((st) => (
                    <div key={st.studentId} className="bg-white p-4 rounded-lg border border-slate-200 shadow-card space-y-2">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700">{st.matricule}</span>
                          <span className="font-bold text-sm text-slate-900">{st.lastName} {st.firstName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="badge-blue font-mono font-bold">
                            Moyenne : {st.moyenne}/20
                          </span>
                          <span className="badge-amber uppercase">
                            {st.currentDecision}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <span className="text-[11px] font-bold text-slate-600 block">Disciplines à rattraper :</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                          {st.failedSubjects.map((sub, sidx) => (
                            <div key={sidx} className="p-2 rounded bg-slate-50 border border-slate-200 text-xs flex justify-between items-center">
                              <div>
                                <div className="font-bold text-slate-900">{sub.subjectName}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {sub.categoryName} • Coef {sub.coefficient}
                                </div>
                              </div>
                              <div className="text-right font-mono">
                                <span className={`font-bold ${sub.grade < 8.0 ? "text-rose-600" : "text-amber-700"}`}>
                                  {sub.grade !== null ? `${sub.grade} / 20` : "Non noté"}
                                </span>
                                {sub.grade < 8.0 && (
                                  <div className="text-[9px] text-rose-600 font-bold">Éliminatoire</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 5. MODALES */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* MODALE DÉLIBÉRATION GLOBALE */}
          {centerWideModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-white p-5 rounded-xl shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="bolt" className="text-blue-700 text-[22px]" />
                    <h3 className="text-sm font-bold text-slate-900">Délibération de Tout l'Établissement</h3>
                  </div>
                  <button onClick={() => setCenterWideModal(false)} className="text-slate-400 hover:text-slate-700"><Icon name="close" className="text-[18px]" /></button>
                </div>

                {!centerWideReport ? (
                  <div className="space-y-3 text-xs">
                    <p className="text-slate-600 leading-relaxed">
                      Cette opération va calculer automatiquement les moyennes et attribuer les décisions pour <strong>toutes les classes de la session active</strong> ({classes.length} classes).
                    </p>
                    <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-800 space-y-1 font-mono text-xs">
                      <div><strong>Portée :</strong> {scope === "ANNUEL" ? "Délibération Annuelle (Mise à jour des statuts)" : "Délibération Semestrielle"}</div>
                      <div><strong>Date du Jury :</strong> {juryDate}</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2 text-xs">
                    <div className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                      <Icon name="check_circle" className="text-[20px]" />
                      <span>Délibération globale terminée avec succès !</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 font-mono text-slate-800">
                      <div>Classes traitées : <strong>{centerWideReport.totalClasses}</strong></div>
                      <div>Apprenants évalués : <strong>{centerWideReport.totalStudents}</strong></div>
                      <div>Admis (Niv+1) : <strong className="text-emerald-700">{centerWideReport.totalAdmis}</strong></div>
                      <div>Diplômés : <strong className="text-blue-700">{centerWideReport.totalDiplomes}</strong></div>
                      <div>Redoublants : <strong className="text-rose-600">{centerWideReport.totalRedoublants}</strong></div>
                      <div>Ajournés : <strong className="text-amber-700">{centerWideReport.totalAjournes}</strong></div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setCenterWideModal(false)} className="btn-secondary">
                    {centerWideReport ? "Fermer" : "Annuler"}
                  </button>
                  {!centerWideReport && (
                    <button
                      onClick={handleExecuteCenterWideDeliberation}
                      disabled={runningCenterWide}
                      className="btn-primary"
                    >
                      <Icon name="bolt" className="text-[16px]" />
                      <span>{runningCenterWide ? "Calcul en cours..." : "Lancer pour tout le centre"}</span>
                    </button>
                  )}
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
            onForceRegenerate={() => handlePrintPvLandscape(true)}
            onClose={() => setPdfModal(null)}
          />
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}