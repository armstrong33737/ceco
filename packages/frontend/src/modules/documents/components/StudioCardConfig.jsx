// packages/frontend/src/modules/documents/components/StudioCardConfig.jsx
import React, { useState } from "react";
import Input from "../../../design-system/primitives/Input";
import Select from "../../../design-system/primitives/Select";
import Textarea from "../../../design-system/primitives/Textarea";
import Button from "../../../design-system/primitives/Button";
import Icon from "../../../components/Icon";
import { apiFetch } from "../../../lib/apiClient";
import { showToast } from "../../../store/toastStore";

export default function StudioCardConfig({
  config,
  onChange,
  availableSignatureRoles = [],
  onTextureUploaded,
}) {
  const [uploadingTexture, setUploadingTexture] = useState(false);

  function handleTextureFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      setUploadingTexture(true);
      try {
        await apiFetch("/center/card-bg", {
          method: "POST",
          body: JSON.stringify({ bgDataUrl: reader.result }),
        });
        showToast("Texture de fond importée et appliquée avec succès.", "success");
        if (onTextureUploaded) onTextureUploaded(reader.result);
      } catch (err) {
        showToast(err.message || "Échec de l'importation de la texture.", "error");
      } finally {
        setUploadingTexture(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Couleur bandeau / thématique"
          type="color"
          value={config.themeColor || "#071A2E"}
          onChange={(e) => onChange("themeColor", e.target.value)}
        />
        <Input
          label="Couleur accent (ID / Matricule)"
          type="color"
          value={config.accentColor || "#18527A"}
          onChange={(e) => onChange("accentColor", e.target.value)}
        />
      </div>

      <Input
        label="Titre officiel de la carte"
        value={config.cardTitle || "CARTE D’ÉTUDIANT"}
        onChange={(e) => onChange("cardTitle", e.target.value)}
      />

      {/* Téléversement interactif direct de la texture de fond */}
      <div className="p-3.5 rounded bg-[#F5F7FA] border border-border space-y-2 dark:bg-[#07111D] dark:border-border-dark">
        <div className="flex items-center justify-between">
          <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold">
            Motif / Texture de Fond
          </span>
          <label className="cursor-pointer inline-flex items-center justify-center font-sans font-medium rounded transition-colors h-[28px] px-2.5 text-[11px] gap-1 bg-brand-900 text-white hover:bg-brand-800 shadow-xs dark:bg-brand-500">
            <Icon name="upload" className="text-[14px]" />
            <span>{uploadingTexture ? "Envoi..." : "Téléverser Motif"}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleTextureFileSelect}
              disabled={uploadingTexture}
              className="hidden"
            />
          </label>
        </div>
        <p className="text-caption text-ink-muted leading-relaxed">
          Le fichier est stocké sur votre serveur et appliqué en fond perdu sur les deux faces (Ratio CR80 : 1012 × 638 px).
        </p>
      </div>

      <Textarea
        label="Message de bienvenue (Haut du verso)"
        rows={2}
        value={config.welcomeMessage || ""}
        onChange={(e) => onChange("welcomeMessage", e.target.value)}
      />

      <Textarea
        label="Règles d'utilisation (Milieu du verso)"
        rows={3}
        value={config.termsOfUse || ""}
        onChange={(e) => onChange("termsOfUse", e.target.value)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label="Signature apposée (Verso)"
          value={config.signatoryRoleKey || "directeur"}
          onChange={(e) => {
            const roleKey = e.target.value;
            const foundRole = availableSignatureRoles.find((r) => r.key === roleKey);
            onChange("signatoryRoleKey", roleKey);
            if (foundRole) {
              onChange("signatoryTitle", foundRole.title);
            }
          }}
        >
          {availableSignatureRoles.map((r) => (
            <option key={r.key} value={r.key}>
              {r.title} ({r.key})
            </option>
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