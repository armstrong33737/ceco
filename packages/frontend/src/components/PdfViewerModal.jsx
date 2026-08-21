// packages/frontend/src/components/PdfViewerModal.jsx
import { useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "./Icon";

export default function PdfViewerModal({
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

  if (!isOpen || typeof document === "undefined") return null;

  function handlePrintClient() {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.focus();
      iframeRef.current.contentWindow?.print();
    }
  }

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-5xl rounded-md bg-white p-md sm:p-lg shadow-2xl border border-outline-variant/30 space-y-md h-[92vh] flex flex-col justify-between"
        >
          {/* En-tête de la visionneuse */}
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2 max-w-xl">
              <Icon name="picture_as_pdf" className="text-error text-[22px] flex-shrink-0" />
              <h3 className="text-sm font-bold text-on-surface truncate">{title}</h3>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {onForceRegenerate && (
                <button
                  type="button"
                  onClick={onForceRegenerate}
                  disabled={isRegenerating}
                  className="px-3 py-1.5 text-xs font-bold text-primary underline hover:opacity-80 disabled:opacity-50"
                >
                  {isRegenerating ? "Ré-émission en cours..." : "Ré-émettre le document (Forcer)"}
                </button>
              )}
              <button
                type="button"
                onClick={handlePrintClient}
                className="rounded-md bg-primary-light border border-primary/20 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Icon name="print" className="text-[16px]" />
                <span>Imprimer</span>
              </button>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-bold text-on-primary hover:bg-primary-dark flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Icon name="download" className="text-[16px]" />
                <span>Télécharger</span>
              </a>
              <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1">
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
          </div>

          {/* Cadre d'affichage direct du flux PDF */}
          <div className="flex-1 w-full bg-surface-container rounded-md overflow-hidden border border-outline-variant/30 shadow-inner">
            <iframe
              ref={iframeRef}
              src={previewUrl}
              title={title || "Aperçu PDF CECO"}
              className="w-full h-full border-none rounded-md"
            />
          </div>

          {/* Pied de visionneuse */}
          <div className="flex justify-between items-center text-xs text-on-surface-variant pt-2 border-t border-outline-variant/15 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-success font-semibold flex items-center gap-1">
                <Icon name="lock" className="text-[14px]" />
                {isReused
                  ? "Document officiel original archivé (visuel figé à l'émission)"
                  : "Nouvel acte certifié émis"}
              </span>
            </div>
            <button type="button" onClick={onClose} className="font-semibold text-primary hover:underline">
              Fermer la visionneuse
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}