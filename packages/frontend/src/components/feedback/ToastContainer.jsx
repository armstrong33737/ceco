// packages/frontend/src/components/feedback/ToastContainer.jsx
import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useToastStore } from "../../store/toastStore";
import Icon from "../Icon";

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (typeof document === "undefined") return null;

  const iconMap = {
    success: "check_circle",
    error: "error",
    warning: "warning",
    info: "info",
  };

  const styleMap = {
    success: "bg-surface border-success/40 text-ink-primary dark:bg-surface-dark dark:border-success/40",
    error: "bg-surface border-error/40 text-ink-primary dark:bg-surface-dark dark:border-error/40",
    warning: "bg-surface border-warning/40 text-ink-primary dark:bg-surface-dark dark:border-warning/40",
    info: "bg-surface border-info/40 text-ink-primary dark:bg-surface-dark dark:border-info/40",
  };

  const iconColorMap = {
    success: "text-success",
    error: "text-error",
    warning: "text-warning",
    info: "text-info",
  };

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[10000] flex flex-col gap-2.5 max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
            transition={{ duration: 0.15 }}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded bg-surface border shadow-modal dark:bg-surface-dark ${
              styleMap[toast.type] || styleMap.info
            }`}
          >
            <Icon
              name={iconMap[toast.type] || "info"}
              className={`text-[18px] flex-shrink-0 mt-0.5 ${iconColorMap[toast.type] || "text-info"}`}
            />
            <p className="text-body-sm font-medium text-ink-primary leading-tight flex-1">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-ink-muted hover:text-ink-primary p-0.5 rounded transition-colors"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}