// packages/frontend/src/components/PedagogieLayout.jsx
import { NavLink, Outlet } from "react-router-dom";
import useAuthStore from "../store/authStore";
import Icon from "./Icon";

export default function PedagogieLayout() {
  const { user, hasPermission } = useAuthStore();

  const isDirectorOrAdmin = hasPermission(["formations.create", "formations.update", "center.update"]);
  const canDeliberate = hasPermission("grades.validate");
  const canGenerateBulletins = hasPermission(["grades.read", "bulletins.generate", "students.read"]);

  const TABS = [
    { to: "saisie", label: "Saisie des Notes", icon: "edit_note", visible: true },
    { to: "deliberations", label: "Délibérations du Jury", icon: "gavel", visible: canDeliberate },
    { to: "bulletins", label: "Bulletins & Diplômes", icon: "receipt_long", visible: canGenerateBulletins, badge: "V4" },
    { to: "maquettes", label: "Maquettes de Classes", icon: "auto_stories", visible: true },
    { to: "programmes-filieres", label: "Cursus Filières", icon: "account_tree", visible: isDirectorOrAdmin },
    { to: "matieres", label: "Matières", icon: "library_books", visible: isDirectorOrAdmin },
    { to: "categories", label: "Groupes & Catégories", icon: "category", visible: isDirectorOrAdmin },
    { to: "formateurs", label: "Formateurs", icon: "badge", visible: isDirectorOrAdmin },
    { to: "ponderations", label: "Pondérations CC/Examen", icon: "tune", visible: isDirectorOrAdmin },
  ];

  const visibleTabs = TABS.filter((tab) => tab.visible);

  return (
    <div className="space-y-4  mx-auto">
      {/* 1. En-tête de Contexte Haute Densité */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
              Pôle Pédagogie &amp; Évaluations
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-slate-500 font-medium">
              {user?.center?.name || "Campus Local"}
            </span>
          </div>
          <h1 className="text-base font-bold text-slate-900 mt-0.5">
            {user?.role?.name === "Formateur"
              ? "Espace Enseignant — Saisie des Évaluations"
              : "Gestion Pédagogique, Délibérations & Diplômes"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {user?.role?.name === "Formateur"
              ? "Saisissez les notes de contrôle continu et d'examens pour vos cours assignés."
              : "Bordereaux de saisie, maquettes semestrielles, délibérations souveraines et livrets de diplomation."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            <Icon name="badge" className="text-blue-700 text-[16px]" />
            <span>Profil : {user?.role?.name || "Utilisateur"}</span>
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
            {tab.badge && (
              <span className="px-1.5 py-0.2 rounded bg-white/20 text-white font-mono text-[9px] font-bold">
                {tab.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      {/* 3. Zone de Rendu du Contenu Actif */}
      <div>
        <Outlet />
      </div>
    </div>
  );
}