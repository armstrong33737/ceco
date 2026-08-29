// packages/frontend/src/components/SettingsLayout.jsx
import { NavLink, Outlet } from "react-router-dom";
import useAuthStore from "../store/authStore";
import Icon from "./Icon";

const TABS = [
  { to: "centre", label: "Établissement & Agrément", icon: "storefront", permission: "center.update" },
  { to: "utilisateurs", label: "Comptes Utilisateurs", icon: "group", permission: "users.read" },
  { to: "roles", label: "Rôles & RBAC", icon: "security", permission: "roles.read" },
  { to: "modeles", label: "Gabarits de Documents", icon: "palette", permission: "center.update" },
  { to: "licence", label: "Licence & Sécurité", icon: "verified_user", permission: "center.update" },
  { to: "sauvegarde", label: "Sauvegardes", icon: "archive", permission: "backups.read" },
  { to: "audit", label: "Journal d'Audit", icon: "history", permission: "center.update" },
  { to: "apropos", label: "À Propos", icon: "bookmark", permission: "center.update" },
];

export default function SettingsLayout() {
  const { user, hasPermission } = useAuthStore();
  const visibleTabs = TABS.filter((tab) => hasPermission(tab.permission));

  return (
    <div className="space-y-4  mx-auto">
      {/* 1. En-tête de Contexte Administration */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
              Administration &amp; Sécurité Système
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-slate-500 font-medium">
              {user?.center?.name || "Configuration générale"}
            </span>
          </div>
          <h1 className="text-base font-bold text-slate-900 mt-0.5">
            Paramètres Généraux, Traçabilité &amp; Conformité
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Identité légale MINEFOP, habilitations granulaires, licences asymétriques et sauvegardes.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
            <Icon name="verified" className="text-[16px]" />
            <span>Sécurisé Ed25519</span>
          </span>
        </div>
      </div>

      {/* 2. Barre d'Onglets Horizontale Slate Enterprise */}
      <div className="flex gap-1 p-1 bg-white rounded-lg border border-slate-200 shadow-2xs overflow-x-auto select-none">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? "bg-blue-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`
            }
          >
            <Icon name={tab.icon} className="text-[16px]" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>

      {/* 3. Zone de Rendu du Module Paramètre */}
      <div>
        <Outlet />
      </div>
    </div>
  );
}