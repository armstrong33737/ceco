// packages/frontend/src/pages/pedagogie/BulletinsView.jsx
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import useAuthStore from "../../store/authStore";
import Icon from "../../components/Icon";
import PdfViewerModal from "../../components/PdfViewerModal";

const inputCls = "h-9 rounded-md bg-surface px-2.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary w-full";

const DOCUMENT_TYPES = [
  { key: "BULLETIN_SEMESTRE", label: "Bulletin Semestriel Bilingue (S1 / S2)", icon: "receipt_long", scope: "SEMESTRE" },
  { key: "BULLETIN_CC", label: "Bulletin de Contrôle Continu (CC & TP)", icon: "fact_check", scope: "SEMESTRE" },
  { key: "RELEVE_ANNUEL", label: "Relevé de Notes Annuel (Transcript)", icon: "history_edu", scope: "ANNUEL" },
  { key: "DIPLOME_FIN_FORMATION", label: "Diplôme de Fin de Formation (Paysage)", icon: "workspace_premium", scope: "ANNUEL" },
  { key: "ATTESTATION_INSCRIPTION", label: "Certificat de Scolarité", icon: "verified", scope: "ANY" },
];

export default function BulletinsView() {
  const { hasPermission } = useAuthStore();
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

  // 1. Chargement initial des sessions et classes
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

  // 2. Classes filtrées selon la session
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

  // Période semestrielle active selon le semestre choisi (S1 ou S2)
  const currentPeriod = useMemo(() => {
    const selectedDocMeta = DOCUMENT_TYPES.find((d) => d.key === docType);
    if (selectedDocMeta?.scope === "ANNUEL") {
      return periods.find((p) => p.type === "ANNUEL") || periods[0];
    }
    return periods.find((p) => p.type === "SEMESTRE" && p.order === selectedSemesterOrder) || periods[0];
  }, [periods, docType, selectedSemesterOrder]);

  // 3. Chargement des notes & résultats délibérés de la classe
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

  // Génération individuelle d'un acte
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
        reused: res.reused,
      });
    } catch (err) {
      setError(err.message || "Échec de génération du document.");
    } finally {
      setGeneratingStudentId(null);
    }
  }

  // Génération groupée pour toute la classe en 1 clic (Livret complet)
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

  // Filtrage des apprenants éligibles pour les diplômes (Lauréats)
  const displayStudents = useMemo(() => {
    const list = delibData?.results || [];
    if (docType === "DIPLOME_FIN_FORMATION") {
      return list.filter((s) => s.decision === "diplome" || s.decision === "admis" || (s.moyenne !== null && s.moyenne >= 10.0));
    }
    return list;
  }, [delibData, docType]);

  return (
    <div className="space-y-md">
      {/* Barre de contrôle et sélection séquentielle */}
      <div className="bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2">
          <div>
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Icon name="receipt_long" className="text-primary text-[20px]" />
              <span>Édition des Bulletins Périodiques, Relevés &amp; Diplômes (V4)</span>
            </h3>
            <p className="text-xs text-on-surface-variant">
              Extraction des résultats délibérés, certification QR Code autonome hors-ligne et impression par classe en 1 clic.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateBatchPdf}
              disabled={generating || !selectedClassId || displayStudents.length === 0}
              className="px-4 py-2 rounded-md text-xs font-bold bg-primary text-white hover:bg-primary-dark shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
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

        {/* Sélecteur de type d'acte à émettre */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1.5">
            Type d'acte académique à générer
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {DOCUMENT_TYPES.map((dt) => (
              <button
                key={dt.key}
                type="button"
                onClick={() => setDocType(dt.key)}
                className={`p-2 rounded-md text-xs font-bold text-center border transition-all flex flex-col items-center gap-1 ${
                  docType === dt.key
                    ? "bg-primary text-white border-primary shadow-xs"
                    : "bg-surface text-on-surface-variant border-outline-variant/30 hover:bg-surface-container/60"
                }`}
              >
                <Icon name={dt.icon} className="text-[18px]" />
                <span className="text-[11px] truncate w-full">{dt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filtres Session, Classe et Semestre */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center pt-1 border-t border-outline-variant/15">
          {/* 1. Session */}
          <div>
            <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">1. Session Académique</label>
            <select
              value={selectedYearId}
              onChange={(e) => {
                setSelectedYearId(e.target.value);
                const yr = academicYears.find((y) => y.id === e.target.value);
                if (yr) setPeriods(yr.gradePeriods || []);
              }}
              className={inputCls}
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label} {y.isCurrent ? "(Active)" : y.status === "CLOSED" ? "(🔒 Clôturée)" : "(Préparatoire)"}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Classe avec recherche */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">2. Classe</label>
              <input
                type="text"
                placeholder="Filtrer classe..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="text-[9px] px-1.5 py-0.5 rounded border outline-none w-24 bg-surface"
              />
            </div>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className={inputCls}>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.label} ({c._count?.inscriptions || 0} élèves)</option>
              ))}
            </select>
          </div>

          {/* 3. Période / Semestre */}
          <div>
            <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">3. Période Évaluée</label>
            {docType === "RELEVE_ANNUEL" || docType === "DIPLOME_FIN_FORMATION" ? (
              <div className="h-9 flex items-center px-3 rounded-md bg-surface border border-outline-variant/30 text-xs font-mono font-bold text-primary">
                Année Complète (S1 + S2)
              </div>
            ) : (
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
            )}
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-error-container text-error text-xs rounded-md font-semibold">{error}</div>}
      {successMsg && <div className="p-3 bg-success-light text-success text-xs rounded-md font-semibold">{successMsg}</div>}

      {/* Tableau des Apprenants et Actions d'Impression */}
      <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-3">
        <div className="p-md border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-on-surface">
                {selectedClass?.label || "Classe"} — {displayStudents.length} apprenant(s) éligible(s)
              </h4>
              {docType === "DIPLOME_FIN_FORMATION" && (
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-bold text-[10px] border border-amber-300">
                  {isFinalYear ? "Promotion Diplômante" : "Niveau Intermédiaire"}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Filière : {selectedClass?.filiere?.name} • Session : {selectedYear?.label}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-on-surface-variant">Certification :</span>
            <span className="font-bold text-success flex items-center gap-1">
              <Icon name="qr_code_2" className="text-[16px]" />
              <span>QR Code Autonome Hors-Ligne</span>
            </span>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-on-surface-variant text-center py-8">Chargement des données de classe...</p>
        ) : displayStudents.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs text-on-surface-variant">
              {docType === "DIPLOME_FIN_FORMATION"
                ? "Aucun lauréat diplômé n'a été trouvé pour cette classe."
                : "Aucun résultat disponible pour cette sélection."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b font-bold uppercase text-on-surface-variant bg-surface">
                  <th className="px-3 py-2.5 w-14 text-center">Rang</th>
                  <th className="px-3 py-2.5 w-28">Matricule</th>
                  <th className="px-3 py-2.5">Nom &amp; Prénom</th>
                  <th className="px-3 py-2.5 w-28 text-center">Moyenne</th>
                  <th className="px-3 py-2.5 w-32 text-center">Statut / Décision</th>
                  <th className="px-3 py-2.5 text-right">Action d'Émission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {displayStudents.map((st) => {
                  const isCurrentGenerating = generatingStudentId === (st.studentId || st.id);

                  return (
                    <tr key={st.studentId || st.id} className="hover:bg-surface-container/20">
                      <td className="px-3 py-2 text-center font-mono font-bold text-primary">
                        {st.rang ? `${st.rang}e` : st.calculatedRank ? `${st.calculatedRank}e` : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-primary">{st.matricule}</td>
                      <td className="px-3 py-2 font-semibold text-on-surface">{st.lastName} {st.firstName}</td>

                      <td className="px-3 py-2 text-center font-mono font-bold bg-primary-light text-primary">
                        {st.moyenne !== null && st.moyenne !== undefined ? `${st.moyenne} / 20` : "—"}
                      </td>

                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase border ${
                          st.decision === "admis" || st.decision === "diplome" || st.decision === "valide"
                            ? "bg-success-light text-success border-success/20"
                            : "bg-error-container text-error border-error/20"
                        }`}>
                          {st.decision || "en_attente"}
                        </span>
                      </td>

                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleGenerateSinglePdf(st, false)}
                          disabled={isCurrentGenerating}
                          className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary-light border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-xs inline-flex items-center gap-1 disabled:opacity-50"
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

      {/* Visionneuse PDF Unifiée avec QR Code Hors-Ligne */}
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