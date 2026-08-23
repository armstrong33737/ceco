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
    { to: "bulletins", label: "Bulletins & Diplômes (V4)", icon: "receipt_long", visible: canGenerateBulletins },
    { to: "maquettes", label: "Maquettes de Classes", icon: "auto_stories", visible: true },
    { to: "programmes-filieres", label: "Cursus Filières", icon: "account_tree", visible: isDirectorOrAdmin },
    { to: "matieres", label: "Matières", icon: "library_books", visible: isDirectorOrAdmin },
    { to: "categories", label: "Catégories & Groupes", icon: "category", visible: isDirectorOrAdmin },
    { to: "formateurs", label: "Formateurs", icon: "badge", visible: isDirectorOrAdmin },
    { to: "ponderations", label: "Pondérations CC / Examen", icon: "tune", visible: isDirectorOrAdmin },
  ];

  const visibleTabs = TABS.filter((tab) => tab.visible);

  return (
    <div className="space-y-md max-w-7xl mx-auto">
      {/* En-tête officiel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Pédagogie &amp; Évaluations
            </span>
            <span className="text-outline-variant">•</span>
            <span className="text-xs text-on-surface-variant font-medium">
              {user?.center?.name || "Espace Académique"}
            </span>
          </div>
          <h1 className="text-xl font-bold text-on-surface mt-1">
            {user?.role?.name === "Formateur" ? "Espace Enseignant — Saisie des Notes" : "Gestion Pédagogique, Évaluations & Diplômes (V4)"}
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {user?.role?.name === "Formateur"
              ? "Accédez à vos bordereaux de notes, saisissez les évaluations continues et imprimez vos procès-verbaux."
              : "Saisie des notes, délibérations, bulletins périodiques bilingues, relevés annuels et diplômes certifiés."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-on-surface">
            <Icon name="badge" className="text-primary text-[16px]" />
            <span>Profil : {user?.role?.name || "Utilisateur"}</span>
          </span>
        </div>
      </div>

      {/* Barre d'onglets filtrée selon les droits */}
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