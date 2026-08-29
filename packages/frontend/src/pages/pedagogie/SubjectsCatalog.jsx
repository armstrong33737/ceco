// packages/frontend/src/pages/pedagogie/SubjectsCatalog.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import Icon from "../../components/Icon";

function derive5CharCode(name, existingList = [], currentId = null) {
  if (!name || !name.trim()) return "";
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  let prefix = clean.substring(0, 3);
  if (prefix.length < 3) prefix = (prefix + "MAT").substring(0, 3);

  let num = 1;
  let code = `${prefix}${String(num).padStart(2, "0")}`;
  const otherSubjects = existingList.filter((s) => s.id !== currentId);

  while (otherSubjects.some((s) => s.code === code)) {
    num++;
    code = `${prefix}${String(num).padStart(2, "0")}`;
  }
  return code;
}

export default function SubjectsCatalog() {
  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: "", code: "" });
  const [isCodeManual, setIsCodeManual] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    apiFetch("/subjects")
      .then((data) => setSubjects(data || []))
      .catch((e) => showToast(e.message || "Erreur de chargement des matières.", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleNameChange(newName) {
    const updatedForm = { ...form, name: newName };
    if (!isCodeManual) {
      updatedForm.code = derive5CharCode(newName, subjects, modal?.item?.id);
    }
    setForm(updatedForm);
  }

  function handleCodeChange(newCode) {
    setIsCodeManual(true);
    setForm({ ...form, code: newCode.toUpperCase().slice(0, 5) });
  }

  const isCodeValid = /^[A-Z0-9]{5}$/.test(form.code.trim());

  const filteredSubjects = useMemo(() => {
    if (!search.trim()) return subjects;
    const q = search.toLowerCase();
    return subjects.filter((s) => s.name.toLowerCase().includes(q) || (s.code || "").toLowerCase().includes(q));
  }, [subjects, search]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isCodeValid) {
      showToast("Le code matière doit comporter exactement 5 caractères alphanumériques (ex: THM01, INF02).", "warning");
      return;
    }

    try {
      if (modal.mode === "edit") {
        await apiFetch(`/subjects/${modal.item.id}`, { method: "PUT", body: JSON.stringify(form) });
        showToast(`Matière ${form.name} mise à jour avec succès.`, "success");
      } else {
        await apiFetch("/subjects", { method: "POST", body: JSON.stringify(form) });
        showToast(`Nouvelle matière ${form.name} (${form.code}) créée avec succès.`, "success");
      }
      setModal(null);
      load();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'enregistrement.", "error");
    }
  }

  async function confirmDeleteSubject() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/subjects/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast(`Matière ${deleteTarget.name} supprimée du référentiel.`, "warning");
      load();
    } catch (err) {
      showToast(err.message || "Impossible de supprimer cette matière.", "error");
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barre d'outils et recherche */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-card">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Référentiel Universel des Matières</h3>
          <p className="text-xs text-slate-500">
            Disciplines de formation avec code officiel normalisé à 5 caractères pour les délibérations et PVs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher matière ou code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-56 pl-8"
            />
            <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]" />
          </div>

          <button
            onClick={() => {
              setForm({ name: "", code: "" });
              setIsCodeManual(false);
              setModal({ mode: "create" });
            }}
            className="btn-primary"
          >
            <Icon name="add" className="text-[16px]" />
            <span>Nouvelle Matière</span>
          </button>
        </div>
      </div>

      {/* Tableau des matières */}
      <div className="table-container">
        {loading ? (
          <p className="p-8 text-xs text-slate-500 text-center">Chargement du catalogue des matières...</p>
        ) : filteredSubjects.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 text-center">Aucune matière ne correspond à votre recherche.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell w-32">Code (5 Car.)</th>
                  <th className="table-header-cell">Intitulé de la Discipline</th>
                  <th className="table-header-cell text-center w-36">Cours Actifs</th>
                  <th className="table-header-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((sub) => (
                  <tr key={sub.id} className="table-body-row">
                    <td className="table-body-cell">
                      <span className="badge-blue font-mono font-bold">{sub.code || "—"}</span>
                    </td>
                    <td className="table-body-cell font-bold text-slate-900">{sub.name}</td>
                    <td className="table-body-cell text-center font-mono font-bold text-blue-700">
                      {sub._count?.offerings || 0} classe(s)
                    </td>
                    <td className="table-body-cell text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setForm({ name: sub.name, code: sub.code || "" });
                            setIsCodeManual(true);
                            setModal({ mode: "edit", item: sub });
                          }}
                          className="btn-secondary text-[11px] px-2 py-1"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => setDeleteTarget(sub)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Supprimer la matière"
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
          {/* MODALE CRÉATION / ÉDITION */}
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
                    {modal.mode === "edit" ? "Modifier la Matière" : "Nouvelle Matière"}
                  </h4>
                  <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Intitulé de la matière *</label>
                    <input
                      required
                      placeholder="Ex: Thermodynamique appliquée"
                      value={form.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-bold text-slate-700">Code Officiel (5 caractères majuscules) *</label>
                      <span className={`text-[10px] font-mono font-bold ${isCodeValid ? "text-emerald-700" : "text-rose-700"}`}>
                        {form.code.length}/5 {isCodeValid ? "✓ Valide" : "(Ex: THM01)"}
                      </span>
                    </div>
                    <input
                      required
                      maxLength={5}
                      placeholder="Ex: THM01"
                      value={form.code}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      className={`input-field w-full font-mono uppercase font-bold ${!isCodeValid && form.code ? "border-rose-500 focus:border-rose-500" : ""}`}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setModal(null)} className="btn-secondary">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!isCodeValid || !form.name.trim()}
                    className="btn-primary"
                  >
                    Enregistrer
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* MODALE SUPPRESSION */}
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
                  <h3 className="text-sm font-bold text-slate-900">Supprimer la matière</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Supprimer définitivement la matière <strong>{deleteTarget.name}</strong> ({deleteTarget.code || "Sans code"}) du référentiel ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
                    Annuler
                  </button>
                  <button onClick={confirmDeleteSubject} className="btn-primary bg-rose-600 hover:bg-rose-700">
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