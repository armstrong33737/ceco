// packages/frontend/src/pages/Roles.jsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import { showToast } from "../store/toastStore";
import Icon from "../components/Icon";

const MODULES = [
  { key: "center", label: "Identité & Agrément du Centre", icon: "storefront" },
  { key: "formations", label: "Pédagogie, Filières & Matières", icon: "menu_book" },
  { key: "users", label: "Gestion des Comptes Utilisateurs", icon: "group" },
  { key: "roles", label: "Rôles & Habilitations RBAC", icon: "security" },
  { key: "students", label: "Dossiers des Apprenants", icon: "school" },
  { key: "grades", label: "Évaluations & Saisie des Notes", icon: "grade" },
  { key: "bulletins", label: "Bulletins, Relevés & Diplômes", icon: "description" },
  { key: "backups", label: "Sauvegardes & Restauration", icon: "archive" },
];

const ACTIONS = [
  { key: "read", label: "Consulter" },
  { key: "create", label: "Créer / Saisir" },
  { key: "update", label: "Modifier" },
  { key: "delete", label: "Supprimer" },
  { key: "validate", label: "Valider / Verrouiller" },
  { key: "generate", label: "Générer PDF" },
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
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [drafts, setDrafts] = useState({});

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch("/roles");
      setRoles(data || []);
      setDrafts(Object.fromEntries((data || []).map((r) => [r.id, actionsOf(r)])));
    } catch (err) {
      showToast(err.message || "Impossible de charger les rôles.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreateRole(e) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreating(true);
    try {
      const created = await apiFetch("/roles", {
        method: "POST",
        body: JSON.stringify({ name: newRoleName.trim(), permissions: [] }),
      });
      showToast(`Rôle ${created.name} créé avec succès.`, "success");
      setNewRoleName("");
      await load();
    } catch (err) {
      showToast(err.message || "Erreur lors de la création du rôle.", "error");
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
      showToast(`Permissions enregistrées pour le rôle ${role.name}.`, "success");
      await load();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'enregistrement.", "error");
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
      showToast(`Rôle renommé en ${renameValue}.`, "success");
      setRenamingId(null);
      await load();
    } catch (err) {
      showToast(err.message || "Erreur lors du renommage.", "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/roles/${deleteTarget.id}`, { method: "DELETE" });
      showToast(`Rôle ${deleteTarget.name} supprimé avec succès.`, "warning");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      showToast(err.message || "Impossible de supprimer ce rôle.", "error");
      setDeleteTarget(null);
    }
  }

  if (loading) return <p className="text-xs text-slate-500 font-medium p-6">Chargement de la matrice des habilitations...</p>;

  return (
    <div className="space-y-4">
      {/* En-tête informatif */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">Rôles &amp; Permissions RBAC</h1>
            <span className="badge-blue font-mono font-bold">{roles.length} rôles</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurez finement les accès modulaires. Le profil racine ("Admin") reste protégé par sécurité.
          </p>
        </div>

        {/* Formulaire de création de rôle */}
        <form onSubmit={handleCreateRole} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            placeholder="Nom du rôle (ex: Comptable)..."
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            className="input-field w-full sm:w-56"
          />
          <button
            type="submit"
            disabled={creating || !newRoleName.trim()}
            className="btn-primary shrink-0"
          >
            <Icon name="add" className="text-[16px]" />
            <span>Créer</span>
          </button>
        </form>
      </div>

      {/* Cartes des Rôles */}
      <div className="space-y-4">
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
              className={`bg-white rounded-lg p-4 shadow-card border transition-all ${
                dirty ? "border-blue-700 ring-1 ring-blue-700/30" : "border-slate-200"
              }`}
            >
              {/* En-tête du rôle */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {renamingId === role.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRename(role)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename(role)}
                      className="h-8 rounded bg-white px-2 text-xs font-bold text-slate-900 border border-blue-700 outline-none"
                    />
                  ) : (
                    <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Icon name="badge" className="text-blue-700 text-[18px]" />
                      <span>{role.name}</span>
                    </h2>
                  )}

                  {isAdminRole ? (
                    <span className="badge-emerald uppercase">
                      Super-Administrateur
                    </span>
                  ) : (
                    <span className="badge-slate uppercase">
                      Profil Modifiable
                    </span>
                  )}

                  {dirty && !isAdminRole && (
                    <span className="badge-amber animate-pulse">
                      Modifications en attente
                    </span>
                  )}

                  {isSaving && <Icon name="progress_activity" className="animate-spin text-[16px] text-blue-700" />}
                </div>

                {!isAdminRole && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => { setRenamingId(role.id); setRenameValue(role.name); }}
                      className="btn-secondary text-[11px] px-2.5 py-1"
                    >
                      Renommer
                    </button>
                    <button
                      onClick={() => setDeleteTarget(role)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Icon name="delete" className="text-[16px]" />
                    </button>
                  </div>
                )}
              </div>

              {/* Matrice RBAC */}
              {isAdminRole ? (
                <div className="flex items-center gap-2.5 text-xs text-emerald-800 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                  <Icon name="verified_user" className="text-[20px] text-emerald-600 shrink-0" />
                  <p>
                    Ce rôle détient l'ensemble des privilèges système (<code className="bg-white/80 px-1 py-0.2 rounded font-mono font-bold">*</code>). Toutes les opérations sont accordées sans restriction.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider bg-slate-50">
                          <th className="py-2.5 px-3">Module Système</th>
                          {ACTIONS.map((act) => (
                            <th key={act.key} className="py-2.5 px-3 text-center">{act.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {MODULES.map((mod) => (
                          <tr key={mod.key} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-800 flex items-center gap-2">
                              <Icon name={mod.icon} className="text-[16px] text-slate-500" />
                              <span>{mod.label}</span>
                            </td>
                            {ACTIONS.map((act) => {
                              const permissionKey = `${mod.key}.${act.key}`;
                              const isChecked = draftActions.includes(permissionKey);
                              return (
                                <td key={act.key} className="py-2 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleDraftPermission(role, permissionKey)}
                                    className="h-4 w-4 rounded accent-blue-700 cursor-pointer align-middle"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Barre d'enregistrement des modifications */}
                  <AnimatePresence>
                    {dirty && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden"
                      >
                        <span className="text-xs text-slate-700 font-medium pl-1">
                          Des autorisations ont été modifiées pour <strong>{role.name}</strong>.
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleDiscard(role)}
                            className="btn-secondary text-[11px]"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSavePermissions(role)}
                            className="btn-primary text-[11px]"
                          >
                            <Icon name="save" className="text-[14px]" />
                            <span>Enregistrer</span>
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

      {/* MODALE SUPPRESSION */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4"
            >
              <div className="flex items-center gap-2 text-rose-600 border-b border-slate-200 pb-2">
                <Icon name="warning" className="text-[20px]" />
                <h3 className="text-sm font-bold text-slate-900">Supprimer le rôle "{deleteTarget.name}" ?</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Les utilisateurs assignés à ce rôle perdront les permissions associées. Cette action est irréversible.
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  className="btn-primary bg-rose-600 hover:bg-rose-700"
                >
                  Confirmer la suppression
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}