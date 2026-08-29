// packages/frontend/src/store/toastStore.js
import { create } from "zustand";

const useToastStore = create((set, get) => ({
  toasts: [],

  addToast: ({ message, type = "info", duration = 3500 }) => {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { id, message, type, duration };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => {
    set({ toasts: [] });
  },
}));

/**
 * Déclencheur universel de notification toast fidèle à EduFlex ERP
 * @param {string} message - Message de la notification
 * @param {'success' | 'warning' | 'error' | 'info'} type - Type sémantique
 * @param {number} duration - Durée d'affichage en ms (défaut: 3500ms)
 */
export function showToast(message, type = "info", duration = 3500) {
  useToastStore.getState().addToast({ message, type, duration });
}

export default useToastStore;