import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-outline-variant/20 last:border-0">
      <span className="text-sm text-on-surface-variant">{label}</span>
      <span className="text-sm font-medium text-on-surface">{value}</span>
    </div>
  );
}

export default function License() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/license")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-on-surface-variant">Chargement...</p>;
  if (!data) return <p className="text-sm text-on-surface-variant">Aucune information de licence disponible.</p>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="max-w-2xl">
      <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-primary to-violet">
            <Icon name="verified" className="text-white text-[22px]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-on-surface">Plan {data.plan === "local" ? "Local" : data.plan}</h2>
            <span className={`inline-block mt-0.5 rounded-md px-2 py-0.5 text-xs font-medium ${data.status === "active" ? "bg-success-light text-success" : "bg-error-container text-error"}`}>
              {data.status === "active" ? "Actif" : data.status}
            </span>
          </div>
        </div>

        <div className="mt-lg">
          <InfoRow label="Utilisateurs" value={`${data.currentUserCount} ${data.maxUsers ? `/ ${data.maxUsers}` : "(illimité)"}`} />
          <InfoRow label="Stockage maximum" value={data.maxStorage ? `${(data.maxStorage / 1e9).toFixed(1)} Go` : "Illimité"} />
          <InfoRow label="Expiration" value={data.expiresAt ? new Date(data.expiresAt).toLocaleDateString("fr-FR") : "Aucune (mode local)"} />
        </div>
      </div>

      <div className="mt-md rounded-md bg-primary-light p-md flex gap-3">
        <Icon name="info" className="text-primary text-[20px] flex-shrink-0" />
        <p className="text-sm text-on-surface">
          En mode local, CECO fonctionne sans limite d'utilisateurs ni de stockage. La gestion de
          licences signées et d'abonnements payants sera disponible avec la version Cloud (CECO SaaS).
        </p>
      </div>
    </motion.div>
  );
}