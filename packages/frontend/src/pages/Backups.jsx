import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

const FREQUENCIES = [
  { value: "daily", label: "Quotidienne" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "monthly", label: "Mensuelle" },
];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function Backups() {
  const [backups, setBackups] = useState([]);
  const [frequency, setFrequency] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [list, config] = await Promise.all([
      apiFetch("/backups"),
      apiFetch("/backups/config"),
    ]);
    setBackups(list);
    setFrequency(config.frequency);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleFrequencyChange(value) {
    setFrequency(value);
    setSaving(true);
    try {
      await apiFetch("/backups/config", { method: "PUT", body: JSON.stringify({ frequency: value }) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="max-w-2xl">
      <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-sm font-semibold text-on-surface mb-md">Fréquence de sauvegarde souhaitée</h2>
        <div className="flex gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              onClick={() => handleFrequencyChange(f.value)}
              disabled={saving}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                frequency === f.value
                  ? "bg-primary text-on-primary"
                  : "bg-surface text-on-surface-variant hover:bg-surface-container shadow-[inset_0_0_0_1px_theme(colors.outline-variant)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-md rounded-md bg-primary-light p-md flex gap-3">
        <Icon name="info" className="text-primary text-[20px] flex-shrink-0" />
        <p className="text-sm text-on-surface">
          Cette préférence sera utilisée dès que le déclenchement automatique des sauvegardes
          (pg_dump planifié) sera activé. Pour l'instant, cet écran affiche l'historique des
          archives déjà présentes dans le dossier de sauvegarde du centre.
        </p>
      </div>

      <div className="mt-lg overflow-hidden rounded-md bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="px-lg pt-lg pb-md text-sm font-semibold text-on-surface">Archives disponibles</h2>
        {loading ? (
          <p className="px-lg pb-lg text-sm text-on-surface-variant">Chargement...</p>
        ) : backups.length === 0 ? (
          <p className="px-lg pb-lg text-sm text-on-surface-variant">Aucune sauvegarde pour l'instant.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-left text-xs uppercase tracking-wider text-on-surface-variant">
                <th className="px-lg py-3 font-semibold">Fichier</th>
                <th className="px-lg py-3 font-semibold">Taille</th>
                <th className="px-lg py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name} className="border-b border-outline-variant/10 last:border-0">
                  <td className="px-lg py-3 text-on-surface">{b.name}</td>
                  <td className="px-lg py-3 text-on-surface-variant">{formatSize(b.sizeBytes)}</td>
                  <td className="px-lg py-3 text-on-surface-variant">{new Date(b.createdAt).toLocaleString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>
  );
}