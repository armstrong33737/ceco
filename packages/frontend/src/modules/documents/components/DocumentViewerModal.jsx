// packages/frontend/src/modules/documents/components/DocumentViewerModal.jsx
import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../../design-system/primitives/Button";
import Badge from "../../../design-system/primitives/Badge";
import Icon from "../../../components/Icon";

export default function DocumentViewerModal({
  isOpen,
  title,
  previewUrl,
  downloadUrl,
  onClose,
  isReused = false,
  onForceRegenerate = null,
  isRegenerating = false,
}) {
  const iframeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setLoadError(false);
    }
  }, [isOpen, previewUrl]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.1 }}
          className="w-full max-w-5xl rounded bg-surface border border-border shadow-modal h-[92vh] flex flex-col justify-between overflow-hidden dark:bg-surface-dark dark:border-border-dark"
        >
          {/* HEADER (SANS LE BOUTON IMPRIMER DÉFAILLANT) */}
          <div className="flex items-center justify-between border-b border-border px-6 py-3.5 flex-shrink-0 dark:border-border-dark">
            <div className="flex items-center gap-3 truncate max-w-xl">
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-error-subtle text-error dark:bg-error-subtle-dark dark:text-error-dark">
                <Icon name="picture_as_pdf" className="text-[18px]" />
              </div>
              <h3 className="text-body-md font-semibold text-ink-primary truncate font-sans dark:text-white">
                {title || "Aperçu du Document PDF"}
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {onForceRegenerate && (
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={onForceRegenerate}
                  disabled={isRegenerating}
                  isLoading={isRegenerating}
                  title="Recalculer les notes actuelles et ré-émettre l'acte"
                >
                  Ré-émettre l'Acte
                </Button>
              )}

              {/* TÉLÉCHARGEMENT DIRECT ET SÛR (POUR IMPRESSION SYSTÈME PROPRE) */}
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center justify-center font-sans font-medium rounded select-none transition-colors duration-instant h-[30px] px-3 text-caption gap-1.5 bg-brand-900 text-white hover:bg-brand-800 active:bg-[#051321] shadow-xs dark:bg-brand-500"
              >
                <Icon name="download" className="text-[16px]" />
                <span>Télécharger le PDF</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="text-ink-muted hover:text-ink-primary p-1 rounded transition-colors dark:text-ink-muted-dark dark:hover:text-white"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
          </div>

          {/* ZONE IFRAME DYNAMIQUE */}
          <div className="flex-1 w-full bg-[#E5E9F0] overflow-hidden p-2 relative dark:bg-[#07111D]">
            {isLoading && !loadError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/80 backdrop-blur-xs z-10 dark:bg-surface-dark/80">
                <Icon name="progress_activity" className="animate-spin text-3xl text-brand-900 dark:text-brand-500" />
                <span className="text-caption font-semibold text-ink-secondary dark:text-ink-secondary-dark">
                  Génération et rendu du flux PDF...
                </span>
              </div>
            )}

            {loadError ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 bg-surface rounded dark:bg-surface-dark">
                <Icon name="error_outline" className="text-4xl text-error" />
                <h4 className="text-body-md font-semibold text-ink-primary dark:text-white">
                  Impossible d'afficher le document dans le navigateur
                </h4>
                <p className="text-caption text-ink-muted max-w-md">
                  Le fichier a été généré avec succès. Vous pouvez le télécharger directement sur votre poste.
                </p>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="px-4 py-2 bg-brand-900 text-white text-body-sm font-semibold rounded"
                >
                  Télécharger le Fichier PDF
                </a>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                title={title || "Flux PDF CECO"}
                className="w-full h-full border-none rounded bg-white shadow-inner"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setLoadError(true);
                }}
              />
            )}
          </div>

          {/* FOOTER */}
          <div className="border-t border-border bg-[#FAFBFD] px-6 py-2.5 flex items-center justify-between text-caption text-ink-muted flex-shrink-0 dark:border-border-dark dark:bg-[#07111D]/40">
            <div className="flex items-center gap-2">
              <Badge variant={isReused ? "neutral" : "success"} withDot>
                {isReused ? "Acte original archivé (Snapshot fidèle)" : "Nouvel acte certifié"}
              </Badge>
              <span className="font-mono text-[11px]">Sceau d'intégrité SHA-256</span>
            </div>
            <button type="button" onClick={onClose} className="font-semibold text-brand-900 hover:underline dark:text-brand-500">
              Fermer la visionneuse
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}