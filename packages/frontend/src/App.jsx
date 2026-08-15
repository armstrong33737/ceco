import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "./store/authStore";
import { apiFetch } from "./lib/apiClient";
import Icon from "./components/Icon";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import SettingsLayout from "./components/SettingsLayout";
import Dashboard from "./pages/Dashboard";
import Formations from "./pages/Formations";
import Students from "./pages/Students";
import CenterSettings from "./pages/CenterSettings";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import DocumentTemplatesSettings from "./pages/DocumentTemplatesSettings"; // Import obligatoire
import License from "./pages/License";
import Backups from "./pages/Backups";
import About from "./pages/About";

function LicenseLockout() {
  const { user, updateSubscription, logout } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [operator, setOperator] = useState("MTN");
  const [months, setMonths] = useState(1);
  const [paymentStep, setPaymentStep] = useState("idle");
  const [paymentError, setPaymentError] = useState("");

  const MONTHLY_PRICE = 25000;

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!phoneNumber.match(/^(65|67|68|69|62)\d{7}$/)) {
      setPaymentError("Veuillez saisir un numéro camerounais valide à 9 chiffres (6xxxxxxxx).");
      return;
    }
    setPaymentError("");
    setPaymentStep("connecting");

    try {
      const result = await apiFetch("/license/pay", {
        method: "POST",
        body: JSON.stringify({ operator, phoneNumber, months })
      });

      setPaymentStep("waiting_pin");

      setTimeout(() => {
        updateSubscription(result);
        setPaymentStep("success");
      }, 4000);

    } catch (err) {
      setPaymentStep("error");
      setPaymentError(err.message || "Échec du traitement du paiement.");
      setTimeout(() => setPaymentStep("idle"), 3000);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XAF" }).format(val);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-md">
      <div className="w-full max-w-lg bg-white rounded-md p-lg shadow-xl border border-outline-variant/40 flex flex-col justify-between">
        <div className="text-center mb-md">
          <div className="w-16 h-16 bg-error-container text-error rounded-md flex items-center justify-center mx-auto mb-3">
            <Icon name="lock" className="text-3xl" />
          </div>
          <h1 className="text-xl font-bold text-on-surface">Application CECO Verrouillée</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            La licence de l'établissement <strong>{user?.center?.name}</strong> est arrivée à expiration.
          </p>
        </div>

        {paymentStep === "idle" && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Mode de règlement</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOperator("MTN")}
                  className={`rounded-md py-2 text-xs font-bold border transition-all ${operator === "MTN" ? "bg-amber-400 text-amber-950 border-amber-500" : "bg-white text-on-surface-variant border-outline-variant"}`}
                >
                  MTN MoMo
                </button>
                <button
                  type="button"
                  onClick={() => setOperator("ORANGE")}
                  className={`rounded-md py-2 text-xs font-bold border transition-all ${operator === "ORANGE" ? "bg-orange-500 text-white border-orange-600" : "bg-white text-on-surface-variant border-outline-variant"}`}
                >
                  Orange Money
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="lockoutMonths" className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Durée d'activation</label>
                <select
                  id="lockoutMonths"
                  value={months}
                  onChange={(e) => setMonths(parseInt(e.target.value))}
                  className="w-full h-11 rounded-md bg-surface px-3 text-xs shadow-[inset_0_0_0_1px_theme(colors.outline-variant)] outline-none"
                >
                  {[...Array(12).keys()].map((n) => (
                    <option key={n + 1} value={n + 1}>{n + 1} Mois ({formatCurrency((n + 1) * MONTHLY_PRICE)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="lockoutPhone" className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">N° Mobile Money</label>
                <input
                  id="lockoutPhone"
                  required
                  type="text"
                  placeholder="Ex: 677123456"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full h-11 rounded-md bg-surface px-3 text-xs shadow-[inset_0_0_0_1px_theme(colors.outline-variant)] outline-none focus:shadow-[inset_0_0_0_2px_theme(colors.primary)]"
                />
              </div>
            </div>

            {paymentError && <p className="text-xs text-error font-semibold text-center">{paymentError}</p>}

            <button
              type="submit"
              className="w-full h-11 rounded-md bg-primary font-semibold text-on-primary text-sm shadow-md hover:bg-primary-dark transition-colors"
            >
              Recharger pour {formatCurrency(months * MONTHLY_PRICE)}
            </button>
          </form>
        )}

        {paymentStep !== "idle" && (
          <div className="flex flex-col items-center justify-center text-center py-6">
            {paymentStep === "connecting" && (
              <div className="space-y-4">
                <Icon name="cloud_sync" className="text-4xl text-primary animate-pulse" />
                <h3 className="text-sm font-semibold text-on-surface">Liaison Passerelle</h3>
                <p className="text-xs text-on-surface-variant">Vérification de la connectivité réseau du centre...</p>
              </div>
            )}

            {paymentStep === "waiting_pin" && (
              <div className="space-y-4">
                <Icon name="app_blocking" className="text-4xl text-warning animate-bounce" />
                <h3 className="text-sm font-semibold text-on-surface">Validation Mobile Money</h3>
                <p className="text-xs text-on-surface-variant">Saisissez votre code PIN secret sur le téléphone {phoneNumber} pour valider le prélèvement.</p>
              </div>
            )}

            {paymentStep === "success" && (
              <div className="space-y-4">
                <div className="w-12 h-12 bg-success-light rounded-full flex items-center justify-center mx-auto text-success">
                  <Icon name="check_circle" className="text-3xl" />
                </div>
                <h3 className="text-sm font-bold text-success">Déverrouillage Système</h3>
                <p className="text-xs text-on-surface-variant">Abonnement renouvelé. L'application est maintenant disponible.</p>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-outline-variant/10 pt-4 mt-6 flex justify-between items-center text-xs">
          <button onClick={logout} className="text-on-surface-variant hover:text-error font-semibold flex items-center gap-1">
            <Icon name="logout" className="text-base" /> Déconnexion
          </button>
          <span className="text-[10px] text-on-surface-variant/70">CECO Suite v1.0.0</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { token, status, user, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="text-sm text-on-surface-variant font-medium"
        >
          Connexion à votre espace de travail...
        </motion.div>
      </div>
    );
  }

  const isAuthenticated = token && status === "authenticated";

  const isLicenseExpired = user?.center?.subscription?.expiresAt
    ? new Date(user.center.subscription.expiresAt).getTime() < Date.now()
    : false;

  return (
    <HashRouter>
      <Routes>
        {!isAuthenticated ? (
          <Route path="*" element={<Login />} />
        ) : isLicenseExpired ? (
          <Route path="*" element={<LicenseLockout />} />
        ) : (
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="formations" element={<Formations />} />
            <Route path="etudiants" element={<Students />} />
            <Route path="parametres" element={<SettingsLayout />}>
              <Route index element={<Navigate to="centre" replace />} />
              <Route path="centre" element={<CenterSettings />} />
              <Route path="utilisateurs" element={<Users />} />
              <Route path="roles" element={<Roles />} />
              <Route path="modeles" element={<DocumentTemplatesSettings />} />
              <Route path="licence" element={<License />} />
              <Route path="sauvegarde" element={<Backups />} />
              <Route path="apropos" element={<About />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </HashRouter>
  );
}