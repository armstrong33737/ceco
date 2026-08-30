// packages/frontend/src/modules/administration/CenterIdentityPage.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch, apiFetchImageUrl } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel } from "../../design-system/layout/Card";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Textarea from "../../design-system/primitives/Textarea";
import Badge from "../../design-system/primitives/Badge";
import Modal from "../../design-system/overlays/Modal";
import Icon from "../../components/Icon";

const EMPTY_CENTER = {
  name: "", email: "", phone: "", hasLogo: false, hasSeal: true, isDefaultSeal: true,
  address: "", city: "", postalCode: "", country: "", website: "",
  registrationNumber: "", directorName: "", directorTitle: "", description: "",
};

export default function CenterIdentityPage() {
  const [form, setForm] = useState(EMPTY_CENTER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Logo & Sceau
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [pendingLogoDataUrl, setPendingLogoDataUrl] = useState(null);
  const [sealPreviewUrl, setSealPreviewUrl] = useState(null);
  const [pendingSealDataUrl, setPendingSealDataUrl] = useState(null);

  // Signatures
  const [signatureRoles, setSignatureRoles] = useState([]);
  const [signatureStatusMap, setSignatureStatusMap] = useState({});
  const [signatureBlobUrls, setSignatureBlobUrls] = useState({});
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [newRoleKey, setNewRoleKey] = useState("");

  async function loadCenterData() {
    setLoading(true);
    try {
      const [centerData, rolesData, sigsStatus] = await Promise.all([
        apiFetch("/center"),
        apiFetch("/center/signature-roles").catch(() => [
          { key: "directeur", title: "Directeur Général", desc: "Signature officielle de la Direction" },
          { key: "promoteur", title: "Promoteur / Fondateur", desc: "Signature officielle du Promoteur" },
        ]),
        apiFetch("/center/signatures").catch(() => ({})),
      ]);

      setForm({ ...EMPTY_CENTER, ...centerData });
      setSignatureRoles(rolesData || []);
      setSignatureStatusMap(sigsStatus || {});

      if (centerData.hasLogo) {
        const logoUrl = await apiFetchImageUrl("/center/logo");
        setLogoPreviewUrl(logoUrl);
      }

      const sealUrl = await apiFetchImageUrl("/center/seal");
      setSealPreviewUrl(sealUrl);

      const blobMap = {};
      for (const role of rolesData) {
        if (sigsStatus && sigsStatus[role.key]) {
          const sigUrl = await apiFetchImageUrl(`/center/signatures/${role.key}`);
          if (sigUrl) blobMap[role.key] = sigUrl;
        }
      }
      setSignatureBlobUrls(blobMap);
    } catch (err) {
      showToast(err.message || "Erreur de chargement des paramètres.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCenterData(); }, []);

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingLogoDataUrl(reader.result);
      setLogoPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleSealChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingSealDataUrl(reader.result);
      setSealPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleResetSeal() {
    try {
      await apiFetch("/center/seal/reset", { method: "POST" });
      setPendingSealDataUrl(null);
      showToast("Sceau de la République par défaut rétabli.", "success");
      await loadCenterData();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleSignatureUpload(roleKey, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await apiFetch("/center/signatures", {
          method: "POST",
          body: JSON.stringify({ roleKey, signatureDataUrl: reader.result }),
        });
        setSignatureBlobUrls((prev) => ({ ...prev, [roleKey]: reader.result }));
        setSignatureStatusMap((prev) => ({ ...prev, [roleKey]: true }));
        showToast("Signature scannée enregistrée.", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleDeleteSignature(roleKey) {
    try {
      await apiFetch(`/center/signatures/${roleKey}`, { method: "DELETE" });
      setSignatureStatusMap((prev) => ({ ...prev, [roleKey]: false }));
      setSignatureBlobUrls((prev) => {
        const next = { ...prev };
        delete next[roleKey];
        return next;
      });
      showToast("Signature retirée.", "info");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleAddCustomRole(e) {
    e.preventDefault();
    if (!newRoleTitle.trim()) return;

    let safeKey = (newRoleKey || newRoleTitle).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (signatureRoles.some((r) => r.key === safeKey)) {
      showToast("Cette fonction existe déjà.", "warning");
      return;
    }

    const updated = [...signatureRoles, { key: safeKey, title: newRoleTitle.trim(), desc: "Fonction officielle" }];
    try {
      await apiFetch("/center/signature-roles", { method: "PUT", body: JSON.stringify({ roles: updated }) });
      setSignatureRoles(updated);
      setNewRoleTitle("");
      setNewRoleKey("");
      setShowAddRoleModal(false);
      showToast("Fonction signataire ajoutée.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.hasLogo;
      delete payload.hasSeal;
      delete payload.isDefaultSeal;

      if (pendingLogoDataUrl !== null) payload.logo = pendingLogoDataUrl;
      if (pendingSealDataUrl !== null) payload.seal = pendingSealDataUrl;

      const updated = await apiFetch("/center", { method: "PUT", body: JSON.stringify(payload) });
      setForm({ ...EMPTY_CENTER, ...updated });
      setPendingLogoDataUrl(null);
      setPendingSealDataUrl(null);
      showToast("Paramètres et armoiries du centre enregistrés avec succès.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Administration • Identité Légale</Badge>}
        title="Configuration de l'Établissement"
        subtitle="Dénomination légale, agrément ministériel (MINEFOP), armoiries, Sceau d'État et signatures"
        actions={
          <Button variant="primary" icon="save" onClick={handleSubmit} isLoading={saving}>
            Enregistrer les Paramètres
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Gauche : Logo & Sceau (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <StructuredPanel title="Logo Officiel" subtitle="Identité visuelle du centre" icon="photo_camera">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-28 h-28 rounded bg-[#F5F7FA] border border-border flex items-center justify-center overflow-hidden p-1 shadow-inner dark:bg-[#07111D] dark:border-border-dark">
                {logoPreviewUrl ? (
                  <img src={logoPreviewUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Icon name="storefront" className="text-3xl text-ink-muted" />
                )}
              </div>
              <label className="cursor-pointer inline-flex items-center justify-center font-sans font-medium rounded select-none transition-colors h-[32px] px-3 text-caption gap-1.5 border border-border bg-surface text-ink-primary hover:bg-[#F5F7FA] dark:bg-surface-dark dark:border-border-dark dark:text-white">
                <Icon name="upload" className="text-[16px]" />
                <span>Changer Logo</span>
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </label>
            </div>
          </StructuredPanel>

          <StructuredPanel title="Sceau de la République" subtitle="Armoiries officielles de l'État" icon="military_tech">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-28 h-28 rounded bg-[#F5F7FA] border border-border flex items-center justify-center overflow-hidden p-1 shadow-inner dark:bg-[#07111D] dark:border-border-dark">
                {sealPreviewUrl ? (
                  <img src={sealPreviewUrl} alt="Sceau" className="w-full h-full object-contain" />
                ) : (
                  <Icon name="shield" className="text-3xl text-ink-muted" />
                )}
              </div>
              <Badge variant={form.isDefaultSeal ? "brand" : "success"}>
                {form.isDefaultSeal ? "Sceau Officiel (Par défaut)" : "Sceau Personnalisé"}
              </Badge>
              <div className="flex gap-2">
                <label className="cursor-pointer inline-flex items-center justify-center font-sans font-medium rounded select-none transition-colors h-[32px] px-3 text-caption gap-1.5 border border-border bg-surface text-ink-primary hover:bg-[#F5F7FA] dark:bg-surface-dark dark:border-border-dark dark:text-white">
                  <span>Téléverser</span>
                  <input type="file" accept="image/*" onChange={handleSealChange} className="hidden" />
                </label>
                {!form.isDefaultSeal && (
                  <Button variant="tertiary" size="sm" icon="restart_alt" onClick={handleResetSeal}>
                    Rétablir Défaut
                  </Button>
                )}
              </div>
            </div>
          </StructuredPanel>
        </div>

        {/* Colonne Droite : Coordonnées, Agrément & Signatures (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <StructuredPanel title="Dénomination &amp; Agrément Ministériel" subtitle="Mentions inscrites sur les actes officiels et diplômes" icon="business">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input required label="Nom officiel du centre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Centre d'Excellence Professionnelle" />
                <Input label="N° d'Arrêté / Agrément Ministériel" value={form.registrationNumber || ""} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="Ex: N° 0042/MINEFOP/SG/DFOP" />
              </div>
              <Textarea label="Description / Devise de l'établissement" rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Devise ou mentions légales d'en-tête" />
            </div>
          </StructuredPanel>

          <StructuredPanel title="Coordonnées &amp; Localisation" subtitle="Adresse physique et contacts du centre" icon="map">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Email institutionnel" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@centre.cm" />
              <Input label="Téléphone officiel" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XXXXXXXX" />
              <div className="sm:col-span-2">
                <Input label="Adresse physique" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Quartier, Rue, Immeuble" />
              </div>
              <Input label="Ville" value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ex: Bafoussam" />
              <Input label="Boîte Postale" value={form.postalCode || ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="Ex: B.P. 124" />
            </div>
          </StructuredPanel>

          {/* Signatures Scannées */}
          <StructuredPanel
            title="Signatures Scannées &amp; Cachets Numérisés"
            subtitle="Signatures apposées automatiquement en pied de page des bulletins et diplômes"
            icon="draw"
            headerAction={
              <Button variant="tertiary" size="sm" icon="add" onClick={() => setShowAddRoleModal(true)}>
                Ajouter Fonction
              </Button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {signatureRoles.map((role) => {
                const isStored = Boolean(signatureStatusMap[role.key]);
                const previewImg = signatureBlobUrls[role.key];

                return (
                  <div key={role.key} className="p-3.5 rounded bg-[#F5F7FA] border border-border flex flex-col justify-between space-y-2 dark:bg-[#07111D] dark:border-border-dark">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-body-sm text-ink-primary dark:text-white block">{role.title}</span>
                        <span className="font-mono text-[10px] text-ink-muted">Code : {role.key}</span>
                      </div>
                      <Badge variant={isStored ? "success" : "neutral"}>{isStored ? "Active" : "Absente"}</Badge>
                    </div>

                    <div className="w-full h-16 rounded bg-surface border border-border flex items-center justify-center overflow-hidden p-1 shadow-inner dark:bg-surface-dark dark:border-border-dark">
                      {previewImg ? (
                        <img src={previewImg} alt={role.title} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-caption text-ink-muted italic">Aucune signature</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border-dark">
                      <label className="cursor-pointer inline-flex items-center justify-center font-sans font-medium rounded select-none transition-colors h-[28px] px-2.5 text-[11px] gap-1 border border-border bg-surface text-ink-primary hover:bg-[#FAFBFD] dark:bg-surface-dark dark:border-border-dark dark:text-white">
                        <span>{isStored ? "Remplacer" : "Téléverser"}</span>
                        <input type="file" accept="image/png" onChange={(e) => handleSignatureUpload(role.key, e)} className="hidden" />
                      </label>
                      {isStored && (
                        <button type="button" onClick={() => handleDeleteSignature(role.key)} className="text-caption text-error hover:underline">
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </StructuredPanel>
        </div>
      </div>

      <Modal
        isOpen={showAddRoleModal}
        onClose={() => setShowAddRoleModal(false)}
        title="Ajouter une Fonction Signataire"
        icon="draw"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddRoleModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleAddCustomRole}>Ajouter</Button>
          </>
        }
      >
        <form onSubmit={handleAddCustomRole} className="space-y-4">
          <Input required label="Intitulé officiel (ex: Le Président du Jury)" value={newRoleTitle} onChange={(e) => setNewRoleTitle(e.target.value)} />
          <Input label="Code court (optionnel, ex: president_jury)" value={newRoleKey} onChange={(e) => setNewRoleKey(e.target.value)} />
        </form>
      </Modal>
    </motion.div>
  );
}