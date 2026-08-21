// packages/frontend/src/pages/pedagogie/SubjectCategories.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import Icon from "../../components/Icon";

const inputCls = "h-10 rounded bg-surface px-3 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary w-full";

export default function SubjectCategories() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: "", code: "", order: 1, isEliminatory: false });
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  function load() {
    apiFetch("/categories").then(setCategories).catch((e) => setError(e.message));
  }

  useEffect(() => { load(); }, []);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q));
  }, [categories, search]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (modal.mode === "edit") {
        await apiFetch(`/categories/${modal.item.id}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiFetch("/categories", { method: "POST", body: JSON.stringify(form) });
      }
      setModal(null);
      setSuccessMsg("Catégorie enregistrée avec succès.");
      setTimeout(() => setSuccessMsg(""), 3000);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/categories/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSuccessMsg("Catégorie supprimée.");
      setTimeout(() => setSuccessMsg(""), 3000);
      load();
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-md">
      {/* En-tête standardisé avec recherche rapide */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Catégories &amp; Groupes d'Enseignement</h3>
          <p className="text-xs text-on-surface-variant">Personnalisez les groupes de matières selon le vocabulaire propre à votre centre.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Rechercher catégorie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-2 rounded-md border border-outline-variant/40 outline-none w-56 bg-surface"
          />

          <button
            onClick={() => {
              setForm({ name: "", code: "", order: categories.length + 1, isEliminatory: false });
              setModal({ mode: "create" });
            }}
            className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-white flex items-center gap-1 shadow-xs flex-shrink-0"
          >
            <Icon name="add" className="text-[16px]" />
            <span>Nouvelle Catégorie</span>
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-error-container text-error text-xs rounded-md font-semibold">{error}</div>}
      {successMsg && <div className="p-3 bg-success-light text-success text-xs rounded-md font-semibold">{successMsg}</div>}

      <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
        {filteredCategories.length === 0 ? (
          <p className="p-6 text-xs text-on-surface-variant text-center">Aucune catégorie ne correspond à votre recherche.</p>
        ) : (
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b font-bold uppercase text-on-surface-variant bg-surface">
                <th className="px-md py-3 w-16 text-center">Ordre</th>
                <th className="px-md py-3">Intitulé du Groupe</th>
                <th className="px-md py-3 w-28">Code Court</th>
                <th className="px-md py-3 w-32 text-center">Éliminatoire</th>
                <th className="px-md py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15">
              {filteredCategories.map((cat) => (
                <tr key={cat.id} className="hover:bg-surface-container/20">
                  <td className="px-md py-3 text-center font-mono font-bold text-primary">{cat.order}</td>
                  <td className="px-md py-3 font-bold text-on-surface">{cat.name}</td>
                  <td className="px-md py-3 font-mono">{cat.code || "—"}</td>
                  <td className="px-md py-3 text-center">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${cat.isEliminatory ? "bg-error-container text-error font-mono" : "bg-surface border"}`}>
                      {cat.isEliminatory ? "Oui (< 08/20)" : "Non"}
                    </span>
                  </td>
                  <td className="px-md py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setForm({ name: cat.name, code: cat.code || "", order: cat.order, isEliminatory: cat.isEliminatory });
                          setModal({ mode: "edit", item: cat });
                        }}
                        className="px-2.5 py-1 border rounded text-xs hover:bg-surface-container font-semibold"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        className="p-1 text-error hover:bg-error-container/20 rounded"
                      >
                        <Icon name="delete" className="text-[16px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PORTAIL DES MODALES */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {modal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSubmit}
                className="w-full max-w-md bg-white p-md sm:p-lg rounded-md shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-bold text-sm text-on-surface">{modal.mode === "edit" ? "Modifier la Catégorie" : "Créer une Catégorie"}</h4>
                  <button type="button" onClick={() => setModal(null)} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Intitulé du groupe *</label>
                    <input required placeholder="Ex: Matières Scientifiques" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold block mb-1">Code court (optionnel)</label>
                      <input placeholder="Ex: SCI" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Ordre d'affichage</label>
                      <input type="number" min="1" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold pt-1 cursor-pointer">
                    <input type="checkbox" checked={form.isEliminatory} onChange={(e) => setForm({ ...form, isEliminatory: e.target.checked })} className="rounded accent-primary" />
                    <span>Marquer comme groupe éliminatoire en délibération</span>
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setModal(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">Enregistrer</button>
                </div>
              </motion.form>
            </div>
          )}

          {deleteTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-md bg-white p-md sm:p-lg shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center gap-2 text-error border-b pb-2">
                  <Icon name="warning" className="text-[20px]" />
                  <h3 className="text-sm font-bold text-on-surface">Supprimer la catégorie</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Supprimer définitivement la catégorie <strong>{deleteTarget.name}</strong> ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button onClick={confirmDeleteCategory} className="px-3.5 py-1.5 bg-error text-white font-bold rounded text-xs shadow-xs">
                    Confirmer la suppression
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}