// packages/frontend/src/modules/documents/DocumentStudioPage.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch, apiFetchImageUrl } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Select from "../../design-system/primitives/Select";
import Textarea from "../../design-system/primitives/Textarea";
import Checkbox from "../../design-system/primitives/Checkbox";
import Badge from "../../design-system/primitives/Badge";
import Icon from "../../components/Icon";
import useAuthStore from "../../store/authStore";

const DOCUMENT_SECTIONS = [
  {
    id: "cartes",
    title: "1. Cartes & Badges d'Identité",
    icon: "badge",
    description: "Format bancaire CR80 avec QR Code autonome et filigrane.",
    items: [
      { key: "CARTE_ETUDIANT", label: "Carte d'Apprenant (Badge)", icon: "badge", isExternal: true },
    ],
  },
  {
    id: "internes",
    title: "2. Documents Internes & Pédagogiques",
    icon: "folder_shared",
    description: "Fiches, bordereaux de notes et procès-verbaux de jury.",
    items: [
      { key: "FICHE_INSCRIPTION", label: "Fiche d'Inscription", icon: "description", isExternal: false },
      { key: "BORDEREAU_VIERGE", label: "Bordereau Vierge", icon: "edit_document", isExternal: false },
      { key: "PV_MATIERE", label: "Procès-Verbal Matière", icon: "assignment_turned_in", isExternal: false },
      { key: "PV_SEMESTRE", label: "PV Délibération Semestre", icon: "table_chart", isExternal: false },
    ],
  },
  {
    id: "externes",
    title: "3. Documents Externes & Certifiés",
    icon: "verified",
    description: "Certificats, bulletins semestriels, relevés annuels et diplômes d'État.",
    items: [
      { key: "ATTESTATION_INSCRIPTION", label: "Certificat de Scolarité", icon: "verified", isExternal: true },
      { key: "BULLETIN_CC", label: "Bulletin CC & TP", icon: "fact_check", isExternal: true },
      { key: "BULLETIN_SEMESTRE", label: "Bulletin Semestriel Bilingue", icon: "receipt_long", isExternal: true },
      { key: "RELEVE_ANNUEL", label: "Relevé de Notes Annuel", icon: "history_edu", isExternal: true },
      { key: "DIPLOME_FIN_FORMATION", label: "Diplôme de Fin de Formation", icon: "workspace_premium", isExternal: true },
    ],
  },
];

const DEFAULT_CONFIGS = {
  BULLETIN_SEMESTRE: {
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING",
    subHeaderCenter: "DÉLÉGATION RÉGIONALE DU CENTRE\nDÉLÉGATION DÉPARTEMENTALE DU MFOUNDI",
    documentTitle: "BULLETIN SEMESTRIEL DE NOTES / SEMESTER REPORT CARD",
    subTitle: "ÉVALUATION PÉRIODIQUE OFFICIELLE",
    primaryColor: "#004080",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "seal",
    watermarkOpacity: 0.08,
    signatories: [
      { title: "Le Promoteur", roleKey: "promoteur" },
      { title: "Le Directeur Général", roleKey: "directeur" },
    ],
    footerLegal: "Toute rature ou surcharge annule la validité du présent bulletin officiel • Registre CECO ERP",
  },
  CARTE_ETUDIANT: {
    themeColor: "#004080",
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
  DIPLOME_FIN_FORMATION: {
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING",
    documentTitle: "DIPLÔME DE FIN DE FORMATION PROFESSIONNELLE",
    subTitle: "VOCATIONAL GRADUATION DIPLOMA",
    primaryColor: "#004080",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "seal",
    watermarkOpacity: 0.08,
    signatories: [
      { title: "Le Promoteur / Fondateur", roleKey: "promoteur" },
      { title: "Le Directeur de l'Établissement", roleKey: "directeur" },
    ],
    footerLegal: "Titre officiel de qualification professionnelle certifié conforme • Registre sécurisé CECO ERP",
  },
  ATTESTATION_INSCRIPTION: {
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING",
    subHeaderCenter: "DÉLÉGATION RÉGIONALE DU CENTRE\nDÉLÉGATION DÉPARTEMENTALE DU MFOUNDI",
    documentTitle: "CERTIFICAT DE SCOLARITÉ & D'INSCRIPTION",
    subTitle: "ATTESTATION OF ENROLMENT",
    primaryColor: "#004080",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "seal",
    watermarkOpacity: 0.08,
    signatories: [
      { title: "Le Promoteur", roleKey: "promoteur" },
      { title: "Le Directeur Général", roleKey: "directeur" },
    ],
    footerLegal: "Toute falsification expose son auteur aux poursuites prévues par le Code Pénal.",
  },
  FICHE_INSCRIPTION: {
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING",
    subHeaderCenter: "DÉLÉGATION RÉGIONALE DU CENTRE\nDÉLÉGATION DÉPARTEMENTALE DU MFOUNDI",
    documentTitle: "FICHE INDIVIDUELLE D'INSCRIPTION & D'ENGAGEMENT",
    primaryColor: "#004080",
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
};

export default function DocumentStudioPage() {
  const user = useAuthStore((s) => s.user);
  const [selectedType, setSelectedType] = useState("BULLETIN_SEMESTRE");
  const [config, setConfig] = useState(DEFAULT_CONFIGS.BULLETIN_SEMESTRE);
  const [availableSignatureRoles, setAvailableSignatureRoles] = useState([
    { key: "directeur", title: "Directeur Général" },
    { key: "promoteur", title: "Promoteur / Fondateur" },
  ]);

  const [saving, setSaving] = useState(false);
  const [centerLogoUrl, setCenterLogoUrl] = useState(null);
  const [centerSealUrl, setCenterSealUrl] = useState(null);
  const [cardPreviewSide, setCardPreviewSide] = useState("recto");

  useEffect(() => {
    Promise.all([
      apiFetch("/center"),
      apiFetch("/center/signature-roles").catch(() => [
        { key: "directeur", title: "Directeur Général" },
        { key: "promoteur", title: "Promoteur / Fondateur" },
      ]),
    ]).then(async ([centerData, rolesData]) => {
      if (rolesData) setAvailableSignatureRoles(rolesData);
      if (centerData?.hasLogo) {
        const logoUrl = await apiFetchImageUrl("/center/logo");
        setCenterLogoUrl(logoUrl);
      }
      const sealUrl = await apiFetchImageUrl("/center/seal");
      setCenterSealUrl(sealUrl);
    }).catch(() => {});
  }, []);

  function handleSelectType(newType) {
    setSelectedType(newType);
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
    try {
      await apiFetch(`/documents/templates/${selectedType}`, {
        method: "PUT",
        body: JSON.stringify({ config }),
      });
      showToast("Gabarit officiel enregistré avec succès.", "success");
    } catch (err) {
      showToast(err.message || "Erreur d'enregistrement.", "error");
    } finally {
      setSaving(false);
    }
  }

  // Détection de l'image de filigrane active
  const watermarkImgSrc = config.watermarkType === "seal" ? (centerSealUrl || centerLogoUrl) : (centerLogoUrl || centerSealUrl);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Administration • Studio Vectoriel</Badge>}
        title="Studio des Gabarits d'Actes &amp; Diplômes"
        subtitle="Personnalisation des en-têtes républicains, filigranes translucides, couleurs et signatures scannées"
        actions={
          <Button variant="primary" icon="save" onClick={handleSubmit} isLoading={saving}>
            Enregistrer le Gabarit
          </Button>
        }
      />

      {/* Sélecteur de Gabarits en 3 Catégories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DOCUMENT_SECTIONS.map((sec) => (
          <div key={sec.id} className="p-4 rounded bg-surface border border-border shadow-xs space-y-3 flex flex-col justify-between dark:bg-surface-dark dark:border-border-dark">
            <div>
              <div className="flex items-center gap-2 text-brand-900 border-b border-border pb-2.5 dark:text-brand-500 dark:border-border-dark">
                <Icon name={sec.icon} className="text-[20px]" />
                <span className="font-heading font-semibold text-body-sm text-ink-primary dark:text-white">{sec.title}</span>
              </div>
              <p className="text-caption text-ink-muted mt-1.5 leading-relaxed">{sec.description}</p>
            </div>

            <div className="space-y-1.5 pt-2">
              {sec.items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => handleSelectType(it.key)}
                  className={`w-full p-2.5 rounded text-body-sm text-left transition-colors flex items-center justify-between border ${
                    selectedType === it.key
                      ? "bg-brand-900 text-white border-brand-900 shadow-xs font-semibold dark:bg-brand-500"
                      : "bg-[#F5F7FA] text-ink-primary border-border hover:bg-surface dark:bg-[#07111D] dark:border-border-dark dark:text-ink-primary-dark"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon name={it.icon} className="text-[18px] flex-shrink-0" />
                    <span className="truncate">{it.label}</span>
                  </div>
                  {it.isExternal && (
                    <Badge variant={selectedType === it.key ? "brand" : "neutral"} className={selectedType === it.key ? "bg-white/20 text-white border-transparent" : ""}>
                      QR SCELLÉ
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ÉCRAN SCINDÉ (SPLIT VIEW) : CONFIGURATION À GAUCHE (5 cols) | APERÇU HAUTE FIDÉLITÉ À DROITE (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panneau de Configuration */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 p-6 rounded bg-surface border border-border shadow-xs space-y-4 dark:bg-surface-dark dark:border-border-dark">
          <div className="flex items-center justify-between border-b border-border pb-3 dark:border-border-dark">
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans">
              Configuration : {selectedType}
            </h3>
            <Badge variant="brand">Gabarit Actif</Badge>
          </div>

          {selectedType === "CARTE_ETUDIANT" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Couleur bandeau" type="color" value={config.themeColor || "#004080"} onChange={(e) => setConfig({ ...config, themeColor: e.target.value })} />
                <Input label="Couleur accent (Matricule)" type="color" value={config.accentColor || "#5E72E4"} onChange={(e) => setConfig({ ...config, accentColor: e.target.value })} />
              </div>
              <Input label="Titre de face" value={config.cardTitle || ""} onChange={(e) => setConfig({ ...config, cardTitle: e.target.value })} />
              <div className="grid grid-cols-2 gap-3 p-3 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark">
                <Checkbox label="Afficher Logo" checked={config.showLogo ?? true} onChange={(e) => setConfig({ ...config, showLogo: e.target.checked })} />
                <Checkbox label="Afficher Sceau d'État" checked={config.showSeal ?? true} onChange={(e) => setConfig({ ...config, showSeal: e.target.checked })} />
              </div>
              <Textarea label="Conditions d'usage (Verso)" rows={3} value={config.termsOfUse || ""} onChange={(e) => setConfig({ ...config, termsOfUse: e.target.value })} />
              <Input label="Titre du Signataire (Verso)" value={config.signatoryTitle || ""} onChange={(e) => setConfig({ ...config, signatoryTitle: e.target.value })} />
            </div>
          ) : (
            <div className="space-y-4">
              {selectedType !== "DIPLOME_FIN_FORMATION" && (
                <div className="p-4 rounded bg-[#F5F7FA] border border-border space-y-3 dark:bg-[#07111D] dark:border-border-dark">
                  <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold block">En-tête Bilingue Officiel</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Textarea label="Volet Gauche (Français)" rows={3} value={config.headerLeft || ""} onChange={(e) => setConfig({ ...config, headerLeft: e.target.value })} />
                    <Textarea label="Volet Droit (Anglais)" rows={3} value={config.headerRight || ""} onChange={(e) => setConfig({ ...config, headerRight: e.target.value })} />
                  </div>
                  <Input label="Délégations Régionales & Départementales" value={config.subHeaderCenter || ""} onChange={(e) => setConfig({ ...config, subHeaderCenter: e.target.value })} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input label="Titre officiel de l'acte" value={config.documentTitle || ""} onChange={(e) => setConfig({ ...config, documentTitle: e.target.value })} />
                <Input label="Couleur primaire du centre" type="color" value={config.primaryColor || "#004080"} onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark">
                <Checkbox label="Afficher Logo" checked={config.showLogo ?? true} onChange={(e) => setConfig({ ...config, showLogo: e.target.checked })} />
                <Checkbox label="Afficher Sceau de l'État" checked={config.showSeal ?? true} onChange={(e) => setConfig({ ...config, showSeal: e.target.checked })} />
              </div>

              {/* Paramétrage du Filigrane Translucide */}
              <div className="p-4 rounded bg-[#F5F7FA] border border-border space-y-3 dark:bg-[#07111D] dark:border-border-dark">
                <div className="flex items-center justify-between">
                  <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold">Filigrane de Sécurité Translucide</span>
                  <Checkbox checked={config.showWatermark ?? true} onChange={(e) => setConfig({ ...config, showWatermark: e.target.checked })} />
                </div>

                {config.showWatermark && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border dark:border-border-dark items-center">
                    <Select label="Image de fond" value={config.watermarkType || "seal"} onChange={(e) => setConfig({ ...config, watermarkType: e.target.value })}>
                      <option value="seal">Sceau de la République</option>
                      <option value="logo">Logo de l'Établissement</option>
                    </Select>
                    <div>
                      <div className="flex justify-between text-caption font-semibold mb-1">
                        <span>Opacité :</span>
                        <span className="font-mono text-brand-900 dark:text-brand-500">{Math.round((config.watermarkOpacity || 0.08) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.03"
                        max="0.20"
                        step="0.01"
                        value={config.watermarkOpacity || 0.08}
                        onChange={(e) => setConfig({ ...config, watermarkOpacity: parseFloat(e.target.value) })}
                        className="w-full accent-brand-900 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Signataires dynamiques */}
              <div className="p-4 rounded bg-[#F5F7FA] border border-border space-y-3 dark:bg-[#07111D] dark:border-border-dark">
                <div className="flex items-center justify-between">
                  <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold">Signatures &amp; Visas (Pied de Page)</span>
                  <Button variant="tertiary" size="sm" icon="add" onClick={handleAddSignatory} disabled={(config.signatories?.length || 0) >= 3}>
                    Ajouter
                  </Button>
                </div>

                <div className="space-y-2">
                  {(config.signatories || []).map((sig, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded bg-surface border border-border dark:bg-surface-dark dark:border-border-dark">
                      <input
                        type="text"
                        value={sig.title}
                        onChange={(e) => handleUpdateSignatory(idx, "title", e.target.value)}
                        placeholder="Intitulé officiel"
                        className="h-8 rounded bg-surface px-2 text-caption border border-border flex-1 outline-none dark:bg-surface-dark"
                      />
                      <select
                        value={sig.roleKey || "directeur"}
                        onChange={(e) => handleUpdateSignatory(idx, "roleKey", e.target.value)}
                        className="h-8 rounded bg-surface px-2 text-caption font-semibold border border-border outline-none w-40 dark:bg-surface-dark"
                      >
                        {availableSignatureRoles.map((r) => (
                          <option key={r.key} value={r.key}>{r.title}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveSignatory(idx)}
                        disabled={(config.signatories?.length || 0) <= 1}
                        className="text-error hover:bg-error-subtle p-1 rounded"
                      >
                        <Icon name="delete" className="text-[16px]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <Input label="Mention légale de bas de page" value={config.footerLegal || ""} onChange={(e) => setConfig({ ...config, footerLegal: e.target.value })} />
            </div>
          )}
        </form>

        {/* Panneau Droit : Rendu Vectoriel en Direct Haute Fidélité */}
        <div className="lg:col-span-7 p-6 rounded bg-surface border border-border shadow-xs space-y-4 flex flex-col justify-between dark:bg-surface-dark dark:border-border-dark">
          <div className="flex items-center justify-between border-b border-border pb-3 dark:border-border-dark">
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans">Aperçu Vectoriel en Direct (Haute Fidélité)</h3>
            {selectedType === "CARTE_ETUDIANT" ? (
              <div className="flex p-0.5 bg-[#F5F7FA] rounded border border-border dark:bg-[#07111D] dark:border-border-dark">
                <button
                  type="button"
                  onClick={() => setCardPreviewSide("recto")}
                  className={`px-3 py-1 text-caption font-semibold rounded-[2px] ${cardPreviewSide === "recto" ? "bg-brand-900 text-white dark:bg-brand-500" : "text-ink-secondary"}`}
                >
                  Face Recto
                </button>
                <button
                  type="button"
                  onClick={() => setCardPreviewSide("verso")}
                  className={`px-3 py-1 text-caption font-semibold rounded-[2px] ${cardPreviewSide === "verso" ? "bg-brand-900 text-white dark:bg-brand-500" : "text-ink-secondary"}`}
                >
                  Dos Verso
                </button>
              </div>
            ) : (
              <Badge variant="brand">{selectedType === "DIPLOME_FIN_FORMATION" ? "A4 Paysage (Diplôme d'État)" : "A4 Portrait (Bulletin Bilingue)"}</Badge>
            )}
          </div>

          <div className="p-6 bg-[#CBD5E1]/30 rounded border border-border flex items-center justify-center min-h-[500px] overflow-auto dark:bg-[#07111D] dark:border-border-dark">
            {/* 1. APERÇU BADGE CARTE CR80 */}
            {selectedType === "CARTE_ETUDIANT" && (
              cardPreviewSide === "recto" ? (
                <div className="w-[340px] h-[215px] rounded bg-white border border-slate-300 shadow-md p-3.5 flex flex-col justify-between relative overflow-hidden text-[9px] select-none">
                  {config.showWatermark && watermarkImgSrc && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0" style={{ opacity: config.watermarkOpacity || 0.08 }}>
                      <img src={watermarkImgSrc} alt="Filigrane" className="w-32 h-32 object-contain" />
                    </div>
                  )}

                  <div className="relative z-10 -mx-3.5 -mt-3.5 px-3.5 py-2.5 flex items-center justify-between text-white" style={{ backgroundColor: config.themeColor || "#004080" }}>
                    <div className="flex items-center gap-2 max-w-[250px]">
                      {config.showLogo && centerLogoUrl && (
                        <img src={centerLogoUrl} alt="Logo" className="w-6 h-6 object-contain rounded bg-white p-0.5" />
                      )}
                      <div className="leading-none truncate">
                        <p className="font-bold text-[9px] uppercase truncate">{user?.center?.name || "CENTRE DE FORMATION"}</p>
                        <span className="text-[7.5px] text-slate-200 font-bold">{config.cardTitle || "CARTE D'APPRENANT"}</span>
                      </div>
                    </div>
                    {config.showSeal && centerSealUrl && (
                      <img src={centerSealUrl} alt="Sceau" className="w-6 h-6 object-contain" />
                    )}
                  </div>

                  <div className="relative z-10 flex gap-3 items-center my-auto">
                    <div className="w-16 h-20 rounded-[2px] bg-slate-100 border border-slate-200 flex items-center justify-center shadow-inner overflow-hidden flex-shrink-0">
                      <Icon name="person" className="text-4xl text-slate-400" />
                    </div>
                    <div className="space-y-1 text-slate-900 leading-tight">
                      <p><strong className="text-slate-500">NOM :</strong> NGALEU</p>
                      <p><strong className="text-slate-500">PRÉNOM :</strong> Armstrong Euclador</p>
                      <p><strong className="text-slate-500">MATRICULE :</strong> <span className="font-mono font-bold" style={{ color: config.accentColor || "#5E72E4" }}>STU26-0042</span></p>
                      <p><strong className="text-slate-500">FILIÈRE :</strong> Froid &amp; Climatisation</p>
                      <p><strong className="text-slate-500">NIVEAU :</strong> Niveau 1 (DQP)</p>
                    </div>
                  </div>

                  <div className="relative z-10 flex justify-between items-center text-[8px] text-slate-500 pt-1 border-t border-slate-200 font-mono">
                    <span>Session : 2026-2027</span>
                    <span className="font-bold" style={{ color: config.accentColor || "#5E72E4" }}>CECO ID-PASS</span>
                  </div>
                </div>
              ) : (
                <div className="w-[340px] h-[215px] rounded bg-white border border-slate-300 shadow-md p-3.5 flex flex-col justify-between relative overflow-hidden text-[8.5px] select-none leading-tight">
                  <div className="space-y-1.5">
                    <span className="font-bold uppercase tracking-wider" style={{ color: config.themeColor || "#004080" }}>Conditions d'Utilisation</span>
                    <p className="text-slate-600 text-[8px] leading-normal">{config.termsOfUse}</p>
                    <p className="text-slate-500 text-[7.5px] font-mono">Agrément : {user?.center?.registrationNumber || "MINEFOP"} • Tél : {user?.center?.phone || ""}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                    <div className="p-1 bg-slate-50 rounded border border-slate-200">
                      <Icon name="qr_code_2" className="text-4xl text-slate-800" />
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="text-[7.5px] text-slate-500 font-mono">QR Certifié Hors-Ligne</span>
                      <p className="font-mono text-[7.5px] font-bold text-brand-900">CECO-OFFICIAL-AUTH</p>
                      <p className="font-bold text-[8.5px] text-slate-900 mt-1">{config.signatoryTitle || "Le Directeur Général"}</p>
                    </div>
                  </div>

                  <div className="-mx-3.5 -mb-3.5 px-3.5 py-1.5 bg-brand-900 text-white flex justify-between items-center text-[7.5px]">
                    <span className="text-white/70">Propriété de l'établissement</span>
                    <span className="font-bold tracking-wider">PROPULSÉ PAR CECO</span>
                  </div>
                </div>
              )
            )}

            {/* 2. APERÇU DIPLÔME DE FIN DE FORMATION PAYSAGE A4 */}
            {selectedType === "DIPLOME_FIN_FORMATION" && (
              <div className="w-[520px] h-[340px] bg-white rounded border-2 border-amber-400 p-5 shadow-md flex flex-col justify-between text-[8.5px] text-center relative overflow-hidden select-none">
                {/* Bordure Ornementale Fleurons */}
                <div className="pointer-events-none absolute inset-1.5 border border-amber-500/60 rounded-[2px]" />
                <div className="pointer-events-none absolute inset-2.5 border border-brand-900/40 rounded-[2px]" />

                {config.showWatermark && watermarkImgSrc && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0" style={{ opacity: config.watermarkOpacity || 0.08 }}>
                    <img src={watermarkImgSrc} alt="Filigrane" className="w-48 h-48 object-contain" />
                  </div>
                )}

                <div className="relative z-10 flex justify-between text-[7px] font-serif border-b border-amber-300 pb-1.5">
                  <div className="w-[38%] whitespace-pre-line text-center">{config.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI"}</div>
                  
                  <div className="flex items-center justify-center gap-2 flex-1">
                    {config.showSeal && centerSealUrl && <img src={centerSealUrl} alt="Sceau" className="w-8 h-8 object-contain" />}
                    {config.showLogo && centerLogoUrl && <img src={centerLogoUrl} alt="Logo" className="w-8 h-8 object-contain rounded" />}
                  </div>

                  <div className="w-[38%] whitespace-pre-line text-center">{config.headerRight || "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT"}</div>
                </div>

                <div className="relative z-10 space-y-1 my-auto">
                  <h4 className="font-serif font-bold text-sm text-amber-800 uppercase tracking-wider">{config.documentTitle || "DIPLÔME DE FIN DE FORMATION"}</h4>
                  <p className="text-[8.5px] text-slate-600 font-serif italic">Le présent parchemin est officiellement décerné avec les honneurs à :</p>
                  <h3 className="font-bold text-base text-slate-900 tracking-wide uppercase">NGALEU ARMSTRONG EUCLADOR</h3>
                  <p className="font-mono text-[8px] text-slate-600">Né le 14/08/2002 à Bafoussam • Matricule : STU26-0042</p>
                  <p className="text-[9.5px] font-bold text-brand-900 pt-0.5">Spécialité : FROID ET CLIMATISATION (DQP)</p>
                  <p className="text-[9px] font-bold text-amber-700 font-mono">MENTION OBTENUE : TRÈS BIEN</p>
                </div>

                <div className="relative z-10 flex justify-between items-end border-t border-amber-300 pt-1.5 text-[7.5px]">
                  <div className="text-center">
                    <Icon name="qr_code_2" className="text-3xl text-slate-800 mx-auto block" />
                    <span className="text-[6px] font-mono text-brand-900 font-bold">QR SCELLÉ HORS-LIGNE</span>
                  </div>
                  <div className="flex justify-around flex-1">
                    {(config.signatories || []).map((s, i) => (
                      <div key={i} className="text-center">
                        <span className="font-bold underline block">{s.title}</span>
                        <span className="text-[6.5px] text-slate-400 font-mono">[Signature certifiée : {s.roleKey}]</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. APERÇU BULLETIN SEMESTRIEL BILINGUE A4 PORTRAIT */}
            {selectedType !== "CARTE_ETUDIANT" && selectedType !== "DIPLOME_FIN_FORMATION" && (
              <div className="w-[360px] h-[510px] bg-white rounded border border-slate-300 p-4 shadow-md flex flex-col justify-between text-[8px] relative overflow-hidden select-none leading-tight">
                {config.showWatermark && watermarkImgSrc && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0" style={{ opacity: config.watermarkOpacity || 0.08 }}>
                    <img src={watermarkImgSrc} alt="Filigrane" className="w-56 h-56 object-contain" />
                  </div>
                )}

                <div className="relative z-10 space-y-1.5">
                  <div className="flex justify-between text-[6.5px] font-serif border-b border-slate-200 pb-1">
                    <div className="w-[36%] whitespace-pre-line text-center">{config.headerLeft}</div>
                    <div className="flex flex-col items-center justify-center flex-1">
                      <div className="flex items-center gap-1.5">
                        {config.showSeal && centerSealUrl && <img src={centerSealUrl} alt="Sceau" className="w-7 h-7 object-contain" />}
                        {config.showLogo && centerLogoUrl && <img src={centerLogoUrl} alt="Logo" className="w-7 h-7 object-contain rounded" />}
                      </div>
                      {user?.center?.phone && <span className="text-[6px] font-mono text-slate-500 font-bold mt-0.5">Tél : {user.center.phone}</span>}
                    </div>
                    <div className="w-[36%] whitespace-pre-line text-center">{config.headerRight}</div>
                  </div>

                  <div className="text-center space-y-0.5">
                    <h2 className="text-[10px] font-bold uppercase tracking-wider text-brand-900">{user?.center?.name || "CENTRE D'EXCELLENCE"}</h2>
                    {user?.center?.registrationNumber && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-[6.5px] font-mono font-bold text-slate-700">
                        ARRÊTÉ D'AGRÉMENT N° {user.center.registrationNumber}
                      </span>
                    )}
                  </div>

                  {/* Bandeau de Titre Bleu Nuit à Liserés Or */}
                  <div className="text-center py-1 rounded bg-brand-900 text-white border-y-2 border-amber-400 shadow-xs">
                    <h3 className="font-bold text-[8.5px] uppercase tracking-wider">{config.documentTitle || selectedType}</h3>
                    {config.subTitle && <p className="text-[6.5px] text-amber-200">{config.subTitle}</p>}
                  </div>

                  {/* Cartouche Apprenant */}
                  <div className="p-2 rounded bg-slate-50 border border-slate-200 flex justify-between items-center text-[7.5px]">
                    <div className="space-y-0.5">
                      <p><strong>NOM :</strong> <span className="font-bold text-brand-900">NGALEU ARMSTRONG EUCLADOR</span></p>
                      <p><strong>MATRICULE :</strong> <span className="font-mono font-bold bg-amber-200 text-brand-900 px-1 rounded">STU26-0042</span> • <strong>SEXE :</strong> M</p>
                      <p><strong>FILIÈRE :</strong> Froid &amp; Climatisation (Niveau 1 • DQP)</p>
                    </div>
                    <div className="w-10 h-12 bg-white border border-slate-200 rounded flex items-center justify-center">
                      <Icon name="person" className="text-2xl text-slate-400" />
                    </div>
                  </div>

                  {/* Tableau des Notes avec Sous-Groupes */}
                  <div className="border border-slate-200 rounded overflow-hidden text-[7px]">
                    <div className="bg-brand-900 text-white font-bold p-1 flex justify-between">
                      <span>MODULE / DISCIPLINE</span>
                      <span>CC /20</span>
                      <span>EXAM /20</span>
                      <span>FINALE</span>
                      <span>APPRÉCIATION</span>
                    </div>
                    <div className="p-0.5 bg-slate-100 font-bold border-b text-[6.5px]">
                      1ER GROUPE : MATIÈRES PROFESSIONNELLES (COEF 5)
                    </div>
                    <div className="p-0.5 flex justify-between border-b">
                      <span className="w-1/3 truncate">Thermodynamique (C3)</span>
                      <span>14.00</span>
                      <span>15.00</span>
                      <span className="font-bold text-brand-900">14.70</span>
                      <span className="text-emerald-700 font-bold">Bien</span>
                    </div>
                    <div className="p-0.5 flex justify-between border-b">
                      <span className="w-1/3 truncate">Électrotechnique (C2)</span>
                      <span>11.50</span>
                      <span>12.00</span>
                      <span className="font-bold text-brand-900">11.85</span>
                      <span className="text-amber-700 font-bold">Passable</span>
                    </div>
                  </div>

                  {/* Double Grille Récapitulative Synoptique */}
                  <div className="grid grid-cols-2 gap-1 text-[7px]">
                    <div className="p-1 rounded bg-slate-50 border border-slate-200 space-y-0.5">
                      <div className="flex justify-between font-bold">
                        <span>MOYENNE :</span>
                        <span className="bg-amber-200 text-brand-900 px-1 rounded">13.28 / 20</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>MOY. CLASSE : 11.45</span>
                        <span>RÉUSSITE : 87.5%</span>
                      </div>
                    </div>

                    <div className="p-1 rounded bg-slate-50 border border-slate-200 space-y-0.5">
                      <div className="flex justify-between font-bold">
                        <span>RANG : <span className="bg-amber-200 text-brand-900 px-1 rounded">2e / 24</span></span>
                        <span className="text-brand-900">BIEN</span>
                      </div>
                      <div className="font-bold text-emerald-600 text-center">DÉCISION : ADMIS(E)</div>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 flex justify-between items-end border-t border-slate-200 pt-1 text-[7px]">
                  <div className="text-center">
                    <Icon name="qr_code_2" className="text-2xl text-slate-800 block mx-auto" />
                    <span className="text-[5.5px] font-mono text-brand-900 font-bold">QR SCELLÉ</span>
                  </div>
                  <div className="flex justify-around flex-1">
                    {(config.signatories || []).map((s, i) => (
                      <div key={i} className="text-center">
                        <span className="font-bold underline block">{s.title}</span>
                        <span className="text-[6px] text-slate-400 font-mono">[Signature : {s.roleKey}]</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}