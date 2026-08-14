import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import useAuthStore from "../store/authStore";
import Icon from "../components/Icon";

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  const getRemainingDays = () => {
    if (!user?.center?.subscription?.expiresAt) return 0;
    const diff = new Date(user.center.subscription.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const remainingDays = getRemainingDays();
  
  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-md max-w-7xl mx-auto"
    >
      {/* En-tête sobre et professionnel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {user?.center?.name || "Établissement CECO"}
            </span>
            <span className="text-outline-variant">•</span>
            <span className="text-xs text-on-surface-variant capitalize">{currentDate}</span>
          </div>
          <h1 className="text-xl font-bold text-on-surface mt-1">
            Bonjour, {user ? `${user.firstName} ${user.lastName}` : "Administrateur"}
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Espace d'administration et de supervision du centre de formation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/parametres/sauvegarde"
            className="flex items-center gap-1.5 rounded-md border border-outline-variant px-3.5 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <Icon name="archive" className="text-[16px]" />
            <span>Sauvegarder</span>
          </Link>
          <Link
            to="/parametres/centre"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-on-primary hover:bg-primary-dark transition-colors shadow-xs"
          >
            <Icon name="settings" className="text-[16px]" />
            <span>Configuration</span>
          </Link>
        </div>
      </div>

      {/* Grille des indicateurs opérationnels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
        
        {/* Métrique 1 : Validité de Licence */}
        <div className="rounded-md bg-surface-container-lowest p-md border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-semibold uppercase tracking-wider">Licence</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              remainingDays > 0 ? "bg-success-light text-success" : "bg-error-container text-error"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${remainingDays > 0 ? "bg-success" : "bg-error"}`} />
              {remainingDays > 0 ? "Active" : "Expirée"}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-on-surface tracking-tight">{remainingDays} jours</div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Plan Local ({user?.center?.subscription?.plan || "Standard"})
            </p>
          </div>
          <Link to="/parametres/licence" className="mt-3 pt-2.5 border-t border-outline-variant/15 text-xs font-semibold text-primary hover:underline flex items-center justify-between">
            <span>Détails &amp; Rechargement</span>
            <Icon name="chevron_right" className="text-[16px]" />
          </Link>
        </div>

        {/* Métrique 2 : Établissement & Réseau */}
        <div className="rounded-md bg-surface-container-lowest p-md border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-semibold uppercase tracking-wider">Localisation</span>
            <Icon name="place" className="text-[18px] text-on-surface-variant/60" />
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-on-surface truncate">
              {user?.center?.city || "Bafoussam"}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">
              {user?.center?.country || "Cameroun"} • {user?.center?.phone || "Non renseigné"}
            </p>
          </div>
          <Link to="/parametres/centre" className="mt-3 pt-2.5 border-t border-outline-variant/15 text-xs font-semibold text-primary hover:underline flex items-center justify-between">
            <span>Fiche établissement</span>
            <Icon name="chevron_right" className="text-[16px]" />
          </Link>
        </div>

        {/* Métrique 3 : Contrôle d'accès */}
        <div className="rounded-md bg-surface-container-lowest p-md border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-semibold uppercase tracking-wider">Sécurité</span>
            <Icon name="shield" className="text-[18px] text-on-surface-variant/60" />
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-on-surface">RBAC Activé</div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Rôle : {user?.role?.name || "Administrateur"}
            </p>
          </div>
          <Link to="/parametres/utilisateurs" className="mt-3 pt-2.5 border-t border-outline-variant/15 text-xs font-semibold text-primary hover:underline flex items-center justify-between">
            <span>Gestion des accès</span>
            <Icon name="chevron_right" className="text-[16px]" />
          </Link>
        </div>

        {/* Métrique 4 : Données locales */}
        <div className="rounded-md bg-surface-container-lowest p-md border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-semibold uppercase tracking-wider">Base de données</span>
            <Icon name="dns" className="text-[18px] text-on-surface-variant/60" />
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-on-surface">PostgreSQL</div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Instance locale • Port 5433
            </p>
          </div>
          <Link to="/parametres/sauvegarde" className="mt-3 pt-2.5 border-t border-outline-variant/15 text-xs font-semibold text-primary hover:underline flex items-center justify-between">
            <span>Archives .zip</span>
            <Icon name="chevron_right" className="text-[16px]" />
          </Link>
        </div>
      </div>

      {/* Vue d'ensemble opérationnelle & Raccourcis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        
        {/* État des services */}
        <div className="lg:col-span-2 rounded-md bg-surface-container-lowest p-lg border border-outline-variant/30 shadow-xs">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3 mb-md">
            <div>
              <h2 className="text-sm font-bold text-on-surface">État des services système</h2>
              <p className="text-xs text-on-surface-variant">Intégrité des composants du serveur local</p>
            </div>
            <span className="text-[11px] font-semibold text-success bg-success-light px-2.5 py-1 rounded">
              Opérationnel
            </span>
          </div>

          <div className="divide-y divide-outline-variant/15 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="font-semibold text-on-surface">Moteur de base de données (PostgreSQL)</span>
              </div>
              <span className="text-on-surface-variant font-mono">Connecté (localhost:5433)</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="font-semibold text-on-surface">API REST Locale (Express)</span>
              </div>
              <span className="text-on-surface-variant font-mono">Port 4000 (Actif)</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="font-semibold text-on-surface">Système de permissions &amp; RBAC</span>
              </div>
              <span className="text-on-surface-variant">Prisma Engine v5.20</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="font-semibold text-on-surface">Service de sauvegarde &amp; restauration</span>
              </div>
              <span className="text-on-surface-variant">Format .zip (Actif)</span>
            </div>
          </div>
        </div>

        {/* Liens de navigation rapide */}
        <div className="rounded-md bg-surface-container-lowest p-lg border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-on-surface border-b border-outline-variant/20 pb-3 mb-md">
              Accès rapide
            </h2>
            <nav className="space-y-1.5">
              <Link
                to="/parametres/centre"
                className="flex items-center justify-between p-2 rounded-md hover:bg-surface-container text-xs font-medium text-on-surface transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon name="storefront" className="text-[18px] text-on-surface-variant" />
                  <span>Identité du centre</span>
                </div>
                <Icon name="arrow_forward" className="text-[14px] text-on-surface-variant/60" />
              </Link>

              <Link
                to="/parametres/utilisateurs"
                className="flex items-center justify-between p-2 rounded-md hover:bg-surface-container text-xs font-medium text-on-surface transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon name="group" className="text-[18px] text-on-surface-variant" />
                  <span>Comptes utilisateurs</span>
                </div>
                <Icon name="arrow_forward" className="text-[14px] text-on-surface-variant/60" />
              </Link>

              <Link
                to="/parametres/roles"
                className="flex items-center justify-between p-2 rounded-md hover:bg-surface-container text-xs font-medium text-on-surface transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon name="badge" className="text-[18px] text-on-surface-variant" />
                  <span>Rôles &amp; permissions</span>
                </div>
                <Icon name="arrow_forward" className="text-[14px] text-on-surface-variant/60" />
              </Link>

              <Link
                to="/parametres/sauvegarde"
                className="flex items-center justify-between p-2 rounded-md hover:bg-surface-container text-xs font-medium text-on-surface transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon name="cloud_download" className="text-[18px] text-on-surface-variant" />
                  <span>Sauvegarde &amp; Restauration</span>
                </div>
                <Icon name="arrow_forward" className="text-[14px] text-on-surface-variant/60" />
              </Link>

              <Link
                to="/parametres/licence"
                className="flex items-center justify-between p-2 rounded-md hover:bg-surface-container text-xs font-medium text-on-surface transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon name="verified_user" className="text-[18px] text-on-surface-variant" />
                  <span>Abonnement &amp; Licence</span>
                </div>
                <Icon name="arrow_forward" className="text-[14px] text-on-surface-variant/60" />
              </Link>
            </nav>
          </div>

          <div className="pt-3 border-t border-outline-variant/15 mt-3 flex justify-between items-center text-[11px] text-on-surface-variant">
            <span>CECO Version 1.0.0</span>
            <Link to="/parametres/apropos" className="text-primary hover:underline font-semibold">
              Documentation
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}