// packages/frontend/src/pages/pedagogie/GradingPolicies.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import Icon from "../../components/Icon";

export default function GradingPolicies() {
  const [policies, setPolicies] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState(false);
  const [selectedFiliereId, setSelectedFiliereId] = useState("");
  const [ccPercent, setCcPercent] = useState(30);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  function load() {
    Promise.all([apiFetch("/grading-policies"), apiFetch("/filieres")])
      .then(([pols, fils]) => {
        setPolicies(Array.isArray(pols) ? pols : []);
        setFilieres(Array.isArray(fils) ? fils : []);
      })
      .catch((e) => {
        setError(e.message);
        setPolicies([]);
        setFilieres([]);
      });
  }

  useEffect(() => { load(); }, []);

  const filteredPolicies = useMemo(() => {
    const list = Array.isArray(policies) ? policies : [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((p) => (p.filiere?.name || "Règle Globale").toLowerCase().includes(q));
  }, [policies, search]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const ccWeight = Number((ccPercent / 100).toFixed(2));
      const normalWeight = Number(((100 - ccPercent) / 100).toFixed(2));

      await apiFetch("/grading-policies", {
        method: "POST",
        body: JSON.stringify({
          filiereId: selectedFiliereId || null,
          ccWeight,
          normalWeight,
        }),
      });

      setSuccessMsg("Pondération enregistrée et appliquée avec succès.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setModal(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-md">
      {/* En-tête standardisé avec recherche */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Politiques de Pondération d'Évaluation</h3>
          <p className="text-xs text-on-surface-variant">Réglez la part du Contrôle Continu / TP et de l'Examen de Session Normale.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Rechercher règle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-2 rounded-md border border-outline-variant/40 outline-none w-56 bg-surface"
          />

          <button
            onClick={() => {
              setSelectedFiliereId("");
              setCcPercent(30);
              setModal(true);
            }}
            className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-white flex items-center gap-1 shadow-xs flex-shrink-0"
          >
            <Icon name="tune" className="text-[16px]" />
            <span>Nouvelle Pondération</span>
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-error-container text-error text-xs rounded-md font-semibold">{error}</div>}
      {successMsg && <div className="p-3 bg-success-light text-success text-xs rounded-md font-semibold">{successMsg}</div>}

      {/* Tableau des politiques actives */}
      <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b font-bold uppercase text-on-surface-variant bg-surface">
              <th className="px-md py-3">Portée de la Règle</th>
              <th className="px-md py-3 w-44 text-center">Part Contrôle Continu / TP</th>
              <th className="px-md py-3 w-44 text-center">Part Examen Session Normale</th>
              <th className="px-md py-3 w-36 text-center">Date d'Effet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15">
            {filteredPolicies.map((pol) => {
              const cc = typeof pol.ccWeight === "number" ? (pol.ccWeight * 100).toFixed(0) : "30";
              const norm = typeof pol.normalWeight === "number" ? (pol.normalWeight * 100).toFixed(0) : "70";
              const dateStr = pol.effectiveFrom ? new Date(pol.effectiveFrom).toLocaleDateString("fr-FR") : "—";

              return (
                <tr key={pol.id || Math.random()} className="hover:bg-surface-container/20">
                  <td className="px-md py-3">
                    {pol.filiere ? (
                      <div>
                        <span className="font-bold text-on-surface">{pol.filiere.name}</span>
                        <span className="text-[10px] text-primary font-mono ml-1.5">({pol.filiere.durationInYears} ans)</span>
                      </div>
                    ) : (
                      <span className="font-bold text-primary font-mono">● Règle Globale Établissement (Toutes filières)</span>
                    )}
                  </td>
                  <td className="px-md py-3 text-center font-mono font-bold text-primary">
                    {cc} %
                  </td>
                  <td className="px-md py-3 text-center font-mono font-bold text-on-surface">
                    {norm} %
                  </td>
                  <td className="px-md py-3 text-center font-mono text-on-surface-variant">
                    {dateStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* PORTAIL DE LA MODALE */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {modal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSave}
                className="w-full max-w-md bg-white p-md sm:p-lg rounded-md shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-bold text-sm text-on-surface">Définir une Règle de Pondération</h4>
                  <button type="button" onClick={() => setModal(false)} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold block mb-1">Portée de la règle</label>
                    <select
                      value={selectedFiliereId}
                      onChange={(e) => setSelectedFiliereId(e.target.value)}
                      className="h-10 rounded bg-surface border px-3 text-xs w-full outline-none focus:border-primary"
                    >
                      <option value="">Règle Globale (Toutes les filières)</option>
                      {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
                    </select>
                  </div>

                  <div className="p-4 bg-surface rounded-md border space-y-3">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-primary">Contrôle Continu : {ccPercent}%</span>
                      <span className="text-on-surface">Examen : {100 - ccPercent}%</span>
                    </div>

                    <input
                      type="range" min="10" max="60" step="5"
                      value={ccPercent} onChange={(e) => setCcPercent(parseInt(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />

                    <div className="flex justify-between text-[11px] text-on-surface-variant font-mono">
                      <span>10% / 90%</span>
                      <span className="font-bold">Standard 30% / 70%</span>
                      <span>Pratique 50% / 50%</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setModal(false)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" disabled={saving} className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">
                    {saving ? "Enregistrement..." : "Appliquer"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}