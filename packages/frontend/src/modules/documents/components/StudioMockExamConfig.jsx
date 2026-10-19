// packages/frontend/src/modules/documents/components/StudioMockExamConfig.jsx
import React from "react";
import Input from "../../../design-system/primitives/Input";
import Textarea from "../../../design-system/primitives/Textarea";

export default function StudioMockExamConfig({ config, onChange }) {
  const regionalContacts = config.regionalContacts || {
    phone: "233 44 53 80 / 233 44 59 00",
    email: "drefopouest@yahoo.fr",
    city: "Bafoussam",
  };

  function handleContactChange(field, val) {
    onChange("regionalContacts", {
      ...regionalContacts,
      [field]: val,
    });
  }

  return (
    <div className="space-y-4">
      {/* 1. En-tête officiel de tutelle régionale (Français & Anglais) */}
      <div className="p-3.5 rounded bg-[#F5F7FA] border border-border space-y-3 dark:bg-[#07111D] dark:border-border-dark">
        <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold block">
          En-tête de la Délégation Régionale MINEFOP
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Textarea
            label="Volet Gauche (Français)"
            rows={7}
            value={config.headerLeft || "REPUBLIQUE DU CAMEROUN\nPaix – Travail – Patrie\n*********\nREGION DE L'OUEST\n*********\nDELEGATION REGIONALE DE L'EMPLOI ET DE LA\nFORMATION PROFESSIONNELLE\n*********\nINSPECTION REGIONALE DES FORMATIONS\n*********"}
            onChange={(e) => onChange("headerLeft", e.target.value)}
          />
          <Textarea
            label="Volet Droit (Anglais)"
            rows={7}
            value={config.headerRight || "REPUBLIC OF CAMEROON\nPeace – Work – Fatherland\n*********\nWEST REGION\n*********\nREGIONAL DELEGATION OF EMPLOYMENT\nAND VOCATIONAL TRAINING\n*********\nREGIONAL INSPECTORATE OF TRAININGS\n*********"}
            onChange={(e) => onChange("headerRight", e.target.value)}
          />
        </div>
      </div>

      {/* 2. Coordonnées de la Délégation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          label="Téléphones officiels"
          value={regionalContacts.phone || "233 44 53 80 / 233 44 59 00"}
          onChange={(e) => handleContactChange("phone", e.target.value)}
        />
        <Input
          label="Email de contact"
          value={regionalContacts.email || "drefopouest@yahoo.fr"}
          onChange={(e) => handleContactChange("email", e.target.value)}
        />
        <Input
          label="Ville d'émission"
          value={regionalContacts.city || "Bafoussam"}
          onChange={(e) => handleContactChange("city", e.target.value)}
        />
      </div>

      {/* 3. Bandeau, Titre de Cadre et Signataire */}
      <Input
        label="Intitulé du bandeau supérieur d'examen"
        value={config.examBannerTitle || "EXAMEN REGIONAL DU DQP BLANC, SESSION DE 2026"}
        onChange={(e) => onChange("examBannerTitle", e.target.value)}
      />

      <Input
        label="Titre encadré du document"
        value={config.examFrameTitle || "BORDEREAU DES NOTES DES CANDIDATS"}
        onChange={(e) => onChange("examFrameTitle", e.target.value)}
      />

      <Input
        label="Titre du Signataire Officiel (Pied de page)"
        value={config.signatoryTitle || "LE DELEGUE DEPARTEMENTAL"}
        onChange={(e) => onChange("signatoryTitle", e.target.value)}
      />

      <div className="p-3 rounded bg-info-subtle border border-info/30 text-info text-caption font-medium dark:bg-info-subtle-dark dark:text-info-dark">
        Conformité MINEFOP : Ce document officiel ne comporte <strong>aucun code QR</strong>. Le format bascule automatiquement en mode Paysage dès que la classe comporte 5 épreuves ou plus.
      </div>
    </div>
  );
}