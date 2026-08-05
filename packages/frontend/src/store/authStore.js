import { create } from "zustand";
import { apiFetch, getToken, setToken, clearToken } from "../lib/apiClient";

const useAuthStore = create((set) => ({
  token: getToken(),
  user: null,
  status: "idle", // idle | checking | loading | authenticated | error
  error: null,

  // Appelé au démarrage de l'app : si un jeton est déjà stocké, on vérifie
  // qu'il est encore valide plutôt que de redemander les identifiants.
  restoreSession: async () => {
    const token = getToken();
    if (!token) return;
    set({ status: "checking" });
    try {
      const user = await apiFetch("/auth/me");
      if (!Array.isArray(user?.permissions)) {
        // Réponse d'une forme inattendue (ex. backend pas encore redémarré
        // après une mise à jour) — on ne fait pas confiance à une session
        // incomplète, on redemande simplement la connexion.
        throw new Error("Réponse de session invalide.");
      }
      set({ user, status: "authenticated" });
    } catch {
      clearToken();
      set({ token: null, user: null, status: "idle" });
    }
  },

  login: async (email, password, remember = false) => {
    set({ status: "loading", error: null });
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, remember }),
      });
      setToken(data.token);
      set({ token: data.token, user: data.user, status: "authenticated" });
    } catch (err) {
      set({ status: "error", error: err.message });
    }
  },

  logout: () => {
    clearToken();
    set({ token: null, user: null, status: "idle" });
  },

  // "*" (rôle admin) donne accès à tout ; sinon il faut l'action précise.
  // Défensif à dessein : ne doit jamais planter, même si la session
  // restaurée est incomplète ou provient d'une ancienne version du backend.
  hasPermission: (action) => {
    const { user } = useAuthStore.getState();
    const permissions = user?.permissions;
    if (!Array.isArray(permissions)) return false;
    return permissions.includes("*") || permissions.includes(action);
  },
}));

export default useAuthStore;