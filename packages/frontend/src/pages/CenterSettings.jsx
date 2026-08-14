import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, apiFetchImageUrl } from "../lib/apiClient";
import Icon from "../components/Icon";

const EMPTY = {
  name: "", email: "", phone: "", hasLogo: false,
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

function Field({ label, id, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function CenterSettings() {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [pendingLogoDataUrl, setPendingLogoDataUrl] = useState(null);

  useEffect(() => {
    setStatus("loading");
    apiFetch("/center")
      .then(async (data) => {
        setForm({ ...EMPTY, ...data });
        if (data.hasLogo) {
          const url = await apiFetchImageUrl("/center/logo");
          setLogoPreviewUrl(url);
        }
        setStatus("idle");
      })
      .catch((err) => {
        setError(err.message || "Erreur de connexion à l'établissement.");
        setStatus("error");
      });

    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
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

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      const payload = { ...form };
      delete payload.hasLogo;
      if (pendingLogoDataUrl !== null) payload.logo = pendingLogoDataUrl;

      const updated = await apiFetch("/center", { method: "PUT", body: JSON.stringify(payload) });
      setForm({ ...EMPTY, ...updated });
      setPendingLogoDataUrl(null);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  const inputClass = "h-10 sm:h-11 rounded-md bg-surface px-3.5 text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full";

  if (status === "loading") {
    return <p className="text-sm text-on-surface-variant font-medium">Chargement des données de l'établissement...</p>;
  }

  if (status === "error") {
    return (
      <div className="rounded-md bg-error-container p-md text-sm text-error border border-error/20">
        <p className="font-semibold">Erreur de chargement</p>
        <p className="text-xs mt-1">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-2 text-xs font-bold underline">Réessayer</button>
      </div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onSubmit={handleSubmit}
      className="space-y-md max-w-5xl mx-auto"
    >
      {/* En-tête descriptif */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-on-surface">Informations de l'établissement</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Configurez l'identité légale, le logo et les coordonnées figurant sur les documents officiels.
          </p>
        </div>
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-md bg-primary px-4 py-2.5 text-xs font-bold text-on-primary hover:bg-primary-dark transition-all disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-xs flex-shrink-0"
        >
          {status === "saving" ? (
            <>
              <Icon name="progress_activity" className="animate-spin text-[16px]" />
              <span>Enregistrement...</span>
            </>
          ) : (
            <>
              <Icon name="save" className="text-[16px]" />
              <span>Enregistrer</span>
            </>
          )}
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
            <p className="text-xs font-semibold">Les modifications ont été enregistrées avec succès.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        
        {/* Colonne Gauche : Identité visuelle et références */}
        <div className="space-y-md lg:col-span-1">
          {/* Logo Card */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs flex flex-col items-center text-center">
            <SectionHeader 
              icon="photo_camera" 
              title="Logo du centre" 
              subtitle="Format carré recommandé (PNG, SVG, JPG)" 
            />
            
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-md bg-surface flex items-center justify-center overflow-hidden border border-outline-variant/30 relative mb-md shadow-inner">
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Logo du centre" className="w-full h-full object-contain p-1" />
              ) : (
                <Icon name="storefront" className="text-on-surface-variant/30 text-[40px]" />
              )}
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className="cursor-pointer rounded-md border border-outline-variant px-3 py-2 text-xs font-bold text-primary bg-white hover:bg-primary-light transition-all text-center shadow-xs">
                Changer le logo
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoChange} className="hidden" />
              </label>
              {logoPreviewUrl && (
                <button type="button" onClick={handleRemoveLogo} className="text-xs font-semibold text-error hover:underline transition-all">
                  Supprimer le logo
                </button>
              )}
            </div>
          </div>

          {/* Numéro d'agrément */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs">
            <SectionHeader 
              icon="badge" 
              title="Références officielles" 
              subtitle="Enregistrement ministériel" 
            />
            <div className="space-y-md">
              <Field label="Numéro d'agrément / Arrêté" id="registrationNumber">
                <input id="registrationNumber" value={form.registrationNumber || ""} onChange={set("registrationNumber")} className={inputClass} placeholder="Ex: N° 0124/MINEFOP/SG/DFOP" />
              </Field>
              <Field label="Site internet" id="website">
                <input id="website" value={form.website || ""} onChange={set("website")} placeholder="https://votrecentre.cm" className={inputClass} />
              </Field>
            </div>
          </div>
        </div>

        {/* Colonne Droite : Informations Générales, Coordonnées & Direction */}
        <div className="space-y-md lg:col-span-2">
          {/* Informations générales */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs">
            <SectionHeader 
              icon="business" 
              title="Dénomination &amp; Présentation" 
              subtitle="Identité affichée sur les relevés et bulletins" 
            />
            <div className="space-y-md">
              <Field label="Nom officiel du centre" id="name">
                <input id="name" required value={form.name} onChange={set("name")} className={inputClass} placeholder="Nom complet de l'établissement" />
              </Field>
              <Field label="Description / Devise" id="description">
                <textarea
                  id="description"
                  rows={3}
                  value={form.description || ""}
                  onChange={set("description")}
                  placeholder="Courte présentation ou devise du centre, visible sur les en-têtes officiels."
                  className={`${inputClass} h-auto py-2.5 resize-none`}
                />
              </Field>
            </div>
          </div>

          {/* Coordonnées & Adresse */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs">
            <SectionHeader 
              icon="map" 
              title="Coordonnées &amp; Localisation" 
              subtitle="Contacts et adresse physique du campus" 
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <Field label="Email de contact" id="email">
                <input id="email" type="email" value={form.email || ""} onChange={set("email")} className={inputClass} placeholder="contact@centre.cm" />
              </Field>
              <Field label="Numéro de téléphone" id="phone">
                <input id="phone" value={form.phone || ""} onChange={set("phone")} className={inputClass} placeholder="Ex: +237 6XX XX XX XX" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Adresse physique" id="address">
                  <input id="address" value={form.address || ""} onChange={set("address")} className={inputClass} placeholder="Quartier, rue, face à..." />
                </Field>
              </div>
              <Field label="Ville" id="city">
                <input id="city" value={form.city || ""} onChange={set("city")} className={inputClass} placeholder="Ex: Bafoussam" />
              </Field>
              <Field label="Pays" id="country">
                <input id="country" value={form.country || ""} onChange={set("country")} className={inputClass} placeholder="Cameroun" />
              </Field>
            </div>
          </div>

          {/* Direction de l'établissement */}
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs">
            <SectionHeader 
              icon="assignment_ind" 
              title="Direction &amp; Signatures" 
              subtitle="Autorité signataire des attestations et PV" 
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <Field label="Nom du Directeur / de la Directrice" id="directorName">
                <input id="directorName" value={form.directorName || ""} onChange={set("directorName")} className={inputClass} placeholder="Prénom et Nom" />
              </Field>
              <Field label="Titre officiel" id="directorTitle">
                <input id="directorTitle" value={form.directorTitle || ""} onChange={set("directorTitle")} placeholder="Ex: Le Directeur Général" className={inputClass} />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </motion.form>
  );
}