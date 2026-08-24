// packages/frontend/src/components/Layout.jsx
import { useState, useEffect } from "react";
import { Outlet, Link } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import useAuthStore from "../store/authStore";
import Icon from "./Icon";
import OnboardingWizardModal from "./OnboardingWizardModal";
import UserDocumentationModal from "./UserDocumentationModal";

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const isSidebarCollapsed = useAuthStore((s) => s.isSidebarCollapsed);
  const licenseStatus = useAuthStore((s) => s.licenseStatus);
  const licenseData = useAuthStore((s) => s.licenseData);

  // Modales d'Assistance
  const [showWizard, setShowWizard] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  // Détection du tout premier démarrage pour afficher le guide
  useEffect(() => {
    const dismissed = localStorage.getItem("ceco_onboarding_dismissed");
    if (!dismissed) {
      setShowWizard(true);
    }
  }, []);

  // Écouteur global pour la touche F1
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (e.key === "F1") {
        e.preventDefault();
        setShowDocs((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const isGrace = licenseStatus === "GRACE_PERIOD";
  const isReadOnly = licenseStatus === "READ_ONLY";
  const isTampered = licenseStatus === "TAMPERED";

  return (
    <div className="min-h-screen bg-surface">
      <Header
        user={user}
        onOpenWizard={() => setShowWizard(true)}
        onOpenDocs={() => setShowDocs(true)}
      />
      <Sidebar />

      <div className={`${isSidebarCollapsed ? "pl-20" : "pl-sidebar-width"} pt-12 transition-all duration-300`}>
        {/* BANDEAU PERSISTANT EN PÉRIODE DE GRÂCE */}
        {isGrace && (
          <div className="bg-amber-400 text-amber-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs sticky top-12 z-40">
            <div className="flex items-center gap-2">
              <Icon name="warning" className="text-[18px]" />
              <span>
                Période de grâce active : Il vous reste <strong>{licenseData?.graceDaysRemaining || 7} jour(s)</strong> pour recharger la licence avant le passage en lecture seule.
              </span>
            </div>
            <Link
              to="/parametres/licence"
              className="px-3 py-1 bg-amber-950 text-white rounded text-[11px] font-bold hover:bg-black transition-colors"
            >
              Recharger Maintenant
            </Link>
          </div>
        )}

        {/* BANDEAU EN MODE LECTURE SEULE */}
        {isReadOnly && (
          <div className="bg-error text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs sticky top-12 z-40">
            <div className="flex items-center gap-2">
              <Icon name="lock" className="text-[18px]" />
              <span>
                Mode Consultation / Lecture Seule actif : La saisie de données est suspendue. La consultation et l'impression d'actes restent disponibles.
              </span>
            </div>
            <Link
              to="/parametres/licence"
              className="px-3 py-1 bg-white text-error rounded text-[11px] font-bold hover:bg-slate-100 transition-colors"
            >
              Activer une Licence
            </Link>
          </div>
        )}

        {/* BANDEAU ALERTE HORLOGE MODIFIÉE */}
        {isTampered && (
          <div className="bg-error text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs sticky top-12 z-40">
            <div className="flex items-center gap-2">
              <Icon name="security_update_warning" className="text-[18px]" />
              <span>
                Alerte de sécurité : L'horloge de votre PC a été reculée. Synchronisez l'heure exacte pour rétablir la session complète.
              </span>
            </div>
            <Link
              to="/parametres/licence"
              className="px-3 py-1 bg-white text-error rounded text-[11px] font-bold hover:bg-slate-100 transition-colors"
            >
              Voir Détails
            </Link>
          </div>
        )}

        <main className="min-h-[calc(100vh-48px)] px-md py-md max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Modale Guide de Démarrage Étape par Étape */}
      <OnboardingWizardModal
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
      />

      {/* Modale Manuel d'Utilisation Plein Texte (Accessible par F1) */}
      <UserDocumentationModal
        isOpen={showDocs}
        onClose={() => setShowDocs(false)}
      />
    </div>
  );
}