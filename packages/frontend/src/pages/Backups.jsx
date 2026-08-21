// packages/frontend/src/pages/Backups.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

const FREQUENCIES = [
  { value: "daily", label: "Quotidienne" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "monthly", label: "Mensuelle" },
];

function formatSize(bytes) {
  if (!bytes || isNaN(bytes)) return "0 o";
  const num = Number(bytes);
  if (num < 1024) return `${num} o`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} Ko`;
  return `${(num / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function Backups() {
  const [backups, setBackups] = useState([]);
  const [frequency, setFrequency] = useState("daily");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [restoreTarget, setRestoreTarget] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [list, config] = await Promise.all([
        apiFetch("/backups"),
        apiFetch("/backups/config"),
      ]);
      setBackups(Array.isArray(list) ? list : []);
      if (config?.frequency) setFrequency(config.frequency);
    } catch (err) {
      setError(err.message || "Impossible de récupérer les sauvegardes.");
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredBackups = useMemo(() => {
    const list = Array.isArray(backups) ? backups : [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((b) => (b.name || "").toLowerCase().includes(q));
  }, [backups, search]);

  async function handleFrequencyChange(value) {
    setFrequency(value);
    setSaving(true);
    try {
      await apiFetch("/backups/config", { method: "PUT", body: JSON.stringify({ frequency: value }) });
      setSuccessMessage("Fréquence automatique mise à jour.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message || "Erreur de mise à jour de la cadence.");
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
      setSuccessMessage(`Archive compressée "${result.file}" générée avec succès (PostgreSQL + médias).`);
      const updatedList = await apiFetch("/backups");
      setBackups(Array.isArray(updatedList) ? updatedList : []);
    } catch (err) {
      setError(err.message || "Erreur lors de la génération de la sauvegarde.");
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
        body: JSON.stringify({ filename }),
      });
      setSuccessMessage(`Restauration système effectuée avec succès depuis l'archive "${filename}".`);
      await load();
    } catch (err) {
      setError(err.message || "Erreur critique durant la restauration.");
    } finally {
      setRestoring(false);
    }
  }

  if (loading && backups.length === 0) {
    return <p className="text-sm text-on-surface-variant font-medium">Chargement des sauvegardes...</p>;
  }

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
            <h1 className="text-lg font-bold text-on-surface">Sauvegardes &amp; Restauration</h1>
            <span className="rounded-md bg-primary-light text-primary font-bold text-[11px] px-2 py-0.5 font-mono">
              {backups.length} archive(s)
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Générez des archives autonomes compressées (.zip) ou restaurez l'intégralité de la base de données locale.
          </p>
        </div>

        <button
          onClick={handleTriggerBackup}
          disabled={triggering || restoring}
          className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-xs font-bold text-on-primary hover:bg-primary-dark transition-all disabled:opacity-60 shadow-xs flex-shrink-0"
        >
          {triggering ? (
            <>
              <Icon name="progress_activity" className="animate-spin text-[16px]" />
              <span>Génération en cours...</span>
            </>
          ) : (
            <>
              <Icon name="cloud_download" className="text-[16px]" />
              <span>Créer une sauvegarde</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-error-container p-md text-sm text-error border border-error/20 flex items-center justify-between">
          <p className="text-xs font-semibold">{error}</p>
          <button onClick={load} className="text-xs font-bold underline">Réessayer</button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-md bg-success-light p-md text-sm text-success flex items-center gap-2 border border-success/20">
          <Icon name="check_circle" className="text-success text-[18px] flex-shrink-0" />
          <p className="text-xs font-semibold">{successMessage}</p>
        </div>
      )}

      {restoring && (
        <div className="rounded-md bg-amber-100 p-md text-sm text-amber-950 flex items-center gap-3 border border-amber-300 animate-pulse">
          <Icon name="progress_activity" className="animate-spin text-[20px] text-amber-700" />
          <div>
            <p className="font-bold text-xs">Restauration globale en cours...</p>
            <p className="text-[11px] mt-0.5">Purge de PostgreSQL et ré-injection des fichiers médias du centre.</p>
          </div>
        </div>
      )}

      {/* Configuration & Point d'information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        {/* Cadence */}
        <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 border-b border-outline-variant/20 pb-3 mb-md">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-light text-primary">
                <Icon name="schedule" className="text-[18px]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-on-surface">Fréquence Automatique</h2>
                <p className="text-xs text-on-surface-variant">Planification des sauvegardes périodiques</p>
              </div>
            </div>

            <div className="flex gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  onClick={() => handleFrequencyChange(f.value)}
                  disabled={saving || restoring}
                  className={`flex-1 rounded-md py-2 text-xs font-bold transition-all ${
                    frequency === f.value
                      ? "bg-primary text-on-primary shadow-xs"
                      : "bg-surface text-on-surface-variant hover:bg-surface-container border border-outline-variant/30"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/15 text-[10px] text-on-surface-variant">
            La cadence est enregistrée dans les paramètres du centre.
          </div>
        </div>

        {/* Format hybride */}
        <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 border-b border-outline-variant/20 pb-3 mb-md">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-light text-primary">
                <Icon name="folder_zip" className="text-[18px]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-on-surface">Format d'Archive Hybride</h2>
                <p className="text-xs text-on-surface-variant">Structure relationnelle et fichiers médias</p>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Chaque fichier produit est un conteneur autonome <code className="bg-surface px-1 py-0.5 rounded-md font-mono text-primary border border-outline-variant/30">.zip</code>. Il rassemble le dump complet PostgreSQL et les pièces jointes (logos, photos, actes) sous <code className="bg-surface px-1 py-0.5 rounded-md font-mono text-on-surface">/storage</code>.
            </p>
          </div>

          <div className="pt-2 border-t border-outline-variant/15 text-[10px] text-on-surface-variant">
            Compatible avec le moteur de restauration transactionnelle V3.
          </div>
        </div>
      </div>

      {/* Tableau des archives disponibles avec recherche rapide */}
      <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
        <div className="p-md border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-sm font-bold text-on-surface">Archives Disponibles (/backups)</h2>
          <input
            type="text"
            placeholder="Rechercher archive..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-md border border-outline-variant/40 outline-none w-56 bg-surface"
          />
        </div>

        {filteredBackups.length === 0 ? (
          <p className="p-lg text-xs text-on-surface-variant text-center">Aucune archive de sauvegarde trouvée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-outline-variant/30 font-bold uppercase tracking-wider text-on-surface-variant bg-surface">
                  <th className="px-md py-3">Nom de l'Archive</th>
                  <th className="px-md py-3">Taille</th>
                  <th className="px-md py-3">Date d'Archivage</th>
                  <th className="px-md py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {filteredBackups.map((b) => (
                  <tr key={b.name} className="hover:bg-surface-container/20 transition-colors">
                    <td className="px-md py-3 font-mono text-xs font-bold text-on-surface flex items-center gap-2">
                      <Icon name="archive" className="text-[16px] text-primary" />
                      <span>{b.name}</span>
                    </td>
                    <td className="px-md py-3 text-on-surface-variant font-medium font-mono text-xs">
                      {formatSize(b.sizeBytes)}
                    </td>
                    <td className="px-md py-3 text-on-surface-variant text-xs">
                      {b.createdAt ? new Date(b.createdAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="px-md py-3 text-right">
                      <button
                        onClick={() => setRestoreTarget(b)}
                        disabled={restoring}
                        className="rounded-md border border-primary/30 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary-light transition-all disabled:opacity-50"
                      >
                        Restaurer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALE DE CONFIRMATION DE RESTAURATION AVEC PORTAIL */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {restoreTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md rounded-md bg-white p-md sm:p-lg shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center gap-2 text-error border-b pb-2">
                  <Icon name="warning" className="text-[22px]" />
                  <h3 className="text-sm font-bold text-on-surface">Confirmer la Restauration Système</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Vous êtes sur le point de restaurer l'archive <strong>{restoreTarget.name}</strong>.
                  <br /><br />
                  <span className="text-error font-bold">Attention :</span> Cette opération va écraser la base PostgreSQL actuelle et réinjecter les fichiers médias du centre tels qu'ils étaient à la date de la sauvegarde.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={() => setRestoreTarget(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button onClick={handleRestore} className="px-3.5 py-1.5 bg-error text-white font-bold rounded text-xs shadow-xs">
                    Confirmer et Restaurer
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}