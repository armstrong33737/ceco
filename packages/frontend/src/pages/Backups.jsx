import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [triggering, setTriggering] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  
  const [restoreTarget, setRestoreTarget] = useState(null); // Nom de fichier à restaurer

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [list, config] = await Promise.all([
        apiFetch("/backups"),
        apiFetch("/backups/config"),
      ]);
      setBackups(list);
      setFrequency(config.frequency);
    } catch (err) {
      setError(err.message || "Impossible de récupérer les sauvegardes du serveur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleFrequencyChange(value) {
    setFrequency(value);
    setSaving(true);
    try {
      await apiFetch("/backups/config", { method: "PUT", body: JSON.stringify({ frequency: value }) });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleTriggerBackup() {
    setTriggering(true);
    setSuccessMessage("");
    setError(null);
    try {
      const result = await apiFetch("/backups/trigger", { method: "POST" });
      setSuccessMessage(`Archive compressée "${result.file}" générée avec succès (Fichiers médias + PostgreSQL compilés).`);
      
      const updatedList = await apiFetch("/backups");
      setBackups(updatedList);
    } catch (err) {
      setError(err.message || "Erreur de génération de la sauvegarde.");
    } finally {
      setTriggering(false);
    }
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    setRestoring(true);
    setSuccessMessage("");
    setError(null);
    const filename = restoreTarget.name;
    setRestoreTarget(null);

    try {
      await apiFetch("/backups/restore", {
        method: "POST",
        body: JSON.stringify({ filename })
      });
      setSuccessMessage(`Restauration système complétée avec succès depuis l'archive "${filename}".`);
      await load();
    } catch (err) {
      setError(err.message || "Erreur critique durant la restauration du système.");
    } finally {
      setRestoring(false);
    }
  }

  if (loading) return <p className="text-sm text-on-surface-variant font-medium">Chargement des données de sauvegarde...</p>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="max-w-3xl flex flex-col gap-md">
      
      {error && (
        <div className="rounded-md bg-error-container p-md text-sm text-error">
          <p className="font-semibold">Erreur système</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="rounded-md bg-success-light p-md text-sm text-success flex items-start gap-2">
          <Icon name="check_circle" className="text-success text-[20px] flex-shrink-0" />
          <p className="text-xs font-semibold">{successMessage}</p>
        </div>
      )}

      {restoring && (
        <div className="rounded-md bg-warning-container p-md text-sm text-warning flex items-center gap-3 animate-pulse">
          <Icon name="progress_activity" className="animate-spin text-[20px]" />
          <div>
            <p className="font-bold">Restauration en cours...</p>
            <p className="text-xs mt-0.5">Écrasement des répertoires physiques et purge de la base de données PostgreSQL.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        
        {/* Configuration de la fréquence */}
        <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-on-surface mb-md">Fréquence de sauvegarde souhaitée</h2>
            <div className="flex gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  onClick={() => handleFrequencyChange(f.value)}
                  disabled={saving || restoring}
                  className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors ${
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
          <div className="mt-md pt-3 border-t border-outline-variant/10">
            <p className="text-[10px] text-on-surface-variant/70">
              La cadence sélectionnée est stockée de manière persistante dans la base de données locale.
            </p>
          </div>
        </div>

        {/* Déclenchement d'un point de sauvegarde compressé */}
        <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-on-surface mb-xs">Créer une archive d'intégrité</h2>
            <p className="text-xs text-on-surface-variant mb-md">Génère un fichier .zip contenant la base de données et le dossier de médias (/uploads).</p>
          </div>
          <button
            onClick={handleTriggerBackup}
            disabled={triggering || restoring}
            className="w-full h-11 rounded-md bg-gradient-to-r from-primary to-violet font-semibold text-on-primary text-xs shadow-md hover:opacity-95 flex items-center justify-center gap-1.5"
          >
            {triggering ? (
              <>
                <Icon name="progress_activity" className="animate-spin text-[18px]" />
                <span>Compression et écriture...</span>
              </>
            ) : (
              <>
                <Icon name="cloud_download" className="text-[18px]" />
                <span>Sauvegarder (.zip)</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="rounded-md bg-primary-light p-md flex gap-3">
        <Icon name="info" className="text-primary text-[20px] flex-shrink-0" />
        <p className="text-xs text-on-surface leading-normal">
          <strong>Sauvegarde complète :</strong> Chaque fichier généré ci-dessous est une archive <code className="bg-white/50 px-1 py-0.5 rounded text-[11px] font-mono">.zip</code> de production autonome. Elle comprend d'une part l'arborescence SQL structurée au format JSON, et d'autre part l'ensemble de vos photos d'apprenants et d'en-têtes légaux d'établissements.
        </p>
      </div>

      {/* Liste des sauvegardes réelles */}
      <div className="overflow-hidden rounded-md bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30">
        <h2 className="px-lg pt-lg pb-md text-sm font-semibold text-on-surface">Archives réelles détectées (/backups)</h2>
        {backups.length === 0 ? (
          <p className="px-lg pb-lg text-sm text-on-surface-variant">Aucune sauvegarde présente dans le répertoire.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-left text-xs uppercase tracking-wider text-on-surface-variant">
                <th className="px-lg py-3 font-semibold">Fichier</th>
                <th className="px-lg py-3 font-semibold">Taille</th>
                <th className="px-lg py-3 font-semibold">Date d'archivage</th>
                <th className="px-lg py-3"></th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name} className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container/20">
                  <td className="px-lg py-3 text-on-surface font-mono text-xs">{b.name}</td>
                  <td className="px-lg py-3 text-on-surface-variant font-medium">{formatSize(b.sizeBytes)}</td>
                  <td className="px-lg py-3 text-on-surface-variant">{new Date(b.createdAt).toLocaleString("fr-FR")}</td>
                  <td className="px-lg py-3 text-right">
                    <button
                      onClick={() => setRestoreTarget(b)}
                      disabled={restoring}
                      className="rounded-md border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary bg-white hover:bg-primary-light transition-all disabled:opacity-50"
                    >
                      Restaurer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modale de confirmation de Restauration */}
      <AnimatePresence>
        {restoreTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-md bg-white p-lg shadow-xl border border-outline-variant/40"
            >
              <div className="flex items-center gap-2 text-warning mb-2">
                <Icon name="warning" className="text-[24px]" />
                <h3 className="text-base font-bold text-on-surface">Restaurer le système ?</h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-md">
                Vous êtes sur le point de restaurer l'archive <strong>{restoreTarget.name}</strong>. 
                <br />
                <span className="text-error font-semibold">Cette opération va vider l'ensemble de votre base de données PostgreSQL locale et remplacer l'intégralité de vos images actuelles par celles de cette sauvegarde.</span> Cette action est définitive.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setRestoreTarget(null)}
                  className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRestore}
                  className="rounded-md bg-error px-4 py-2 text-xs font-bold text-white hover:opacity-95"
                >
                  Confirmer et Restaurer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}