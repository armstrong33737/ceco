import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

const MODULES = [
  { key: "center", label: "Configuration du Centre", icon: "storefront" },
  { key: "users", label: "Gestion des Utilisateurs", icon: "group" },
  { key: "roles", label: "Rôles & Permissions", icon: "badge" },
  { key: "students", label: "Dossiers Apprenants", icon: "school" },
  { key: "grades", label: "Évaluations & Notes", icon: "grade" },
  { key: "bulletins", label: "Bulletins, Diplômes & Relevés", icon: "description" },
  { key: "backups", label: "Sauvegardes & Restauration", icon: "archive" },
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
  const [creating, setCreating] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Brouillon local des permissions par rôle pour validation explicite
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
    setCreating(true);
    try {
      await apiFetch("/roles", {
        method: "POST",
        body: JSON.stringify({ name: newRoleName.trim(), permissions: [] }),
      });
      setNewRoleName("");
      await load();
    } catch (err) {
      setError(err.message || "Erreur lors de la création du rôle.");
    } finally {
      setCreating(false);
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
      setError(err.message || "Erreur lors de l'enregistrement des permissions.");
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
      await load();
    } catch (err) {
      setError(err.message || "Erreur lors du renommage.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await apiFetch(`/roles/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteError(err.message || "Impossible de supprimer ce rôle.");
    }
  }

  if (loading) return <p className="text-sm text-on-surface-variant font-medium">Chargement de la matrice des permissions...</p>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-md max-w-5xl mx-auto"
    >
      {/* En-tête informatif */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-on-surface">Rôles &amp; Permissions</h1>
            <span className="rounded-md bg-primary-light text-primary font-bold text-[11px] px-2 py-0.5">
              {roles.length} rôles
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Configurez finement les accès modulaires. Seul le profil racine ("Admin") reste verrouillé par sécurité.
          </p>
        </div>

        {/* Formulaire de création rapide */}
        <form onSubmit={handleCreateRole} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            placeholder="Nom du nouveau rôle..."
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            className="h-10 rounded-md bg-surface px-3 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary transition-all flex-1 sm:w-56"
          />
          <button
            type="submit"
            disabled={creating || !newRoleName.trim()}
            className="h-10 rounded-md bg-primary px-3.5 text-xs font-bold text-on-primary hover:bg-primary-dark transition-all disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-xs flex-shrink-0"
          >
            <Icon name="add" className="text-[16px]" />
            <span>{creating ? "Ajout..." : "Créer"}</span>
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-md bg-error-container p-md text-sm text-error border border-error/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="error" className="text-[18px]" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
          <button onClick={load} className="text-xs font-bold underline">Réessayer</button>
        </div>
      )}

      {/* Liste des rôles sous forme de cartes d'habilitations */}
      <div className="space-y-md">
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
            <div
              key={role.id}
              className={`rounded-md bg-surface-container-lowest p-md sm:p-lg shadow-xs border transition-all ${
                dirty ? "border-primary ring-1 ring-primary/30" : "border-outline-variant/30"
              }`}
            >
              {/* En-tête du rôle */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-outline-variant/20 pb-3 mb-md">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {renamingId === role.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRename(role)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename(role)}
                      className="h-8 rounded-md bg-surface px-2.5 text-sm font-bold text-on-surface outline-none border border-primary"
                    />
                  ) : (
                    <h2 className="font-bold text-base text-on-surface flex items-center gap-2">
                      <Icon name="badge" className="text-primary text-[18px]" />
                      {role.name}
                    </h2>
                  )}

                  {isAdminRole ? (
                    <span className="rounded-md bg-success-light text-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-success/20">
                      Super-Administrateur
                    </span>
                  ) : (
                    <span className="rounded-md bg-surface text-on-surface-variant px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border border-outline-variant/30">
                      Profil Modifiable
                    </span>
                  )}

                  {dirty && !isAdminRole && (
                    <span className="rounded-md bg-primary-light text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-primary/20 animate-pulse">
                      Modifications en attente
                    </span>
                  )}

                  {isSaving && <Icon name="progress_activity" className="animate-spin text-[16px] text-primary" />}
                </div>

                {/* Actions de gestion du rôle */}
                {!isAdminRole && (
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <button
                      onClick={() => { setRenamingId(role.id); setRenameValue(role.name); }}
                      className="rounded-md border border-outline-variant px-2.5 py-1 text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                    >
                      Renommer
                    </button>
                    <button
                      onClick={() => setDeleteTarget(role)}
                      className="rounded-md border border-error/30 px-2.5 py-1 text-error hover:bg-error-container/20 transition-colors"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>

              {/* Contenu des habilitations */}
              {isAdminRole ? (
                <div className="flex items-center gap-3 text-xs font-medium text-success bg-success-light p-md rounded-md border border-success/20">
                  <Icon name="verified_user" className="text-[20px] flex-shrink-0" />
                  <p>
                    Ce rôle détient l'ensemble des privilèges système (<code className="bg-white/60 px-1 py-0.5 rounded-md font-mono font-bold">*</code>). Toutes les actions sur l'ensemble des modules sont accordées sans restriction.
                  </p>
                </div>
              ) : (
                <div className="space-y-md">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-outline-variant/30 text-on-surface-variant font-semibold uppercase tracking-wider bg-surface">
                          <th className="px-md py-2.5">Module Système</th>
                          {ACTIONS.map((act) => (
                            <th key={act.key} className="px-3 py-2.5 text-center font-bold">{act.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/15">
                        {MODULES.map((mod) => (
                          <tr key={mod.key} className="hover:bg-surface-container/20 transition-colors">
                            <td className="px-md py-2.5 font-semibold text-on-surface flex items-center gap-2">
                              <Icon name={mod.icon} className="text-[16px] text-on-surface-variant" />
                              <span>{mod.label}</span>
                            </td>
                            {ACTIONS.map((act) => {
                              const permissionKey = `${mod.key}.${act.key}`;
                              const isChecked = draftActions.includes(permissionKey);
                              return (
                                <td key={act.key} className="px-3 py-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleDraftPermission(role, permissionKey)}
                                    className="h-4 w-4 rounded-md accent-primary cursor-pointer align-middle"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Barre d'action d'enregistrement pour ce rôle */}
                  <AnimatePresence>
                    {dirty && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-surface border border-outline-variant/30 overflow-hidden"
                      >
                        <span className="text-xs text-on-surface-variant font-medium pl-1">
                          Des autorisations ont été modifiées pour <strong>{role.name}</strong>.
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleDiscard(role)}
                            className="rounded-md px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSavePermissions(role)}
                            className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-bold text-on-primary hover:bg-primary-dark transition-colors shadow-xs disabled:opacity-60 flex items-center gap-1.5"
                          >
                            <Icon name="save" className="text-[14px]" />
                            <span>{isSaving ? "Enregistrement..." : "Enregistrer"}</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation de suppression d'un rôle */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md"
            >
              <div className="flex items-center gap-2 text-error">
                <Icon name="warning" className="text-[20px]" />
                <h3 className="text-base font-bold text-on-surface">Supprimer le rôle "{deleteTarget.name}" ?</h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Les utilisateurs assignés à ce rôle perdront les permissions associées. Cette action est irréversible.
              </p>
              {deleteError && (
                <p className="rounded-md bg-error-container px-3 py-2 text-xs text-error font-semibold">
                  {deleteError}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                <button
                  onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                  className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded-md bg-error px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                >
                  Confirmer la suppression
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}