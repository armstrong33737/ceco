// packages/frontend/src/modules/examensBlancs/components/EpreuvesTab.jsx
import React, { useState } from "react";
import { StructuredPanel } from "../../../design-system/layout/Card";
import Button from "../../../design-system/primitives/Button";
import Input from "../../../design-system/primitives/Input";
import Modal from "../../../design-system/overlays/Modal";
import ConfirmDialog from "../../../design-system/overlays/ConfirmDialog";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "../../../design-system/data-grid/Table";

export default function EpreuvesTab({
  mockSubjects = [],
  onOpenSubjectModal,
  onOpenCsvModal,
  onUpdateSubject,
  onDeleteSubject,
}) {
  const [editingSubject, setEditingSubject] = useState(null);
  const [editForm, setEditForm] = useState({ code: "", name: "", defaultCoefficient: 2.0 });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function handleOpenEdit(sub) {
    setEditingSubject(sub);
    setEditForm({
      code: sub.code,
      name: sub.name,
      defaultCoefficient: sub.defaultCoefficient,
    });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await onUpdateSubject(editingSubject.id, editForm);
      setEditingSubject(null);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <StructuredPanel
      title="Catalogue Universel des Épreuves d'Examen Blanc"
      subtitle="Référentiel des épreuves officielles (EPS, MSP, EPT, EPP, etc.)"
      icon="library_books"
      headerAction={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon="upload_file" onClick={onOpenCsvModal}>
            Importer CSV
          </Button>
          <Button variant="primary" size="sm" icon="add" onClick={onOpenSubjectModal}>
            Nouvelle Épreuve
          </Button>
        </div>
      }
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell className="w-28">Code Court</TableHeaderCell>
            <TableHeaderCell>Intitulé Officiel de l'Épreuve</TableHeaderCell>
            <TableHeaderCell className="w-36 text-center">Coefficient Standard</TableHeaderCell>
            <TableHeaderCell align="right">Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {mockSubjects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-ink-muted py-6">
                Aucune épreuve dans le catalogue. Cliquez sur « Nouvelle Épreuve » ou « Importer CSV ».
              </TableCell>
            </TableRow>
          ) : (
            mockSubjects.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{sub.code}</TableCell>
                <TableCell className="font-semibold text-ink-primary dark:text-white">{sub.name}</TableCell>
                <TableCell align="center" className="font-mono font-bold">{sub.defaultCoefficient}</TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button variant="secondary" size="sm" icon="edit" onClick={() => handleOpenEdit(sub)}>
                      Modifier
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      icon="delete"
                      className="text-error"
                      onClick={() => setDeleteTarget(sub)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Modale Modification Épreuve */}
      <Modal
        isOpen={Boolean(editingSubject)}
        onClose={() => setEditingSubject(null)}
        title={`Modifier l'Épreuve : ${editingSubject?.code}`}
        icon="tune"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingSubject(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleSaveEdit} isLoading={savingEdit}>Enregistrer</Button>
          </>
        }
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            required
            label="Code Court"
            value={editForm.code}
            onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
          />
          <Input
            required
            label="Intitulé Officiel"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Input
            type="number"
            step="0.5"
            label="Coefficient Standard"
            value={editForm.defaultCoefficient}
            onChange={(e) => setEditForm({ ...editForm, defaultCoefficient: e.target.value })}
          />
        </form>
      </Modal>

      {/* Confirmation Suppression */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          await onDeleteSubject(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Supprimer l'épreuve d'examen blanc"
        description={`Supprimer définitivement l'épreuve "${deleteTarget?.name}" (${deleteTarget?.code}) ? Cette action est irréversible.`}
      />
    </StructuredPanel>
  );
}