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
    <div className="flex min-h-screen w-full bg-paper">
      {/* Panneau illustration — masqué sur petit écran, gradient Argon */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-primary to-violet lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-1/3 translate-y-1/3 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/3 right-10 h-40 w-40 rounded-full bg-info/20 blur-2xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center px-lg text-center"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="mb-lg flex h-24 w-24 items-center justify-center rounded-md bg-white/15 backdrop-blur-sm shadow-lg"
          >
            <Icon name="school" className="text-white text-[48px]" />
          </motion.div>
          <h2 className="text-3xl font-bold text-white">CECO</h2>
          <p className="mt-3 max-w-sm text-white/80">
            La gestion de votre centre de formation — apprenants, notes,
            documents — réunie dans un seul espace simple à utiliser.
          </p>

          <div className="mt-xl flex gap-md">
            {[
              { icon: "group", label: "Apprenants" },
              { icon: "grade", label: "Notes" },
              { icon: "description", label: "Documents" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-2 rounded-md bg-white/10 px-4 py-3 backdrop-blur-sm">
                <Icon name={f.icon} className="text-white text-[22px]" />
                <span className="text-xs text-white/80">{f.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Panneau formulaire */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div className="mb-xl lg:hidden flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-primary to-violet">
              <Icon name="school" className="text-white text-[20px]" />
            </div>
            <span className="text-lg font-bold text-on-surface">CECO</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Bienvenue</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Connectez-vous à votre espace CECO
          </p>

          <form onSubmit={handleSubmit} className="mt-lg flex flex-col gap-md">
            <div className="group flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
              >
                Identifiant
              </label>
              <div className="relative flex items-center">
                <Icon
                  name="person"
                  className="pointer-events-none absolute left-3 text-[20px] text-on-surface-variant/50 transition-colors group-focus-within:text-primary"
                />
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@centre.cm"
                  className="h-12 w-full rounded-md bg-surface pl-10 pr-4 text-base text-on-surface
                             outline-none shadow-[inset_0_0_0_1px_theme(colors.outline-variant)]
                             transition-shadow placeholder:text-on-surface-variant/40
                             focus:shadow-[inset_0_0_0_2px_theme(colors.primary)]"
                />
              </div>
            </div>

            <div className="group flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
              >
                Mot de passe
              </label>
              <div className="relative flex items-center">
                <Icon
                  name="lock"
                  className="pointer-events-none absolute left-3 text-[20px] text-on-surface-variant/50 transition-colors group-focus-within:text-primary"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 w-full rounded-md bg-surface pl-10 pr-12 text-base text-on-surface
                             outline-none shadow-[inset_0_0_0_1px_theme(colors.outline-variant)]
                             transition-shadow placeholder:text-on-surface-variant/40
                             focus:shadow-[inset_0_0_0_2px_theme(colors.primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 text-on-surface-variant/50 transition-colors hover:text-on-surface"
                >
                  <Icon name={showPassword ? "visibility_off" : "visibility"} className="text-[20px]" />
                </button>
              </div>
            </div>

            <label className="mt-1 flex cursor-pointer items-center gap-2 select-none">
              <span className="relative flex items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-surface shadow-[inset_0_0_0_1px_theme(colors.outline-variant)] transition-all peer-checked:bg-primary peer-checked:shadow-none">
                  <Icon
                    name="check"
                    className="text-[14px] text-on-primary opacity-0 transition-opacity peer-checked:opacity-100"
                  />
                </span>
              </span>
              <span className="text-sm text-on-surface-variant">Rester connecté</span>
            </label>

            <AnimatePresence>
              {status === "error" && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-md bg-error-container px-3 py-2 text-sm text-error"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={status === "loading"}
              whileHover={{ y: -2 }}
              whileTap={{ y: 0, scale: 0.98 }}
              className="group relative mt-2 flex h-12 w-full items-center justify-center gap-2
                         overflow-hidden rounded-md bg-gradient-to-r from-primary to-violet font-semibold text-on-primary
                         shadow-[0_4px_14px_rgba(94,114,228,0.35)] transition-shadow
                         hover:shadow-[0_6px_20px_rgba(94,114,228,0.45)]
                         disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === "loading" ? (
                <>
                  <Icon name="progress_activity" className="animate-spin text-[18px]" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <span>Se connecter</span>
                  <Icon name="arrow_forward" className="text-[18px]" />
                </>
              )}
            </motion.button>
          </form>

          <p className="mt-lg text-center text-xs text-on-surface-variant/70">
            Besoin d'aide ? Contactez l'administrateur de votre centre.
          </p>
        </motion.div>
      </div>
    </div>
  );
}