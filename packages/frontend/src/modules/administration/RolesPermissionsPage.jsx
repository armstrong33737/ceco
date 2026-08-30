// packages/frontend/src/modules/administration/RolesPermissionsPage.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Badge from "../../design-system/primitives/Badge";
import Icon from "../../components/Icon";
import ConfirmDialog from "../../design-system/overlays/ConfirmDialog";

const MODULES = [
  { key: "center", label: "Identité & Agrément du Centre", icon: "storefront" },
  { key: "formations", label: "Pédagogie & Cursus", icon: "menu_book" },
  { key: "users", label: "Gestion des Comptes", icon: "group" },
  { key: "roles", label: "Rôles & Permissions", icon: "badge" },
  { key: "students", label: "Dossiers Apprenants", icon: "school" },
  { key: "grades", label: "Évaluations & Notes", icon: "grade" },
  { key: "bulletins", label: "Bulletins & Actes Officiels", icon: "receipt_long" },
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

function actionsOf(role) {
  return role.permissions.map((p) => (typeof p === "object" ? p.action : p));
}

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [drafts, setDrafts] = useState({});

  async function loadData() {
    try {
      const data = await apiFetch("/roles");
      setRoles(data || []);
      setDrafts(Object.fromEntries((data || []).map((r) => [r.id, actionsOf(r)])));
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreateRole(e) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/roles", { method: "POST", body: JSON.stringify({ name: newRoleName.trim(), permissions: [] }) });
      setNewRoleName("");
      showToast("Rôle créé avec succès.", "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCreating(false);
    }
  }

  function toggleDraft(role, permissionKey) {
    setDrafts((prev) => {
      const current = prev[role.id] || [];
      const next = current.includes(permissionKey)
        ? current.filter((p) => p !== permissionKey)
        : [...current, permissionKey];
      return { ...prev, [role.id]: next };
    });
  }

  async function handleSavePermissions(role) {
    setSavingRoleId(role.id);
    try {
      await apiFetch(`/roles/${role.id}`, { method: "PUT", body: JSON.stringify({ permissions: drafts[role.id] || [] }) });
      showToast(`Permissions mises à jour pour le rôle ${role.name}.`, "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingRoleId(null);
    }
  }

  async function confirmDeleteRole() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/roles/${deleteTarget.id}`, { method: "DELETE" });
      showToast("Rôle supprimé.", "info");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
      setDeleteTarget(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Sécurité • Contrôle d'Accès</Badge>}
        title="Rôles &amp; Habilitations (RBAC)"
        subtitle="Configurez finement les autorisations de lecture, saisie, modification et validation par profil"
        actions={
          <form onSubmit={handleCreateRole} className="flex items-center gap-2">
            <Input placeholder="Nom du nouveau rôle..." value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className="w-56" />
            <Button type="submit" variant="primary" icon="add" isLoading={creating}>Créer Rôle</Button>
          </form>
        }
      />

      <div className="space-y-6">
        {roles.map((role) => {
          const isAdminRole = actionsOf(role).includes("*") || role.name?.toLowerCase() === "admin" || role.name?.toLowerCase() === "administrateur";
          const draftActions = drafts[role.id] || actionsOf(role);

          return (
            <div key={role.id} className="p-6 rounded bg-surface border border-border shadow-xs space-y-4 dark:bg-surface-dark dark:border-border-dark">
              <div className="flex items-center justify-between border-b border-border pb-3 dark:border-border-dark">
                <div className="flex items-center gap-3">
                  <Icon name="badge" className="text-[20px] text-brand-900 dark:text-brand-500" />
                  <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans">{role.name}</h3>
                  <Badge variant={isAdminRole ? "success" : "brand"}>{isAdminRole ? "Super-Admin" : "Profil Modifiable"}</Badge>
                </div>
                {!isAdminRole && (
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleSavePermissions(role)} isLoading={savingRoleId === role.id}>
                      Enregistrer Habilitations
                    </Button>
                    <Button variant="tertiary" size="sm" icon="delete" className="text-error" onClick={() => setDeleteTarget(role)} />
                  </div>
                )}
              </div>

              {isAdminRole ? (
                <div className="p-4 rounded bg-success-subtle border border-success/30 text-success text-body-sm flex items-center gap-2 dark:bg-success-subtle-dark dark:text-success-dark">
                  <Icon name="verified_user" className="text-[18px]" />
                  <span>Ce profil détient l'ensemble des droits universels (*). Aucune restriction ne s'applique.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-body-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-border text-caption font-semibold uppercase text-ink-secondary dark:border-border-dark dark:text-ink-secondary-dark">
                        <th className="py-2.5">Module Système</th>
                        {ACTIONS.map((act) => (
                          <th key={act.key} className="py-2.5 text-center">{act.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border dark:divide-border-dark">
                      {MODULES.map((mod) => (
                        <tr key={mod.key} className="hover:bg-[#F5F7FA] dark:hover:bg-[#13263A]/40">
                          <td className="py-2.5 font-medium flex items-center gap-2 text-ink-primary dark:text-white">
                            <Icon name={mod.icon} className="text-[16px] text-ink-muted" />
                            <span>{mod.label}</span>
                          </td>
                          {ACTIONS.map((act) => {
                            const permissionKey = `${mod.key}.${act.key}`;
                            const isChecked = draftActions.includes(permissionKey);
                            return (
                              <td key={act.key} className="py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleDraft(role, permissionKey)}
                                  className="w-4 h-4 rounded-[2px] accent-brand-900 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteRole}
        title="Supprimer le rôle"
        description={`Supprimer le rôle "${deleteTarget?.name}" ?`}
      />
    </motion.div>
  );
}