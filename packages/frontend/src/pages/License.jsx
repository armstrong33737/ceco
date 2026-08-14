import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

export default function License() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [operator, setOperator] = useState("MTN");
  const [months, setMonths] = useState(1);
  const [paymentStep, setPaymentStep] = useState("idle"); // idle | connecting | waiting_pin | success | error
  const [paymentError, setPaymentError] = useState("");

  const MONTHLY_PRICE = 25000; // 25 000 FCFA / mois

  async function loadLicense() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/license");
      setData(res);
    } catch (err) {
      setError(err.message || "Impossible de récupérer les informations de licence.");
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
      setPaymentError("Veuillez saisir un numéro camerounais valide à 9 chiffres (6XXXXXXXX).");
      return;
    }
    setPaymentError("");
    setPaymentStep("connecting");

    try {
      const result = await apiFetch("/license/pay", {
        method: "POST",
        body: JSON.stringify({ operator, phoneNumber, months }),
      });

      setPaymentStep("waiting_pin");

      // Simulation du délai d'attente de validation opérateur
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
      setPaymentError(err.message || "Échec de l'initialisation du rechargement.");
      setTimeout(() => setPaymentStep("idle"), 3500);
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

  if (loading) return <p className="text-sm text-on-surface-variant font-medium">Chargement des données de licence...</p>;

  const remainingDays = getRemainingDays();
  const isExpired = remainingDays <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-md max-w-5xl mx-auto"
    >
      {/* En-tête informatif */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-on-surface">Gestion de la Licence &amp; Validité</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-bold ${
              !isExpired ? "bg-success-light text-success border border-success/20" : "bg-error-container text-error border border-error/20"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-md ${!isExpired ? "bg-success" : "bg-error"}`} />
              {!isExpired ? "Licence Active" : "Licence Échue"}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Suivez la durée de validité de votre instance locale et rechargez vos mensualités par Mobile Money.
          </p>
        </div>

        <button
          onClick={loadLicense}
          className="flex items-center justify-center gap-1.5 rounded-md border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors shadow-xs flex-shrink-0"
        >
          <Icon name="refresh" className="text-[16px]" />
          <span>Actualiser</span>
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-error-container p-md text-sm text-error border border-error/20 flex items-center justify-between">
          <p className="text-xs font-semibold">{error}</p>
          <button onClick={loadLicense} className="text-xs font-bold underline">Réessayer</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        
        {/* Colonne Gauche : État de la licence et quotas (2 cols) */}
        <div className="space-y-md lg:col-span-2">
          
          {/* Carte principale de validité */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-md">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-light text-primary">
                  <Icon name="verified_user" className="text-[20px]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-on-surface">Plan d'Exploitation Local</h2>
                  <p className="text-xs text-on-surface-variant">Instance On-Premise autonome</p>
                </div>
              </div>
              <span className="rounded-md bg-surface px-2.5 py-1 text-xs font-mono font-bold text-on-surface border border-outline-variant/30">
                {data?.plan === "local" ? "Licence V1" : data?.plan}
              </span>
            </div>

            {/* Métriques de temps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <div className="p-md bg-surface rounded-md border border-outline-variant/20 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Temps restant</span>
                <div className={`text-2xl font-bold tracking-tight ${!isExpired ? "text-primary" : "text-error"}`}>
                  {remainingDays} Jours
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  {!isExpired ? "Période opérationnelle active" : "Rechargement obligatoire requis"}
                </p>
              </div>

              <div className="p-md bg-surface rounded-md border border-outline-variant/20 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Date d'échéance</span>
                <div className="text-base font-bold text-on-surface mt-1">
                  {data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Indéfinie"}
                </div>
                <p className="text-[11px] text-on-surface-variant">Heure d'expiration : 23:59:59</p>
              </div>
            </div>

            {/* Quotas utilisateurs et stockage */}
            <div className="pt-2 border-t border-outline-variant/15 grid grid-cols-1 sm:grid-cols-2 gap-md text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-md bg-surface border border-outline-variant/20">
                <span className="text-on-surface-variant font-medium">Utilisateurs enregistrés</span>
                <span className="font-bold text-on-surface">{data?.currentUserCount} / {data?.maxUsers || "Illimité"}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-md bg-surface border border-outline-variant/20">
                <span className="text-on-surface-variant font-medium">Stockage alloué</span>
                <span className="font-bold text-on-surface">{data?.maxStorage ? `${(Number(data.maxStorage) / 1e9).toFixed(1)} Go` : "Illimité (Disque)"}</span>
              </div>
            </div>
          </div>

          {/* Note d'information */}
          <div className="rounded-md bg-primary-light p-md border border-primary/20 flex gap-3">
            <Icon name="info" className="text-primary text-[20px] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-on-surface leading-relaxed">
              <strong>Offre d'initialisation :</strong> Tout nouvel établissement bénéficie automatiquement de <strong>2 mois d'évaluation gratuite (60 jours)</strong> enregistrés en base de données. En mode local, vos données restent hébergées sur votre machine et aucune limitation artificielle n'est appliquée.
            </div>
          </div>
        </div>

        {/* Colonne Droite : Module de rechargement Mobile Money (1 col) */}
        <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs flex flex-col justify-between space-y-md lg:col-span-1">
          <div>
            <div className="border-b border-outline-variant/20 pb-3 mb-md">
              <h2 className="text-sm font-bold text-on-surface">Recharger la Licence</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Tarif fixé à {formatCurrency(MONTHLY_PRICE)} / mois</p>
            </div>

            {paymentStep === "idle" && (
              <form onSubmit={handlePaymentSubmit} className="space-y-md">
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1.5">Opérateur</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOperator("MTN")}
                      className={`rounded-md py-2 text-xs font-bold border transition-all ${
                        operator === "MTN" ? "bg-amber-400 text-amber-950 border-amber-500 shadow-xs" : "bg-surface text-on-surface-variant border-outline-variant/30"
                      }`}
                    >
                      MTN MoMo
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperator("ORANGE")}
                      className={`rounded-md py-2 text-xs font-bold border transition-all ${
                        operator === "ORANGE" ? "bg-orange-500 text-white border-orange-600 shadow-xs" : "bg-surface text-on-surface-variant border-outline-variant/30"
                      }`}
                    >
                      Orange Money
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="licenseMonths" className="text-xs font-semibold text-on-surface-variant uppercase block mb-1.5">Nombre de mois</label>
                  <select
                    id="licenseMonths"
                    value={months}
                    onChange={(e) => setMonths(parseInt(e.target.value))}
                    className="w-full h-10 rounded-md bg-surface px-3 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary"
                  >
                    {[...Array(12).keys()].map((n) => (
                      <option key={n + 1} value={n + 1}>
                        {n + 1} Mois ({formatCurrency((n + 1) * MONTHLY_PRICE)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="licensePhone" className="text-xs font-semibold text-on-surface-variant uppercase block mb-1.5">Numéro de compte (+237)</label>
                  <input
                    id="licensePhone"
                    required
                    type="text"
                    placeholder="Ex: 677123456"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full h-10 rounded-md bg-surface px-3 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary"
                  />
                </div>

                {paymentError && (
                  <p className="rounded-md bg-error-container px-3 py-2 text-xs text-error font-semibold leading-tight">
                    {paymentError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full h-10 rounded-md bg-primary hover:bg-primary-dark font-bold text-on-primary text-xs shadow-xs transition-colors"
                >
                  Régler {formatCurrency(months * MONTHLY_PRICE)}
                </button>
              </form>
            )}

            {paymentStep !== "idle" && (
              <div className="flex flex-col items-center justify-center text-center py-6 space-y-3">
                {paymentStep === "connecting" && (
                  <>
                    <Icon name="cloud_sync" className="text-3xl text-primary animate-pulse" />
                    <h3 className="text-xs font-bold text-on-surface">Connexion à la passerelle</h3>
                    <p className="text-[11px] text-on-surface-variant">Liaison avec les services {operator} Money...</p>
                  </>
                )}

                {paymentStep === "waiting_pin" && (
                  <>
                    <Icon name="phonelink_ring" className="text-3xl text-primary animate-bounce" />
                    <h3 className="text-xs font-bold text-on-surface">Validation requise</h3>
                    <p className="text-[11px] text-on-surface-variant">Composez votre code PIN secret sur le téléphone {phoneNumber}.</p>
                  </>
                )}

                {paymentStep === "success" && (
                  <>
                    <div className="w-10 h-10 bg-success-light text-success rounded-md flex items-center justify-center border border-success/20">
                      <Icon name="check" className="text-[24px]" />
                    </div>
                    <h3 className="text-xs font-bold text-success">Paiement Validé</h3>
                    <p className="text-[11px] text-on-surface-variant">Votre licence a été prolongée de {months} mois avec succès.</p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-outline-variant/15 text-[10px] text-on-surface-variant text-center">
            Paiement sécurisé crypté direct par API.
          </div>
        </div>
      </div>
    </motion.div>
  );
}