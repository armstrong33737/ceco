// packages/frontend/src/modules/administration/RolesPermissionsPage.jsx
import React, { useEffect, useState, useMemo } from "react";
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
  { key: "formations", label: "Pédagogie, Filières & Cursus", icon: "menu_book" },
  { key: "users", label: "Gestion des Comptes Utilisateurs", icon: "group" },
  { key: "roles", label: "Rôles & Habilitations RBAC", icon: "badge" },
  { key: "students", label: "Dossiers & Registre Apprenants", icon: "school" },
  { key: "grades", label: "Évaluations, Notes & Bordereaux", icon: "grade" },
  { key: "bulletins", label: "Bulletins, Relevés & Diplômes", icon: "receipt_long" },
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

// Socles fonctionnels minimaux garantis des rôles système
const SYSTEM_ROLE_BASELINES = {
  "Admin": ["*"],
  "Directeur des Études": [
    "formations.read", "formations.create", "formations.update", "formations.delete",
    "grades.read", "grades.create", "grades.update", "grades.validate",
    "students.read", "bulletins.generate",
  ],
  "Secrétaire": [
    "students.read", "students.create", "students.update",
    "formations.read", "grades.read", "bulletins.generate",
  ],
  "Formateur": [
    "formations.read", "grades.read", "grades.create", "grades.update",
  ],
};

function actionsOf(role) {
  return (role.permissions || []).map((p) => (typeof p === "object" ? p.action : p));
}

function sameSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
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
      showToast("Nouveau rôle personnalisé créé avec succès.", "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCreating(false);
    }
  }

  function togglePermission(role, permissionKey) {
    const isSystemRole = Boolean(role.isSystem);
    const baseline = SYSTEM_ROLE_BASELINES[role.name] || [];

    // Règle d'augmentation : les permissions du socle de base ne peuvent pas être décochées
    if (isSystemRole && baseline.includes(permissionKey)) {
      showToast("Cette permission fait partie du socle système garanti et ne peut pas être retirée.", "info");
      return;
    }

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
      showToast(`Habilitations enregistrées pour le rôle ${role.name}.`, "success");
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
        subtitle="Configurez finement les autorisations de consultation, saisie, modification, validation et tirage PDF"
        actions={
          <form onSubmit={handleCreateRole} className="flex items-center gap-2">
            <Input placeholder="Nom du nouveau rôle..." value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className="w-56" />
            <Button type="submit" variant="primary" icon="add" isLoading={creating}>Créer Rôle</Button>
          </form>
        }
      />

      <div className="space-y-6">
        {roles.map((role) => {
          const isSystemRole = Boolean(role.isSystem);
          const isAdminRole = actionsOf(role).includes("*") || role.name?.toLowerCase() === "admin" || role.name?.toLowerCase() === "administrateur";
          const baseline = SYSTEM_ROLE_BASELINES[role.name] || [];
          const draftActions = drafts[role.id] || actionsOf(role);
          const hasChanges = !sameSet(draftActions, actionsOf(role));

          return (
            <div key={role.id} className={`p-6 rounded bg-surface border transition-colors shadow-xs space-y-4 dark:bg-surface-dark ${
              hasChanges ? "border-brand-700 dark:border-brand-500" : "border-border dark:border-border-dark"
            }`}>
              {/* En-tête du Rôle */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3 dark:border-border-dark">
                <div className="flex items-center gap-3">
                  <Icon name="badge" className="text-[20px] text-brand-900 dark:text-brand-500" />
                  <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans">{role.name}</h3>
                  <Badge variant={isAdminRole ? "success" : isSystemRole ? "brand" : "neutral"}>
                    {isAdminRole ? "Super-Admin Universel" : isSystemRole ? "Rôle Système Protégé" : "Rôle Personnalisé"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {hasChanges && !isAdminRole && (
                    <Button variant="primary" size="sm" icon="save" onClick={() => handleSavePermissions(role)} isLoading={savingRoleId === role.id}>
                      Enregistrer Modifications
                    </Button>
                  )}
                  {!isSystemRole && (
                    <Button variant="tertiary" size="sm" icon="delete" className="text-error" onClick={() => setDeleteTarget(role)} />
                  )}
                </div>
              </div>

              {/* Information UX : Règle d'Augmentation pour les Rôles Système */}
              {isSystemRole && !isAdminRole && (
                <div className="p-3.5 rounded bg-info-subtle border border-info/30 text-info text-body-sm flex items-start gap-2.5 dark:bg-info-subtle-dark dark:text-info-dark">
                  <Icon name="info" className="text-[18px] flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Socle Système Garanti &amp; Règle d'Augmentation</strong>
                    <span>
                      Ce rôle possède un socle fonctionnel de base verrouillé pour assurer son fonctionnement. Vous ne pouvez pas réduire ses droits vitaux, mais vous pouvez <strong>librement lui accorder de nouvelles permissions</strong> en cochant les cases additionnelles ci-dessous.
                    </span>
                  </div>
                </div>
              )}

              {/* Matrice des Habilitations */}
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
                            const isBaseline = isSystemRole && baseline.includes(permissionKey);

                            return (
                              <td key={act.key} className="py-2.5 text-center">
                                <label className="inline-flex items-center justify-center p-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isBaseline}
                                    onChange={() => togglePermission(role, permissionKey)}
                                    className={`w-4 h-4 rounded-[2px] accent-brand-900 transition-colors ${
                                      isBaseline ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                                    }`}
                                    title={isBaseline ? "Permission de base système verrouillée" : "Cocher pour accorder cette permission"}
                                  />
                                </label>
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
        title="Supprimer le rôle personnalisé"
        description={`Supprimer définitivement le rôle "${deleteTarget?.name}" ? Cette action est irréversible.`}
      />
    </motion.div>
  );
}