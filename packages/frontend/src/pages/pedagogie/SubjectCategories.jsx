// packages/frontend/src/pages/pedagogie/SubjectCategories.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import Icon from "../../components/Icon";

export default function SubjectCategories() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: "", code: "", order: 1, isEliminatory: false });
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    apiFetch("/categories")
      .then((data) => setCategories(data || []))
      .catch((e) => showToast(e.message || "Erreur de chargement des catégories.", "error"))
      .finally(() => setLoading(false));
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
        showToast(`Catégorie ${form.name} mise à jour.`, "success");
      } else {
        await apiFetch("/categories", { method: "POST", body: JSON.stringify(form) });
        showToast(`Catégorie ${form.name} créée avec succès.`, "success");
      }
      setModal(null);
      load();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'enregistrement.", "error");
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/categories/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast(`Catégorie ${deleteTarget.name} supprimée.`, "warning");
      load();
    } catch (err) {
      showToast(err.message || "Impossible de supprimer cette catégorie.", "error");
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barre d'outils et recherche */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-card">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Groupes &amp; Catégories d'Enseignement</h3>
          <p className="text-xs text-slate-500">
            Organisez vos matières en groupes pédagogiques (Spécialité, Général, Pratique) avec gestion des éliminatoires.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher groupe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-56 pl-8"
            />
            <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]" />
          </div>

          <button
            onClick={() => {
              setForm({ name: "", code: "", order: categories.length + 1, isEliminatory: false });
              setModal({ mode: "create" });
            }}
            className="btn-primary"
          >
            <Icon name="add" className="text-[16px]" />
            <span>Nouveau Groupe</span>
          </button>
        </div>
      </div>

      {/* Tableau des catégories */}
      <div className="table-container">
        {loading ? (
          <p className="p-8 text-xs text-slate-500 text-center">Chargement des catégories d'enseignement...</p>
        ) : filteredCategories.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 text-center">Aucune catégorie ne correspond à votre recherche.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell w-16 text-center">Ordre</th>
                  <th className="table-header-cell">Intitulé du Groupe</th>
                  <th className="table-header-cell w-28">Code Court</th>
                  <th className="table-header-cell w-36 text-center">Seuil Éliminatoire</th>
                  <th className="table-header-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="table-body-row">
                    <td className="table-body-cell text-center font-mono font-bold text-blue-700">{cat.order}</td>
                    <td className="table-body-cell font-bold text-slate-900">{cat.name}</td>
                    <td className="table-body-cell font-mono text-slate-600">{cat.code || "—"}</td>
                    <td className="table-body-cell text-center">
                      <span className={cat.isEliminatory ? "badge-rose font-bold" : "badge-slate"}>
                        {cat.isEliminatory ? "Oui (< 08/20)" : "Non"}
                      </span>
                    </td>
                    <td className="table-body-cell text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setForm({ name: cat.name, code: cat.code || "", order: cat.order, isEliminatory: cat.isEliminatory });
                            setModal({ mode: "edit", item: cat });
                          }}
                          className="btn-secondary text-[11px] px-2 py-1"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => setDeleteTarget(cat)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Supprimer la catégorie"
                        >
                          <Icon name="delete" className="text-[16px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PORTAIL DES MODALES */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {modal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSubmit}
                className="w-full max-w-md bg-white p-5 rounded-xl shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900">
                    {modal.mode === "edit" ? "Modifier le Groupe" : "Créer un Groupe d'Enseignement"}
                  </h4>
                  <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Intitulé du groupe *</label>
                    <input
                      required
                      placeholder="Ex: 1er Groupe (Matières Professionnelles)"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="input-field w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Code court (optionnel)</label>
                      <input
                        placeholder="Ex: PRO"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                        className="input-field w-full font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Ordre d'affichage</label>
                      <input
                        type="number"
                        min="1"
                        value={form.order}
                        onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 1 })}
                        className="input-field w-full font-mono"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold pt-1 cursor-pointer select-none text-slate-800">
                    <input
                      type="checkbox"
                      checked={form.isEliminatory}
                      onChange={(e) => setForm({ ...form, isEliminatory: e.target.checked })}
                      className="rounded accent-blue-700 h-4 w-4"
                    />
                    <span>Marquer comme groupe éliminatoire en délibération (&lt; 08/20)</span>
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setModal(null)} className="btn-secondary">Annuler</button>
                  <button type="submit" className="btn-primary">Enregistrer</button>
                </div>
              </motion.form>
            </div>
          )}

          {deleteTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center gap-2 text-rose-600 border-b border-slate-200 pb-2">
                  <Icon name="warning" className="text-[20px]" />
                  <h3 className="text-sm font-bold text-slate-900">Supprimer le groupe</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Supprimer définitivement le groupe <strong>{deleteTarget.name}</strong> ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Annuler</button>
                  <button onClick={confirmDeleteCategory} className="btn-primary bg-rose-600 hover:bg-rose-700">
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