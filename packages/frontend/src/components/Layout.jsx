// packages/frontend/src/components/Layout.jsx
import { useState, useEffect } from "react";
import { Outlet, Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ToastContainer from "./ToastContainer";
import CommandPaletteModal from "./CommandPaletteModal";
import OnboardingWizardModal from "./OnboardingWizardModal";
import UserDocumentationModal from "./UserDocumentationModal";
import useAuthStore from "../store/authStore";
import Icon from "./Icon";

export default function Layout() {
  const licenseStatus = useAuthStore((s) => s.licenseStatus);
  const licenseData = useAuthStore((s) => s.licenseData);

  // États des modales d'assistance
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  // État du Mode Audit UI/UX
  const [uxAuditActive, setUxAuditActive] = useState(false);

  const toggleUxAudit = () => {
    setUxAuditActive((prev) => !prev);
  };

  // Écouteur global pour les raccourcis clavier (Ctrl+K et F1)
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }

      if (e.key === "F1") {
        e.preventDefault();
        setShowDocs((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Application dynamique de la classe .ux-highlight sur les éléments balisés [data-ux]
  useEffect(() => {
    const uxElements = document.querySelectorAll("[data-ux]");
    uxElements.forEach((el) => {
      if (uxAuditActive) {
        el.classList.add("ux-highlight");
        el.setAttribute("data-ux-principle", el.getAttribute("data-ux") || "Ergonomie");
      } else {
        el.classList.remove("ux-highlight");
        el.removeAttribute("data-ux-principle");
      }
    });
  }, [uxAuditActive]);

  const isGrace = licenseStatus === "GRACE_PERIOD";
  const isReadOnly = licenseStatus === "READ_ONLY";
  const isTampered = licenseStatus === "TAMPERED";

  return (
    <div className="h-screen font-sans antialiased bg-slate-100 text-slate-800 flex overflow-hidden">
      {/* 1. Barre Latérale Enterprise */}
      <Sidebar
        uxAuditActive={uxAuditActive}
        onToggleUxAudit={toggleUxAudit}
      />

      {/* 2. Espace de Travail Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100">
        {/* Barre Supérieure Fixe */}
        <Header
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onOpenWizard={() => setShowWizard(true)}
          onOpenDocs={() => setShowDocs(true)}
        />

        {/* 3. Bandeaux d'Alerte de Licence Non-Bloquants */}
        {isGrace && (
          <div className="bg-amber-100 border-b border-amber-300 text-amber-950 px-6 py-2 text-xs font-bold flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center space-x-2">
              <Icon name="warning" className="text-[18px] text-amber-700" />
              <span>
                Période de grâce active : Il vous reste <strong>{licenseData?.graceDaysRemaining || 7} jour(s)</strong> pour renouveler la licence avant le passage en lecture seule.
              </span>
            </div>
            <Link
              to="/parametres/licence"
              className="px-3 py-1 bg-amber-800 text-white rounded text-[11px] font-bold hover:bg-amber-900 transition-colors"
            >
              Recharger
            </Link>
          </div>
        )}

        {isReadOnly && (
          <div className="bg-rose-600 text-white px-6 py-2 text-xs font-bold flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center space-x-2">
              <Icon name="lock" className="text-[18px]" />
              <span>
                Mode Lecture Seule actif : Les saisies et modifications sont verrouillées. La consultation et l'impression restent disponibles.
              </span>
            </div>
            <Link
              to="/parametres/licence"
              className="px-3 py-1 bg-white text-rose-700 rounded text-[11px] font-bold hover:bg-slate-100 transition-colors"
            >
              Activer une Clé
            </Link>
          </div>
        )}

        {isTampered && (
          <div className="bg-rose-700 text-white px-6 py-2 text-xs font-bold flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center space-x-2">
              <Icon name="security_update_warning" className="text-[18px]" />
              <span>
                Alerte de sécurité : L'horloge de votre ordinateur a été reculée. Synchronisez l'heure exacte pour rétablir l'accès complet.
              </span>
            </div>
            <Link
              to="/parametres/licence"
              className="px-3 py-1 bg-white text-rose-800 rounded text-[11px] font-bold hover:bg-slate-100 transition-colors"
            >
              Vérifier
            </Link>
          </div>
        )}

        {/* 4. Canvas Déroulant Principal */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <Outlet />
        </main>
      </div>

      {/* 5. Modales & Toasts */}
      <ToastContainer />

      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      <OnboardingWizardModal
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
      />

      <UserDocumentationModal
        isOpen={showDocs}
        onClose={() => setShowDocs(false)}
      />
    </div>
  );
}