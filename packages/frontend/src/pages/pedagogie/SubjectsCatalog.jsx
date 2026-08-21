// packages/frontend/src/pages/pedagogie/SubjectsCatalog.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import Icon from "../../components/Icon";

const inputCls = "h-10 rounded-md bg-surface px-3 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary w-full";

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
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  function load() {
    apiFetch("/subjects").then(setSubjects).catch((e) => setError(e.message));
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
      setError("Le code matière doit comporter exactement 5 caractères alphanumériques majuscules (ex: THM01, INF02).");
      return;
    }

    try {
      if (modal.mode === "edit") {
        await apiFetch(`/subjects/${modal.item.id}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiFetch("/subjects", { method: "POST", body: JSON.stringify(form) });
      }
      setModal(null);
      setSuccessMsg("Matière enregistrée avec succès.");
      setTimeout(() => setSuccessMsg(""), 3000);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDeleteSubject() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/subjects/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSuccessMsg("Matière supprimée du référentiel.");
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
          <h3 className="text-sm font-bold text-on-surface">Référentiel Universel des Matières</h3>
          <p className="text-xs text-on-surface-variant">
            Disciplines de formation avec code normalisé à 5 caractères pour les délibérations et PVs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Rechercher matière ou code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-2 rounded-md border border-outline-variant/40 outline-none w-56 bg-surface"
          />

          <button
            onClick={() => {
              setForm({ name: "", code: "" });
              setIsCodeManual(false);
              setModal({ mode: "create" });
            }}
            className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-white flex items-center gap-1 shadow-xs flex-shrink-0"
          >
            <Icon name="add" className="text-[16px]" />
            <span>Nouvelle Matière</span>
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-error-container text-error text-xs rounded-md font-semibold">{error}</div>}
      {successMsg && <div className="p-3 bg-success-light text-success text-xs rounded-md font-semibold">{successMsg}</div>}

      {/* Tableau des matières */}
      <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
        {filteredSubjects.length === 0 ? (
          <p className="p-6 text-xs text-on-surface-variant text-center">Aucune matière ne correspond à votre recherche.</p>
        ) : (
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b font-bold uppercase text-on-surface-variant bg-surface">
                <th className="px-md py-3 w-28">Code (5 Car.)</th>
                <th className="px-md py-3">Intitulé de la Discipline</th>
                <th className="px-md py-3 w-32 text-center">Cours Actifs</th>
                <th className="px-md py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15">
              {filteredSubjects.map((sub) => (
                <tr key={sub.id} className="hover:bg-surface-container/20">
                  <td className="px-md py-3 font-mono font-bold text-primary">
                    <span className="px-2 py-0.5 rounded bg-primary-light border border-primary/20">{sub.code || "—"}</span>
                  </td>
                  <td className="px-md py-3 font-bold text-on-surface">{sub.name}</td>
                  <td className="px-md py-3 text-center font-mono font-bold text-primary">{sub._count?.offerings || 0}</td>
                  <td className="px-md py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setForm({ name: sub.name, code: sub.code || "" });
                          setIsCodeManual(true);
                          setModal({ mode: "edit", item: sub });
                        }}
                        className="px-2.5 py-1 border rounded text-xs hover:bg-surface-container font-semibold"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setDeleteTarget(sub)}
                        className="p-1 text-error hover:bg-error-container/20 rounded"
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
        )}
      </div>

      {/* PORTAIL DES MODALES SANS VIDE SUPÉRIEUR */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* 1. MODALE CRÉATION / ÉDITION */}
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
                  <h4 className="font-bold text-sm text-on-surface">
                    {modal.mode === "edit" ? "Modifier la Matière" : "Nouvelle Matière"}
                  </h4>
                  <button type="button" onClick={() => setModal(null)} className="text-on-surface-variant">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Intitulé de la matière *</label>
                    <input
                      required
                      placeholder="Ex: Thermodynamique appliquée"
                      value={form.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold">Code de 5 caractères *</label>
                      <span className={`text-[10px] font-mono font-bold ${isCodeValid ? "text-success" : "text-error"}`}>
                        {form.code.length} / 5 car. {isCodeValid ? "✓ Valide" : "(Format A-Z 0-9)"}
                      </span>
                    </div>
                    <input
                      required
                      maxLength={5}
                      placeholder="Ex: THM01"
                      value={form.code}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      className={`${inputCls} font-mono uppercase font-bold ${!isCodeValid && form.code ? "border-error focus:border-error" : ""}`}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setModal(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!isCodeValid || !form.name.trim()}
                    className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs disabled:opacity-50"
                  >
                    Enregistrer
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 2. MODALE CONFIRMATION DE SUPPRESSION */}
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
                  <h3 className="text-sm font-bold text-on-surface">Supprimer la matière</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Supprimer définitivement la matière <strong>{deleteTarget.name}</strong> ({deleteTarget.code || "Sans code"}) du référentiel ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">
                    Annuler
                  </button>
                  <button onClick={confirmDeleteSubject} className="px-3.5 py-1.5 bg-error text-white font-bold rounded text-xs shadow-xs">
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