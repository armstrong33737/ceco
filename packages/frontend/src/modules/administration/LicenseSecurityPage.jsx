// packages/frontend/src/modules/administration/LicenseSecurityPage.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import useAuthStore from "../../store/authStore";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel, DataModule } from "../../design-system/layout/Card";
import Button from "../../design-system/primitives/Button";
import Textarea from "../../design-system/primitives/Textarea";
import Badge from "../../design-system/primitives/Badge";

export default function LicenseSecurityPage() {
  const { updateSubscription } = useAuthStore();
  const [data, setData] = useState(null);
  const [activationKey, setActivationKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    loadLicense();
  }, []);

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

  const isGrace = data?.status === "GRACE_PERIOD";
  const isFullyActive = data?.status === "ACTIVE";

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Sécurité • Cryptographie Ed25519</Badge>}
        title="Licence Locale &amp; Souveraineté des Données"
        subtitle="Validité cryptographique hors-ligne, délai de grâce opérationnel et rechargement certifié"
        actions={
          <Button variant="secondary" icon="refresh" onClick={loadLicense}>
            Actualiser
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DataModule
          label="État de la Licence"
          value={isFullyActive ? "ACTIVE" : isGrace ? "GRÂCE" : "LECTURE SEULE"}
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
          subtext="Signature inviolable Ed25519"
          icon="calendar_month"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-6">
          <StructuredPanel
            title="Identifiant Unique d'Établissement (Center ID)"
            subtitle="Transmettez cette clé à l'autorité de certification CECO pour générer votre certificat"
            icon="fingerprint"
          >
            <div className="space-y-4">
              <div className="p-4 rounded bg-[#F5F7FA] border border-border flex items-center justify-between font-mono font-bold text-body-md text-brand-900 dark:bg-[#07111D] dark:border-border-dark dark:text-brand-500">
                <span className="truncate">{data?.centerId || "—"}</span>
                <Button variant="secondary" size="sm" icon={copied ? "check" : "content_copy"} onClick={handleCopyId}>
                  {copied ? "Copié" : "Copier"}
                </Button>
              </div>
              <p className="text-caption text-ink-muted leading-relaxed">
                Le Center ID constitue l'ancre mathématique de signature asymétrique. Tout certificat de licence émis est scellé pour cette machine physique et ne peut pas être dupliqué.
              </p>
            </div>
          </StructuredPanel>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <StructuredPanel
            title="Activation par Certificat Hors-Ligne (Ed25519)"
            subtitle="Collez la clé inviolable fournie par l'autorité de certification CECO"
            icon="key"
          >
            <form onSubmit={handleActivateOffline} className="space-y-4">
              <Textarea
                required
                label="Certificat de Licence Signé (Clé 24+ caractères)"
                placeholder="Collez ici votre clé : CECO-eyJkYXRhI..."
                rows={4}
                value={activationKey}
                onChange={(e) => setActivationKey(e.target.value)}
              />
              <Button type="submit" variant="primary" icon="lock_open" isLoading={activating} className="w-full">
                Activer la Licence Hors-Ligne
              </Button>
            </form>
          </StructuredPanel>
        </div>
      </div>
    </motion.div>
  );
}