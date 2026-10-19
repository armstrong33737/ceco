// packages/frontend/src/modules/documents/components/StudioInscriptionPreview.jsx
import React from "react";
import Icon from "../../../components/Icon";

export default function StudioInscriptionPreview({ config, center, logoUrl }) {
  const primaryColor = config.primaryColor || "#071A2E";
  const signatories = config.signatories || [
    { title: "Signature de l'Apprenant(e) / Tuteur", roleKey: "student" },
    { title: "Visa & Cachet de la Direction", roleKey: "directeur" },
  ];

  return (
    <div className="w-[390px] min-h-[550px] bg-white rounded border border-slate-300 shadow-xl p-6 flex flex-col justify-between text-[7.5px] leading-tight select-none relative overflow-hidden">
      {/* 1. En-tête simple et noble de l'établissement */}
      <div className="flex items-center gap-3 pb-3 border-b-2" style={{ borderColor: primaryColor }}>
        <div className="w-12 h-12 rounded bg-slate-50 border border-slate-200 p-1 flex items-center justify-center flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <Icon name="storefront" className="text-slate-400 text-[24px]" />
          )}
        </div>
        <div className="truncate flex-1">
          <div className="font-bold text-[9.5px] uppercase truncate" style={{ color: primaryColor }}>
            {center?.name || "CENTRE DE FORMATION PROFESSIONNELLE"}
          </div>
          <div className="text-[7px] text-slate-700 font-semibold truncate mt-0.5">
            ARRÊTÉ MINEFOP : {center?.registrationNumber || "Autorisé / En cours"} • VILLE : {(center?.city || "Cameroun").toUpperCase()}
          </div>
          <div className="text-[6px] text-slate-500 truncate mt-0.5">
            Tél : {center?.phone || "Non renseigné"} • Email : {center?.email || "Non renseigné"} • {center?.address || ""}
          </div>
        </div>
      </div>

      {/* 2. Titre Aéré & Session */}
      <div className="text-center my-3 space-y-1">
        <div className="font-bold text-[10px] uppercase tracking-wide" style={{ color: primaryColor }}>
          {config.documentTitle || "FICHE INDIVIDUELLE D'INSCRIPTION & D'ENGAGEMENT"}
        </div>
        <div className="text-[7.5px] font-bold text-slate-500">
          SESSION ACADÉMIQUE : 2026-2027  •  PROMOTION : Cohorte d'entrée
        </div>
      </div>

      {/* 3. Section I : Identité Civile de l'Apprenant */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1">
          <div className="w-1 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="font-bold uppercase text-[7.5px]" style={{ color: primaryColor }}>
            I. Identité Civile de l'Apprenant(e)
          </span>
        </div>

        <div className="flex gap-3 items-center pt-0.5">
          <div className="space-y-1 flex-1 text-[7px]">
            <div><span className="text-slate-500">Nom de famille :</span> <strong className="text-slate-900 text-[8px]">NGALEU</strong></div>
            <div><span className="text-slate-500">Prénom(s) :</span> <strong className="text-slate-900 text-[8px]">Armstrong Euclador</strong></div>
            <div><span className="text-slate-500">Matricule Officiel :</span> <strong className="font-mono text-slate-900 text-[8px]">CEFOPIA-GP26-0001</strong></div>
            <div><span className="text-slate-500">Date &amp; Lieu Naiss. :</span> 12/11/2004 à Bafoussam</div>
            <div><span className="text-slate-500">Genre &amp; Contact :</span> Masculin • Tél : +237 670 000 111</div>
          </div>
          <div className="w-14 h-14 rounded-[2px] bg-slate-100 border border-slate-300 flex items-center justify-center flex-shrink-0 shadow-inner">
            <Icon name="person" className="text-3xl text-slate-400" />
          </div>
        </div>
      </div>

      {/* 4. Section II : Tuteur & Scolarité Antérieure */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1">
          <div className="w-1 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="font-bold uppercase text-[7.5px]" style={{ color: primaryColor }}>
            II. Parent / Tuteur Légal &amp; Diplôme d'Entrée
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[6.8px] pt-0.5">
          <div><span className="text-slate-500 block">Parent / Tuteur :</span><strong className="text-slate-800">M. NGALEU Pierre</strong></div>
          <div><span className="text-slate-500 block">Téléphone Urgence :</span><strong className="text-slate-800">+237 699 000 222</strong></div>
          <div><span className="text-slate-500 block">Diplôme Présenté :</span><strong className="text-slate-800">BEPC / O-Level</strong></div>
        </div>
      </div>

      {/* 5. Section III : Affectation Pédagogique */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1">
          <div className="w-1 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="font-bold uppercase text-[7.5px]" style={{ color: primaryColor }}>
            III. Affectation Académique &amp; Cycle Choisi
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[6.8px] pt-0.5">
          <div><span className="text-slate-500 block">Filière d'Études :</span><strong className="text-slate-800">Graphisme de Production</strong></div>
          <div><span className="text-slate-500 block">Cycle / Qualification :</span><strong className="text-slate-800">DQP (Niveau 1)</strong></div>
          <div><span className="text-slate-500 block">Classe / Groupe :</span><strong className="text-slate-800">GP-Niv 1 (2026-2027)</strong></div>
        </div>
      </div>

      {/* 6. Section IV : Déclaration sur l'honneur & Engagement */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1">
          <div className="w-1 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="font-bold uppercase text-[7.5px]" style={{ color: primaryColor }}>
            IV. Engagement Formel de l'Apprenant(e) &amp; Règlement Intérieur
          </span>
        </div>
        <div className="pl-2 border-l-2 py-0.5" style={{ borderColor: primaryColor }}>
          <p className="text-[6.2px] text-slate-600 leading-relaxed text-justify">
            {config.engagementText || "Je soussigné(e), déclare sur l'honneur l'exactitude des informations fournies et reconnais avoir pris pleine connaissance du règlement intérieur de l'établissement. Je m'engage formellement à faire preuve d'assiduité, de ponctualité, de probité et de respect envers le corps professoral et les équipements tout au long de mon cycle de formation."}
          </p>
        </div>
      </div>

      {/* 7. Section V : Validation Administrative & Signatures */}
      <div className="mt-2">
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-1.5">
          <div className="w-1 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="font-bold uppercase text-[7.5px]" style={{ color: primaryColor }}>
            V. Validation de l'Inscription &amp; Émargements Bilatéraux
          </span>
        </div>

        <div className="text-right text-[6.5px] text-slate-500 mb-2">
          Fait à {center?.city || "Bafoussam"}, le {new Date().toLocaleDateString("fr-FR")}
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          {signatories.slice(0, 2).map((sig, idx) => (
            <div key={idx} className="space-y-0.5">
              <span className="font-bold text-[7.5px] block truncate text-slate-900">{sig.title}</span>
              <span className="text-[5.5px] text-slate-500 italic block">
                {idx === 0 ? "(Mention manuscrite 'Lu et approuvé')" : "(Cachet officiel et visa administratif)"}
              </span>
              <div className="h-11 border border-slate-300 rounded flex items-center justify-center text-[6px] text-slate-400 bg-slate-50">
                [Zone d'Émargement {sig.roleKey}]
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 8. Pied de page STRICTEMENT ANCRÉ en bas de page */}
      <div className="flex justify-between items-center text-[5.8px] text-slate-500 pt-2 border-t border-slate-200 mt-4 font-mono">
        <span className="truncate max-w-[260px]">{config.footerLegal || "Document officiel d'inscription académique conservé aux archives"}</span>
        <span className="font-bold text-[6.5px] tracking-wider" style={{ color: primaryColor }}>CECO SUITE ERP</span>
      </div>
    </div>
  );
}