// packages/frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "../components/Icon";
import useAuthStore from "../store/authStore";
import { Button, Input, Checkbox } from "../components/ui";
import logo from "../../assets/logo2.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const { login, status, error } = useAuthStore();

  const handleSubmit = (e) => {
    e.preventDefault();
    login(email, password, remember);
  };

  return (
    <div className="flex min-h-screen w-full bg-canvas-light text-ink-primary font-sans antialiased dark:bg-canvas-dark dark:text-ink-primary-dark">
      {/* Panneau Latéral Gauche : Identité Institutionnelle Sobre (Masqué sur mobile) */}
      <div className="relative hidden w-5/12 bg-brand-900 border-r border-border-strong-dark lg:flex lg:flex-col lg:justify-between p-12 text-white">
        {/* En-tête */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-24 items-center justify-center rounded bg-white p-1 shadow-xs">
            <img src={logo} alt="Logo CECO" className="h-full w-full object-contain" />
          </div>
          <div>
            <h2 className="text-body-md font-heading font-semibold text-white tracking-tight leading-tight">
              CECO Suite ERP
            </h2>
            <span className="text-overline text-white/60 uppercase tracking-wider block">
              Édition Professionnelle On-Premise
            </span>
          </div>
        </div>

        {/* Corps d'information de l'établissement */}
        <div className="space-y-6 max-w-sm">
          <div className="space-y-2">
            <h1 className="text-h2 font-heading font-semibold text-white tracking-tight">
              Gestion intégrée de centre de formation.
            </h1>
            <p className="text-body text-white/70 leading-relaxed">
              Administration, scolarité, évaluations continues, délibérations souveraines et certification sécurisée par QR Code.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/10 text-body-sm text-white/80">
            <div className="flex items-start gap-3">
              <Icon name="verified_user" className="text-[18px] text-success mt-0.5 flex-shrink-0" />
              <span>Base PostgreSQL locale autonome sans dépendance Internet obligatoire.</span>
            </div>
            <div className="flex items-start gap-3">
              <Icon name="qr_code_2" className="text-[18px] text-info mt-0.5 flex-shrink-0" />
              <span>Authentification hors-ligne inviolable scellée par cryptographie Ed25519.</span>
            </div>
          </div>
        </div>

        {/* Pied de panneau */}
        <div className="text-caption text-white/50 font-mono">
          © 2026 CECO Africa • Version 1.0.0 Stable
        </div>
      </div>

      {/* Panneau Droit : Formulaire d'Authentification */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-[400px] space-y-6"
        >
          {/* Logo visible sur écran mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="flex h-10 w-24 items-center justify-center rounded bg-white p-1 border border-border shadow-xs">
              <img src={logo} alt="Logo CECO" className="h-full w-full object-contain" />
            </div>
            <div>
              <h2 className="text-body-md font-heading font-semibold text-ink-primary">CECO ERP</h2>
              <span className="text-overline text-ink-muted uppercase">Connexion</span>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-h3 font-heading font-semibold text-ink-primary tracking-tight">
              Espace de Connexion
            </h1>
            <p className="text-body text-ink-secondary">
              Saisissez vos identifiants pour accéder à votre poste de travail.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <Input
              label="Adresse Email / Identifiant"
              id="email"
              type="email"
              required
              autoFocus
              leftIcon="person"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@local.ceco"
            />

            <Input
              label="Mot de passe"
              id="password"
              type={showPassword ? "text" : "password"}
              required
              leftIcon="lock"
              rightIcon={showPassword ? "visibility_off" : "visibility"}
              onRightIconClick={() => setShowPassword((v) => !v)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            <div className="flex items-center justify-between pt-1">
              <Checkbox
                label="Rester connecté sur ce poste"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
            </div>

            <AnimatePresence>
              {status === "error" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded bg-error-subtle p-3 border border-error/30 text-error text-caption font-medium flex items-center gap-2"
                >
                  <Icon name="error" className="text-[16px] flex-shrink-0" />
                  <span>{error || "Identifiants incorrects. Veuillez vérifier vos accès."}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={status === "loading"}
              icon={status !== "loading" ? "arrow_forward" : undefined}
              iconPosition="right"
            >
              Se Connecter
            </Button>
          </form>

          <div className="p-4 rounded bg-surface border border-border text-caption text-ink-muted space-y-1 dark:bg-surface-dark dark:border-border-dark">
            <div className="flex items-center gap-1.5 font-semibold text-ink-secondary">
              <Icon name="info" className="text-[16px] text-info" />
              <span>Assistance &amp; Déploiement</span>
            </div>
            <p>
              Pour toute réinitialisation d'accès ou ajout d'un poste sur le réseau local, contactez l'administrateur système de l'établissement.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}