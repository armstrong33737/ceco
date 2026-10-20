// packages/frontend/src/modules/documents/components/StudioInternalPvConfig.jsx
import React from "react";
import Input from "../../../design-system/primitives/Input";
import Textarea from "../../../design-system/primitives/Textarea";

export default function StudioInternalPvConfig({ config, onChange, centerData }) {
  const internalConfig = config.internalHeader || {
    title: "",
    accreditation: "",
    contacts: "",
  };

  function handleInternalChange(field, val) {
    onChange("internalHeader", {
      ...internalConfig,
      [field]: val,
    });
  }

  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded bg-info-subtle border border-info/30 text-info text-caption font-medium dark:bg-info-subtle-dark dark:text-info-dark">
        Conformité MINEFOP : Ce document interne utilise l'<strong>En-tête Interne d'Établissement Centré</strong> et affiche exclusivement le logo de l'établissement en filigrane ainsi que la légende des codes matières au pied de la grille.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Couleur thématique du document"
          type="color"
          value={config.primaryColor || "#071A2E"}
          onChange={(e) => onChange("primaryColor", e.target.value)}
        />
        <div className="space-y-1">
          <div className="flex justify-between text-caption font-semibold">
            <span className="text-ink-secondary dark:text-ink-secondary-dark">Opacité du Filigrane Logo :</span>
            <span className="font-mono text-brand-900 font-bold dark:text-brand-500">
              {Math.round((config.watermarkOpacity !== undefined ? config.watermarkOpacity : 0.05) * 100)} %
            </span>
          </div>
          <input
            type="range"
            min="0.01"
            max="0.20"
            step="0.01"
            value={config.watermarkOpacity !== undefined ? config.watermarkOpacity : 0.05}
            onChange={(e) => onChange("watermarkOpacity", parseFloat(e.target.value))}
            className="w-full accent-brand-900 cursor-pointer pt-2"
          />
        </div>
      </div>

      <Input
        label="Dénomination du centre (En-tête centré)"
        placeholder={centerData?.name || "CENTRE DE FORMATION PROFESSIONNELLE"}
        value={internalConfig.title || ""}
        onChange={(e) => handleInternalChange("title", e.target.value)}
      />

      <Input
        label="Ligne d'agrément ministériel (Centrée)"
        placeholder={`ARRÊTÉ D'AGRÉMENT MINEFOP : ${centerData?.registrationNumber || "Autorisé / En cours"} • VILLE : ${(centerData?.city || "Cameroun").toUpperCase()}`}
        value={internalConfig.accreditation || ""}
        onChange={(e) => handleInternalChange("accreditation", e.target.value)}
      />

      <Input
        label="Ligne de coordonnées (Centrée)"
        placeholder={`Tél : ${centerData?.phone || "—"} • Email : ${centerData?.email || "—"}`}
        value={internalConfig.contacts || ""}
        onChange={(e) => handleInternalChange("contacts", e.target.value)}
      />

      <Textarea
        label="Mention de bas de page"
        rows={2}
        value={config.footerLegal || "Document officiel de délibération pédagogique conservé aux archives de l'établissement • CECO ERP"}
        onChange={(e) => onChange("footerLegal", e.target.value)}
      />
    </div>
  );
}