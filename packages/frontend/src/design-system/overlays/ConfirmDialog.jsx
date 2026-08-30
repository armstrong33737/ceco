// packages/frontend/src/design-system/overlays/ConfirmDialog.jsx
import React from "react";
import Modal from "./Modal";
import Button from "../primitives/Button";
import Icon from "../../components/Icon";

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmer la suppression",
  description = "Cette action est irréversible et supprimera définitivement cet enregistrement.",
  confirmLabel = "Confirmer la Suppression",
  cancelLabel = "Annuler",
  isLoading = false,
  variant = "danger", // "danger" | "warning" | "primary"
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={variant === "danger" ? "warning" : "help_outline"}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[2px] bg-error-subtle text-error flex items-center justify-center flex-shrink-0 dark:bg-error-subtle-dark dark:text-error-dark">
          <Icon name="warning" className="text-[22px]" />
        </div>
        <p className="text-body text-ink-secondary leading-relaxed pt-1 dark:text-ink-secondary-dark">
          {description}
        </p>
      </div>
    </Modal>
  );
}