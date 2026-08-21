// packages/frontend/src/components/SettingsLayout.jsx (Extrait mis à jour)
import { NavLink, Outlet } from "react-router-dom";
import useAuthStore from "../store/authStore";
import Icon from "./Icon";

const TABS = [
  { to: "centre", label: "Centre", icon: "storefront", permission: "center.update" },
  { to: "utilisateurs", label: "Utilisateurs", icon: "group", permission: "users.read" },
  { to: "roles", label: "Rôles & permissions", icon: "badge", permission: "roles.read" },
  { to: "modeles", label: "Gabarits & Modèles", icon: "palette", permission: "center.update" },
  { to: "licence", label: "Licence", icon: "verified_user", permission: "center.update" },
  { to: "sauvegarde", label: "Sauvegarde", icon: "archive", permission: "backups.read" },
  { to: "audit", label: "Journal d'Audit", icon: "history", permission: "center.update" }, // ⬅️ Nouvel onglet
  { to: "apropos", label: "À propos", icon: "bookmark", permission: "center.update" },
];

export default function SettingsLayout() {
  const { user, hasPermission } = useAuthStore();
  const visibleTabs = TABS.filter((tab) => hasPermission(tab.permission));

  return (
    <div className="space-y-md max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Administration
            </span>
            <span className="text-outline-variant">•</span>
            <span className="text-xs text-on-surface-variant font-medium">
              {user?.center?.name || "Configuration générale"}
            </span>
          </div>
          <h1 className="text-xl font-bold text-on-surface mt-1">Paramètres &amp; Sécurité du Système</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Identité légale, utilisateurs, rôles, traçabilité des opérations sensibles et sauvegardes.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-on-surface">
            <Icon name="verified" className="text-primary text-[16px]" />
            <span>Mode Sécurisé (V3)</span>
          </span>
        </div>
      </div>

      <div className="flex gap-1.5 p-1 bg-surface-container-lowest rounded-md border border-outline-variant/30 shadow-xs overflow-x-auto">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60"
              }`
            }
          >
            <Icon name={tab.icon} className="text-[16px]" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>

      <div>
        <Outlet />
      </div>
    </div>
  );
}