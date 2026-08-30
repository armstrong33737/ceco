// packages/frontend/src/app/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import Icon from "../components/Icon";
import useAuthStore from "../store/authStore";

export default function Sidebar() {
  const { hasPermission, logout, isSidebarCollapsed } = useAuthStore();

  const canSeeStudents = hasPermission(["students.read", "students.create"]);
  const canSeeFormations = hasPermission(["formations.read", "formations.create", "center.update"]);
  const canSeePedagogie = hasPermission(["grades.read", "grades.create", "formations.read"]);
  const canSeeDeliberation = hasPermission("grades.validate");
  const canSeeBulletins = hasPermission(["bulletins.generate", "grades.read"]);
  const canSeeSettings = hasPermission(["center.update", "users.read", "roles.read", "backups.read"]);

  const SECTIONS = [
    {
      title: "PRINCIPAL",
      items: [
        { to: "/", label: "Tableau de bord", icon: "dashboard", visible: true, end: true },
      ],
    },
    {
      title: "GESTION ACADÉMIQUE",
      items: [
        { to: "/apprenants", label: "Registre apprenants", icon: "group", visible: canSeeStudents },
        { to: "/apprenants/archives", label: "Archives historiques", icon: "archive", visible: canSeeStudents },
        { to: "/academie/filieres", label: "Filières & Cycles", icon: "account_tree", visible: canSeeFormations },
        { to: "/academie/promotions", label: "Promotions", icon: "school", visible: canSeeFormations },
        { to: "/academie/classes", label: "Classes", icon: "groups", visible: canSeeFormations },
        { to: "/academie/sessions", label: "Sessions & Transition", icon: "calendar_month", visible: canSeeFormations },
        { to: "/academie/salles", label: "Salles & Espaces", icon: "meeting_room", visible: canSeeFormations },
      ],
    },
    {
      title: "PÉDAGOGIE & ÉVALUATION",
      items: [
        { to: "/pedagogie/saisie", label: "Saisie des notes", icon: "edit_note", visible: canSeePedagogie },
        { to: "/pedagogie/deliberations", label: "Délibérations", icon: "gavel", visible: canSeeDeliberation },
        { to: "/pedagogie/bulletins", label: "Bulletins & Diplômes", icon: "receipt_long", visible: canSeeBulletins },
        { to: "/pedagogie/maquettes", label: "Maquettes de cours", icon: "auto_stories", visible: canSeePedagogie },
        { to: "/pedagogie/cursus", label: "Cursus filières", icon: "account_tree", visible: canSeeFormations },
        { to: "/pedagogie/formateurs", label: "Formateurs", icon: "badge", visible: canSeeFormations },
        { to: "/pedagogie/matieres", label: "Référentiel matières", icon: "library_books", visible: canSeeFormations },
        { to: "/pedagogie/categories", label: "Catégories", icon: "category", visible: canSeeFormations },
        { to: "/pedagogie/ponderations", label: "Pondérations", icon: "tune", visible: canSeeFormations },
      ],
    },
    {
      title: "ADMINISTRATION",
      items: [
        { to: "/administration/centre", label: "Centre & Sceau", icon: "storefront", visible: canSeeSettings },
        { to: "/administration/modeles", label: "Gabarits d'actes", icon: "palette", visible: canSeeSettings },
        { to: "/administration/utilisateurs", label: "Utilisateurs", icon: "group", visible: hasPermission("users.read") },
        { to: "/administration/roles", label: "Rôles & Permissions", icon: "badge", visible: hasPermission("roles.read") },
        { to: "/administration/licence", label: "Licence & Validité", icon: "verified_user", visible: canSeeSettings },
        { to: "/administration/sauvegardes", label: "Sauvegardes", icon: "archive", visible: hasPermission("backups.read") },
        { to: "/administration/audit", label: "Journal d'audit", icon: "history", visible: canSeeSettings },
        { to: "/administration/apropos", label: "Fiche technique", icon: "bookmark", visible: true },
      ],
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-topbar h-[calc(100vh-64px)] ${
        isSidebarCollapsed ? "w-20 overflow-visible" : "w-sidebar overflow-x-hidden overflow-y-auto"
      } bg-surface border-r border-border z-50 flex flex-col justify-between select-none transition-all duration-instant dark:bg-surface-dark dark:border-border-dark`}
    >
      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        {SECTIONS.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => item.visible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-0.5">
              {!isSidebarCollapsed && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted px-2.5 block mb-1 font-sans">
                  {section.title}
                </span>
              )}

              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `relative flex items-center ${
                        isSidebarCollapsed ? "justify-center h-9 px-0" : "h-8 px-2.5 gap-2.5"
                      } rounded transition-colors duration-instant text-body-sm font-medium ${
                        isActive
                          ? "bg-brand-900/10 text-brand-900 font-semibold dark:bg-brand-500/20 dark:text-white"
                          : "text-ink-secondary hover:bg-[#F5F7FA] hover:text-ink-primary dark:hover:bg-[#13263A] dark:text-ink-secondary-dark dark:hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* ACTIVE RAIL : Barre verticale Navy CECO */}
                        {isActive && (
                          <span className="absolute left-0 top-1 bottom-1 w-1 rounded-r bg-brand-900 dark:bg-brand-500" />
                        )}

                        <Icon
                          name={item.icon}
                          className={`text-[18px] flex-shrink-0 ${
                            isActive ? "text-brand-900 dark:text-brand-500 font-bold" : "text-ink-muted"
                          }`}
                        />

                        {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Déconnexion */}
      <div className="p-2 border-t border-border bg-surface dark:bg-surface-dark dark:border-border-dark">
        <button
          type="button"
          onClick={logout}
          className={`w-full flex items-center ${
            isSidebarCollapsed ? "justify-center h-9 px-0" : "h-8 px-2.5 gap-2.5"
          } rounded text-body-sm font-medium text-error hover:bg-error-subtle transition-colors duration-instant dark:hover:bg-error-subtle-dark`}
          title="Fermer la session"
        >
          <Icon name="logout" className="text-[18px] flex-shrink-0 text-error" />
          {!isSidebarCollapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}