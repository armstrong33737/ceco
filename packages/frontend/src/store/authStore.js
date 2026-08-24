// packages/frontend/src/store/authStore.js
import { create } from "zustand";
import { apiFetch } from "../lib/apiClient";

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem("ceco_token") || null,
  status: "checking", // "checking" | "authenticated" | "unauthenticated" | "loading" | "error"
  error: null,

  // État de licence temps-réel (V4)
  licenseStatus: "ACTIVE", // "ACTIVE" | "GRACE_PERIOD" | "READ_ONLY" | "TAMPERED" | "EXPIRED"
  licenseData: null,

  isSidebarCollapsed: localStorage.getItem("ceco_sidebar_collapsed") === "true",

  toggleSidebar: () => {
    const nextState = !get().isSidebarCollapsed;
    localStorage.setItem("ceco_sidebar_collapsed", nextState.toString());
    set({ isSidebarCollapsed: nextState });
  },

  restoreSession: async () => {
    const token = get().token;
    if (!token) {
      set({ status: "unauthenticated" });
      return;
    }
    try {
      set({ status: "checking" });
      const [authRes, licenseRes] = await Promise.all([
        apiFetch("/auth/me"),
        apiFetch("/license").catch(() => null),
      ]);

      set({
        user: authRes.user,
        licenseStatus: licenseRes?.status || "ACTIVE",
        licenseData: licenseRes,
        status: "authenticated",
        error: null,
      });
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

      localStorage.setItem("ceco_token", data.token);

      const licenseRes = await apiFetch("/license").catch(() => null);

      set({
        token: data.token,
        user: data.user,
        licenseStatus: licenseRes?.status || "ACTIVE",
        licenseData: licenseRes,
        status: "authenticated",
        error: null,
      });
    } catch (err) {
      set({ status: "error", error: err.message || "Identifiants invalides." });
    }
  },

  logout: () => {
    localStorage.removeItem("ceco_token");
    set({ token: null, user: null, status: "unauthenticated", licenseData: null });
  },

  updateSubscription: (newSubscription) => {
    const { user } = get();
    if (user && user.center) {
      set({
        user: {
          ...user,
          center: {
            ...user.center,
            subscription: newSubscription,
          },
        },
        licenseStatus: "ACTIVE",
      });
    }
  },

  setLicenseData: (licenseData) => {
    set({
      licenseData,
      licenseStatus: licenseData?.status || "ACTIVE",
    });
  },

  // Vérifie si l'utilisateur possède la permission requise
  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;

    const permissions = user.role?.permissions || [];
    const rawPermissions = permissions.map((p) => (typeof p === "object" ? p.action : p));

    // Super-administrateur
    if (rawPermissions.includes("*") || user.role?.name?.toLowerCase() === "admin" || user.role?.name?.toLowerCase() === "administrateur") {
      return true;
    }

    if (Array.isArray(permission)) {
      return permission.some((p) => rawPermissions.includes(p));
    }

    return rawPermissions.includes(permission);
  },
}));

export default useAuthStore;