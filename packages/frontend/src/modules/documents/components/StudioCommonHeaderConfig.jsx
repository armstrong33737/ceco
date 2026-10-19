// packages/frontend/src/modules/documents/components/StudioCommonHeaderConfig.jsx
import React, { useState } from "react";
import Input from "../../../design-system/primitives/Input";
import Select from "../../../design-system/primitives/Select";
import Textarea from "../../../design-system/primitives/Textarea";

export default function StudioCommonHeaderConfig({
  config,
  onChange,
  centerData,
}) {
  const [activeTab, setActiveTab] = useState("national"); // "national" | "internal"

  const internalConfig = config.internalHeader || {
    title: "",
    accreditation: "",
    contacts: "",
  };

  function handleInternalFieldChange(field, val) {
    onChange("internalHeader", {
      ...internalConfig,
      [field]: val,
    });
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur de type d'en-tête */}
      <div className="flex p-0.5 bg-[#F5F7FA] rounded border border-border dark:bg-[#07111D] dark:border-border-dark">
        <button
          type="button"
          onClick={() => setActiveTab("national")}
          className={`flex-1 py-1.5 px-3 text-caption font-semibold rounded-[2px] transition-colors ${
            activeTab === "national"
              ? "bg-brand-900 text-white shadow-xs dark:bg-brand-500"
              : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          En-tête National (Bilingue Républicain)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("internal")}
          className={`flex-1 py-1.5 px-3 text-caption font-semibold rounded-[2px] transition-colors ${
            activeTab === "internal"
              ? "bg-brand-900 text-white shadow-xs dark:bg-brand-500"
              : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          En-tête Interne d'Établissement (Épuré)
        </button>
      </div>

      {activeTab === "national" ? (
        /* 1. EN-TÊTE NATIONAL BILINGUE (Certificats, Bulletins, Diplômes) */
        <div className="space-y-4">
          <Select
            label="Disposition des armoiries dans l'en-tête national"
            value={config.headerMode || "logo"}
            onChange={(e) => onChange("headerMode", e.target.value)}
          >
            <option value="logo">Logo de l'établissement uniquement (Recommandé)</option>
            <option value="both">Logo du centre ET Sceau de la République (Côte à côte)</option>
            <option value="seal">Sceau de la République uniquement</option>
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Textarea
              label="Volet Gauche (Français)"
              rows={5}
              value={config.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE"}
              onChange={(e) => onChange("headerLeft", e.target.value)}
            />
            <Textarea
              label="Volet Droit (Anglais)"
              rows={5}
              value={config.headerRight || "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING"}
              onChange={(e) => onChange("headerRight", e.target.value)}
            />
          </div>
        </div>
      ) : (
        /* 2. EN-TÊTE INTERNE D'ÉTABLISSEMENT (Fiches, Bordereaux, PVs internes) */
        <div className="space-y-4">
          <div className="p-3 rounded bg-info-subtle border border-info/30 text-info text-caption font-medium dark:bg-info-subtle-dark dark:text-info-dark">
            Cet en-tête épuré est utilisé sur vos fiches d'inscription, bordereaux de saisie et PVs internes. Il ne comporte aucune formule étatique républicaine.
          </div>

          <Input
            label="Intitulé officiel de l'établissement"
            placeholder={centerData?.name || "CENTRE DE FORMATION PROFESSIONNELLE"}
            value={internalConfig.title || ""}
            onChange={(e) => handleInternalFieldChange("title", e.target.value)}
          />

          <Input
            label="Ligne d'agrément ministériel personnalisée"
            placeholder={`ARRÊTÉ D'AGRÉMENT MINEFOP : ${centerData?.registrationNumber || "En cours"} • ${centerData?.city || "Cameroun"}`}
            value={internalConfig.accreditation || ""}
            onChange={(e) => handleInternalFieldChange("accreditation", e.target.value)}
          />

          <Input
            label="Ligne de coordonnées & contacts"
            placeholder={`Tél : ${centerData?.phone || "—"} • Email : ${centerData?.email || "—"}`}
            value={internalConfig.contacts || ""}
            onChange={(e) => handleInternalFieldChange("contacts", e.target.value)}
          />
        </div>
      )}

      {/* Paramètres transversaux de charte */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border dark:border-border-dark">
        <Input
          label="Couleur primaire de l'établissement"
          type="color"
          value={config.primaryColor || "#071A2E"}
          onChange={(e) => onChange("primaryColor", e.target.value)}
        />
        <div className="space-y-1">
          <div className="flex justify-between text-caption font-semibold">
            <span className="text-ink-secondary dark:text-ink-secondary-dark">Opacité du Filigrane :</span>
            <span className="font-mono text-brand-900 dark:text-brand-500">
              {Math.round((config.watermarkOpacity !== undefined ? config.watermarkOpacity : 0.05) * 100)} %
            </span>
          </div>
          <input
            type="range"
            min="0.02"
            max="0.15"
            step="0.01"
            value={config.watermarkOpacity !== undefined ? config.watermarkOpacity : 0.05}
            onChange={(e) => onChange("watermarkOpacity", parseFloat(e.target.value))}
            className="w-full accent-brand-900 cursor-pointer pt-2"
          />
        </div>
      </div>

      <Textarea
        label="Mention légale par défaut de pied de page"
        rows={2}
        value={config.footerLegal || "Document officiel certifié conforme • Toute surcharge ou altération annule la validité du présent acte."}
        onChange={(e) => onChange("footerLegal", e.target.value)}
      />
    </div>
  );
}