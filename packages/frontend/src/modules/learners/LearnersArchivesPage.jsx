// packages/frontend/src/modules/learners/LearnersArchivesPage.jsx
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
import LearnerDrawer from "./components/LearnerDrawer";
import DocumentViewerModal from "../documents/components/DocumentViewerModal";
import Icon from "../../components/Icon";

export default function LearnersArchivesPage() {
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
  const [search, setSearch] = useState("");

  const [inspectStudent, setInspectStudent] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [pdfModal, setPdfModal] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        onlyArchived: "true",
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(selectedClasseId ? { classeId: selectedClasseId } : {}),
        ...(selectedFiliereId ? { filiereId: selectedFiliereId } : {}),
        ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
      });

      const [studentsRes, classesData, filieresData, yearsData] = await Promise.all([
        apiFetch(`/students?${params.toString()}`),
        apiFetch("/classes").catch(() => []),
        apiFetch("/filieres").catch(() => []),
        apiFetch("/academic-years").catch(() => []),
      ]);

      setStudents(studentsRes.data || []);
      setPaginationMeta(studentsRes.pagination || null);
      setClasses(classesData || []);
      setFilieres(filieresData || []);
      setAcademicYears(yearsData || []);
    } catch (err) {
      showToast(err.message || "Erreur de chargement des archives.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [page, limit, selectedYearId, selectedFiliereId, selectedClasseId, search]);

  async function confirmRestore() {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await apiFetch(`/students/${restoreTarget.id}/restore`, { method: "PUT" });
      showToast(`Le dossier de ${restoreTarget.firstName} ${restoreTarget.lastName} a été réintégré dans le registre actif.`, "success");
      setRestoreTarget(null);
      await loadData();
    } catch (err) {
      showToast(err.message || "Impossible de restaurer ce dossier.", "error");
    } finally {
      setRestoring(false);
    }
  }

  async function handleExportCsv() {
    try {
      const token = getToken();
      const params = new URLSearchParams({
        onlyArchived: "true",
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(selectedClasseId ? { classeId: selectedClasseId } : {}),
        ...(selectedFiliereId ? { filiereId: selectedFiliereId } : {}),
        ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
      });

      const res = await fetch(`${API_BASE}/students-export?${params.toString()}&token=${token}`);
      if (!res.ok) throw new Error("Échec de l'export.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `archives_apprenants_ceco_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Fichier CSV des archives exporté.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleGenerateSingle(student, type) {
    try {
      const currentInsc = student.inscriptions?.[0];
      const res = await apiFetch("/documents/generate", {
        method: "POST",
        body: JSON.stringify({
          studentId: student.id,
          type,
          classeId: currentInsc?.classeId,
          forceRegenerate: false,
        }),
      });
      const token = getToken();
      setPdfModal({
        title: `Archive : ${student.lastName} ${student.firstName}`,
        downloadUrl: `${API_BASE}${res.document.downloadUrl}?token=${token}`,
        previewUrl: `${API_BASE}${res.document.previewUrl}?token=${token}`,
        student,
        type,
        reused: true,
      });
    } catch (err) {
      showToast(err.message || "Erreur de consultation de l'archive PDF.", "error");
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="error">Scolarité • Registre des Archives</Badge>}
        title="Archives des Apprenants"
        subtitle="Historique immuable des anciens dossiers archivés avec possibilité de réintégration au registre actif"
        actions={
          <Button variant="secondary" icon="download" onClick={handleExportCsv}>
            Exporter CSV Archives
          </Button>
        }
      />

      <StructuredPanel
        title="Filtres des Archives"
        subtitle="Recherche ciblée dans les registres historiques scellés"
        icon="history"
      >
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Select label="Session d'origine" value={selectedYearId} onChange={(e) => { setSelectedYearId(e.target.value); setPage(1); }}>
            <option value="">Toutes les sessions</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </Select>

          <Select label="Filière" value={selectedFiliereId} onChange={(e) => { setSelectedFiliereId(e.target.value); setPage(1); }}>
            <option value="">Toutes les filières</option>
            {filieres.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>

          <Select label="Classe" value={selectedClasseId} onChange={(e) => { setSelectedClasseId(e.target.value); setPage(1); }}>
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>

          <Input label="Recherche matricule, nom" placeholder="Ex: STU26-0042..." value={search} leftIcon="search" onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </StructuredPanel>

      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        {loading && !paginationMeta ? (
          <p className="p-8 text-caption text-ink-muted text-center">Chargement des archives...</p>
        ) : students.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Icon name="archive" className="text-4xl text-ink-muted" />
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Aucun dossier archivé</h3>
            <p className="text-caption text-ink-muted">Aucun apprenant archivé dans cette sélection.</p>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="w-28">Matricule</TableHeaderCell>
                <TableHeaderCell>Apprenant</TableHeaderCell>
                <TableHeaderCell>Dernière Classe</TableHeaderCell>
                <TableHeaderCell>Date d'Archivage</TableHeaderCell>
                <TableHeaderCell align="right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id} isClickable onClick={() => setInspectStudent(s)}>
                  <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{s.matricule}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-ink-primary dark:text-white">{s.lastName} {s.firstName}</div>
                    <div className="text-caption text-ink-muted">{s.gender === "F" ? "Féminin" : "Masculin"}</div>
                  </TableCell>
                  <TableCell>{s.inscriptions?.[0]?.classe?.label || "—"}</TableCell>
                  <TableCell className="font-mono text-caption text-error font-medium">
                    {s.deletedAt ? new Date(s.deletedAt).toLocaleString("fr-FR") : "—"}
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="tertiary" size="sm" onClick={() => setInspectStudent(s)}>
                        Dossier Historique
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="restore"
                        onClick={() => setRestoreTarget(s)}
                      >
                        Restaurer
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <TablePagination
        pagination={paginationMeta}
        onPageChange={setPage}
        onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
      />

      <LearnerDrawer
        isOpen={Boolean(inspectStudent)}
        onClose={() => setInspectStudent(null)}
        student={inspectStudent}
        onEdit={() => {}}
        onGenerateDoc={handleGenerateSingle}
      />

      <ConfirmDialog
        isOpen={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        onConfirm={confirmRestore}
        title="Restaurer l'apprenant dans le registre actif"
        description={`Réintégrer le dossier de ${restoreTarget?.lastName} ${restoreTarget?.firstName} (${restoreTarget?.matricule}) dans la scolarité active ? Ses historiques et notes restent parfaitement intacts.`}
        confirmLabel="Confirmer la Restauration"
        variant="primary"
        isLoading={restoring}
      />

      <DocumentViewerModal
        isOpen={Boolean(pdfModal)}
        title={pdfModal?.title}
        previewUrl={pdfModal?.previewUrl}
        downloadUrl={pdfModal?.downloadUrl}
        isReused={true}
        onClose={() => setPdfModal(null)}
      />
    </motion.div>
  );
}