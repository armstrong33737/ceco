// packages/frontend/src/app/Sidebar.jsx
import React, { useState, useEffect, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import useAuthStore from "../store/authStore";

export default function Sidebar() {
  const { user, hasPermission, logout, isSidebarCollapsed } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Habilitations RBAC
  const canSeeStudents = hasPermission(["students.read", "students.create"]);
  const canManageAcademicStructure = hasPermission(["formations.create", "formations.update", "center.update"]);
  const canSeeGradesEntry = hasPermission(["grades.read", "grades.create"]);
  const canDeliberate = hasPermission("grades.validate");
  const canGenerateBulletins = hasPermission(["bulletins.generate"]);
  const canManageCurriculum = hasPermission(["formations.create", "formations.update", "center.update"]);
  const canManageAdminSettings = hasPermission(["center.update", "users.read", "roles.read", "backups.read"]);

  // Matrice des Grandes Sections
  const SECTIONS = useMemo(() => [
    {
      id: "principal",
      title: "PRINCIPAL",
      icon: "dashboard",
      collapsible: false,
      subtitle: "Vue d'ensemble du centre",
      items: [
        { to: "/", label: "Tableau de bord", icon: "dashboard", visible: true, end: true },
      ],
    },
    {
      id: "academie",
      title: "GESTION ACADÉMIQUE",
      icon: "account_balance",
      collapsible: true,
      subtitle: "Structures & Apprenants",
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
      id: "pedagogie",
      title: "PÉDAGOGIE & ÉVALUATION",
      icon: "menu_book",
      collapsible: true,
      subtitle: "Cours & Notes régulières",
      items: [
        { to: "/pedagogie/saisie", label: "Saisie des notes", icon: "edit_note", visible: canSeeGradesEntry },
        { to: "/pedagogie/deliberations", label: "Délibérations du jury", icon: "gavel", visible: canDeliberate },
        { to: "/pedagogie/bulletins", label: "Bulletins & Diplômes", icon: "receipt_long", visible: canGenerateBulletins },
        { to: "/pedagogie/maquettes", label: "Maquettes de cours", icon: "auto_stories", visible: canManageCurriculum },
        { to: "/pedagogie/cursus", label: "Cursus filières", icon: "account_tree", visible: canManageCurriculum },
        { to: "/pedagogie/formateurs", label: "Formateurs", icon: "badge", visible: canManageCurriculum },
        { to: "/pedagogie/matieres", label: "Référentiel matières", icon: "library_books", visible: canManageCurriculum },
        { to: "/pedagogie/categories", label: "Catégories", icon: "category", visible: canManageCurriculum },
        { to: "/pedagogie/ponderations", label: "Pondérations CC / Exam", icon: "tune", visible: canManageCurriculum },
      ],
    },
    {
      id: "examens_blancs",
      title: "EXAMENS BLANCS",
      icon: "school",
      collapsible: true,
      badge: "DQP / CQP",
      subtitle: "Bordereaux & Examens d'État",
      items: [
        { to: "/examens-blancs/bordereau", label: "Bordereau & Saisie MINEFOP", icon: "assignment", visible: canSeeGradesEntry },
        { to: "/examens-blancs/sessions", label: "Sessions d'Examens", icon: "calendar_month", visible: canSeeGradesEntry },
        { to: "/examens-blancs/maquettes", label: "Maquettes par Filière", icon: "account_tree", visible: canManageCurriculum },
        { to: "/examens-blancs/epreuves", label: "Référentiel des Épreuves", icon: "library_books", visible: canManageCurriculum },
      ],
    },
    {
      id: "administration",
      title: "ADMINISTRATION & SÉCURITÉ",
      icon: "admin_panel_settings",
      collapsible: true,
      subtitle: "Système, Rôles & Sauvegardes",
      items: [
        { to: "/administration/centre", label: "Centre & Sceau d'État", icon: "storefront", visible: hasPermission("center.update") },
        { to: "/administration/modeles", label: "Gabarits d'actes", icon: "palette", visible: hasPermission("center.update") },
        { to: "/administration/utilisateurs", label: "Utilisateurs", icon: "group", visible: hasPermission("users.read") },
        { to: "/administration/roles", label: "Rôles & Permissions", icon: "badge", visible: hasPermission("roles.read") },
        { to: "/administration/licence", label: "Licence & Validité", icon: "verified_user", visible: hasPermission("center.update") },
        { to: "/administration/sauvegardes", label: "Sauvegardes .zip", icon: "archive", visible: hasPermission("backups.read") },
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

  // RÈGLE D'ACCORDÉON EXCLUSIF : UN SEUL MENU OUVERT À LA FOIS
  const [openSectionId, setOpenSectionId] = useState(() => {
    const currentPath = location.pathname;
    const match = SECTIONS.find((s) =>
      s.collapsible && s.items.some((i) => i.visible && (i.to === currentPath || (i.to !== "/" && currentPath.startsWith(i.to))))
    );
    return match ? match.id : "examens_blancs";
  });

  const [hoveredSectionId, setHoveredSectionId] = useState(null);

  // Synchronisation automatique de la section ouverte avec l'URL en cours
  useEffect(() => {
    const currentPath = location.pathname;
    const match = SECTIONS.find((s) =>
      s.collapsible && s.items.some((i) => i.visible && (i.to === currentPath || (i.to !== "/" && currentPath.startsWith(i.to))))
    );
    if (match && match.id !== openSectionId) {
      setOpenSectionId(match.id);
    }
  }, [location.pathname, SECTIONS]);

  // Clic sur l'en-tête de section
  const handleToggleSection = (sectionId, firstChildPath) => {
    if (isSidebarCollapsed) {
      if (firstChildPath) navigate(firstChildPath);
      return;
    }
    setOpenSectionId((prev) => (prev === sectionId ? null : sectionId));
  };

  return (
    <aside
      className={`fixed left-0 top-topbar h-[calc(100vh-64px)] ${
        isSidebarCollapsed ? "w-20 overflow-visible" : "w-sidebar overflow-x-hidden overflow-y-auto"
      } bg-surface border-r border-border z-50 flex flex-col justify-between select-none transition-all duration-instant dark:bg-surface-dark dark:border-border-dark`}
    >
      <nav className={`flex-1 py-3 px-2 space-y-2.5 ${isSidebarCollapsed ? "overflow-visible" : "overflow-y-auto"}`}>
        {SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => item.visible);
          if (visibleItems.length === 0) return null;

          const isOpen = openSectionId === section.id;
          const isSectionActive = visibleItems.some((i) =>
            i.to === location.pathname || (i.to !== "/" && location.pathname.startsWith(i.to))
          );
          const firstChild = visibleItems[0];
          const isFlyoutVisible = isSidebarCollapsed && hoveredSectionId === section.id;

          // SECTION PRINCIPALE SIMPLE (Tableau de bord)
          if (!section.collapsible) {
            const item = visibleItems[0];
            return (
              <div
                key={section.id}
                className="relative"
                onMouseEnter={() => isSidebarCollapsed && setHoveredSectionId(section.id)}
                onMouseLeave={() => isSidebarCollapsed && setHoveredSectionId(null)}
              >
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `relative flex items-center ${
                      isSidebarCollapsed ? "justify-center h-10 w-10 mx-auto" : "h-9 px-2.5 gap-2.5 w-full"
                    } rounded transition-colors duration-instant text-body-sm font-medium ${
                      isActive
                        ? "bg-brand-900 text-white font-semibold shadow-xs dark:bg-brand-500"
                        : "text-ink-secondary hover:bg-[#F5F7FA] hover:text-ink-primary dark:hover:bg-[#13263A] dark:text-ink-secondary-dark dark:hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        name={item.icon}
                        className={`text-[20px] flex-shrink-0 ${
                          isActive ? "text-white" : "text-ink-muted"
                        }`}
                      />
                      {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </>
                  )}
                </NavLink>

                {/* Tooltip de secours en mode replié */}
                {isFlyoutVisible && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 pl-2.5 z-[999] pointer-events-none animate-fadeIn">
                    <div className="px-3.5 py-2 bg-surface border border-border rounded shadow-modal dark:bg-surface-dark dark:border-border-dark flex items-center gap-2.5 whitespace-nowrap min-w-[180px]">
                      <div className="w-7 h-7 rounded bg-brand-900/10 text-brand-900 flex items-center justify-center dark:bg-brand-500/20 dark:text-brand-500 flex-shrink-0">
                        <Icon name={item.icon} className="text-[16px]" />
                      </div>
                      <div>
                        <span className="font-heading font-bold text-[12px] text-ink-primary dark:text-white block leading-tight">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-ink-muted leading-tight block mt-0.5">
                          {section.subtitle}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // GRANDES SECTIONS DÉROULANTES AVEC ACCORDÉON EXCLUSIF
          return (
            <div
              key={section.id}
              className="relative"
              onMouseEnter={() => isSidebarCollapsed && setHoveredSectionId(section.id)}
              onMouseLeave={() => isSidebarCollapsed && setHoveredSectionId(null)}
            >
              {/* Bouton d'En-tête de Section */}
              <button
                type="button"
                onClick={() => handleToggleSection(section.id, firstChild?.to)}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center h-10 w-10 mx-auto" : "justify-between h-9 px-2.5"
                } rounded transition-colors text-caption font-semibold ${
                  isSectionActive
                    ? "text-brand-900 bg-brand-900/10 font-bold dark:text-brand-500 dark:bg-brand-500/20"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-[#F5F7FA] dark:hover:bg-[#13263A]"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Icon
                    name={section.icon}
                    className={`text-[20px] flex-shrink-0 ${
                      isSectionActive ? "text-brand-900 dark:text-brand-500 font-bold" : "text-ink-muted"
                    }`}
                  />
                  {!isSidebarCollapsed && (
                    <span className="truncate uppercase tracking-wider text-[11px] font-sans">
                      {section.title}
                    </span>
                  )}
                </div>

                {!isSidebarCollapsed && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {section.badge && (
                      <span className="px-1.5 py-0.2 rounded bg-brand-900 text-white text-[9px] font-mono font-bold dark:bg-brand-500">
                        {section.badge}
                      </span>
                    )}
                    <Icon
                      name={isOpen ? "expand_less" : "expand_more"}
                      className="text-[17px] text-ink-muted transition-transform duration-100"
                    />
                  </div>
                )}
              </button>

              {/* MENU FLOTTANT QUAND LA SIDEBAR EST FERMÉE */}
              {isFlyoutVisible && (
                <div className="absolute left-full top-0 pl-2.5 z-[999] animate-fadeIn">
                  <div className="w-64 bg-surface border border-border rounded shadow-modal dark:bg-surface-dark dark:border-border-dark overflow-hidden flex flex-col">
                    <div className="p-3 bg-[#FAFBFD] border-b border-border dark:bg-[#07111D] dark:border-border-dark">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded bg-brand-900/10 text-brand-900 flex items-center justify-center dark:bg-brand-500/20 dark:text-brand-500 flex-shrink-0">
                            <Icon name={section.icon} className="text-[18px]" />
                          </div>
                          <div>
                            <h4 className="font-heading font-bold text-[12px] text-ink-primary dark:text-white leading-tight uppercase tracking-tight">
                              {section.title}
                            </h4>
                            <span className="text-[10px] text-ink-muted leading-tight block mt-0.5">
                              {section.subtitle}
                            </span>
                          </div>
                        </div>

                        {section.badge && (
                          <span className="px-1.5 py-0.5 rounded bg-brand-900 text-white text-[9px] font-mono font-bold dark:bg-brand-500 flex-shrink-0">
                            {section.badge}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-1.5 space-y-0.5 max-h-[340px] overflow-y-auto">
                      {visibleItems.map((subItem) => (
                        <NavLink
                          key={subItem.to}
                          to={subItem.to}
                          onClick={() => setHoveredSectionId(null)}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-2 rounded text-[12px] font-medium transition-colors ${
                              isActive
                                ? "bg-brand-900 text-white font-semibold shadow-xs dark:bg-brand-500"
                                : "text-ink-secondary hover:bg-[#F5F7FA] hover:text-ink-primary dark:text-ink-secondary-dark dark:hover:bg-[#13263A] dark:hover:text-white"
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icon
                                name={subItem.icon}
                                className={`text-[16px] flex-shrink-0 ${
                                  isActive ? "text-white" : "text-ink-muted"
                                }`}
                              />
                              <span className="truncate">{subItem.label}</span>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>

                    <div className="px-3 py-1.5 bg-[#FAFBFD] border-t border-border text-[9.5px] text-ink-muted font-mono dark:bg-[#07111D] dark:border-border-dark flex justify-between items-center">
                      <span>{visibleItems.length} sous-module(s)</span>
                      <span>CECO ERP</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SOUS-MENU DÉPLIÉ (UN SEUL OUVERT À LA FOIS EN MODE NORMAL) */}
              {!isSidebarCollapsed && isOpen && (
                <div className="pl-3 space-y-0.5 border-l-2 border-brand-900/20 ml-4 my-1 dark:border-brand-500/30">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `relative flex items-center h-8 px-2.5 gap-2 rounded transition-colors text-body-sm font-medium ${
                          isActive
                            ? "bg-brand-900 text-white font-semibold shadow-xs dark:bg-brand-500"
                            : "text-ink-secondary hover:bg-[#F5F7FA] hover:text-ink-primary dark:hover:bg-[#13263A] dark:text-ink-secondary-dark dark:hover:text-white"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            name={item.icon}
                            className={`text-[16px] flex-shrink-0 ${
                              isActive ? "text-white" : "text-ink-muted"
                            }`}
                          />
                          <span className="truncate text-[12.5px]">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
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
            isSidebarCollapsed ? "justify-center h-10 w-10 mx-auto" : "h-8 px-2.5 gap-2.5"
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