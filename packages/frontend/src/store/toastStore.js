// packages/frontend/src/store/toastStore.js
import { create } from "zustand";

export const useToastStore = create((set, get) => ({
  toasts: [],

  /**
   * Émet une notification Toast flottante
   * @param {string} message - Message affiché
   * @param {'success' | 'error' | 'warning' | 'info'} type - Type sémantique
   * @param {number} duration - Durée d'affichage en ms (défaut: 3500ms)
   */
  showToast: (message, type = "success", duration = 3500) => {
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
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Export helper pour appel direct dans n'importe quel service
export const showToast = (message, type, duration) => {
  useToastStore.getState().showToast(message, type, duration);
};