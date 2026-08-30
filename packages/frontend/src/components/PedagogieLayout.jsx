// packages/frontend/src/components/PedagogieLayout.jsx
import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import useAuthStore from "../store/authStore";
import Icon from "./Icon";
import { Badge } from "./ui";

export default function PedagogieLayout() {
  const { user, hasPermission } = useAuthStore();

  const isDirectorOrAdmin = hasPermission(["formations.create", "formations.update", "center.update"]);
  const canDeliberate = hasPermission("grades.validate");
  const canGenerateBulletins = hasPermission(["grades.read", "bulletins.generate", "students.read"]);

  const TABS = [
    { to: "saisie", label: "Saisie des Notes", icon: "edit_note", visible: true },
    { to: "deliberations", label: "Délibérations du Jury", icon: "gavel", visible: canDeliberate },
    { to: "bulletins", label: "Bulletins & Diplômes", icon: "receipt_long", visible: canGenerateBulletins },
    { to: "maquettes", label: "Maquettes de Classes", icon: "auto_stories", visible: true },
    { to: "programmes-filieres", label: "Cursus Filières", icon: "account_tree", visible: isDirectorOrAdmin },
    { to: "matieres", label: "Matières", icon: "library_books", visible: isDirectorOrAdmin },
    { to: "categories", label: "Catégories & Groupes", icon: "category", visible: isDirectorOrAdmin },
    { to: "formateurs", label: "Formateurs", icon: "badge", visible: isDirectorOrAdmin },
    { to: "ponderations", label: "Pondérations CC / Examen", icon: "tune", visible: isDirectorOrAdmin },
  ];

  const visibleTabs = TABS.filter((tab) => tab.visible);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* En-tête officiel du Module Pédagogique */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface p-6 rounded border border-border shadow-xs dark:bg-surface-dark dark:border-border-dark">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-overline text-brand-900 uppercase tracking-wider font-semibold dark:text-brand-500">
              Pédagogie &amp; Évaluations
            </span>
            <span className="text-ink-muted">•</span>
            <span className="text-caption text-ink-secondary">
              {user?.center?.name || "Espace Académique"}
            </span>
          </div>
          <h1 className="text-h3 font-heading font-semibold text-ink-primary mt-1">
            {user?.role?.name === "Formateur"
              ? "Espace Enseignant — Saisie des Notes"
              : "Gestion Pédagogique, Évaluations & Diplômes"}
          </h1>
          <p className="text-body text-ink-secondary mt-0.5">
            {user?.role?.name === "Formateur"
              ? "Accédez à vos cours assignés, saisissez les évaluations continues et éditez vos bordereaux officiels."
              : "Bordereaux de notes, jurys de délibération, bulletins bilingues, relevés annuels et diplômes d'État."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="brand" className="h-[32px] px-3 text-body-sm font-medium">
            <Icon name="badge" className="text-[16px] mr-1.5" />
            <span>Profil : {user?.role?.name || "Utilisateur"}</span>
          </Badge>
        </div>
      </div>

      {/* Barre d'Onglets Horizontaux Normalisée */}
      <div className="flex gap-1.5 p-1 bg-[#F5F7FA] rounded border border-border overflow-x-auto dark:bg-[#07111D] dark:border-border-dark">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex items-center gap-2 h-[36px] px-4 rounded text-body-md font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-brand-900 text-white font-semibold shadow-xs dark:bg-brand-500"
                  : "text-ink-secondary hover:text-ink-primary hover:bg-surface dark:hover:bg-surface-dark"
              }`
            }
          >
            <Icon name={tab.icon} className="text-[18px]" />
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