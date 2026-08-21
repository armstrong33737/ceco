// packages/frontend/src/pages/pedagogie/DeliberationView.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import Icon from "../../components/Icon";
import PdfViewerModal from "../../components/PdfViewerModal";

const selectCls = "h-9 rounded-md bg-surface px-2.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary w-full";

export default function DeliberationView() {
  const [classes, setClasses] = useState([]);
  const [classSearch, setClassSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [scope, setScope] = useState("ANNUEL"); // "ANNUEL" | "SEMESTRE"
  const [juryDate, setJuryDate] = useState(new Date().toISOString().split("T")[0]);

  // Sous-onglets de délibération
  const [delibTab, setDelibTab] = useState("tableau"); // "tableau" | "ajournes"

  const [delibData, setDelibData] = useState(null);
  const [studentDecisions, setStudentDecisions] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Délibération globale tout le centre
  const [centerWideModal, setCenterWideModal] = useState(false);
  const [runningCenterWide, setRunningCenterWide] = useState(false);
  const [centerWideReport, setCenterWideReport] = useState(null);

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Visionneuse PDF
  const [pdfModal, setPdfModal] = useState(null);

  // 1. Charge les classes de la session active uniquement
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

  // Délibération automatique globale de tout l'établissement en 1 clic
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
      setSuccessMsg(res.message);
      loadDeliberation();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningCenterWide(false);
    }
  }

  // Enregistrement souverain du jury
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

      setSuccessMsg("Délibération enregistrée et statuts officiellement scellés.");
      setTimeout(() => setSuccessMsg(""), 4000);
      loadDeliberation();
    } catch (err) {
      setError(err.message);
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
      setError(err.message);
    }
  }

  // Synthèse des décisions
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

  // Liste des apprenants ajournés avec leurs matières spécifiques en échec (< 10 ou éliminatoire < 8)
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
    <div className="space-y-md">
      {/* En-tête et filtres */}
      <div className="bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2">
          <div>
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Icon name="gavel" className="text-primary text-[18px]" />
              <span>Session de Délibération Pédagogique (Session Active)</span>
            </h3>
            <p className="text-xs text-on-surface-variant">
              Arbitrage des résultats, application des règles d'admission annuelle et relevé des rattrapages.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCenterWideReport(null); setCenterWideModal(true); }}
              className="px-3.5 py-1.5 rounded-md text-xs font-bold bg-primary text-white hover:bg-primary-dark transition-all shadow-xs flex items-center gap-1.5"
            >
              <Icon name="bolt" className="text-[16px]" />
              <span>Délibérer Tout l'Établissement (1 Clic)</span>
            </button>

            <div className="flex p-0.5 bg-surface rounded-md border border-outline-variant/30 h-9">
              <button
                type="button"
                onClick={() => setScope("ANNUEL")}
                className={`px-3 rounded text-xs font-bold transition-all ${
                  scope === "ANNUEL" ? "bg-primary text-white shadow-xs" : "text-on-surface-variant"
                }`}
              >
                Annuelle (Fin de Session)
              </button>
              <button
                type="button"
                onClick={() => setScope("SEMESTRE")}
                className={`px-3 rounded text-xs font-bold transition-all ${
                  scope === "SEMESTRE" ? "bg-primary text-white shadow-xs" : "text-on-surface-variant"
                }`}
              >
                Semestrielle
              </button>
            </div>
          </div>
        </div>

        {/* Filtres Classes Actives */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Classe (Session Active)</label>
              <input
                type="text"
                placeholder="Rechercher..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="text-[9px] px-1.5 py-0.5 rounded border outline-none w-24 bg-surface"
              />
            </div>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className={selectCls}>
              {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">Période</label>
            <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)} className={selectCls}>
              {periods.filter((p) => (scope === "ANNUEL" ? p.type === "ANNUEL" : p.type === "SEMESTRE")).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">Date du Jury</label>
            <input type="date" value={juryDate} onChange={(e) => setJuryDate(e.target.value)} className={selectCls} />
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-error-container text-error text-xs rounded-md font-semibold">{error}</div>}
      {successMsg && <div className="p-3 bg-success-light text-success text-xs rounded-md font-semibold">{successMsg}</div>}

      {/* Badges de synthèse */}
      {delibData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {scope === "ANNUEL" ? (
            <>
              <div className="p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/30 flex justify-between items-center text-xs">
                <span className="font-semibold text-on-surface-variant">Admis (Niveau Sup.)</span>
                <span className="font-mono font-bold text-success text-sm">{summaryStats.admis}</span>
              </div>
              <div className="p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/30 flex justify-between items-center text-xs">
                <span className="font-semibold text-on-surface-variant">Diplômés (Lauréats)</span>
                <span className="font-mono font-bold text-primary text-sm">{summaryStats.diplome}</span>
              </div>
              <div className="p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/30 flex justify-between items-center text-xs">
                <span className="font-semibold text-on-surface-variant">Ajournés (Rattrapage)</span>
                <span className="font-mono font-bold text-amber-600 text-sm">{summaryStats.ajourne}</span>
              </div>
              <div className="p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/30 flex justify-between items-center text-xs">
                <span className="font-semibold text-on-surface-variant">Redoublants</span>
                <span className="font-mono font-bold text-error text-sm">{summaryStats.redouble}</span>
              </div>
            </>
          ) : (
            <>
              <div className="p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/30 flex justify-between items-center text-xs">
                <span className="font-semibold text-on-surface-variant">Semestres Validés (≥10)</span>
                <span className="font-mono font-bold text-success text-sm">{summaryStats.valide}</span>
              </div>
              <div className="p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/30 flex justify-between items-center text-xs">
                <span className="font-semibold text-on-surface-variant">Ajournés (Rattrapage)</span>
                <span className="font-mono font-bold text-amber-600 text-sm">{summaryStats.ajourne}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Barre d'onglets interne : Tableau Synoptique vs Volet des Ajournés */}
      <div className="flex gap-1.5 p-1 bg-surface-container-lowest rounded-md border border-outline-variant/30 shadow-xs">
        <button
          type="button"
          onClick={() => setDelibTab("tableau")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            delibTab === "tableau" ? "bg-primary text-white shadow-xs" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Icon name="table_chart" className="text-[16px]" />
          <span>Tableau Synoptique du Jury</span>
        </button>

        <button
          type="button"
          onClick={() => setDelibTab("ajournes")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            delibTab === "ajournes" ? "bg-primary text-white shadow-xs" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Icon name="rule" className="text-[16px]" />
          <span>Relevé des Ajournements &amp; Rattrapages ({failedStudentsDetails.length})</span>
        </button>
      </div>

      {/* CONTENU SELON L'ONGLET SÉLECTIONNÉ */}
      {loading ? (
        <p className="text-xs text-on-surface-variant text-center py-8">Calcul des résultats en cours...</p>
      ) : delibData && (
        <>
          {/* 1. TABLEAU SYNOPTIQUE DU JURY */}
          {delibTab === "tableau" && (
            <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-3">
              <div className="p-md border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-on-surface">
                      {delibData.classe?.label} — Délibération {scope === "ANNUEL" ? "Annuelle (Cumul S1 + S2)" : delibData.period?.label}
                    </h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      delibData.isDeliberated ? "bg-success-light text-success border border-success/20" : "bg-amber-100 text-amber-900 border border-amber-300"
                    }`}>
                      {delibData.isDeliberated ? "Scellé en Base" : "Brouillon en Cours"}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {delibData.results?.length || 0} apprenant(s) évalué(s) • Seuil de validation : 10.00 / 20
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintPvLandscape(false)}
                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-surface border border-outline-variant hover:bg-surface-container text-on-surface flex items-center gap-1 shadow-xs"
                  >
                    <Icon name="print" className="text-[16px]" />
                    <span>Imprimer PV Paysage</span>
                  </button>

                  <button
                    onClick={handleSaveManualDeliberation}
                    disabled={saving}
                    className="px-4 py-1.5 rounded-md text-xs font-bold bg-primary text-white hover:bg-primary-dark shadow-xs flex items-center gap-1.5"
                  >
                    <Icon name="lock" className="text-[16px]" />
                    <span>{saving ? "Scellement..." : "Valider & Sceller"}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b font-bold uppercase text-on-surface-variant bg-surface">
                      <th className="px-3 py-2.5 w-16 text-center">Rang</th>
                      <th className="px-3 py-2.5 w-28">Matricule</th>
                      <th className="px-3 py-2.5">Apprenant</th>
                      <th className="px-3 py-2.5 w-32 text-center">Total Points</th>
                      <th className="px-3 py-2.5 w-28 text-center bg-primary-light text-primary font-bold">Moyenne Générale</th>
                      <th className="px-3 py-2.5 w-36 text-center">Alerte Éliminatoire</th>
                      <th className="px-3 py-2.5 w-44">Décision du Jury</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/15">
                    {delibData.results?.map((st) => {
                      const currentDec = studentDecisions[st.studentId]?.decision || (scope === "ANNUEL" ? "redouble" : "ajourne");

                      return (
                        <tr key={st.studentId} className="hover:bg-surface-container/20">
                          <td className="px-3 py-2 text-center font-mono font-bold text-primary">
                            {st.rang ? `${st.rang}e` : `${st.calculatedRank}e`}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-primary">{st.matricule}</td>
                          <td className="px-3 py-2 font-semibold text-on-surface">{st.lastName} {st.firstName}</td>
                          <td className="px-3 py-2 text-center font-mono">
                            {st.totalPoints} / {st.totalCoeffs * 20} pts
                          </td>

                          <td className="px-3 py-2 text-center font-mono font-bold bg-primary-light text-primary text-sm">
                            {st.moyenne !== null ? `${st.moyenne} / 20` : "—"}
                          </td>

                          <td className="px-3 py-2 text-center">
                            {st.hasEliminatoryGrade ? (
                              <span className="px-2 py-0.5 rounded bg-error-container text-error font-bold text-[10px]">
                                Note &lt; 08 (Spécialité)
                              </span>
                            ) : (
                              <span className="text-success text-[11px] font-semibold">Conforme</span>
                            )}
                          </td>

                          <td className="px-3 py-2">
                            {scope === "ANNUEL" ? (
                              <select
                                value={currentDec}
                                onChange={(e) => handleDecisionChange(st.studentId, e.target.value)}
                                className="h-8 rounded bg-surface border border-outline-variant/40 px-2 text-xs font-bold"
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
                                className="h-8 rounded bg-surface border border-outline-variant/40 px-2 text-xs font-bold"
                              >
                                <option value="valide">Semestre Validé (≥ 10.00)</option>
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

          {/* 2. VOLET DES AJOURNEMENTS & RATTRAPAGES (DÉTAIL PAR APPRENANT) */}
          {delibTab === "ajournes" && (
            <div className="space-y-3">
              <div className="bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-sm text-on-surface">Apprenants Ajournés &amp; Matières à Rattraper</h4>
                  <p className="text-xs text-on-surface-variant">Liste des disciplines sous le seuil d'admission ($&lt; 10.00$) ou éliminatoires ($&lt; 08.00$).</p>
                </div>
                <span className="px-3 py-1 bg-amber-100 text-amber-950 font-bold font-mono rounded border border-amber-300">
                  {failedStudentsDetails.length} apprenant(s) concerné(s)
                </span>
              </div>

              {failedStudentsDetails.length === 0 ? (
                <div className="p-8 text-center bg-surface-container-lowest rounded-md border border-outline-variant/30 text-xs text-success font-bold">
                  ✓ Aucun apprenant ajourné : toute la classe est au-dessus du seuil de validation.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {failedStudentsDetails.map((st) => (
                    <div key={st.studentId} className="bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs space-y-2">
                      <div className="flex justify-between items-center border-b pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">{st.matricule}</span>
                          <span className="font-bold text-sm text-on-surface">{st.lastName} {st.firstName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-primary-light text-primary px-2 py-0.5 rounded">
                            Moyenne : {st.moyenne}/20
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-950 border border-amber-300">
                            {st.currentDecision}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-on-surface-variant block">Matières à composer au rattrapage :</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                          {st.failedSubjects.map((sub, sidx) => (
                            <div key={sidx} className="p-2 rounded bg-surface border border-outline-variant/30 text-xs flex justify-between items-center">
                              <div>
                                <div className="font-bold text-on-surface">{sub.subjectName}</div>
                                <div className="text-[10px] text-on-surface-variant font-mono">
                                  {sub.categoryName} • Coef {sub.coefficient}
                                </div>
                              </div>
                              <div className="text-right font-mono">
                                <span className={`font-bold ${sub.grade < 8.0 ? "text-error" : "text-amber-600"}`}>
                                  {sub.grade !== null ? `${sub.grade} / 20` : "Non noté"}
                                </span>
                                {sub.grade < 8.0 && (
                                  <div className="text-[9px] text-error font-bold">Éliminatoire</div>
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

      {/* PORTAIL DES MODALES SANS VIDE SUPÉRIEUR */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* 1. MODALE DÉLIBÉRATION GLOBALE TOUT LE CENTRE */}
          {centerWideModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-white p-md sm:p-lg rounded-md shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="bolt" className="text-primary text-[22px]" />
                    <h3 className="text-sm font-bold text-on-surface">Délibération de Tout l'Établissement</h3>
                  </div>
                  <button onClick={() => setCenterWideModal(false)} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>

                {!centerWideReport ? (
                  <div className="space-y-3 text-xs">
                    <p className="text-on-surface-variant leading-relaxed">
                      Cette opération va calculer automatiquement les moyennes et attribuer les décisions pour <strong>toutes les classes de la session active</strong> ({classes.length} classes).
                    </p>
                    <div className="p-3 bg-surface rounded border text-on-surface space-y-1 font-mono">
                      <div><strong>Portée :</strong> {scope === "ANNUEL" ? "Délibération Annuelle (Mise à jour des statuts)" : "Délibération Semestrielle"}</div>
                      <div><strong>Date du Jury :</strong> {juryDate}</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-success-light/40 border border-success/30 rounded-md space-y-2 text-xs">
                    <div className="font-bold text-success text-sm flex items-center gap-1.5">
                      <Icon name="check_circle" className="text-[20px]" />
                      <span>Délibération globale terminée avec succès !</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 font-mono text-on-surface">
                      <div>Classes traitées : <strong>{centerWideReport.totalClasses}</strong></div>
                      <div>Apprenants évalués : <strong>{centerWideReport.totalStudents}</strong></div>
                      <div>Admis (Niv+1) : <strong className="text-success">{centerWideReport.totalAdmis}</strong></div>
                      <div>Diplômés : <strong className="text-primary">{centerWideReport.totalDiplomes}</strong></div>
                      <div>Redoublants : <strong className="text-error">{centerWideReport.totalRedoublants}</strong></div>
                      <div>Ajournés : <strong className="text-amber-600">{centerWideReport.totalAjournes}</strong></div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={() => setCenterWideModal(false)} className="px-3 py-1.5 border rounded text-xs font-semibold">
                    {centerWideReport ? "Fermer" : "Annuler"}
                  </button>
                  {!centerWideReport && (
                    <button
                      onClick={handleExecuteCenterWideDeliberation}
                      disabled={runningCenterWide}
                      className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs flex items-center gap-1"
                    >
                      <Icon name="bolt" className="text-[16px]" />
                      <span>{runningCenterWide ? "Calcul en cours..." : "Lancer pour tout le centre"}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {/* 2. VISIONNEUSE PDF PAYSAGE HARMONIQUE */}
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