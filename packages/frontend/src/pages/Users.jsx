// packages/frontend/src/pages/Users.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

const inputCls = "h-10 rounded-md bg-surface px-3.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary w-full";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: "", lastName: "", email: "", password: "", roleId: "" });
  const [creating, setCreating] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
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
      setError(err.message);
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
      await apiFetch("/users", { method: "POST", body: JSON.stringify(createForm) });
      setCreateForm({ firstName: "", lastName: "", email: "", password: "", roleId: "" });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.message);
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
      setEditingUser(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault();
    try {
      await apiFetch(`/users/${passwordUser.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: newPassword }),
      });
      setPasswordUser(null);
      setNewPassword("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleActive(user) {
    try {
      await apiFetch(`/users/${user.id}`, { method: "PUT", body: JSON.stringify({ isActive: !user.isActive }) });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/users/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    }
  }

  if (loading) return <p className="text-sm text-on-surface-variant font-medium">Chargement des utilisateurs...</p>;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-md max-w-5xl mx-auto">
      {/* En-tête standardisé */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Comptes Utilisateurs &amp; Accès</h3>
          <p className="text-xs text-on-surface-variant">Gestion du personnel administratif, des enseignants et des accès au logiciel.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Rechercher utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-2 rounded-md border border-outline-variant/40 outline-none w-56 bg-surface"
          />

          <button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-white flex items-center gap-1 shadow-xs flex-shrink-0"
          >
            <Icon name="person_add" className="text-[16px]" />
            <span>Nouvel Utilisateur</span>
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-error-container text-error text-xs rounded-md font-semibold">{error}</div>}

      {/* Tableau des utilisateurs */}
      <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b font-bold uppercase text-on-surface-variant bg-surface">
              <th className="px-md py-3">Nom &amp; Prénom</th>
              <th className="px-md py-3">Identifiant / Email</th>
              <th className="px-md py-3">Rôle Système</th>
              <th className="px-md py-3">État</th>
              <th className="px-md py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-surface-container/20">
                <td className="px-md py-3 font-semibold text-on-surface">{u.firstName} {u.lastName}</td>
                <td className="px-md py-3 font-mono text-on-surface-variant">{u.email}</td>
                <td className="px-md py-3">
                  <span className="px-2 py-0.5 rounded bg-surface border border-outline-variant/30 font-semibold">
                    {u.role?.name || "Sans rôle"}
                  </span>
                </td>
                <td className="px-md py-3">
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${u.isActive ? "bg-success-light text-success" : "bg-error-container text-error"}`}>
                    {u.isActive ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td className="px-md py-3 text-right">
                  <div className="flex justify-end gap-1 font-semibold">
                    <button
                      onClick={() => setEditingUser({ id: u.id, firstName: u.firstName, lastName: u.lastName, roleId: u.role?.id || "" })}
                      className="px-2 py-1 border rounded text-[11px] hover:bg-surface-container"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setPasswordUser({ id: u.id, name: `${u.firstName} ${u.lastName}` })}
                      className="px-2 py-1 border rounded text-[11px] hover:bg-surface-container"
                    >
                      Mot de passe
                    </button>
                    <button
                      onClick={() => handleToggleActive(u)}
                      className="px-2 py-1 border rounded text-[11px] hover:bg-surface-container"
                    >
                      {u.isActive ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: u.id, name: `${u.firstName} ${u.lastName}` })}
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
      </div>

      {/* PORTAIL DES MODALES SANS VIDE SUPÉRIEUR */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* 1. MODALE CRÉATION */}
          {showCreate && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleCreate}
                className="w-full max-w-md bg-white p-md sm:p-lg rounded-md shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-bold text-sm text-on-surface">Créer un Compte Utilisateur</h4>
                  <button type="button" onClick={() => setShowCreate(false)} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold block mb-1">Prénom *</label>
                      <input required placeholder="Prénom" value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Nom *</label>
                      <input required placeholder="Nom" value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Email *</label>
                    <input required type="email" placeholder="utilisateur@centre.cm" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Mot de passe provisoire *</label>
                    <input required type="password" minLength={8} placeholder="8 caractères min." value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Rôle Système</label>
                    <select value={createForm.roleId} onChange={(e) => setCreateForm({ ...createForm, roleId: e.target.value })} className={inputCls}>
                      <option value="">Aucun rôle spécifique</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" disabled={creating} className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">
                    {creating ? "Création..." : "Créer le compte"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 2. MODALE ÉDITION */}
          {editingUser && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSaveEdit}
                className="w-full max-w-md bg-white p-md sm:p-lg rounded-md shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-bold text-sm text-on-surface">Modifier l'Utilisateur</h4>
                  <button type="button" onClick={() => setEditingUser(null)} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold block mb-1">Prénom *</label>
                      <input required value={editingUser.firstName} onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Nom *</label>
                      <input required value={editingUser.lastName} onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Rôle Système</label>
                    <select value={editingUser.roleId} onChange={(e) => setEditingUser({ ...editingUser, roleId: e.target.value })} className={inputCls}>
                      <option value="">Aucun rôle spécifique</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setEditingUser(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">Enregistrer</button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 3. MODALE MOT DE PASSE */}
          {passwordUser && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSavePassword}
                className="w-full max-w-md bg-white p-md sm:p-lg rounded-md shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-bold text-sm text-on-surface">Réinitialiser le Mot de Passe</h4>
                  <button type="button" onClick={() => setPasswordUser(null)} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <p className="text-xs text-on-surface-variant">Nouveau mot de passe pour <strong>{passwordUser.name}</strong> :</p>
                <input
                  required
                  type="password"
                  minLength={8}
                  placeholder="8 caractères minimum"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputCls}
                />
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setPasswordUser(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">Mettre à jour</button>
                </div>
              </motion.form>
            </div>
          )}

          {/* 4. MODALE CONFIRMATION DE SUPPRESSION */}
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
                  <h3 className="text-sm font-bold text-on-surface">Désactiver le compte</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Désactiver et archiver le compte de <strong>{deleteTarget.name}</strong> ? L'utilisateur ne pourra plus se connecter.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button onClick={confirmDeleteUser} className="px-3.5 py-1.5 bg-error text-white font-bold rounded text-xs shadow-xs">
                    Confirmer la désactivation
                  </button>
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