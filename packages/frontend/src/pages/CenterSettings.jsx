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
    <div className="flex items-center gap-3 border-b border-outline-variant/20 pb-4 mb-lg">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-primary/10 to-violet/10 text-primary">
        <Icon name={icon} className="text-[20px]" />
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

  const inputClass = "h-11 rounded-md bg-surface px-4 text-sm text-on-surface outline-none border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary transition-all";

  if (status === "loading") {
    return <p className="text-sm text-on-surface-variant font-medium">Chargement des données de l'établissement...</p>;
  }

  if (status === "error") {
    return (
      <div className="rounded-md bg-error-container p-md text-sm text-error">
        <p className="font-semibold">Erreur de chargement</p>
        <p className="text-xs mt-1">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-2 text-xs font-bold underline">Réessayer</button>
      </div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className="max-w-4xl flex flex-col gap-md"
    >
      {status === "saved" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-md bg-success-light p-md text-sm text-success flex items-start gap-2 border border-success/20"
        >
          <Icon name="check_circle" className="text-success text-[20px] flex-shrink-0" />
          <p className="text-xs font-semibold">Les modifications ont été enregistrées avec succès dans la base de données locale.</p>
        </motion.div>
      )}

      {error && (
        <div className="rounded-md bg-error-container p-md text-sm text-error border border-error/20">
          <p className="font-semibold">Erreur détectée</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        
        {/* Colonne gauche : Logo et informations d'identification */}
        <div className="lg:col-span-1 flex flex-col gap-md">
          
          {/* Logo Card */}
          <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex flex-col items-center text-center">
            <SectionHeader 
              icon="photo_camera" 
              title="Logo officiel" 
              subtitle="Format carré recommandé" 
            />
            
            <div className="w-32 h-32 rounded-md bg-surface flex items-center justify-center overflow-hidden border border-outline-variant/30 relative group shadow-inner mb-md">
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Logo du centre" className="w-full h-full object-contain" />
              ) : (
                <Icon name="storefront" className="text-on-surface-variant/30 text-[48px]" />
              )}
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className="cursor-pointer rounded-md border border-outline-variant px-4 py-2 text-xs font-bold text-primary bg-white hover:bg-primary-light transition-all text-center shadow-xs">
                Changer le logo
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoChange} className="hidden" />
              </label>
              {logoPreviewUrl && (
                <button type="button" onClick={handleRemoveLogo} className="text-xs font-semibold text-error hover:underline transition-all">
                  Retirer l'image
                </button>
              )}
            </div>
          </div>

          {/* Numéro de registre Card */}
          <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30">
            <SectionHeader 
              icon="badge" 
              title="Agréments" 
              subtitle="Références officielles" 
            />
            <div className="flex flex-col gap-md">
              <Field label="Numéro d'agrément" id="registrationNumber">
                <input id="registrationNumber" value={form.registrationNumber || ""} onChange={set("registrationNumber")} className={inputClass} placeholder="N° d'enregistrement" />
              </Field>
              <Field label="Site web" id="website">
                <input id="website" value={form.website || ""} onChange={set("website")} placeholder="https://..." className={inputClass} />
              </Field>
            </div>
          </div>
        </div>

        {/* Colonne droite : Informations détaillées */}
        <div className="lg:col-span-2 flex flex-col gap-md">
          
          {/* Informations Générales Card */}
          <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30">
            <SectionHeader 
              icon="business" 
              title="Informations générales" 
              subtitle="Dénomination et description d'usage" 
            />
            <div className="flex flex-col gap-md">
              <Field label="Nom du centre" id="name">
                <input id="name" required value={form.name} onChange={set("name")} className={inputClass} placeholder="Nom de l'établissement" />
              </Field>
              <Field label="Description de présentation" id="description">
                <textarea
                  id="description"
                  rows={4}
                  value={form.description || ""}
                  onChange={set("description")}
                  placeholder="Courte présentation du centre, affichée sur les relevés et documents officiels."
                  className={`${inputClass} h-auto py-2.5 resize-none`}
                />
              </Field>
            </div>
          </div>

          {/* Coordonnées & Adresse Card */}
          <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30">
            <SectionHeader 
              icon="map" 
              title="Coordonnées &amp; localisation" 
              subtitle="Adresse d'exploitation" 
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <div className="sm:col-span-2">
                <Field label="Adresse physique" id="address">
                  <input id="address" value={form.address || ""} onChange={set("address")} className={inputClass} placeholder="Rue, quartier..." />
                </Field>
              </div>
              <Field label="Email de contact" id="email">
                <input id="email" type="email" value={form.email || ""} onChange={set("email")} className={inputClass} placeholder="contact@etablissement.cm" />
              </Field>
              <Field label="Téléphone" id="phone">
                <input id="phone" value={form.phone || ""} onChange={set("phone")} className={inputClass} placeholder="Ex: +237..." />
              </Field>
              <Field label="Ville" id="city">
                <input id="city" value={form.city || ""} onChange={set("city")} className={inputClass} placeholder="Ville" />
              </Field>
              <Field label="Pays" id="country">
                <input id="country" value={form.country || ""} onChange={set("country")} className={inputClass} placeholder="Cameroun" />
              </Field>
            </div>
          </div>

          {/* Direction Card */}
          <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30">
            <SectionHeader 
              icon="assignment_ind" 
              title="Direction de l'établissement" 
              subtitle="Identité légale des signatures" 
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <Field label="Nom du directeur / de la directrice" id="directorName">
                <input id="directorName" value={form.directorName || ""} onChange={set("directorName")} className={inputClass} placeholder="Nom Complet" />
              </Field>
              <Field label="Titre officiel" id="directorTitle">
                <input id="directorTitle" value={form.directorTitle || ""} onChange={set("directorTitle")} placeholder="Directeur, Directrice Générale..." className={inputClass} />
              </Field>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-outline-variant/20 pt-md self-start">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-md bg-gradient-to-r from-primary to-violet px-6 py-2.5 text-xs font-bold text-on-primary transition-shadow hover:shadow-[0_4px_14px_rgba(94,114,228,0.35)] disabled:opacity-60 flex items-center gap-1.5"
        >
          {status === "saving" ? (
            <>
              <Icon name="progress_activity" className="animate-spin text-[16px]" />
              <span>Enregistrement...</span>
            </>
          ) : (
            <>
              <Icon name="save" className="text-[16px]" />
              <span>Enregistrer les modifications</span>
            </>
          )}
        </button>
      </div>
    </motion.form>
  );
}