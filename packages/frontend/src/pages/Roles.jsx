import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

const MODULES = [
  { key: "center", label: "Configuration du Centre" },
  { key: "users", label: "Gestion des Utilisateurs" },
  { key: "roles", label: "Rôles & Permissions" },
  { key: "students", label: "Dossiers Apprenants" },
  { key: "grades", label: "Évaluations & Notes" },
  { key: "bulletins", label: "Bulletins, Diplômes & Relevés" },
  { key: "backups", label: "Sauvegardes" },
];

const ACTIONS = [
  { key: "read", label: "Lire" },
  { key: "create", label: "Créer" },
  { key: "update", label: "Modifier" },
  { key: "delete", label: "Supprimer" },
  { key: "generate", label: "Générer" },
];

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

function actionsOf(role) {
  return role.permissions.map((p) => (typeof p === "object" ? p.action : p));
}

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Brouillon local des permissions par rôle — les cases à cocher modifient
  // UNIQUEMENT ce state, jamais le serveur directement. L'enregistrement
  // est une action explicite (bouton "Enregistrer"), pas automatique.
  const [drafts, setDrafts] = useState({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/roles");
      setRoles(data);
      setDrafts(Object.fromEntries(data.map((r) => [r.id, actionsOf(r)])));
    } catch (err) {
      setError(err.message || "Impossible de charger les rôles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateRole(e) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      await apiFetch("/roles", {
        method: "POST",
        body: JSON.stringify({ name: newRoleName.trim(), permissions: [] }),
      });
      setNewRoleName("");
      load();
    } catch (err) {
      console.error(err);
    }
  }

  function toggleDraftPermission(role, permissionKey) {
    setDrafts((prev) => {
      const current = prev[role.id] || [];
      const hasIt = current.includes(permissionKey);
      const next = hasIt ? current.filter((p) => p !== permissionKey) : [...current, permissionKey];
      return { ...prev, [role.id]: next };
    });
  }

  function hasUnsavedChanges(role) {
    const draft = drafts[role.id] || [];
    return !sameSet(draft, actionsOf(role));
  }

  function handleDiscard(role) {
    setDrafts((prev) => ({ ...prev, [role.id]: actionsOf(role) }));
  }

  async function handleSavePermissions(role) {
    setSavingRoleId(role.id);
    try {
      await apiFetch(`/roles/${role.id}`, {
        method: "PUT",
        body: JSON.stringify({ permissions: drafts[role.id] || [] }),
      });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRoleId(null);
    }
  }

  async function handleRename(role) {
    if (!renameValue.trim() || renameValue === role.name) {
      setRenamingId(null);
      return;
    }
    try {
      await apiFetch(`/roles/${role.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      setRenamingId(null);
      load();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await apiFetch(`/roles/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err.message || "Impossible de supprimer ce rôle.");
    }
  }

  if (loading) return <p className="text-sm text-on-surface-variant font-medium">Chargement de la matrice des permissions...</p>;

  if (error) {
    return (
      <div className="rounded-md bg-error-container p-md text-sm text-error">
        <p className="font-semibold">Erreur</p>
        <p className="text-xs mt-1">{error}</p>
        <button onClick={load} className="mt-2 text-xs font-bold underline">Réessayer</button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div>
        <h2 className="text-lg font-semibold text-on-surface">Rôles &amp; permissions</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Seul le rôle d'administration principale ("Admin") est protégé. Cochez les cases souhaitées
          puis cliquez sur "Enregistrer" pour appliquer les changements.
        </p>
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
          Créer un rôle
        </button>
      </form>

      <div className="mt-lg flex flex-col gap-lg">
        {roles.map((role) => {
          const savedActions = actionsOf(role);
          const draftActions = drafts[role.id] || savedActions;
          const isAdminRole =
            savedActions.includes("*") ||
            role.name?.toLowerCase() === "admin" ||
            role.name?.toLowerCase() === "administrateur";
          const dirty = hasUnsavedChanges(role);
          const isSaving = savingRoleId === role.id;

          return (
            <div key={role.id} className={`rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] border ${dirty ? "border-primary" : "border-outline-variant/30"}`}>
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3 mb-4">
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
                    <h3 className="font-semibold text-on-surface text-base">{role.name}</h3>
                  )}
                  {dirty && !isAdminRole && (
                    <span className="rounded-md bg-primary-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Modifications non enregistrées
                    </span>
                  )}
                  {isSaving && <Icon name="progress_activity" className="animate-spin text-[16px] text-primary" />}
                </div>

                {!isAdminRole && (
                  <div className="flex items-center gap-3 text-xs font-semibold">
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

              {isAdminRole ? (
                <div className="flex items-center gap-2 text-sm text-success bg-success-light/40 p-3 rounded-md mt-2">
                  <Icon name="verified_user" />
                  <span>Administrateur complet du centre. Toutes les permissions de la matrice sont implicitement activées.</span>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-outline-variant/30 text-xs font-semibold uppercase text-on-surface-variant">
                          <th className="py-2 pr-4">Module Métier</th>
                          {ACTIONS.map((act) => (
                            <th key={act.key} className="py-2 px-3 text-center text-[10px]">{act.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MODULES.map((mod) => (
                          <tr key={mod.key} className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container/20">
                            <td className="py-3 pr-4 text-sm font-medium text-on-surface">{mod.label}</td>
                            {ACTIONS.map((act) => {
                              const permissionKey = `${mod.key}.${act.key}`;
                              const isChecked = draftActions.includes(permissionKey);
                              return (
                                <td key={act.key} className="py-3 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleDraftPermission(role, permissionKey)}
                                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <AnimatePresence>
                    {dirty && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-md flex items-center gap-2 overflow-hidden"
                      >
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSavePermissions(role)}
                          className="rounded-md bg-gradient-to-r from-primary to-violet px-4 py-2 text-sm font-semibold text-on-primary transition-shadow hover:shadow-[0_4px_14px_rgba(94,114,228,0.35)] disabled:opacity-60"
                        >
                          {isSaving ? "Enregistrement..." : "Enregistrer"}
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleDiscard(role)}
                          className="rounded-md px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container"
                        >
                          Annuler
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-md bg-white p-lg shadow-xl"
            >
              <h3 className="text-base font-semibold text-on-surface mb-1">Supprimer le rôle "{deleteTarget.name}" ?</h3>
              <p className="text-sm text-on-surface-variant mb-md">
                Cette action réinitialisera les privilèges associés.
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