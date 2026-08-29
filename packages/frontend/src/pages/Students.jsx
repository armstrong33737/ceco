// packages/frontend/src/pages/Students.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { apiFetch, API_BASE, getToken } from "../lib/apiClient";
import { showToast } from "../store/toastStore";
import Icon from "../components/Icon";
import PaginationBar from "../components/PaginationBar";
import PdfViewerModal from "../components/PdfViewerModal";
import SlideOverDrawer from "../components/SlideOverDrawer";

function StudentAvatar({ student, size = "md" }) {
  const [hasError, setHasError] = useState(false);
  const token = getToken();
  const photoUrl = student?.photoPath ? `${API_BASE}/students/${student.id}/photo?token=${token}` : null;
  const sizeCls = size === "xl" ? "w-16 h-20 text-sm" : size === "lg" ? "w-12 h-14 text-xs" : "w-8 h-8 text-[11px]";

  if (photoUrl && !hasError) {
    return (
      <div className={`${sizeCls} rounded overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 shadow-inner`}>
        <img
          src={photoUrl}
          alt={`${student.firstName} ${student.lastName}`}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  const initials = `${student?.lastName?.charAt(0) || ""}${student?.firstName?.charAt(0) || ""}`.toUpperCase() || "ST";

  return (
    <div className={`${sizeCls} rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 font-mono shadow-2xs`}>
      {initials}
    </div>
  );
}

export default function Students() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [students, setStudents] = useState([]);
  const [paginationMeta, setPaginationMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [classes, setClasses] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);

  // Vue Active vs Archives
  const [viewMode, setViewMode] = useState("active");

  // Filtres
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedFiliereId, setSelectedFiliereId] = useState("");
  const [selectedClasseId, setSelectedClasseId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [search, setSearch] = useState("");

  // Modales & Tiroirs
  const [showCreate, setShowCreate] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [inspectStudent, setInspectStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [showImport, setShowImport] = useState(false);

  // Webcam Capture
  const [showWebcam, setShowWebcam] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Visionneuse PDF & Planches A4
  const [pdfModal, setPdfModal] = useState(null);
  const [batchModal, setBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({ classeId: "", type: "CARTE_ETUDIANT" });
  const [generatingDoc, setGeneratingDoc] = useState(false);

  // Formulaires
  const initialForm = {
    firstName: "", lastName: "", gender: "M", birthDate: "", birthPlace: "", phone: "",
    guardianName: "", guardianPhone: "", entryDiploma: "BEPC",
    classeId: "", academicYearId: "", photoDataUrl: null,
  };
  const [createForm, setCreateForm] = useState(initialForm);
  const [editForm, setEditForm] = useState(initialForm);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Import CSV
  const [importRows, setImportRows] = useState([]);
  const [importTarget, setImportTarget] = useState({ classeId: "", academicYearId: "" });
  const [importReport, setImportReport] = useState(null);

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Détection du paramètre URL ?action=create pour ouvrir le formulaire automatiquement (Loi de Fitts)
  useEffect(() => {
    if (searchParams.get("action") === "create" && academicYears.length > 0 && classes.length > 0) {
      setModalError(null);
      const activeYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
      const activeClasses = classes.filter((c) => c.academicYearId === activeYear?.id || c.academicYear?.isCurrent);
      setCreateForm({
        ...initialForm,
        academicYearId: activeYear?.id || "",
        classeId: activeClasses[0]?.id || classes[0]?.id || "",
      });
      setPhotoPreview(null);
      setShowCreate(true);

      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, academicYears, classes]);

  const availableClassesForFilter = useMemo(() => {
    return classes.filter((c) => {
      const matchYear = !selectedYearId || c.academicYearId === selectedYearId;
      const matchFiliere = !selectedFiliereId || c.filiereId === selectedFiliereId;
      return matchYear && matchFiliere;
    });
  }, [classes, selectedYearId, selectedFiliereId]);

  useEffect(() => {
    if (selectedClasseId && !availableClassesForFilter.some((c) => c.id === selectedClasseId)) {
      setSelectedClasseId("");
      setPage(1);
    }
  }, [availableClassesForFilter, selectedClasseId]);

  async function loadData() {
    setLoading(true);
    try {
      const isArchived = viewMode === "archived";
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        onlyArchived: String(isArchived),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(selectedClasseId ? { classeId: selectedClasseId } : {}),
        ...(selectedFiliereId ? { filiereId: selectedFiliereId } : {}),
        ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
        ...(selectedStatus ? { status: selectedStatus } : {}),
      });

      const [studentsRes, classesData, filieresData, promoData, yearsData] = await Promise.all([
        apiFetch(`/students?${params.toString()}`),
        apiFetch("/classes").catch(() => []),
        apiFetch("/filieres").catch(() => []),
        apiFetch("/promotions").catch(() => []),
        apiFetch("/academic-years").catch(() => []),
      ]);

      setStudents(studentsRes.data || []);
      setPaginationMeta(studentsRes.pagination || null);
      setClasses(classesData || []);
      setFilieres(filieresData || []);
      setPromotions(promoData || []);
      setAcademicYears(yearsData || []);
    } catch (err) {
      showToast(err.message || "Impossible de charger le registre des apprenants.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [page, limit, viewMode, selectedYearId, selectedFiliereId, selectedClasseId, selectedStatus, search]);

  function handleFilterChange(setter, value) {
    setter(value);
    setPage(1);
  }

  function handleResetFilters() {
    setSelectedYearId("");
    setSelectedFiliereId("");
    setSelectedClasseId("");
    setSelectedStatus("");
    setSearch("");
    setPage(1);
    showToast("Filtres réinitialisés.", "info");
  }

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

  async function startWebcam() {
    setShowWebcam(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setModalError("Accès webcam refusé : " + err.message);
      setShowWebcam(false);
    }
  }

  function stopWebcam() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowWebcam(false);
  }

  function capturePhoto(isEdit = false) {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 120, 0, 400, 480, 0, 0, 300, 360);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    if (isEdit) {
      setEditForm((f) => ({ ...f, photoDataUrl: dataUrl }));
    } else {
      setCreateForm((f) => ({ ...f, photoDataUrl: dataUrl }));
    }
    setPhotoPreview(dataUrl);
    stopWebcam();
  }

  async function handleCreateStudent(e) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      const result = await apiFetch("/students", { method: "POST", body: JSON.stringify(createForm) });
      setShowCreate(false);
      setPhotoPreview(null);
      showToast(`Apprenant ${result.firstName} ${result.lastName} (${result.matricule}) inscrit avec succès.`, "success");
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/students/${deleteTarget.id}`, { method: "DELETE" });
      showToast(`Apprenant ${deleteTarget.lastName} archivé avec succès.`, "warning");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast(err.message || "Impossible d'archiver ce dossier.", "error");
      setDeleteTarget(null);
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) return;
    try {
      await apiFetch(`/students/${restoreTarget.id}/restore`, { method: "PUT" });
      showToast(`Apprenant ${restoreTarget.firstName} ${restoreTarget.lastName} réintégré dans le registre actif.`, "success");
      setRestoreTarget(null);
      await loadData();
    } catch (err) {
      showToast(err.message || "Impossible de restaurer ce dossier.", "error");
      setRestoreTarget(null);
    }
  }

  async function handleExportCsv() {
    try {
      const token = getToken();
      const params = new URLSearchParams({
        onlyArchived: String(viewMode === "archived"),
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
      showToast("Fichier CSV des apprenants téléchargé avec succès.", "success");
    } catch (err) {
      showToast(err.message || "Erreur lors de l'exportation CSV.", "error");
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
      showToast("Document généré et prêt pour l'impression.", "info");
    } catch (err) {
      showToast(err.message || "Erreur lors de la génération du document.", "error");
    } finally {
      setGeneratingDoc(false);
    }
  }

  async function handleGenerateBatch(e) {
    e.preventDefault();
    if (!batchForm.classeId || !batchForm.type) return;
    setGeneratingDoc(true);
    setModalError(null);
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
      showToast(`Planche de ${res.count} documents compilée avec succès.`, "success");
    } catch (err) {
      setModalError(err.message || "Erreur lors de la compilation groupée.");
    } finally {
      setGeneratingDoc(false);
    }
  }

  const hasActiveFilters = Boolean(selectedYearId || selectedFiliereId || selectedClasseId || selectedStatus || search);

  if (loading && !paginationMeta) return <p className="text-xs text-slate-500 font-medium p-6">Chargement du registre des apprenants...</p>;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4  mx-auto">
      {/* 1. En-tête avec Bascule Actifs vs Archives */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">
              {viewMode === "active" ? "Registre des Apprenants" : "Archives Historiques des Apprenants"}
            </h1>
            <span className="badge-blue font-mono font-bold">
              {paginationMeta?.total || 0} {viewMode === "active" ? "actif(s)" : "archivé(s)"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {viewMode === "active"
              ? "Inscriptions, badges d'identité CR80, attestations et fiches individuelles."
              : "Historique scellé des anciens apprenants archivés avec possibilité de réintégration."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bascule Actifs / Archives */}
          <div className="flex p-0.5 bg-slate-100 rounded border border-slate-200">
            <button
              onClick={() => { setViewMode("active"); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
                viewMode === "active" ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Actifs
            </button>
            <button
              onClick={() => { setViewMode("archived"); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-all flex items-center gap-1 ${
                viewMode === "archived" ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon name="archive" className="text-[14px]" />
              <span>Archives</span>
            </button>
          </div>

          {viewMode === "active" && (
            <>
              <button
                onClick={() => {
                  setModalError(null);
                  setBatchForm({
                    classeId: availableClassesForFilter[0]?.id || classes[0]?.id || "",
                    type: "CARTE_ETUDIANT",
                  });
                  setBatchModal(true);
                }}
                className="btn-secondary"
                title="Imprimer les cartes d'étudiant découpables pour toute une classe"
              >
                <Icon name="layers" className="text-[16px] text-blue-700" />
                <span>Planche Badges (A4)</span>
              </button>

              <button
                onClick={() => {
                  setModalError(null);
                  setImportRows([]);
                  setImportReport(null);
                  const activeYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
                  const activeClasses = classes.filter((c) => c.academicYearId === activeYear?.id || c.academicYear?.isCurrent);
                  setImportTarget({
                    classeId: activeClasses[0]?.id || classes[0]?.id || "",
                    academicYearId: activeYear?.id || "",
                  });
                  setShowImport(true);
                }}
                className="btn-secondary"
              >
                <Icon name="upload_file" className="text-[16px]" />
                <span>Importer CSV</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="btn-secondary"
              >
                <Icon name="download" className="text-[16px]" />
                <span>Exporter CSV</span>
              </button>

              <button
                onClick={() => {
                  setModalError(null);
                  const activeYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
                  const activeClasses = classes.filter((c) => c.academicYearId === activeYear?.id || c.academicYear?.isCurrent);
                  setCreateForm({
                    ...initialForm,
                    academicYearId: activeYear?.id || "",
                    classeId: activeClasses[0]?.id || classes[0]?.id || "",
                  });
                  setPhotoPreview(null);
                  setShowCreate(true);
                }}
                className="btn-primary"
              >
                <Icon name="person_add" className="text-[16px]" />
                <span>Nouvel Apprenant</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Barre de Filtres Combinés Haute Densité */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-card space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">1. Session</label>
            <select value={selectedYearId} onChange={(e) => handleFilterChange(setSelectedYearId, e.target.value)} className="input-field w-full">
              <option value="">Toutes les sessions</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.label} {y.isCurrent ? "(Active)" : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">2. Filière</label>
            <select value={selectedFiliereId} onChange={(e) => handleFilterChange(setSelectedFiliereId, e.target.value)} className="input-field w-full">
              <option value="">Toutes les filières</option>
              {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">3. Classe</label>
            <select value={selectedClasseId} onChange={(e) => handleFilterChange(setSelectedClasseId, e.target.value)} className="input-field w-full">
              <option value="">Toutes les classes ({availableClassesForFilter.length})</option>
              {availableClassesForFilter.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">4. Statut</label>
            <select value={selectedStatus} onChange={(e) => handleFilterChange(setSelectedStatus, e.target.value)} className="input-field w-full">
              <option value="">Tous les statuts</option>
              <option value="en_cours">En cours</option>
              <option value="admis">Admis</option>
              <option value="redouble">Redouble</option>
              <option value="diplome">Diplômé</option>
              <option value="abandon">Abandon</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">5. Recherche</label>
            <input
              placeholder="Nom, matricule, contact..."
              value={search}
              onChange={(e) => handleFilterChange(setSearch, e.target.value)}
              className="input-field w-full"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleResetFilters}
              className="text-[11px] font-semibold text-blue-700 hover:underline flex items-center gap-1"
            >
              <Icon name="restart_alt" className="text-[14px]" />
              <span>Réinitialiser les filtres</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Tableau Haute Densité des Apprenants */}
      <div className="table-container">
        {students.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 text-center">
            {viewMode === "active" ? "Aucun apprenant ne correspond aux filtres appliqués." : "Aucun dossier archivé trouvé."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell">Matricule</th>
                  <th className="table-header-cell">Apprenant</th>
                  <th className="table-header-cell">Classe &amp; Cohorte</th>
                  <th className="table-header-cell">{viewMode === "active" ? "Contact & Tuteur" : "Date d'Archivage"}</th>
                  <th className="table-header-cell text-center">Statut</th>
                  <th className="table-header-cell text-right">Actions &amp; Documents</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const currentInsc = (selectedYearId || selectedClasseId)
                    ? s.inscriptions?.find((i) => (!selectedYearId || i.academicYearId === selectedYearId) && (!selectedClasseId || i.classeId === selectedClasseId)) || s.inscriptions?.[0]
                    : s.inscriptions?.[0];

                  return (
                    <tr
                      key={s.id}
                      onClick={() => setInspectStudent(s)}
                      className="table-body-row"
                    >
                      <td className="table-body-cell font-mono font-bold text-blue-700">{s.matricule}</td>
                      <td className="table-body-cell">
                        <div className="flex items-center gap-2.5">
                          <StudentAvatar student={s} size="md" />
                          <div>
                            <span className="font-bold text-slate-900 block">{s.lastName} {s.firstName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {s.gender === "F" ? "Féminin" : "Masculin"} • {s.birthDate ? new Date(s.birthDate).toLocaleDateString("fr-FR") : "—"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="table-body-cell">
                        <span className="font-semibold text-slate-800 block">{currentInsc?.classe?.label || "Non assigné"}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{currentInsc?.promotion?.label || "—"}</span>
                      </td>
                      <td className="table-body-cell">
                        {viewMode === "active" ? (
                          <>
                            <span className="font-semibold text-slate-800 block">{s.guardianName || "—"}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{s.guardianPhone || s.phone || "—"}</span>
                          </>
                        ) : (
                          <span className="font-mono text-rose-600 font-semibold">
                            {s.deletedAt ? new Date(s.deletedAt).toLocaleString("fr-FR") : "—"}
                          </span>
                        )}
                      </td>
                      <td className="table-body-cell text-center">
                        {viewMode === "active" ? (
                          <span className={
                            currentInsc?.status === "diplome" || currentInsc?.status === "admis"
                              ? "badge-emerald uppercase"
                              : currentInsc?.status === "redouble" || currentInsc?.status === "abandon"
                              ? "badge-rose uppercase"
                              : "badge-blue uppercase"
                          }>
                            {currentInsc?.status || "en_cours"}
                          </span>
                        ) : (
                          <span className="badge-rose uppercase">Archivé</span>
                        )}
                      </td>
                      <td className="table-body-cell text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {viewMode === "active" ? (
                            <>
                              <button
                                onClick={() => handleGenerateSingle(s, "CARTE_ETUDIANT")}
                                disabled={generatingDoc}
                                className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200 hover:bg-blue-700 hover:text-white transition-all text-[11px]"
                                title="Générer la carte d'apprenant (Badge CR80)"
                              >
                                Carte
                              </button>

                              <button
                                onClick={() => handleGenerateSingle(s, "ATTESTATION_INSCRIPTION")}
                                disabled={generatingDoc}
                                className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-colors text-[11px]"
                                title="Certificat de scolarité"
                              >
                                Certificat
                              </button>

                              <button
                                onClick={() => setInspectStudent(s)}
                                className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-600 font-semibold hover:bg-slate-100 transition-colors text-[11px]"
                              >
                                Dossier
                              </button>

                              <button
                                onClick={() => {
                                  setEditingStudent(s);
                                  setEditForm({
                                    firstName: s.firstName,
                                    lastName: s.lastName,
                                    gender: s.gender || "M",
                                    birthDate: s.birthDate ? new Date(s.birthDate).toISOString().split("T")[0] : "",
                                    birthPlace: s.birthPlace || "",
                                    phone: s.phone || "",
                                    guardianName: s.guardianName || "",
                                    guardianPhone: s.guardianPhone || "",
                                    entryDiploma: s.entryDiploma || "BEPC",
                                    classeId: currentInsc?.classeId || "",
                                    academicYearId: currentInsc?.academicYearId || "",
                                    photoDataUrl: null,
                                  });
                                  setPhotoPreview(s.photoPath ? `${API_BASE}/students/${s.id}/photo?token=${getToken()}` : null);
                                }}
                                className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-600 hover:text-blue-700 transition-colors text-[11px]"
                              >
                                Éditer
                              </button>

                              <button
                                onClick={() => setDeleteTarget(s)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                title="Archiver ce dossier"
                              >
                                <Icon name="delete" className="text-[16px]" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setInspectStudent(s)}
                                className="btn-secondary text-[11px] px-2.5 py-1"
                              >
                                Dossier
                              </button>
                              <button
                                onClick={() => setRestoreTarget(s)}
                                className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-[11px] px-2.5 py-1"
                              >
                                <Icon name="restore" className="text-[14px]" />
                                <span>Restaurer</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. BARRE DE PAGINATION SERVEUR */}
      <PaginationBar
        pagination={paginationMeta}
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
      />

      {/* 5. TIROIR LATÉRAL COULISSANT D'INSPECTION (SLIDE-OVER DRAWER) */}
      <SlideOverDrawer
        isOpen={Boolean(inspectStudent)}
        onClose={() => setInspectStudent(null)}
        title={inspectStudent ? `${inspectStudent.lastName} ${inspectStudent.firstName}` : "Dossier Apprenant"}
        subtitle={`Matricule Officiel : ${inspectStudent?.matricule || "—"}`}
        footerActions={
          <>
            <button
              type="button"
              onClick={() => {
                const st = inspectStudent;
                setInspectStudent(null);
                handleGenerateSingle(st, "CARTE_ETUDIANT");
              }}
              className="flex-1 btn-primary"
            >
              <Icon name="badge" className="text-[16px]" />
              <span>Générer Carte d'Identité</span>
            </button>
            <button
              type="button"
              onClick={() => setInspectStudent(null)}
              className="btn-secondary"
            >
              Fermer
            </button>
          </>
        }
      >
        {inspectStudent && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <StudentAvatar student={inspectStudent} size="xl" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">{inspectStudent.lastName} {inspectStudent.firstName}</h4>
                <span className="badge-blue font-mono font-bold mt-0.5">{inspectStudent.matricule}</span>
                <p className="text-[11px] text-slate-500 mt-1">
                  {inspectStudent.gender === "F" ? "Féminin" : "Masculin"} • Né(e) le {inspectStudent.birthDate ? new Date(inspectStudent.birthDate).toLocaleDateString("fr-FR") : "—"}{inspectStudent.birthPlace ? ` à ${inspectStudent.birthPlace}` : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs p-3 bg-slate-50 rounded-lg border border-slate-200 font-medium">
              <div><strong className="text-slate-500 block text-[10px] uppercase">Téléphone</strong> {inspectStudent.phone || "—"}</div>
              <div><strong className="text-slate-500 block text-[10px] uppercase">Diplôme Entrée</strong> {inspectStudent.entryDiploma || "—"}</div>
              <div><strong className="text-slate-500 block text-[10px] uppercase">Parent / Tuteur</strong> {inspectStudent.guardianName || "—"}</div>
              <div><strong className="text-slate-500 block text-[10px] uppercase">Urgence</strong> {inspectStudent.guardianPhone || "—"}</div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                Historique des Inscriptions &amp; Promotions
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {inspectStudent.inscriptions?.map((insc) => (
                  <div key={insc.id} className="p-3 bg-white flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 block">{insc.classe?.label}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Cohorte : <strong className="text-blue-700">{insc.promotion?.label || "—"}</strong> • Session : {insc.academicYear?.label}
                      </span>
                    </div>
                    <span className="badge-slate uppercase font-bold text-[10px]">
                      {insc.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SlideOverDrawer>

      {/* 6. PORTAIL DES MODALES */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* MODALE IMPRESSION PLANCHE BADGES A4 */}
          {batchModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleGenerateBatch}
                className="w-full max-w-md rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="layers" className="text-blue-700 text-[20px]" />
                    <h3 className="text-sm font-bold text-slate-900">Impression Groupée (Planche A4)</h3>
                  </div>
                  <button type="button" onClick={() => setBatchModal(false)} className="text-slate-400 hover:text-slate-700">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Classe</label>
                    <select
                      required
                      value={batchForm.classeId}
                      onChange={(e) => setBatchForm({ ...batchForm, classeId: e.target.value })}
                      className="input-field w-full"
                    >
                      <option value="">Sélectionner une classe</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.label} ({c._count?.inscriptions || 0} apprenants)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Type d'acte</label>
                    <select
                      required
                      value={batchForm.type}
                      onChange={(e) => setBatchForm({ ...batchForm, type: e.target.value })}
                      className="input-field w-full"
                    >
                      <option value="CARTE_ETUDIANT">Planche Badges Duplex A4 (Recto/Verso avec repères)</option>
                      <option value="ATTESTATION_INSCRIPTION">Livret d'Attestations de Scolarité (Multi-pages)</option>
                    </select>
                  </div>
                </div>

                {modalError && <p className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setBatchModal(false)} className="btn-secondary">Annuler</button>
                  <button type="submit" disabled={generatingDoc || !batchForm.classeId} className="btn-primary">
                    {generatingDoc ? "Compilation en cours..." : "Générer la Planche PDF"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* VISIONNEUSE PDF MODALE */}
          <PdfViewerModal
            isOpen={Boolean(pdfModal)}
            title={pdfModal?.title}
            previewUrl={pdfModal?.previewUrl}
            downloadUrl={pdfModal?.downloadUrl}
            isReused={pdfModal?.reused}
            isRegenerating={generatingDoc}
            onForceRegenerate={pdfModal?.student ? () => handleGenerateSingle(pdfModal.student, pdfModal.type, true) : null}
            onClose={() => setPdfModal(null)}
          />

          {/* MODALE WEBCAM */}
          {showWebcam && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-xs">
              <div className="bg-white p-4 rounded-xl shadow-modal border border-slate-200 space-y-3 w-full max-w-md text-center">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-800">Prise de Photo par Webcam</h4>
                  <button onClick={stopWebcam} className="text-slate-400 hover:text-slate-700"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="w-[280px] h-[340px] mx-auto rounded-lg overflow-hidden bg-black relative border-2 border-blue-700">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                </div>
                <div className="flex justify-center gap-2">
                  <button onClick={stopWebcam} className="btn-secondary">Annuler</button>
                  <button onClick={() => capturePhoto(Boolean(editingStudent))} className="btn-primary">
                    <Icon name="photo_camera" className="text-[16px]" />
                    <span>Capturer</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODALE INSCRIPTION APPRENANT */}
          {showCreate && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleCreateStudent}
                className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Nouvelle Inscription d'Apprenant</h3>
                  <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-700">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Photo & Webcam */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="w-16 h-20 rounded bg-white border border-slate-300 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-inner">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                      ) : (
                        <Icon name="person" className="text-slate-300 text-[36px]" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <label className="cursor-pointer btn-secondary">
                          Fichier photo
                          <input type="file" accept="image/*" onChange={(e) => handlePhotoSelect(e, false)} className="hidden" />
                        </label>
                        <button type="button" onClick={startWebcam} className="btn-secondary">
                          <Icon name="photo_camera" className="text-[14px] text-blue-700" />
                          <span>Webcam</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500">Portrait 3:4 (JPEG ou PNG, max 3 Mo)</p>
                    </div>
                  </div>

                  {/* État Civil */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Nom *</label>
                      <input required placeholder="Nom" value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Prénom *</label>
                      <input required placeholder="Prénom" value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Genre</label>
                      <select value={createForm.gender} onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })} className="input-field w-full">
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Date de Naissance</label>
                      <input type="date" value={createForm.birthDate} onChange={(e) => setCreateForm({ ...createForm, birthDate: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Lieu de Naissance</label>
                      <input placeholder="Ex: Bafoussam" value={createForm.birthPlace} onChange={(e) => setCreateForm({ ...createForm, birthPlace: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Téléphone</label>
                      <input placeholder="Ex: 670000000" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} className="input-field w-full" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Parent / Tuteur</label>
                      <input placeholder="Nom du tuteur" value={createForm.guardianName} onChange={(e) => setCreateForm({ ...createForm, guardianName: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Tél. Urgence</label>
                      <input placeholder="Numéro d'urgence" value={createForm.guardianPhone} onChange={(e) => setCreateForm({ ...createForm, guardianPhone: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Diplôme d'entrée</label>
                      <select value={createForm.entryDiploma} onChange={(e) => setCreateForm({ ...createForm, entryDiploma: e.target.value })} className="input-field w-full">
                        <option value="Aucun">Sans diplôme</option>
                        <option value="CEP">CEP</option>
                        <option value="BEPC">BEPC</option>
                        <option value="CAP">CAP</option>
                        <option value="Probatoire">Probatoire</option>
                        <option value="BAC">Baccalauréat</option>
                      </select>
                    </div>
                  </div>

                  {/* Affectation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Session</label>
                      <select
                        required
                        value={createForm.academicYearId}
                        onChange={(e) => {
                          const yearId = e.target.value;
                          const matchingClasses = classes.filter((c) => c.academicYearId === yearId || c.academicYear?.isCurrent);
                          setCreateForm({ ...createForm, academicYearId: yearId, classeId: matchingClasses[0]?.id || "" });
                        }}
                        className="input-field w-full"
                      >
                        {academicYears.map((y) => (
                          <option key={y.id} value={y.id}>{y.label} {y.isCurrent ? "(Active)" : ""}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Classe d'affectation</label>
                      <select required value={createForm.classeId} onChange={(e) => setCreateForm({ ...createForm, classeId: e.target.value })} className="input-field w-full">
                        <option value="">Sélectionner une classe</option>
                        {classes.filter((c) => c.academicYearId === createForm.academicYearId || c.academicYear?.isCurrent).map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {modalError && <p className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Annuler</button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? "Inscription en cours..." : "Inscrire l'Apprenant"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* MODALE ÉDITION */}
          {editingStudent && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSaveEdit}
                className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Modifier le Dossier Apprenant</h3>
                    <span className="badge-blue font-mono font-bold">{editingStudent.matricule}</span>
                  </div>
                  <button type="button" onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-700">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="w-16 h-20 rounded bg-white border border-slate-300 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-inner">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                      ) : (
                        <Icon name="person" className="text-slate-300 text-[36px]" />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <label className="cursor-pointer btn-secondary">
                        Changer photo
                        <input type="file" accept="image/*" onChange={(e) => handlePhotoSelect(e, true)} className="hidden" />
                      </label>
                      <button type="button" onClick={startWebcam} className="btn-secondary">
                        <Icon name="photo_camera" className="text-[14px] text-blue-700" />
                        <span>Webcam</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Nom *</label>
                      <input required value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Prénom *</label>
                      <input required value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Genre</label>
                      <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className="input-field w-full">
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Date de Naissance</label>
                      <input type="date" value={editForm.birthDate} onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Lieu de Naissance</label>
                      <input value={editForm.birthPlace} onChange={(e) => setEditForm({ ...editForm, birthPlace: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Téléphone</label>
                      <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input-field w-full" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Parent / Tuteur</label>
                      <input value={editForm.guardianName} onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Tél. Urgence</label>
                      <input value={editForm.guardianPhone} onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 uppercase block mb-1">Diplôme d'entrée</label>
                      <input value={editForm.entryDiploma} onChange={(e) => setEditForm({ ...editForm, entryDiploma: e.target.value })} className="input-field w-full" />
                    </div>
                  </div>
                </div>

                {modalError && <p className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setEditingStudent(null)} className="btn-secondary">Annuler</button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* MODALE SUPPRESSION */}
          {deleteTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center gap-2 text-rose-600 border-b border-slate-200 pb-2">
                  <Icon name="warning" className="text-[20px]" />
                  <h3 className="text-sm font-bold text-slate-900">Archiver le dossier</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Archiver l'apprenant <strong>{deleteTarget.lastName} {deleteTarget.firstName}</strong> ({deleteTarget.matricule}) ? Le dossier sera déplacé dans le registre des archives historiques.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Annuler</button>
                  <button onClick={confirmDelete} className="btn-primary bg-rose-600 hover:bg-rose-700">Archiver</button>
                </div>
              </motion.div>
            </div>
          )}

          {restoreTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center gap-2 text-emerald-600 border-b border-slate-200 pb-2">
                  <Icon name="restore" className="text-[20px]" />
                  <h3 className="text-sm font-bold text-slate-900">Restaurer l'apprenant</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Réintégrer le dossier de <strong>{restoreTarget.firstName} {restoreTarget.lastName}</strong> dans le registre actif ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setRestoreTarget(null)} className="btn-secondary">Annuler</button>
                  <button onClick={confirmRestore} className="btn-primary bg-emerald-600 hover:bg-emerald-700">Confirmer la réintégration</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}