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
      { key: "PV_CC", label: "PV Contrôle Continu (CC)", icon: "fact_check", isExternal: false },
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
  {
    id: "examens_blancs",
    title: "4. Actes d'Examens Blancs & Délégation",
    icon: "school",
    description: "Bordereaux officiels réglementaires pour la Délégation MINEFOP (sans QR code).",
    items: [
      { key: "PV_EXAMEN_BLANC", label: "Bordereau Officiel des Notes (MINEFOP)", icon: "assignment", isExternal: false },
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
    primaryColor: "#071A2E",
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
    themeColor: "#071A2E",
    accentColor: "#18527A",
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
    primaryColor: "#071A2E",
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
    primaryColor: "#071A2E",
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
    primaryColor: "#071A2E",
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
  PV_EXAMEN_BLANC: {
    headerLeft: "REPUBLIQUE DU CAMEROUN\nPaix – Travail – Patrie\n*********\nREGION DE L'OUEST\n*********\nDELEGATION REGIONALE DE L'EMPLOI ET DE LA\nFORMATION PROFESSIONNELLE\n*********\nINSPECTION REGIONALE DES FORMATIONS\n*********",
    headerRight: "REPUBLIC OF CAMEROON\nPeace – Work – Fatherland\n*********\nWEST REGION\n*********\nREGIONAL DELEGATION OF EMPLOYMENT\nAND VOCATIONAL TRAINING\n*********\nREGIONAL INSPECTORATE OF TRAININGS\n*********",
    regionalContacts: {
      phone: "233 44 53 80 / 233 44 59 00",
      email: "drefopouest@yahoo.fr",
      city: "Bafoussam",
    },
    examBannerTitle: "EXAMEN REGIONAL DU DQP BLANC, SESSION DE 2026",
    examFrameTitle: "BORDEREAU DES NOTES DES CANDIDATS",
    signatoryTitle: "LE DELEGUE DEPARTEMENTAL",
    signatoryRoleKey: "delegue",
    primaryColor: "#000000",
  },
};

export default function DocumentStudioPage() {
  const user = useAuthStore((s) => s.user);
  const [selectedType, setSelectedType] = useState("BULLETIN_SEMESTRE");
  const [config, setConfig] = useState(DEFAULT_CONFIGS.BULLETIN_SEMESTRE);
  const [availableSignatureRoles, setAvailableSignatureRoles] = useState([
    { key: "directeur", title: "Directeur Général" },
    { key: "promoteur", title: "Promoteur / Fondateur" },
    { key: "delegue", title: "Le Délégué Départemental" },
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
        { key: "delegue", title: "Le Délégué Départemental" },
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
            regionalContacts: {
              ...(fallback.regionalContacts || {}),
              ...(data.regionalContacts || {}),
            },
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

  const watermarkImgSrc = config.watermarkType === "seal" ? (centerSealUrl || centerLogoUrl) : (centerLogoUrl || centerSealUrl);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Administration • Studio Vectoriel</Badge>}
        title="Studio des Gabarits d'Actes, Diplômes &amp; Bordereaux MINEFOP"
        subtitle="Personnalisation des mentions régionales, tutelles ministérielles, bandeaux d'examens blancs et signatures"
        actions={
          <Button variant="primary" icon="save" onClick={handleSubmit} isLoading={saving}>
            Enregistrer le Gabarit
          </Button>
        }
      />

      {/* Sélecteur de Gabarits en 4 Catégories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  {it.isExternal ? (
                    <Badge variant={selectedType === it.key ? "brand" : "neutral"} className={selectedType === it.key ? "bg-white/20 text-white border-transparent" : ""}>
                      QR SCELLÉ
                    </Badge>
                  ) : (
                    <Badge variant="neutral">SANS QR</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* SPLIT VIEW : Configuration (Gauche 5 cols) | Aperçu Vectoriel Haute Fidélité (Droite 7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulaire de Configuration */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 p-6 rounded bg-surface border border-border shadow-xs space-y-4 dark:bg-surface-dark dark:border-border-dark">
          <div className="flex items-center justify-between border-b border-border pb-3 dark:border-border-dark">
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans truncate max-w-[280px]">
              Configuration : {selectedType}
            </h3>
            <Badge variant="brand">Gabarit Actif</Badge>
          </div>

          {/* Configuration spécifique : PV_EXAMEN_BLANC */}
          {selectedType === "PV_EXAMEN_BLANC" ? (
            <div className="space-y-4">
              <div className="p-4 rounded bg-[#F5F7FA] border border-border space-y-3 dark:bg-[#07111D] dark:border-border-dark">
                <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold block">
                  En-tête de Tutelle Régionale MINEFOP
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Textarea
                    label="Volet Gauche (Français)"
                    rows={6}
                    value={config.headerLeft || ""}
                    onChange={(e) => setConfig({ ...config, headerLeft: e.target.value })}
                  />
                  <Textarea
                    label="Volet Droit (Anglais)"
                    rows={6}
                    value={config.headerRight || ""}
                    onChange={(e) => setConfig({ ...config, headerRight: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-4 rounded bg-[#F5F7FA] border border-border space-y-3 dark:bg-[#07111D] dark:border-border-dark">
                <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold block">
                  Contacts Officiels de la Délégation
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Téléphones officiels"
                    value={config.regionalContacts?.phone || ""}
                    onChange={(e) => setConfig({
                      ...config,
                      regionalContacts: { ...(config.regionalContacts || {}), phone: e.target.value },
                    })}
                  />
                  <Input
                    label="Email de la délégation"
                    value={config.regionalContacts?.email || ""}
                    onChange={(e) => setConfig({
                      ...config,
                      regionalContacts: { ...(config.regionalContacts || {}), email: e.target.value },
                    })}
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Ville de signature (ex: Bafoussam, Yaoundé)"
                      value={config.regionalContacts?.city || ""}
                      onChange={(e) => setConfig({
                        ...config,
                        regionalContacts: { ...(config.regionalContacts || {}), city: e.target.value },
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  label="Intitulé du bandeau supérieur d'examen"
                  placeholder="EXAMEN REGIONAL DU DQP BLANC, SESSION DE 2026"
                  value={config.examBannerTitle || ""}
                  onChange={(e) => setConfig({ ...config, examBannerTitle: e.target.value })}
                />
                <Input
                  label="Titre encadré du document"
                  placeholder="BORDEREAU DES NOTES DES CANDIDATS"
                  value={config.examFrameTitle || ""}
                  onChange={(e) => setConfig({ ...config, examFrameTitle: e.target.value })}
                />
                <Input
                  label="Titre officiel du signataire (Pied de page)"
                  placeholder="LE DELEGUE DEPARTEMENTAL"
                  value={config.signatoryTitle || ""}
                  onChange={(e) => setConfig({ ...config, signatoryTitle: e.target.value })}
                />
              </div>
            </div>
          ) : selectedType === "CARTE_ETUDIANT" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Couleur bandeau" type="color" value={config.themeColor || "#071A2E"} onChange={(e) => setConfig({ ...config, themeColor: e.target.value })} />
                <Input label="Couleur accent (Matricule)" type="color" value={config.accentColor || "#18527A"} onChange={(e) => setConfig({ ...config, accentColor: e.target.value })} />
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
                <Input label="Couleur primaire du centre" type="color" value={config.primaryColor || "#071A2E"} onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark">
                <Checkbox label="Afficher Logo" checked={config.showLogo ?? true} onChange={(e) => setConfig({ ...config, showLogo: e.target.checked })} />
                <Checkbox label="Afficher Sceau de l'État" checked={config.showSeal ?? true} onChange={(e) => setConfig({ ...config, showSeal: e.target.checked })} />
              </div>

              <div className="p-4 rounded bg-[#F5F7FA] border border-border space-y-3 dark:bg-[#07111D] dark:border-border-dark">
                <div className="flex items-center justify-between">
                  <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold">Filigrane de Sécurité</span>
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

              <div className="p-4 rounded bg-[#F5F7FA] border border-border space-y-3 dark:bg-[#07111D] dark:border-border-dark">
                <div className="flex items-center justify-between">
                  <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold">Signataires &amp; Visas</span>
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
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans">Aperçu Vectoriel en Direct</h3>
            {selectedType === "PV_EXAMEN_BLANC" ? (
              <Badge variant="brand">Modèle Officiel MINEFOP • Sans QR Code</Badge>
            ) : selectedType === "CARTE_ETUDIANT" ? (
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
              <Badge variant="brand">{selectedType === "DIPLOME_FIN_FORMATION" ? "A4 Paysage" : "A4 Portrait"}</Badge>
            )}
          </div>

          <div className="p-6 bg-[#CBD5E1]/30 rounded border border-border flex items-center justify-center min-h-[520px] overflow-auto dark:bg-[#07111D] dark:border-border-dark">
            {/* APERÇU SPÉCIFIQUE DU BORDEREAU MINEFOP (Image) */}
            {selectedType === "PV_EXAMEN_BLANC" ? (
              <div className="w-[420px] bg-white rounded border border-slate-300 p-4 shadow-md flex flex-col justify-between text-[7px] select-none text-black leading-tight">
                {/* En-tête Régional */}
                <div className="flex justify-between text-[5.5px] border-b border-black pb-1.5 font-bold">
                  <div className="w-[48%] whitespace-pre-line text-center">
                    {config.headerLeft}
                    <div className="mt-0.5">Tél : {config.regionalContacts?.phone}</div>
                  </div>
                  <div className="w-[48%] whitespace-pre-line text-center">
                    {config.headerRight}
                    <div className="mt-0.5">Email : {config.regionalContacts?.email}</div>
                    <div className="mt-1 font-normal text-right">{config.regionalContacts?.city}, le ____________</div>
                  </div>
                </div>

                {/* Bandeau Grisé */}
                <div className="my-2 p-1 bg-slate-300 text-center font-bold text-[8.5px] border border-slate-400 uppercase tracking-tight">
                  {config.examBannerTitle || "EXAMEN REGIONAL DU DQP BLANC, SESSION DE 2026"}
                </div>

                {/* Cadre Fermé Bordereau */}
                <div className="mb-2 py-1 px-2 border-2 border-black text-center font-bold text-[9.5px] uppercase tracking-wide">
                  {config.examFrameTitle || "BORDEREAU DES NOTES DES CANDIDATS"}
                </div>

                {/* Cartouche Métier */}
                <div className="text-center font-bold space-y-0.5 mb-2 text-[6.5px]">
                  <p>CENTRE DE FORMATION / TRAINING CENTER : <span className="underline">{user?.center?.name || "CEFOPIA"}</span></p>
                  <p>SPECIALITE / SPECIALITY: <span className="underline">GRAPHISME DE PRODUCTION</span></p>
                  <p>NIVEAU D'ENTRÉE / LEVEL OF ENTRY: <span className="underline">BEPC / NIVEAU 3EME</span></p>
                </div>

                {/* Tableau à double sous-colonne (NOTE / N*COEF) */}
                <div className="border border-black overflow-hidden text-[6px]">
                  <div className="flex bg-slate-200 font-bold border-b border-black text-center">
                    <div className="w-5 py-1 border-r border-black">N°</div>
                    <div className="w-32 py-1 border-r border-black leading-none">NOMS ET PRENOMS DU CANDIDAT</div>
                    <div className="w-14 py-1 border-r border-black leading-none">DATE DE NAISS.</div>
                    <div className="w-14 py-1 border-r border-black leading-none">LIEU DE NAISS.</div>
                    <div className="w-18 border-r border-black">
                      <div className="border-b border-black py-0.5">EPS - COEF : 02</div>
                      <div className="flex"><span className="w-1/2 border-r border-black">NOTE</span><span className="w-1/2">N*C</span></div>
                    </div>
                    <div className="w-18 border-r border-black">
                      <div className="border-b border-black py-0.5">MSP - COEF : 05</div>
                      <div className="flex"><span className="w-1/2 border-r border-black">NOTE</span><span className="w-1/2">N*C</span></div>
                    </div>
                    <div className="w-12 py-1 leading-none font-bold">MOYENNE / 20</div>
                  </div>

                  {/* Lignes reproduites fidèlement d'après votre photo */}
                  <div className="flex border-b border-black text-center items-center font-bold">
                    <div className="w-5 py-1 border-r border-black">1</div>
                    <div className="w-32 py-1 border-r border-black text-left pl-1">CHOUAPI NGAGOUM DAVILA</div>
                    <div className="w-14 py-1 border-r border-black">12/11/2006</div>
                    <div className="w-14 py-1 border-r border-black truncate">MTE DE BAMKA</div>
                    <div className="w-9 border-r border-black">13.00</div>
                    <div className="w-9 border-r border-black">26.00</div>
                    <div className="w-9 border-r border-black">14.71</div>
                    <div className="w-9 border-r border-black">73.55</div>
                    <div className="w-12 py-1 font-bold">14.22</div>
                  </div>

                  <div className="flex border-b border-black text-center items-center font-bold">
                    <div className="w-5 py-1 border-r border-black">2</div>
                    <div className="w-32 py-1 border-r border-black text-left pl-1">FEUYEM SOANA EMMANUELLE</div>
                    <div className="w-14 py-1 border-r border-black">01/01/2003</div>
                    <div className="w-14 py-1 border-r border-black">BAFOUSSAM</div>
                    <div className="w-9 border-r border-black">11.90</div>
                    <div className="w-9 border-r border-black">23.80</div>
                    <div className="w-9 border-r border-black">12.71</div>
                    <div className="w-9 border-r border-black">63.55</div>
                    <div className="w-12 py-1 font-bold">12.47</div>
                  </div>

                  <div className="flex border-b border-black text-center items-center font-bold">
                    <div className="w-5 py-1 border-r border-black">3</div>
                    <div className="w-32 py-1 border-r border-black text-left pl-1">MEBEU YOUNGANG YLVIE</div>
                    <div className="w-14 py-1 border-r border-black">16/08/2006</div>
                    <div className="w-14 py-1 border-r border-black">BATIE</div>
                    <div className="w-9 border-r border-black">14.10</div>
                    <div className="w-9 border-r border-black">28.20</div>
                    <div className="w-9 border-r border-black">18.31</div>
                    <div className="w-9 border-r border-black">91.55</div>
                    <div className="w-12 py-1 font-bold">17.10</div>
                  </div>

                  {/* Ligne 4 avec le 'M' d'absence */}
                  <div className="flex text-center items-center font-bold">
                    <div className="w-5 py-1 border-r border-black">4</div>
                    <div className="w-32 py-1 border-r border-black text-left pl-1">NOUWA SIEWE BRENDA</div>
                    <div className="w-14 py-1 border-r border-black">12/02/2004</div>
                    <div className="w-14 py-1 border-r border-black">BANGOU</div>
                    <div className="w-9 border-r border-black">16.40</div>
                    <div className="w-9 border-r border-black">32.80</div>
                    <div className="w-9 border-r border-black text-red-600">M</div>
                    <div className="w-9 border-r border-black text-red-600">M</div>
                    <div className="w-12 py-1 font-bold">16.40</div>
                  </div>
                </div>

                {/* Pied de page ministériel SANS QR CODE */}
                <div className="mt-8 text-right font-bold text-[7.5px] pr-4">
                  <span className="underline">{config.signatoryTitle || "LE DELEGUE DEPARTEMENTAL"}</span>
                </div>
              </div>
            ) : selectedType === "CARTE_ETUDIANT" ? (
              cardPreviewSide === "recto" ? (
                <div className="w-[340px] h-[215px] rounded bg-white border border-slate-300 shadow-md p-3.5 flex flex-col justify-between relative overflow-hidden text-[9px] select-none">
                  {config.showWatermark && watermarkImgSrc && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0" style={{ opacity: config.watermarkOpacity || 0.08 }}>
                      <img src={watermarkImgSrc} alt="Filigrane" className="w-32 h-32 object-contain" />
                    </div>
                  )}

                  <div className="relative z-10 -mx-3.5 -mt-3.5 px-3.5 py-2.5 flex items-center justify-between text-white" style={{ backgroundColor: config.themeColor || "#071A2E" }}>
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
                      <p><strong className="text-slate-500">MATRICULE :</strong> <span className="font-mono font-bold" style={{ color: config.accentColor || "#18527A" }}>CECO-FC26-0042</span></p>
                      <p><strong className="text-slate-500">FILIÈRE :</strong> Froid &amp; Climatisation</p>
                      <p><strong className="text-slate-500">NIVEAU :</strong> Niveau 1 (DQP)</p>
                    </div>
                  </div>

                  <div className="relative z-10 flex justify-between items-center text-[8px] text-slate-500 pt-1 border-t border-slate-200 font-mono">
                    <span>Session : 2026-2027</span>
                    <span className="font-bold" style={{ color: config.accentColor || "#18527A" }}>CECO ID-PASS</span>
                  </div>
                </div>
              ) : (
                <div className="w-[340px] h-[215px] rounded bg-white border border-slate-300 shadow-md p-3.5 flex flex-col justify-between relative overflow-hidden text-[8.5px] select-none leading-tight">
                  <div className="space-y-1.5">
                    <span className="font-bold uppercase tracking-wider" style={{ color: config.themeColor || "#071A2E" }}>Conditions d'Utilisation</span>
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
            ) : (
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

                  <div className="text-center py-1 rounded bg-brand-900 text-white border-y-2 border-amber-400 shadow-xs">
                    <h3 className="font-bold text-[8.5px] uppercase tracking-wider">{config.documentTitle || selectedType}</h3>
                    {config.subTitle && <p className="text-[6.5px] text-amber-200">{config.subTitle}</p>}
                  </div>

                  <div className="p-2 rounded bg-slate-50 border border-slate-200 flex justify-between items-center text-[7.5px]">
                    <div className="space-y-0.5">
                      <p><strong>NOM :</strong> <span className="font-bold text-brand-900">NGALEU ARMSTRONG EUCLADOR</span></p>
                      <p><strong>MATRICULE :</strong> <span className="font-mono font-bold bg-amber-200 text-brand-900 px-1 rounded">CECO-FC26-0042</span> • <strong>SEXE :</strong> M</p>
                      <p><strong>FILIÈRE :</strong> Froid &amp; Climatisation (Niveau 1 • DQP)</p>
                    </div>
                    <div className="w-10 h-12 bg-white border border-slate-200 rounded flex items-center justify-center">
                      <Icon name="person" className="text-2xl text-slate-400" />
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