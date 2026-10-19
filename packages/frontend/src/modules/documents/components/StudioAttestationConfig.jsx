// packages/frontend/src/modules/documents/components/StudioAttestationConfig.jsx
import React from "react";
import Input from "../../../design-system/primitives/Input";
import Select from "../../../design-system/primitives/Select";
import Textarea from "../../../design-system/primitives/Textarea";
import Button from "../../../design-system/primitives/Button";
import Icon from "../../../components/Icon";

export default function StudioAttestationConfig({
  config,
  onChange,
  availableSignatureRoles = [],
}) {
  const signatories = config.signatories || [
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];

  function handleSignatoryChange(idx, field, value) {
    const updated = [...signatories];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange("signatories", updated);
  }

  function handleAddSignatory() {
    if (signatories.length >= 2) return;
    onChange("signatories", [...signatories, { title: "Le Promoteur", roleKey: "promoteur" }]);
  }

  function handleRemoveSignatory(idx) {
    if (signatories.length <= 1) return;
    onChange("signatories", signatories.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      {/* 1. Sélecteur d'armoiries en-tête */}
      <Select
        label="Disposition des armoiries dans l'en-tête"
        value={config.headerMode || "logo"}
        onChange={(e) => onChange("headerMode", e.target.value)}
      >
        <option value="logo">Logo de l'établissement uniquement (Recommandé par défaut)</option>
        <option value="both">Logo du centre ET Sceau de la République (Côte à côte)</option>
        <option value="seal">Sceau de la République uniquement</option>
      </Select>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Couleur d'accentuation"
          type="color"
          value={config.primaryColor || "#071A2E"}
          onChange={(e) => onChange("primaryColor", e.target.value)}
        />
        <Input
          label="Titre officiel du document"
          value={config.documentTitle || "CERTIFICAT DE SCOLARITÉ & D'INSCRIPTION"}
          onChange={(e) => onChange("documentTitle", e.target.value)}
        />
      </div>

      <Input
        label="Sous-titre bilingue officiel"
        value={config.subTitle || "ATTESTATION OF SCHOOL ATTENDANCE & ENROLMENT"}
        onChange={(e) => onChange("subTitle", e.target.value)}
      />

      <Textarea
        label="Formule d'attestation d'assiduité"
        rows={3}
        value={config.attestationBodyText || ""}
        placeholder="Est régulièrement inscrit(e) au registre matricule de notre établissement et poursuit avec assiduité..."
        onChange={(e) => onChange("attestationBodyText", e.target.value)}
      />

      {/* Bloc de configuration des signataires (Directeur par défaut) */}
      <div className="p-3.5 rounded bg-[#F5F7FA] border border-border space-y-2.5 dark:bg-[#07111D] dark:border-border-dark">
        <div className="flex items-center justify-between">
          <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold">
            Signataires &amp; Visas Administratifs ({signatories.length})
          </span>
          <Button
            variant="tertiary"
            size="sm"
            icon="add"
            onClick={handleAddSignatory}
            disabled={signatories.length >= 2}
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

      <Input
        label="Mention légale de bas de page"
        value={config.footerLegal || ""}
        placeholder="Document officiel certifié conforme • Toute surcharge annule la validité..."
        onChange={(e) => onChange("footerLegal", e.target.value)}
      />
    </div>
  );
}