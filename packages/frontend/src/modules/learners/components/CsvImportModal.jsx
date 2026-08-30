// packages/frontend/src/modules/learners/components/CsvImportModal.jsx
import React from "react";
import Modal from "../../../design-system/overlays/Modal";
import Button from "../../../design-system/primitives/Button";
import Select from "../../../design-system/primitives/Select";
import Badge from "../../../design-system/primitives/Badge";
import Icon from "../../../components/Icon";

export default function CsvImportModal({
  isOpen,
  onClose,
  importTarget,
  setImportTarget,
  classes = [],
  academicYears = [],
  importRows = [],
  importReport = null,
  onFileSelect,
  onSubmit,
  isLoading = false,
  error = null,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importer des Apprenants par Fichier CSV"
      subtitle="Importation en masse avec auto-génération des matricules officiels"
      icon="upload_file"
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isLoading} disabled={importRows.length === 0}>
            Lancer l'Importation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select
            required
            label="Session Académique"
            value={importTarget.academicYearId}
            onChange={(e) => {
              const yId = e.target.value;
              const mClasses = classes.filter((c) => c.academicYearId === yId || c.academicYear?.isCurrent);
              setImportTarget({ academicYearId: yId, classeId: mClasses[0]?.id || "" });
            }}
          >
            {academicYears.filter((y) => y.isCurrent).map((y) => (
              <option key={y.id} value={y.id}>{y.label} (Active)</option>
            ))}
          </Select>

          <Select
            required
            label="Classe d'inscription"
            value={importTarget.classeId}
            onChange={(e) => setImportTarget({ ...importTarget, classeId: e.target.value })}
          >
            {classes.filter((c) => c.academicYearId === importTarget.academicYearId || c.academicYear?.isCurrent).map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </Select>
        </div>

        <div className="p-6 border-2 border-dashed border-border rounded text-center bg-[#F5F7FA] space-y-2 dark:bg-[#07111D] dark:border-border-dark">
          <Icon name="file_upload" className="text-3xl text-brand-900 dark:text-brand-500" />
          <p className="text-body-md font-semibold text-ink-primary dark:text-white">Sélectionner un fichier CSV</p>
          <p className="text-caption text-ink-muted">Colonnes : Matricule; Nom; Prenom; Genre; DateNaissance; LieuNaissance; Telephone; Tuteur; TelUrgence; DiplomeEntree</p>
          <input type="file" accept=".csv,text/csv" onChange={onFileSelect} className="text-caption mx-auto pt-2" />
        </div>

        {importRows.length > 0 && !importReport && (
          <Badge variant="brand">{importRows.length} ligne(s) prête(s) pour traitement</Badge>
        )}

        {importReport && (
          <div className="p-4 rounded bg-surface border border-border space-y-2 text-body-sm dark:bg-surface-dark dark:border-border-dark">
            <div className="font-semibold text-success flex items-center gap-1.5">
              <Icon name="check_circle" className="text-[18px]" />
              <span>{importReport.createdCount} apprenant(s) importé(s) sur {importReport.totalCount} lignes.</span>
            </div>
            {importReport.errors?.length > 0 && (
              <div className="space-y-1 text-error text-caption">
                <p className="font-bold">{importReport.errors.length} anomalie(s) détectée(s) :</p>
                <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto font-mono">
                  {importReport.errors.map((err, i) => (
                    <li key={i}>Ligne {err.row} {err.matricule ? `(${err.matricule})` : ""} : {err.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="rounded bg-error-subtle p-3 text-error border border-error/30 text-caption font-medium">{error}</p>
        )}
      </div>
    </Modal>
  );
}