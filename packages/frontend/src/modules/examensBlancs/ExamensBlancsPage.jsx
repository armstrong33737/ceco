// packages/frontend/src/modules/examensBlancs/ExamensBlancsPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch, API_BASE, getToken } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel } from "../../design-system/layout/Card";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Select from "../../design-system/primitives/Select";
import Modal from "../../design-system/overlays/Modal";
import DocumentViewerModal from "../documents/components/DocumentViewerModal";

import BordereauGrid from "./components/BordereauGrid";
import SessionsTab from "./components/SessionsTab";
import MaquettesTab from "./components/MaquettesTab";
import EpreuvesTab from "./components/EpreuvesTab";

export default function ExamensBlancsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromUrl = () => {
    const path = location.pathname;
    if (path.includes("/sessions")) return "sessions";
    if (path.includes("/maquettes")) return "maquettes";
    if (path.includes("/epreuves")) return "referentiel";
    return "bordereau";
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl());

  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [location.pathname]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    if (tabKey === "sessions") navigate("/examens-blancs/sessions");
    else if (tabKey === "maquettes") navigate("/examens-blancs/maquettes");
    else if (tabKey === "referentiel") navigate("/examens-blancs/epreuves");
    else navigate("/examens-blancs/bordereau");
  };

  // 1. Données Principales
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [allClasses, setAllClasses] = useState([]);
  const [programTypes, setProgramTypes] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [currentClasseExam, setCurrentClasseExam] = useState(null);
  const [inputGrades, setInputGrades] = useState({});
  const [savingGrades, setSavingGrades] = useState(false);
  const [pdfModal, setPdfModal] = useState(null);

  // 2. Épreuves de classe & Flexibilité
  const [showAddSubjectToClassModal, setShowAddSubjectToClassModal] = useState(false);
  const [addSubjectToClassForm, setAddSubjectToClassForm] = useState({ mockSubjectId: "", coefficient: 2.0 });
  const [editingSubject, setEditingSubject] = useState(null);
  const [editSubjectForm, setEditSubjectForm] = useState({ coefficient: 2.0 });

  // 3. Maquettes Filières
  const [filieres, setFilieres] = useState([]);
  const [selectedFiliereId, setSelectedFiliereId] = useState("");
  const [filiereMaquette, setFiliereMaquette] = useState([]);
  const [showAddMaquetteModal, setShowAddMaquetteModal] = useState(false);
  const [maquetteForm, setMaquetteForm] = useState({ mockSubjectId: "", coefficient: 2.0 });

  // 4. Référentiel
  const [mockSubjects, setMockSubjects] = useState([]);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ code: "", name: "", defaultCoefficient: 2.0 });
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvRows, setCsvRows] = useState([]);
  const [importingCsv, setImportingCsv] = useState(false);

  // 5. Import CSV direct de notes d'une épreuve
  const [importGradesModalSubject, setImportGradesModalSubject] = useState(null);
  const [importGradesRows, setImportGradesRows] = useState([]);
  const [importingGradesCsv, setImportingGradesCsv] = useState(false);

  // 6. Session Modal & Diagnostic
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    title: "",
    startDate: "",
    endDate: "",
    targetScope: "ALL",
    manualClasseIds: [],
  });
  const [diagnosticReport, setDiagnosticReport] = useState(null);

  async function loadInitialData() {
    try {
      const [clsList, filsList, subsList, sessList, ptsList] = await Promise.all([
        apiFetch("/classes"),
        apiFetch("/filieres"),
        apiFetch("/mock-subjects"),
        apiFetch("/mock-exam-sessions"),
        apiFetch("/program-types").catch(() => []),
      ]);
      setAllClasses(clsList || []);
      setFilieres(filsList || []);
      setMockSubjects(subsList || []);
      setSessions(sessList || []);
      setProgramTypes(ptsList || []);

      if (filsList?.length > 0 && !selectedFiliereId) setSelectedFiliereId(filsList[0].id);
      if (sessList?.length > 0 && !selectedSessionId) setSelectedSessionId(sessList[0].id);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  // RÈGLE MÉTIER STRICTE : Seules les classes candidates ENRÔLÉES dans la session sont affichées
  const enrolledClassesInSession = useMemo(() => {
    if (!currentSession || !currentSession.classeMockExams) return [];
    return currentSession.classeMockExams
      .map((ce) => ce.classe)
      .filter((c) => Boolean(c));
  }, [currentSession]);

  // Classes candidates terminales éligibles pour l'enrôlement manuel
  const terminalCandidateClasses = useMemo(() => {
    return allClasses.filter((c) => {
      const isTerminal = c.niveau?.order >= c.filiere?.durationInYears;
      return isTerminal && c.academicYear?.isCurrent;
    });
  }, [allClasses]);

  // Auto-sélection de la première classe enrôlée
  useEffect(() => {
    if (enrolledClassesInSession.length > 0) {
      if (!enrolledClassesInSession.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(enrolledClassesInSession[0].id);
      }
    } else {
      setSelectedClassId("");
      setCurrentClasseExam(null);
    }
  }, [enrolledClassesInSession, selectedClassId]);

  async function loadFiliereMaquette() {
    if (!selectedFiliereId) return;
    try {
      const data = await apiFetch(`/filieres/${selectedFiliereId}/mock-subjects`);
      setFiliereMaquette(data || []);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  useEffect(() => {
    loadFiliereMaquette();
  }, [selectedFiliereId]);

  async function loadClasseGrid() {
    if (!selectedSessionId || !selectedClassId) {
      setCurrentClasseExam(null);
      return;
    }

    const linkedExam = currentSession?.classeMockExams?.find((ce) => ce.classeId === selectedClassId);

    if (!linkedExam) {
      setCurrentClasseExam(null);
      setInputGrades({});
      return;
    }

    try {
      const data = await apiFetch(`/mock-exams/classes/${linkedExam.id}/grid`);
      setCurrentClasseExam(data);

      const map = {};
      data.classe?.inscriptions?.forEach((insc) => {
        const st = insc.student;
        map[st.id] = {};
        data.subjects?.forEach((subj) => {
          const g = data.grades?.find((gr) => gr.studentId === st.id && gr.classeMockExamSubjectId === subj.id);
          map[st.id][subj.id] = {
            score: g ? (g.isAbsent ? "M" : g.score !== null ? String(g.score) : "") : "",
            isAbsent: g?.isAbsent || false,
          };
        });
      });
      setInputGrades(map);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  useEffect(() => {
    loadClasseGrid();
  }, [selectedSessionId, selectedClassId, currentSession]);

  function handleScoreChange(studentId, subjectId, rawVal) {
    let val = rawVal;
    let isAbs = false;

    if (val.toUpperCase() === "M") {
      val = "M";
      isAbs = true;
    } else if (val !== "") {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        val = String(Math.max(0, Math.min(20, parsed)));
      }
    }

    setInputGrades((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: { score: val, isAbsent: isAbs },
      },
    }));
  }

  async function handleSaveGrades() {
    if (!currentClasseExam) return;
    setSavingGrades(true);
    try {
      const gradesList = [];
      Object.entries(inputGrades).forEach(([studentId, subMap]) => {
        Object.entries(subMap).forEach(([classeMockExamSubjectId, data]) => {
          gradesList.push({
            classeMockExamSubjectId,
            studentId,
            score: data.score,
            isAbsent: data.isAbsent || data.score === "M",
          });
        });
      });

      await apiFetch(`/mock-exams/classes/${currentClasseExam.id}/grades/batch`, {
        method: "POST",
        body: JSON.stringify({ gradesList }),
      });
      showToast("Notes du bordereau enregistrées et moyennes recalculées.", "success");
      await loadClasseGrid();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingGrades(false);
    }
  }

  async function handleToggleCandidateEligibility(studentId, nextStatus) {
    if (!currentClasseExam) return;
    try {
      await apiFetch(`/mock-exams/classes/${currentClasseExam.id}/candidates/${studentId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast(nextStatus === "DISQUALIFIE" ? "Candidat exclu du bordereau." : "Candidat retenu.", "info");
      await loadClasseGrid();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleToggleLock() {
    if (!currentClasseExam) return;
    try {
      const nextLock = !currentClasseExam.isLocked;
      await apiFetch(`/mock-exams/classes/${currentClasseExam.id}/lock`, {
        method: "POST",
        body: JSON.stringify({ lock: nextLock }),
      });
      showToast(nextLock ? "Bordereau verrouillé." : "Bordereau déverrouillé.", "info");
      await loadClasseGrid();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleToggleSessionLock(sessionId, shouldLock) {
    try {
      const res = await apiFetch(`/mock-exam-sessions/${sessionId}/lock`, {
        method: "POST",
        body: JSON.stringify({ lock: shouldLock }),
      });
      showToast(res.message, "success");
      const sessList = await apiFetch("/mock-exam-sessions");
      setSessions(sessList || []);
      await loadClasseGrid();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // --- ACTES D'IMPRESSION ---

  async function handlePrintOfficialBorderau() {
    if (!currentClasseExam) return;
    try {
      const res = await apiFetch(`/mock-exams/classes/${currentClasseExam.id}/borderau-pdf`, { method: "POST" });
      const token = getToken();
      setPdfModal({
        title: `Bordereau MINEFOP Officiel — ${currentClasseExam.classe.label}`,
        previewUrl: `${API_BASE}${res.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.downloadUrl}?token=${token}`,
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handlePrintBlankBorderau() {
    if (!currentClasseExam) return;
    try {
      const res = await apiFetch(`/mock-exams/classes/${currentClasseExam.id}/blank-borderau-pdf`, { method: "POST" });
      const token = getToken();
      setPdfModal({
        title: `Bordereau Vierge de Délibération — ${currentClasseExam.classe.label}`,
        previewUrl: `${API_BASE}${res.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.downloadUrl}?token=${token}`,
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handlePrintBatchExaminerSheets() {
    if (!currentClasseExam) return;
    try {
      const res = await apiFetch(`/mock-exams/classes/${currentClasseExam.id}/examiner-sheets-batch-pdf`, { method: "POST" });
      const token = getToken();
      setPdfModal({
        title: `Pack Feuilles d'Émargement & Notation — ${currentClasseExam.classe.label}`,
        previewUrl: `${API_BASE}${res.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.downloadUrl}?token=${token}`,
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handlePrintSingleExaminerSheet(subjectId, subjectCode) {
    if (!currentClasseExam) return;
    try {
      const res = await apiFetch(`/mock-exams/classes/${currentClasseExam.id}/subjects/${subjectId}/examiner-sheet-pdf`, { method: "POST" });
      const token = getToken();
      setPdfModal({
        title: `Feuille d'Émargement [${subjectCode}] — ${currentClasseExam.classe.label}`,
        previewUrl: `${API_BASE}${res.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.downloadUrl}?token=${token}`,
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handlePrintSessionBundle(sessionId, sessionTitle) {
    try {
      const res = await apiFetch(`/mock-exam-sessions/${sessionId}/bundle-borderau-pdf`, { method: "POST" });
      const token = getToken();
      setPdfModal({
        title: `Recueil Unique Compilé de Session — ${sessionTitle}`,
        previewUrl: `${API_BASE}${res.previewUrl}?token=${token}`,
        downloadUrl: `${API_BASE}${res.downloadUrl}?token=${token}`,
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // --- ACTIONS SESSIONS ---

  async function handleCreateSession(e) {
    e.preventDefault();
    try {
      const res = await apiFetch("/mock-exam-sessions", {
        method: "POST",
        body: JSON.stringify(sessionForm),
      });
      setShowSessionModal(false);
      setDiagnosticReport(res.diagnostic);
      setSessionForm({ title: "", startDate: "", endDate: "", targetScope: "ALL", manualClasseIds: [] });
      const sessList = await apiFetch("/mock-exam-sessions");
      setSessions(sessList || []);
      if (res.session?.id) setSelectedSessionId(res.session.id);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDeleteSession(sessionId) {
    try {
      await apiFetch(`/mock-exam-sessions/${sessionId}`, { method: "DELETE" });
      showToast("Session supprimée.", "info");
      const sessList = await apiFetch("/mock-exam-sessions");
      setSessions(sessList || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // --- ACTIONS ÉPREUVES DU CATALOGUE ---

  async function handleCreateMockSubject(e) {
    e.preventDefault();
    try {
      await apiFetch("/mock-subjects", {
        method: "POST",
        body: JSON.stringify(subjectForm),
      });
      showToast("Épreuve ajoutée au catalogue.", "success");
      setShowSubjectModal(false);
      setSubjectForm({ code: "", name: "", defaultCoefficient: 2.0 });
      const subs = await apiFetch("/mock-subjects");
      setMockSubjects(subs || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleUpdateMockSubject(id, updatedData) {
    try {
      await apiFetch(`/mock-subjects/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedData),
      });
      showToast("Épreuve mise à jour avec succès.", "success");
      const subs = await apiFetch("/mock-subjects");
      setMockSubjects(subs || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDeleteMockSubject(id) {
    try {
      await apiFetch(`/mock-subjects/${id}`, { method: "DELETE" });
      showToast("Épreuve retirée du catalogue.", "info");
      const subs = await apiFetch("/mock-subjects");
      setMockSubjects(subs || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // --- IMPORT CSV NOTES PAR ÉPREUVE ---

  function handleCsvGradesFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const lines = evt.target.result.split("\n").filter((l) => l.trim().length > 0);
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/[;,]/).map((p) => p.replace(/^"|"$/g, "").trim());
        if (parts[0] && parts[1] !== undefined) {
          parsed.push({ matricule: parts[0], score: parts[1] });
        }
      }
      setImportGradesRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleExecuteImportGrades() {
    if (!importGradesModalSubject || importGradesRows.length === 0) return;
    setImportingGradesCsv(true);
    try {
      const res = await apiFetch(
        `/mock-exams/classes/${currentClasseExam.id}/subjects/${importGradesModalSubject.id}/import-grades`,
        {
          method: "POST",
          body: JSON.stringify({ rows: importGradesRows }),
        }
      );
      showToast(res.message, "success");
      setImportGradesModalSubject(null);
      setImportGradesRows([]);
      await loadClasseGrid();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setImportingGradesCsv(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<span className="text-[11px] font-bold uppercase tracking-wider text-brand-900 dark:text-brand-500">EXAMENS D'ÉTAT MINEFOP • CERTIFICATION SORTANTE</span>}
        title="Gestion des Examens Blancs Régionaux"
        subtitle="Enrôlement automatique des classes terminales, grille de saisie MINEFOP, clôture de session et bordereaux officiels"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon="library_books" onClick={() => handleTabChange("referentiel")}>
              Épreuves ({mockSubjects.length})
            </Button>
            <Button variant="secondary" icon="account_tree" onClick={() => handleTabChange("maquettes")}>
              Maquettes Filières
            </Button>
            <Button
              variant="primary"
              icon="add"
              onClick={() => {
                setSessionForm({
                  title: `EXAMEN REGIONAL DU DQP BLANC, SESSION DE ${new Date().getFullYear()}`,
                  startDate: new Date().toISOString().split("T")[0],
                  endDate: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString().split("T")[0],
                  targetScope: "ALL",
                  manualClasseIds: [],
                });
                setShowSessionModal(true);
              }}
            >
              Nouvelle Session d'Examen
            </Button>
          </div>
        }
      />

      {/* Barre d'Onglets */}
      <div className="flex gap-1.5 p-1 bg-[#F5F7FA] rounded border border-border dark:bg-[#07111D] dark:border-border-dark overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange("bordereau")}
          className={`flex items-center gap-2 h-9 px-4 rounded text-body-sm font-semibold transition-colors ${
            activeTab === "bordereau" ? "bg-brand-900 text-white dark:bg-brand-500" : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">assignment</span>
          <span>Bordereau &amp; Saisie MINEFOP</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("sessions")}
          className={`flex items-center gap-2 h-9 px-4 rounded text-body-sm font-semibold transition-colors ${
            activeTab === "sessions" ? "bg-brand-900 text-white dark:bg-brand-500" : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
          <span>Sessions d'Examens ({sessions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("maquettes")}
          className={`flex items-center gap-2 h-9 px-4 rounded text-body-sm font-semibold transition-colors ${
            activeTab === "maquettes" ? "bg-brand-900 text-white dark:bg-brand-500" : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">account_tree</span>
          <span>Maquettes par Filière</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("referentiel")}
          className={`flex items-center gap-2 h-9 px-4 rounded text-body-sm font-semibold transition-colors ${
            activeTab === "referentiel" ? "bg-brand-900 text-white dark:bg-brand-500" : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">library_books</span>
          <span>Référentiel des Épreuves</span>
        </button>
      </div>

      {/* ONGLET 1 : BORDEREAU & SAISIE */}
      {activeTab === "bordereau" && (
        <div className="space-y-4">
          <StructuredPanel title="Sélection de la Session &amp; de la Classe Candidate" subtitle="Seules les classes candidates enrôlées sont sélectionnables" icon="tune">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select label="1. Session d'Examen Blanc" value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)}>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.academicYear?.label}) {s.isLocked ? "🔒 [Clôturée]" : "🟢 [Active]"}
                  </option>
                ))}
              </Select>

              {/* RÈGLE MÉTIER STRICTE : Affiche UNIQUEMENT les classes candidates de cette session */}
              <Select
                label="2. Classe Candidate Sortante (Enrôlée)"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={enrolledClassesInSession.length === 0}
              >
                {enrolledClassesInSession.length === 0 ? (
                  <option value="">Aucune classe enrôlée dans cette session</option>
                ) : (
                  enrolledClassesInSession.map((c) => (
                    <option key={c.id} value={c.id}>{c.label} ({c.filiere?.name})</option>
                  ))
                )}
              </Select>
            </div>
          </StructuredPanel>

          {!currentClasseExam ? (
            <div className="p-8 text-center bg-surface border border-border rounded space-y-3 dark:bg-surface-dark dark:border-border-dark">
              <span className="material-symbols-outlined text-4xl text-brand-900 dark:text-brand-500">info</span>
              <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Sélectionnez une session et une classe candidate</h3>
              <p className="text-caption text-ink-muted max-w-md mx-auto">
                Choisissez une session d'examen blanc active pour afficher la grille des épreuves et saisir les notes.
              </p>
            </div>
          ) : (
            <BordereauGrid
              currentClasseExam={currentClasseExam}
              isSessionLocked={Boolean(currentSession?.isLocked)}
              inputGrades={inputGrades}
              onScoreChange={handleScoreChange}
              onSaveGrades={handleSaveGrades}
              savingGrades={savingGrades}
              onToggleLock={handleToggleLock}
              onPrintOfficial={handlePrintOfficialBorderau}
              onPrintBlank={handlePrintBlankBorderau}
              onPrintExaminerBatch={handlePrintBatchExaminerSheets}
              onPrintSingleExaminer={handlePrintSingleExaminerSheet}
              onAddSubject={() => setShowAddSubjectToClassModal(true)}
              onEditSubject={(subj) => {
                setEditingSubject(subj);
                setEditSubjectForm({ coefficient: subj.coefficient });
              }}
              onDeleteSubject={async (subjId) => {
                await apiFetch(`/mock-exams/classes/subjects/${subjId}?force=true`, { method: "DELETE" });
                showToast("Épreuve retirée.", "info");
                await loadClasseGrid();
              }}
              onOpenImportCsvModal={(subj) => {
                setImportGradesModalSubject(subj);
                setImportGradesRows([]);
              }}
              onToggleCandidateEligibility={handleToggleCandidateEligibility}
            />
          )}
        </div>
      )}

      {/* ONGLET 2 : SESSIONS */}
      {activeTab === "sessions" && (
        <SessionsTab
          sessions={sessions}
          onPrintSessionBundle={handlePrintSessionBundle}
          onToggleSessionLock={handleToggleSessionLock}
          onDeleteSession={handleDeleteSession}
        />
      )}

      {/* ONGLET 3 : MAQUETTES */}
      {activeTab === "maquettes" && (
        <MaquettesTab
          filieres={filieres}
          selectedFiliereId={selectedFiliereId}
          onFiliereChange={setSelectedFiliereId}
          filiereMaquette={filiereMaquette}
          onOpenAddModal={() => setShowAddMaquetteModal(true)}
          onRemoveSubject={async (id) => {
            await apiFetch(`/filieres/mock-subjects/${id}`, { method: "DELETE" });
            showToast("Épreuve retirée de la maquette.", "info");
            await loadFiliereMaquette();
          }}
        />
      )}

      {/* ONGLET 4 : RÉFÉRENTIEL */}
      {activeTab === "referentiel" && (
        <EpreuvesTab
          mockSubjects={mockSubjects}
          onOpenSubjectModal={() => setShowSubjectModal(true)}
          onOpenCsvModal={() => setShowCsvModal(true)}
          onUpdateSubject={handleUpdateMockSubject}
          onDeleteSubject={handleDeleteMockSubject}
        />
      )}

      {/* MODALE IMPORT CSV NOTES POUR UNE ÉPREUVE */}
      <Modal
        isOpen={Boolean(importGradesModalSubject)}
        onClose={() => setImportGradesModalSubject(null)}
        title={`Importer Notes CSV : ${importGradesModalSubject?.mockSubject?.code}`}
        subtitle="Format : Matricule; Note (ex: STU26-0001; 14.50 ou M)"
        icon="upload_file"
      >
        <div className="space-y-4">
          <input type="file" accept=".csv,text/csv" onChange={handleCsvGradesFileSelect} className="text-caption" />
          {importGradesRows.length > 0 && (
            <p className="text-caption font-bold text-success">{importGradesRows.length} note(s) prêtes à être injectées.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setImportGradesModalSubject(null)}>Annuler</Button>
            <Button
              variant="primary"
              onClick={handleExecuteImportGrades}
              isLoading={importingGradesCsv}
              disabled={importGradesRows.length === 0}
            >
              Injecter les Notes
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODALE CRÉATION SESSION AVEC CYCLES DYNAMIQUES DU CENTRE */}
      <Modal isOpen={showSessionModal} onClose={() => setShowSessionModal(false)} title="Nouvelle Session d'Examen Blanc" icon="calendar_month">
        <form onSubmit={handleCreateSession} className="space-y-4">
          <Input
            required
            label="Intitulé officiel de la session"
            placeholder="EXAMEN REGIONAL DU DQP BLANC, SESSION DE 2026"
            value={sessionForm.title}
            onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input required type="date" label="Date de Début" value={sessionForm.startDate} onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })} />
            <Input required type="date" label="Date de Fin" value={sessionForm.endDate} onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })} />
          </div>

          {/* DYNAMISATION DE LA PORTÉE D'ENRÔLEMENT SELON LES CYCLES RÉELS DU CENTRE */}
          <Select
            label="Portée de l'enrôlement automatique des classes sortantes"
            value={sessionForm.targetScope}
            onChange={(e) => setSessionForm({ ...sessionForm, targetScope: e.target.value })}
          >
            <option value="ALL">Toutes les classes sortantes terminales (Tous cycles)</option>
            {programTypes.map((pt) => (
              <option key={pt.id} value={pt.code}>
                Classes sortantes {pt.code} ({pt.label}) uniquement
              </option>
            ))}
            <option value="MANUAL">Sélection manuelle des classes candidates</option>
          </Select>

          {sessionForm.targetScope === "MANUAL" && (
            <div className="p-3 border border-border rounded max-h-40 overflow-y-auto space-y-1">
              <span className="text-[11px] font-bold text-ink-muted uppercase block">
                Classes terminales candidates ({terminalCandidateClasses.length}) :
              </span>
              {terminalCandidateClasses.length === 0 ? (
                <p className="text-caption text-ink-muted">Aucune classe terminale active.</p>
              ) : (
                terminalCandidateClasses.map((cls) => (
                  <label key={cls.id} className="flex items-center gap-2 text-caption cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sessionForm.manualClasseIds.includes(cls.id)}
                      onChange={(e) => {
                        const cur = sessionForm.manualClasseIds;
                        setSessionForm({
                          ...sessionForm,
                          manualClasseIds: e.target.checked ? [...cur, cls.id] : cur.filter((id) => id !== cls.id),
                        });
                      }}
                    />
                    <span>{cls.label} ({cls.filiere?.name})</span>
                  </label>
                ))
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowSessionModal(false)}>Annuler</Button>
            <Button variant="primary" type="submit">Créer &amp; Enrôler les Classes</Button>
          </div>
        </form>
      </Modal>

      {/* RAPPORT DIAGNOSTIC MINEFOP */}
      <Modal isOpen={Boolean(diagnosticReport)} onClose={() => setDiagnosticReport(null)} title="Bilan de Création & Diagnostic MINEFOP" icon="verified">
        <div className="space-y-4">
          <p className="text-body-sm font-semibold text-ink-primary dark:text-white">{diagnosticReport?.message}</p>

          {diagnosticReport?.alerts?.length > 0 && (
            <div className="p-3 rounded bg-warning-subtle border border-warning/30 text-warning-dark text-caption space-y-1">
              <span className="font-bold block">Avertissements :</span>
              <ul className="list-disc pl-4 space-y-0.5">
                {diagnosticReport.alerts.map((al, idx) => (
                  <li key={idx}>{al}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setDiagnosticReport(null)}>Fermer</Button>
          </div>
        </div>
      </Modal>

      {/* MODALE AJOUT ÉPREUVE LIBRE */}
      <Modal isOpen={showAddSubjectToClassModal} onClose={() => setShowAddSubjectToClassModal(false)} title="Ajouter une Épreuve à cette Classe" icon="add">
        <form onSubmit={async (e) => {
          e.preventDefault();
          await apiFetch(`/mock-exams/classes/${currentClasseExam.id}/subjects`, {
            method: "POST",
            body: JSON.stringify(addSubjectToClassForm),
          });
          showToast("Épreuve ajoutée.", "success");
          setShowAddSubjectToClassModal(false);
          await loadClasseGrid();
        }} className="space-y-4">
          <Select
            required
            label="Épreuve du catalogue"
            value={addSubjectToClassForm.mockSubjectId}
            onChange={(e) => setAddSubjectToClassForm({ ...addSubjectToClassForm, mockSubjectId: e.target.value })}
          >
            <option value="">Sélectionner une épreuve</option>
            {mockSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </Select>
          <Input
            type="number"
            step="0.5"
            label="Coefficient"
            value={addSubjectToClassForm.coefficient}
            onChange={(e) => setAddSubjectToClassForm({ ...addSubjectToClassForm, coefficient: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowAddSubjectToClassModal(false)}>Annuler</Button>
            <Button variant="primary" type="submit">Ajouter</Button>
          </div>
        </form>
      </Modal>

      {/* MODALE MODIFICATION COEFFICIENT */}
      <Modal isOpen={Boolean(editingSubject)} onClose={() => setEditingSubject(null)} title={`Modifier Coefficient : ${editingSubject?.mockSubject?.code}`} icon="tune">
        <form onSubmit={async (e) => {
          e.preventDefault();
          await apiFetch(`/mock-exams/classes/subjects/${editingSubject.id}`, {
            method: "PUT",
            body: JSON.stringify(editSubjectForm),
          });
          showToast("Coefficient modifié.", "success");
          setEditingSubject(null);
          await loadClasseGrid();
        }} className="space-y-4">
          <Input
            type="number"
            step="0.5"
            label="Nouveau coefficient d'examen"
            value={editSubjectForm.coefficient}
            onChange={(e) => setEditSubjectForm({ coefficient: e.target.value })}
          />
          <p className="text-caption text-ink-muted">
            La modification recalculera automatiquement les points et les moyennes finales de la classe.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditingSubject(null)}>Annuler</Button>
            <Button variant="primary" type="submit">Appliquer</Button>
          </div>
        </form>
      </Modal>

      {/* MODALE MAQUETTE FILIÈRE */}
      <Modal isOpen={showAddMaquetteModal} onClose={() => setShowAddMaquetteModal(false)} title="Ajouter à la Maquette de Filière" icon="add">
        <form onSubmit={async (e) => {
          e.preventDefault();
          await apiFetch(`/filieres/${selectedFiliereId}/mock-subjects`, {
            method: "POST",
            body: JSON.stringify(maquetteForm),
          });
          showToast("Épreuve ajoutée à la maquette.", "success");
          setShowAddMaquetteModal(false);
          await loadFiliereMaquette();
        }} className="space-y-4">
          <Select required label="Épreuve d'examen blanc" value={maquetteForm.mockSubjectId} onChange={(e) => setMaquetteForm({ ...maquetteForm, mockSubjectId: e.target.value })}>
            <option value="">Sélectionner une épreuve</option>
            {mockSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </Select>
          <Input type="number" step="0.5" label="Coefficient officiel" value={maquetteForm.coefficient} onChange={(e) => setMaquetteForm({ ...maquetteForm, coefficient: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowAddMaquetteModal(false)}>Annuler</Button>
            <Button variant="primary" type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>

      {/* MODALE CATALOGUE ÉPREUVE */}
      <Modal isOpen={showSubjectModal} onClose={() => setShowSubjectModal(false)} title="Nouvelle Épreuve au Catalogue" icon="add">
        <form onSubmit={handleCreateMockSubject} className="space-y-4">
          <Input required label="Code court" placeholder="Ex: EPP" value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })} />
          <Input required label="Intitulé officiel" placeholder="Ex: Épreuve Professionnelle Pratique" value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} />
          <Input type="number" step="0.5" label="Coefficient standard" value={subjectForm.defaultCoefficient} onChange={(e) => setSubjectForm({ ...subjectForm, defaultCoefficient: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowSubjectModal(false)}>Annuler</Button>
            <Button variant="primary" type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>

      {/* MODALE IMPORT CSV ÉPREUVES */}
      <Modal isOpen={showCsvModal} onClose={() => setShowCsvModal(false)} title="Importer des Épreuves par CSV" icon="upload_file">
        <div className="space-y-4">
          <p className="text-caption text-ink-muted">Format : Code; Intitule; Coefficient (ex: EPS; Education Physique; 2.0)</p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
              const lines = evt.target.result.split("\n").filter((l) => l.trim().length > 0);
              const parsed = [];
              for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].split(/[;,]/).map((p) => p.replace(/^"|"$/g, "").trim());
                if (parts[0] && parts[1]) parsed.push({ code: parts[0], name: parts[1], coefficient: parts[2] || 2.0 });
              }
              setCsvRows(parsed);
            };
            reader.readAsText(file, "UTF-8");
          }} className="text-caption pt-2" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCsvModal(false)}>Fermer</Button>
            <Button variant="primary" onClick={async () => {
              setImportingCsv(true);
              try {
                const res = await apiFetch("/mock-subjects/import", { method: "POST", body: JSON.stringify({ subjects: csvRows }) });
                showToast(res.message, "success");
                setShowCsvModal(false);
                setCsvRows([]);
                const subs = await apiFetch("/mock-subjects");
                setMockSubjects(subs || []);
              } finally {
                setImportingCsv(false);
              }
            }} isLoading={importingCsv} disabled={csvRows.length === 0}>
              Lancer l'Importation
            </Button>
          </div>
        </div>
      </Modal>

      {/* VISIONNEUSE PDF UNIFIÉE */}
      <DocumentViewerModal
        isOpen={Boolean(pdfModal)}
        title={pdfModal?.title}
        previewUrl={pdfModal?.previewUrl}
        downloadUrl={pdfModal?.downloadUrl}
        onClose={() => setPdfModal(null)}
      />
    </motion.div>
  );
}