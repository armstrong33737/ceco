// packages/frontend/src/modules/documents/components/StudioBulletinSemestreConfig.jsx
import React from "react";
import Input from "../../../design-system/primitives/Input";
import Select from "../../../design-system/primitives/Select";
import Textarea from "../../../design-system/primitives/Textarea";
import Button from "../../../design-system/primitives/Button";
import Icon from "../../../components/Icon";

export default function StudioBulletinSemestreConfig({
  config,
  onChange,
  availableSignatureRoles = [],
}) {
  const signatories = config.signatories || [
    { title: "Le Formateur Titulaire", roleKey: "formateur" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];

  function handleSignatoryChange(idx, field, value) {
    const updated = [...signatories];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange("signatories", updated);
  }

  function handleAddSignatory() {
    if (signatories.length >= 3) return;
    onChange("signatories", [...signatories, { title: "Le Directeur des Études", roleKey: "directeur" }]);
  }

  function handleRemoveSignatory(idx) {
    if (signatories.length <= 1) return;
    onChange("signatories", signatories.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      {/* 1. Armoiries d'en-tête officiel */}
      <Select
        label="Disposition des armoiries dans l'en-tête officiel"
        value={config.headerMode || "logo"}
        onChange={(e) => onChange("headerMode", e.target.value)}
      >
        <option value="logo">Logo de l'établissement uniquement (Recommandé)</option>
        <option value="both">Logo du centre ET Sceau de la République (Côte à côte)</option>
        <option value="seal">Sceau de la République uniquement</option>
      </Select>

      {/* 2. En-tête Bilingue Officiel Allongé (Avec Délégations) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Textarea
          label="Volet Gauche (Français - Avec Délégations)"
          rows={6}
          value={config.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE\n----\nDÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA"}
          onChange={(e) => onChange("headerLeft", e.target.value)}
        />
        <Textarea
          label="Volet Droit (Anglais - Avec Délégations)"
          rows={6}
          value={config.headerRight || "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING\n----\nREGIONAL DELEGATION FOR THE WEST\nDIVISIONAL DELEGATION FOR MENOUA"}
          onChange={(e) => onChange("headerRight", e.target.value)}
        />
      </div>

      {/* 3. Charte & Titre */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Couleur thématique du bulletin"
          type="color"
          value={config.primaryColor || "#071A2E"}
          onChange={(e) => onChange("primaryColor", e.target.value)}
        />
        <Input
          label="Titre officiel du bulletin"
          value={config.documentTitle || "BULLETIN SEMESTRIEL DE NOTES"}
          onChange={(e) => onChange("documentTitle", e.target.value)}
        />
      </div>

      {/* 4. Configuration Réactive des Signataires */}
      <div className="p-3.5 rounded bg-[#F5F7FA] border border-border space-y-2.5 dark:bg-[#07111D] dark:border-border-dark">
        <div className="flex items-center justify-between">
          <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold">
            Signataires &amp; Visas Pédagogiques ({signatories.length})
          </span>
          <Button
            variant="tertiary"
            size="sm"
            icon="add"
            onClick={handleAddSignatory}
            disabled={signatories.length >= 3}
          >
            Ajouter Signataire
          </Button>
        </div>

        <div className="space-y-2">
          {signatories.map((sig, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-surface p-2 rounded border border-border dark:bg-surface-dark dark:border-border-dark">
              <input
                type="text"
                value={sig.title}
                onChange={(e) => handleSignatoryChange(idx, "title", e.target.value)}
                placeholder="Intitulé de la fonction"
                className="h-8 rounded bg-surface px-2 text-caption border border-border flex-1 outline-none dark:bg-surface-dark dark:border-border-dark dark:text-white"
              />
              <select
                value={sig.roleKey || "directeur"}
                onChange={(e) => handleSignatoryChange(idx, "roleKey", e.target.value)}
                className="h-8 rounded bg-surface px-2 text-caption font-semibold border border-border outline-none w-36 dark:bg-surface-dark dark:border-border-dark dark:text-white"
              >
                <option value="formateur">Formateur Titulaire</option>
                {availableSignatureRoles.map((r) => (
                  <option key={r.key} value={r.key}>{r.title}</option>
                ))}
              </select>
              {signatories.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveSignatory(idx)}
                  className="text-error hover:bg-error-subtle p-1 rounded"
                >
                  <Icon name="close" className="text-[16px]" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Textarea
        label="Mention légale de pied de page"
        rows={2}
        value={config.footerLegal || "Toute rature ou surcharge annule la validité du présent bulletin officiel • Registre sécurisé CECO ERP."}
        onChange={(e) => onChange("footerLegal", e.target.value)}
      />
    </div>
  );
}