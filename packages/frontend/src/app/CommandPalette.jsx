// packages/frontend/src/app/CommandPalette.jsx
import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useCommandPaletteStore } from "../store/commandPaletteStore";
import useAuthStore from "../store/authStore";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";
import Badge from "../design-system/primitives/Badge";

export default function CommandPalette() {
  const { isOpen, close, searchQuery, setSearchQuery } = useCommandPaletteStore();
  const { hasPermission } = useAuthStore();
  const navigate = useNavigate();

  const [learners, setLearners] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Écouteur global pour Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useCommandPaletteStore.getState().toggle();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Recherche dynamique des apprenants dès la saisie
  useEffect(() => {
    if (!isOpen || !searchQuery.trim()) {
      setLearners([]);
      return;
    }

    const timer = setTimeout(() => {
      apiFetch(`/students?search=${encodeURIComponent(searchQuery.trim())}&limit=5`)
        .then((res) => setLearners(res.data || []))
        .catch(() => setLearners([]));
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  // Catalogue des routes & actions rapides
  const QUICK_ACTIONS = useMemo(() => [
    { label: "Tableau de Bord", path: "/", icon: "dashboard", category: "Navigation" },
    { label: "Registre des Apprenants", path: "/apprenants", icon: "group", category: "Scolarité", permission: "students.read" },
    { label: "Archives des Apprenants", path: "/apprenants/archives", icon: "archive", category: "Scolarité", permission: "students.read" },
    { label: "Cycles & Filières", path: "/academie/filieres", icon: "account_tree", category: "Structure", permission: "formations.read" },
    { label: "Promotions & Cohortes", path: "/academie/promotions", icon: "school", category: "Structure", permission: "formations.read" },
    { label: "Classes Promotionnelles", path: "/academie/classes", icon: "groups", category: "Structure", permission: "formations.read" },
    { label: "Sessions & Transitions", path: "/academie/sessions", icon: "calendar_month", category: "Structure", permission: "center.update" },
    { label: "Salles & Ateliers", path: "/academie/salles", icon: "meeting_room", category: "Structure", permission: "formations.read" },
    { label: "Saisie des Notes (Matrice)", path: "/pedagogie/saisie", icon: "edit_note", category: "Évaluation", permission: "grades.read" },
    { label: "Délibérations du Jury", path: "/pedagogie/deliberations", icon: "gavel", category: "Évaluation", permission: "grades.validate" },
    { label: "Bulletins & Diplômes", path: "/pedagogie/bulletins", icon: "receipt_long", category: "Évaluation", permission: "bulletins.generate" },
    { label: "Maquettes de Cours", path: "/pedagogie/maquettes", icon: "auto_stories", category: "Pédagogie", permission: "formations.read" },
    { label: "Cursus Filières", path: "/pedagogie/cursus", icon: "account_tree", category: "Pédagogie", permission: "formations.update" },
    { label: "Corps Professoral", path: "/pedagogie/formateurs", icon: "badge", category: "Pédagogie", permission: "formations.read" },
    { label: "Référentiel des Matières", path: "/pedagogie/matieres", icon: "library_books", category: "Pédagogie", permission: "formations.read" },
    { label: "Établissement & Sceau", path: "/administration/centre", icon: "storefront", category: "Administration", permission: "center.update" },
    { label: "Studio Gabarits d'Actes", path: "/administration/modeles", icon: "palette", category: "Administration", permission: "center.update" },
    { label: "Comptes Utilisateurs", path: "/administration/utilisateurs", icon: "group", category: "Administration", permission: "users.read" },
    { label: "Rôles & Permissions (RBAC)", path: "/administration/roles", icon: "badge", category: "Administration", permission: "roles.read" },
    { label: "Licence & Validité", path: "/administration/licence", icon: "verified_user", category: "Système", permission: "center.update" },
    { label: "Sauvegardes & Restauration", path: "/administration/sauvegardes", icon: "archive", category: "Système", permission: "backups.read" },
    { label: "Journal d'Audit Système", path: "/administration/audit", icon: "history", category: "Système", permission: "center.update" },
    { label: "Fiche Technique & À Propos", path: "/administration/apropos", icon: "bookmark", category: "Système" },
  ].filter((item) => !item.permission || hasPermission(item.permission)), [hasPermission]);

  // Filtrage des résultats selon la saisie
  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return QUICK_ACTIONS.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
  }, [searchQuery, QUICK_ACTIONS]);

  const allItems = useMemo(() => {
    const studentItems = learners.map((s) => ({
      type: "student",
      id: s.id,
      label: `${s.lastName} ${s.firstName}`,
      subtext: `Matricule : ${s.matricule} • ${s.inscriptions?.[0]?.classe?.label || "Sans classe"}`,
      path: `/apprenants?search=${encodeURIComponent(s.matricule)}`,
      icon: "person",
      category: "Dossier Apprenant",
    }));

    return [...studentItems, ...filteredActions.map((a) => ({ ...a, type: "action" }))];
  }, [learners, filteredActions]);

  // Navigation au clavier dans la liste
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < allItems.length ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : allItems.length - 1));
      } else if (e.key === "Enter" && allItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(allItems[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, allItems, selectedIndex]);

  function handleSelect(item) {
    close();
    navigate(item.path);
  }

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs p-4">
        {/* Backdrop click */}
        <div className="absolute inset-0" onClick={close} />

        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -10 }}
          transition={{ duration: 0.1 }}
          className="relative z-10 w-full max-w-2xl rounded bg-surface border border-border shadow-modal overflow-hidden flex flex-col dark:bg-surface-dark dark:border-border-dark"
        >
          {/* Barre de recherche omnibar */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border dark:border-border-dark">
            <Icon name="search" className="text-[20px] text-brand-900 dark:text-brand-500" />
            <input
              autoFocus
              type="text"
              placeholder="Rechercher un apprenant, une matière, une classe, un menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-body-md text-ink-primary outline-none placeholder:text-ink-muted/50 dark:text-ink-primary-dark"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-ink-muted hover:text-ink-primary p-1">
                <Icon name="close" className="text-[16px]" />
              </button>
            )}
            <span className="px-1.5 py-0.5 rounded bg-[#F5F7FA] border border-border text-[10px] font-mono text-ink-muted dark:bg-[#07111D] dark:border-border-dark">
              ESC
            </span>
          </div>

          {/* Liste des résultats */}
          <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
            {allItems.length === 0 ? (
              <div className="p-8 text-center text-caption text-ink-muted space-y-1">
                <Icon name="search_off" className="text-3xl text-ink-muted/60" />
                <p className="font-semibold text-ink-primary dark:text-white">Aucun résultat trouvé</p>
                <p>Essayez avec un autre nom, matricule ou intitulé de module.</p>
              </div>
            ) : (
              allItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${item.type}_${item.id || item.path}_${idx}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between p-2.5 rounded text-left transition-colors duration-instant ${
                      isSelected
                        ? "bg-brand-900 text-white dark:bg-brand-500"
                        : "hover:bg-[#F5F7FA] text-ink-primary dark:hover:bg-[#13263A] dark:text-ink-primary-dark"
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-[2px] flex-shrink-0 ${
                        isSelected ? "bg-white/20 text-white" : "bg-brand-900/5 text-brand-900 dark:bg-brand-500/10 dark:text-brand-500"
                      }`}>
                        <Icon name={item.icon || "arrow_forward"} className="text-[16px]" />
                      </div>
                      <div className="truncate">
                        <span className="text-body-sm font-semibold block truncate leading-tight">
                          {item.label}
                        </span>
                        {item.subtext && (
                          <span className={`text-[11px] block truncate mt-0.5 ${
                            isSelected ? "text-white/80" : "text-ink-muted"
                          }`}>
                            {item.subtext}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                      <Badge variant={isSelected ? "brand" : "neutral"} className={isSelected ? "bg-white/20 text-white border-transparent" : ""}>
                        {item.category}
                      </Badge>
                      <Icon name="subdirectory_arrow_left" className={`text-[14px] ${isSelected ? "text-white" : "text-ink-muted"}`} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Pied d'aide raccourcis */}
          <div className="px-4 py-2 bg-[#F5F7FA] border-t border-border flex items-center justify-between text-[11px] text-ink-muted dark:bg-[#07111D] dark:border-border-dark">
            <div className="flex items-center gap-3">
              <span><strong>↑↓</strong> Naviguer</span>
              <span><strong>↵</strong> Ouvrir</span>
              <span><strong>ESC</strong> Fermer</span>
            </div>
            <span className="font-mono">CECO Omnibar Search</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}