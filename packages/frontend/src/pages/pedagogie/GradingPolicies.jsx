// packages/frontend/src/pages/pedagogie/GradingPolicies.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import Icon from "../../components/Icon";

export default function GradingPolicies() {
  const [policies, setPolicies] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState(false);
  const [selectedFiliereId, setSelectedFiliereId] = useState("");
  const [ccPercent, setCcPercent] = useState(30);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([apiFetch("/grading-policies"), apiFetch("/filieres")])
      .then(([pols, fils]) => {
        setPolicies(Array.isArray(pols) ? pols : []);
        setFilieres(Array.isArray(fils) ? fils : []);
      })
      .catch((e) => {
        showToast(e.message || "Erreur de chargement des règles de pondération.", "error");
        setPolicies([]);
        setFilieres([]);
      })
      .finally(() => setLoading(false));
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

      showToast(`Pondération (${ccPercent}% CC + ${100 - ccPercent}% Examen) enregistrée.`, "success");
      setModal(false);
      load();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'enregistrement.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barre d'outils et recherche */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-card">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Politiques de Pondération des Évaluations</h3>
          <p className="text-xs text-slate-500">
            Réglez la part du Contrôle Continu / TP et de l'Examen de Session Normale dans le calcul des moyennes finales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher règle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-56 pl-8"
            />
            <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]" />
          </div>

          <button
            onClick={() => {
              setSelectedFiliereId("");
              setCcPercent(30);
              setModal(true);
            }}
            className="btn-primary"
          >
            <Icon name="tune" className="text-[16px]" />
            <span>Nouvelle Règle</span>
          </button>
        </div>
      </div>

      {/* Tableau des règles de pondération */}
      <div className="table-container">
        {loading ? (
          <p className="p-8 text-xs text-slate-500 text-center">Chargement des politiques de pondération...</p>
        ) : filteredPolicies.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 text-center">Aucune règle de pondération trouvée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell">Portée de la Règle</th>
                  <th className="table-header-cell w-48 text-center">Part Contrôle Continu (CC/TP)</th>
                  <th className="table-header-cell w-48 text-center">Part Examen Session Normale</th>
                  <th className="table-header-cell w-40 text-center">Date d'Effet</th>
                </tr>
              </thead>
              <tbody>
                {filteredPolicies.map((pol) => {
                  const cc = typeof pol.ccWeight === "number" ? (pol.ccWeight * 100).toFixed(0) : "30";
                  const norm = typeof pol.normalWeight === "number" ? (pol.normalWeight * 100).toFixed(0) : "70";
                  const dateStr = pol.effectiveFrom ? new Date(pol.effectiveFrom).toLocaleDateString("fr-FR") : "—";

                  return (
                    <tr key={pol.id || Math.random()} className="table-body-row">
                      <td className="table-body-cell">
                        {pol.filiere ? (
                          <div>
                            <span className="font-bold text-slate-900">{pol.filiere.name}</span>
                            <span className="text-[10px] text-blue-700 font-mono font-bold ml-1.5">({pol.filiere.durationInYears} ans)</span>
                          </div>
                        ) : (
                          <span className="font-bold text-blue-700 font-mono">● Règle Globale Établissement (Toutes filières)</span>
                        )}
                      </td>
                      <td className="table-body-cell text-center font-mono font-bold text-blue-700">
                        {cc} %
                      </td>
                      <td className="table-body-cell text-center font-mono font-bold text-slate-900">
                        {norm} %
                      </td>
                      <td className="table-body-cell text-center font-mono text-slate-600">
                        {dateStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PORTAIL DE LA MODALE */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {modal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSave}
                className="w-full max-w-md bg-white p-5 rounded-xl shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900">Définir une Règle de Pondération</h4>
                  <button type="button" onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-700"><Icon name="close" className="text-[18px]" /></button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Portée de la règle</label>
                    <select
                      value={selectedFiliereId}
                      onChange={(e) => setSelectedFiliereId(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="">Règle Globale (Toutes les filières)</option>
                      {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
                    </select>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-blue-700">Contrôle Continu : {ccPercent}%</span>
                      <span className="text-slate-900">Examen : {100 - ccPercent}%</span>
                    </div>

                    <input
                      type="range" min="10" max="60" step="5"
                      value={ccPercent} onChange={(e) => setCcPercent(parseInt(e.target.value, 10))}
                      className="w-full accent-blue-700 cursor-pointer"
                    />

                    <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                      <span>10% / 90%</span>
                      <span className="font-bold text-slate-700">Standard 30% / 70%</span>
                      <span>Pratique 50% / 50%</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? "Enregistrement..." : "Appliquer la Règle"}
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