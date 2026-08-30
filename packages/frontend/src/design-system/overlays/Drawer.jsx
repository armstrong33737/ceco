// packages/frontend/src/design-system/overlays/Drawer.jsx
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "../../components/Icon";

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = "max-w-xl", // "max-w-md" | "max-w-lg" | "max-w-xl" | "max-w-2xl"
}) {
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex justify-end bg-black/60 backdrop-blur-xs">
        {/* Backdrop click */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className={`relative z-10 w-full ${width} h-full bg-surface border-l border-border shadow-modal flex flex-col justify-between overflow-hidden dark:bg-surface-dark dark:border-border-dark`}
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0 dark:border-border-dark">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-brand-900/5 text-brand-900 dark:bg-brand-500/10 dark:text-brand-500">
                  <Icon name={icon} className="text-[18px]" />
                </div>
              )}
              <div>
                <h3 className="text-body-md font-semibold text-ink-primary font-sans dark:text-ink-primary-dark">{title}</h3>
                {subtitle && <p className="text-caption text-ink-muted dark:text-ink-muted-dark">{subtitle}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-muted hover:text-ink-primary p-1 rounded transition-colors dark:text-ink-muted-dark dark:hover:text-white"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>

          {/* BODY */}
          <div className="p-6 overflow-y-auto flex-1 text-body space-y-4">{children}</div>

          {/* FOOTER */}
          {footer && (
            <div className="border-t border-border bg-[#FAFBFD] px-6 py-3.5 flex items-center justify-end gap-2.5 flex-shrink-0 dark:border-border-dark dark:bg-[#07111D]/40">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}