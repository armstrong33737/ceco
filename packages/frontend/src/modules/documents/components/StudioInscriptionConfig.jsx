// packages/frontend/src/modules/documents/components/StudioInscriptionConfig.jsx
import React from "react";
import Input from "../../../design-system/primitives/Input";
import Textarea from "../../../design-system/primitives/Textarea";
import Button from "../../../design-system/primitives/Button";
import Icon from "../../../components/Icon";

export default function StudioInscriptionConfig({
  config,
  onChange,
  availableSignatureRoles = [],
}) {
  const signatories = config.signatories || [
    { title: "Signature de l'Apprenant(e) / Tuteur", roleKey: "student" },
    { title: "Visa & Cachet de la Direction", roleKey: "directeur" },
  ];

  function handleSignatoryChange(idx, field, value) {
    const updated = [...signatories];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange("signatories", updated);
  }

  function handleAddSignatory() {
    if (signatories.length >= 3) return;
    onChange("signatories", [...signatories, { title: "Nouveau Visa", roleKey: "directeur" }]);
  }

  function handleRemoveSignatory(idx) {
    if (signatories.length <= 1) return;
    onChange("signatories", signatories.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Couleur d'accentuation"
          type="color"
          value={config.primaryColor || "#071A2E"}
          onChange={(e) => onChange("primaryColor", e.target.value)}
        />
        <Input
          label="Titre officiel du document"
          value={config.documentTitle || "FICHE INDIVIDUELLE D'INSCRIPTION & D'ENGAGEMENT"}
          onChange={(e) => onChange("documentTitle", e.target.value)}
        />
      </div>

      <Textarea
        label="Texte de l'engagement de l'apprenant (Règlement intérieur)"
        rows={4}
        value={config.engagementText || ""}
        placeholder="Je soussigné(e), déclare sur l'honneur l'exactitude des informations fournies..."
        onChange={(e) => onChange("engagementText", e.target.value)}
      />

      {/* Bloc de configuration des signataires */}
      <div className="p-3.5 rounded bg-[#F5F7FA] border border-border space-y-2.5 dark:bg-[#07111D] dark:border-border-dark">
        <div className="flex items-center justify-between">
          <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold">
            Zones d'Émargement &amp; Signatures ({signatories.length})
          </span>
          <Button
            variant="tertiary"
            size="sm"
            icon="add"
            onClick={handleAddSignatory}
            disabled={signatories.length >= 3}
          >
            Ajouter
          </Button>
        </div>

        <div className="space-y-2">
          {signatories.map((sig, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-surface p-2 rounded border border-border dark:bg-surface-dark dark:border-border-dark">
              <input
                type="text"
                value={sig.title}
                onChange={(e) => handleSignatoryChange(idx, "title", e.target.value)}
                placeholder="Intitulé de la signature"
                className="h-8 rounded bg-surface px-2 text-caption border border-border flex-1 outline-none dark:bg-surface-dark dark:border-border-dark dark:text-white"
              />
              <select
                value={sig.roleKey || "student"}
                onChange={(e) => handleSignatoryChange(idx, "roleKey", e.target.value)}
                className="h-8 rounded bg-surface px-2 text-caption font-semibold border border-border outline-none w-36 dark:bg-surface-dark dark:border-border-dark dark:text-white"
              >
                <option value="student">Élève / Tuteur</option>
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
        placeholder="Document officiel conservé au registre des inscriptions..."
        onChange={(e) => onChange("footerLegal", e.target.value)}
      />
    </div>
  );
}