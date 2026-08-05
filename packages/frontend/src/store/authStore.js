import { create } from "zustand";
import { apiFetch } from "../lib/apiClient";

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem("ceco_token") || null,
  status: "checking", // checking | authenticated | unauthenticated | error | loading
  error: null,

  restoreSession: async () => {
    const token = get().token;
    if (!token) {
      set({ status: "unauthenticated" });
      return;
    }
    try {
      set({ status: "checking" });
      const data = await apiFetch("/auth/me");
      set({ user: data.user, status: "authenticated", error: null });
    } catch (err) {
      localStorage.removeItem("ceco_token");
      set({ token: null, user: null, status: "unauthenticated" });
    }
  },

  login: async (email, password, remember) => {
    set({ status: "loading", error: null });
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      
      // Stocke systématiquement le token pour que apiFetch puisse le lire et l'injecter dans les headers
      localStorage.setItem("ceco_token", data.token);
      
      set({ token: data.token, user: data.user, status: "authenticated", error: null });
    } catch (err) {
      set({ status: "error", error: err.message || "Identifiants invalides." });
    }
  },

  logout: () => {
    localStorage.removeItem("ceco_token");
    set({ token: null, user: null, status: "unauthenticated" });
  },

  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    
    const permissions = user.role?.permissions || [];
    const rawPermissions = permissions.map(p => typeof p === "object" ? p.action : p);
    
    if (rawPermissions.includes("*") || user.role?.name?.toLowerCase() === "admin" || user.role?.name?.toLowerCase() === "administrateur") {
      return true;
    }
    
    return rawPermissions.includes(permission);
  },
}));

export default useAuthStore;