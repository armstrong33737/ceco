// packages/frontend/src/modules/academie/components/TransitionModal.jsx
import React from "react";
import Modal from "../../../design-system/overlays/Modal";
import Button from "../../../design-system/primitives/Button";
import Select from "../../../design-system/primitives/Select";
import Icon from "../../../components/Icon";

export default function TransitionModal({
  isOpen,
  onClose,
  transitionData,
  setTransitionData,
  academicYears = [],
  onSubmit,
  isLoading = false,
  error = null,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Moteur de Transition Annuelle"
      subtitle="Promotion automatique des admis et scellement de la session sortante"
      icon="swap_horiz"
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Annuler</Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isLoading}>
            Exécuter la Transition
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-body-sm text-ink-secondary leading-relaxed dark:text-ink-secondary-dark">
          Cette opération promeut automatiquement les apprenants admis au niveau supérieur dans la nouvelle session académique et scelle définitivement la session sortante en archive fermée (CLOSED).
        </p>

        <Select
          required
          label="1. Session sortante (à clôturer)"
          value={transitionData.previousYearId}
          onChange={(e) => setTransitionData({ ...transitionData, previousYearId: e.target.value })}
        >
          <option value="">Sélectionner la session sortante</option>
          {academicYears.filter((y) => y.status !== "CLOSED").map((y) => (
            <option key={y.id} value={y.id}>{y.label} ({y._count?.inscriptions || 0} inscrits)</option>
          ))}
        </Select>

        <Select
          required
          label="2. Nouvelle session (destination)"
          value={transitionData.newYearId}
          onChange={(e) => setTransitionData({ ...transitionData, newYearId: e.target.value })}
        >
          <option value="">Sélectionner la session cible</option>
          {academicYears.filter((y) => y.status === "UPCOMING" || y.isCurrent).map((y) => (
            <option key={y.id} value={y.id}>{y.label} ({y.status === "UPCOMING" ? "Préparatoire" : "Active"})</option>
          ))}
        </Select>

        <div className="p-3 rounded bg-warning-subtle border border-warning/30 text-warning-dark text-caption font-medium flex items-center gap-2 dark:bg-warning-subtle-dark dark:text-warning">
          <Icon name="info" className="text-[18px] flex-shrink-0" />
          <span>La session précédente sera automatiquement clôturée et protégée en lecture seule.</span>
        </div>

        {error && (
          <p className="rounded bg-error-subtle p-3 text-error border border-error/30 text-caption font-medium">{error}</p>
        )}
      </form>
    </Modal>
  );
}