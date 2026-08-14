import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

const inputCls = "h-10 sm:h-11 rounded-md bg-surface px-3.5 text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: "", lastName: "", email: "", password: "", roleId: "" });
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [editError, setEditError] = useState(null);

  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [usersData, rolesData] = await Promise.all([
        apiFetch("/users"),
        apiFetch("/roles").catch(() => []),
      ]);
      setUsers(usersData || []);
      setRoles(rolesData || []);
    } catch (err) {
      setError(err.message || "Erreur lors du chargement des utilisateurs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch("/users", { method: "POST", body: JSON.stringify(createForm) });
      setCreateForm({ firstName: "", lastName: "", email: "", password: "", roleId: "" });
      setShowCreate(false);
      load();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setEditError(null);
    try {
      await apiFetch(`/users/${editingUser.id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
          roleId: editingUser.roleId || null,
        }),
      });
      setEditingUser(null);
      load();
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault();
    setPasswordError(null);
    try {
      await apiFetch(`/users/${passwordUser.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: newPassword }),
      });
      setPasswordUser(null);
      setNewPassword("");
    } catch (err) {
      setPasswordError(err.message);
    }
  }

  async function handleToggleActive(user) {
    try {
      await apiFetch(`/users/${user.id}`, { method: "PUT", body: JSON.stringify({ isActive: !user.isActive }) });
      load();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete() {
    try {
      await apiFetch(`/users/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return <p className="text-sm text-on-surface-variant font-medium">Chargement de la liste des utilisateurs...</p>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-error-container p-md text-sm text-error border border-error/20">
        <p className="font-semibold">Erreur de chargement</p>
        <p className="text-xs mt-1">{error}</p>
        <button onClick={load} className="mt-2 text-xs font-bold underline">Réessayer</button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-md max-w-5xl mx-auto"
    >
      {/* En-tête avec bouton d'action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-on-surface">Comptes Utilisateurs</h1>
            <span className="rounded-md bg-primary-light text-primary font-bold text-[11px] px-2 py-0.5">
              {users.length} comptes
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Gérez les accès, les rôles attribués et l'état d'activation des comptes du personnel.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-xs font-bold text-on-primary hover:bg-primary-dark transition-all shadow-xs flex-shrink-0"
        >
          <Icon name={showCreate ? "close" : "person_add"} className="text-[16px]" />
          <span>{showCreate ? "Fermer le formulaire" : "Nouvel utilisateur"}</span>
        </button>
      </div>

      {/* Formulaire de création */}
      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="overflow-hidden rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-md"
          >
            <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-3">
              <Icon name="add_circle" className="text-primary text-[18px]" />
              <h2 className="text-sm font-bold text-on-surface">Créer un nouveau compte utilisateur</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Prénom</label>
                <input required placeholder="Prénom" value={createForm.firstName} onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Nom</label>
                <input required placeholder="Nom de famille" value={createForm.lastName} onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Adresse Email</label>
                <input required type="email" placeholder="utilisateur@centre.cm" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Mot de passe provisoire</label>
                <input required type="password" placeholder="8 caractères minimum" minLength={8} value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Rôle attribué</label>
                <select value={createForm.roleId} onChange={(e) => setCreateForm((f) => ({ ...f, roleId: e.target.value }))} className={inputCls}>
                  <option value="">Aucun rôle spécifique</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            {createError && <p className="rounded-md bg-error-container px-3 py-2 text-xs text-error font-semibold">{createError}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">
                Annuler
              </button>
              <button type="submit" disabled={creating} className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark transition-colors disabled:opacity-60">
                {creating ? "Création en cours..." : "Créer le compte"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Tableau des utilisateurs */}
      <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
        {users.length === 0 ? (
          <p className="p-lg text-sm text-on-surface-variant text-center">Aucun utilisateur enregistré pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-outline-variant/30 text-xs font-semibold uppercase tracking-wider text-on-surface-variant bg-surface">
                  <th className="px-md py-3">Nom &amp; Prénom</th>
                  <th className="px-md py-3">Identifiant / Email</th>
                  <th className="px-md py-3">Rôle système</th>
                  <th className="px-md py-3">État</th>
                  <th className="px-md py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-container/30 transition-colors">
                    <td className="px-md py-3 font-semibold text-on-surface">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-md py-3 text-on-surface-variant font-mono text-xs">
                      {u.email}
                    </td>
                    <td className="px-md py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2.5 py-1 text-xs font-medium text-on-surface border border-outline-variant/30">
                        <Icon name="badge" className="text-[14px] text-on-surface-variant" />
                        {u.role?.name || "Sans rôle"}
                      </span>
                    </td>
                    <td className="px-md py-3">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-bold ${
                        u.isActive ? "bg-success-light text-success" : "bg-error-container text-error"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-md ${u.isActive ? "bg-success" : "bg-error"}`} />
                        {u.isActive ? "Actif" : "Désactivé"}
                      </span>
                    </td>
                    <td className="px-md py-3 text-right">
                      <div className="flex items-center justify-end gap-2 text-xs font-semibold">
                        <button
                          onClick={() => setEditingUser({ id: u.id, firstName: u.firstName, lastName: u.lastName, roleId: u.role?.id || "" })}
                          className="rounded-md border border-outline-variant px-2.5 py-1 text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => setPasswordUser({ id: u.id, name: `${u.firstName} ${u.lastName}` })}
                          className="rounded-md border border-outline-variant px-2.5 py-1 text-on-surface-variant hover:bg-surface-container transition-colors"
                        >
                          Mot de passe
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className="rounded-md border border-outline-variant px-2.5 py-1 text-on-surface-variant hover:bg-surface-container transition-colors"
                        >
                          {u.isActive ? "Désactiver" : "Activer"}
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: u.id, name: `${u.firstName} ${u.lastName}` })}
                          className="rounded-md border border-error/30 px-2.5 py-1 text-error hover:bg-error-container/20 transition-colors"
                        >
                          Supprimer
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

      {/* =====================================================================
          PORTAIL DES MODALES (Rendu direct sur document.body pour plein écran)
          ===================================================================== */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* Modale d'édition */}
          {editingUser && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSaveEdit}
                className="w-full max-w-md rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md"
              >
                <h3 className="text-base font-bold text-on-surface border-b border-outline-variant/20 pb-3">Modifier le profil utilisateur</h3>
                <div className="space-y-md">
                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Prénom</label>
                    <input required value={editingUser.firstName} onChange={(e) => setEditingUser((u) => ({ ...u, firstName: e.target.value }))} className={inputCls} placeholder="Prénom" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Nom</label>
                    <input required value={editingUser.lastName} onChange={(e) => setEditingUser((u) => ({ ...u, lastName: e.target.value }))} className={inputCls} placeholder="Nom" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Rôle</label>
                    <select value={editingUser.roleId} onChange={(e) => setEditingUser((u) => ({ ...u, roleId: e.target.value }))} className={inputCls}>
                      <option value="">Aucun rôle spécifique</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                {editError && <p className="rounded-md bg-error-container px-3 py-2 text-xs text-error font-semibold">{editError}</p>}
                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button type="button" onClick={() => setEditingUser(null)} className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">Annuler</button>
                  <button type="submit" className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark">Enregistrer</button>
                </div>
              </motion.form>
            </div>
          )}

          {/* Modale de réinitialisation du mot de passe */}
          {passwordUser && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSavePassword}
                className="w-full max-w-md rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md"
              >
                <h3 className="text-base font-bold text-on-surface border-b border-outline-variant/20 pb-3">Réinitialiser le mot de passe</h3>
                <p className="text-xs text-on-surface-variant">Définir un nouveau mot de passe pour <strong>{passwordUser.name}</strong>.</p>
                <input
                  required
                  type="password"
                  minLength={8}
                  placeholder="Nouveau mot de passe (8 caractères min.)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputCls}
                />
                {passwordError && <p className="rounded-md bg-error-container px-3 py-2 text-xs text-error font-semibold">{passwordError}</p>}
                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button type="button" onClick={() => { setPasswordUser(null); setNewPassword(""); }} className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">Annuler</button>
                  <button type="submit" className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark">Mettre à jour</button>
                </div>
              </motion.form>
            </div>
          )}

          {/* Confirmation de suppression */}
          {deleteTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center gap-2 text-error">
                  <Icon name="warning" className="text-[20px]" />
                  <h3 className="text-base font-bold text-on-surface">Confirmer la suppression</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Le compte de <strong>{deleteTarget.name}</strong> sera désactivé et archivé. L'utilisateur ne pourra plus se connecter.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button onClick={() => setDeleteTarget(null)} className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">Annuler</button>
                  <button onClick={handleDelete} className="rounded-md bg-error px-4 py-2 text-xs font-bold text-white hover:opacity-90">Confirmer la suppression</button>
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