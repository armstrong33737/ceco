// packages/frontend/src/components/CommandPaletteModal.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import Icon from "./Icon";

const STATIC_COMMANDS = [
  // Pilotage
  { id: "nav-dash", category: "Pilotage", label: "Vue Synthétique (Tableau de bord)", icon: "dashboard", path: "/" },
  { id: "nav-audit", category: "Pilotage", label: "Journal d'Audit & Traçabilité", icon: "history", path: "/parametres/audit" },

  // Scolarité
  { id: "nav-students", category: "Scolarité", label: "Apprenants / Étudiants (Registre)", icon: "group", path: "/etudiants" },
  { id: "act-new-student", category: "Actions Rapides", label: "Inscrire un Apprenant (Formulaire)", icon: "person_add", path: "/etudiants?action=create" },
  { id: "nav-formations", category: "Scolarité", label: "Formations, Filières & Promotions", icon: "account_tree", path: "/formations" },

  // Pédagogie & Évaluations
  { id: "nav-grades", category: "Pédagogie", label: "Saisie des Notes (CC & Examens)", icon: "edit_note", path: "/pedagogie/saisie" },
  { id: "nav-delib", category: "Pédagogie", label: "Délibérations du Jury", icon: "gavel", path: "/pedagogie/deliberations" },
  { id: "nav-bulletins", category: "Pédagogie", label: "Bulletins, Relevés & Diplômes (V4)", icon: "receipt_long", path: "/pedagogie/bulletins" },
  { id: "nav-maquettes", category: "Pédagogie", label: "Sessions & Promotions (Maquettes)", icon: "auto_stories", path: "/pedagogie/maquettes" },
  { id: "nav-curriculum", category: "Pédagogie", label: "Cursus Filières Pluriannuels", icon: "menu_book", path: "/pedagogie/programmes-filieres" },
  { id: "nav-subjects", category: "Pédagogie", label: "Référentiel des Matières (Codes 5 car.)", icon: "library_books", path: "/pedagogie/matieres" },
  { id: "nav-teachers", category: "Pédagogie", label: "Formateurs & Vacataires", icon: "badge", path: "/pedagogie/formateurs" },
  { id: "nav-policies", category: "Pédagogie", label: "Pondérations CC / Examen", icon: "tune", path: "/pedagogie/ponderations" },

  // Administration
  { id: "nav-center", category: "Administration", label: "Configuration Centre & Agrément", icon: "storefront", path: "/parametres/centre" },
  { id: "nav-users", category: "Administration", label: "Comptes Utilisateurs & Accès", icon: "group", path: "/parametres/utilisateurs" },
  { id: "nav-roles", category: "Administration", label: "Rôles & RBAC", icon: "security", path: "/parametres/roles" },
  { id: "nav-templates", category: "Administration", label: "Gabarits de Documents (3 Blocs)", icon: "palette", path: "/parametres/modeles" },
  { id: "nav-license", category: "Administration", label: "Licence d'Exploitation & Sécurité", icon: "verified_user", path: "/parametres/licence" },
  { id: "nav-backups", category: "Administration", label: "Sauvegardes (.zip) & Restauration", icon: "archive", path: "/parametres/sauvegarde" },
  { id: "nav-about", category: "Administration", label: "À Propos de CECO Suite ERP", icon: "bookmark", path: "/parametres/apropos" },
];

export default function CommandPaletteModal({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [studentResults, setStudentResults] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setStudentResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setStudentResults([]);
      setLoadingStudents(false);
      return;
    }

    let isMounted = true;
    setLoadingStudents(true);

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/students?search=${encodeURIComponent(query.trim())}&limit=5`);
        if (isMounted) {
          const list = (res.data || []).map((st) => ({
            id: `student-${st.id}`,
            category: "Dossiers Apprenants",
            label: `${st.lastName} ${st.firstName} (${st.matricule})`,
            meta: st.inscriptions?.[0]?.classe?.label || "Sans classe",
            icon: "person",
            path: `/etudiants?search=${encodeURIComponent(st.matricule)}`,
          }));
          setStudentResults(list);
        }
      } catch {
        if (isMounted) setStudentResults([]);
      } finally {
        if (isMounted) setLoadingStudents(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  const filteredCommands = useMemo(() => {
    const q = query.toLowerCase().trim();
    const staticMatches = STATIC_COMMANDS.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.path.toLowerCase().includes(q)
    );

    return [...studentResults, ...staticMatches];
  }, [query, studentResults]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredCommands.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredCommands[selectedIndex];
      if (target) {
        handleExecuteCommand(target);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const handleExecuteCommand = (cmd) => {
    onClose();
    navigate(cmd.path);
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100000] flex items-start justify-center pt-16 sm:pt-20 px-4 bg-slate-900/50 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl rounded-lg bg-white shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[75vh]"
        >
          {/* Barre de recherche avec prompt Ctrl+K */}
          <div className="relative flex items-center border-b border-slate-200 px-4 bg-white">
            <Icon name="search" className="text-slate-400 text-[18px] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Rechercher apprenant, N° dossier, session, facture... (Ctrl+K)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-12 w-full bg-transparent px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-slate-400 hover:text-slate-700 p-1 text-xs"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-mono border border-slate-300 ml-2">
              CTRL+K
            </kbd>
          </div>

          {/* Liste des résultats filtrés */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
            {loadingStudents && (
              <div className="flex items-center gap-2 p-2 text-slate-500 text-[11px] font-medium">
                <Icon name="progress_activity" className="animate-spin text-[16px] text-blue-700" />
                <span>Recherche dans la base de données...</span>
              </div>
            )}

            {filteredCommands.length === 0 && !loadingStudents ? (
              <div className="p-8 text-center text-slate-500 space-y-1">
                <Icon name="search_off" className="text-3xl text-slate-300 mx-auto block" />
                <p className="font-semibold text-xs text-slate-700">Aucun résultat trouvé pour « {query} »</p>
                <p className="text-[11px]">Vérifiez l'orthographe du matricule ou essayez un mot-clé général.</p>
              </div>
            ) : (
              filteredCommands.map((cmd, idx) => {
                const isSelected = idx === selectedIndex;

                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => handleExecuteCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full p-2.5 rounded text-left transition-all flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? "bg-blue-700 text-white shadow-sm"
                        : "text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className={`flex h-7 w-7 items-center justify-center rounded flex-shrink-0 ${
                        isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        <Icon name={cmd.icon} className="text-[16px]" />
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-xs block truncate">{cmd.label}</span>
                        {cmd.meta && (
                          <span className={`text-[10px] block truncate font-mono ${
                            isSelected ? "text-white/80" : "text-slate-500"
                          }`}>
                            {cmd.meta}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold flex-shrink-0 ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}>
                      {cmd.category}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Pied */}
          <div className="border-t border-slate-200 px-4 py-2 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 select-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 rounded bg-white border border-slate-300 font-mono text-[9px]">↑</kbd>
                <kbd className="px-1 py-0.2 rounded bg-white border border-slate-300 font-mono text-[9px]">↓</kbd>
                <span>Naviguer</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.2 rounded bg-white border border-slate-300 font-mono text-[9px]">↵</kbd>
                <span>Sélectionner</span>
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">CECO QuickNav</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}