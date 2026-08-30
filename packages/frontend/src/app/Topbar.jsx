// packages/frontend/src/app/Topbar.jsx
import React from "react";
import Icon from "../components/Icon";
import { API_BASE } from "../lib/apiClient";
import useAuthStore from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { useCommandPaletteStore } from "../store/commandPaletteStore";
import logo from "../assets/logo2.png";

const isLocalServer = API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1");

export default function Topbar({ user, onOpenWizard, onOpenDocs }) {
  const { isSidebarCollapsed, toggleSidebar } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { open: openCommandPalette } = useCommandPaletteStore();

  return (
    <header className="fixed top-0 left-0 right-0 h-topbar bg-surface border-b border-border z-[60] px-4 sm:px-6 flex items-center justify-between transition-colors duration-instant dark:bg-surface-dark dark:border-border-dark">
      {/* Gauche : Toggle + Logo + Titre compact */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface text-ink-secondary hover:bg-[#F5F7FA] hover:text-ink-primary transition-colors dark:border-border-dark dark:bg-surface-dark dark:hover:bg-[#13263A]"
          title={isSidebarCollapsed ? "Déplier menu" : "Réduire menu"}
        >
          <Icon name={isSidebarCollapsed ? "menu" : "menu_open"} className="text-[20px]" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-18 items-center justify-center rounded bg-white p-0.5 border border-border shadow-xs dark:bg-white/10 dark:border-border-dark">
            <img src={logo} alt="CECO" className="h-full w-full object-contain" />
          </div>

          <div className="hidden lg:block border-l border-border pl-2.5 dark:border-border-dark">
            <span className="text-body-sm font-heading font-semibold text-ink-primary tracking-tight block truncate max-w-[200px] leading-tight dark:text-white">
              {user?.center?.name || "CECO ERP"}
            </span>
            <span className="text-[10px] text-ink-muted uppercase tracking-wider block font-mono">
              On-Premise Suite
            </span>
          </div>
        </div>
      </div>

      {/* Centre : Recherche Omnibar Ctrl+K calibrée */}
      <div className="flex-1 max-w-xs mx-4 hidden md:block">
        <button
          type="button"
          onClick={openCommandPalette}
          className="w-full flex items-center justify-between h-9 px-3 rounded bg-[#F5F7FA] border border-border text-caption text-ink-muted hover:border-brand-700 transition-colors shadow-xs dark:bg-[#07111D] dark:border-border-dark"
        >
          <div className="flex items-center gap-2 truncate">
            <Icon name="search" className="text-[18px] text-ink-muted" />
            <span className="truncate">Recherche rapide...</span>
          </div>
          <span className="px-1.5 py-0.2 rounded bg-surface border border-border font-mono text-[10px] font-bold text-ink-secondary dark:bg-surface-dark dark:border-border-dark flex-shrink-0">
            Ctrl+K
          </span>
        </button>
      </div>

      {/* Droite : Actions condensées */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Toggle Dark/Light Mode */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded border border-border bg-surface text-ink-secondary hover:bg-[#F5F7FA] hover:text-ink-primary transition-colors dark:border-border-dark dark:bg-surface-dark dark:hover:bg-[#13263A]"
          title={theme === "dark" ? "Mode Clair" : "Mode Sombre"}
        >
          <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} className="text-[18px]" />
        </button>

        {/* LAN Status Compact */}
        <div className="hidden xl:flex items-center gap-1.5 rounded bg-[#F5F7FA] px-2.5 py-1 border border-border text-[11px] font-mono text-ink-secondary dark:bg-[#07111D] dark:border-border-dark">
          <span className={`w-2 h-2 rounded-full ${isLocalServer ? "bg-success" : "bg-info"}`} />
          <span>{isLocalServer ? "Local" : "LAN"}</span>
        </div>

        {/* Bouton Guide */}
        <button
          type="button"
          onClick={onOpenWizard}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded border border-border bg-surface text-caption font-semibold text-ink-secondary hover:text-brand-900 hover:bg-[#F5F7FA] transition-colors dark:border-border-dark dark:bg-surface-dark dark:hover:text-white"
          title="Guide de prise en main"
        >
          <Icon name="explore" className="text-[16px] text-brand-900 dark:text-brand-500" />
          <span className="hidden sm:inline">Guide</span>
        </button>

        {/* Bouton Aide F1 */}
        <button
          type="button"
          onClick={onOpenDocs}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded border border-brand-900/30 bg-brand-900/5 text-caption font-semibold text-brand-900 hover:bg-brand-900 hover:text-white transition-colors dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-500 dark:hover:bg-brand-500 dark:hover:text-white"
          title="Documentation officielle (F1)"
        >
          <Icon name="help_outline" className="text-[16px]" />
          <span className="hidden sm:inline">Aide</span>
          <span className="px-1 py-0.2 rounded bg-brand-900/10 font-mono text-[9px] font-bold">F1</span>
        </button>

        {/* Profil compact */}
        <div className="flex items-center gap-2 pl-2 border-l border-border dark:border-border-dark">
          <div className="text-right hidden 2xl:block">
            <p className="text-caption font-semibold text-ink-primary leading-tight dark:text-white truncate max-w-[120px]">
              {user ? `${user.firstName} ${user.lastName}` : "Admin"}
            </p>
            <p className="text-[10px] text-ink-muted font-mono leading-tight">{user?.role?.name || "Administrateur"}</p>
          </div>
          <div className="w-8 h-8 rounded bg-brand-900 text-white font-heading font-semibold text-caption flex items-center justify-center shadow-xs select-none dark:bg-brand-500">
            {user?.firstName ? user.firstName.charAt(0).toUpperCase() : "A"}
          </div>
        </div>
      </div>
    </header>
  );
}