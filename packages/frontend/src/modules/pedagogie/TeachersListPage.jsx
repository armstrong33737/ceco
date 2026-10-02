// packages/frontend/src/modules/pedagogie/TeachersListPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel } from "../../design-system/layout/Card";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Badge from "../../design-system/primitives/Badge";
import Modal from "../../design-system/overlays/Modal";
import ConfirmDialog from "../../design-system/overlays/ConfirmDialog";
import Icon from "../../components/Icon";

export default function TeachersListPage() {
  const [formateurs, setFormateurs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modales CRUD
  const [modal, setModal] = useState(null);
  const [accountModal, setAccountModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", specialite: "" });
  const [accountForm, setAccountForm] = useState({ email: "", password: "prof1234" });
  const [saving, setSaving] = useState(false);

  // Modale Importation CSV
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importReport, setImportReport] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  function load() {
    setLoading(true);
    apiFetch("/formateurs")
      .then((data) => setFormateurs(data || []))
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filteredFormateurs = useMemo(() => {
    if (!search.trim()) return formateurs;
    const q = search.toLowerCase();
    return formateurs.filter((f) =>
      `${f.firstName} ${f.lastName}`.toLowerCase().includes(q) ||
      (f.specialite || "").toLowerCase().includes(q) ||
      (f.phone || "").includes(q)
    );
  }, [formateurs, search]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal.mode === "edit") {
        await apiFetch(`/formateurs/${modal.item.id}`, { method: "PUT", body: JSON.stringify(form) });
        showToast("Enseignant mis à jour avec succès.", "success");
      } else {
        await apiFetch("/formateurs", { method: "POST", body: JSON.stringify(form) });
        showToast("Nouvel enseignant ajouté à l'annuaire.", "success");
      }
      setModal(null);
      load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAccount(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch(`/formateurs/${accountModal.id}/account`, {
        method: "POST",
        body: JSON.stringify(accountForm),
      });
      showToast(res.message, "success");
      setAccountModal(null);
      load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function handleCsvFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        setImportError("Fichier CSV vide ou invalide.");
        return;
      }
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/[;,]/).map((p) => p.replace(/^"|"$/g, "").trim());
        if (parts.length >= 2) {
          parsed.push({
            lastName: parts[0] || "",
            firstName: parts[1] || "",
            specialite: parts[2] || "",
            phone: parts[3] || "",
            email: parts[4] || "",
          });
        }
      }
      setImportRows(parsed);
      setImportReport(null);
      setImportError(null);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleExecuteImport(e) {
    e.preventDefault();
    if (importRows.length === 0) {
      setImportError("Veuillez sélectionner un fichier CSV valide.");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const res = await apiFetch("/formateurs/import", {
        method: "POST",
        body: JSON.stringify({ formateurs: importRows }),
      });
      setImportReport(res);
      showToast(res.message, "success");
      load();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function confirmDeleteTeacher() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/formateurs/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast("Enseignant supprimé.", "info");
      load();
    } catch (err) {
      showToast(err.message, "error");
      setDeleteTarget(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Pédagogie • Corps Professoral</Badge>}
        title="Annuaire des Formateurs &amp; Enseignants"
        subtitle="Gestion des enseignants, suivi des cours attribués et génération de comptes d'accès pour la saisie des notes"
        actions={
          <>
            <Button
              variant="secondary"
              icon="upload_file"
              onClick={() => {
                setImportRows([]);
                setImportReport(null);
                setImportError(null);
                setShowImport(true);
              }}
            >
              Importer CSV
            </Button>
            <Button
              variant="primary"
              icon="person_add"
              onClick={() => {
                setForm({ firstName: "", lastName: "", email: "", phone: "", specialite: "" });
                setModal({ mode: "create" });
              }}
            >
              Nouveau Formateur
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface p-4 rounded border border-border shadow-xs dark:bg-surface-dark dark:border-border-dark">
        <div>
          <h3 className="text-body-md font-semibold text-ink-primary dark:text-white">Effectif Enseignant</h3>
          <p className="text-caption text-ink-muted">Total : {formateurs.length} enseignant(s) répertorié(s).</p>
        </div>

        <Input
          placeholder="Rechercher formateur..."
          value={search}
          leftIcon="search"
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      {loading ? (
        <p className="p-8 text-caption text-ink-muted text-center">Chargement des formateurs...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFormateurs.map((f) => (
            <StructuredPanel
              key={f.id}
              title={`${f.lastName} ${f.firstName}`}
              subtitle={f.specialite || "Formateur"}
              icon="badge"
              headerAction={
                f.user ? (
                  <Badge variant="success" withDot>Compte Actif</Badge>
                ) : (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => {
                      setAccountForm({ email: f.email || `${f.firstName.toLowerCase()}.${f.lastName.toLowerCase()}@ceco.local`, password: "prof1234" });
                      setAccountModal(f);
                    }}
                  >
                    + Créer Accès
                  </Button>
                )
              }
              footer={
                <div className="flex items-center justify-between">
                  <span className="font-mono text-caption text-brand-900 dark:text-brand-500">{f._count?.offerings || 0} cours dispensé(s)</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setForm({ firstName: f.firstName, lastName: f.lastName, email: f.email || "", phone: f.phone || "", specialite: f.specialite || "" });
                        setModal({ mode: "edit", item: f });
                      }}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      icon="delete"
                      className="text-error"
                      onClick={() => setDeleteTarget(f)}
                    />
                  </div>
                </div>
              }
            >
              <div className="space-y-1.5 text-body-sm text-ink-secondary font-mono dark:text-ink-secondary-dark">
                <p>Tél : {f.phone || "—"}</p>
                <p>Email : {f.email || "—"}</p>
              </div>
            </StructuredPanel>
          ))}
        </div>
      )}

      {/* Modale Compte 1 Clic */}
      <Modal
        isOpen={Boolean(accountModal)}
        onClose={() => setAccountModal(null)}
        title={`Générer le Compte : ${accountModal?.firstName} ${accountModal?.lastName}`}
        icon="key"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAccountModal(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleCreateAccount} isLoading={saving}>Créer le Compte</Button>
          </>
        }
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <Input
            required
            label="Identifiant de Connexion (Email)"
            value={accountForm.email}
            onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
          />
          <Input
            required
            label="Mot de passe provisoire"
            value={accountForm.password}
            onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
          />
        </form>
      </Modal>

      {/* Modale Création / Édition */}
      <Modal
        isOpen={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Modifier le Formateur" : "Nouveau Formateur"}
        icon="badge"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={saving}>Enregistrer</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input required label="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <Input required label="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <Input label="Spécialité / Discipline" placeholder="Ex: Froid & Climatisation" value={form.specialite} onChange={(e) => setForm({ ...form, specialite: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input type="email" label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </form>
      </Modal>

      {/* Modale Importation CSV */}
      <Modal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Importer des Enseignants par Fichier CSV"
        subtitle="Colonnes attendues : Nom; Prenom; Specialite; Telephone; Email"
        icon="upload_file"
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImport(false)}>Fermer</Button>
            <Button variant="primary" onClick={handleExecuteImport} isLoading={importing} disabled={importRows.length === 0}>
              Lancer l'Importation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-6 border-2 border-dashed border-border rounded text-center bg-[#F5F7FA] space-y-2 dark:bg-[#07111D] dark:border-border-dark">
            <Icon name="file_upload" className="text-3xl text-brand-900 dark:text-brand-500" />
            <p className="text-body-md font-semibold text-ink-primary dark:text-white">Sélectionner un fichier CSV</p>
            <p className="text-caption text-ink-muted">Colonnes attendues : Nom; Prenom; Specialite; Telephone; Email</p>
            <input type="file" accept=".csv,text/csv" onChange={handleCsvFileSelect} className="text-caption mx-auto pt-2" />
          </div>

          {importRows.length > 0 && !importReport && (
            <Badge variant="brand">{importRows.length} enseignant(s) détecté(s) prêt(s) pour l'import</Badge>
          )}

          {importReport && (
            <div className="p-4 rounded bg-surface border border-border space-y-2 text-body-sm dark:bg-surface-dark dark:border-border-dark">
              <div className="font-semibold text-success flex items-center gap-1.5">
                <Icon name="check_circle" className="text-[18px]" />
                <span>{importReport.createdCount} enseignant(s) importé(s) sur {importReport.totalCount} lignes.</span>
              </div>
              {importReport.errors?.length > 0 && (
                <div className="space-y-1 text-error text-caption">
                  <p className="font-bold">{importReport.errors.length} anomalie(s) détectée(s) :</p>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto font-mono">
                    {importReport.errors.map((err, i) => (
                      <li key={i}>Ligne {err.row} : {err.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {importError && (
            <p className="rounded bg-error-subtle p-3 text-error border border-error/30 text-caption font-medium">{importError}</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteTeacher}
        title="Supprimer le formateur"
        description={`Supprimer définitivement "${deleteTarget?.firstName} ${deleteTarget?.lastName}" de l'annuaire ?`}
      />
    </motion.div>
  );
}