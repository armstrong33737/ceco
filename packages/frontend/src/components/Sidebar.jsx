import { NavLink, useLocation } from "react-router-dom";
import Icon from "./Icon";
import useAuthStore from "../store/authStore";

const MAIN_ITEMS = [
  { to: "/", label: "Tableau de bord", icon: "dashboard", end: true },
  { to: "/formations", label: "Formations", icon: "menu_book", disabled: false },
  { to: "/etudiants", label: "Étudiants", icon: "group", disabled: true },
  { to: "/formateurs", label: "Formateurs", icon: "badge", disabled: true },
  { to: "/planning", label: "Planning", icon: "calendar_today", disabled: true },
];

const SETTINGS_PERMISSIONS = ["center.update", "users.read", "roles.read", "backups.read"];

export default function Sidebar() {
  const { hasPermission, logout, isSidebarCollapsed } = useAuthStore();
  const canSeeSettings = SETTINGS_PERMISSIONS.some((p) => hasPermission(p));
  const location = useLocation();
  const isInSettings = location.pathname.startsWith("/parametres");

  const linkClass = ({ isActive }, disabled) =>
    `w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0 h-11" : "gap-sm px-sm py-2.5"} rounded-md transition-all text-sm font-medium ${
      disabled
        ? "text-on-surface-variant/40 cursor-not-allowed pointer-events-none"
        : isActive
        ? "bg-primary-light text-primary font-bold shadow-xs"
        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
    }`;

  return (
    <aside
      className={`fixed left-0 top-16 h-[calc(100vh-64px)] ${
        isSidebarCollapsed ? "w-20 overflow-visible" : "w-sidebar-width overflow-x-hidden overflow-y-auto"
      } bg-surface-container-lowest z-50 flex flex-col pt-md border-r border-outline-variant/30 transition-all duration-300 justify-between select-none`}
    >
      <nav className={`flex-1 px-2 space-y-1.5 ${isSidebarCollapsed ? "overflow-visible" : "overflow-x-hidden overflow-y-auto"}`}>
        {MAIN_ITEMS.map((item) => (
          <div key={item.to} className="relative group">
            <NavLink
              to={item.to}
              end={item.end}
              className={(state) => linkClass(state, item.disabled)}
            >
              <Icon name={item.icon} className="text-[22px] flex-shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
              {!isSidebarCollapsed && item.disabled && (
                <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/50 bg-surface px-1.5 py-0.5 rounded-md">
                  V2
                </span>
              )}
            </NavLink>

            {/* Infobulle unique personnalisée en mode réduit */}
            {isSidebarCollapsed && (
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3 py-1.5 bg-ink text-white text-xs font-semibold rounded-md shadow-xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-[100] border border-white/10">
                {item.label} {item.disabled ? "(Bientôt V2)" : ""}
              </div>
            )}
          </div>
        ))}

        {canSeeSettings && (
          <>
            <div className="my-md border-t border-outline-variant/30 mx-2" />
            <div className="relative group">
              <NavLink
                to="/parametres/centre"
                className={
                  `w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0 h-11" : "gap-sm px-sm py-2.5"} rounded-md transition-all text-sm font-medium ` +
                  (isInSettings
                    ? "bg-primary-light text-primary font-bold shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface")
                }
              >
                <Icon name="settings" className="text-[22px] flex-shrink-0" />
                {!isSidebarCollapsed && <span>Paramètres</span>}
              </NavLink>

              {isSidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3 py-1.5 bg-ink text-white text-xs font-semibold rounded-md shadow-xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-[100] border border-white/10">
                  Paramètres
                </div>
              )}
            </div>
          </>
        )}
      </nav>

      {/* Bouton de Déconnexion */}
      <div className={`p-2 border-t border-outline-variant/30 bg-surface-container-lowest ${isSidebarCollapsed ? "overflow-visible" : "overflow-x-hidden"}`}>
        <div className="relative group">
          <button
            onClick={logout}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? "justify-center px-0 h-11" : "gap-sm px-sm py-2.5"
            } rounded-md text-sm font-semibold text-error hover:bg-error-container/20 transition-all`}
          >
            <Icon name="logout" className="text-[20px] text-error flex-shrink-0" />
            {!isSidebarCollapsed && <span>Déconnexion</span>}
          </button>

          {isSidebarCollapsed && (
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3 py-1.5 bg-error text-white text-xs font-semibold rounded-md shadow-xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-[100] border border-white/10">
              Déconnexion
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}