// packages/frontend/src/modules/administration/UsersManagementPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Select from "../../design-system/primitives/Select";
import Badge from "../../design-system/primitives/Badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "../../design-system/data-grid/Table";
import Modal from "../../design-system/overlays/Modal";
import ConfirmDialog from "../../design-system/overlays/ConfirmDialog";

export default function UsersManagementPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: "", lastName: "", email: "", password: "", roleId: "" });
  const [editingUser, setEditingUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [uData, rData] = await Promise.all([
        apiFetch("/users"),
        apiFetch("/roles").catch(() => []),
      ]);
      setUsers(uData || []);
      setRoles(rData || []);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

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
    setSaving(true);
    try {
      await apiFetch("/users", { method: "POST", body: JSON.stringify(createForm) });
      setCreateForm({ firstName: "", lastName: "", email: "", password: "", roleId: "" });
      setShowCreate(false);
      showToast("Compte utilisateur créé avec succès.", "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSaving(true);
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
      showToast("Compte mis à jour.", "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
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
      showToast("Mot de passe réinitialisé avec succès.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleToggleActive(u) {
    try {
      await apiFetch(`/users/${u.id}`, { method: "PUT", body: JSON.stringify({ isActive: !u.isActive }) });
      showToast(u.isActive ? "Compte désactivé." : "Compte activé.", "info");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/users/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast("Compte utilisateur désactivé et archivé.", "info");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
      setDeleteTarget(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Administration • Sécurité</Badge>}
        title="Comptes Utilisateurs &amp; Accès"
        subtitle="Gestion des agents administratifs, enseignants et droits de connexion à l'ERP"
        actions={
          <Button variant="primary" icon="person_add" onClick={() => setShowCreate(true)}>
            Nouvel Utilisateur
          </Button>
        }
      />

      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-border-dark">
          <div>
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Annuaire des Utilisateurs</h3>
            <p className="text-caption text-ink-muted">Suivi des comptes actifs et des rôles système attribués.</p>
          </div>
          <Input placeholder="Rechercher utilisateur..." value={search} leftIcon="search" onChange={(e) => setSearch(e.target.value)} className="w-64" />
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nom &amp; Prénom</TableHeaderCell>
              <TableHeaderCell>Identifiant / Email</TableHeaderCell>
              <TableHeaderCell>Rôle Système</TableHeaderCell>
              <TableHeaderCell className="w-28">État</TableHeaderCell>
              <TableHeaderCell align="right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-semibold text-ink-primary dark:text-white">{u.firstName} {u.lastName}</TableCell>
                <TableCell className="font-mono text-caption text-ink-secondary dark:text-ink-secondary-dark">{u.email}</TableCell>
                <TableCell><Badge variant="brand">{u.role?.name || "Sans rôle"}</Badge></TableCell>
                <TableCell><Badge variant={u.isActive ? "success" : "error"} withDot>{u.isActive ? "Actif" : "Désactivé"}</Badge></TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => setEditingUser({ id: u.id, firstName: u.firstName, lastName: u.lastName, roleId: u.role?.id || "" })}>Modifier</Button>
                    <Button variant="tertiary" size="sm" onClick={() => setPasswordUser({ id: u.id, name: `${u.firstName} ${u.lastName}` })}>Mot de passe</Button>
                    <Button variant="tertiary" size="sm" onClick={() => handleToggleActive(u)}>{u.isActive ? "Désactiver" : "Activer"}</Button>
                    <Button variant="tertiary" size="sm" icon="delete" className="text-error" onClick={() => setDeleteTarget({ id: u.id, name: `${u.firstName} ${u.lastName}` })} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Créer un Compte Utilisateur"
        icon="person_add"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleCreate} isLoading={saving}>Créer le Compte</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input required label="Prénom" value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} />
            <Input required label="Nom" value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} />
          </div>
          <Input required type="email" label="Email de connexion" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
          <Input required type="password" minLength={8} label="Mot de passe provisoire" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
          <Select label="Rôle système" value={createForm.roleId} onChange={(e) => setCreateForm({ ...createForm, roleId: e.target.value })}>
            <option value="">Aucun rôle spécifique</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title="Modifier l'Utilisateur"
        icon="edit"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingUser(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleSaveEdit} isLoading={saving}>Enregistrer</Button>
          </>
        }
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input required label="Prénom" value={editingUser?.firstName || ""} onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })} />
            <Input required label="Nom" value={editingUser?.lastName || ""} onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })} />
          </div>
          <Select label="Rôle système" value={editingUser?.roleId || ""} onChange={(e) => setEditingUser({ ...editingUser, roleId: e.target.value })}>
            <option value="">Aucun rôle spécifique</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(passwordUser)}
        onClose={() => setPasswordUser(null)}
        title={`Réinitialiser Mot de Passe : ${passwordUser?.name}`}
        icon="key"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPasswordUser(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleSavePassword}>Mettre à Jour</Button>
          </>
        }
      >
        <form onSubmit={handleSavePassword} className="space-y-4">
          <Input required type="password" minLength={8} label="Nouveau mot de passe" placeholder="8 caractères min." value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteUser}
        title="Désactiver le compte utilisateur"
        description={`Désactiver l'accès pour ${deleteTarget?.name} ?`}
      />
    </motion.div>
  );
}