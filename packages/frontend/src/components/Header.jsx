import Icon from "./Icon";
import { API_BASE } from "../lib/apiClient";
import useAuthStore from "../store/authStore";
import logo from "../../assets/logo2.png";

const isLocalServer = API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1");
const displayAddress = API_BASE.replace(/^https?:\/\//, "");

export default function Header({ user }) {
  const { isSidebarCollapsed, toggleSidebar } = useAuthStore();

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/30 z-[60] px-md flex items-center justify-between">
      <div className="flex items-center gap-sm">
        <button
          onClick={toggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-surface-container text-on-surface-variant transition-colors"
          title={isSidebarCollapsed ? "Déplier le menu" : "Réduire le menu"}
        >
          <Icon name={isSidebarCollapsed ? "menu" : "menu_open"} className="text-[22px]" />
        </button>

        {/* Logo et identité visuelle dans la barre de navigation */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-10 w-20 items-center justify-center rounded-md overflow-hidden ">
            <img
              src={logo}
              alt="Logo CECO"
              className="h-full w-full object-contain p-0.5"
              onError={(e) => {
                // Fallback visuel avec le dégradé si l'icône statique n'est pas trouvée
                e.target.style.display = "none";
                e.target.nextElementSibling.style.display = "flex";
              }}
            />
            <div className="hidden h-full w-full items-center justify-center bg-gradient-to-br from-primary to-violet text-white">
              <Icon name="school" className="text-[20px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Indicateur d'état du serveur */}
      <div className="hidden sm:flex items-center gap-2 rounded-full bg-success-light px-3.5 py-1 border border-success/20">
        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
        <span className="text-xs font-semibold text-on-surface">
          {isLocalServer ? "Instance Locale" : "Serveur Réseau"} · {displayAddress}
        </span>
      </div>

      {/* Profil de l'utilisateur connecté */}
      <div className="flex items-center gap-md">
        <div className="flex items-center gap-xs px-xs py-1">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-on-surface leading-tight">
              {user ? `${user.firstName} ${user.lastName}` : "Chargement..."}
            </p>
            <p className="text-[11px] font-semibold text-primary leading-tight mt-0.5">
              {user?.role?.name || "Administrateur"}
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-primary to-violet flex items-center justify-center text-white shadow-xs font-bold text-xs">
            {user?.firstName ? user.firstName.charAt(0).toUpperCase() : <Icon name="person" className="text-[20px]" />}
          </div>
        </div>
      </div>
    </header>
  );
}