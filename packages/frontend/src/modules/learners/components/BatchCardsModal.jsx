// packages/frontend/src/modules/learners/components/BatchCardsModal.jsx
import React from "react";
import Modal from "../../../design-system/overlays/Modal";
import Button from "../../../design-system/primitives/Button";
import Select from "../../../design-system/primitives/Select";

export default function BatchCardsModal({
  isOpen,
  onClose,
  batchForm,
  setBatchForm,
  classes = [],
  onSubmit,
  isLoading = false,
  error = null,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Impression Groupée par Classe (A4)"
      subtitle="Planches de badges découpables Recto/Verso avec repères de coupe ou livrets d'attestations"
      icon="layers"
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Annuler</Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isLoading} icon="print">
            Compiler le Document A4
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Select
          required
          label="Classe d'affectation"
          value={batchForm.classeId}
          onChange={(e) => setBatchForm({ ...batchForm, classeId: e.target.value })}
        >
          <option value="">Sélectionner une classe</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.label} ({c._count?.inscriptions || 0} apprenants)</option>
          ))}
        </Select>

        <Select
          required
          label="Type d'acte à compiler"
          value={batchForm.type}
          onChange={(e) => setBatchForm({ ...batchForm, type: e.target.value })}
        >
          <option value="CARTE_ETUDIANT">Planche Badges Duplex A4 (Recto/Verso avec repères)</option>
          <option value="ATTESTATION_INSCRIPTION">Livret d'Attestations de Scolarité A4</option>
        </Select>

        {error && (
          <p className="rounded bg-error-subtle p-3 text-error border border-error/30 text-caption font-medium">{error}</p>
        )}
      </form>
    </Modal>
  );
}