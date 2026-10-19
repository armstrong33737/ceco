// packages/frontend/src/modules/documents/components/StudioAttestationPreview.jsx
import React from "react";
import Icon from "../../../components/Icon";

export default function StudioAttestationPreview({ config, center, logoUrl, sealUrl }) {
  const primaryColor = config.primaryColor || "#071A2E";
  const headerMode = config.headerMode || "logo";

  const signatories = config.signatories || [
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];

  // Formulation grammaticalement irréprochable
  let introSentence = "";
  if (center?.directorName && center.directorName.trim()) {
    introSentence = `Je soussigné, Monsieur/Madame ${center.directorName.trim()}, en qualité de Directeur Général de l'établissement susmentionné, certifie par la présente que :`;
  } else {
    introSentence = "Je soussigné, le Directeur Général de l'établissement susmentionné, certifie par la présente que :";
  }

  return (
    <div className="w-[390px] min-h-[550px] bg-white rounded border border-slate-300 shadow-xl p-6 flex flex-col justify-between text-[7.5px] leading-tight select-none relative overflow-hidden">
      {/* 1. En-tête Bilingue Officiel National avec Police Rehaussée */}
      <div className="border-b-2 pb-2.5 space-y-1.5" style={{ borderColor: primaryColor }}>
        <div className="flex justify-between items-start text-[6.5px] font-bold">
          <div className="w-[34%] text-center whitespace-pre-line leading-tight text-slate-800">
            RÉPUBLIQUE DU CAMEROUN{"\n"}Paix - Travail - Patrie{"\n"}----{"\n"}MINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE
          </div>

          {/* Bloc central d'armoiries selon headerMode */}
          <div className="flex items-center justify-center gap-1.5 pt-0.5 flex-1">
            {(headerMode === "seal" || headerMode === "both") && (
              <div className="w-8 h-8 rounded p-0.5 flex items-center justify-center">
                {sealUrl ? (
                  <img src={sealUrl} alt="Sceau" className="w-full h-full object-contain" />
                ) : (
                  <Icon name="military_tech" className="text-amber-700 text-[18px]" />
                )}
              </div>
            )}
            {(headerMode === "logo" || headerMode === "both") && (
              <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 p-0.5 flex items-center justify-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Icon name="storefront" className="text-slate-500 text-[18px]" />
                )}
              </div>
            )}
          </div>

          <div className="w-[34%] text-center whitespace-pre-line leading-tight text-slate-800">
            REPUBLIC OF CAMEROON{"\n"}Peace - Work - Fatherland{"\n"}----{"\n"}MINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING
          </div>
        </div>

        {/* Nom du centre avec police agrandie et nette */}
        <div className="text-center space-y-0.5 pt-1">
          <div className="font-bold text-[10px] uppercase tracking-wide truncate" style={{ color: primaryColor }}>
            {center?.name || "CENTRE DE FORMATION PROFESSIONNELLE"}
          </div>
          <div className="text-[7.2px] text-slate-700 font-semibold truncate">
            ARRÊTÉ D'AGRÉMENT MINEFOP : {center?.registrationNumber || "Autorisé / En cours"} • VILLE : {(center?.city || "Cameroun").toUpperCase()}
          </div>
          <div className="text-[6.2px] text-slate-500 truncate">
            Tél : {center?.phone || "Non renseigné"} • Email : {center?.email || "Non renseigné"}
          </div>
        </div>
      </div>

      {/* 2. Titre Noble du Certificat avec Réglette Centrale */}
      <div className="text-center my-3 space-y-0.5">
        <div className="font-bold text-[11px] uppercase tracking-wider" style={{ color: primaryColor }}>
          {config.documentTitle || "CERTIFICAT DE SCOLARITÉ & D'INSCRIPTION"}
        </div>
        <div className="text-[7px] font-bold text-slate-500 italic">
          {config.subTitle || "ATTESTATION OF SCHOOL ATTENDANCE & ENROLMENT"}
        </div>
        <div className="w-20 h-[1.5px] mx-auto mt-1" style={{ backgroundColor: primaryColor }} />
      </div>

      {/* 3. Formule Solennelle d'Ouverture (Corrigée en français irréprochable) */}
      <div className="px-2 text-[7.5px] text-justify leading-relaxed text-slate-800">
        {introSentence}
      </div>

      {/* 4. Cartouche d'Identification de l'Élève (Photo/Avatar parfaitement centré) */}
      <div className="my-2 p-2.5 rounded bg-slate-50 border-l-2 border border-slate-200 flex items-center justify-between" style={{ borderLeftColor: primaryColor }}>
        <div className="space-y-1 text-[7.2px] flex-1">
          <div><span className="text-slate-500">L'Apprenant(e) :</span> <strong className="text-[9px] text-slate-900">NGALEU ARMSTRONG EUCLADOR</strong></div>
          <div><span className="text-slate-500">Matricule Officiel :</span> <strong className="font-mono text-[9px]" style={{ color: primaryColor }}>CEFOPIA-GP26-0001</strong></div>
          <div><span className="text-slate-500">Né(e) le :</span> 12/11/2004 à Bafoussam</div>
          <div><span className="text-slate-500">Filière d'Études :</span> <strong className="text-slate-800">Graphisme de Production</strong></div>
          <div><span className="text-slate-500">Cycle / Qualification :</span> <strong>DQP (Niveau 1)</strong></div>
          <div><span className="text-slate-500">Session Académique :</span> 2026-2027 • Promotion active</div>
        </div>

        {/* Cadre de photo centré */}
        <div className="w-16 h-16 rounded-[2px] bg-white border border-slate-300 flex items-center justify-center flex-shrink-0 shadow-inner ml-2">
          <Icon name="person" className="text-4xl text-slate-400" />
        </div>
      </div>

      {/* 5. Attestation d'Assiduité Formelle */}
      <div className="px-2 space-y-2 text-[7.5px] text-justify leading-relaxed text-slate-700">
        <p>
          {config.attestationBodyText || "Est régulièrement inscrit(e) au registre matricule de notre établissement et poursuit avec assiduité et régularité l'ensemble des enseignements théoriques, travaux dirigés et ateliers pratiques prescrits pour le compte de la session académique susmentionnée."}
        </p>
        <p>
          En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.
        </p>
      </div>

      {/* 6. Zone de Validation Administrative (SANS CODE QR) */}
      <div className="mt-4 pt-2">
        <div className="text-right text-[7px] text-slate-500 mb-2">
          Fait à {center?.city || "Bafoussam"}, le {new Date().toLocaleDateString("fr-FR")}
        </div>

        <div className={`grid ${signatories.length > 1 ? "grid-cols-2" : "grid-cols-1 justify-items-center"} gap-4 text-center`}>
          {signatories.map((sig, idx) => (
            <div key={idx} className="space-y-0.5 w-44">
              <span className="font-bold text-[8px] block truncate text-slate-900">{sig.title}</span>
              <span className="text-[6px] text-slate-500 italic block">(Cachet et signature)</span>
              <div className="h-12 border border-slate-300 rounded flex items-center justify-center text-[6.5px] text-slate-400 bg-slate-50 shadow-inner">
                [Signature &amp; Cachet {sig.roleKey}]
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Pied de page STRICTEMENT ANCRÉ en bas de page */}
      <div className="flex justify-between items-center text-[6px] text-slate-500 pt-2 border-t border-slate-200 mt-4 font-mono">
        <span className="truncate max-w-[260px]">{config.footerLegal || "Document officiel certifié conforme • Toute altération annule la validité du présent acte."}</span>
        <span className="font-bold text-[7px] tracking-wider" style={{ color: primaryColor }}>CECO SUITE ERP</span>
      </div>
    </div>
  );
}