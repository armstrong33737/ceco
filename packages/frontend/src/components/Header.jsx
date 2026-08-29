// packages/frontend/src/components/Header.jsx
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { showToast } from "../store/toastStore";
import Icon from "./Icon";

export default function Header({ onOpenCommandPalette, onOpenWizard, onOpenDocs }) {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuthStore();
  const isTeacher = user?.role?.name?.toLowerCase() === "formateur";
  const canInscribe = hasPermission("students.create");

  // Raccourci Fitts : Déclenchement direct du formulaire d'inscription
  const handleDirectInscription = () => {
    navigate("/etudiants?action=create");
  };

  const handleExportBackup = () => {
    navigate("/parametres/sauvegarde?action=trigger");
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 shrink-0 shadow-sm sticky top-0">
      {/* 1. Contexte Académique & Recherche Globale */}
      <div className="flex items-center space-x-4 flex-1 max-w-2xl">
        <div className="flex items-center space-x-2 bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-700 select-none shrink-0">
          <Icon name="calendar_month" className="text-slate-500 text-[16px]" />
          <span>
            Session : <strong className="text-slate-900 font-bold">2026-2027</strong>
          </span>
        </div>

        {/* Déclencheur Recherche Globale (Loi de Hick-Hyman - Ctrl+K) */}
        <div className="relative w-full max-w-md" data-ux="Loi de Hick (Recherche unique multi-critères)">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="w-full pl-9 pr-10 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 flex items-center justify-between text-left hover:bg-white hover:border-blue-600 transition-all shadow-inner"
          >
            <div className="flex items-center space-x-2 truncate text-slate-400">
              <Icon name="search" className="text-slate-400 text-[16px]" />
              <span className="truncate">Rechercher apprenant, N° dossier, session, facture...</span>
            </div>
            <kbd className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-mono border border-slate-300">
              CTRL+K
            </kbd>
          </button>
        </div>
      </div>

      {/* 2. Action Hub & Profil (Loi de Fitts) */}
      <div className="flex items-center space-x-3 shrink-0">
        {/* CTA Majeur d'Action */}
        {canInscribe && !isTeacher ? (
          <button
            type="button"
            onClick={handleDirectInscription}
            data-ux="Loi de Fitts (Action prioritaire identifiable)"
            className="bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs px-3.5 py-2 rounded shadow-sm transition-all flex items-center space-x-2"
            title="Inscrire un nouvel apprenant immédiatement"
          >
            <Icon name="add" className="text-[16px]" />
            <span>Inscrire un Apprenant</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/pedagogie/saisie")}
            data-ux="Loi de Fitts (Action prioritaire identifiable)"
            className="bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs px-3.5 py-2 rounded shadow-sm transition-all flex items-center space-x-2"
            title="Accéder aux bordereaux de saisie"
          >
            <Icon name="edit_note" className="text-[16px]" />
            <span>Saisie des Notes</span>
          </button>
        )}

        {/* CTA Secondaire */}
        {!isTeacher && (
          <button
            type="button"
            onClick={handleExportBackup}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-medium text-xs px-3 py-2 rounded transition-all flex items-center space-x-1.5"
            title="Sauvegarde rapide de la base de données"
          >
            <Icon name="archive" className="text-slate-500 text-[16px]" />
            <span className="hidden sm:inline">Sauvegarder</span>
          </button>
        )}

        {/* Bouton Guide */}
        <button
          type="button"
          onClick={onOpenWizard}
          className="p-2 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors hidden lg:flex items-center"
          title="Guide interactif de démarrage"
        >
          <Icon name="explore" className="text-[18px] text-blue-700" />
        </button>

        {/* Bouton Aide F1 */}
        <button
          type="button"
          onClick={onOpenDocs}
          className="p-2 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors hidden sm:flex items-center gap-1"
          title="Manuel d'utilisation complet (F1)"
        >
          <Icon name="help_outline" className="text-[18px]" />
          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1 py-0.2 rounded border border-slate-300">
            F1
          </span>
        </button>

        <div className="h-6 w-px bg-slate-300 mx-1"></div>

        {/* Alertes Système */}
        <button
          type="button"
          onClick={() => showToast("Toutes les sessions de formation sont synchronisées avec succès.", "success")}
          className="relative p-2 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Notifications système"
        >
          <Icon name="notifications" className="text-[18px]" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
        </button>

        {/* Profil Utilisateur */}
        <div className="flex items-center space-x-3 pl-2 border-l border-slate-200 select-none">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs ring-2 ring-slate-200">
            {user?.firstName ? user.firstName.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="hidden md:block text-left leading-tight">
            <p className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
              {user ? `${user.firstName} ${user.lastName}` : "Utilisateur"}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              {user?.role?.name || "Administrateur"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}