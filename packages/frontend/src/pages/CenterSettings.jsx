import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

const EMPTY = {
  name: "", email: "", phone: "", logo: null,
  address: "", city: "", postalCode: "", country: "", website: "",
  registrationNumber: "", directorName: "", directorTitle: "", description: "",
};

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

function inputClass() {
  return "h-11 rounded-md bg-surface px-4 text-sm text-on-surface outline-none " +
    "shadow-[inset_0_0_0_1px_theme(colors.outline-variant)] transition-shadow " +
    "focus:shadow-[inset_0_0_0_2px_theme(colors.primary)]";
}

export default function CenterSettings() {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    setStatus("loading");
    apiFetch("/center")
      .then((data) => {
        setForm({ ...EMPTY, ...data });
        setStatus("idle");
      })
      .catch((err) => {
        setError(err.message || "Erreur de connexion à l'établissement.");
        setStatus("error");
      });
  }, []);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result }));
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      const updated = await apiFetch("/center", { method: "PUT", body: JSON.stringify(form) });
      setForm({ ...EMPTY, ...updated });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

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
      className="max-w-3xl flex flex-col gap-lg"
    >
      {/* Logo */}
      <section className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-sm font-semibold text-on-surface mb-md">Identité visuelle</h2>
        <div className="flex items-center gap-md">
          <div className="w-20 h-20 rounded-md bg-surface flex items-center justify-center overflow-hidden shadow-[inset_0_0_0_1px_theme(colors.outline-variant)]">
            {form.logo ? (
              <img src={form.logo} alt="Logo du centre" className="w-full h-full object-contain" />
            ) : (
              <Icon name="storefront" className="text-on-surface-variant/40 text-[32px]" />
            )}
          </div>
          <label className="cursor-pointer rounded-md border border-outline-variant px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light transition-colors">
            Changer le logo
            <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </label>
        </div>
      </section>

      {/* Identité */}
      <section className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-sm font-semibold text-on-surface mb-md">Informations générales</h2>
        <div className="grid grid-cols-2 gap-md">
          <div className="col-span-2">
            <Field label="Nom du centre" id="name">
              <input id="name" required value={form.name} onChange={set("name")} className={inputClass()} />
            </Field>
          </div>
          <Field label="Numéro d'agrément / immatriculation" id="registrationNumber">
            <input id="registrationNumber" value={form.registrationNumber || ""} onChange={set("registrationNumber")} className={inputClass()} />
          </Field>
          <Field label="Site web" id="website">
            <input id="website" value={form.website || ""} onChange={set("website")} placeholder="https://..." className={inputClass()} />
          </Field>
          <div className="col-span-2">
            <Field label="Description" id="description">
              <textarea
                id="description"
                rows={3}
                value={form.description || ""}
                onChange={set("description")}
                placeholder="Courte présentation du centre, affichée sur certains documents."
                className={inputClass() + " h-auto py-2.5 resize-none"}
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-sm font-semibold text-on-surface mb-md">Coordonnées</h2>
        <div className="grid grid-cols-2 gap-md">
          <Field label="Email de contact" id="email">
            <input id="email" type="email" value={form.email || ""} onChange={set("email")} className={inputClass()} />
          </Field>
          <Field label="Téléphone" id="phone">
            <input id="phone" value={form.phone || ""} onChange={set("phone")} className={inputClass()} />
          </Field>
        </div>
      </section>

      {/* Adresse */}
      <section className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-sm font-semibold text-on-surface mb-md">Adresse</h2>
        <div className="grid grid-cols-2 gap-md">
          <div className="col-span-2">
            <Field label="Adresse" id="address">
              <input id="address" value={form.address || ""} onChange={set("address")} className={inputClass()} />
            </Field>
          </div>
          <Field label="Ville" id="city">
            <input id="city" value={form.city || ""} onChange={set("city")} className={inputClass()} />
          </Field>
          <Field label="Code postal" id="postalCode">
            <input id="postalCode" value={form.postalCode || ""} onChange={set("postalCode")} className={inputClass()} />
          </Field>
          <Field label="Pays" id="country">
            <input id="country" value={form.country || ""} onChange={set("country")} className={inputClass()} />
          </Field>
        </div>
      </section>

      {/* Direction */}
      <section className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-sm font-semibold text-on-surface mb-md">Direction</h2>
        <div className="grid grid-cols-2 gap-md">
          <Field label="Nom du directeur / de la directrice" id="directorName">
            <input id="directorName" value={form.directorName || ""} onChange={set("directorName")} className={inputClass()} />
          </Field>
          <Field label="Titre" id="directorTitle">
            <input id="directorTitle" value={form.directorTitle || ""} onChange={set("directorTitle")} placeholder="Directeur, Directrice générale..." className={inputClass()} />
          </Field>
        </div>
      </section>

      <AnimatePresence>
        {status === "error" && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-md bg-error-container px-3 py-2 text-sm text-error">
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded-md bg-gradient-to-r from-primary to-violet px-6 py-2.5 text-sm font-semibold text-on-primary transition-shadow hover:shadow-[0_4px_14px_rgba(94,114,228,0.35)] disabled:opacity-60"
      >
        {status === "saving" ? "Enregistrement..." : status === "saved" ? "Enregistré ✓" : "Enregistrer"}
      </button>
    </motion.form>
  );
}