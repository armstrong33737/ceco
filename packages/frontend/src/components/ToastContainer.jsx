// packages/frontend/src/components/ToastContainer.jsx
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import useToastStore from "../store/toastStore";
import Icon from "./Icon";

const TOAST_THEMES = {
  success: {
    icon: "check_circle",
    iconColor: "text-emerald-600",
    border: "border-slate-300",
    bg: "bg-white",
  },
  warning: {
    icon: "warning",
    iconColor: "text-amber-600",
    border: "border-slate-300",
    bg: "bg-white",
  },
  error: {
    icon: "error",
    iconColor: "text-rose-600",
    border: "border-slate-300",
    bg: "bg-white",
  },
  info: {
    icon: "info",
    iconColor: "text-blue-700",
    border: "border-slate-300",
    bg: "bg-white",
  },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      id="toast-container"
      className="fixed bottom-5 right-5 z-[100000] flex flex-col space-y-2 pointer-events-none px-3 sm:px-0 max-w-sm w-full"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const theme = TOAST_THEMES[toast.type] || TOAST_THEMES.info;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={() => removeToast(toast.id)}
              className={`pointer-events-auto flex items-center space-x-3 px-4 py-2.5 border rounded shadow-lg transition-all duration-300 text-xs font-semibold text-slate-800 ${theme.bg} ${theme.border} cursor-pointer`}
            >
              <Icon name={theme.icon} className={`text-[18px] flex-shrink-0 ${theme.iconColor}`} />
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast(toast.id);
                }}
                className="text-slate-400 hover:text-slate-700 p-0.5"
              >
                <Icon name="close" className="text-[14px]" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body
  );
}