// packages/frontend/src/components/Sidebar.jsx
import { useState } from "react";
import { NavLink } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { showToast } from "../store/toastStore";
import Icon from "./Icon";

export default function Sidebar({ uxAuditActive, onToggleUxAudit }) {
  const { user, hasPermission, logout, isSidebarCollapsed, toggleSidebar } = useAuthStore();
  const isTeacher = user?.role?.name?.toLowerCase() === "formateur";

  // Gestion de l'état d'ouverture des accordéons
  const [openSections, setOpenSections] = useState({
    pilotage: true,
    scolarite: true,
    pedagogie: true,
    administration: false,
  });

  const toggleSection = (sectionKey) => {
    if (isSidebarCollapsed) {
      toggleSidebar();
      setOpenSections((prev) => ({ ...prev, [sectionKey]: true }));
      return;
    }
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  return (
    <aside
      id="sidebar"
      className={`${
        isSidebarCollapsed ? "w-16" : "w-80"
      } bg-slate-900 text-slate-300 flex flex-col justify-between transition-all duration-300 z-30 shrink-0 border-r border-slate-800 select-none h-screen`}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* 1. En-tête de Marque ERP (h-16) */}
        <div className="h-16 px-4 bg-slate-950 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
              <Icon name="school" className="text-[18px]" />
            </div>
            {!isSidebarCollapsed && (
              <div className="truncate leading-none">
                <span className="font-bold text-sm text-white tracking-tight block">
                  CECO <span className="text-blue-400 font-mono text-xs">ERP</span>
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Scolaire &amp; Formation
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 transition-colors"
            title={isSidebarCollapsed ? "Déplier le menu" : "Réduire le menu"}
          >
            <Icon name={isSidebarCollapsed ? "menu" : "menu_open"} className="text-[18px]" />
          </button>
        </div>

        {/* 2. Sélecteur d'Établissement / Centre */}
        {!isSidebarCollapsed && (
          <div className="p-3 border-b border-slate-800/60 bg-slate-900 shrink-0">
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 px-1 tracking-wider">
              Établissement / Centre
            </label>
            <div
              onClick={() => showToast(`Centre actif : ${user?.center?.name || "Campus Principal"}`, "info")}
              className="bg-slate-800 border border-slate-700 rounded p-2 flex items-center justify-between cursor-pointer hover:bg-slate-750 transition-colors"
              title="Centre de formation actif"
            >
              <div className="flex items-center space-x-2 truncate">
                <Icon name="account_balance" className="text-blue-400 text-[16px] shrink-0" />
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {user?.center?.name || "Campus Principal"}
                </span>
              </div>
              <Icon name="expand_more" className="text-slate-400 text-[16px]" />
            </div>
          </div>
        )}

        {/* 3. Navigation Catégorisée avec Accordéons Déroulants */}
        <nav className="flex-1 px-3 py-3 space-y-3 overflow-y-auto">
          {/* SECTION 1 : PILOTAGE */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection("pilotage")}
              className={`w-full flex items-center justify-between px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 hover:text-slate-200 transition-colors ${
                isSidebarCollapsed ? "justify-center px-0" : ""
              }`}
            >
              {!isSidebarCollapsed && <span>Pilotage</span>}
              {!isSidebarCollapsed && (
                <Icon
                  name={openSections.pilotage ? "expand_less" : "expand_more"}
                  className="text-[14px]"
                />
              )}
            </button>

            {(openSections.pilotage || isSidebarCollapsed) && (
              <div className="space-y-0.5">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm font-semibold"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    } ${isSidebarCollapsed ? "justify-center px-0 space-x-0" : ""}`
                  }
                  title="Vue Synthétique"
                >
                  <Icon name="insights" className="w-4 text-center text-[18px]" />
                  {!isSidebarCollapsed && <span>Vue Synthétique</span>}
                </NavLink>

                {hasPermission("center.update") && (
                  <NavLink
                    to="/parametres/audit"
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0" : ""}`
                    }
                    title="Journal d'Audit"
                  >
                    <div className="flex items-center space-x-3">
                      <Icon name="verified_user" className="w-4 text-center text-[18px] text-emerald-400" />
                      {!isSidebarCollapsed && <span>Audit &amp; Traçabilité</span>}
                    </div>
                    {!isSidebarCollapsed && (
                      <span className="bg-emerald-900/60 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-700">
                        100%
                      </span>
                    )}
                  </NavLink>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2 : SCOLARITÉ */}
          {hasPermission(["students.read", "students.create", "formations.read"]) && (
            <div>
              <button
                type="button"
                onClick={() => toggleSection("scolarite")}
                className={`w-full flex items-center justify-between px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 hover:text-slate-200 transition-colors ${
                  isSidebarCollapsed ? "justify-center px-0" : ""
                }`}
              >
                {!isSidebarCollapsed && <span>Scolarité</span>}
                {!isSidebarCollapsed && (
                  <Icon
                    name={openSections.scolarite ? "expand_less" : "expand_more"}
                    className="text-[14px]"
                  />
                )}
              </button>

              {(openSections.scolarite || isSidebarCollapsed) && (
                <div className="space-y-0.5">
                  <NavLink
                    to="/etudiants"
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0" : ""}`
                    }
                    title="Apprenants / Étudiants"
                  >
                    <div className="flex items-center space-x-3">
                      <Icon name="group" className="w-4 text-center text-[18px]" />
                      {!isSidebarCollapsed && <span>Apprenants / Élèves</span>}
                    </div>
                  </NavLink>

                  {!isTeacher && (
                    <NavLink
                      to="/formations"
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-all ${
                          isActive
                            ? "bg-blue-600 text-white shadow-sm font-semibold"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        } ${isSidebarCollapsed ? "justify-center px-0" : ""}`
                      }
                      title="Cycles, Filières & Promotions"
                    >
                      <div className="flex items-center space-x-3">
                        <Icon name="account_tree" className="w-4 text-center text-[18px]" />
                        {!isSidebarCollapsed && <span>Offre de Formation</span>}
                      </div>
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3 : PÉDAGOGIE & ÉVALUATIONS */}
          {hasPermission(["grades.read", "grades.create", "formations.read"]) && (
            <div>
              <button
                type="button"
                onClick={() => toggleSection("pedagogie")}
                className={`w-full flex items-center justify-between px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 hover:text-slate-200 transition-colors ${
                  isSidebarCollapsed ? "justify-center px-0" : ""
                }`}
              >
                {!isSidebarCollapsed && <span>Pédagogie</span>}
                {!isSidebarCollapsed && (
                  <Icon
                    name={openSections.pedagogie ? "expand_less" : "expand_more"}
                    className="text-[14px]"
                  />
                )}
              </button>

              {(openSections.pedagogie || isSidebarCollapsed) && (
                <div className="space-y-0.5">
                  <NavLink
                    to="/pedagogie/saisie"
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0 space-x-0" : ""}`
                    }
                    title="Saisie des Notes (CC & Examens)"
                  >
                    <Icon name="edit_note" className="w-4 text-center text-[18px]" />
                    {!isSidebarCollapsed && <span>Saisie des Notes</span>}
                  </NavLink>

                  {hasPermission("grades.validate") && (
                    <NavLink
                      to="/pedagogie/deliberations"
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                          isActive
                            ? "bg-blue-600 text-white shadow-sm font-semibold"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        } ${isSidebarCollapsed ? "justify-center px-0 space-x-0" : ""}`
                      }
                      title="Délibérations du Jury"
                    >
                      <Icon name="gavel" className="w-4 text-center text-[18px] text-amber-400" />
                      {!isSidebarCollapsed && <span>Délibérations Jury</span>}
                    </NavLink>
                  )}

                  <NavLink
                    to="/pedagogie/bulletins"
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0" : ""}`
                    }
                    title="Bulletins, Relevés & Diplômes"
                  >
                    <div className="flex items-center space-x-3">
                      <Icon name="receipt_long" className="w-4 text-center text-[18px]" />
                      {!isSidebarCollapsed && <span>Bulletins &amp; Diplômes</span>}
                    </div>
                    {!isSidebarCollapsed && (
                      <span className="bg-blue-900/60 text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        V4
                      </span>
                    )}
                  </NavLink>

                  <NavLink
                    to="/pedagogie/maquettes"
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0 space-x-0" : ""}`
                    }
                    title="Maquettes de Cours"
                  >
                    <Icon name="auto_stories" className="w-4 text-center text-[18px]" />
                    {!isSidebarCollapsed && <span>Maquettes de Cours</span>}
                  </NavLink>

                  {!isTeacher && (
                    <NavLink
                      to="/pedagogie/formateurs"
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                          isActive
                            ? "bg-blue-600 text-white shadow-sm font-semibold"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        } ${isSidebarCollapsed ? "justify-center px-0 space-x-0" : ""}`
                      }
                      title="Formateurs & Enseignants"
                    >
                      <Icon name="badge" className="w-4 text-center text-[18px]" />
                      {!isSidebarCollapsed && <span>Formateurs</span>}
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 4 : ADMINISTRATION & PARAMÈTRES */}
          {hasPermission("center.update") && (
            <div>
              <button
                type="button"
                onClick={() => toggleSection("administration")}
                className={`w-full flex items-center justify-between px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 hover:text-slate-200 transition-colors ${
                  isSidebarCollapsed ? "justify-center px-0" : ""
                }`}
              >
                {!isSidebarCollapsed && <span>Administration</span>}
                {!isSidebarCollapsed && (
                  <Icon
                    name={openSections.administration ? "expand_less" : "expand_more"}
                    className="text-[14px]"
                  />
                )}
              </button>

              {(openSections.administration || isSidebarCollapsed) && (
                <div className="space-y-0.5">
                  <NavLink
                    to="/parametres/centre"
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0 space-x-0" : ""}`
                    }
                    title="Configuration Centre & Agrément"
                  >
                    <Icon name="storefront" className="w-4 text-center text-[18px]" />
                    {!isSidebarCollapsed && <span>Configuration Centre</span>}
                  </NavLink>

                  <NavLink
                    to="/parametres/utilisateurs"
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0 space-x-0" : ""}`
                    }
                    title="Comptes Utilisateurs & Accès"
                  >
                    <Icon name="manage_accounts" className="w-4 text-center text-[18px]" />
                    {!isSidebarCollapsed && <span>Comptes Utilisateurs</span>}
                  </NavLink>

                  <NavLink
                    to="/parametres/roles"
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0 space-x-0" : ""}`
                    }
                    title="Rôles & Permissions RBAC"
                  >
                    <Icon name="security" className="w-4 text-center text-[18px]" />
                    {!isSidebarCollapsed && <span>Rôles &amp; RBAC</span>}
                  </NavLink>

                  <NavLink
                    to="/parametres/modeles"
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0 space-x-0" : ""}`
                    }
                    title="Gabarits de Documents (3 Blocs)"
                  >
                    <Icon name="palette" className="w-4 text-center text-[18px]" />
                    {!isSidebarCollapsed && <span>Gabarits Modèles</span>}
                  </NavLink>

                  <NavLink
                    to="/parametres/licence"
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0 space-x-0" : ""}`
                    }
                    title="Licence & Validité Ed25519"
                  >
                    <Icon name="verified_user" className="w-4 text-center text-[18px]" />
                    {!isSidebarCollapsed && <span>Licence &amp; Sécurité</span>}
                  </NavLink>

                  <NavLink
                    to="/parametres/sauvegarde"
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0 space-x-0" : ""}`
                    }
                    title="Sauvegardes & Restauration"
                  >
                    <Icon name="archive" className="w-4 text-center text-[18px]" />
                    {!isSidebarCollapsed && <span>Sauvegardes .zip</span>}
                  </NavLink>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* 4. Outil d'Inspection Ergonomique UI/UX (Bas de Sidebar) */}
        {!isSidebarCollapsed && (
          <div className="p-3 border-t border-slate-800 bg-slate-950 shrink-0">
            <div className="bg-slate-900 border border-slate-800 rounded p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Icon name="tune" className="text-blue-400 text-[16px]" />
                  <span>Mode Audit UI/UX</span>
                </span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(uxAuditActive)}
                    onChange={onToggleUxAudit}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Affiche les lois d'ergonomie et l'accessibilité appliquées sur les éléments.
              </p>
            </div>
          </div>
        )}

        {/* 5. Bouton Déconnexion */}
        <div className="p-2 border-t border-slate-800 bg-slate-950/80 shrink-0">
          <button
            type="button"
            onClick={logout}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? "justify-center px-0 h-9" : "space-x-3 px-3 py-2"
            } rounded text-xs font-semibold text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 transition-colors`}
            title="Déconnexion"
          >
            <Icon name="logout" className="text-[18px] shrink-0" />
            {!isSidebarCollapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}