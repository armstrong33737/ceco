// packages/frontend/src/modules/learners/LearnersListPage.jsx
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
import TablePagination from "../../design-system/data-grid/TablePagination";
import ConfirmDialog from "../../design-system/overlays/ConfirmDialog";
import DocumentViewerModal from "../documents/components/DocumentViewerModal";
import Icon from "../../components/Icon";

// Composants métier
import LearnerDrawer from "./components/LearnerDrawer";
import LearnerFormModal from "./components/LearnerFormModal";
import WebcamCaptureModal from "./components/WebcamCaptureModal";
import CsvImportModal from "./components/CsvImportModal";
import BatchCardsModal from "./components/BatchCardsModal";

// Utilitaires de sécurité anti-crash pour les dates
function safeFormatDate(dateVal) {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}

function StudentAvatar({ student }) {
  const [hasError, setHasError] = useState(false);
  const token = getToken();
  const photoUrl = student?.photoPath ? `${API_BASE}/students/${student.id}/photo?token=${token}` : null;

  if (photoUrl && !hasError) {
    return (
      <div className="w-9 h-9 rounded-[2px] overflow-hidden bg-surface border border-border flex-shrink-0 shadow-inner dark:border-border-dark">
        <img
          src={photoUrl}
          alt={`${student?.firstName || ""} ${student?.lastName || ""}`}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  const initials = `${student?.lastName?.charAt(0) || ""}${student?.firstName?.charAt(0) || ""}`.toUpperCase() || "ST";

  return (
    <div className="w-9 h-9 rounded-[2px] bg-brand-900/10 border border-brand-900/20 text-brand-900 font-bold text-caption flex items-center justify-center flex-shrink-0 select-none dark:bg-brand-500/20 dark:text-brand-500 dark:border-brand-500/30">
      {initials}
    </div>
  );
}

export default function LearnersListPage() {
  const [students, setStudents] = useState([]);
  const [paginationMeta, setPaginationMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [classes, setClasses] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedFiliereId, setSelectedFiliereId] = useState("");
  const [selectedClasseId, setSelectedClasseId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [search, setSearch] = useState("");

  // Modales & Tiroir d'Inspection
  const [inspectStudent, setInspectStudent] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
  const [pdfModal, setPdfModal] = useState(null);

  // Formulaires
  const initialForm = {
    firstName: "", lastName: "", gender: "M", birthDate: "", birthPlace: "", phone: "",
    guardianName: "", guardianPhone: "", entryDiploma: "BEPC",
    matricule: "", classeId: "", academicYearId: "", photoDataUrl: null,
  };
  const [createForm, setCreateForm] = useState(initialForm);
  const [editForm, setEditForm] = useState(initialForm);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Import CSV & Batch
  const [importRows, setImportRows] = useState([]);
  const [importTarget, setImportTarget] = useState({ classeId: "", academicYearId: "" });
  const [importReport, setImportReport] = useState(null);
  const [batchForm, setBatchForm] = useState({ classeId: "", type: "CARTE_ETUDIANT" });
  const [generatingDoc, setGeneratingDoc] = useState(false);

  // Classes filtrées selon la session et la filière
  const availableClasses = useMemo(() => {
    return classes.filter((c) => {
      const matchYear = !selectedYearId || c.academicYearId === selectedYearId;
      const matchFiliere = !selectedFiliereId || c.filiereId === selectedFiliereId;
      return matchYear && matchFiliere;
    });
  }, [classes, selectedYearId, selectedFiliereId]);

  // CORRECTION CRITIQUE 1 : Réinitialisation automatique de la classe si elle n'appartient plus à la session choisie
  useEffect(() => {
    if (selectedClasseId && !availableClasses.some((c) => c.id === selectedClasseId)) {
      setSelectedClasseId("");
      setPage(1);
    }
  }, [availableClasses, selectedClasseId]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        onlyArchived: "false",
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(selectedClasseId ? { classeId: selectedClasseId } : {}),
        ...(selectedFiliereId ? { filiereId: selectedFiliereId } : {}),
        ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
        ...(selectedStatus ? { status: selectedStatus } : {}),
      });

      const [studentsRes, classesData, filieresData, yearsData] = await Promise.all([
        apiFetch(`/students?${params.toString()}`),
        apiFetch("/classes").catch(() => []),
        apiFetch("/filieres").catch(() => []),
        apiFetch("/academic-years").catch(() => []),
      ]);

      setStudents(studentsRes?.data || []);
      setPaginationMeta(studentsRes?.pagination || null);
      setClasses(classesData || []);
      setFilieres(filieresData || []);
      setAcademicYears(yearsData || []);
    } catch (err) {
      showToast(err.message || "Erreur de chargement des apprenants.", "error");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [page, limit, selectedYearId, selectedFiliereId, selectedClasseId, selectedStatus, search]);

  function handlePhotoSelect(e, isEdit = false) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (isEdit) {
        setEditForm((f) => ({ ...f, photoDataUrl: reader.result }));
      } else {
        setCreateForm((f) => ({ ...f, photoDataUrl: reader.result }));
      }
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleCreateStudent(e) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      await apiFetch("/students", { method: "POST", body: JSON.stringify(createForm) });
      setShowCreate(false);
      setPhotoPreview(null);
      showToast("Apprenant inscrit avec succès.", "success");
      await loadData();
    } catch (err) {
      setModalError(err.message || "Erreur d'inscription.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      await apiFetch(`/students/${editingStudent.id}`, { method: "PUT", body: JSON.stringify(editForm) });
      setEditingStudent(null);
      showToast("Dossier apprenant mis à jour avec succès.", "success");
      await loadData();
    } catch (err) {
      setModalError(err.message || "Erreur de modification.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmArchive() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/students/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast(`Le dossier de ${deleteTarget.firstName} ${deleteTarget.lastName} a été archivé.`, "info");
      await loadData();
    } catch (err) {
      showToast(err.message || "Impossible d'archiver ce dossier.", "error");
    }
  }

  async function handleExportCsv() {
    try {
      const token = getToken();
      const params = new URLSearchParams({
        onlyArchived: "false",
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(selectedClasseId ? { classeId: selectedClasseId } : {}),
        ...(selectedFiliereId ? { filiereId: selectedFiliereId } : {}),
        ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
        ...(selectedStatus ? { status: selectedStatus } : {}),
      });

      const res = await fetch(`${API_BASE}/students-export?${params.toString()}&token=${token}`);
      if (!res.ok) throw new Error("Échec de l'export.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `apprenants_ceco_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Fichier CSV exporté avec succès.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function handleCsvFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        setModalError("Fichier CSV vide ou invalide.");
        return;
      }
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/[;,]/).map((p) => p.replace(/^"|"$/g, "").trim());
        if (parts.length >= 2) {
          parsed.push({
            matricule: parts[0] || "",
            lastName: parts[1] || "",
            firstName: parts[2] || "",
            gender: parts[3] || "M",
            birthDate: parts[4] || "",
            birthPlace: parts[5] || "",
            phone: parts[6] || "",
            guardianName: parts[7] || "",
            guardianPhone: parts[8] || "",
            entryDiploma: parts[9] || "",
          });
        }
      }
      setImportRows(parsed);
      setImportReport(null);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleExecuteImport(e) {
    e.preventDefault();
    if (importRows.length === 0 || !importTarget.classeId || !importTarget.academicYearId) {
      setModalError("Veuillez sélectionner une classe, une session et un fichier valide.");
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const res = await apiFetch("/students/import", {
        method: "POST",
        body: JSON.stringify({
          students: importRows,
          classeId: importTarget.classeId,
          academicYearId: importTarget.academicYearId,
        }),
      });
      setImportReport(res);
      showToast(res.message, "success");
      await loadData();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateSingle(student, type, forceRegenerate = false) {
    setGeneratingDoc(true);
    try {
      const currentInsc = student.inscriptions?.[0];
      const res = await apiFetch("/documents/generate", {
        method: "POST",
        body: JSON.stringify({
          studentId: student.id,
          type,
          classeId: currentInsc?.classeId,
          forceRegenerate,
        }),
      });
      const token = getToken();
      setPdfModal({
        title: `${type === "CARTE_ETUDIANT" ? "Carte d'Apprenant" : type === "FICHE_INSCRIPTION" ? "Fiche d'Inscription" : "Certificat de Scolarité"} — ${student.lastName} ${student.firstName}`,
        downloadUrl: `${API_BASE}${res.document.downloadUrl}?token=${token}`,
        previewUrl: `${API_BASE}${res.document.previewUrl}?token=${token}`,
        student,
        type,
        reused: res.reused,
      });
    } catch (err) {
      showToast(err.message || "Erreur de génération PDF.", "error");
    } finally {
      setGeneratingDoc(false);
    }
  }

  async function handleGenerateBatch(e) {
    e.preventDefault();
    if (!batchForm.classeId || !batchForm.type) return;
    setGeneratingDoc(true);
    try {
      const res = await apiFetch("/documents/generate-batch", {
        method: "POST",
        body: JSON.stringify(batchForm),
      });
      const token = getToken();
      setBatchModal(false);
      setPdfModal({
        title: `Impression Groupée (${res.count} documents) — ${batchForm.type === "CARTE_ETUDIANT" ? "Planche Badges Duplex A4" : "Livret d'Attestations A4"}`,
        downloadUrl: `${API_BASE}${res.batchDocument.downloadUrl}?token=${token}`,
        previewUrl: `${API_BASE}${res.batchDocument.previewUrl}?token=${token}`,
      });
      showToast(`Livret de ${res.count} documents généré avec succès.`, "success");
    } catch (err) {
      showToast(err.message || "Erreur de génération groupée.", "error");
    } finally {
      setGeneratingDoc(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Scolarité • Registre Actif</Badge>}
        title="Gestion des Apprenants"
        subtitle="Dossiers individuels, cartes d'identité sécurisées, attestations et tirage par classe"
        actions={
          <>
            <Button
              variant="secondary"
              icon="layers"
              onClick={() => {
                setModalError(null);
                setBatchForm({ classeId: availableClasses[0]?.id || classes[0]?.id || "", type: "CARTE_ETUDIANT" });
                setBatchModal(true);
              }}
            >
              Planches A4
            </Button>
            <Button
              variant="secondary"
              icon="upload_file"
              onClick={() => {
                setModalError(null);
                setImportRows([]);
                setImportReport(null);
                const activeYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
                const activeClasses = classes.filter((c) => c.academicYearId === activeYear?.id || c.academicYear?.isCurrent);
                setImportTarget({ classeId: activeClasses[0]?.id || classes[0]?.id || "", academicYearId: activeYear?.id || "" });
                setShowImport(true);
              }}
            >
              Import CSV
            </Button>
            <Button variant="secondary" icon="download" onClick={handleExportCsv}>
              Export CSV
            </Button>
            <Button
              variant="primary"
              icon="person_add"
              onClick={() => {
                setModalError(null);
                const activeYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
                const activeClasses = classes.filter((c) => c.academicYearId === activeYear?.id || c.academicYear?.isCurrent);
                setCreateForm({ ...initialForm, academicYearId: activeYear?.id || "", classeId: activeClasses[0]?.id || classes[0]?.id || "" });
                setPhotoPreview(null);
                setShowCreate(true);
              }}
            >
              Nouvel Apprenant
            </Button>
          </>
        }
      />

      {/* Barre de Filtres Combinés */}
      <StructuredPanel
        title="Filtres Pédagogiques &amp; Recherche"
        subtitle="Affinez l'affichage des dossiers par session, filière et statut"
        icon="filter_alt"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <Select
            label="1. Session"
            value={selectedYearId}
            onChange={(e) => {
              setSelectedYearId(e.target.value);
              setSelectedClasseId(""); // CORRECTION CRITIQUE : Réinitialise la classe au changement de session
              setPage(1);
            }}
          >
            <option value="">Toutes les sessions</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label} {y.isCurrent ? "(Active)" : ""}</option>)}
          </Select>

          <Select label="2. Filière" value={selectedFiliereId} onChange={(e) => { setSelectedFiliereId(e.target.value); setPage(1); }}>
            <option value="">Toutes les filières</option>
            {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
          </Select>

          <Select label="3. Classe" value={selectedClasseId} onChange={(e) => { setSelectedClasseId(e.target.value); setPage(1); }}>
            <option value="">Toutes les classes ({availableClasses.length})</option>
            {availableClasses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>

          <Select label="4. Statut" value={selectedStatus} onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}>
            <option value="">Tous les statuts</option>
            <option value="en_cours">En cours</option>
            <option value="admis">Admis</option>
            <option value="redouble">Redouble</option>
            <option value="diplome">Diplômé</option>
            <option value="abandon">Abandon</option>
          </Select>

          <Input label="5. Recherche" placeholder="Matricule, nom..." value={search} leftIcon="search" onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </StructuredPanel>

      {/* Grille de Données Dense (Dense Data Grid) */}
      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        {loading && !paginationMeta ? (
          <p className="p-8 text-caption text-ink-muted text-center">Chargement des apprenants...</p>
        ) : students.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Icon name="search_off" className="text-4xl text-ink-muted" />
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Aucun apprenant trouvé</h3>
            <p className="text-caption text-ink-muted">Aucun dossier ne correspond à vos critères de recherche.</p>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="w-28">Matricule</TableHeaderCell>
                <TableHeaderCell>Apprenant</TableHeaderCell>
                <TableHeaderCell>Classe &amp; Cohorte</TableHeaderCell>
                <TableHeaderCell>Tuteur / Urgence</TableHeaderCell>
                <TableHeaderCell className="w-28">Statut</TableHeaderCell>
                <TableHeaderCell align="right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s) => {
                // CORRECTION CRITIQUE 2 : Résolution contextuelle et sécurisée de l'inscription
                const currentInsc = (selectedYearId || selectedClasseId)
                  ? s.inscriptions?.find((i) => (!selectedYearId || i.academicYearId === selectedYearId) && (!selectedClasseId || i.classeId === selectedClasseId)) || s.inscriptions?.[0]
                  : s.inscriptions?.[0];

                return (
                  <TableRow
                    key={s.id}
                    isClickable
                    onClick={() => setInspectStudent(s)}
                  >
                    <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">
                      {s.matricule}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3">
                        <StudentAvatar student={s} />
                        <div>
                          <div className="font-semibold text-ink-primary dark:text-white">{s.lastName} {s.firstName}</div>
                          <div className="text-caption text-ink-muted">
                            {s.gender === "F" ? "Féminin" : "Masculin"} • {safeFormatDate(s.birthDate)}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-ink-primary dark:text-white">{currentInsc?.classe?.label || "Non assigné"}</div>
                      <div className="text-caption text-ink-muted font-mono">{currentInsc?.promotion?.label || "—"}</div>
                    </TableCell>

                    <TableCell>
                      <div>
                        <div className="font-medium text-ink-primary dark:text-white">{s.guardianName || "—"}</div>
                        <div className="text-caption text-ink-muted font-mono">{s.guardianPhone || s.phone || "—"}</div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={currentInsc?.status === "diplome" || currentInsc?.status === "admis" ? "success" : currentInsc?.status === "redouble" ? "error" : "info"} withDot>
                        {currentInsc?.status || "en_cours"}
                      </Badge>
                    </TableCell>

                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="badge"
                          onClick={() => handleGenerateSingle(s, "CARTE_ETUDIANT")}
                          disabled={generatingDoc}
                          title="Carte Badge CR80"
                        >
                          Carte
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          icon="verified"
                          onClick={() => handleGenerateSingle(s, "ATTESTATION_INSCRIPTION")}
                          disabled={generatingDoc}
                          title="Certificat de scolarité"
                        >
                          Certificat
                        </Button>

                        <Button
                          variant="tertiary"
                          size="sm"
                          onClick={() => setInspectStudent(s)}
                        >
                          Dossier
                        </Button>

                        <Button
                          variant="tertiary"
                          size="sm"
                          onClick={() => {
                            setEditingStudent(s);
                            setEditForm({
                              firstName: s.firstName || "",
                              lastName: s.lastName || "",
                              gender: s.gender || "M",
                              birthDate: s.birthDate ? new Date(s.birthDate).toISOString().split("T")[0] : "",
                              birthPlace: s.birthPlace || "",
                              phone: s.phone || "",
                              guardianName: s.guardianName || "",
                              guardianPhone: s.guardianPhone || "",
                              entryDiploma: s.entryDiploma || "BEPC",
                              matricule: s.matricule,
                              photoDataUrl: null,
                            });
                            setPhotoPreview(s.photoPath ? `${API_BASE}/students/${s.id}/photo?token=${getToken()}` : null);
                          }}
                        >
                          Éditer
                        </Button>

                        <Button
                          variant="tertiary"
                          size="sm"
                          icon="delete"
                          className="text-error hover:bg-error-subtle dark:hover:bg-error-subtle-dark"
                          onClick={() => setDeleteTarget(s)}
                          title="Archiver ce dossier"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <TablePagination
        pagination={paginationMeta}
        onPageChange={setPage}
        onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
      />

      {/* TIROIR LATÉRAL D'INSPECTION (LearnerDrawer) */}
      <LearnerDrawer
        isOpen={Boolean(inspectStudent)}
        onClose={() => setInspectStudent(null)}
        student={inspectStudent}
        onEdit={(st) => {
          setEditingStudent(st);
          setEditForm({
            firstName: st.firstName || "",
            lastName: st.lastName || "",
            gender: st.gender || "M",
            birthDate: st.birthDate ? new Date(st.birthDate).toISOString().split("T")[0] : "",
            birthPlace: st.birthPlace || "",
            phone: st.phone || "",
            guardianName: st.guardianName || "",
            guardianPhone: st.guardianPhone || "",
            entryDiploma: st.entryDiploma || "BEPC",
            matricule: st.matricule,
            photoDataUrl: null,
          });
          setPhotoPreview(st.photoPath ? `${API_BASE}/students/${st.id}/photo?token=${getToken()}` : null);
        }}
        onGenerateDoc={handleGenerateSingle}
      />

      {/* Modale d'Inscription / Édition */}
      <LearnerFormModal
        isOpen={showCreate || Boolean(editingStudent)}
        onClose={() => { setShowCreate(false); setEditingStudent(null); }}
        isEdit={Boolean(editingStudent)}
        form={editingStudent ? editForm : createForm}
        setForm={editingStudent ? setEditForm : setCreateForm}
        onSubmit={editingStudent ? handleSaveEdit : handleCreateStudent}
        isLoading={saving}
        error={modalError}
        classes={classes}
        academicYears={academicYears}
        photoPreview={photoPreview}
        onPhotoSelect={handlePhotoSelect}
        onOpenWebcam={() => setShowWebcam(true)}
      />

      {/* Modale Capture Webcam */}
      <WebcamCaptureModal
        isOpen={showWebcam}
        onClose={() => setShowWebcam(false)}
        onCapture={(dataUrl) => {
          if (editingStudent) setEditForm((f) => ({ ...f, photoDataUrl: dataUrl }));
          else setCreateForm((f) => ({ ...f, photoDataUrl: dataUrl }));
          setPhotoPreview(dataUrl);
        }}
      />

      {/* Modale Import CSV */}
      <CsvImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        importTarget={importTarget}
        setImportTarget={setImportTarget}
        classes={classes}
        academicYears={academicYears}
        importRows={importRows}
        importReport={importReport}
        onFileSelect={handleCsvFileSelect}
        onSubmit={handleExecuteImport}
        isLoading={saving}
        error={modalError}
      />

      {/* Modale Planches Badges A4 */}
      <BatchCardsModal
        isOpen={batchModal}
        onClose={() => setBatchModal(false)}
        batchForm={batchForm}
        setBatchForm={setBatchForm}
        classes={classes}
        onSubmit={handleGenerateBatch}
        isLoading={generatingDoc}
      />

      {/* Modale Confirmation Archivage */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmArchive}
        title="Archiver le dossier apprenant"
        description={`Déplacer le dossier de ${deleteTarget?.lastName} ${deleteTarget?.firstName} (${deleteTarget?.matricule}) vers les archives historiques ?`}
        confirmLabel="Confirmer l'Archivage"
      />

      {/* Visionneuse PDF Unifiée */}
      <DocumentViewerModal
        isOpen={Boolean(pdfModal)}
        title={pdfModal?.title}
        previewUrl={pdfModal?.previewUrl}
        downloadUrl={pdfModal?.downloadUrl}
        isReused={pdfModal?.reused}
        isRegenerating={generatingDoc}
        onForceRegenerate={pdfModal?.student ? () => handleGenerateSingle(pdfModal.student, pdfModal.type, true) : null}
        onClose={() => setPdfModal(null)}
      />
    </motion.div>
  );
}