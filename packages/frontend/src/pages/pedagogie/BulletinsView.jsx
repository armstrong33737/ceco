// packages/frontend/src/pages/pedagogie/BulletinsView.jsx
import { useEffect, useState, useMemo } from "react";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import Icon from "../../components/Icon";
import PdfViewerModal from "../../components/PdfViewerModal";

const DOCUMENT_TYPES = [
  { key: "BULLETIN_SEMESTRE", label: "Bulletin Semestriel Bilingue", icon: "receipt_long", scope: "SEMESTRE" },
  { key: "BULLETIN_CC", label: "Bulletin d'Évaluation Continue (CC)", icon: "fact_check", scope: "SEMESTRE" },
  { key: "RELEVE_ANNUEL", label: "Relevé de Notes Annuel (Transcript)", icon: "history_edu", scope: "ANNUEL" },
  { key: "DIPLOME_FIN_FORMATION", label: "Diplôme de Fin de Formation (Paysage)", icon: "workspace_premium", scope: "ANNUEL" },
  { key: "ATTESTATION_INSCRIPTION", label: "Certificat de Scolarité", icon: "verified", scope: "ANY" },
];

export default function BulletinsView() {
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [classes, setClasses] = useState([]);
  const [classSearch, setClassSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");

  const [docType, setDocType] = useState("BULLETIN_SEMESTRE");
  const [selectedSemesterOrder, setSelectedSemesterOrder] = useState(1);
  const [periods, setPeriods] = useState([]);

  const [delibData, setDelibData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingStudentId, setGeneratingStudentId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Visionneuse PDF
  const [pdfModal, setPdfModal] = useState(null);

  useEffect(() => {
    Promise.all([apiFetch("/academic-years"), apiFetch("/classes")])
      .then(([years, clsList]) => {
        setAcademicYears(years || []);
        const activeYear = years?.find((y) => y.isCurrent) || years?.[0];
        if (activeYear) {
          setSelectedYearId(activeYear.id);
          setPeriods(activeYear.gradePeriods || []);
        }
        setClasses(clsList || []);
      })
      .catch((e) => setError(e.message));
  }, []);

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
      setDelibData(null);
    }
  }, [filteredClasses]);

  const currentPeriod = useMemo(() => {
    const selectedDocMeta = DOCUMENT_TYPES.find((d) => d.key === docType);
    if (selectedDocMeta?.scope === "ANNUEL") {
      return periods.find((p) => p.type === "ANNUEL") || periods[0];
    }
    return periods.find((p) => p.type === "SEMESTRE" && p.order === selectedSemesterOrder) || periods[0];
  }, [periods, docType, selectedSemesterOrder]);

  function loadClassResults() {
    if (!selectedClassId || !currentPeriod) return;
    setLoading(true);
    setError(null);
    const scope = docType === "RELEVE_ANNUEL" || docType === "DIPLOME_FIN_FORMATION" ? "ANNUEL" : "SEMESTRE";
    apiFetch(`/deliberations?classeId=${selectedClassId}&gradePeriodId=${currentPeriod.id}&scope=${scope}`)
      .then((data) => setDelibData(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadClassResults();
  }, [selectedClassId, currentPeriod, docType]);

  async function handleGenerateSinglePdf(student, forceRegenerate = false) {
    setGeneratingStudentId(student.studentId || student.id);
    setError(null);
    try {
      const res = await apiFetch("/documents/generate", {
        method: "POST",
        body: JSON.stringify({
          studentId: student.studentId || student.id,
          classeId: selectedClassId,
          gradePeriodId: currentPeriod?.id,
          type: docType,
          forceRegenerate,
        }),
      });

      const token = getToken();
      const docLabel = DOCUMENT_TYPES.find((d) => d.key === docType)?.label || "Document";

      setPdfModal({
        title: `${docLabel} — ${student.lastName} ${student.firstName}`,
        previewUrl: `${API_BASE}${res.document.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.document.downloadUrl}?token=${token}`,
        student,
        type: docType,
        reused: res.reused,
      });
    } catch (err) {
      setError(err.message || "Échec de génération du document.");
    } finally {
      setGeneratingStudentId(null);
    }
  }

  async function handleGenerateBatchPdf() {
    if (!selectedClassId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await apiFetch("/documents/generate-batch", {
        method: "POST",
        body: JSON.stringify({
          classeId: selectedClassId,
          type: docType,
          gradePeriodId: currentPeriod?.id,
        }),
      });

      const token = getToken();
      const docLabel = DOCUMENT_TYPES.find((d) => d.key === docType)?.label || "Document";

      setPdfModal({
        title: `Livret de Classe (${res.count} documents) — ${delibData?.classe?.label || "Classe"} [${docLabel}]`,
        previewUrl: `${API_BASE}${res.batchDocument.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.batchDocument.downloadUrl}?token=${token}`,
      });
      setSuccessMsg(`Livret de ${res.count} documents compilé avec succès.`);
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setError(err.message || "Échec de génération du livret groupé.");
    } finally {
      setGenerating(false);
    }
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedYear = academicYears.find((y) => y.id === selectedYearId);
  const isFinalYear = delibData?.classe?.isFinalYear || (selectedClass?.niveau?.order >= selectedClass?.filiere?.durationInYears);

  const displayStudents = useMemo(() => {
    const list = delibData?.results || [];
    if (docType === "DIPLOME_FIN_FORMATION") {
      return list.filter((s) => s.decision === "diplome" || s.decision === "admis" || (s.moyenne !== null && s.moyenne >= 10.0));
    }
    return list;
  }, [delibData, docType]);

  return (
    <div className="space-y-4">
      {/* 1. Barre de Contrôle & Sélection */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Icon name="receipt_long" className="text-blue-700 text-[20px]" />
              <span>Édition des Bulletins Périodiques, Relevés &amp; Diplômes (V4)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Extraction des notes délibérées, certification QR Code autonome hors-ligne et impression de livrets de classe.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateBatchPdf}
              disabled={generating || !selectedClassId || displayStudents.length === 0}
              className="btn-primary"
            >
              {generating ? (
                <>
                  <Icon name="progress_activity" className="animate-spin text-[16px]" />
                  <span>Compilation du livret...</span>
                </>
              ) : (
                <>
                  <Icon name="print" className="text-[16px]" />
                  <span>Imprimer le Livret de Classe (A4)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sélecteur de type d'acte */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Type d'acte à générer
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {DOCUMENT_TYPES.map((dt) => (
              <button
                key={dt.key}
                type="button"
                onClick={() => setDocType(dt.key)}
                className={`p-2 rounded-lg text-xs font-bold text-center border transition-all flex flex-col items-center gap-1 ${
                  docType === dt.key
                    ? "bg-blue-700 text-white border-blue-700 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Icon name={dt.icon} className="text-[18px]" />
                <span className="text-[11px] truncate w-full">{dt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filtres Session, Classe et Semestre */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center pt-2 border-t border-slate-100">
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">1. Session</label>
            <select
              value={selectedYearId}
              onChange={(e) => {
                setSelectedYearId(e.target.value);
                const yr = academicYears.find((y) => y.id === e.target.value);
                if (yr) setPeriods(yr.gradePeriods || []);
              }}
              className="input-field w-full"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label} {y.isCurrent ? "(Active)" : y.status === "CLOSED" ? "(🔒 Clôturée)" : "(Préparatoire)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-600">2. Classe</label>
              <input
                type="text"
                placeholder="Filtrer classe..."
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
            <label className="text-[10px] font-bold text-slate-600 block mb-1">3. Période Évaluée</label>
            {docType === "RELEVE_ANNUEL" || docType === "DIPLOME_FIN_FORMATION" ? (
              <div className="h-9 flex items-center px-3 rounded bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-blue-700">
                Année Complète (S1 + S2)
              </div>
            ) : (
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
            )}
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-semibold">{error}</div>}
      {successMsg && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-semibold">{successMsg}</div>}

      {/* 2. Tableau des Apprenants & Actions d'Émission */}
      <div className="table-container space-y-3">
        <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                {selectedClass?.label || "Classe"} — {displayStudents.length} apprenant(s) éligible(s)
              </h4>
              {docType === "DIPLOME_FIN_FORMATION" && (
                <span className="badge-amber">
                  {isFinalYear ? "Promotion Diplômante" : "Niveau Intermédiaire"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Filière : {selectedClass?.filiere?.name} • Session : {selectedYear?.label}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-500">Certification :</span>
            <span className="badge-emerald font-bold">
              <Icon name="qr_code_2" className="text-[14px]" />
              <span>QR Code Autonome Hors-Ligne</span>
            </span>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500 text-center py-8">Chargement des données...</p>
        ) : displayStudents.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs text-slate-500">
              {docType === "DIPLOME_FIN_FORMATION"
                ? "Aucun lauréat diplômé n'a été trouvé pour cette classe."
                : "Aucun résultat disponible pour cette sélection."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell w-14 text-center">Rang</th>
                  <th className="table-header-cell w-28">Matricule</th>
                  <th className="table-header-cell">Nom &amp; Prénom</th>
                  <th className="table-header-cell w-28 text-center">Moyenne</th>
                  <th className="table-header-cell w-32 text-center">Statut / Décision</th>
                  <th className="table-header-cell text-right">Action d'Émission</th>
                </tr>
              </thead>
              <tbody>
                {displayStudents.map((st) => {
                  const isCurrentGenerating = generatingStudentId === (st.studentId || st.id);

                  return (
                    <tr key={st.studentId || st.id} className="table-body-row">
                      <td className="table-body-cell text-center font-mono font-bold text-blue-700">
                        {st.rang ? `${st.rang}e` : st.calculatedRank ? `${st.calculatedRank}e` : "—"}
                      </td>
                      <td className="table-body-cell font-mono font-bold text-blue-700">{st.matricule}</td>
                      <td className="table-body-cell font-semibold text-slate-900">{st.lastName} {st.firstName}</td>

                      <td className="table-body-cell text-center font-mono font-bold bg-blue-50 text-blue-700">
                        {st.moyenne !== null && st.moyenne !== undefined ? `${st.moyenne} / 20` : "—"}
                      </td>

                      <td className="table-body-cell text-center">
                        <span className={
                          st.decision === "admis" || st.decision === "diplome" || st.decision === "valide"
                            ? "badge-emerald uppercase"
                            : "badge-rose uppercase"
                        }>
                          {st.decision || "en_attente"}
                        </span>
                      </td>

                      <td className="table-body-cell text-right">
                        <button
                          onClick={() => handleGenerateSinglePdf(st, false)}
                          disabled={isCurrentGenerating}
                          className="btn-secondary text-[11px] text-blue-700 border-blue-200 hover:bg-blue-50"
                        >
                          {isCurrentGenerating ? (
                            <>
                              <Icon name="progress_activity" className="animate-spin text-[14px]" />
                              <span>Émission...</span>
                            </>
                          ) : (
                            <>
                              <Icon name="visibility" className="text-[14px]" />
                              <span>Consulter l'Acte</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Visionneuse PDF Unifiée */}
      <PdfViewerModal
        isOpen={Boolean(pdfModal)}
        title={pdfModal?.title}
        previewUrl={pdfModal?.previewUrl}
        downloadUrl={pdfModal?.downloadUrl}
        isReused={pdfModal?.reused}
        onForceRegenerate={pdfModal?.student ? () => handleGenerateSinglePdf(pdfModal.student, true) : null}
        onClose={() => setPdfModal(null)}
      />
    </div>
  );
}