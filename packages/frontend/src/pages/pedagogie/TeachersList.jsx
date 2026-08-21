// packages/frontend/src/pages/pedagogie/TeachersList.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import Icon from "../../components/Icon";

const inputCls = "h-10 rounded bg-surface px-3 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary w-full";

export default function TeachersList() {
  const [formateurs, setFormateurs] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [accountModal, setAccountModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", specialite: "" });
  const [accountForm, setAccountForm] = useState({ email: "", password: "prof1234" });
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  function load() {
    apiFetch("/formateurs").then(setFormateurs).catch((e) => setError(e.message));
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
      } else {
        await apiFetch("/formateurs", { method: "POST", body: JSON.stringify(form) });
      }
      setModal(null);
      setSuccessMsg("Formateur enregistré avec succès.");
      setTimeout(() => setSuccessMsg(""), 3000);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateAccount(e) {
    e.preventDefault();
    try {
      const res = await apiFetch(`/formateurs/${accountModal.id}/account`, {
        method: "POST",
        body: JSON.stringify(accountForm),
      });
      setSuccessMsg(res.message);
      setAccountModal(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDeleteTeacher() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/formateurs/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSuccessMsg("Formateur supprimé.");
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
          <h3 className="text-sm font-bold text-on-surface">Annuaire des Formateurs &amp; Enseignants</h3>
          <p className="text-xs text-on-surface-variant">Gérez le corps professoral et générez leurs comptes d'accès pour la saisie des notes.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Rechercher formateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-2 rounded-md border border-outline-variant/40 outline-none w-56 bg-surface"
          />

          <button
            onClick={() => {
              setForm({ firstName: "", lastName: "", email: "", phone: "", specialite: "" });
              setModal({ mode: "create" });
            }}
            className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-white flex items-center gap-1 shadow-xs flex-shrink-0"
          >
            <Icon name="person_add" className="text-[16px]" />
            <span>Nouveau Formateur</span>
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-error-container text-error text-xs rounded-md font-semibold">{error}</div>}
      {successMsg && <div className="p-3 bg-success-light text-success text-xs rounded-md font-semibold">{successMsg}</div>}

      {filteredFormateurs.length === 0 ? (
        <div className="p-8 text-center bg-surface-container-lowest rounded-md border border-outline-variant/30">
          <p className="text-xs text-on-surface-variant">Aucun formateur ne correspond à votre recherche.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
          {filteredFormateurs.map((f) => (
            <div key={f.id} className="p-md rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col justify-between space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary-light text-primary font-bold flex items-center justify-center border border-primary/20 flex-shrink-0">
                  {f.lastName.charAt(0)}{f.firstName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-on-surface">{f.lastName} {f.firstName}</h4>
                  <p className="text-[11px] text-primary font-semibold">{f.specialite || "Formateur"}</p>
                </div>
              </div>

              <div className="text-xs text-on-surface-variant space-y-1 font-mono">
                <p>Tél : {f.phone || "—"}</p>
                <p>Email : {f.email || "—"}</p>
                <p className="text-[10px] text-primary pt-1">{f._count?.offerings || 0} cours attribué(s)</p>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-outline-variant/20">
                {f.user ? (
                  <span className="text-[10px] font-bold text-success flex items-center gap-1">
                    <Icon name="check_circle" className="text-[14px]" />
                    <span>Compte Actif</span>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setAccountForm({ email: f.email || `${f.firstName.toLowerCase()}.${f.lastName.toLowerCase()}@ceco.local`, password: "prof1234" });
                      setAccountModal(f);
                    }}
                    className="text-[11px] font-bold text-primary hover:underline"
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
                    className="px-2.5 py-1 border rounded text-xs font-semibold hover:bg-surface-container"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => setDeleteTarget(f)}
                    className="p-1 text-error hover:bg-error-container/20 rounded"
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
          {/* 1. MODALE COMPTE 1 CLIC */}
          {accountModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleCreateAccount}
                className="w-full max-w-md bg-white p-md sm:p-lg rounded-md shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-bold text-sm text-on-surface">Générer le compte ({accountModal.firstName} {accountModal.lastName})</h4>
                  <button type="button" onClick={() => setAccountModal(null)} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Identifiant de connexion (Email)</label>
                    <input required value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Mot de passe provisoire</label>
                    <input required value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setAccountModal(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">Créer le compte</button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 2. MODALE CRÉATION / ÉDITION */}
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
                  <h4 className="font-bold text-sm text-on-surface">{modal.mode === "edit" ? "Modifier le Formateur" : "Nouveau Formateur"}</h4>
                  <button type="button" onClick={() => setModal(null)} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold block mb-1">Nom *</label>
                      <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Prénom *</label>
                      <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Spécialité</label>
                    <input value={form.specialite} onChange={(e) => setForm({ ...form, specialite: e.target.value })} className={inputCls} placeholder="Ex: Électromécanique" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold block mb-1">Téléphone</label>
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Email</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setModal(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">Enregistrer</button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 3. MODALE CONFIRMATION DE SUPPRESSION */}
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
                  <h3 className="text-sm font-bold text-on-surface">Supprimer le formateur</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Supprimer définitivement <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong> de l'annuaire ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button onClick={confirmDeleteTeacher} className="px-3.5 py-1.5 bg-error text-white font-bold rounded text-xs shadow-xs">
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