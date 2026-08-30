// packages/frontend/src/modules/administration/LicenseSecurityPage.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import useAuthStore from "../../store/authStore";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel, DataModule } from "../../design-system/layout/Card";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Textarea from "../../design-system/primitives/Textarea";
import Select from "../../design-system/primitives/Select";
import Badge from "../../design-system/primitives/Badge";
import Icon from "../../components/Icon";

export default function LicenseSecurityPage() {
  const { updateSubscription } = useAuthStore();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("offline");
  const [activationKey, setActivationKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mobile Money
  const [phoneNumber, setPhoneNumber] = useState("");
  const [operator, setOperator] = useState("MTN");
  const [months, setMonths] = useState(1);
  const [paymentStep, setPaymentStep] = useState("idle");

  async function loadLicense() {
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
      showToast(err.message, "error");
    }
  }

  useEffect(() => { loadLicense(); }, []);

  function handleCopyId() {
    if (data?.centerId) {
      navigator.clipboard.writeText(data.centerId);
      setCopied(true);
      showToast("Center ID copié dans le presse-papier.", "info");
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function handleActivateOffline(e) {
    e.preventDefault();
    if (!activationKey.trim()) return;
    setActivating(true);
    try {
      const res = await apiFetch("/license/activate-offline", {
        method: "POST",
        body: JSON.stringify({ activationKey: activationKey.trim() }),
      });
      showToast(res.message, "success");
      setActivationKey("");
      setData(res.evaluation);
      updateSubscription({ expiresAt: res.evaluation.expiresAt, status: "active", plan: res.evaluation.plan });
    } catch (err) {
      showToast(err.message || "Clé de licence non reconnue.", "error");
    } finally {
      setActivating(false);
    }
  }

  async function handleMobileMoney(e) {
    e.preventDefault();
    if (!phoneNumber.match(/^(65|67|68|69|62)\d{7}$/)) {
      showToast("Numéro camerounais invalide (9 chiffres).", "warning");
      return;
    }
    setPaymentStep("connecting");
    try {
      const res = await apiFetch("/license/pay", { method: "POST", body: JSON.stringify({ operator, phoneNumber, months }) });
      setPaymentStep("waiting_pin");
      setTimeout(() => {
        setPaymentStep("success");
        showToast("Paiement Mobile Money validé et licence rechargée.", "success");
        setTimeout(() => {
          setPaymentStep("idle");
          loadLicense();
        }, 2500);
      }, 3500);
    } catch (err) {
      setPaymentStep("idle");
      showToast(err.message, "error");
    }
  }

  const isGrace = data?.status === "GRACE_PERIOD";
  const isReadOnly = data?.status === "READ_ONLY";
  const isFullyActive = data?.status === "ACTIVE";

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Sécurité • Cryptographie Ed25519</Badge>}
        title="Licence Locale &amp; Souveraineté des Données"
        subtitle="Validité cryptographique hors-ligne, délai de grâce opérationnel et rechargement"
        actions={
          <Button variant="secondary" icon="refresh" onClick={loadLicense}>
            Actualiser
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DataModule
          label="État de la Licence"
          value={isFullyActive ? "ACTIVE" : isGrace ? "GRÂCE" : "LECTURE"}
          subtext={`Plan : ${data?.plan || "Local Pro"}`}
          icon="verified_user"
          badge={<Badge variant={isFullyActive ? "success" : isGrace ? "warning" : "error"} withDot>{data?.status}</Badge>}
        />
        <DataModule
          label="Validité Opérationnelle"
          value={`${data?.remainingDays || 0} jours`}
          subtext="Avant bascule en lecture seule"
          icon="schedule"
        />
        <DataModule
          label="Échéance Officielle"
          value={data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString("fr-FR") : "—"}
          subtext="Signature certifiée Ed25519"
          icon="calendar_month"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gauche : Center ID (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <StructuredPanel title="Identifiant Unique d'Établissement (Center ID)" subtitle="Transmettez cette clé à l'éditeur pour recevoir votre certificat" icon="fingerprint">
            <div className="space-y-4">
              <div className="p-4 rounded bg-[#F5F7FA] border border-border flex items-center justify-between font-mono font-bold text-body-md text-brand-900 dark:bg-[#07111D] dark:border-border-dark dark:text-brand-500">
                <span className="truncate">{data?.centerId || "—"}</span>
                <Button variant="secondary" size="sm" icon={copied ? "check" : "content_copy"} onClick={handleCopyId}>
                  {copied ? "Copié" : "Copier"}
                </Button>
              </div>
              <p className="text-caption text-ink-muted leading-relaxed">
                Le Center ID constitue la racine de signature asymétrique. Toute licence générée est scellée mathématiquement pour ce centre physique.
              </p>
            </div>
          </StructuredPanel>
        </div>

        {/* Droite : Rechargement (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <StructuredPanel
            title="Activation &amp; Rechargement"
            subtitle="Choisissez votre méthode d'activation"
            icon="key"
            headerAction={
              <div className="flex p-0.5 bg-[#F5F7FA] rounded border border-border dark:bg-[#07111D] dark:border-border-dark">
                <button
                  type="button"
                  onClick={() => setActiveTab("offline")}
                  className={`px-3 py-1 text-caption font-semibold rounded-[2px] ${activeTab === "offline" ? "bg-brand-900 text-white dark:bg-brand-500" : "text-ink-secondary"}`}
                >
                  Clé Hors-Ligne
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("online")}
                  className={`px-3 py-1 text-caption font-semibold rounded-[2px] ${activeTab === "online" ? "bg-brand-900 text-white dark:bg-brand-500" : "text-ink-secondary"}`}
                >
                  Mobile Money
                </button>
              </div>
            }
          >
            {activeTab === "offline" ? (
              <form onSubmit={handleActivateOffline} className="space-y-4">
                <Textarea
                  required
                  label="Certificat de Licence Signé (Clé 24+ car.)"
                  placeholder="Collez ici votre clé : CECO-eyJkYXRhI..."
                  rows={3}
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value)}
                />
                <Button type="submit" variant="primary" icon="lock_open" isLoading={activating} className="w-full">
                  Activer la Licence
                </Button>
              </form>
            ) : (
              <form onSubmit={handleMobileMoney} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button variant={operator === "MTN" ? "primary" : "secondary"} onClick={() => setOperator("MTN")}>MTN MoMo</Button>
                  <Button variant={operator === "ORANGE" ? "primary" : "secondary"} onClick={() => setOperator("ORANGE")}>Orange Money</Button>
                </div>
                <Select label="Durée" value={months} onChange={(e) => setMonths(parseInt(e.target.value, 10))}>
                  <option value={1}>1 Mois (25 000 FCFA)</option>
                  <option value={3}>3 Mois (75 000 FCFA)</option>
                  <option value={6}>6 Mois (150 000 FCFA)</option>
                  <option value={12}>12 Mois (300 000 FCFA)</option>
                </Select>
                <Input required label="Numéro Mobile Money (+237)" placeholder="6XXXXXXXX" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                <Button type="submit" variant="primary" isLoading={paymentStep !== "idle"} className="w-full">
                  Payer via {operator}
                </Button>
              </form>
            )}
          </StructuredPanel>
        </div>
      </div>
    </motion.div>
  );
}