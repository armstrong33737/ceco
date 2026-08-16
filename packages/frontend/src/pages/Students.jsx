import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, API_BASE, getToken } from "../lib/apiClient";
import Icon from "../components/Icon";

const inputCls = "h-10 rounded-md bg-surface px-3.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full";

function StudentAvatar({ student, size = "md" }) {
  const [hasError, setHasError] = useState(false);
  const token = getToken();
  const photoUrl = student?.photoPath ? `${API_BASE}/students/${student.id}/photo?token=${token}` : null;
  const sizeCls = size === "xl" ? "w-20 h-20 text-base" : size === "lg" ? "w-14 h-14 text-sm" : "w-8 h-8 text-[11px]";

  if (photoUrl && !hasError) {
    return (
      <div className={`${sizeCls} rounded-md overflow-hidden bg-surface border border-outline-variant/30 flex-shrink-0 shadow-inner`}>
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
    <div className={`${sizeCls} rounded-md bg-primary-light border border-primary/20 text-primary font-bold flex items-center justify-center flex-shrink-0 shadow-2xs`}>
      {initials}
    </div>
  );
}

export default function Students() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Vue Active vs Archives
  const [viewMode, setViewMode] = useState("active"); // "active" | "archived"

  // Filtres
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedFiliereId, setSelectedFiliereId] = useState("");
  const [selectedClasseId, setSelectedClasseId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [search, setSearch] = useState("");

  // Modales
  const [showCreate, setShowCreate] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reinscribeTarget, setReinscribeTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [showImport, setShowImport] = useState(false);

  // Webcam Capture
  const [showWebcam, setShowWebcam] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Visionneuse & Impression PDF
  const [pdfModal, setPdfModal] = useState(null);
  const [batchModal, setBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({ classeId: "", type: "CARTE_ETUDIANT" });
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const iframeRef = useRef(null);

  // Formulaires
  const initialForm = {
    firstName: "", lastName: "", gender: "M", birthDate: "", birthPlace: "", phone: "",
    guardianName: "", guardianPhone: "", entryDiploma: "BEPC",
    matricule: "", classeId: "", academicYearId: "", photoDataUrl: null,
  };
  const [createForm, setCreateForm] = useState(initialForm);
  const [editForm, setEditForm] = useState(initialForm);
  const [reinscribeForm, setReinscribeForm] = useState({ classeId: "", academicYearId: "" });
  const [photoPreview, setPhotoPreview] = useState(null);

  // Import CSV
  const [importRows, setImportRows] = useState([]);
  const [importTarget, setImportTarget] = useState({ classeId: "", academicYearId: "" });
  const [importReport, setImportReport] = useState(null);

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const isArchived = viewMode === "archived";
      const [studentsData, classesData, filieresData, promoData, yearsData] = await Promise.all([
        apiFetch(`/students${isArchived ? "?onlyArchived=true" : ""}`),
        apiFetch("/classes").catch(() => []),
        apiFetch("/filieres").catch(() => []),
        apiFetch("/promotions").catch(() => []),
        apiFetch("/academic-years").catch(() => []),
      ]);
      setStudents(studentsData || []);
      setClasses(classesData || []);
      setFilieres(filieresData || []);
      setPromotions(promoData || []);
      setAcademicYears(yearsData || []);

      const current = (yearsData || []).find((y) => y.isCurrent);
      if (current && !selectedYearId) {
        setSelectedYearId(current.id);
      }
    } catch (err) {
      setError(err.message || "Impossible de charger la liste des étudiants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [viewMode]);

  const availableClassesForFilter = useMemo(() => {
    return classes.filter((c) => {
      const matchYear = !selectedYearId || c.academicYearId === selectedYearId;
      const matchFiliere = !selectedFiliereId || c.filiereId === selectedFiliereId;
      return matchYear && matchFiliere;
    });
  }, [classes, selectedYearId, selectedFiliereId]);

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
      setModalError("Impossible d'accéder à la webcam : " + err.message);
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
      await apiFetch("/students", { method: "POST", body: JSON.stringify(createForm) });
      setShowCreate(false);
      setPhotoPreview(null);
      setSuccessMsg("Apprenant inscrit avec succès.");
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
      setSuccessMsg("Dossier mis à jour avec succès.");
      await loadData();
    } catch (err) {
      setModalError(err.message || "Erreur de modification.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReinscribe(e) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      await apiFetch(`/students/${reinscribeTarget.id}/inscribe`, { method: "POST", body: JSON.stringify(reinscribeForm) });
      setReinscribeTarget(null);
      setSuccessMsg("Réinscription effectuée.");
      await loadData();
    } catch (err) {
      setModalError(err.message || "Erreur lors de la réinscription.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/students/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSuccessMsg("Apprenant archivé avec succès.");
      await loadData();
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) return;
    try {
      await apiFetch(`/students/${restoreTarget.id}/restore`, { method: "PUT" });
      setRestoreTarget(null);
      setSuccessMsg(`Apprenant ${restoreTarget.firstName} ${restoreTarget.lastName} réintégré dans le registre actif.`);
      await loadData();
    } catch (err) {
      setError(err.message);
      setRestoreTarget(null);
    }
  }

  async function handleExportCsv() {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/students-export?token=${token}`);
      if (!res.ok) throw new Error("Échec de l'export.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `apprenants_ceco_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(err.message);
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
      setSuccessMsg(res.message);
      await loadData();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateSingle(student, type, forceRegenerate = false) {
    setGeneratingDoc(true);
    setError(null);
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
      setError(err.message || "Erreur lors de la génération du document PDF.");
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
    } catch (err) {
      setModalError(err.message || "Erreur lors de la génération groupée.");
    } finally {
      setGeneratingDoc(false);
    }
  }

  function handlePrintClient() {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.focus();
      iframeRef.current.contentWindow?.print();
    }
  }

  const filteredStudents = students.filter((s) => {
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    const matricule = (s.matricule || "").toLowerCase();
    const query = search.toLowerCase();
    const matchesSearch = fullName.includes(query) || matricule.includes(query) || (s.phone || "").includes(query);

    const latestInsc = s.inscriptions?.[0];
    const matchesYear = !selectedYearId || latestInsc?.academicYearId === selectedYearId;
    const matchesFiliere = !selectedFiliereId || latestInsc?.classe?.filiereId === selectedFiliereId;
    const matchesClasse = !selectedClasseId || latestInsc?.classeId === selectedClasseId;
    const matchesStatus = !selectedStatus || latestInsc?.status === selectedStatus;

    return matchesSearch && matchesYear && matchesFiliere && matchesClasse && matchesStatus;
  });

  if (loading) return <p className="text-sm text-on-surface-variant font-medium">Chargement du registre...</p>;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-md max-w-7xl mx-auto">
      {/* En-tête avec bascule Actifs vs Archives */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-on-surface">
              {viewMode === "active" ? "Gestion des Apprenants" : "Registre des Archives & Traçabilité"}
            </h1>
            <span className="rounded-md bg-primary-light text-primary font-bold text-[11px] px-2 py-0.5">
              {filteredStudents.length} {viewMode === "active" ? "actif(s)" : "archivé(s)"}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {viewMode === "active"
              ? "Dossiers d'urgence, badges ID sécurisés, certificats et impression par classe."
              : "Historique immuable des anciens apprenants archivés avec possibilité de réintégration."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bascule Actifs / Archives */}
          <div className="flex p-0.5 bg-surface rounded-md border border-outline-variant/30">
            <button
              onClick={() => setViewMode("active")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewMode === "active" ? "bg-primary text-white shadow-xs" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Actifs
            </button>
            <button
              onClick={() => setViewMode("archived")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                viewMode === "archived" ? "bg-primary text-white shadow-xs" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name="archive" className="text-[14px]" />
              <span>Archives</span>
            </button>
          </div>

          {viewMode === "active" && (
            <>
              {/* Bouton Impression par Classe */}
              <button
                onClick={() => {
                  setModalError(null);
                  setBatchForm({
                    classeId: availableClassesForFilter[0]?.id || classes[0]?.id || "",
                    type: "CARTE_ETUDIANT",
                  });
                  setBatchModal(true);
                }}
                className="flex items-center gap-1.5 rounded-md bg-primary-light border border-primary/20 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all shadow-xs"
              >
                <Icon name="layers" className="text-[16px]" />
                <span>Impression par Classe (A4)</span>
              </button>

              <button
                onClick={() => {
                  setModalError(null);
                  setImportRows([]);
                  setImportReport(null);
                  setImportTarget({
                    classeId: availableClassesForFilter[0]?.id || classes[0]?.id || "",
                    academicYearId: selectedYearId || academicYears[0]?.id || "",
                  });
                  setShowImport(true);
                }}
                className="flex items-center gap-1.5 rounded-md border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors shadow-xs"
              >
                <Icon name="upload_file" className="text-[16px]" />
                <span>Importer CSV</span>
              </button>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 rounded-md border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors shadow-xs"
              >
                <Icon name="download" className="text-[16px]" />
                <span>Exporter CSV</span>
              </button>
              <button
                onClick={() => {
                  setModalError(null);
                  const activeYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
                  const eligibleClasses = classes.filter((c) => c.academicYearId === activeYear?.id || c.academicYear?.isCurrent);
                  setCreateForm({
                    ...initialForm,
                    academicYearId: activeYear?.id || "",
                    classeId: eligibleClasses[0]?.id || classes[0]?.id || "",
                  });
                  setPhotoPreview(null);
                  setShowCreate(true);
                }}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark transition-colors shadow-xs"
              >
                <Icon name="person_add" className="text-[16px]" />
                <span>Nouvel Apprenant</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-error-container p-md text-sm text-error border border-error/20 flex items-center justify-between">
          <p className="text-xs font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-bold underline">Fermer</button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-md bg-success-light p-md text-sm text-success border border-success/20 flex items-center justify-between">
          <p className="text-xs font-semibold">{successMsg}</p>
          <button onClick={() => setSuccessMsg("")} className="text-xs font-bold underline">Fermer</button>
        </div>
      )}

      {/* Filtres hiérarchiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">1. Session</label>
          <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)} className={inputCls}>
            <option value="">Toutes les sessions</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.label} {y.isCurrent ? "(En cours)" : ""}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">2. Filière</label>
          <select value={selectedFiliereId} onChange={(e) => setSelectedFiliereId(e.target.value)} className={inputCls}>
            <option value="">Toutes les filières</option>
            {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">3. Classe</label>
          <select value={selectedClasseId} onChange={(e) => setSelectedClasseId(e.target.value)} className={inputCls}>
            <option value="">Toutes les classes</option>
            {availableClassesForFilter.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">4. Statut</label>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className={inputCls}>
            <option value="">Tous les statuts</option>
            <option value="en_cours">En cours</option>
            <option value="admis">Admis</option>
            <option value="redouble">Redouble</option>
            <option value="diplome">Diplômé</option>
            <option value="abandon">Abandon</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">5. Recherche</label>
          <input placeholder="Nom, matricule, contact..." value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Tableau des apprenants */}
      <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
        {filteredStudents.length === 0 ? (
          <p className="p-lg text-xs text-on-surface-variant text-center">
            {viewMode === "active" ? "Aucun apprenant actif trouvé." : "Aucun dossier archivé."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-outline-variant/30 font-semibold uppercase text-on-surface-variant bg-surface">
                  <th className="px-md py-3">Matricule</th>
                  <th className="px-md py-3">Apprenant</th>
                  <th className="px-md py-3">Dernière Classe &amp; Cohorte</th>
                  <th className="px-md py-3">
                    {viewMode === "active" ? "Urgence (Tuteur)" : "Date d'Archivage"}
                  </th>
                  <th className="px-md py-3">Statut</th>
                  <th className="px-md py-3 text-right">Actions &amp; Traçabilité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {filteredStudents.map((s) => {
                  const currentInsc = s.inscriptions?.[0];
                  return (
                    <tr key={s.id} className="hover:bg-surface-container/20 transition-colors">
                      <td className="px-md py-3 font-mono font-bold text-primary">{s.matricule}</td>
                      <td className="px-md py-3">
                        <div className="flex items-center gap-2.5">
                          <StudentAvatar student={s} size="md" />
                          <div>
                            <div className="font-bold text-on-surface">{s.lastName} {s.firstName}</div>
                            <div className="text-[10px] text-on-surface-variant font-mono">
                              {s.gender === "F" ? "Féminin" : "Masculin"} • {s.birthDate ? new Date(s.birthDate).toLocaleDateString("fr-FR") : "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-md py-3 font-medium text-on-surface">
                        <div>{currentInsc?.classe?.label || "Non assigné"}</div>
                        <div className="text-[10px] text-on-surface-variant font-mono">{currentInsc?.promotion?.label || "—"}</div>
                      </td>
                      <td className="px-md py-3 text-on-surface-variant">
                        {viewMode === "active" ? (
                          <>
                            <div className="font-semibold text-on-surface">{s.guardianName || "—"}</div>
                            <div className="text-[10px] font-mono">{s.guardianPhone || s.phone || "—"}</div>
                          </>
                        ) : (
                          <div className="font-mono text-error font-semibold">
                            {s.deletedAt ? new Date(s.deletedAt).toLocaleString("fr-FR") : "—"}
                          </div>
                        )}
                      </td>
                      <td className="px-md py-3">
                        {viewMode === "active" ? (
                          <span className={`rounded-md px-2 py-0.5 font-bold text-[10px] uppercase border ${
                            currentInsc?.status === "diplome"
                              ? "bg-success-light text-success border-success/20"
                              : currentInsc?.status === "admis"
                              ? "bg-success-light text-success border-success/20"
                              : currentInsc?.status === "redouble" || currentInsc?.status === "abandon"
                              ? "bg-error-container text-error border-error/20"
                              : "bg-primary-light text-primary border-primary/20"
                          }`}>
                            {currentInsc?.status || "en_cours"}
                          </span>
                        ) : (
                          <span className="rounded-md bg-error-container text-error border border-error/20 px-2 py-0.5 font-bold text-[10px] uppercase">
                            Archivé
                          </span>
                        )}
                      </td>
                      <td className="px-md py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {viewMode === "active" ? (
                            <>
                              <button
                                onClick={() => handleGenerateSingle(s, "CARTE_ETUDIANT")}
                                disabled={generatingDoc}
                                className="rounded-md bg-primary-light border border-primary/20 px-2 py-1 text-primary font-bold hover:bg-primary hover:text-white transition-all text-[11px] flex items-center gap-1 shadow-2xs"
                                title="Consulter la carte d'apprenant (Badge)"
                              >
                                <Icon name="badge" className="text-[14px]" />
                                <span>Carte</span>
                              </button>

                              <button
                                onClick={() => handleGenerateSingle(s, "ATTESTATION_INSCRIPTION")}
                                disabled={generatingDoc}
                                className="rounded-md border border-outline-variant px-2 py-1 text-on-surface font-semibold hover:bg-surface-container transition-colors text-[11px] shadow-2xs"
                                title="Consulter le certificat de scolarité"
                              >
                                Certificat
                              </button>

                              <button
                                onClick={() => handleGenerateSingle(s, "FICHE_INSCRIPTION")}
                                disabled={generatingDoc}
                                className="rounded-md border border-outline-variant px-2 py-1 text-on-surface font-semibold hover:bg-surface-container transition-colors text-[11px] shadow-2xs"
                                title="Consulter la fiche d'inscription individuelle"
                              >
                                Fiche
                              </button>

                              <button
                                onClick={() => setSelectedStudent(s)}
                                className="rounded-md border border-outline-variant px-2 py-1 text-on-surface-variant font-semibold hover:bg-surface-container transition-colors text-[11px]"
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
                                    matricule: s.matricule,
                                    photoDataUrl: null,
                                  });
                                  setPhotoPreview(s.photoPath ? `${API_BASE}/students/${s.id}/photo?token=${getToken()}` : null);
                                }}
                                className="rounded-md border border-outline-variant px-2 py-1 text-on-surface-variant hover:text-primary transition-colors text-[11px]"
                              >
                                Éditer
                              </button>

                              <button
                                onClick={() => setDeleteTarget(s)}
                                className="text-error hover:bg-error-container/20 p-1 rounded-md transition-colors"
                                title="Archiver ce dossier"
                              >
                                <Icon name="delete" className="text-[16px]" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setSelectedStudent(s)}
                                className="rounded-md border border-outline-variant px-2.5 py-1 text-on-surface font-semibold hover:bg-surface-container transition-colors text-[11px]"
                              >
                                Dossier Historique
                              </button>
                              <button
                                onClick={() => setRestoreTarget(s)}
                                className="rounded-md bg-success-light border border-success/20 px-2.5 py-1 text-success font-bold hover:bg-success hover:text-white transition-all text-[11px] flex items-center gap-1 shadow-2xs"
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

      {/* PORTAIL DES MODALES */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* 1. MODALE IMPRESSION GROUPÉE PAR CLASSE (PLANCHE A4) */}
          {batchModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleGenerateBatch}
                className="w-full max-w-md rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="layers" className="text-primary text-[20px]" />
                    <h3 className="text-sm font-bold text-on-surface">Impression par Classe (Planche A4)</h3>
                  </div>
                  <button type="button" onClick={() => setBatchModal(false)} className="text-on-surface-variant hover:text-on-surface">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Classe sélectionnée</label>
                    <select
                      required
                      value={batchForm.classeId}
                      onChange={(e) => setBatchForm({ ...batchForm, classeId: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">Sélectionner une classe</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.label} ({c._count?.inscriptions || 0} apprenants)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Type d'acte à compiler</label>
                    <select
                      required
                      value={batchForm.type}
                      onChange={(e) => setBatchForm({ ...batchForm, type: e.target.value })}
                      className={inputCls}
                    >
                      <option value="CARTE_ETUDIANT">Planche Badges Duplex A4 (Recto/Verso avec repères)</option>
                      <option value="ATTESTATION_INSCRIPTION">Livret d'Attestations A4 (Multi-pages)</option>
                    </select>
                  </div>
                </div>

                {modalError && <p className="rounded-md bg-error-container px-3 py-2 text-xs text-error font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button type="button" onClick={() => setBatchModal(false)} className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={generatingDoc || !batchForm.classeId}
                    className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    {generatingDoc ? (
                      <>
                        <Icon name="progress_activity" className="animate-spin text-[16px]" />
                        <span>Compilation PDF serveur...</span>
                      </>
                    ) : (
                      <>
                        <Icon name="print" className="text-[16px]" />
                        <span>Compiler le document A4</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 2. VISIONNEUSE PDF AVEC IMPRESSION CLIENTE & TÉLÉCHARGEMENT */}
          {pdfModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-5xl rounded-md bg-white p-md sm:p-lg shadow-2xl border border-outline-variant/30 space-y-md h-[92vh] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Icon name="picture_as_pdf" className="text-error text-[22px]" />
                    <h3 className="text-sm font-bold text-on-surface truncate max-w-xl">
                      {pdfModal.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrintClient}
                      className="rounded-md bg-primary-light border border-primary/20 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-white flex items-center gap-1.5 shadow-xs transition-all"
                    >
                      <Icon name="print" className="text-[16px]" />
                      <span>Imprimer sur client</span>
                    </button>
                    <a
                      href={pdfModal.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Icon name="download" className="text-[16px]" />
                      <span>Télécharger le PDF</span>
                    </a>
                    <button onClick={() => setPdfModal(null)} className="text-on-surface-variant hover:text-on-surface p-1">
                      <Icon name="close" className="text-[20px]" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 w-full bg-surface-container rounded-md overflow-hidden border border-outline-variant/30 shadow-inner">
                  <iframe
                    ref={iframeRef}
                    src={pdfModal.previewUrl}
                    title="Aperçu PDF CECO"
                    className="w-full h-full border-none rounded-md"
                  />
                </div>

                <div className="flex justify-between items-center text-xs text-on-surface-variant pt-2 border-t border-outline-variant/15 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-success font-semibold flex items-center gap-1">
                      <Icon name="lock" className="text-[14px]" />
                      {pdfModal.reused ? "Document original archivé (visuel figé à l'émission)" : "Nouvel acte certifié émis"}
                    </span>
                    {pdfModal.student && (
                      <button
                        onClick={() => handleGenerateSingle(pdfModal.student, pdfModal.type, true)}
                        className="text-[10px] font-bold text-primary underline hover:opacity-80 ml-3"
                      >
                        Émettre une nouvelle version (Appliquer la charte actuelle)
                      </button>
                    )}
                  </div>
                  <button onClick={() => setPdfModal(null)} className="font-semibold text-primary hover:underline">
                    Fermer la visionneuse
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* 3. MODALE CONFIRMATION DE RESTAURATION D'ARCHIVE */}
          {restoreTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center gap-2 text-success">
                  <Icon name="restore" className="text-[22px]" />
                  <h3 className="text-base font-bold text-on-surface">Restaurer l'apprenant</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Réintégrer le dossier de <strong>{restoreTarget.firstName} {restoreTarget.lastName}</strong> ({restoreTarget.matricule}) dans le registre actif ? Ses inscriptions et historiques restent intacts.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button onClick={() => setRestoreTarget(null)} className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">
                    Annuler
                  </button>
                  <button onClick={confirmRestore} className="rounded-md bg-success px-4 py-2 text-xs font-bold text-white hover:opacity-90 shadow-xs">
                    Confirmer la réintégration
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* 4. MODALE IMPORTATION CSV */}
          {showImport && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleExecuteImport}
                className="w-full max-w-xl rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <h3 className="text-sm font-bold text-on-surface">Importer des Apprenants par CSV</h3>
                  <button type="button" onClick={() => setShowImport(false)} className="text-on-surface-variant hover:text-on-surface">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Session active</label>
                      <select required value={importTarget.academicYearId} onChange={(e) => setImportTarget({ ...importTarget, academicYearId: e.target.value })} className={inputCls}>
                        {academicYears.filter((y) => y.isCurrent).map((y) => (
                          <option key={y.id} value={y.id}>{y.label} (Active)</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Classe d'inscription</label>
                      <select required value={importTarget.classeId} onChange={(e) => setImportTarget({ ...importTarget, classeId: e.target.value })} className={inputCls}>
                        {classes.filter((c) => c.academicYear?.isCurrent).map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-4 border-2 border-dashed border-outline-variant/60 rounded-md text-center bg-surface space-y-2">
                    <Icon name="file_upload" className="text-3xl text-primary" />
                    <p className="text-xs font-semibold text-on-surface">Sélectionner un fichier CSV</p>
                    <p className="text-[11px] text-on-surface-variant">Colonnes : Matricule; Nom; Prenom; Genre; DateNaissance; LieuNaissance; Telephone; Tuteur; TelUrgence; DiplomeEntree</p>
                    <input type="file" accept=".csv,text/csv" onChange={handleCsvFileSelect} className="text-xs mx-auto" />
                  </div>

                  {importRows.length > 0 && !importReport && (
                    <div className="p-2.5 rounded-md bg-primary-light text-primary text-xs font-bold">
                      {importRows.length} ligne(s) d'apprenants prêtes à être analysées.
                    </div>
                  )}

                  {importReport && (
                    <div className="p-3 rounded-md bg-surface border border-outline-variant/30 space-y-2 text-xs">
                      <div className="font-bold text-success flex items-center gap-1.5">
                        <Icon name="check_circle" className="text-[18px]" />
                        <span>{importReport.createdCount} apprenant(s) importé(s) avec succès.</span>
                      </div>
                      {importReport.errors?.length > 0 && (
                        <div className="space-y-1 text-error">
                          <p className="font-bold">{importReport.errors.length} anomalie(s) ignorée(s) :</p>
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px] max-h-32 overflow-y-auto">
                            {importReport.errors.map((err, i) => (
                              <li key={i}>Ligne {err.row} {err.matricule ? `(${err.matricule})` : ""} : {err.reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {modalError && <p className="rounded-md bg-error-container px-3 py-2 text-xs text-error font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button type="button" onClick={() => setShowImport(false)} className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">Fermer</button>
                  <button type="submit" disabled={saving || importRows.length === 0} className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark disabled:opacity-50">
                    {saving ? "Importation..." : "Lancer l'import"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 5. MODALE WEBCAM CAPTURE */}
          {showWebcam && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-xs">
              <div className="bg-white p-4 rounded-md shadow-2xl border border-outline-variant/30 space-y-3 w-full max-w-md text-center">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="text-xs font-bold uppercase text-on-surface">Prise de photo par Webcam</h4>
                  <button onClick={stopWebcam} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="w-[300px] h-[360px] mx-auto rounded-md overflow-hidden bg-black relative border-2 border-primary">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-white/50 rounded-md m-4" />
                </div>
                <div className="flex justify-center gap-2">
                  <button onClick={stopWebcam} className="rounded-md px-3 py-1.5 text-xs font-semibold border">Annuler</button>
                  <button onClick={() => capturePhoto(Boolean(editingStudent))} className="rounded-md bg-primary px-4 py-1.5 text-xs font-bold text-white flex items-center gap-1 shadow-xs">
                    <Icon name="photo_camera" className="text-[16px]" />
                    <span>Capturer la photo</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6. MODALE CRÉATION APPRENANT */}
          {showCreate && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleCreateStudent}
                className="w-full max-w-2xl rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <h3 className="text-sm font-bold text-on-surface">Inscription d'un Nouvel Apprenant (Fiche Complète)</h3>
                  <button type="button" onClick={() => setShowCreate(false)} className="text-on-surface-variant hover:text-on-surface">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 rounded-md bg-surface border border-outline-variant/20">
                    <div className="w-20 h-24 rounded-md bg-white border border-outline-variant/30 overflow-hidden flex items-center justify-center shadow-inner flex-shrink-0">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                      ) : (
                        <Icon name="account_circle" className="text-on-surface-variant/30 text-[42px]" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <label className="cursor-pointer rounded-md border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary bg-white hover:bg-primary-light transition-all inline-block shadow-xs">
                          Fichier image
                          <input type="file" accept="image/*" onChange={(e) => handlePhotoSelect(e, false)} className="hidden" />
                        </label>
                        <button
                          type="button"
                          onClick={startWebcam}
                          className="rounded-md bg-primary-light border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all flex items-center gap-1 shadow-xs"
                        >
                          <Icon name="photo_camera" className="text-[16px]" />
                          <span>Prendre par Webcam</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-on-surface-variant">Format portrait 3:4 centré (PNG ou JPG 2 Mo max)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Nom de famille *</label>
                      <input required placeholder="Nom" value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Prénom(s) *</label>
                      <input required placeholder="Prénom" value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Genre *</label>
                      <select value={createForm.gender} onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })} className={inputCls}>
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Date de naissance</label>
                      <input type="date" value={createForm.birthDate} onChange={(e) => setCreateForm({ ...createForm, birthDate: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Lieu de naissance</label>
                      <input placeholder="Ex: Bafoussam" value={createForm.birthPlace} onChange={(e) => setCreateForm({ ...createForm, birthPlace: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Contact Apprenant</label>
                      <input placeholder="Ex: 670000000" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} className={inputCls} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-surface rounded-md border border-outline-variant/20">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Parent / Tuteur légal</label>
                      <input placeholder="Nom du tuteur" value={createForm.guardianName} onChange={(e) => setCreateForm({ ...createForm, guardianName: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Téléphone d'urgence *</label>
                      <input placeholder="Numéro du tuteur" value={createForm.guardianPhone} onChange={(e) => setCreateForm({ ...createForm, guardianPhone: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Niveau / Diplôme d'entrée</label>
                      <select value={createForm.entryDiploma} onChange={(e) => setCreateForm({ ...createForm, entryDiploma: e.target.value })} className={inputCls}>
                        <option value="Aucun">Sans diplôme</option>
                        <option value="CEP">CEP / Primary</option>
                        <option value="BEPC">BEPC / O-Level</option>
                        <option value="CAP">CAP Professionnel</option>
                        <option value="Probatoire">Probatoire</option>
                        <option value="BAC">Baccalauréat / A-Level</option>
                        <option value="Superieur">BTS / Licence</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-outline-variant/15">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Matricule</label>
                      <input placeholder="Laisser vide pour auto" value={createForm.matricule} onChange={(e) => setCreateForm({ ...createForm, matricule: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Session active</label>
                      <select
                        required
                        value={createForm.academicYearId}
                        onChange={(e) => {
                          const newYearId = e.target.value;
                          const matchingClasses = classes.filter((c) => c.academicYearId === newYearId);
                          setCreateForm({
                            ...createForm,
                            academicYearId: newYearId,
                            classeId: matchingClasses[0]?.id || "",
                          });
                        }}
                        className={inputCls}
                      >
                        {academicYears.map((y) => (
                          <option key={y.id} value={y.id}>{y.label} {y.isCurrent ? "(Session Active)" : ""}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Classe d'affectation</label>
                      <select required value={createForm.classeId} onChange={(e) => setCreateForm({ ...createForm, classeId: e.target.value })} className={inputCls}>
                        <option value="">Sélectionner une classe</option>
                        {classes.filter((c) => c.academicYear?.isCurrent).map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {modalError && <p className="rounded-md bg-error-container px-3 py-2 text-xs text-error font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button type="button" onClick={() => setShowCreate(false)} className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">Annuler</button>
                  <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark">
                    {saving ? "Enregistrement..." : "Inscrire au registre"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 7. MODALE MODIFICATION */}
          {editingStudent && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSaveEdit}
                className="w-full max-w-2xl rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <h3 className="text-sm font-bold text-on-surface">Modifier le Dossier Apprenant</h3>
                  <button type="button" onClick={() => setEditingStudent(null)} className="text-on-surface-variant hover:text-on-surface">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 rounded-md bg-surface border border-outline-variant/20">
                    <div className="w-20 h-24 rounded-md bg-white border border-outline-variant/30 overflow-hidden flex items-center justify-center shadow-inner flex-shrink-0">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                      ) : (
                        <Icon name="account_circle" className="text-on-surface-variant/30 text-[42px]" />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <label className="cursor-pointer rounded-md border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary bg-white hover:bg-primary-light transition-all inline-block shadow-xs">
                        Changer photo
                        <input type="file" accept="image/*" onChange={(e) => handlePhotoSelect(e, true)} className="hidden" />
                      </label>
                      <button
                        type="button"
                        onClick={startWebcam}
                        className="rounded-md bg-primary-light border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all flex items-center gap-1 shadow-xs"
                      >
                        <Icon name="photo_camera" className="text-[16px]" />
                        <span>Webcam</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Nom *</label>
                      <input required value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Prénom *</label>
                      <input required value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Genre</label>
                      <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className={inputCls}>
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Date de naissance</label>
                      <input type="date" value={editForm.birthDate} onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Lieu de naissance</label>
                      <input value={editForm.birthPlace} onChange={(e) => setEditForm({ ...editForm, birthPlace: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Contact Apprenant</label>
                      <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inputCls} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-surface rounded-md border border-outline-variant/20">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Parent / Tuteur</label>
                      <input value={editForm.guardianName} onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Téléphone d'urgence</label>
                      <input value={editForm.guardianPhone} onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Diplôme d'entrée</label>
                      <input value={editForm.entryDiploma} onChange={(e) => setEditForm({ ...editForm, entryDiploma: e.target.value })} className={inputCls} />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Matricule</label>
                    <input required value={editForm.matricule} onChange={(e) => setEditForm({ ...editForm, matricule: e.target.value })} className={inputCls} />
                  </div>
                </div>

                {modalError && <p className="rounded-md bg-error-container px-3 py-2 text-xs text-error font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button type="button" onClick={() => setEditingStudent(null)} className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">Annuler</button>
                  <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark">
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 8. MODALE DOSSIER APPRENANT */}
          {selectedStudent && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-2xl rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <div className="flex items-center gap-3">
                    <StudentAvatar student={selectedStudent} size="xl" />
                    <div>
                      <h3 className="text-base font-bold text-on-surface">{selectedStudent.lastName} {selectedStudent.firstName}</h3>
                      <span className="text-xs font-mono font-bold text-primary">{selectedStudent.matricule}</span>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        {selectedStudent.gender === "F" ? "Féminin" : "Masculin"} • Né(e) le {selectedStudent.birthDate ? new Date(selectedStudent.birthDate).toLocaleDateString("fr-FR") : "—"}{selectedStudent.birthPlace ? ` à ${selectedStudent.birthPlace}` : ""}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedStudent(null)} className="text-on-surface-variant hover:text-on-surface">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs p-3 bg-surface rounded-md border border-outline-variant/30">
                  <div><strong>Téléphone :</strong> {selectedStudent.phone || "—"}</div>
                  <div><strong>Diplôme d'entrée :</strong> {selectedStudent.entryDiploma || "—"}</div>
                  <div><strong>Tuteur / Urgence :</strong> {selectedStudent.guardianName || "—"}</div>
                  <div><strong>Contact d'urgence :</strong> {selectedStudent.guardianPhone || "—"}</div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Historique académique &amp; promotions</h4>
                  <div className="divide-y divide-outline-variant/15 border border-outline-variant/30 rounded-md overflow-hidden">
                    {selectedStudent.inscriptions?.map((insc) => (
                      <div key={insc.id} className="p-3 bg-surface-container-lowest flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-on-surface">{insc.classe?.label}</span>
                          <div className="text-[11px] text-on-surface-variant mt-0.5">
                            Cohorte : <span className="font-mono font-semibold text-primary">{insc.promotion?.label || "—"}</span> • Session : {insc.academicYear?.label}
                          </div>
                        </div>
                        <span className="rounded-md bg-surface px-2 py-0.5 font-bold border border-outline-variant/30 uppercase text-[10px]">
                          {insc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-outline-variant/20">
                  <button onClick={() => setSelectedStudent(null)} className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">
                    Fermer
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* 9. MODALE ARCHIVAGE */}
          {deleteTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center gap-2 text-error">
                  <Icon name="warning" className="text-[20px]" />
                  <h3 className="text-sm font-bold text-on-surface">Archiver le dossier</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Archiver l'apprenant <strong>{deleteTarget.lastName} {deleteTarget.firstName}</strong> ({deleteTarget.matricule}) ? Le dossier sera déplacé dans le registre des archives historiques et pourra être restauré à tout moment.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button onClick={() => setDeleteTarget(null)} className="rounded-md px-3.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">Annuler</button>
                  <button onClick={confirmDelete} className="rounded-md bg-error px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-90">Archiver</button>
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