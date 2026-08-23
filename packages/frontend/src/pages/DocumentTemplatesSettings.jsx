// packages/frontend/src/pages/DocumentTemplatesSettings.jsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch, apiFetchImageUrl } from "../lib/apiClient";
import useAuthStore from "../store/authStore";
import Icon from "../components/Icon";

// Classification structurée en 3 Blocs Métier
const DOCUMENT_SECTIONS = [
  {
    id: "cartes",
    title: "1. Cartes & Badges d'Identité",
    icon: "badge",
    description: "Cartes d'apprenants au format carte bancaire (CR80) avec QR Code autonome au verso.",
    items: [
      { key: "CARTE_ETUDIANT", label: "Carte d'Apprenant (Badge)", icon: "badge", isExternal: true },
    ],
  },
  {
    id: "internes",
    title: "2. Documents Internes & Pédagogiques",
    icon: "folder_shared",
    description: "Fiches, bordereaux manuscrits et procès-verbaux réservés à l'administration du centre.",
    items: [
      { key: "FICHE_INSCRIPTION", label: "Fiche d'Inscription Individuelle", icon: "description", isExternal: false },
      { key: "BORDEREAU_VIERGE", label: "Bordereau de Notes Vierge", icon: "edit_document", isExternal: false },
      { key: "PV_MATIERE", label: "Procès-Verbal de Matière", icon: "assignment_turned_in", isExternal: false },
      { key: "PV_SEMESTRE", label: "PV de Délibération Semestriel", icon: "table_chart", isExternal: false },
    ],
  },
  {
    id: "externes",
    title: "3. Documents Externes & Certifiés",
    icon: "verified",
    description: "Certificats, bulletins périodiques, relevés et diplômes certifiés par QR Code hors-ligne.",
    items: [
      { key: "ATTESTATION_INSCRIPTION", label: "Certificat de Scolarité", icon: "verified", isExternal: true },
      { key: "BULLETIN_CC", label: "Bulletin de Contrôle Continu (CC/TP)", icon: "fact_check", isExternal: true },
      { key: "BULLETIN_SEMESTRE", label: "Bulletin Semestriel Bilingue", icon: "receipt_long", isExternal: true },
      { key: "RELEVE_ANNUEL", label: "Relevé de Notes Annuel (Transcript)", icon: "history_edu", isExternal: true },
      { key: "DIPLOME_FIN_FORMATION", label: "Diplôme de Fin de Formation", icon: "workspace_premium", isExternal: true },
    ],
  },
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
    termsOfUse: "Cette carte est strictement personnelle et obligatoire pour l'accès aux cours, ateliers et examens. En cas de perte, rapporter immédiatement à la direction.",
    signatoryTitle: "Le Directeur Général",
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
    footerLegal: "Document administratif interne conservé aux archives académiques.",
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
      { title: "Le Directeur des Études", roleKey: "directeur_pedagogique" },
      { title: "Le Directeur Général", roleKey: "directeur" },
    ],
    footerLegal: "Toute falsification ou altération du présent document expose son auteur aux poursuites prévues par le Code Pénal.",
  },
  BULLETIN_CC: {
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING",
    subHeaderCenter: "DÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA",
    documentTitle: "BULLETIN D'ÉVALUATIONS CONTINUES (CC & TP)",
    primaryColor: "#0B1C30",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "logo",
    watermarkOpacity: 0.06,
    signatories: [
      { title: "Le Directeur des Études", roleKey: "directeur_pedagogique" },
      { title: "Le Directeur Général", roleKey: "directeur" },
    ],
    footerLegal: "Bulletin d'évaluation continue certifié conforme • Registre officiel CECO",
  },
  BULLETIN_SEMESTRE: {
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING",
    subHeaderCenter: "DÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA",
    documentTitle: "BULLETIN SEMESTRIEL DE NOTES / SEMESTER REPORT CARD",
    primaryColor: "#0B1C30",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "seal",
    watermarkOpacity: 0.08,
    signatories: [
      { title: "Le Directeur des Études", roleKey: "directeur_pedagogique" },
      { title: "Le Directeur Général", roleKey: "directeur" },
    ],
    footerLegal: "Toute rature ou surcharge annule la validité du présent bulletin officiel.",
  },
  RELEVE_ANNUEL: {
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING",
    subHeaderCenter: "DÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA",
    documentTitle: "RELEVÉ DE NOTES ANNUEL / OFFICIAL ACADEMIC TRANSCRIPT",
    primaryColor: "#0B1C30",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "seal",
    watermarkOpacity: 0.08,
    signatories: [
      { title: "Le Directeur des Études", roleKey: "directeur_pedagogique" },
      { title: "Le Directeur Général", roleKey: "directeur" },
    ],
    footerLegal: "Relevé officiel annuel certifié conforme et délivré en un seul exemplaire original.",
  },
  DIPLOME_FIN_FORMATION: {
    documentTitle: "DIPLÔME DE FIN DE FORMATION PROFESSIONNELLE",
    primaryColor: "#0B1C30",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "seal",
    watermarkOpacity: 0.08,
    signatories: [
      { title: "Le Président du Jury", roleKey: "directeur_pedagogique" },
      { title: "Le Directeur de l'Établissement", roleKey: "directeur" },
    ],
    footerLegal: "Titre officiel de qualification professionnelle certifié conforme • CECO ERP",
  },
};

const inputClass = "h-10 rounded-md bg-surface px-3 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full";

export default function DocumentTemplatesSettings() {
  const user = useAuthStore((s) => s.user);
  const [selectedType, setSelectedType] = useState("BULLETIN_SEMESTRE");
  const [config, setConfig] = useState(DEFAULT_CONFIGS.BULLETIN_SEMESTRE);
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
    const fallback = DEFAULT_CONFIGS[newType] || DEFAULT_CONFIGS.BULLETIN_SEMESTRE;
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
    handleSelectType("BULLETIN_SEMESTRE");
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

  // Trouver le document actuellement sélectionné
  let currentDocMeta = null;
  for (const sec of DOCUMENT_SECTIONS) {
    const found = sec.items.find((i) => i.key === selectedType);
    if (found) {
      currentDocMeta = { ...found, sectionTitle: sec.title };
      break;
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-md max-w-7xl mx-auto">
      {/* Sélecteur en 3 Blocs Métier */}
      <div className="space-y-3">
        <div className="bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
          <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <Icon name="palette" className="text-primary text-[20px]" />
            <span>Gabarits &amp; Modèles Vectoriels (V4)</span>
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Sélectionnez un document parmi les 3 blocs fonctionnels pour ajuster les en-têtes bilingues, couleurs, mentions et blocs signataires.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DOCUMENT_SECTIONS.map((sec) => (
            <div key={sec.id} className="bg-surface-container-lowest p-3 rounded-md border border-outline-variant/30 shadow-xs space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary border-b border-outline-variant/20 pb-2">
                  <Icon name={sec.icon} className="text-[18px]" />
                  <span className="font-bold text-xs text-on-surface">{sec.title}</span>
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">{sec.description}</p>
              </div>

              <div className="space-y-1.5 pt-2">
                {sec.items.map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => handleSelectType(it.key)}
                    className={`w-full p-2 rounded-md text-xs font-semibold text-left transition-all flex items-center justify-between border ${
                      selectedType === it.key
                        ? "bg-primary text-white border-primary shadow-xs font-bold"
                        : "bg-surface text-on-surface border-outline-variant/30 hover:bg-surface-container/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Icon name={it.icon} className="text-[16px] flex-shrink-0" />
                      <span className="truncate">{it.label}</span>
                    </div>
                    {it.isExternal && (
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                        selectedType === it.key ? "bg-white/20 text-white" : "bg-primary-light text-primary"
                      }`}>
                        QR Certifié
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
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

      {/* Grille Formulaire + Prévisualisation en direct */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Formulaire de Configuration */}
        <form onSubmit={handleSubmit} className="lg:col-span-6 bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs space-y-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div>
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span>{currentDocMeta?.label}</span>
                {currentDocMeta?.isExternal ? (
                  <span className="px-2 py-0.5 rounded bg-success-light text-success font-bold text-[10px] border border-success/20">
                    Document Externe Certifié
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-surface border text-on-surface-variant font-bold text-[10px]">
                    Document Interne
                  </span>
                )}
              </h3>
              <p className="text-xs text-on-surface-variant">{currentDocMeta?.sectionTitle}</p>
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
            {/* Formulaire spécifique Carte */}
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

            {/* Formulaires Format A4 (Bulletins, Relevés, Diplômes, Certificats, Fiches) */}
            {selectedType !== "CARTE_ETUDIANT" && (
              <>
                {/* En-tête officiel bilingue */}
                {selectedType !== "DIPLOME_FIN_FORMATION" && (
                  <div className="p-3 bg-surface rounded-md border border-outline-variant/20 space-y-2">
                    <span className="font-bold text-on-surface block uppercase text-[10px] tracking-wider">
                      En-tête Officiel Bilingue (Français / Anglais)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-on-surface-variant uppercase block mb-1">Volet Gauche (Français)</label>
                        <textarea
                          rows={3}
                          value={config.headerLeft || ""}
                          onChange={(e) => setConfig({ ...config, headerLeft: e.target.value })}
                          className={`${inputClass} h-auto py-2 resize-none font-mono text-[10px]`}
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-on-surface-variant uppercase block mb-1">Volet Droit (Anglais)</label>
                        <textarea
                          rows={3}
                          value={config.headerRight || ""}
                          onChange={(e) => setConfig({ ...config, headerRight: e.target.value })}
                          className={`${inputClass} h-auto py-2 resize-none font-mono text-[10px]`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-on-surface-variant uppercase block mb-1">Délégations &amp; Arrondissements</label>
                      <textarea
                        rows={2}
                        value={config.subHeaderCenter || ""}
                        onChange={(e) => setConfig({ ...config, subHeaderCenter: e.target.value })}
                        className={`${inputClass} h-auto py-2 resize-none font-mono text-[10px]`}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-on-surface-variant uppercase block mb-1">Titre de l'acte</label>
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
                    <label className="font-semibold text-on-surface-variant uppercase block mb-1">Texte d'engagement de l'apprenant</label>
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
                    <span>Afficher le Logo</span>
                  </label>
                  <label className="flex items-center gap-2 font-bold text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showSeal ?? true}
                      onChange={(e) => setConfig({ ...config, showSeal: e.target.checked })}
                      className="rounded-md accent-primary h-4 w-4"
                    />
                    <span>Afficher le Sceau de l'État</span>
                  </label>
                </div>

                {/* Blocs Signataires dynamiques */}
                <div className="p-3 bg-surface rounded-md border border-outline-variant/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-on-surface block uppercase text-[10px] tracking-wider">
                        Zones de Signatures &amp; Visas (Pied de Page)
                      </span>
                      <p className="text-[10px] text-on-surface-variant">Configurez 1 à 3 signataires pour cet acte.</p>
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
                          className={`${inputClass} w-44`}
                        >
                          <option value="directeur">Directeur Général</option>
                          <option value="directeur_pedagogique">Dir. Pédagogique / Président Jury</option>
                          <option value="student">Apprenant(e)</option>
                          <option value="none">Sans image (Mention seule)</option>
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

            {/* Filigrane vectoriel */}
            <div className="p-3 bg-surface rounded-md border border-outline-variant/20 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-on-surface block uppercase text-[10px] tracking-wider">Filigrane de fond</span>
                  <p className="text-[10px] text-on-surface-variant">Image translucide centrée en arrière-plan.</p>
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

        {/* Aperçu en direct */}
        <div className="lg:col-span-6 bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Aperçu Vectoriel en Direct
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
            ) : selectedType === "DIPLOME_FIN_FORMATION" ? (
              <span className="text-[10px] font-mono text-primary bg-primary-light px-2 py-0.5 rounded-md font-bold">
                Ratio A4 Paysage (Diplôme)
              </span>
            ) : (
              <span className="text-[10px] font-mono text-primary bg-primary-light px-2 py-0.5 rounded-md font-bold">
                Ratio A4 Portrait
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
                      <p className="text-[7px] text-on-surface-variant font-mono">QR Certifié Hors-Ligne</p>
                      <p className="font-mono text-[7px] font-bold text-primary">OFFICIAL-AUTH-CECO</p>
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

          {/* Rendu Format Diplôme Paysage */}
          {selectedType === "DIPLOME_FIN_FORMATION" && (
            <div className="p-4 bg-white rounded-md border-2 border-amber-400 shadow-md relative overflow-hidden text-[9px] leading-tight space-y-2 min-h-[380px] flex flex-col justify-between">
              {config.showWatermark && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none z-0" style={{ opacity: config.watermarkOpacity || 0.08 }}>
                  {config.watermarkType === "seal" && centerSealUrl ? (
                    <img src={centerSealUrl} alt="Sceau" className="w-[180px] h-[180px] object-contain" />
                  ) : centerLogoUrl ? (
                    <img src={centerLogoUrl} alt="Logo" className="w-[180px] h-[180px] object-contain" />
                  ) : null}
                </div>
              )}

              <div className="relative z-10 flex justify-between items-start text-[7px] border-b pb-1.5 font-serif">
                <div className="text-center w-[30%]">RÉPUBLIQUE DU CAMEROUN<br />Paix - Travail - Patrie</div>
                <div className="flex items-center gap-1.5">
                  {config.showLogo && centerLogoUrl && <img src={centerLogoUrl} alt="Logo" className="w-8 h-8 object-contain" />}
                  {config.showSeal && centerSealUrl && <img src={centerSealUrl} alt="Sceau" className="w-8 h-8 object-contain" />}
                </div>
                <div className="text-center w-[30%]">REPUBLIC OF CAMEROON<br />Peace - Work - Fatherland</div>
              </div>

              <div className="relative z-10 text-center space-y-1 my-auto">
                <h3 className="font-bold text-xs uppercase tracking-wider text-amber-700 font-serif">
                  {config.documentTitle || "DIPLÔME DE FIN DE FORMATION PROFESSIONNELLE"}
                </h3>
                <p className="text-[8px] text-on-surface-variant">Décerné avec les honneurs à :</p>
                <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">NGALEU ARMSTRONG EUCLADOR</h2>
                <p className="text-[8px] text-on-surface-variant font-mono">Matricule : STU26-0042 • Spécialité : Froid &amp; Climatisation (DQP)</p>
                <p className="text-[9px] font-bold text-amber-800 font-mono pt-1">MENTION OBTENUE : TRÈS BIEN</p>
              </div>

              <div className="relative z-10 flex justify-between items-end border-t pt-2 text-[8px]">
                <div className="text-center">
                  <Icon name="qr_code_2" className="text-3xl text-on-surface mx-auto block" />
                  <span className="text-[6px] font-mono text-primary font-bold">QR SCELLÉ HORS-LIGNE</span>
                </div>
                <div className="flex justify-around flex-1">
                  {(config.signatories || []).map((sig, idx) => (
                    <div key={idx} className="text-center">
                      <p className="font-bold underline">{sig.title}</p>
                      <p className="text-[7px] text-on-surface-variant font-mono">[Signature officielle]</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Rendu Format A4 Portrait (Bulletins, Relevés, Attestations) */}
          {selectedType !== "CARTE_ETUDIANT" && selectedType !== "DIPLOME_FIN_FORMATION" && (
            <div className="p-6 bg-white rounded-md border border-outline-variant/50 shadow-sm relative overflow-hidden text-[10px] leading-tight space-y-3 min-h-[480px] flex flex-col justify-between">
              {config.showWatermark && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none z-0" style={{ opacity: config.watermarkOpacity || 0.08 }}>
                  {config.watermarkType === "seal" && centerSealUrl ? (
                    <img src={centerSealUrl} alt="Sceau" className="w-[240px] h-[240px] object-contain" />
                  ) : centerLogoUrl ? (
                    <img src={centerLogoUrl} alt="Logo" className="w-[240px] h-[240px] object-contain" />
                  ) : null}
                </div>
              )}

              <div className="relative z-10 space-y-2">
                <div className="flex justify-between items-start text-[7.5px] font-serif border-b pb-2">
                  <div className="text-center font-semibold whitespace-pre-line w-[38%]">{config.headerLeft}</div>
                  <div className="flex items-center gap-1.5 justify-center w-[24%]">
                    {config.showLogo && centerLogoUrl && <img src={centerLogoUrl} alt="Logo" className="w-8 h-8 object-contain rounded-md" />}
                    {config.showSeal && centerSealUrl && <img src={centerSealUrl} alt="Sceau" className="w-8 h-8 object-contain" />}
                  </div>
                  <div className="text-center font-semibold whitespace-pre-line w-[38%]">{config.headerRight}</div>
                </div>

                <div className="text-center space-y-0.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-primary">{user?.center?.name || "CENTRE D'EXCELLENCE"}</h2>
                  <p className="text-[8px] text-on-surface-variant font-mono">Agrément : {user?.center?.registrationNumber || "MINEFOP"}</p>
                </div>

                <div className="text-center py-1.5 border-y border-outline-variant/30 my-1">
                  <h3 className="font-bold text-xs uppercase underline tracking-wider" style={{ color: config.primaryColor || "#0B1C30" }}>
                    {config.documentTitle || currentDocMeta?.label}
                  </h3>
                  {config.subTitle && <p className="text-[8.5px] font-bold text-on-surface-variant">{config.subTitle}</p>}
                </div>

                <div className="p-2.5 bg-surface rounded-md border border-outline-variant/20 space-y-0.5 text-[9px]">
                  <p><strong>Apprenant :</strong> NGALEU Armstrong Euclador • <strong>Matricule :</strong> STU26-0042</p>
                  <p><strong>Filière :</strong> Froid &amp; Climatisation (Niveau 1) • <strong>Session :</strong> 2026-2027</p>
                </div>

                {/* Table miniature pour les bulletins */}
                {(selectedType === "BULLETIN_SEMESTRE" || selectedType === "BULLETIN_CC" || selectedType === "RELEVE_ANNUEL") && (
                  <div className="border border-outline-variant/30 rounded overflow-hidden text-[8px]">
                    <div className="p-1 bg-ink text-white font-bold flex justify-between">
                      <span>Matière</span>
                      <span>Note /20</span>
                    </div>
                    <div className="p-1 bg-surface flex justify-between border-b font-semibold">
                      <span>Thermodynamique appliquée (C3)</span>
                      <span className="font-mono">14.50 / 20</span>
                    </div>
                    <div className="p-1 flex justify-between border-b font-semibold">
                      <span>Électrotechnique (C2)</span>
                      <span className="font-mono">12.00 / 20</span>
                    </div>
                    <div className="p-1 bg-primary-light text-primary font-bold flex justify-between">
                      <span>Moyenne Générale : 13.50 / 20</span>
                      <span>Rang : 1er / 24</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Signatures et QR Code */}
              <div className="relative z-10 pt-2 border-t border-outline-variant/30 space-y-2">
                <div className="flex justify-between items-end text-[8px]">
                  {currentDocMeta?.isExternal ? (
                    <div className="text-center w-1/4">
                      <div className="w-10 h-10 bg-surface rounded-md border border-outline-variant/30 mx-auto flex items-center justify-center">
                        <Icon name="qr_code_2" className="text-2xl text-on-surface" />
                      </div>
                      <span className="text-[6px] font-mono text-primary font-bold">QR HORS-LIGNE</span>
                    </div>
                  ) : <div className="w-1/4" />}

                  <div className="flex-1 flex justify-around">
                    {(config.signatories || []).map((sig, idx) => (
                      <div key={idx} className="text-center">
                        <p className="font-bold underline">{sig.title}</p>
                        <p className="text-[7px] text-on-surface-variant font-mono">[Signature officielle]</p>
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