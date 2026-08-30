// packages/frontend/src/app/AppShell.jsx
import React, { useState, useEffect } from "react";
import { Outlet, Link } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";
import ToastContainer from "../components/feedback/ToastContainer";
import useAuthStore from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import Icon from "../components/Icon";
import OnboardingWizardModal from "../components/OnboardingWizardModal";
import UserDocumentationModal from "../components/UserDocumentationModal";

export default function AppShell() {
  const user = useAuthStore((s) => s.user);
  const isSidebarCollapsed = useAuthStore((s) => s.isSidebarCollapsed);
  const licenseStatus = useAuthStore((s) => s.licenseStatus);
  const licenseData = useAuthStore((s) => s.licenseData);
  const { initTheme } = useThemeStore();

  const [showWizard, setShowWizard] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    const dismissed = localStorage.getItem("ceco_onboarding_dismissed");
    if (!dismissed) {
      setShowWizard(true);
    }
  }, []);

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
    <div className="min-h-screen bg-canvas-light text-ink-primary font-sans antialiased dark:bg-canvas-dark dark:text-ink-primary-dark">
      {/* Topbar compacte et non saturée */}
      <Topbar
        user={user}
        onOpenWizard={() => setShowWizard(true)}
        onOpenDocs={() => setShowDocs(true)}
      />

      {/* Sidebar découpée sans onglets étouffants */}
      <Sidebar />

      {/* Zone de contenu standard */}
      <div className={`${isSidebarCollapsed ? "pl-20" : "pl-sidebar"} pt-topbar transition-all duration-instant`}>
        {isGrace && (
          <div className="bg-warning text-white px-content-x py-2 text-caption font-semibold flex items-center justify-between border-b border-warning-dark shadow-xs sticky top-topbar z-40">
            <div className="flex items-center gap-2">
              <Icon name="warning" className="text-[18px]" />
              <span>
                Période de grâce active : il vous reste <strong>{licenseData?.graceDaysRemaining || 7} jour(s)</strong> pour recharger.
              </span>
            </div>
            <Link to="/administration/licence" className="px-3 py-1 bg-white text-warning font-bold rounded-[2px] text-[11px]">
              Recharger
            </Link>
          </div>
        )}

        {isReadOnly && (
          <div className="bg-error text-white px-content-x py-2 text-caption font-semibold flex items-center justify-between border-b border-error-dark shadow-xs sticky top-topbar z-40">
            <div className="flex items-center gap-2">
              <Icon name="lock" className="text-[18px]" />
              <span>Mode Consultation / Lecture seule actif.</span>
            </div>
            <Link to="/administration/licence" className="px-3 py-1 bg-white text-error font-bold rounded-[2px] text-[11px]">
              Activer Licence
            </Link>
          </div>
        )}

        {isTampered && (
          <div className="bg-error text-white px-content-x py-2 text-caption font-semibold flex items-center justify-between border-b border-error-dark shadow-xs sticky top-topbar z-40">
            <div className="flex items-center gap-2">
              <Icon name="security_update_warning" className="text-[18px]" />
              <span>Alerte de sécurité : horloge système manipulée.</span>
            </div>
            <Link to="/administration/licence" className="px-3 py-1 bg-white text-error font-bold rounded-[2px] text-[11px]">
              Détails
            </Link>
          </div>
        )}

        <main className="min-h-[calc(100vh-64px)] px-content-x py-content-y max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Recherche Ctrl+K */}
      <CommandPalette />

      {/* Notifications Toasts */}
      <ToastContainer />

      {/* Guide Interactif */}
      <OnboardingWizardModal isOpen={showWizard} onClose={() => setShowWizard(false)} />

      {/* Documentation Plein Texte F1 */}
      <UserDocumentationModal isOpen={showDocs} onClose={() => setShowDocs(false)} />
    </div>
  );
}