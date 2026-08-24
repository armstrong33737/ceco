// packages/frontend/src/pages/License.jsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import useAuthStore from "../store/authStore";
import Icon from "../components/Icon";

export default function License() {
  const { updateSubscription } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Onglet de méthode d'activation (Hors-ligne vs En ligne)
  const [activeTab, setActiveTab] = useState("offline"); // "offline" | "online"

  // Formulaire Clé Hors-Ligne
  const [activationKey, setActivationKey] = useState("");
  const [activatingKey, setActivatingKey] = useState(false);
  const [copiedCenterId, setCopiedCenterId] = useState(false);

  // Formulaire Mobile Money En Ligne
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
      if (res.expiresAt) {
        updateSubscription({
          expiresAt: res.expiresAt,
          status: res.status === "ACTIVE" || res.status === "GRACE_PERIOD" ? "active" : "expired",
          plan: res.plan,
        });
      }
    } catch (err) {
      setError(err.message || "Impossible de récupérer les informations de licence.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLicense();
  }, []);

  function handleCopyCenterId() {
    if (data?.centerId) {
      navigator.clipboard.writeText(data.centerId);
      setCopiedCenterId(true);
      setTimeout(() => setCopiedCenterId(false), 2500);
    }
  }

  // Activation par clé hors-ligne signée
  async function handleActivateOffline(e) {
    e.preventDefault();
    if (!activationKey.trim()) return;

    setActivatingKey(true);
    setError(null);
    setSuccessMsg("");

    try {
      const res = await apiFetch("/license/activate-offline", {
        method: "POST",
        body: JSON.stringify({ activationKey: activationKey.trim() }),
      });

      setSuccessMsg(res.message);
      setActivationKey("");
      setData(res.evaluation);
      updateSubscription({
        expiresAt: res.evaluation.expiresAt,
        status: "active",
        plan: res.evaluation.plan,
      });
    } catch (err) {
      setError(err.message || "Échec de l'activation de la clé.");
    } finally {
      setActivatingKey(false);
    }
  }

  // Paiement Mobile Money en ligne
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

      setTimeout(() => {
        setData((prev) => ({
          ...prev,
          status: "ACTIVE",
          expiresAt: result.expiresAt,
          remainingDays: result.remainingDays,
          plan: result.plan,
        }));
        updateSubscription({
          expiresAt: result.expiresAt,
          status: "active",
          plan: result.plan,
        });
        setPaymentStep("success");
        setTimeout(() => {
          setPaymentStep("idle");
          setPhoneNumber("");
          setMonths(1);
          loadLicense();
        }, 3000);
      }, 4000);
    } catch (err) {
      setPaymentStep("error");
      setPaymentError(err.message || "Échec du rechargement.");
      setTimeout(() => setPaymentStep("idle"), 3500);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XAF" }).format(val);
  };

  if (loading && !data) return <p className="text-sm text-on-surface-variant font-medium">Chargement des données de licence...</p>;

  const status = data?.status || "ACTIVE";
  const isGrace = status === "GRACE_PERIOD";
  const isReadOnly = status === "READ_ONLY";
  const isTampered = status === "TAMPERED";
  const isFullyActive = status === "ACTIVE";

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
              isFullyActive
                ? "bg-success-light text-success border border-success/20"
                : isGrace
                ? "bg-amber-100 text-amber-950 border border-amber-300 animate-pulse"
                : isTampered
                ? "bg-error-container text-error border border-error/30"
                : "bg-error-container text-error border border-error/20"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isFullyActive ? "bg-success" : isGrace ? "bg-amber-600" : "bg-error"}`} />
              {isFullyActive
                ? "Licence Active"
                : isGrace
                ? `Période de Grâce (${data.graceDaysRemaining}j restants)`
                : isTampered
                ? "Horloge Manipulée"
                : "Mode Lecture Seule"}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Architecture cryptographique Ed25519 scellée. Rechargement par clé signée hors-ligne ou par Mobile Money.
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
          <button onClick={() => setError(null)} className="text-xs font-bold underline">Fermer</button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-md bg-success-light p-md text-sm text-success border border-success/20 flex items-center gap-2">
          <Icon name="check_circle" className="text-success text-[18px]" />
          <p className="text-xs font-semibold">{successMsg}</p>
        </div>
      )}

      {/* Bandeau d'avertissement de Grâce ou de Lecture Seule */}
      {isGrace && (
        <div className="p-md rounded-md bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3 shadow-xs">
          <Icon name="warning" className="text-[22px] text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="block text-sm font-bold">Période de Grâce Opérationnelle Active</strong>
            Votre licence a expiré le {data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString("fr-FR") : "récemment"}. Vous disposez encore de <strong>{data.graceDaysRemaining} jour(s) de grâce</strong> pour continuer à utiliser toutes les fonctionnalités sans interruption avant le passage en lecture seule.
          </div>
        </div>
      )}

      {isReadOnly && (
        <div className="p-md rounded-md bg-error-container border border-error/30 text-error flex items-start gap-3 shadow-xs">
          <Icon name="lock" className="text-[22px] text-error flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-on-surface">
            <strong className="block text-sm font-bold text-error">Mode Consultation / Lecture Seule Activé</strong>
            Votre délai de grâce est arrivé à échéance. Toutes vos données historiques restent intactes et accessibles pour consultation et impression, mais les nouvelles saisies de notes et inscriptions sont verrouillées jusqu'au rechargement.
          </div>
        </div>
      )}

      {isTampered && (
        <div className="p-md rounded-md bg-error-container border border-error/30 text-error flex items-start gap-3 shadow-xs">
          <Icon name="security_update_warning" className="text-[22px] text-error flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-on-surface">
            <strong className="block text-sm font-bold text-error">Alerte de Sécurité : Horloge Système Altérée</strong>
            {data?.reason || "L'heure de votre système a été reculée. Veuillez synchroniser l'heure exacte de votre ordinateur pour rétablir la session."}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Colonne Gauche : État Cryptographique & Identifiant Établissement (7 cols) */}
        <div className="lg:col-span-7 space-y-md">
          {/* Carte Principale de Validité */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-md">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-light text-primary">
                  <Icon name="verified_user" className="text-[20px]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-on-surface">Licence Locale Scellée</h2>
                  <p className="text-xs text-on-surface-variant">{data?.centerName || "Centre d'Excellence"}</p>
                </div>
              </div>
              <span className="rounded-md bg-surface px-2.5 py-1 text-xs font-mono font-bold text-primary border border-outline-variant/30">
                Plan : {data?.plan || "Local Pro"}
              </span>
            </div>

            {/* Métriques */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <div className="p-md bg-surface rounded-md border border-outline-variant/20 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Temps opérationnel restant</span>
                <div className={`text-2xl font-bold tracking-tight ${isFullyActive ? "text-primary" : isGrace ? "text-amber-600" : "text-error"}`}>
                  {data?.remainingDays || 0} Jour(s)
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  {isFullyActive ? "Fonctionnement régulier" : isGrace ? "En cours de grâce" : "Rechargement requis"}
                </p>
              </div>

              <div className="p-md bg-surface rounded-md border border-outline-variant/20 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Date d'échéance officielle</span>
                <div className="text-base font-bold text-on-surface mt-1 font-mono">
                  {data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Indéfinie"}
                </div>
                <p className="text-[11px] text-on-surface-variant">Signature : {data?.isVerified ? "✓ Validée Ed25519" : "Session Locale"}</p>
              </div>
            </div>

            {/* Identifiant unique de l'établissement */}
            <div className="p-3 bg-surface rounded-md border border-outline-variant/20 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-on-surface-variant tracking-wider block">
                    Identifiant Unique d'Établissement (Center ID)
                  </span>
                  <p className="text-[11px] text-on-surface-variant">Transmettez cet identifiant à l'éditeur pour générer votre clé hors-ligne.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCenterId}
                  className="px-2.5 py-1 rounded bg-white border border-outline-variant/40 text-xs font-bold text-primary hover:bg-primary-light transition-all flex items-center gap-1 shadow-2xs"
                >
                  <Icon name={copiedCenterId ? "check" : "content_copy"} className="text-[14px]" />
                  <span>{copiedCenterId ? "Copié !" : "Copier"}</span>
                </button>
              </div>
              <div className="p-2 bg-white rounded border border-outline-variant/30 font-mono font-bold text-xs text-primary truncate select-all">
                {data?.centerId || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Colonne Droite : Module d'Activation / Renouvellement (5 cols) */}
        <div className="lg:col-span-5 bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs flex flex-col justify-between space-y-md">
          <div className="space-y-3">
            <div className="border-b border-outline-variant/20 pb-3">
              <h2 className="text-sm font-bold text-on-surface">Activation &amp; Rechargement</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Choisissez le mode d'activation adapté à votre infrastructure.</p>
            </div>

            {/* Bascule d'onglets Hors-Ligne vs En Ligne */}
            <div className="flex p-0.5 bg-surface rounded-md border border-outline-variant/30">
              <button
                type="button"
                onClick={() => setActiveTab("offline")}
                className={`flex-1 py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "offline" ? "bg-primary text-white shadow-xs" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Icon name="key" className="text-[16px]" />
                <span>Clé Hors-Ligne</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("online")}
                className={`flex-1 py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "online" ? "bg-primary text-white shadow-xs" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Icon name="phone_android" className="text-[16px]" />
                <span>Mobile Money</span>
              </button>
            </div>

            {/* 1. ACTIVATION HORS-LIGNE PAR CLÉ CRYPTOGRAPHIQUE */}
            {activeTab === "offline" && (
              <form onSubmit={handleActivateOffline} className="space-y-3 text-xs pt-1">
                <p className="text-on-surface-variant leading-relaxed text-[11px]">
                  Collez ci-dessous le certificat de licence signé transmis par l'éditeur CECO :
                </p>
                <textarea
                  required
                  rows={4}
                  placeholder="Collez votre clé de licence signée (ex: CECO-eyJkYXRhI...)"
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value)}
                  className="w-full rounded-md bg-surface p-2.5 text-[11px] font-mono text-on-surface outline-none border border-outline-variant/40 focus:border-primary resize-none"
                />

                <button
                  type="submit"
                  disabled={activatingKey || !activationKey.trim()}
                  className="w-full h-10 rounded-md bg-primary hover:bg-primary-dark font-bold text-white text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Icon name="lock_open" className="text-[16px]" />
                  <span>{activatingKey ? "Vérification cryptographique..." : "Activer la Licence"}</span>
                </button>
              </form>
            )}

            {/* 2. RECHARGEMENT MOBILE MONEY EN LIGNE */}
            {activeTab === "online" && (
              <div className="space-y-3 text-xs pt-1">
                {paymentStep === "idle" && (
                  <form onSubmit={handlePaymentSubmit} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">Opérateur</label>
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
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">Durée</label>
                      <select
                        value={months}
                        onChange={(e) => setMonths(parseInt(e.target.value))}
                        className="w-full h-9 rounded-md bg-surface px-2.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary"
                      >
                        {[1, 3, 6, 12].map((n) => (
                          <option key={n} value={n}>
                            {n} Mois ({formatCurrency(n * MONTHLY_PRICE)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">N° Mobile Money (+237)</label>
                      <input
                        required
                        type="text"
                        placeholder="Ex: 677123456"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full h-9 rounded-md bg-surface px-2.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary font-mono"
                      />
                    </div>

                    {paymentError && (
                      <p className="p-2 bg-error-container text-error text-[11px] rounded font-semibold">{paymentError}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full h-10 rounded-md bg-primary hover:bg-primary-dark font-bold text-white text-xs shadow-xs transition-colors"
                    >
                      Payer {formatCurrency(months * MONTHLY_PRICE)}
                    </button>
                  </form>
                )}

                {paymentStep !== "idle" && (
                  <div className="flex flex-col items-center justify-center text-center py-4 space-y-2">
                    {paymentStep === "connecting" && (
                      <>
                        <Icon name="cloud_sync" className="text-3xl text-primary animate-pulse" />
                        <h4 className="font-bold text-xs">Liaison Passerelle</h4>
                        <p className="text-[10px] text-on-surface-variant">Connexion aux serveurs {operator}...</p>
                      </>
                    )}
                    {paymentStep === "waiting_pin" && (
                      <>
                        <Icon name="phonelink_ring" className="text-3xl text-amber-600 animate-bounce" />
                        <h4 className="font-bold text-xs text-amber-950">Validation Requise</h4>
                        <p className="text-[10px] text-on-surface-variant">Saisissez votre code PIN sur le {phoneNumber}.</p>
                      </>
                    )}
                    {paymentStep === "success" && (
                      <>
                        <Icon name="check_circle" className="text-3xl text-success" />
                        <h4 className="font-bold text-xs text-success">Paiement Validé</h4>
                        <p className="text-[10px] text-on-surface-variant">Licence rechargée et scellée avec succès.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-outline-variant/15 text-[10px] text-on-surface-variant text-center font-mono">
            Support technique &amp; délivrance de clés : contact@ceco.africa
          </div>
        </div>
      </div>
    </motion.div>
  );
}