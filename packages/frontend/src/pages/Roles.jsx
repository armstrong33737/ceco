import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

const KNOWN_ACTIONS = [
  { action: "center.update", label: "Modifier les informations du centre" },
  { action: "users.manage", label: "Gérer les utilisateurs" },
  { action: "roles.manage", label: "Gérer les rôles et permissions" },
];

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState("");
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  async function load() {
    setLoading(true);
    setRoles(await apiFetch("/roles"));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreateRole(e) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    await apiFetch("/roles", { method: "POST", body: JSON.stringify({ name: newRoleName, permissions: [] }) });
    setNewRoleName("");
    load();
  }

  async function togglePermission(role, action) {
    const hasIt = role.permissions.includes(action);
    const nextPermissions = hasIt ? role.permissions.filter((p) => p !== action) : [...role.permissions, action];
    setSavingRoleId(role.id);
    try {
      await apiFetch(`/roles/${role.id}`, { method: "PUT", body: JSON.stringify({ permissions: nextPermissions }) });
      await load();
    } finally {
      setSavingRoleId(null);
    }
  }

  async function handleRename(role) {
    if (!renameValue.trim() || renameValue === role.name) {
      setRenamingId(null);
      return;
    }
    await apiFetch(`/roles/${role.id}`, { method: "PUT", body: JSON.stringify({ name: renameValue.trim() }) });
    setRenamingId(null);
    load();
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await apiFetch(`/roles/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Rôles &amp; permissions</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Le rôle Admin possède toujours tous les droits ("*") et n'est pas modifiable.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreateRole} className="mt-md flex gap-2">
        <input
          placeholder="Nom du nouveau rôle"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          className="h-11 flex-1 max-w-xs rounded-md bg-surface-container-lowest px-4 text-sm shadow-[inset_0_0_0_1px_theme(colors.outline-variant)] outline-none focus:shadow-[inset_0_0_0_2px_theme(colors.primary)]"
        />
        <button type="submit" className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-violet px-4 text-sm font-semibold text-on-primary transition-shadow hover:shadow-[0_4px_14px_rgba(94,114,228,0.35)]">
          <Icon name="add" className="text-[18px]" />
          Créer
        </button>
      </form>

      {loading ? (
        <p className="mt-lg text-sm text-on-surface-variant">Chargement...</p>
      ) : (
        <div className="mt-lg flex flex-col gap-md">
          {roles.map((role) => (
            <div key={role.id} className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renamingId === role.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRename(role)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename(role)}
                      className="h-8 rounded-md bg-surface px-2 text-sm shadow-[inset_0_0_0_1px_theme(colors.outline-variant)] outline-none"
                    />
                  ) : (
                    <h3 className="font-semibold text-on-surface">{role.name}</h3>
                  )}
                  {role.isSystem && (
                    <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[10px] uppercase tracking-wide text-on-surface-variant">
                      Système
                    </span>
                  )}
                  {savingRoleId === role.id && (
                    <Icon name="progress_activity" className="animate-spin text-[16px] text-on-surface-variant" />
                  )}
                </div>

                {!role.isSystem && (
                  <div className="flex items-center gap-3 text-xs font-medium">
                    <button
                      onClick={() => { setRenamingId(role.id); setRenameValue(role.name); }}
                      className="text-primary hover:underline"
                    >
                      Renommer
                    </button>
                    <button onClick={() => setDeleteTarget(role)} className="text-error hover:underline">
                      Supprimer
                    </button>
                  </div>
                )}
              </div>

              {role.permissions.includes("*") ? (
                <p className="mt-2 text-sm text-on-surface-variant">Tous les droits (accès administrateur complet).</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {KNOWN_ACTIONS.map(({ action, label }) => (
                    <label key={action} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={role.permissions.includes(action)}
                        disabled={role.isSystem}
                        onChange={() => togglePermission(role, action)}
                        className="h-4 w-4 rounded accent-primary"
                      />
                      <span className={role.isSystem ? "text-on-surface-variant/60" : "text-on-surface"}>{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-md bg-white p-lg shadow-xl"
            >
              <h3 className="text-base font-semibold text-on-surface mb-1">Supprimer le rôle "{deleteTarget.name}" ?</h3>
              <p className="text-sm text-on-surface-variant mb-md">
                Les utilisateurs assignés à ce rôle devront être réassignés avant suppression.
              </p>
              {deleteError && <p className="mb-md rounded-md bg-error-container px-3 py-2 text-sm text-error">{deleteError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }} className="rounded-md px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container">Annuler</button>
                <button onClick={handleDelete} className="rounded-md bg-error px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Supprimer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}