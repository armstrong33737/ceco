import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

const inputCls = "h-11 rounded-md bg-surface px-4 text-sm shadow-[inset_0_0_0_1px_theme(colors.outline-variant)] outline-none focus:shadow-[inset_0_0_0_2px_theme(colors.primary)]";

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
      setUsers(usersData);
      setRoles(rolesData);
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
    return <p className="text-sm text-on-surface-variant">Chargement de la liste des utilisateurs...</p>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-error-container p-md text-sm text-error">
        <p className="font-semibold">Erreur de chargement</p>
        <p className="text-xs mt-1">{error}</p>
        <button onClick={load} className="mt-2 text-xs font-bold underline">Réessayer</button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Utilisateurs</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Gérez les comptes ayant accès à CECO.</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-violet px-4 py-2.5 text-sm font-semibold text-on-primary transition-shadow hover:shadow-[0_4px_14px_rgba(94,114,228,0.35)]"
        >
          <Icon name="add" className="text-[18px]" />
          Nouvel utilisateur
        </button>
      </div>

      {/* Création */}
      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="mt-md overflow-hidden rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div className="grid grid-cols-2 gap-md">
              <input required placeholder="Prénom" value={createForm.firstName} onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))} className={inputCls} />
              <input required placeholder="Nom" value={createForm.lastName} onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))} className={inputCls} />
              <input required type="email" placeholder="Email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
              <input required type="password" placeholder="Mot de passe (8 caractères min.)" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} />
              <select value={createForm.roleId} onChange={(e) => setCreateForm((f) => ({ ...f, roleId: e.target.value }))} className={inputCls + " col-span-2"}>
                <option value="">Aucun rôle</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {createError && <p className="mt-3 rounded-md bg-error-container px-3 py-2 text-sm text-error">{createError}</p>}
            <button type="submit" disabled={creating} className="mt-md rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-container disabled:opacity-60">
              {creating ? "Création..." : "Créer l'utilisateur"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Liste */}
      <div className="mt-lg overflow-hidden rounded-md bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30">
        {users.length === 0 ? (
          <p className="p-lg text-sm text-on-surface-variant">Aucun utilisateur pour l'instant.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-left text-xs uppercase tracking-wider text-on-surface-variant">
                <th className="px-lg py-3 font-semibold">Nom</th>
                <th className="px-lg py-3 font-semibold">Email</th>
                <th className="px-lg py-3 font-semibold">Rôle</th>
                <th className="px-lg py-3 font-semibold">Statut</th>
                <th className="px-lg py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container/20">
                  <td className="px-lg py-3 text-on-surface">{u.firstName} {u.lastName}</td>
                  <td className="px-lg py-3 text-on-surface-variant">{u.email}</td>
                  <td className="px-lg py-3 text-on-surface-variant">{u.role?.name || "—"}</td>
                  <td className="px-lg py-3">
                    <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${u.isActive ? "bg-success-light text-success" : "bg-error-container text-error"}`}>
                      {u.isActive ? "Actif" : "Désactivé"}
                    </span>
                  </td>
                  <td className="px-lg py-3">
                    <div className="flex items-center justify-end gap-3 text-xs font-semibold">
                      <button onClick={() => setEditingUser({ id: u.id, firstName: u.firstName, lastName: u.lastName, roleId: u.role?.id || "" })} className="text-primary hover:underline">
                        Modifier
                      </button>
                      <button onClick={() => setPasswordUser({ id: u.id, name: `${u.firstName} ${u.lastName}` })} className="text-on-surface-variant hover:underline">
                        Mot de passe
                      </button>
                      <button onClick={() => handleToggleActive(u)} className="text-on-surface-variant hover:underline">
                        {u.isActive ? "Désactiver" : "Réactiver"}
                      </button>
                      <button onClick={() => setDeleteTarget({ id: u.id, name: `${u.firstName} ${u.lastName}` })} className="text-error hover:underline">
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modale d'édition */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleSaveEdit}
              className="w-full max-w-sm rounded-md bg-white p-lg shadow-xl"
            >
              <h3 className="text-base font-semibold text-on-surface mb-md">Modifier l'utilisateur</h3>
              <div className="flex flex-col gap-3">
                <input required value={editingUser.firstName} onChange={(e) => setEditingUser((u) => ({ ...u, firstName: e.target.value }))} className={inputCls} placeholder="Prénom" />
                <input required value={editingUser.lastName} onChange={(e) => setEditingUser((u) => ({ ...u, lastName: e.target.value }))} className={inputCls} placeholder="Nom" />
                <select value={editingUser.roleId} onChange={(e) => setEditingUser((u) => ({ ...u, roleId: e.target.value }))} className={inputCls}>
                  <option value="">Aucun rôle</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {editError && <p className="mt-3 rounded-md bg-error-container px-3 py-2 text-sm text-error">{editError}</p>}
              <div className="mt-md flex justify-end gap-2">
                <button type="button" onClick={() => setEditingUser(null)} className="rounded-md px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container">Annuler</button>
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-container">Enregistrer</button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Modale de réinitialisation de mot de passe */}
      <AnimatePresence>
        {passwordUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleSavePassword}
              className="w-full max-w-sm rounded-md bg-white p-lg shadow-xl"
            >
              <h3 className="text-base font-semibold text-on-surface mb-1">Réinitialiser le mot de passe</h3>
              <p className="text-sm text-on-surface-variant mb-md">{passwordUser.name}</p>
              <input
                required
                type="password"
                minLength={8}
                placeholder="Nouveau mot de passe (8 caractères min.)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputCls + " w-full"}
              />
              {passwordError && <p className="mt-3 rounded-md bg-error-container px-3 py-2 text-sm text-error">{passwordError}</p>}
              <div className="mt-md flex justify-end gap-2">
                <button type="button" onClick={() => { setPasswordUser(null); setNewPassword(""); }} className="rounded-md px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container">Annuler</button>
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-container">Enregistrer</button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation de suppression */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-md bg-white p-lg shadow-xl"
            >
              <h3 className="text-base font-semibold text-on-surface mb-1">Supprimer cet utilisateur ?</h3>
              <p className="text-sm text-on-surface-variant mb-md">
                {deleteTarget.name} n'aura plus accès à CECO.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteTarget(null)} className="rounded-md px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container">Annuler</button>
                <button onClick={handleDelete} className="rounded-md bg-error px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Supprimer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}