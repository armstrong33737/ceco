// packages/frontend/src/modules/documents/components/StudioDiplomaConfig.jsx
import React, { useState } from "react";
import Input from "../../../design-system/primitives/Input";
import Select from "../../../design-system/primitives/Select";
import Icon from "../../../components/Icon";
import { apiFetch } from "../../../lib/apiClient";
import { showToast } from "../../../store/toastStore";

export default function StudioDiplomaConfig({
  config,
  onChange,
  availableSignatureRoles = [],
  onTextureUploaded,
}) {
  const [uploadingBg, setUploadingBg] = useState(false);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      setUploadingBg(true);
      try {
        await apiFetch("/center/diploma-bg", {
          method: "POST",
          body: JSON.stringify({ bgDataUrl: reader.result }),
        });
        showToast("Image de fond d'attestation enregistrée.", "success");
        if (onTextureUploaded) onTextureUploaded(reader.result);
      } catch (err) {
        showToast(err.message || "Échec de l'enregistrement de l'image.", "error");
      } finally {
        setUploadingBg(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Couleur primaire (Titre & Nom)"
          type="color"
          value={config.primaryColor || "#071A2E"}
          onChange={(e) => onChange("primaryColor", e.target.value)}
        />
        <Input
          label="Couleur d'accent (Sous-titre & Réglette)"
          type="color"
          value={config.accentColor || "#007799"}
          onChange={(e) => onChange("accentColor", e.target.value)}
        />
      </div>

      <Input
        label="Titre principal de l'attestation"
        value={config.documentTitle || "ATTESTATION DE FIN DE FORMATION"}
        onChange={(e) => onChange("documentTitle", e.target.value)}
      />

      <Input
        label="Sous-titre du document"
        value={config.subTitle || "CERTIFICAT DE RÉUSSITE"}
        onChange={(e) => onChange("subTitle", e.target.value)}
      />

      {/* Téléversement du fond A4 Paysage (100% net sans curseur d'opacité) */}
      <div className="p-3.5 rounded bg-[#F5F7FA] border border-border space-y-2 dark:bg-[#07111D] dark:border-border-dark">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold block">
              Image de Fond Officielle (A4 Paysage)
            </span>
            <span className="text-caption text-ink-muted">
              Rendu 100% net (l'image porte le cadre, les dorures et le ruban officiel).
            </span>
          </div>
          <label className="cursor-pointer inline-flex items-center justify-center font-sans font-medium rounded transition-colors h-[28px] px-2.5 text-[11px] gap-1 bg-brand-900 text-white hover:bg-brand-800 shadow-xs dark:bg-brand-500 flex-shrink-0">
            <Icon name="upload" className="text-[14px]" />
            <span>{uploadingBg ? "Envoi..." : "Téléverser Fond"}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              disabled={uploadingBg}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <Input
        label="Texte de durée personnalisé (Optionnel)"
        placeholder="Laissez vide pour auto-calcul (ex: Durée : 1 an(s))"
        value={config.trainingDuration || ""}
        onChange={(e) => onChange("trainingDuration", e.target.value)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label="Fonction du signataire officiel"
          value={config.signatoryRoleKey || "directeur"}
          onChange={(e) => {
            const roleKey = e.target.value;
            const foundRole = availableSignatureRoles.find((r) => r.key === roleKey);
            onChange("signatoryRoleKey", roleKey);
            if (foundRole) onChange("signatoryTitle", foundRole.title);
          }}
        >
          {availableSignatureRoles.map((r) => (
            <option key={r.key} value={r.key}>{r.title}</option>
          ))}
        </Select>

        <Input
          label="Titre affiché du signataire"
          value={config.signatoryTitle || "Le Directeur Général"}
          onChange={(e) => onChange("signatoryTitle", e.target.value)}
        />
      </div>
    </div>
  );
}