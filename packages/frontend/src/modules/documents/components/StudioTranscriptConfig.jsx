// packages/frontend/src/modules/documents/components/StudioTranscriptConfig.jsx
import React, { useState } from "react";
import Input from "../../../design-system/primitives/Input";
import Select from "../../../design-system/primitives/Select";
import Textarea from "../../../design-system/primitives/Textarea";
import Button from "../../../design-system/primitives/Button";
import Icon from "../../../components/Icon";
import { apiFetch } from "../../../lib/apiClient";
import { showToast } from "../../../store/toastStore";

export default function StudioTranscriptConfig({
  config,
  onChange,
  availableSignatureRoles = [],
  onTextureUploaded,
}) {
  const [uploadingTexture, setUploadingTexture] = useState(false);

  const signatories = config.signatories || [
    { title: "Le Directeur des Études", roleKey: "directeur" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];

  function handleSignatoryChange(idx, field, value) {
    const updated = [...signatories];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange("signatories", updated);
  }

  function handleAddSignatory() {
    if (signatories.length >= 3) return;
    onChange("signatories", [...signatories, { title: "Le Promoteur", roleKey: "promoteur" }]);
  }

  function handleRemoveSignatory(idx) {
    if (signatories.length <= 1) return;
    onChange("signatories", signatories.filter((_, i) => i !== idx));
  }

  function handleTextureFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      setUploadingTexture(true);
      try {
        await apiFetch("/center/transcript-bg", {
          method: "POST",
          body: JSON.stringify({ bgDataUrl: reader.result }),
        });
        showToast("Texture du relevé (recap_bg) enregistrée avec succès.", "success");
        if (onTextureUploaded) onTextureUploaded(reader.result);
      } catch (err) {
        showToast(err.message || "Échec du téléversement de la texture.", "error");
      } finally {
        setUploadingTexture(false);
      }
    };
    reader.readAsDataURL(file);
  }

  // Opacité par défaut à 100% (1.0)
  const currentOpacity = config.bgTextureOpacity !== undefined ? config.bgTextureOpacity : 1.0;

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

      {/* 2. En-tête Bilingue Officiel Allongé */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Textarea
          label="Volet Gauche (Français)"
          rows={5}
          value={config.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE\n----\nDÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA"}
          onChange={(e) => onChange("headerLeft", e.target.value)}
        />
        <Textarea
          label="Volet Droit (Anglais)"
          rows={5}
          value={config.headerRight || "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING\n----\nREGIONAL DELEGATION FOR THE WEST\nDIVISIONAL DELEGATION FOR MENOUA"}
          onChange={(e) => onChange("headerRight", e.target.value)}
        />
      </div>

      {/* 3. Charte, Titre & Texture recap_bg */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Couleur thématique du relevé"
          type="color"
          value={config.primaryColor || "#071A2E"}
          onChange={(e) => onChange("primaryColor", e.target.value)}
        />
        <Input
          label="Titre officiel de l'acte"
          value={config.documentTitle || "RELEVÉ DE NOTES ANNUEL OFFICIEL"}
          onChange={(e) => onChange("documentTitle", e.target.value)}
        />
      </div>

      {/* Téléversement du motif recap_bg avec curseur 0 à 100% (défaut 100%) */}
      <div className="p-3.5 rounded bg-[#F5F7FA] border border-border space-y-2 dark:bg-[#07111D] dark:border-border-dark">
        <div className="flex items-center justify-between">
          <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold">
            Motif de Fond du Relevé (recap_bg)
          </span>
          <label className="cursor-pointer inline-flex items-center justify-center font-sans font-medium rounded transition-colors h-[28px] px-2.5 text-[11px] gap-1 bg-brand-900 text-white hover:bg-brand-800 shadow-xs dark:bg-brand-500">
            <Icon name="upload" className="text-[14px]" />
            <span>{uploadingTexture ? "Envoi..." : "Téléverser recap_bg"}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleTextureFileSelect}
              disabled={uploadingTexture}
              className="hidden"
            />
          </label>
        </div>

        <div className="space-y-1 pt-1 border-t border-border dark:border-border-dark">
          <div className="flex justify-between text-caption font-semibold">
            <span className="text-ink-secondary dark:text-ink-secondary-dark">Opacité de la texture :</span>
            <span className="font-mono text-brand-900 dark:text-brand-500 font-bold">
              {Math.round(currentOpacity * 100)} %
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={currentOpacity}
            onChange={(e) => onChange("bgTextureOpacity", parseFloat(e.target.value))}
            className="w-full accent-brand-900 cursor-pointer"
          />
        </div>
      </div>

      {/* 4. Configuration des Signataires */}
      <div className="p-3.5 rounded bg-[#F5F7FA] border border-border space-y-2.5 dark:bg-[#07111D] dark:border-border-dark">
        <div className="flex items-center justify-between">
          <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold">
            Signataires &amp; Visas Rectoraux ({signatories.length})
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
        value={config.footerLegal || "Document officiel certifié conforme • Toute surcharge ou altération annule la validité du présent acte."}
        onChange={(e) => onChange("footerLegal", e.target.value)}
      />
    </div>
  );
}