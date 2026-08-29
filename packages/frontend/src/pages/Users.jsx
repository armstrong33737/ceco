// packages/frontend/src/pages/Users.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import { showToast } from "../store/toastStore";
import Icon from "../components/Icon";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: "", lastName: "", email: "", password: "", roleId: "" });
  const [creating, setCreating] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([
        apiFetch("/users"),
        apiFetch("/roles").catch(() => []),
      ]);
      setUsers(usersData || []);
      setRoles(rolesData || []);
    } catch (err) {
      showToast(err.message || "Erreur de chargement des utilisateurs.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.role?.name || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await apiFetch("/users", { method: "POST", body: JSON.stringify(createForm) });
      showToast(`Compte créé pour ${created.firstName} ${created.lastName} (${created.email}).`, "success");
      setCreateForm({ firstName: "", lastName: "", email: "", password: "", roleId: "" });
      setShowCreate(false);
      load();
    } catch (err) {
      showToast(err.message || "Erreur lors de la création du compte.", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    try {
      await apiFetch(`/users/${editingUser.id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
          roleId: editingUser.roleId || null,
        }),
      });
      showToast("Compte utilisateur mis à jour.", "success");
      setEditingUser(null);
      load();
    } catch (err) {
      showToast(err.message || "Erreur de modification.", "error");
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault();
    try {
      await apiFetch(`/users/${passwordUser.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: newPassword }),
      });
      showToast(`Mot de passe réinitialisé pour ${passwordUser.name}.`, "success");
      setPasswordUser(null);
      setNewPassword("");
    } catch (err) {
      showToast(err.message || "Erreur de mise à jour du mot de passe.", "error");
    }
  }

  async function handleToggleActive(user) {
    try {
      await apiFetch(`/users/${user.id}`, { method: "PUT", body: JSON.stringify({ isActive: !user.isActive }) });
      showToast(`Compte de ${user.firstName} ${user.isActive ? "désactivé" : "activé"}.`, "info");
      load();
    } catch (err) {
      showToast(err.message || "Erreur de modification de l'état.", "error");
    }
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/users/${deleteTarget.id}`, { method: "DELETE" });
      showToast(`Compte de ${deleteTarget.name} archivé avec succès.`, "warning");
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(err.message || "Impossible d'archiver ce compte.", "error");
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barre d'outils et recherche */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-card">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Comptes Utilisateurs &amp; Accès Système</h3>
          <p className="text-xs text-slate-500">
            Gestion du personnel administratif, des formateurs et des habilitations d'accès à l'ERP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher utilisateur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-56 pl-8"
            />
            <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]" />
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            <Icon name="person_add" className="text-[16px]" />
            <span>Nouvel Utilisateur</span>
          </button>
        </div>
      </div>

      {/* Tableau des utilisateurs */}
      <div className="table-container">
        {loading ? (
          <p className="p-8 text-xs text-slate-500 text-center">Chargement des utilisateurs...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 text-center">Aucun utilisateur ne correspond à votre recherche.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell">Nom &amp; Prénom</th>
                  <th className="table-header-cell">Identifiant / Email</th>
                  <th className="table-header-cell">Rôle Système</th>
                  <th className="table-header-cell text-center">État du Compte</th>
                  <th className="table-header-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="table-body-row">
                    <td className="table-body-cell font-bold text-slate-900">{u.firstName} {u.lastName}</td>
                    <td className="table-body-cell font-mono text-slate-600">{u.email}</td>
                    <td className="table-body-cell">
                      <span className="badge-blue font-semibold">
                        {u.role?.name || "Sans rôle"}
                      </span>
                    </td>
                    <td className="table-body-cell text-center">
                      <span className={u.isActive ? "badge-emerald" : "badge-rose"}>
                        {u.isActive ? "Actif" : "Désactivé"}
                      </span>
                    </td>
                    <td className="table-body-cell text-right">
                      <div className="flex justify-end gap-1 font-semibold">
                        <button
                          onClick={() => setEditingUser({ id: u.id, firstName: u.firstName, lastName: u.lastName, roleId: u.role?.id || "" })}
                          className="btn-secondary text-[11px] px-2 py-1"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => setPasswordUser({ id: u.id, name: `${u.firstName} ${u.lastName}` })}
                          className="btn-secondary text-[11px] px-2 py-1"
                        >
                          Mot de passe
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className="btn-secondary text-[11px] px-2 py-1"
                        >
                          {u.isActive ? "Désactiver" : "Activer"}
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: u.id, name: `${u.firstName} ${u.lastName}` })}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Archiver le compte"
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
          {/* MODALE CRÉATION */}
          {showCreate && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleCreate}
                className="w-full max-w-md bg-white p-5 rounded-xl shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900">Créer un Compte Utilisateur</h4>
                  <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-700">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Prénom *</label>
                      <input required placeholder="Prénom" value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Nom *</label>
                      <input required placeholder="Nom" value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} className="input-field w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Email / Identifiant *</label>
                    <input required type="email" placeholder="utilisateur@centre.cm" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="input-field w-full font-mono" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Mot de passe provisoire (min. 8 car.) *</label>
                    <input required type="password" minLength={8} placeholder="••••••••" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className="input-field w-full font-mono" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Rôle Système</label>
                    <select value={createForm.roleId} onChange={(e) => setCreateForm({ ...createForm, roleId: e.target.value })} className="input-field w-full">
                      <option value="">Sélectionner un rôle</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Annuler</button>
                  <button type="submit" disabled={creating} className="btn-primary">
                    {creating ? "Création..." : "Créer le compte"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* MODALE ÉDITION */}
          {editingUser && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSaveEdit}
                className="w-full max-w-md bg-white p-5 rounded-xl shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900">Modifier l'Utilisateur</h4>
                  <button type="button" onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-700"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Prénom *</label>
                      <input required value={editingUser.firstName} onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Nom *</label>
                      <input required value={editingUser.lastName} onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })} className="input-field w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Rôle Système</label>
                    <select value={editingUser.roleId} onChange={(e) => setEditingUser({ ...editingUser, roleId: e.target.value })} className="input-field w-full">
                      <option value="">Sélectionner un rôle</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary">Annuler</button>
                  <button type="submit" className="btn-primary">Enregistrer</button>
                </div>
              </motion.form>
            </div>
          )}

          {/* MODALE MOT DE PASSE */}
          {passwordUser && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSavePassword}
                className="w-full max-w-md bg-white p-5 rounded-xl shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900">Réinitialiser le Mot de Passe</h4>
                  <button type="button" onClick={() => setPasswordUser(null)} className="text-slate-400 hover:text-slate-700"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-3 text-xs">
                  <p className="text-slate-600">Nouveau mot de passe pour <strong>{passwordUser.name}</strong> :</p>
                  <input
                    required
                    type="password"
                    minLength={8}
                    placeholder="8 caractères minimum"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field w-full font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setPasswordUser(null)} className="btn-secondary">Annuler</button>
                  <button type="submit" className="btn-primary">Mettre à jour</button>
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
                  <h3 className="text-sm font-bold text-slate-900">Archiver le compte</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Désactiver et archiver le compte de <strong>{deleteTarget.name}</strong> ? L'utilisateur ne pourra plus se connecter.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Annuler</button>
                  <button onClick={confirmDeleteUser} className="btn-primary bg-rose-600 hover:bg-rose-700">
                    Confirmer l'archivage
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