// packages/frontend/src/modules/documents/components/StudioTranscriptPreview.jsx
import React from "react";
import Icon from "../../../components/Icon";

export default function StudioTranscriptPreview({ config, center, logoUrl, sealUrl, transcriptBgUrl }) {
  const primaryColor = config.primaryColor || "#071A2E";
  const headerMode = config.headerMode || "logo";
  const textureOpacity = config.bgTextureOpacity !== undefined ? config.bgTextureOpacity : 0.22;

  const signatories = config.signatories && config.signatories.length > 0 ? config.signatories : [
    { title: "Le Directeur des Études", roleKey: "directeur" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];

  return (
    <div className="w-[420px] min-h-[610px] bg-white rounded border border-slate-300 shadow-xl p-5 flex flex-col justify-between text-[7px] leading-tight select-none relative overflow-hidden">
      {/* 1. Texture de Fond recap_bg Active et Visible */}
      {transcriptBgUrl && (
        <div
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
          style={{ opacity: textureOpacity }}
        >
          <img src={transcriptBgUrl} alt="Fond Recap" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Filigrane Logo */}
      {logoUrl && config.showWatermark !== false && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center z-0"
          style={{ opacity: config.watermarkOpacity !== undefined ? config.watermarkOpacity : 0.04 }}
        >
          <img src={logoUrl} alt="Filigrane" className="w-52 h-52 object-contain" />
        </div>
      )}

      {/* Contenu principal z-10 (translucide pour révéler le motif recap_bg) */}
      <div className="relative z-10 space-y-2">
        {/* 2. En-tête Bilingue Officiel Allongé */}
        <div className="border-b-2 pb-2 space-y-1.5" style={{ borderColor: primaryColor }}>
          <div className="flex justify-between items-start text-[5.5px] font-bold">
            <div className="w-[34%] text-center whitespace-pre-line leading-tight text-slate-800">
              {config.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE\n----\nDÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA"}
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-0.5 flex-1">
              {(headerMode === "seal" || headerMode === "both") && (
                <div className="w-8 h-8 rounded p-0.5 flex items-center justify-center">
                  {sealUrl ? <img src={sealUrl} alt="Sceau" className="w-full h-full object-contain" /> : <Icon name="military_tech" className="text-amber-700 text-[18px]" />}
                </div>
              )}
              {(headerMode === "logo" || headerMode === "both") && (
                <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 p-0.5 flex items-center justify-center">
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <Icon name="storefront" className="text-slate-500 text-[18px]" />}
                </div>
              )}
            </div>

            <div className="w-[34%] text-center whitespace-pre-line leading-tight text-slate-800">
              {config.headerRight || "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING\n----\nREGIONAL DELEGATION FOR THE WEST\nDIVISIONAL DELEGATION FOR MENOUA"}
            </div>
          </div>

          <div className="text-center space-y-0.5 pt-0.5">
            <div className="font-bold text-[9.5px] uppercase tracking-wide truncate" style={{ color: primaryColor }}>
              {center?.name || "CENTRE DE FORMATION PROFESSIONNELLE"}
            </div>
            <div className="text-[6.8px] text-slate-600 font-semibold truncate">
              ARRÊTÉ D'AGRÉMENT MINEFOP : {center?.registrationNumber || "Autorisé / En cours"} • VILLE : {(center?.city || "Cameroun").toUpperCase()}
            </div>
          </div>
        </div>

        {/* 3. Titre du Relevé Annuel */}
        <div className="py-1 px-2 rounded text-center text-white font-bold text-[8.5px] uppercase tracking-wide shadow-xs" style={{ backgroundColor: primaryColor }}>
          {config.documentTitle || "RELEVÉ DE NOTES ANNUEL OFFICIEL / ACADEMIC TRANSCRIPT"}
        </div>

        {/* 4. Cartouche Élève Individuel (Translucide) */}
        <div className="p-2 rounded bg-white/80 border border-slate-300 flex items-center justify-between shadow-xs">
          <div className="space-y-0.5 text-[6.8px] flex-1">
            <div><span className="text-slate-500">NOM &amp; PRÉNOM(S) :</span> <strong className="text-slate-900 text-[8.2px]">NGALEU ARMSTRONG EUCLADOR</strong></div>
            <div><span className="text-slate-500">MATRICULE ÉTUDIANT :</span> <strong className="font-mono text-slate-900">CEFOPIA-GP26-0001</strong> • <span className="text-slate-500">NÉ LE :</span> 12/11/2004</div>
            <div><span className="text-slate-500">SPÉCIALITÉ :</span> <strong style={{ color: primaryColor }}>Graphisme de Production [DQP • Niveau 1]</strong></div>
            <div className="text-[6.2px] text-slate-500">Session Académique : 2026-2027 • Promotion : 2026-2028 (Cohorte certifiée)</div>
          </div>
          <div className="w-12 h-13 bg-white/90 border border-slate-300 rounded flex items-center justify-center flex-shrink-0 ml-2 shadow-inner">
            <Icon name="person" className="text-3xl text-slate-400" />
          </div>
        </div>

        {/* 5. Tableau des Unités d'Enseignement (Translucide révélant recap_bg) */}
        <div className="border border-slate-300 rounded overflow-hidden text-[6.2px] bg-white/70">
          <div className="flex text-white font-bold py-1 px-1.5" style={{ backgroundColor: primaryColor }}>
            <span className="w-14">CODE UE</span>
            <span className="w-36">MODULES ANNUELS</span>
            <span className="w-12 text-center">CRÉDITS</span>
            <span className="w-14 text-center">NOTE / 20</span>
            <span className="w-14 text-center">POINTS</span>
            <span className="w-10 text-center">GRADE</span>
            <span className="flex-1 text-center">RÉSULTAT</span>
          </div>

          <div className="bg-slate-200/90 font-bold px-2 py-0.5 text-slate-800 text-[6px]">
            COMPÉTENCES PROFESSIONNELLES DE SPÉCIALITÉ (CRÉDITS : 9)
          </div>
          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-white/75 items-center">
            <span className="w-14 font-mono font-bold text-slate-900">GRA01</span>
            <span className="w-36 truncate font-semibold text-slate-900">Infographie Vectorielle 2D</span>
            <span className="w-12 text-center">4</span>
            <span className="w-14 text-center font-bold text-slate-900 text-[7px]">15.50</span>
            <span className="w-14 text-center">62.00</span>
            <span className="w-10 text-center font-bold text-slate-900">B</span>
            <span className="flex-1 text-center font-bold text-emerald-700">VALIDÉ</span>
          </div>

          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-white/60 items-center">
            <span className="w-14 font-mono font-bold text-slate-900">GRA02</span>
            <span className="w-36 truncate font-semibold text-slate-900">Mise en Page &amp; Prépresse</span>
            <span className="w-12 text-center">3</span>
            <span className="w-14 text-center font-bold text-slate-900 text-[7px]">14.80</span>
            <span className="w-14 text-center">44.40</span>
            <span className="w-10 text-center font-bold text-slate-900">B</span>
            <span className="flex-1 text-center font-bold text-emerald-700">VALIDÉ</span>
          </div>

          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-white/75 items-center">
            <span className="w-14 font-mono font-bold text-slate-900">GRA03</span>
            <span className="w-36 truncate font-semibold text-slate-900">Traitement Numérique d'Images</span>
            <span className="w-12 text-center">2</span>
            <span className="w-14 text-center font-bold text-slate-900 text-[7px]">16.50</span>
            <span className="w-14 text-center">33.00</span>
            <span className="w-10 text-center font-bold text-slate-900">A</span>
            <span className="flex-1 text-center font-bold text-emerald-700">VALIDÉ</span>
          </div>

          <div className="bg-slate-200/90 font-bold px-2 py-0.5 text-slate-800 text-[6px]">
            ENSEIGNEMENT GÉNÉRAL &amp; TRANSVERSAL (CRÉDITS : 4)
          </div>
          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-white/75 items-center">
            <span className="w-14 font-mono font-bold text-slate-900">ENG01</span>
            <span className="w-36 truncate font-semibold text-slate-900">Anglais Technique Appliqué</span>
            <span className="w-12 text-center">2</span>
            <span className="w-14 text-center font-bold text-slate-900 text-[7px]">13.50</span>
            <span className="w-14 text-center">27.00</span>
            <span className="w-10 text-center font-bold text-slate-900">C</span>
            <span className="flex-1 text-center font-bold text-emerald-700">VALIDÉ</span>
          </div>

          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-white/60 items-center">
            <span className="w-14 font-mono font-bold text-slate-900">ENT01</span>
            <span className="w-36 truncate font-semibold text-slate-900">Législation Professionnelle</span>
            <span className="w-12 text-center">1</span>
            <span className="w-14 text-center font-bold text-slate-900 text-[7px]">15.00</span>
            <span className="w-14 text-center">15.00</span>
            <span className="w-10 text-center font-bold text-slate-900">B</span>
            <span className="flex-1 text-center font-bold text-emerald-700">VALIDÉ</span>
          </div>

          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-white/75 items-center">
            <span className="w-14 font-mono font-bold text-slate-900">EPS01</span>
            <span className="w-36 truncate font-semibold text-slate-900">Éducation Physique &amp; Sportive</span>
            <span className="w-12 text-center">1</span>
            <span className="w-14 text-center font-bold text-slate-900 text-[7px]">14.50</span>
            <span className="w-14 text-center">14.50</span>
            <span className="w-10 text-center font-bold text-slate-900">B</span>
            <span className="flex-1 text-center font-bold text-emerald-700">VALIDÉ</span>
          </div>

          <div className="flex py-1.5 px-1.5 border-t-2 border-slate-300 bg-slate-100/90 font-bold items-center text-[6.8px]">
            <span className="w-50">TOTAL DES UNITÉS ENSEIGNÉES</span>
            <span className="w-12 text-center font-mono">13</span>
            <span className="w-14 text-right pr-2">POINTS :</span>
            <span className="w-14 text-center text-white py-0.5 rounded" style={{ backgroundColor: primaryColor }}>195.90</span>
            <span className="flex-1 text-right text-slate-700 pr-2">CRÉDITS VALIDÉS : 13 / 13</span>
          </div>
        </div>

        {/* 6. Bilan Académique & Décision Individuelle */}
        <div className="grid grid-cols-2 gap-2 text-[6.5px] pt-1">
          <div className="p-2 rounded border border-slate-300 bg-white/80 space-y-1 shadow-xs">
            <span className="font-bold text-slate-900 block text-[7px] border-b border-slate-200 pb-0.5">
              BILAN ACADÉMIQUE DE L'ÉTUDIANT(E)
            </span>
            <div className="flex justify-between"><span>Total crédits prescrits :</span><strong>13 crédits</strong></div>
            <div className="flex justify-between"><span>Total crédits validés :</span><strong className="text-emerald-700">13 / 13 crédits</strong></div>
            <div className="flex justify-between items-center pt-0.5 border-t border-slate-200">
              <span className="font-bold">Moyenne Générale Annuelle :</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-slate-900 font-bold text-[7.5px]">15.07 / 20</span>
            </div>
            <div className="flex justify-between"><span>Mention d'Honneur :</span><strong className="text-emerald-700">BIEN</strong></div>
          </div>

          <div className="p-2 rounded border border-slate-300 bg-white/80 space-y-1 shadow-xs">
            <span className="font-bold text-slate-900 block text-[7px] border-b border-slate-200 pb-0.5">
              DÉCISION DU JURY DE DÉLIBÉRATION
            </span>
            <div className="py-1 px-1 rounded bg-emerald-100 text-emerald-800 font-bold text-center text-[7.5px]">
              ADMIS(E) EN NIVEAU SUPÉRIEUR
            </div>
            <p className="text-[5.8px] text-slate-600 leading-tight italic pt-0.5 text-justify">
              Le présent relevé de notes annuel officiel est délivré pour servir et valoir ce que de droit sous réserve de l'obtention du diplôme d'État définitif.
            </p>
          </div>
        </div>

        {/* 7. Signatures Officielles & QR Code Compact */}
        <div className="flex justify-between items-end pt-2 border-t border-slate-200 text-[6.5px]">
          <div className="p-1 border border-slate-300 rounded text-center bg-white/85">
            <Icon name="qr_code_2" className="text-2xl text-slate-800 mx-auto block" />
            <span className="text-[4.5px] font-mono text-slate-500 font-bold">QR SCELLÉ</span>
          </div>

          <div className="flex justify-end gap-3 flex-1 pl-4">
            {signatories.map((sig, idx) => (
              <div key={idx} className="text-center space-y-0.5 flex-1 min-w-[80px] max-w-[130px]">
                <span className="font-bold block text-slate-900 truncate">{sig.title}</span>
                <span className="text-slate-400 italic text-[5.5px] block">(Cachet et visa)</span>
                <div className="h-10 border border-slate-300 rounded flex items-center justify-center text-[5.5px] text-slate-400 bg-white/80 truncate px-1 shadow-inner">
                  [Visa : {sig.roleKey || "directeur"}]
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 8. Pied de page STRICTEMENT ANCRÉ en bas de page */}
      <div className="relative z-10 flex justify-between items-center text-[5.5px] text-slate-500 pt-1.5 border-t border-slate-200 mt-2 font-mono">
        <span>{config.footerLegal || "Document académique officiel certifié conforme • Toute surcharge ou altération annule le présent acte."}</span>
        <span className="font-bold tracking-wider" style={{ color: primaryColor }}>CECO SUITE ERP</span>
      </div>
    </div>
  );
}