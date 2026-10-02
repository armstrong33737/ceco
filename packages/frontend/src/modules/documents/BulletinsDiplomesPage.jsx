// packages/frontend/src/modules/documents/BulletinsDiplomesPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
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
import DocumentViewerModal from "./components/DocumentViewerModal";
import Icon from "../../components/Icon";

const DOCUMENT_TYPES = [
  { key: "BULLETIN_SEMESTRE", label: "Bulletin Semestriel Bilingue (S1 / S2)", icon: "receipt_long", scope: "SEMESTRE", isBatch: true },
  { key: "BULLETIN_CC", label: "Bulletin de Contrôle Continu (CC & TP)", icon: "fact_check", scope: "SEMESTRE", isBatch: true },
  { key: "RELEVE_ANNUEL", label: "Relevé de Notes Annuel (Transcript)", icon: "history_edu", scope: "ANNUEL", isBatch: true },
  { key: "DIPLOME_FIN_FORMATION", label: "Diplôme de Fin de Formation (Paysage)", icon: "workspace_premium", scope: "ANNUEL", isBatch: true },
  { key: "ATTESTATION_INSCRIPTION", label: "Certificat de Scolarité & d'Inscription", icon: "verified", scope: "ANY", isBatch: true },
  { key: "PV_CC", label: "PV de Contrôle Continu de Classe (A4 Paysage)", icon: "assignment", scope: "SEMESTRE", isClassPv: true },
  { key: "PV_SEMESTRE", label: "PV de Délibération Semestrielle (A4 Paysage)", icon: "table_chart", scope: "SEMESTRE", isClassPv: true },
  { key: "PV_ANNUEL", label: "PV de Délibération Annuelle (A4 Paysage)", icon: "gavel", scope: "ANNUEL", isClassPv: true },
];

export default function BulletinsDiplomesPage() {
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
      .catch((e) => showToast(e.message, "error"));
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
    const scope = docType === "RELEVE_ANNUEL" || docType === "DIPLOME_FIN_FORMATION" || docType === "PV_ANNUEL" ? "ANNUEL" : "SEMESTRE";
    apiFetch(`/deliberations?classeId=${selectedClassId}&gradePeriodId=${currentPeriod.id}&scope=${scope}`)
      .then((data) => setDelibData(data))
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadClassResults();
  }, [selectedClassId, currentPeriod, docType]);

  async function handleGenerateSinglePdf(student, forceRegenerate = false) {
    setGeneratingStudentId(student.studentId || student.id);
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
      showToast("Acte officiel prêt à l'impression.", "success");
    } catch (err) {
      showToast(err.message || "Échec de génération du document.", "error");
    } finally {
      setGeneratingStudentId(null);
    }
  }

  // Impression de PV de Classe ou Livret complet d'apprenants
  async function handleGenerateBatchPdf() {
    if (!selectedClassId) return;
    setGenerating(true);
    try {
      const isClassPv = DOCUMENT_TYPES.find((d) => d.key === docType)?.isClassPv;

      let previewUrl = "";
      let downloadUrl = "";
      let titleLabel = "";

      if (isClassPv) {
        // Tirage PV de Classe direct
        const endpoint = docType === "PV_CC" ? `/grades/classes/${selectedClassId}/cc-sheet` : `/grades/classes/${selectedClassId}/semester-sheet`;
        const res = await apiFetch(endpoint, {
          method: "POST",
          body: JSON.stringify({ gradePeriodId: currentPeriod?.id, forceRegenerate: true }),
        });
        const token = getToken();
        previewUrl = `${API_BASE}${res.previewUrl}?token=${token}`;
        downloadUrl = `${API_BASE}${res.downloadUrl}?token=${token}`;
        titleLabel = `Procès-Verbal Officiel — ${delibData?.classe?.label || "Classe"}`;
      } else {
        // Livret d'actes compilé
        const res = await apiFetch("/documents/generate-batch", {
          method: "POST",
          body: JSON.stringify({
            classeId: selectedClassId,
            type: docType,
            gradePeriodId: currentPeriod?.id,
          }),
        });
        const token = getToken();
        previewUrl = `${API_BASE}${res.batchDocument.previewUrl}?token=${token}`;
        downloadUrl = `${API_BASE}${res.batchDocument.downloadUrl}?token=${token}`;
        titleLabel = `Livret de Classe (${res.count} documents) — ${delibData?.classe?.label || "Classe"}`;
      }

      setPdfModal({
        title: titleLabel,
        previewUrl,
        downloadUrl,
      });
      showToast("Document de classe compilé avec succès.", "success");
    } catch (err) {
      showToast(err.message || "Échec de génération groupée.", "error");
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

  const selectedDocMeta = DOCUMENT_TYPES.find((d) => d.key === docType);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Diplomation &amp; Actes Officiels</Badge>}
        title="Bulletins, Relevés, Diplômes &amp; Procès-Verbaux (V4)"
        subtitle="Extraction des résultats délibérés, certification par QR Code autonome hors-ligne et tirage de livrets A4"
        actions={
          <Button
            variant="primary"
            icon="print"
            onClick={handleGenerateBatchPdf}
            disabled={generating || !selectedClassId}
            isLoading={generating}
          >
            {selectedDocMeta?.isClassPv ? "Imprimer le PV de Classe (A4)" : "Imprimer Livret de Classe (A4)"}
          </Button>
        }
      />

      {/* Sélection du Type d'Acte & Filtres Séquentiels */}
      <StructuredPanel
        title="Paramètres d'Émission de l'Acte"
        subtitle="Choisissez le document ou procès-verbal à imprimer et la classe concernée"
        icon="receipt_long"
      >
        <div className="space-y-4">
          <div>
            <label className="text-caption font-semibold uppercase tracking-wider text-ink-secondary block mb-2 dark:text-ink-secondary-dark">
              Type d'Acte Académique ou Procès-Verbal à Émettre
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {DOCUMENT_TYPES.map((dt) => (
                <button
                  key={dt.key}
                  type="button"
                  onClick={() => setDocType(dt.key)}
                  className={`p-2.5 rounded text-center border transition-colors flex flex-col items-center justify-between gap-1.5 ${
                    docType === dt.key
                      ? "bg-brand-900 text-white border-brand-900 shadow-xs font-semibold dark:bg-brand-500 dark:border-brand-500"
                      : "bg-surface text-ink-secondary border-border hover:bg-[#F5F7FA] dark:bg-surface-dark dark:border-border-dark dark:text-ink-secondary-dark dark:hover:bg-[#13263A]"
                  }`}
                >
                  <Icon name={dt.icon} className="text-[20px]" />
                  <span className="text-[11px] leading-tight truncate w-full">{dt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border dark:border-border-dark">
            <Select
              label="1. Session Académique"
              value={selectedYearId}
              onChange={(e) => {
                setSelectedYearId(e.target.value);
                const yr = academicYears.find((y) => y.id === e.target.value);
                if (yr) setPeriods(yr.gradePeriods || []);
              }}
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label} {y.isCurrent ? "(Active)" : y.status === "CLOSED" ? "(🔒 Clôturée)" : "(Préparatoire)"}
                </option>
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
              >
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.label} ({c._count?.inscriptions || 0} élèves)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-caption font-semibold uppercase tracking-wider text-ink-secondary block mb-1.5 select-none dark:text-ink-secondary-dark">
                3. Période Évaluée
              </label>
              {docType === "RELEVE_ANNUEL" || docType === "DIPLOME_FIN_FORMATION" || docType === "PV_ANNUEL" ? (
                <div className="h-[40px] flex items-center px-3 rounded bg-[#F5F7FA] border border-border text-body-sm font-mono font-bold text-brand-900 dark:bg-[#07111D] dark:border-border-dark dark:text-brand-500">
                  Année Complète (Cumul S1 + S2)
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      </StructuredPanel>

      {/* Tableau des Apprenants & Actions */}
      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-border-dark">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans">
                {selectedClass?.label || "Classe"} — {displayStudents.length} apprenant(s) éligible(s)
              </h3>
              {docType === "DIPLOME_FIN_FORMATION" && (
                <Badge variant={isFinalYear ? "success" : "warning"}>
                  {isFinalYear ? "Promotion Diplômante" : "Niveau Intermédiaire"}
                </Badge>
              )}
            </div>
            <p className="text-caption text-ink-muted mt-0.5">
              Filière : {selectedClass?.filiere?.name} • Session : {selectedYear?.label}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" icon="print" onClick={handleGenerateBatchPdf} isLoading={generating}>
              {selectedDocMeta?.isClassPv ? "Générer PV de Classe" : "Générer Livret de Classe"}
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="p-8 text-caption text-ink-muted text-center">Chargement des résultats délibérés...</p>
        ) : displayStudents.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Icon name="search_off" className="text-4xl text-ink-muted" />
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Aucun résultat disponible</h3>
            <p className="text-caption text-ink-muted">
              {docType === "DIPLOME_FIN_FORMATION"
                ? "Aucun lauréat diplômé trouvé pour cette classe."
                : "Aucun apprenant délibéré pour cette sélection."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="w-16 text-center">Rang</TableHeaderCell>
                <TableHeaderCell className="w-28">Matricule</TableHeaderCell>
                <TableHeaderCell>Nom &amp; Prénom</TableHeaderCell>
                <TableHeaderCell className="w-32 text-center">Moyenne /20</TableHeaderCell>
                <TableHeaderCell className="w-36 text-center">Décision</TableHeaderCell>
                <TableHeaderCell align="right">Émission de l'Acte</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayStudents.map((st) => {
                const isCurrentGenerating = generatingStudentId === (st.studentId || st.id);

                return (
                  <TableRow key={st.studentId || st.id}>
                    <TableCell align="center" className="font-mono font-bold text-brand-900 dark:text-brand-500">
                      {st.rang ? `${st.rang}e` : st.calculatedRank ? `${st.calculatedRank}e` : "—"}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{st.matricule}</TableCell>
                    <TableCell className="font-semibold text-ink-primary dark:text-white">{st.lastName} {st.firstName}</TableCell>
                    <TableCell align="center" className="font-mono font-bold text-body-md text-brand-900 bg-brand-500/5 dark:text-brand-500">
                      {st.moyenne !== null && st.moyenne !== undefined ? `${st.moyenne}` : "—"}
                    </TableCell>
                    <TableCell align="center">
                      <Badge variant={st.decision === "admis" || st.decision === "diplome" || st.decision === "valide" ? "success" : "error"}>
                        {st.decision || "en_attente"}
                      </Badge>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="visibility"
                        onClick={() => handleGenerateSinglePdf(st, false)}
                        disabled={isCurrentGenerating}
                        isLoading={isCurrentGenerating}
                      >
                        Consulter l'Acte
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Visionneuse PDF Unifiée */}
      <DocumentViewerModal
        isOpen={Boolean(pdfModal)}
        title={pdfModal?.title}
        previewUrl={pdfModal?.previewUrl}
        downloadUrl={pdfModal?.downloadUrl}
        isReused={pdfModal?.reused}
        onForceRegenerate={pdfModal?.student ? () => handleGenerateSinglePdf(pdfModal.student, true) : null}
        onClose={() => setPdfModal(null)}
      />
    </motion.div>
  );
}