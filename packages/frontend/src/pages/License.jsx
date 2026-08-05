import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

export default function License() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [operator, setOperator] = useState("MTN");
  const [months, setMonths] = useState(1);
  const [paymentStep, setPaymentStep] = useState("idle"); // idle | connecting | waiting_pin | success | error
  const [paymentError, setPaymentError] = useState("");

  const MONTHLY_PRICE = 25000; // 25 000 FCFA

  async function loadLicense() {
    setLoading(true);
    try {
      const res = await apiFetch("/license");
      setData(res);
    } catch (err) {
      console.error("Erreur de récupération de la licence :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLicense();
  }, []);

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!phoneNumber.match(/^(65|67|68|69|62)\d{7}$/)) {
      setPaymentError("Veuillez saisir un numéro camerounais valide à 9 chiffres.");
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

      // Simulation de l'interrogation de la passerelle Orange/MTN
      setTimeout(() => {
        setData(result);
        setPaymentStep("success");
        setTimeout(() => {
          setPaymentStep("idle");
          setPhoneNumber("");
          setMonths(1);
        }, 3000);
      }, 4000);

    } catch (err) {
      setPaymentStep("error");
      setPaymentError(err.message || "Échec de l'activation.");
      setTimeout(() => setPaymentStep("idle"), 3000);
    }
  };

  const getRemainingDays = () => {
    if (!data?.expiresAt) return 0;
    const diff = new Date(data.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XAF" }).format(val);
  };

  if (loading) return <p className="text-sm text-on-surface-variant">Chargement...</p>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="grid grid-cols-1 lg:grid-cols-3 gap-md max-w-5xl">
      
      <div className="lg:col-span-2 flex flex-col gap-md">
        <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30">
          <div className="flex items-center justify-between border-b border-outline-variant/30 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-primary to-violet">
                <Icon name="verified_user" className="text-white text-[22px]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-on-surface">Plan {data?.plan === "local" ? "Local" : "SaaS"}</h2>
                <span className="text-xs text-on-surface-variant font-medium">Acquisition de licence</span>
              </div>
            </div>
            <div>
              <span className={`rounded-md px-3 py-1 text-xs font-semibold ${getRemainingDays() > 0 ? "bg-success-light text-success" : "bg-error-container text-error"}`}>
                {getRemainingDays() > 0 ? "Active" : "Expirée"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-surface rounded-md">
              <p className="text-xs text-on-surface-variant">Validité restante</p>
              <p className="text-2xl font-bold text-primary mt-1">{getRemainingDays()} Jours</p>
            </div>
            <div className="p-3 bg-surface rounded-md">
              <p className="text-xs text-on-surface-variant font-medium">Date d'expiration</p>
              <p className="text-sm font-semibold text-on-surface mt-2">
                {data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Indéfinie"}
              </p>
            </div>
          </div>

          <div className="mt-md border-t border-outline-variant/10 pt-4 grid grid-cols-2 gap-2 text-xs text-on-surface-variant">
            <div><span className="font-semibold text-on-surface">Utilisateurs créés :</span> {data?.currentUserCount} / {data?.maxUsers || "Illimité"}</div>
            <div><span className="font-semibold text-on-surface">Stockage alloué :</span> {data?.maxStorage ? `${(Number(data.maxStorage) / 1e9).toFixed(1)} Go` : "Illimité"}</div>
          </div>
        </div>

        <div className="rounded-md bg-primary-light p-md flex gap-3">
          <Icon name="info" className="text-primary text-[20px] flex-shrink-0" />
          <p className="text-xs text-on-surface leading-relaxed">
            <strong>2 mois d'essai offerts :</strong> Pour chaque création de centre de formation, l'ERP CECO initialise automatiquement une date de validité à <strong>+60 jours d'essai gratuit</strong> dans la base de données.
          </p>
        </div>
      </div>

      <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex flex-col justify-between">
        <div>
          <h2 className="text-base font-semibold text-on-surface mb-1">Recharger la licence</h2>
          <p className="text-xs text-on-surface-variant mb-md">Tarif d'utilisation : {formatCurrency(MONTHLY_PRICE)} / mois</p>

          {paymentStep === "idle" && (
            <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Opérateur</label>
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

              <div>
                <label htmlFor="durationMonths" className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Durée d'activation</label>
                <select
                  id="durationMonths"
                  value={months}
                  onChange={(e) => setMonths(parseInt(e.target.value))}
                  className="w-full h-10 rounded-md bg-surface px-3 text-xs shadow-[inset_0_0_0_1px_theme(colors.outline-variant)] outline-none"
                >
                  {[...Array(12).keys()].map((n) => (
                    <option key={n + 1} value={n + 1}>{n + 1} Mois ({formatCurrency((n + 1) * MONTHLY_PRICE)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="phoneNumber" className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Numéro Mobile Money</label>
                <input
                  id="phoneNumber"
                  required
                  type="text"
                  placeholder="Ex: 677123456"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full h-10 rounded-md bg-surface px-3 text-xs shadow-[inset_0_0_0_1px_theme(colors.outline-variant)] outline-none focus:shadow-[inset_0_0_0_2px_theme(colors.primary)]"
                />
              </div>

              {paymentError && <p className="text-xs text-error font-medium">{paymentError}</p>}

              <button
                type="submit"
                className="w-full h-10 rounded-md bg-gradient-to-r from-primary to-violet font-semibold text-on-primary text-xs mt-2 hover:opacity-95 shadow-md"
              >
                Payer {formatCurrency(months * MONTHLY_PRICE)}
              </button>
            </form>
          )}

          {paymentStep !== "idle" && (
            <div className="flex flex-col items-center justify-center text-center py-8">
              {paymentStep === "connecting" && (
                <div className="space-y-4">
                  <Icon name="cloud_sync" className="text-4xl text-primary animate-pulse" />
                  <h3 className="text-sm font-semibold text-on-surface">Appel de la passerelle</h3>
                  <p className="text-xs text-on-surface-variant">Liaison de votre application locale avec le réseau de l'opérateur...</p>
                </div>
              )}

              {paymentStep === "waiting_pin" && (
                <div className="space-y-4">
                  <Icon name="app_blocking" className="text-4xl text-warning animate-bounce" />
                  <h3 className="text-sm font-semibold text-on-surface">Validation mobile</h3>
                  <p className="text-xs text-on-surface-variant">Veuillez valider la demande de débit sur votre téléphone portable.</p>
                </div>
              )}

              {paymentStep === "success" && (
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-success-light rounded-full flex items-center justify-center mx-auto text-success">
                    <Icon name="check_circle" className="text-3xl" />
                  </div>
                  <h3 className="text-sm font-bold text-success">Paiement Validé !</h3>
                  <p className="text-xs text-on-surface-variant">La base de données PostgreSQL a été mise à jour en temps réel.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-outline-variant/10 pt-4 mt-4 text-[10px] text-on-surface-variant/70 text-center">
          Paiement sécurisé crypté.
        </div>
      </div>
    </motion.div>
  );
}