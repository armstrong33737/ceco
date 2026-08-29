// packages/frontend/src/components/SlideOverDrawer.jsx
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "./Icon";

export default function SlideOverDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footerActions,
  width = "max-w-lg",
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] overflow-hidden" role="dialog" aria-modal="true">
          {/* Backdrop avec flou discret */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />

          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className={`pointer-events-auto w-screen ${width} bg-white border-l border-slate-200 shadow-xl flex flex-col justify-between`}
            >
              {/* En-tête du Drawer */}
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  {subtitle && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                      {subtitle}
                    </span>
                  )}
                  <h2 className="text-base font-bold text-slate-900">{title}</h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-800 p-1.5 rounded hover:bg-slate-200 transition-colors"
                >
                  <Icon name="close" className="text-[20px]" />
                </button>
              </div>

              {/* Contenu Déroulant */}
              <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs text-slate-700">
                {children}
              </div>

              {/* Pied d'Action */}
              {footerActions && (
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
                  {footerActions}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}