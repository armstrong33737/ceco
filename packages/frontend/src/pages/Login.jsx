// packages/frontend/src/pages/Login.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "../components/Icon";
import useAuthStore from "../store/authStore";

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
    <div className="flex min-h-screen w-full bg-slate-100 font-sans antialiased text-slate-800">
      {/* 1. Panneau Gauche : Vitrine Enterprise Slate */}
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-900 lg:flex lg:flex-col lg:justify-between p-12 text-slate-300 border-r border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
            <Icon name="school" className="text-[20px]" />
          </div>
          <div>
            <span className="font-bold text-sm text-white tracking-tight block leading-none">
              CECO <span className="text-blue-400 font-mono text-xs">ERP</span>
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Suite Pédagogique &amp; Administrative
            </span>
          </div>
        </div>

        {/* Message Métier Central */}
        <div className="space-y-6 max-w-md">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-blue-400 font-semibold">
            <Icon name="verified" className="text-[16px] text-emerald-400" />
            <span>Mode On-Premise &amp; Réseau Sécurisé</span>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
            La gestion intégrale de votre centre de formation professionnelle.
          </h2>

          <p className="text-xs text-slate-400 leading-relaxed">
            Inscriptions d'apprenants, saisie des évaluations, délibérations souveraines du jury, bulletins semestriels et diplômes certifiés par QR Code hors-ligne.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded bg-slate-950/60 border border-slate-800 space-y-1 text-center">
              <Icon name="group" className="text-blue-400 text-[20px] mx-auto block" />
              <span className="text-[11px] font-bold text-slate-200 block">Scolarité</span>
            </div>

            <div className="p-3 rounded bg-slate-950/60 border border-slate-800 space-y-1 text-center">
              <Icon name="edit_note" className="text-amber-400 text-[20px] mx-auto block" />
              <span className="text-[11px] font-bold text-slate-200 block">Notes &amp; CC</span>
            </div>

            <div className="p-3 rounded bg-slate-950/60 border border-slate-800 space-y-1 text-center">
              <Icon name="workspace_premium" className="text-emerald-400 text-[20px] mx-auto block" />
              <span className="text-[11px] font-bold text-slate-200 block">Diplômes V4</span>
            </div>
          </div>
        </div>

        {/* Pied Gauche */}
        <div className="text-[11px] text-slate-500 font-mono">
          © 2026 Armstrong Euclador NGALEU • Tous droits réservés.
        </div>
      </div>

      {/* 2. Panneau Droit : Formulaire de Connexion Haute Densité */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-sm bg-white p-8 rounded-xl border border-slate-200 shadow-modal space-y-5"
        >
          <div className="space-y-1 text-center sm:text-left">
            <div className="inline-flex lg:hidden items-center space-x-2 mb-3">
              <div className="w-7 h-7 rounded bg-blue-700 flex items-center justify-center text-white font-bold text-xs">
                <Icon name="school" className="text-[16px]" />
              </div>
              <span className="font-bold text-sm text-slate-900">CECO ERP</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Connexion à votre espace</h1>
            <p className="text-xs text-slate-500">
              Saisissez vos identifiants pour ouvrir votre session.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label htmlFor="login-email" className="block text-slate-700 font-bold uppercase text-[10px] tracking-wider mb-1">
                Identifiant / Email
              </label>
              <div className="relative">
                <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@local.ceco"
                  className="input-field pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-slate-700 font-bold uppercase text-[10px] tracking-wider mb-1">
                Mot de passe
              </label>
              <div className="relative">
                <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-9 pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <Icon name={showPassword ? "visibility_off" : "visibility"} className="text-[18px]" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded accent-blue-700 h-4 w-4"
                />
                <span>Mémoriser ma session</span>
              </label>
            </div>

            <AnimatePresence>
              {status === "error" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={status === "loading"}
              className="btn-primary w-full h-10 text-xs font-bold justify-center mt-2"
            >
              {status === "loading" ? (
                <>
                  <Icon name="progress_activity" className="animate-spin text-[16px]" />
                  <span>Vérification des accès...</span>
                </>
              ) : (
                <>
                  <span>Ouvrir la session</span>
                  <Icon name="arrow_forward" className="text-[16px]" />
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 text-center text-[11px] text-slate-400">
            Besoin d'aide ? Contactez l'administrateur de votre établissement.
          </div>
        </motion.div>
      </div>
    </div>
  );
}