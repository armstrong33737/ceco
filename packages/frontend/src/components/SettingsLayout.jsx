import { NavLink, Outlet } from "react-router-dom";
import useAuthStore from "../store/authStore";

const TABS = [
  { to: "centre", label: "Centre", permission: "center.update" },
  { to: "utilisateurs", label: "Utilisateurs", permission: "users.read" },
  { to: "roles", label: "Rôles & permissions", permission: "roles.read" },
  { to: "licence", label: "Licence", permission: "center.update" },
  { to: "sauvegarde", label: "Sauvegarde", permission: "backups.read" },
  { to: "apropos", label: "À propos", permission: "center.update" },
];

export default function SettingsLayout() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const visibleTabs = TABS.filter((tab) => hasPermission(tab.permission));

  return (
    <div>
      <h1 className="text-2xl font-bold text-on-surface">Paramètres</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Configuration du centre, des comptes, des services et des informations système.
      </p>

      <div className="mt-md flex gap-1 overflow-x-auto border-b border-outline-variant/40">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <div className="mt-lg">
        <Outlet />
      </div>
    </div>
  );
}