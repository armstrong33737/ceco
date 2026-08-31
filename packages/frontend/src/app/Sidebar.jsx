// packages/frontend/src/app/Sidebar.jsx
import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";
import Icon from "../components/Icon";
import useAuthStore from "../store/authStore";

export default function Sidebar() {
  const { user, hasPermission, logout, isSidebarCollapsed } = useAuthStore();

  // Habilitations RBAC granulaires
  const canSeeStudents = hasPermission(["students.read", "students.create"]);
  const canManageAcademicStructure = hasPermission(["formations.create", "formations.update", "center.update"]);
  const canSeeGradesEntry = hasPermission(["grades.read", "grades.create"]);
  const canDeliberate = hasPermission("grades.validate");
  const canGenerateBulletins = hasPermission(["bulletins.generate", "grades.read"]);
  const canManageCurriculum = hasPermission(["formations.create", "formations.update", "center.update"]);
  const canManageAdminSettings = hasPermission(["center.update", "users.read", "roles.read", "backups.read"]);

  // Matrice de navigation sectionnée avec étanchéité par rôle
  const SECTIONS = useMemo(() => [
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
        { to: "/academie/filieres", label: "Filières & Cycles", icon: "account_tree", visible: canManageAcademicStructure },
        { to: "/academie/promotions", label: "Promotions", icon: "school", visible: canManageAcademicStructure },
        { to: "/academie/classes", label: "Classes", icon: "groups", visible: canManageAcademicStructure },
        { to: "/academie/sessions", label: "Sessions & Transition", icon: "calendar_month", visible: hasPermission("center.update") },
        { to: "/academie/salles", label: "Salles & Espaces", icon: "meeting_room", visible: canManageAcademicStructure },
      ],
    },
    {
      title: "PÉDAGOGIE & ÉVALUATION",
      items: [
        { to: "/pedagogie/saisie", label: "Saisie des notes", icon: "edit_note", visible: canSeeGradesEntry },
        { to: "/pedagogie/deliberations", label: "Délibérations", icon: "gavel", visible: canDeliberate },
        { to: "/pedagogie/bulletins", label: "Bulletins & Diplômes", icon: "receipt_long", visible: canGenerateBulletins },
        { to: "/pedagogie/maquettes", label: "Maquettes de cours", icon: "auto_stories", visible: canManageCurriculum },
        { to: "/pedagogie/cursus", label: "Cursus filières", icon: "account_tree", visible: canManageCurriculum },
        { to: "/pedagogie/formateurs", label: "Formateurs", icon: "badge", visible: canManageCurriculum },
        { to: "/pedagogie/matieres", label: "Référentiel matières", icon: "library_books", visible: canManageCurriculum },
        { to: "/pedagogie/categories", label: "Catégories", icon: "category", visible: canManageCurriculum },
        { to: "/pedagogie/ponderations", label: "Pondérations", icon: "tune", visible: canManageCurriculum },
      ],
    },
    {
      title: "ADMINISTRATION",
      items: [
        { to: "/administration/centre", label: "Centre & Sceau", icon: "storefront", visible: hasPermission("center.update") },
        { to: "/administration/modeles", label: "Gabarits d'actes", icon: "palette", visible: hasPermission("center.update") },
        { to: "/administration/utilisateurs", label: "Utilisateurs", icon: "group", visible: hasPermission("users.read") },
        { to: "/administration/roles", label: "Rôles & Permissions", icon: "badge", visible: hasPermission("roles.read") },
        { to: "/administration/licence", label: "Licence & Validité", icon: "verified_user", visible: hasPermission("center.update") },
        { to: "/administration/sauvegardes", label: "Sauvegardes", icon: "archive", visible: hasPermission("backups.read") },
        { to: "/administration/audit", label: "Journal d'audit", icon: "history", visible: hasPermission("center.update") },
        { to: "/administration/apropos", label: "Fiche technique", icon: "bookmark", visible: canManageAdminSettings },
      ],
    },
  ], [
    canSeeStudents,
    canManageAcademicStructure,
    canSeeGradesEntry,
    canDeliberate,
    canGenerateBulletins,
    canManageCurriculum,
    canManageAdminSettings,
    hasPermission,
  ]);

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

      {/* Profil connecté & Déconnexion */}
      <div className="p-2.5 border-t border-border bg-surface space-y-2 dark:bg-surface-dark dark:border-border-dark">
        {!isSidebarCollapsed && (
          <div className="px-2 py-1 flex items-center justify-between text-[11px] text-ink-muted">
            <span className="truncate max-w-[120px] font-semibold text-ink-primary dark:text-white">
              {user ? `${user.firstName} ${user.lastName}` : "Utilisateur"}
            </span>
            <span className="font-mono px-1.5 py-0.2 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark text-[10px]">
              {user?.role?.name || "Rôle"}
            </span>
          </div>
        )}

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