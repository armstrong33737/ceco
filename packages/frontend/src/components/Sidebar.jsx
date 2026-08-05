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

const SETTINGS_PERMISSIONS = ["center.update", "users.manage", "roles.manage"];

// Volontairement honnête : les sections pas encore construites (V2+ sur la
// feuille de route) sont visibles mais désactivées avec une étiquette
// "Bientôt". "Paramètres" n'apparaît que si l'utilisateur a au moins une
// des permissions couvertes par ses onglets.
export default function Sidebar() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canSeeSettings = SETTINGS_PERMISSIONS.some((p) => hasPermission(p));
  const location = useLocation();
  const isInSettings = location.pathname.startsWith("/parametres");

  const linkClass = ({ isActive }, disabled) =>
    `w-full flex items-center gap-sm px-sm py-2.5 rounded-md transition-all text-left text-sm ${
      disabled
        ? "text-on-surface-variant/40 cursor-not-allowed pointer-events-none"
        : isActive
        ? "bg-primary-light text-primary font-semibold"
        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
    }`;

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-sidebar-width bg-surface-container-lowest z-50 flex flex-col pt-md shadow-[1px_0_0_0_rgba(0,0,0,0.05)] overflow-y-auto">
      <nav className="flex-1 px-sm space-y-1">
        {MAIN_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={(state) => linkClass(state, item.disabled)}
          >
            <Icon name={item.icon} className="text-[20px]" />
            <span>{item.label}</span>
            {item.disabled && (
              <span className="ml-auto text-[10px] uppercase tracking-wide text-on-surface-variant/50">
                Bientôt
              </span>
            )}
          </NavLink>
        ))}

        {canSeeSettings && (
          <>
            <div className="my-md border-t border-outline-variant/30 mx-sm" />
            <NavLink
              to="/parametres/centre"
              className={
                `w-full flex items-center gap-sm px-sm py-2.5 rounded-md transition-all text-left text-sm ` +
                (isInSettings
                  ? "bg-primary-light text-primary font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface")
              }
            >
              <Icon name="settings" className="text-[20px]" />
              <span>Paramètres</span>
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}