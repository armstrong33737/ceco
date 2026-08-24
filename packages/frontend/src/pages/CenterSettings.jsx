// packages/frontend/src/pages/CenterSettings.jsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, apiFetchImageUrl } from "../lib/apiClient";
import Icon from "../components/Icon";

const EMPTY = {
  name: "", email: "", phone: "", hasLogo: false, hasSeal: true, isDefaultSeal: true,
  address: "", city: "", postalCode: "", country: "", website: "",
  registrationNumber: "", directorName: "", directorTitle: "", description: "",
};

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 border-b border-outline-variant/20 pb-3 mb-md">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-light text-primary flex-shrink-0">
        <Icon name={icon} className="text-[18px]" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-on-surface">{title}</h3>
        <p className="text-xs text-on-surface-variant">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, id, required = false, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {label} {required && <span className="text-error">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function CenterSettings() {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  // Logo du Centre
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [pendingLogoDataUrl, setPendingLogoDataUrl] = useState(null);

  // Sceau de la République
  const [sealPreviewUrl, setSealPreviewUrl] = useState(null);
  const [pendingSealDataUrl, setPendingSealDataUrl] = useState(null);

  // Signatures dynamiques et URLs d'aperçu fiables
  const [signatureRoles, setSignatureRoles] = useState([]);
  const [signatureStatusMap, setSignatureStatusMap] = useState({});
  const [signatureBlobUrls, setSignatureBlobUrls] = useState({});

  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [newRoleKey, setNewRoleKey] = useState("");

  async function loadCenter() {
    setStatus("loading");
    try {
      const [centerData, rolesData, sigsStatus] = await Promise.all([
        apiFetch("/center"),
        apiFetch("/center/signature-roles").catch(() => [
          { key: "directeur", title: "Directeur Général", desc: "Signature officielle de la Direction" },
          { key: "promoteur", title: "Promoteur / Fondateur", desc: "Signature officielle du Promoteur" },
        ]),
        apiFetch("/center/signatures").catch(() => ({})),
      ]);

      setForm({ ...EMPTY, ...centerData });
      setSignatureRoles(rolesData || []);
      setSignatureStatusMap(sigsStatus || {});

      // Chargement du Logo
      if (centerData.hasLogo) {
        const logoUrl = await apiFetchImageUrl("/center/logo");
        setLogoPreviewUrl(logoUrl);
      }

      // Chargement du Sceau (Personnalisé ou Défaut physique)
      const sealUrl = await apiFetchImageUrl("/center/seal");
      setSealPreviewUrl(sealUrl);

      // Chargement des aperçus réels de signatures existantes
      const blobMap = {};
      for (const role of rolesData) {
        if (sigsStatus && sigsStatus[role.key]) {
          const sigUrl = await apiFetchImageUrl(`/center/signatures/${role.key}`);
          if (sigUrl) blobMap[role.key] = sigUrl;
        }
      }
      setSignatureBlobUrls(blobMap);

      setStatus("idle");
    } catch (err) {
      setError(err.message || "Erreur de chargement des paramètres.");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadCenter();
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      if (sealPreviewUrl) URL.revokeObjectURL(sealPreviewUrl);
      Object.values(signatureBlobUrls).forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, []);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

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

  function handleRemoveLogo() {
    setPendingLogoDataUrl("");
    setLogoPreviewUrl(null);
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

  async function handleResetDefaultSeal() {
    try {
      await apiFetch("/center/seal/reset", { method: "POST" });
      setPendingSealDataUrl(null);
      await loadCenter();
    } catch (err) {
      setError(err.message);
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
        // Mise à jour immédiate de l'aperçu local
        setSignatureBlobUrls((prev) => ({ ...prev, [roleKey]: reader.result }));
        setSignatureStatusMap((prev) => ({ ...prev, [roleKey]: true }));
      } catch (err) {
        setError(err.message);
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
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddCustomRole(e) {
    e.preventDefault();
    if (!newRoleTitle.trim()) return;

    let safeKey = (newRoleKey || newRoleTitle).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!safeKey) safeKey = `role_${Date.now()}`;

    if (signatureRoles.some((r) => r.key === safeKey)) {
      setError("Un rôle portant cet identifiant existe déjà.");
      return;
    }

    const updatedRoles = [
      ...signatureRoles,
      { key: safeKey, title: newRoleTitle.trim(), desc: "Fonction officielle personnalisée" },
    ];

    try {
      await apiFetch("/center/signature-roles", {
        method: "PUT",
        body: JSON.stringify({ roles: updatedRoles }),
      });
      setSignatureRoles(updatedRoles);
      setNewRoleTitle("");
      setNewRoleKey("");
      setShowAddRoleModal(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteCustomRole(roleKey) {
    if (roleKey === "directeur" || roleKey === "promoteur") return;
    const updatedRoles = signatureRoles.filter((r) => r.key !== roleKey);
    try {
      await apiFetch("/center/signature-roles", {
        method: "PUT",
        body: JSON.stringify({ roles: updatedRoles }),
      });
      await handleDeleteSignature(roleKey);
      setSignatureRoles(updatedRoles);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      const payload = { ...form };
      delete payload.hasLogo;
      delete payload.hasSeal;
      delete payload.isDefaultSeal;

      if (pendingLogoDataUrl !== null) payload.logo = pendingLogoDataUrl;
      if (pendingSealDataUrl !== null) payload.seal = pendingSealDataUrl;

      const updated = await apiFetch("/center", { method: "PUT", body: JSON.stringify(payload) });
      setForm({ ...EMPTY, ...updated });
      setPendingLogoDataUrl(null);
      setPendingSealDataUrl(null);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  const inputClass = "h-10 sm:h-11 rounded-md bg-surface px-3.5 text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full";

  if (status === "loading") return <p className="text-sm text-on-surface-variant font-medium">Chargement des paramètres du centre...</p>;

  return (
    <motion.form
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onSubmit={handleSubmit}
      className="space-y-md max-w-5xl mx-auto"
    >
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-on-surface">Configuration de l'Établissement</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Dénomination légale, agrément ministériel, logos, sceau officiel et gestionnaire de signatures.
          </p>
        </div>
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-md bg-primary px-4 py-2.5 text-xs font-bold text-on-primary hover:bg-primary-dark transition-all disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-xs flex-shrink-0"
        >
          <Icon name="save" className="text-[16px]" />
          <span>{status === "saving" ? "Enregistrement..." : "Enregistrer"}</span>
        </button>
      </div>

      <AnimatePresence>
        {status === "saved" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-md bg-success-light p-md text-sm text-success flex items-center gap-2 border border-success/20 overflow-hidden"
          >
            <Icon name="check_circle" className="text-success text-[18px] flex-shrink-0" />
            <p className="text-xs font-semibold">Paramètres du centre et armoiries enregistrés avec succès.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Colonne Gauche : Logo & Sceau de la République (4 cols) */}
        <div className="space-y-md lg:col-span-4">
          {/* Logo du Centre */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs flex flex-col items-center text-center">
            <SectionHeader icon="photo_camera" title="Logo du Centre" subtitle="Identité visuelle de l'établissement" />
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-md bg-surface flex items-center justify-center overflow-hidden border border-outline-variant/30 relative mb-md shadow-inner">
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <Icon name="storefront" className="text-on-surface-variant/30 text-[40px]" />
              )}
            </div>
            <div className="flex flex-col gap-2 w-full">
              <label className="cursor-pointer rounded-md border border-outline-variant px-3 py-2 text-xs font-bold text-primary bg-white hover:bg-primary-light transition-all text-center shadow-xs">
                Changer le logo
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </label>
              {logoPreviewUrl && (
                <button type="button" onClick={handleRemoveLogo} className="text-xs font-semibold text-error hover:underline">
                  Supprimer le logo
                </button>
              )}
            </div>
          </div>

          {/* Sceau de la République */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs flex flex-col items-center text-center space-y-2">
            <SectionHeader icon="military_tech" title="Sceau de la République" subtitle="Armoiries officielles de l'État" />
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-md bg-surface flex items-center justify-center overflow-hidden border border-outline-variant/30 relative shadow-inner p-1">
              {sealPreviewUrl ? (
                <img src={sealPreviewUrl} alt="Sceau" className="w-full h-full object-contain" />
              ) : (
                <Icon name="shield" className="text-on-surface-variant/30 text-[40px]" />
              )}
            </div>

            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
              form.isDefaultSeal ? "bg-primary-light text-primary border border-primary/20" : "bg-success-light text-success border border-success/20"
            }`}>
              {form.isDefaultSeal ? "Sceau Officiel (Par défaut)" : "Sceau Personnalisé Actif"}
            </span>

            <div className="flex flex-col gap-2 w-full pt-1">
              <label className="cursor-pointer rounded-md border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary bg-white hover:bg-primary-light transition-all text-center shadow-xs">
                Téléverser un Sceau
                <input type="file" accept="image/*" onChange={handleSealChange} className="hidden" />
              </label>
              {!form.isDefaultSeal && (
                <button
                  type="button"
                  onClick={handleResetDefaultSeal}
                  className="text-xs font-semibold text-primary hover:underline flex items-center justify-center gap-1"
                >
                  <Icon name="restart_alt" className="text-[14px]" />
                  <span>Rétablir le Sceau par Défaut</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Colonne Droite : Identité, Agrément, Coordonnées & Signatures (8 cols) */}
        <div className="space-y-md lg:col-span-8">
          {/* Section 1 : Dénomination & Agrément */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs">
            <SectionHeader icon="business" title="Dénomination &amp; Agrément Légal" subtitle="Mentions requises sur les cartes, bulletins et diplômes" />
            <div className="space-y-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                <Field label="Nom officiel du centre" id="name" required>
                  <input id="name" required value={form.name} onChange={set("name")} className={inputClass} placeholder="Ex: Centre d'Excellence Professionnelle" />
                </Field>

                <Field label="N° d'Agrément / Arrêté Ministériel" id="registrationNumber">
                  <input
                    id="registrationNumber"
                    value={form.registrationNumber || ""}
                    onChange={set("registrationNumber")}
                    className={inputClass}
                    placeholder="Ex: N° 0042/MINEFOP/SG/DFOP/2024"
                  />
                </Field>
              </div>

              <Field label="Description / Devise de l'établissement" id="description">
                <textarea
                  id="description"
                  rows={2}
                  value={form.description || ""}
                  onChange={set("description")}
                  className={`${inputClass} h-auto py-2.5 resize-none`}
                  placeholder="Courte présentation ou devise apparaissant sur les documents officiels"
                />
              </Field>
            </div>
          </div>

          {/* Section 2 : Coordonnées & Localisation */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs">
            <SectionHeader icon="map" title="Coordonnées &amp; Localisation" subtitle="Adresse physique et contacts du centre" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <Field label="Email institutionnel" id="email">
                <input id="email" type="email" value={form.email || ""} onChange={set("email")} className={inputClass} placeholder="contact@centre.cm" />
              </Field>
              <Field label="Téléphone de contact" id="phone">
                <input id="phone" value={form.phone || ""} onChange={set("phone")} className={inputClass} placeholder="+237 600 000 000" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Adresse physique" id="address">
                  <input id="address" value={form.address || ""} onChange={set("address")} className={inputClass} placeholder="Quartier, Rue, Immeuble" />
                </Field>
              </div>
              <Field label="Ville" id="city">
                <input id="city" value={form.city || ""} onChange={set("city")} className={inputClass} placeholder="Ex: Bafoussam" />
              </Field>
              <Field label="Boîte Postale / Code Postal" id="postalCode">
                <input id="postalCode" value={form.postalCode || ""} onChange={set("postalCode")} className={inputClass} placeholder="Ex: B.P. 124" />
              </Field>
            </div>
          </div>

          {/* Section 3 : GESTIONNAIRE DE SIGNATURES (DIRECTEUR & PROMOTEUR PAR DÉFAUT) */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-light text-primary flex-shrink-0">
                  <Icon name="draw" className="text-[18px]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Signatures Officielles &amp; Cachets Scannés</h3>
                  <p className="text-xs text-on-surface-variant">Enregistrez les signatures des signataires pour vos modèles de documents.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddRoleModal(true)}
                className="px-3 py-1.5 rounded-md bg-primary-light border border-primary/20 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all shadow-2xs flex items-center gap-1 self-start sm:self-auto"
              >
                <Icon name="add" className="text-[16px]" />
                <span>+ Ajouter une Fonction</span>
              </button>
            </div>

            {/* Formulaire d'ajout d'une fonction personnalisée */}
            {showAddRoleModal && (
              <div className="p-3 bg-surface rounded-md border border-primary/30 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-primary uppercase">Ajouter un signataire officiel</span>
                  <button type="button" onClick={() => setShowAddRoleModal(false)} className="text-on-surface-variant"><Icon name="close" className="text-[16px]" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Intitulé officiel (ex: Président du Jury)"
                    value={newRoleTitle}
                    onChange={(e) => setNewRoleTitle(e.target.value)}
                    className="h-9 rounded bg-white px-2.5 text-xs border outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Code court (optionnel, ex: president_jury)"
                    value={newRoleKey}
                    onChange={(e) => setNewRoleKey(e.target.value)}
                    className="h-9 rounded bg-white px-2.5 text-xs font-mono border outline-none focus:border-primary"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAddRoleModal(false)} className="px-3 py-1 text-xs border rounded">Annuler</button>
                  <button type="button" onClick={handleAddCustomRole} className="px-3 py-1 text-xs font-bold bg-primary text-white rounded shadow-xs">Valider et Ajouter</button>
                </div>
              </div>
            )}

            {/* Liste des Signataires avec Prévisualisation Directe via Blob */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {signatureRoles.map((role) => {
                const isStored = Boolean(signatureStatusMap[role.key]);
                const previewImg = signatureBlobUrls[role.key];
                const isPreset = role.key === "directeur" || role.key === "promoteur";

                return (
                  <div key={role.key} className="p-3 rounded-md bg-surface border border-outline-variant/30 flex flex-col justify-between space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-on-surface flex items-center gap-1.5">
                          <span>{role.title}</span>
                          <span className="font-mono text-[9px] text-primary bg-primary-light px-1 py-0.2 rounded border border-primary/20">
                            {role.key}
                          </span>
                        </div>
                        <p className="text-[10px] text-on-surface-variant">{role.desc}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          isStored ? "bg-success-light text-success border border-success/20" : "bg-white text-on-surface-variant border border-outline-variant/30"
                        }`}>
                          {isStored ? "Enregistrée" : "Manquante"}
                        </span>
                        {!isPreset && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomRole(role.key)}
                            className="text-error hover:bg-error-container/20 p-0.5 rounded"
                            title="Supprimer ce rôle de signataire"
                          >
                            <Icon name="close" className="text-[14px]" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Cadre de Prévisualisation Fiable */}
                    <div className="w-full h-16 rounded bg-white border border-outline-variant/20 flex items-center justify-center overflow-hidden p-1 shadow-inner">
                      {previewImg ? (
                        <img
                          src={previewImg}
                          alt={role.title}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-on-surface-variant/40 italic flex items-center gap-1">
                          <Icon name="draw" className="text-[14px]" />
                          <span>Aucune signature téléversée</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-outline-variant/15">
                      <label className="cursor-pointer rounded border border-outline-variant px-2.5 py-1 text-[11px] font-bold text-primary bg-white hover:bg-primary-light transition-all shadow-2xs">
                        {isStored ? "Remplacer" : "Téléverser PNG"}
                        <input type="file" accept="image/png" onChange={(e) => handleSignatureUpload(role.key, e)} className="hidden" />
                      </label>

                      {isStored && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSignature(role.key)}
                          className="text-error text-[11px] font-semibold hover:underline flex items-center gap-0.5"
                        >
                          <Icon name="delete" className="text-[14px]" />
                          <span>Supprimer image</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.form>
  );
}