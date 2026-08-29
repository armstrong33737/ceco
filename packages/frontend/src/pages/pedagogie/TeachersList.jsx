// packages/frontend/src/pages/pedagogie/TeachersList.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import Icon from "../../components/Icon";

export default function TeachersList() {
  const [formateurs, setFormateurs] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [accountModal, setAccountModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", specialite: "" });
  const [accountForm, setAccountForm] = useState({ email: "", password: "prof1234" });
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    apiFetch("/formateurs")
      .then((data) => setFormateurs(data || []))
      .catch((e) => showToast(e.message || "Erreur de chargement des formateurs.", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filteredFormateurs = useMemo(() => {
    if (!search.trim()) return formateurs;
    const q = search.toLowerCase();
    return formateurs.filter((f) =>
      `${f.firstName} ${f.lastName}`.toLowerCase().includes(q) ||
      (f.specialite || "").toLowerCase().includes(q) ||
      (f.phone || "").includes(q)
    );
  }, [formateurs, search]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (modal.mode === "edit") {
        await apiFetch(`/formateurs/${modal.item.id}`, { method: "PUT", body: JSON.stringify(form) });
        showToast(`Formateur ${form.lastName} mis à jour.`, "success");
      } else {
        await apiFetch("/formateurs", { method: "POST", body: JSON.stringify(form) });
        showToast(`Formateur ${form.firstName} ${form.lastName} enregistré.`, "success");
      }
      setModal(null);
      load();
    } catch (err) {
      showToast(err.message || "Erreur d'enregistrement.", "error");
    }
  }

  async function handleCreateAccount(e) {
    e.preventDefault();
    try {
      const res = await apiFetch(`/formateurs/${accountModal.id}/account`, {
        method: "POST",
        body: JSON.stringify(accountForm),
      });
      showToast(res.message || "Compte d'accès enseignant créé avec succès.", "success");
      setAccountModal(null);
      load();
    } catch (err) {
      showToast(err.message || "Erreur de création de compte.", "error");
    }
  }

  async function confirmDeleteTeacher() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/formateurs/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast(`Formateur ${deleteTarget.lastName} retiré de l'annuaire.`, "warning");
      load();
    } catch (err) {
      showToast(err.message || "Impossible de supprimer ce formateur.", "error");
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barre d'outils et recherche */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-card">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Annuaire des Formateurs &amp; Enseignants</h3>
          <p className="text-xs text-slate-500">
            Gérez le corps professoral et générez leurs comptes d'accès pour la saisie des notes sur le réseau local.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher formateur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-56 pl-8"
            />
            <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]" />
          </div>

          <button
            onClick={() => {
              setForm({ firstName: "", lastName: "", email: "", phone: "", specialite: "" });
              setModal({ mode: "create" });
            }}
            className="btn-primary"
          >
            <Icon name="person_add" className="text-[16px]" />
            <span>Nouveau Formateur</span>
          </button>
        </div>
      </div>

      {/* Grille des formateurs */}
      {loading ? (
        <p className="p-8 text-xs text-slate-500 text-center">Chargement de l'annuaire des formateurs...</p>
      ) : filteredFormateurs.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500">Aucun formateur ne correspond à votre recherche.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFormateurs.map((f) => (
            <div key={f.id} className="p-4 rounded-lg bg-white border border-slate-200 shadow-card flex flex-col justify-between space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-blue-50 text-blue-700 font-bold flex items-center justify-center border border-blue-200 shrink-0 font-mono text-sm">
                  {f.lastName.charAt(0)}{f.firstName.charAt(0)}
                </div>
                <div className="truncate">
                  <h4 className="font-bold text-xs text-slate-900 truncate">{f.lastName} {f.firstName}</h4>
                  <p className="text-[11px] text-blue-700 font-semibold truncate">{f.specialite || "Formateur"}</p>
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1 font-mono">
                <p className="truncate">Tél : {f.phone || "—"}</p>
                <p className="truncate">Email : {f.email || "—"}</p>
                <p className="text-[11px] text-blue-700 font-bold pt-1">{f._count?.offerings || 0} cours assigné(s)</p>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                {f.user ? (
                  <span className="badge-emerald font-bold text-[10px]">
                    <Icon name="check_circle" className="text-[12px]" />
                    <span>Compte Actif</span>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setAccountForm({ email: f.email || `${f.firstName.toLowerCase()}.${f.lastName.toLowerCase()}@ceco.local`, password: "prof1234" });
                      setAccountModal(f);
                    }}
                    className="text-[11px] font-bold text-blue-700 hover:underline"
                  >
                    + Créer accès
                  </button>
                )}

                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setForm({ firstName: f.firstName, lastName: f.lastName, email: f.email || "", phone: f.phone || "", specialite: f.specialite || "" });
                      setModal({ mode: "edit", item: f });
                    }}
                    className="btn-secondary text-[11px] px-2 py-1"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => setDeleteTarget(f)}
                    className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                    title="Supprimer le formateur"
                  >
                    <Icon name="delete" className="text-[16px]" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PORTAIL DES MODALES */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* MODALE COMPTE ENSEIGNANT */}
          {accountModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleCreateAccount}
                className="w-full max-w-md bg-white p-5 rounded-xl shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900">Générer le compte ({accountModal.firstName} {accountModal.lastName})</h4>
                  <button type="button" onClick={() => setAccountModal(null)} className="text-slate-400 hover:text-slate-700"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Identifiant de connexion (Email) *</label>
                    <input required value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} className="input-field w-full font-mono" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Mot de passe provisoire *</label>
                    <input required value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} className="input-field w-full font-mono" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setAccountModal(null)} className="btn-secondary">Annuler</button>
                  <button type="submit" className="btn-primary">Créer le compte</button>
                </div>
              </motion.form>
            </div>
          )}

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
                  <h4 className="font-bold text-sm text-slate-900">{modal.mode === "edit" ? "Modifier le Formateur" : "Nouveau Formateur"}</h4>
                  <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Nom *</label>
                      <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Prénom *</label>
                      <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input-field w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Spécialité / Discipline</label>
                    <input value={form.specialite} onChange={(e) => setForm({ ...form, specialite: e.target.value })} className="input-field w-full" placeholder="Ex: Froid & Climatisation" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Téléphone</label>
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field w-full font-mono" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Email</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field w-full font-mono" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setModal(null)} className="btn-secondary">Annuler</button>
                  <button type="submit" className="btn-primary">Enregistrer</button>
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
                  <h3 className="text-sm font-bold text-slate-900">Supprimer le formateur</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Supprimer définitivement <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong> de l'annuaire ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Annuler</button>
                  <button onClick={confirmDeleteTeacher} className="btn-primary bg-rose-600 hover:bg-rose-700">
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