// packages/frontend/src/modules/documents/DocumentStudioPage.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch, apiFetchImageUrl } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Textarea from "../../design-system/primitives/Textarea";
import Badge from "../../design-system/primitives/Badge";
import Icon from "../../components/Icon";
import useAuthStore from "../../store/authStore";

// Sous-composants modulaires spécialisés par document
import StudioCommonHeaderConfig from "./components/StudioCommonHeaderConfig";
import StudioCommonHeaderPreview from "./components/StudioCommonHeaderPreview";
import StudioCardConfig from "./components/StudioCardConfig";
import StudioCardPreview from "./components/StudioCardPreview";
import StudioInscriptionConfig from "./components/StudioInscriptionConfig";
import StudioInscriptionPreview from "./components/StudioInscriptionPreview";
import StudioAttestationConfig from "./components/StudioAttestationConfig";
import StudioAttestationPreview from "./components/StudioAttestationPreview";
import StudioBulletinCcConfig from "./components/StudioBulletinCcConfig";
import StudioBulletinCcPreview from "./components/StudioBulletinCcPreview";
import StudioBulletinSemestreConfig from "./components/StudioBulletinSemestreConfig";
import StudioBulletinSemestrePreview from "./components/StudioBulletinSemestrePreview";
import StudioTranscriptConfig from "./components/StudioTranscriptConfig";
import StudioTranscriptPreview from "./components/StudioTranscriptPreview";
import StudioDiplomaConfig from "./components/StudioDiplomaConfig";
import StudioDiplomaPreview from "./components/StudioDiplomaPreview";
import StudioMockExamConfig from "./components/StudioMockExamConfig";
import StudioMockExamPreview from "./components/StudioMockExamPreview";

const DOCUMENT_SECTIONS = [
  {
    id: "socle",
    title: "1. En-tête Républicain & Socle Commun",
    icon: "flag",
    items: [
      { key: "GENERAL_CONFIG", label: "Charte & En-tête Bilingue", icon: "tune" },
    ],
  },
  {
    id: "internes",
    title: "2. Actes Internes & Scolarité",
    icon: "folder_shared",
    items: [
      { key: "CARTE_ETUDIANT", label: "Carte d'Apprenant (CR80)", icon: "badge" },
      { key: "FICHE_INSCRIPTION", label: "Fiche d'Inscription", icon: "description" },
      { key: "BORDEREAU_VIERGE", label: "Bordereau Vierge", icon: "edit_document" },
      { key: "PV_MATIERE", label: "Procès-Verbal Matière", icon: "assignment_turned_in" },
      { key: "PV_SEMESTRE", label: "PV Délibération Semestre", icon: "table_chart" },
      { key: "PV_CC", label: "PV Contrôle Continu (CC)", icon: "fact_check" },
    ],
  },
  {
    id: "externes",
    title: "3. Actes Certifiés & Relevés",
    icon: "verified",
    items: [
      { key: "ATTESTATION_INSCRIPTION", label: "Certificat de Scolarité", icon: "verified" },
      { key: "BULLETIN_CC", label: "Bulletin CC & TP", icon: "fact_check" },
      { key: "BULLETIN_SEMESTRE", label: "Bulletin Semestriel", icon: "receipt_long" },
      { key: "RELEVE_ANNUEL", label: "Relevé Annuel (Transcript)", icon: "history_edu" },
      { key: "DIPLOME_FIN_FORMATION", label: "Attestation Fin Formation", icon: "workspace_premium" },
    ],
  },
  {
    id: "examens_blancs",
    title: "4. Examens Blancs (MINEFOP)",
    icon: "school",
    items: [
      { key: "PV_EXAMEN_BLANC", label: "Bordereau Notes MINEFOP", icon: "assignment" },
    ],
  },
];

const DEFAULT_CONFIGS = {
  GENERAL_CONFIG: {
    headerMode: "logo",
    primaryColor: "#071A2E",
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE\n----\nDÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING\n----\nREGIONAL DELEGATION FOR THE WEST\nDIVISIONAL DELEGATION FOR MENOUA",
    watermarkOpacity: 0.05,
    bgTextureOpacity: 0.22,
    footerLegal: "Document officiel certifié conforme • Toute surcharge ou altération annule la validité du présent acte.",
    internalHeader: {
      title: "",
      accreditation: "",
      contacts: "",
    },
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
  },
};

export default function DocumentStudioPage() {
  const user = useAuthStore((s) => s.user);
  const [selectedType, setSelectedType] = useState("PV_EXAMEN_BLANC");
  const [config, setConfig] = useState(DEFAULT_CONFIGS.PV_EXAMEN_BLANC);
  const [availableSignatureRoles, setAvailableSignatureRoles] = useState([
    { key: "directeur", title: "Directeur Général" },
    { key: "promoteur", title: "Promoteur / Fondateur" },
    { key: "delegue", title: "Le Délégué Départemental" },
  ]);

  const [centerData, setCenterData] = useState(null);
  const [centerLogoUrl, setCenterLogoUrl] = useState(null);
  const [centerSealUrl, setCenterSealUrl] = useState(null);
  const [cardBgUrl, setCardBgUrl] = useState(null);
  const [transcriptBgUrl, setTranscriptBgUrl] = useState(null);
  const [diplomaBgUrl, setDiplomaBgUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadBrandingMedia() {
    try {
      const [cData, rolesData] = await Promise.all([
        apiFetch("/center"),
        apiFetch("/center/signature-roles").catch(() => [
          { key: "directeur", title: "Directeur Général" },
          { key: "promoteur", title: "Promoteur / Fondateur" },
          { key: "delegue", title: "Le Délégué Départemental" },
        ]),
      ]);

      setCenterData(cData);
      if (rolesData) setAvailableSignatureRoles(rolesData);

      if (cData?.hasLogo) {
        const logoUrl = await apiFetchImageUrl("/center/logo");
        setCenterLogoUrl(logoUrl);
      }

      const sealUrl = await apiFetchImageUrl("/center/seal");
      setCenterSealUrl(sealUrl);

      const bgCard = await apiFetchImageUrl("/center/card-bg");
      setCardBgUrl(bgCard);

      const bgTranscript = await apiFetchImageUrl("/center/transcript-bg");
      setTranscriptBgUrl(bgTranscript || bgCard);

      const bgDiploma = await apiFetchImageUrl("/center/diploma-bg");
      setDiplomaBgUrl(bgDiploma);
    } catch (e) {
      console.warn("[Studio] Erreur chargement médias :", e.message);
    }
  }

  useEffect(() => {
    loadBrandingMedia();
  }, []);

  function handleSelectType(newType) {
    setSelectedType(newType);
    const fallback = DEFAULT_CONFIGS[newType] || DEFAULT_CONFIGS.PV_EXAMEN_BLANC;
    setConfig(fallback);

    apiFetch(`/documents/templates/${newType}`)
      .then((data) => {
        if (data && typeof data === "object") {
          setConfig((prev) => ({
            ...fallback,
            ...data,
          }));
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    handleSelectType("PV_EXAMEN_BLANC");
  }, []);

  function handleConfigFieldChange(field, val) {
    setConfig((prev) => ({
      ...prev,
      [field]: val,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/documents/templates/${selectedType}`, {
        method: "PUT",
        body: JSON.stringify({ config }),
      });
      showToast("Gabarit d'examen blanc enregistré avec succès.", "success");
    } catch (err) {
      showToast(err.message || "Erreur d'enregistrement.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Administration • Studio Vectoriel</Badge>}
        title="Studio des Gabarits d'Actes &amp; Documents"
        subtitle="Personnalisation des maquettes : bordereaux officiels MINEFOP, certificats, bulletins et relevés"
        actions={
          <Button variant="primary" icon="save" onClick={handleSubmit} isLoading={saving}>
            Enregistrer le Gabarit
          </Button>
        }
      />

      {/* Sélecteur de Documents Épuré */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {DOCUMENT_SECTIONS.map((sec) => (
          <div key={sec.id} className="p-3.5 rounded bg-surface border border-border shadow-xs space-y-2 dark:bg-surface-dark dark:border-border-dark">
            <div className="flex items-center gap-2 text-brand-900 border-b border-border pb-2 dark:text-brand-500 dark:border-border-dark">
              <Icon name={sec.icon} className="text-[18px]" />
              <span className="font-heading font-semibold text-caption text-ink-primary uppercase tracking-wider dark:text-white">
                {sec.title}
              </span>
            </div>

            <div className="space-y-1">
              {sec.items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => handleSelectType(it.key)}
                  className={`w-full px-3 py-2 rounded text-body-sm text-left transition-colors flex items-center justify-between border ${
                    selectedType === it.key
                      ? "bg-brand-900 text-white border-brand-900 shadow-xs font-semibold dark:bg-brand-500"
                      : "bg-[#F5F7FA] text-ink-primary border-border hover:bg-surface dark:bg-[#07111D] dark:border-border-dark dark:text-ink-primary-dark"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon name={it.icon} className="text-[16px] flex-shrink-0" />
                    <span className="truncate">{it.label}</span>
                  </div>
                  {selectedType === it.key && (
                    <Icon name="check" className="text-[14px]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Écran Scindé : Formulaire & Prévisualisation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panneau de configuration (Gauche 5 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 p-6 rounded bg-surface border border-border shadow-xs space-y-4 dark:bg-surface-dark dark:border-border-dark">
          <div className="flex items-center justify-between border-b border-border pb-3 dark:border-border-dark">
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans truncate">
              {selectedType === "GENERAL_CONFIG" ? "Socle Commun & En-têtes" :
               selectedType === "CARTE_ETUDIANT" ? "Configuration de la Carte" :
               selectedType === "FICHE_INSCRIPTION" ? "Fiche d'Inscription" :
               selectedType === "ATTESTATION_INSCRIPTION" ? "Certificat de Scolarité" :
               selectedType === "BULLETIN_CC" ? "Bulletin Contrôle Continu" :
               selectedType === "BULLETIN_SEMESTRE" ? "Bulletin Semestriel" :
               selectedType === "RELEVE_ANNUEL" ? "Relevé Annuel (Transcript)" :
               selectedType === "DIPLOME_FIN_FORMATION" ? "Attestation Fin Formation" :
               selectedType === "PV_EXAMEN_BLANC" ? "Bordereau Notes MINEFOP" : `Gabarit : ${selectedType}`}
            </h3>
            <Badge variant="brand">Actif</Badge>
          </div>

          {selectedType === "GENERAL_CONFIG" && (
            <StudioCommonHeaderConfig config={config} onChange={handleConfigFieldChange} centerData={centerData} />
          )}

          {selectedType === "CARTE_ETUDIANT" && (
            <StudioCardConfig config={config} onChange={handleConfigFieldChange} availableSignatureRoles={availableSignatureRoles} onTextureUploaded={(d) => setCardBgUrl(d)} />
          )}

          {selectedType === "FICHE_INSCRIPTION" && (
            <StudioInscriptionConfig config={config} onChange={handleConfigFieldChange} availableSignatureRoles={availableSignatureRoles} />
          )}

          {selectedType === "ATTESTATION_INSCRIPTION" && (
            <StudioAttestationConfig config={config} onChange={handleConfigFieldChange} availableSignatureRoles={availableSignatureRoles} />
          )}

          {selectedType === "BULLETIN_CC" && (
            <StudioBulletinCcConfig config={config} onChange={handleConfigFieldChange} availableSignatureRoles={availableSignatureRoles} />
          )}

          {selectedType === "BULLETIN_SEMESTRE" && (
            <StudioBulletinSemestreConfig config={config} onChange={handleConfigFieldChange} availableSignatureRoles={availableSignatureRoles} />
          )}

          {selectedType === "RELEVE_ANNUEL" && (
            <StudioTranscriptConfig config={config} onChange={handleConfigFieldChange} availableSignatureRoles={availableSignatureRoles} onTextureUploaded={(d) => setTranscriptBgUrl(d)} />
          )}

          {selectedType === "DIPLOME_FIN_FORMATION" && (
            <StudioDiplomaConfig config={config} onChange={handleConfigFieldChange} availableSignatureRoles={availableSignatureRoles} onTextureUploaded={(d) => setDiplomaBgUrl(d)} />
          )}

          {selectedType === "PV_EXAMEN_BLANC" && (
            <StudioMockExamConfig config={config} onChange={handleConfigFieldChange} />
          )}

          <Button type="submit" variant="primary" icon="save" className="w-full" isLoading={saving}>
            Appliquer les Modifications
          </Button>
        </form>

        {/* Panneau de prévisualisation (Droite 7 cols) */}
        <div className="lg:col-span-7 p-6 rounded bg-surface border border-border shadow-xs space-y-4 flex flex-col justify-between dark:bg-surface-dark dark:border-border-dark">
          <div className="flex items-center justify-between border-b border-border pb-3 dark:border-border-dark">
            <h3 className="text-body-md font-semibold text-ink-primary dark:text-white font-sans">
              Aperçu Vectoriel en Direct
            </h3>
            {selectedType === "PV_EXAMEN_BLANC" ? (
              <Badge variant="brand">SANS CODE QR (CONFORME DÉLÉGATION)</Badge>
            ) : (
              <Badge variant="brand">Rendu Temps Réel</Badge>
            )}
          </div>

          <div className="p-4 bg-[#CBD5E1]/30 rounded border border-border flex items-center justify-center min-h-[460px] overflow-auto dark:bg-[#07111D] dark:border-border-dark">
            {selectedType === "GENERAL_CONFIG" && (
              <StudioCommonHeaderPreview config={config} center={centerData} logoUrl={centerLogoUrl} sealUrl={centerSealUrl} />
            )}

            {selectedType === "CARTE_ETUDIANT" && (
              <StudioCardPreview config={config} center={centerData} logoUrl={centerLogoUrl} cardBgUrl={cardBgUrl} />
            )}

            {selectedType === "FICHE_INSCRIPTION" && (
              <StudioInscriptionPreview config={config} center={centerData} logoUrl={centerLogoUrl} />
            )}

            {selectedType === "ATTESTATION_INSCRIPTION" && (
              <StudioAttestationPreview config={config} center={centerData} logoUrl={centerLogoUrl} sealUrl={centerSealUrl} />
            )}

            {selectedType === "BULLETIN_CC" && (
              <StudioBulletinCcPreview config={config} center={centerData} logoUrl={centerLogoUrl} sealUrl={centerSealUrl} />
            )}

            {selectedType === "BULLETIN_SEMESTRE" && (
              <StudioBulletinSemestrePreview config={config} center={centerData} logoUrl={centerLogoUrl} sealUrl={centerSealUrl} />
            )}

            {selectedType === "RELEVE_ANNUEL" && (
              <StudioTranscriptPreview config={config} center={centerData} logoUrl={centerLogoUrl} sealUrl={centerSealUrl} transcriptBgUrl={transcriptBgUrl || cardBgUrl} />
            )}

            {selectedType === "DIPLOME_FIN_FORMATION" && (
              <StudioDiplomaPreview config={config} center={centerData} logoUrl={centerLogoUrl} diplomaBgUrl={diplomaBgUrl} />
            )}

            {selectedType === "PV_EXAMEN_BLANC" && (
              <StudioMockExamPreview config={config} center={centerData} />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}