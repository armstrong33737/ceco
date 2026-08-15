// packages/frontend/src/pages/DocumentTemplatesSettings.jsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch, apiFetchImageUrl } from "../lib/apiClient";
import useAuthStore from "../store/authStore";
import Icon from "../components/Icon";

const DOCUMENT_TYPES = [
  { key: "CARTE_ETUDIANT", label: "Carte d'Apprenant (Badge)", icon: "badge" },
  { key: "ATTESTATION_INSCRIPTION", label: "Certificat de Scolarité", icon: "verified" },
  { key: "FICHE_INSCRIPTION", label: "Fiche d'Inscription", icon: "description" },
];

const DEFAULT_CONFIGS = {
  CARTE_ETUDIANT: {
    themeColor: "#0B1C30",
    accentColor: "#5E72E4",
    cardTitle: "CARTE D'APPRENANT OFFICIELLE",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "logo",
    watermarkOpacity: 0.08,
    termsOfUse: "Cette carte est strictement personnelle et obligatoire pour l'accès aux cours, ateliers et examens. En cas de perte, signaler immédiatement à la direction.",
    signatoryTitle: "Le Directeur Général",
  },
  ATTESTATION_INSCRIPTION: {
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING",
    subHeaderCenter: "DÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA",
    documentTitle: "CERTIFICAT DE SCOLARITÉ & D'INSCRIPTION",
    subTitle: "ATTESTATION OF ENROLMENT",
    primaryColor: "#0B1C30",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "seal",
    watermarkOpacity: 0.08,
    signatories: [
      { title: "Le Chef de Département", roleKey: "directeur_pedagogique" },
      { title: "Le Directeur Général", roleKey: "directeur" },
    ],
    footerLegal: "Toute falsification du présent document expose son auteur aux sanctions prévues par le Code Pénal.",
  },
  FICHE_INSCRIPTION: {
    documentTitle: "FICHE INDIVIDUELLE D'INSCRIPTION & D'ENGAGEMENT",
    primaryColor: "#0B1C30",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "logo",
    watermarkOpacity: 0.06,
    engagementText: "Je soussigné(e), certifie sur l'honneur l'exactitude des renseignements fournis et m'engage au respect intégral du règlement intérieur de l'établissement.",
    signatories: [
      { title: "Signature de l'Apprenant(e)", roleKey: "student" },
      { title: "Visa de la Direction", roleKey: "directeur" },
    ],
    footerLegal: "Dossier d'inscription conservé aux archives académiques de l'établissement.",
  },
};

export default function DocumentTemplatesSettings() {
  const user = useAuthStore((s) => s.user);
  const [selectedType, setSelectedType] = useState("CARTE_ETUDIANT");
  const [config, setConfig] = useState(DEFAULT_CONFIGS.CARTE_ETUDIANT);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState(null);

  const [centerLogoUrl, setCenterLogoUrl] = useState(null);
  const [centerSealUrl, setCenterSealUrl] = useState(null);
  const [cardPreviewSide, setCardPreviewSide] = useState("recto");

  useEffect(() => {
    let isMounted = true;
    apiFetch("/center")
      .then(async (centerData) => {
        if (!isMounted || !centerData) return;
        if (centerData.hasLogo) {
          const logoUrl = await apiFetchImageUrl("/center/logo");
          if (isMounted) setCenterLogoUrl(logoUrl);
        }
        if (centerData.hasSeal) {
          const sealUrl = await apiFetchImageUrl("/center/seal");
          if (isMounted) setCenterSealUrl(sealUrl);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  function handleSelectType(newType) {
    setSelectedType(newType);
    setError(null);
    setSuccessMsg("");
    const fallback = DEFAULT_CONFIGS[newType] || DEFAULT_CONFIGS.CARTE_ETUDIANT;
    setConfig(fallback);

    apiFetch(`/documents/templates/${newType}`)
      .then((data) => {
        if (data && typeof data === "object") {
          setConfig((prev) => ({
            ...fallback,
            ...data,
            signatories: data.signatories || fallback.signatories || [],
          }));
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    handleSelectType("CARTE_ETUDIANT");
  }, []);

  function handleAddSignatory() {
    const list = config.signatories || [];
    if (list.length >= 3) return;
    setConfig({
      ...config,
      signatories: [...list, { title: "Nouveau Signataire", roleKey: "directeur" }],
    });
  }

  function handleRemoveSignatory(index) {
    const list = (config.signatories || []).filter((_, i) => i !== index);
    setConfig({ ...config, signatories: list });
  }

  function handleUpdateSignatory(index, field, val) {
    const list = [...(config.signatories || [])];
    list[index] = { ...list[index], [field]: val };
    setConfig({ ...config, signatories: list });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg("");
    try {
      await apiFetch(`/documents/templates/${selectedType}`, {
        method: "PUT",
        body: JSON.stringify({ config }),
      });
      setSuccessMsg("Gabarit enregistré avec succès.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.message || "Erreur d'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "h-10 rounded-md bg-surface px-3 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full";

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-md max-w-7xl mx-auto">
      {/* Sélecteur de type */}
      <div className="bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">
          Modèle de document à personnaliser (V2)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {DOCUMENT_TYPES.map((dt) => (
            <button
              key={dt.key}
              type="button"
              onClick={() => handleSelectType(dt.key)}
              className={`p-2.5 rounded-md text-xs font-bold text-center border transition-all flex flex-col items-center gap-1.5 ${
                selectedType === dt.key
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-surface text-on-surface-variant border-outline-variant/30 hover:bg-surface-container/60"
              }`}
            >
              <Icon name={dt.icon} className="text-[18px]" />
              <span className="truncate w-full">{dt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-error-container p-md text-sm text-error border border-error/20 flex items-center justify-between">
          <p className="text-xs font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-bold underline">Fermer</button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-md bg-success-light p-md text-sm text-success border border-success/20 flex items-center gap-2">
          <Icon name="check_circle" className="text-success text-[18px]" />
          <p className="text-xs font-semibold">{successMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Formulaire spécifique */}
        <form onSubmit={handleSubmit} className="lg:col-span-6 bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs space-y-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div>
              <h2 className="text-sm font-bold text-on-surface">
                {DOCUMENT_TYPES.find((d) => d.key === selectedType)?.label}
              </h2>
              <p className="text-xs text-on-surface-variant">Personnalisation des visuels et blocs de signature</p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark shadow-xs flex items-center gap-1.5"
            >
              <Icon name="save" className="text-[16px]" />
              <span>{saving ? "Enregistrement..." : "Enregistrer"}</span>
            </button>
          </div>

          <div className="space-y-md text-xs">
            {/* Formulaire Carte */}
            {selectedType === "CARTE_ETUDIANT" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-on-surface-variant uppercase block mb-1">Couleur du bandeau</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.themeColor || "#0B1C30"}
                        onChange={(e) => setConfig({ ...config, themeColor: e.target.value })}
                        className="w-10 h-10 rounded-md border border-outline-variant/30 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={config.themeColor || "#0B1C30"}
                        onChange={(e) => setConfig({ ...config, themeColor: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-on-surface-variant uppercase block mb-1">Couleur accent (Matricule)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.accentColor || "#5E72E4"}
                        onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                        className="w-10 h-10 rounded-md border border-outline-variant/30 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={config.accentColor || "#5E72E4"}
                        onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-on-surface-variant uppercase block mb-1">Titre de face</label>
                  <input
                    type="text"
                    value={config.cardTitle || ""}
                    onChange={(e) => setConfig({ ...config, cardTitle: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 bg-surface rounded-md border border-outline-variant/20">
                  <label className="flex items-center gap-2 font-bold text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showLogo ?? true}
                      onChange={(e) => setConfig({ ...config, showLogo: e.target.checked })}
                      className="rounded-md accent-primary h-4 w-4"
                    />
                    <span>Logo Centre (Recto)</span>
                  </label>
                  <label className="flex items-center gap-2 font-bold text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showSeal ?? true}
                      onChange={(e) => setConfig({ ...config, showSeal: e.target.checked })}
                      className="rounded-md accent-primary h-4 w-4"
                    />
                    <span>Sceau d'État (Recto)</span>
                  </label>
                </div>

                <div>
                  <label className="font-semibold text-on-surface-variant uppercase block mb-1">Conditions d'usage (Verso)</label>
                  <textarea
                    rows={3}
                    value={config.termsOfUse || ""}
                    onChange={(e) => setConfig({ ...config, termsOfUse: e.target.value })}
                    className={`${inputClass} h-auto py-2 resize-none font-mono text-[11px]`}
                  />
                </div>

                <div>
                  <label className="font-semibold text-on-surface-variant uppercase block mb-1">Titre du Signataire (Verso)</label>
                  <input
                    type="text"
                    value={config.signatoryTitle || ""}
                    onChange={(e) => setConfig({ ...config, signatoryTitle: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {/* Formulaire A4 */}
            {selectedType !== "CARTE_ETUDIANT" && (
              <>
                {selectedType === "ATTESTATION_INSCRIPTION" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-on-surface-variant uppercase block mb-1">En-tête Gauche (Français)</label>
                        <textarea
                          rows={3}
                          value={config.headerLeft || ""}
                          onChange={(e) => setConfig({ ...config, headerLeft: e.target.value })}
                          className={`${inputClass} h-auto py-2 resize-none font-mono text-[11px]`}
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-on-surface-variant uppercase block mb-1">En-tête Droit (Anglais)</label>
                        <textarea
                          rows={3}
                          value={config.headerRight || ""}
                          onChange={(e) => setConfig({ ...config, headerRight: e.target.value })}
                          className={`${inputClass} h-auto py-2 resize-none font-mono text-[11px]`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-on-surface-variant uppercase block mb-1">Délégation &amp; Sous-titre</label>
                      <textarea
                        rows={2}
                        value={config.subHeaderCenter || ""}
                        onChange={(e) => setConfig({ ...config, subHeaderCenter: e.target.value })}
                        className={`${inputClass} h-auto py-2 resize-none font-mono text-[11px]`}
                      />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-on-surface-variant uppercase block mb-1">Titre du document</label>
                    <input
                      type="text"
                      value={config.documentTitle || ""}
                      onChange={(e) => setConfig({ ...config, documentTitle: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-on-surface-variant uppercase block mb-1">Couleur primaire</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.primaryColor || "#0B1C30"}
                        onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                        className="w-10 h-10 rounded-md border border-outline-variant/30 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={config.primaryColor || "#0B1C30"}
                        onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {selectedType === "FICHE_INSCRIPTION" && (
                  <div>
                    <label className="font-semibold text-on-surface-variant uppercase block mb-1">Texte d'engagement sur l'honneur</label>
                    <textarea
                      rows={3}
                      value={config.engagementText || ""}
                      onChange={(e) => setConfig({ ...config, engagementText: e.target.value })}
                      className={`${inputClass} h-auto py-2 resize-none font-mono text-[11px]`}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 p-3 bg-surface rounded-md border border-outline-variant/20">
                  <label className="flex items-center gap-2 font-bold text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showLogo ?? true}
                      onChange={(e) => setConfig({ ...config, showLogo: e.target.checked })}
                      className="rounded-md accent-primary h-4 w-4"
                    />
                    <span>Logo Centre</span>
                  </label>
                  <label className="flex items-center gap-2 font-bold text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showSeal ?? true}
                      onChange={(e) => setConfig({ ...config, showSeal: e.target.checked })}
                      className="rounded-md accent-primary h-4 w-4"
                    />
                    <span>Sceau d'État</span>
                  </label>
                </div>

                {/* GESTIONNAIRE DYNAMIQUE DES ZONES DE SIGNATURE */}
                <div className="p-3 bg-surface rounded-md border border-outline-variant/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-on-surface block">Zones de signatures en pied de page</span>
                      <p className="text-[10px] text-on-surface-variant">Ajoutez ou retirez les blocs signataires (1 à 3).</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSignatory}
                      disabled={(config.signatories?.length || 0) >= 3}
                      className="rounded-md bg-primary-light border border-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                    >
                      + Ajouter
                    </button>
                  </div>

                  <div className="space-y-2 pt-1">
                    {(config.signatories || []).map((sig, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-md border border-outline-variant/30">
                        <input
                          type="text"
                          value={sig.title}
                          onChange={(e) => handleUpdateSignatory(idx, "title", e.target.value)}
                          placeholder="Intitulé du signataire"
                          className={`${inputClass} flex-1`}
                        />
                        <select
                          value={sig.roleKey || "directeur"}
                          onChange={(e) => handleUpdateSignatory(idx, "roleKey", e.target.value)}
                          className={`${inputClass} w-36`}
                        >
                          <option value="directeur">Directeur Général</option>
                          <option value="directeur_pedagogique">Dir. Pédagogique</option>
                          <option value="student">Apprenant(e)</option>
                          <option value="none">Sans signature</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveSignatory(idx)}
                          disabled={(config.signatories?.length || 0) <= 1}
                          className="text-error hover:bg-error-container/20 p-1.5 rounded-md disabled:opacity-30"
                        >
                          <Icon name="delete" className="text-[16px]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-on-surface-variant uppercase block mb-1">Mention légale de bas de page</label>
                  <input
                    type="text"
                    value={config.footerLegal || ""}
                    onChange={(e) => setConfig({ ...config, footerLegal: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {/* Filigrane */}
            <div className="p-3 bg-surface rounded-md border border-outline-variant/20 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-on-surface block">Filigrane de fond</span>
                  <p className="text-[11px] text-on-surface-variant">Image translucide en arrière-plan.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.showWatermark ?? true}
                  onChange={(e) => setConfig({ ...config, showWatermark: e.target.checked })}
                  className="rounded-md accent-primary h-4 w-4 cursor-pointer"
                />
              </div>

              {config.showWatermark && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/15 items-center">
                  <select
                    value={config.watermarkType || "logo"}
                    onChange={(e) => setConfig({ ...config, watermarkType: e.target.value })}
                    className={inputClass}
                  >
                    <option value="logo">Logo du centre</option>
                    <option value="seal">Sceau de la République</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-on-surface-variant">Opacité :</span>
                    <input
                      type="range"
                      min={0.03}
                      max={0.20}
                      step={0.01}
                      value={config.watermarkOpacity || 0.08}
                      onChange={(e) => setConfig({ ...config, watermarkOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-primary"
                    />
                    <span className="font-mono font-bold text-primary">{Math.round((config.watermarkOpacity || 0.08) * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Aperçu en direct fidèle à 100% */}
        <div className="lg:col-span-6 bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Aperçu en direct
            </h3>
            {selectedType === "CARTE_ETUDIANT" ? (
              <div className="flex gap-1 p-0.5 bg-surface rounded-md border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setCardPreviewSide("recto")}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                    cardPreviewSide === "recto" ? "bg-primary text-white" : "text-on-surface-variant"
                  }`}
                >
                  Recto (Face)
                </button>
                <button
                  type="button"
                  onClick={() => setCardPreviewSide("verso")}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                    cardPreviewSide === "verso" ? "bg-primary text-white" : "text-on-surface-variant"
                  }`}
                >
                  Verso (Dos)
                </button>
              </div>
            ) : (
              <span className="text-[10px] font-mono text-primary bg-primary-light px-2 py-0.5 rounded-md font-bold">
                Ratio A4 Officiel
              </span>
            )}
          </div>

          {/* Rendu Badge CR80 */}
          {selectedType === "CARTE_ETUDIANT" && (
            <div className="p-6 bg-surface rounded-md border border-outline-variant/30 flex items-center justify-center min-h-[380px]">
              {cardPreviewSide === "recto" ? (
                <div className="w-[330px] h-[208px] rounded-md bg-white border border-outline-variant/50 shadow-md p-3 flex flex-col justify-between relative overflow-hidden text-[9px]">
                  {config.showWatermark && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none z-0" style={{ opacity: config.watermarkOpacity || 0.08 }}>
                      {config.watermarkType === "seal" && centerSealUrl ? (
                        <img src={centerSealUrl} alt="Sceau" className="w-28 h-28 object-contain" />
                      ) : centerLogoUrl ? (
                        <img src={centerLogoUrl} alt="Logo" className="w-28 h-28 object-contain" />
                      ) : null}
                    </div>
                  )}

                  <div className="relative z-10 -mx-3 -mt-3 px-3 py-2 flex items-center justify-between text-white" style={{ backgroundColor: config.themeColor || "#0B1C30" }}>
                    <div className="flex items-center gap-2 max-w-[240px]">
                      {config.showLogo && centerLogoUrl && (
                        <img src={centerLogoUrl} alt="Logo" className="w-6 h-6 object-contain rounded-md bg-white p-0.5" />
                      )}
                      <div className="leading-none truncate">
                        <p className="font-bold text-[9px] uppercase truncate">{user?.center?.name || "CENTRE D'EXCELLENCE"}</p>
                        <span className="text-[7px] text-slate-300 font-bold">{config.cardTitle || "CARTE D'APPRENANT OFFICIELLE"}</span>
                      </div>
                    </div>
                    {config.showSeal && centerSealUrl && (
                      <img src={centerSealUrl} alt="Sceau" className="w-6 h-6 object-contain" />
                    )}
                  </div>

                  <div className="relative z-10 flex gap-3 items-center my-auto">
                    <div className="w-16 h-20 rounded-md overflow-hidden bg-surface border border-outline-variant/40 flex-shrink-0 flex items-center justify-center shadow-inner">
                      <Icon name="person" className="text-4xl text-on-surface-variant/40" />
                    </div>
                    <div className="space-y-1 text-on-surface leading-tight">
                      <p><strong className="text-on-surface-variant">NOM :</strong> NGALEU</p>
                      <p><strong className="text-on-surface-variant">PRÉNOM :</strong> Armstrong Euclador</p>
                      <p><strong className="text-on-surface-variant">MATRICULE :</strong> <span className="font-mono font-bold" style={{ color: config.accentColor || "#5E72E4" }}>STU26-0042</span></p>
                      <p><strong className="text-on-surface-variant">FILIÈRE :</strong> Froid &amp; Climatisation</p>
                      <p><strong className="text-on-surface-variant">NIVEAU :</strong> Niveau 1 (DQP)</p>
                    </div>
                  </div>

                  <div className="relative z-10 flex justify-between items-center text-[8px] text-on-surface-variant pt-1 border-t border-outline-variant/20 font-mono">
                    <span>Session : 2026-2027</span>
                    <span className="font-bold" style={{ color: config.accentColor || "#5E72E4" }}>CECO ID-PASS</span>
                  </div>
                </div>
              ) : (
                <div className="w-[330px] h-[208px] rounded-md bg-white border border-outline-variant/50 shadow-md p-3 flex flex-col justify-between relative overflow-hidden text-[8px] leading-tight">
                  <div className="relative z-10 space-y-1.5">
                    <p className="font-bold uppercase text-[8px]" style={{ color: config.themeColor || "#0B1C30" }}>
                      Conditions d'utilisation
                    </p>
                    <p className="text-on-surface-variant text-[7.5px] leading-normal">{config.termsOfUse}</p>
                    <p className="text-on-surface-variant font-medium">Agrément : {user?.center?.registrationNumber || "MINEFOP"} • Tél : {user?.center?.phone || ""}</p>
                  </div>

                  <div className="relative z-10 flex items-center justify-between pt-2 border-t border-outline-variant/20">
                    <div className="p-1 bg-surface rounded-md border border-outline-variant/30 text-center">
                      <Icon name="qr_code_2" className="text-4xl text-on-surface block" />
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-[7px] text-on-surface-variant font-mono">Empreinte sécurisée :</p>
                      <p className="font-mono text-[7px] font-bold text-primary">CECO-CARD-AUTH-2026</p>
                      <p className="text-[8px] font-bold text-on-surface mt-1">{config.signatoryTitle || "Le Directeur Général"}</p>
                    </div>
                  </div>

                  <div className="-mx-3 -mb-3 px-3 py-1.5 bg-ink text-white flex justify-between items-center text-[7px]">
                    <span className="text-white/70">Propriété de l'établissement</span>
                    <span className="font-bold tracking-wider text-white">PROPULSÉ PAR CECO</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rendu Format A4 */}
          {selectedType !== "CARTE_ETUDIANT" && (
            <div className="p-6 bg-white rounded-md border border-outline-variant/50 shadow-sm relative overflow-hidden text-[10px] leading-tight space-y-3 min-h-[480px] flex flex-col justify-between">
              {config.showWatermark && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none z-0" style={{ opacity: config.watermarkOpacity || 0.08 }}>
                  {config.watermarkType === "seal" && centerSealUrl ? (
                    <img src={centerSealUrl} alt="Sceau" className="w-[260px] h-[260px] object-contain" />
                  ) : centerLogoUrl ? (
                    <img src={centerLogoUrl} alt="Logo" className="w-[260px] h-[260px] object-contain" />
                  ) : null}
                </div>
              )}

              <div className="relative z-10 space-y-3">
                {selectedType === "ATTESTATION_INSCRIPTION" && (
                  <div className="flex justify-between items-start text-[8px] font-serif border-b pb-2">
                    <div className="text-center font-semibold whitespace-pre-line w-[38%]">{config.headerLeft}</div>
                    <div className="flex items-center gap-2 justify-center w-[24%]">
                      {config.showLogo && centerLogoUrl && <img src={centerLogoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-md" />}
                      {config.showSeal && centerSealUrl && <img src={centerSealUrl} alt="Sceau" className="w-10 h-10 object-contain" />}
                    </div>
                    <div className="text-center font-semibold whitespace-pre-line w-[38%]">{config.headerRight}</div>
                  </div>
                )}

                <div className="text-center space-y-0.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-primary">{user?.center?.name || "CENTRE D'EXCELLENCE"}</h2>
                  <p className="text-[8px] text-on-surface-variant font-mono">Agrément : {user?.center?.registrationNumber || "MINEFOP"}</p>
                </div>

                <div className="text-center py-2 border-y border-outline-variant/30 my-2">
                  <h3 className="font-bold text-xs uppercase underline tracking-wider">{config.documentTitle || DOCUMENT_TYPES.find((d) => d.key === selectedType)?.label}</h3>
                  {config.subTitle && <p className="text-[9px] font-bold text-on-surface-variant">{config.subTitle}</p>}
                </div>

                <div className="p-3 bg-surface rounded-md border border-outline-variant/20 space-y-1">
                  <p><strong>Apprenant :</strong> NGALEU Armstrong Euclador</p>
                  <p><strong>Matricule :</strong> STU26-0042 • <strong>Né le :</strong> 14/08/2002</p>
                  <p><strong>Filière :</strong> Froid &amp; Climatisation (Niveau 1)</p>
                  <p><strong>Session Académique :</strong> 2026-2027 (En cours)</p>
                </div>
              </div>

              {/* Rendu Dynamique des Signatures dans l'Aperçu */}
              <div className="relative z-10 pt-4 border-t border-outline-variant/30 space-y-3">
                <div className="flex justify-between items-end text-[8px]">
                  <div className="text-center w-1/4">
                    <div className="w-12 h-12 bg-surface rounded-md border border-outline-variant/30 mx-auto flex items-center justify-center">
                      <Icon name="qr_code_2" className="text-3xl text-on-surface" />
                    </div>
                    <span className="text-[6px] font-mono text-primary font-bold">AUTHENTIFIÉ CECO</span>
                  </div>

                  <div className="flex-1 flex justify-around">
                    {(config.signatories || []).map((sig, idx) => (
                      <div key={idx} className="space-y-4 text-center">
                        <p className="font-bold underline">{sig.title}</p>
                        <p className="text-[7px] text-on-surface-variant font-mono">[Signature scannée]</p>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[7px] text-center text-on-surface-variant font-mono border-t pt-1">
                  {config.footerLegal || DEFAULT_CONFIGS.ATTESTATION_INSCRIPTION.footerLegal}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}