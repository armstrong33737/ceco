// packages/frontend/src/pages/CenterSettings.jsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, apiFetchImageUrl } from "../lib/apiClient";
import Icon from "../components/Icon";

const EMPTY = {
  name: "", email: "", phone: "", hasLogo: false, hasSeal: false,
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

  // Sceau de la République / Armoiries de l'État
  const [sealPreviewUrl, setSealPreviewUrl] = useState(null);
  const [pendingSealDataUrl, setPendingSealDataUrl] = useState(null);

  // Signatures scannées indexées par rôle
  const [signatures, setSignatures] = useState({});

  async function loadCenter() {
    setStatus("loading");
    try {
      const [data, sigs] = await Promise.all([
        apiFetch("/center"),
        apiFetch("/center/signatures").catch(() => ({})),
      ]);
      setForm({ ...EMPTY, ...data });
      setSignatures(sigs || {});

      if (data.hasLogo) {
        const logoUrl = await apiFetchImageUrl("/center/logo");
        setLogoPreviewUrl(logoUrl);
      }
      if (data.hasSeal) {
        const sealUrl = await apiFetchImageUrl("/center/seal");
        setSealPreviewUrl(sealUrl);
      }
      setStatus("idle");
    } catch (err) {
      setError(err.message || "Erreur de connexion à l'établissement.");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadCenter();
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      if (sealPreviewUrl) URL.revokeObjectURL(sealPreviewUrl);
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

  function handleRemoveSeal() {
    setPendingSealDataUrl("");
    setSealPreviewUrl(null);
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
        await loadCenter();
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleDeleteSignature(roleKey) {
    try {
      await apiFetch(`/center/signatures/${roleKey}`, { method: "DELETE" });
      await loadCenter();
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
            Dénomination légale, agrément ministériel, logos et autorités signataires des actes officiels.
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
            <p className="text-xs font-semibold">Paramètres du centre et agrément enregistrés avec succès.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        {/* Colonne Gauche : Logo, Sceau et Signatures */}
        <div className="space-y-md lg:col-span-1">
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
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs flex flex-col items-center text-center">
            <SectionHeader icon="military_tech" title="Sceau de la République" subtitle="Armoiries officielles de l'État" />
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-md bg-surface flex items-center justify-center overflow-hidden border border-outline-variant/30 relative mb-md shadow-inner">
              {sealPreviewUrl ? (
                <img src={sealPreviewUrl} alt="Sceau d'État" className="w-full h-full object-contain p-1" />
              ) : (
                <Icon name="shield" className="text-on-surface-variant/30 text-[40px]" />
              )}
            </div>
            <div className="flex flex-col gap-2 w-full">
              <label className="cursor-pointer rounded-md border border-outline-variant px-3 py-2 text-xs font-bold text-primary bg-white hover:bg-primary-light transition-all text-center shadow-xs">
                Téléverser le Sceau
                <input type="file" accept="image/*" onChange={handleSealChange} className="hidden" />
              </label>
              {sealPreviewUrl && (
                <button type="button" onClick={handleRemoveSeal} className="text-xs font-semibold text-error hover:underline">
                  Supprimer le sceau
                </button>
              )}
            </div>
          </div>

          {/* Signatures scannées */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-md">
            <SectionHeader icon="draw" title="Signatures &amp; Cachets" subtitle="Indexés par fonction officielle" />
            <div className="space-y-3 text-xs">
              {/* Directeur */}
              <div className="p-3 bg-surface rounded-md border border-outline-variant/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-on-surface">Signature Directeur</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${signatures.directeur ? "bg-success-light text-success" : "bg-surface text-on-surface-variant"}`}>
                    {signatures.directeur ? "Enregistrée" : "Absente"}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <label className="cursor-pointer rounded-md border border-outline-variant px-2.5 py-1 text-[11px] font-bold text-primary bg-white hover:bg-primary-light transition-all shadow-xs">
                    Téléverser
                    <input type="file" accept="image/png" onChange={(e) => handleSignatureUpload("directeur", e)} className="hidden" />
                  </label>
                  {signatures.directeur && (
                    <button type="button" onClick={() => handleDeleteSignature("directeur")} className="text-error text-[11px] font-semibold hover:underline">
                      Supprimer
                    </button>
                  )}
                </div>
              </div>

              {/* Directeur Pédagogique */}
              <div className="p-3 bg-surface rounded-md border border-outline-variant/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-on-surface">Directeur Pédagogique</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${signatures.directeur_pedagogique ? "bg-success-light text-success" : "bg-surface text-on-surface-variant"}`}>
                    {signatures.directeur_pedagogique ? "Enregistrée" : "Absente"}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <label className="cursor-pointer rounded-md border border-outline-variant px-2.5 py-1 text-[11px] font-bold text-primary bg-white hover:bg-primary-light transition-all shadow-xs">
                    Téléverser
                    <input type="file" accept="image/png" onChange={(e) => handleSignatureUpload("directeur_pedagogique", e)} className="hidden" />
                  </label>
                  {signatures.directeur_pedagogique && (
                    <button type="button" onClick={() => handleDeleteSignature("directeur_pedagogique")} className="text-error text-[11px] font-semibold hover:underline">
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne Droite : Identité, Agrément, Coordonnées & Direction */}
        <div className="space-y-md lg:col-span-2">
          {/* Section 1 : Dénomination & Agrément */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs">
            <SectionHeader icon="business" title="Dénomination &amp; Agrément Légal" subtitle="Mentions requises sur les cartes et attestations" />
            <div className="space-y-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                <Field label="Nom officiel du centre" id="name" required>
                  <input id="name" required value={form.name} onChange={set("name")} className={inputClass} placeholder="Ex: Centre d'Excellence Professionnelle" />
                </Field>

                {/* CHAMP AGRÉMENT */}
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
              <Field label="Pays" id="country">
                <input id="country" value={form.country || ""} onChange={set("country")} className={inputClass} placeholder="Ex: Cameroun" />
              </Field>
              <Field label="Site Web" id="website">
                <input id="website" value={form.website || ""} onChange={set("website")} className={inputClass} placeholder="https://moncentre.cm" />
              </Field>
            </div>
          </div>

          {/* Section 3 : Direction Légale */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs">
            <SectionHeader icon="assignment_ind" title="Direction &amp; Signatures Officielles" subtitle="Autorités signataires des actes émis" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <Field label="Nom complet du Directeur" id="directorName">
                <input id="directorName" value={form.directorName || ""} onChange={set("directorName")} className={inputClass} placeholder="Ex: Dr. TCHAKOUNTE Jean" />
              </Field>
              <Field label="Titre officiel du signataire" id="directorTitle">
                <input id="directorTitle" value={form.directorTitle || ""} onChange={set("directorTitle")} className={inputClass} placeholder="Ex: Le Directeur Général" />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </motion.form>
  );
}