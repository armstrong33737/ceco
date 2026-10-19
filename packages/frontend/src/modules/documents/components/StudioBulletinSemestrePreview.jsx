// packages/frontend/src/modules/documents/components/StudioBulletinSemestrePreview.jsx
import React from "react";
import Icon from "../../../components/Icon";

export default function StudioBulletinSemestrePreview({ config, center, logoUrl, sealUrl }) {
  const primaryColor = config.primaryColor || "#071A2E";
  const headerMode = config.headerMode || "logo";

  // Lecture dynamique des signataires configurés
  const signatories = config.signatories && config.signatories.length > 0 ? config.signatories : [
    { title: "Le Formateur Titulaire", roleKey: "formateur" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];

  return (
    <div className="w-[420px] min-h-[600px] bg-white rounded border border-slate-300 shadow-xl p-5 flex flex-col justify-between text-[7px] leading-tight select-none relative overflow-hidden">
      {/* 1. Filigrane Logo Visible */}
      {logoUrl && config.showWatermark !== false && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center z-0"
          style={{ opacity: config.watermarkOpacity !== undefined ? config.watermarkOpacity : 0.05 }}
        >
          <img src={logoUrl} alt="Filigrane" className="w-52 h-52 object-contain" />
        </div>
      )}

      {/* Contenu z-10 */}
      <div className="relative z-10 space-y-2">
        {/* 2. En-tête Bilingue Officiel Allongé avec Délégations */}
        <div className="border-b-2 pb-2 space-y-1.5" style={{ borderColor: primaryColor }}>
          <div className="flex justify-between items-start text-[5.5px] font-bold">
            <div className="w-[34%] text-center whitespace-pre-line leading-tight text-slate-800">
              {config.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE\n----\nDÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA"}
            </div>

            {/* Armoiries Centrales */}
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

        {/* 3. Titre Officiel */}
        <div className="py-1 px-2 rounded text-center text-white font-bold text-[8.5px] uppercase tracking-wide shadow-xs" style={{ backgroundColor: primaryColor }}>
          {config.documentTitle || "BULLETIN SEMESTRIEL DE NOTES"} • SEMESTRE 1
        </div>

        {/* 4. Cartouche Élève Spacieux */}
        <div className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div className="space-y-0.5 text-[6.8px] flex-1">
            <div><span className="text-slate-500">NOM &amp; PRÉNOM :</span> <strong className="text-slate-900 text-[8px]">NGALEU ARMSTRONG EUCLADOR</strong></div>
            <div><span className="text-slate-500">MATRICULE :</span> <strong className="font-mono text-slate-900">CEFOPIA-GP26-0001</strong> • <span className="text-slate-500">SEXE :</span> M • <span className="text-slate-500">NÉ LE :</span> 12/11/2004</div>
            <div><span className="text-slate-500">SPÉCIALITÉ :</span> <strong style={{ color: primaryColor }}>Graphisme de Production [DQP • Niveau 1]</strong></div>
            <div className="text-[6.2px] text-slate-500">Classe : GP-Niveau 1 • Session : 2026-2027 • Promotion active</div>
          </div>
          <div className="w-12 h-13 bg-white border border-slate-300 rounded flex items-center justify-center flex-shrink-0 ml-2 shadow-inner">
            <Icon name="person" className="text-3xl text-slate-400" />
          </div>
        </div>

        {/* 5. Tableau Semestriel Complet (CC, EXAM, NOTE, VAL, ENSEIGNANTS) */}
        <div className="border border-slate-300 rounded overflow-hidden text-[6.2px]">
          <div className="flex text-white font-bold py-1 px-1.5" style={{ backgroundColor: primaryColor }}>
            <span className="w-28">MODULES / DISCIPLINES</span>
            <span className="w-7 text-center">COEF</span>
            <span className="w-10 text-center">CC</span>
            <span className="w-10 text-center">EXAM</span>
            <span className="w-11 text-center">NOTE</span>
            <span className="w-11 text-center">N × C</span>
            <span className="w-7 text-center">RANG</span>
            <span className="w-7 text-center">VAL.</span>
            <span className="w-16 text-center">APPRÉC.</span>
            <span className="flex-1 pl-1.5">ENSEIGNANT</span>
          </div>

          {/* Groupe 1 : Spécialité Professionnelle */}
          <div className="bg-slate-200 font-bold px-2 py-0.5 text-slate-800 text-[6px]">
            COMPÉTENCES DE SPÉCIALITÉ (COEF : 9)
          </div>
          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-white items-center">
            <span className="w-28 truncate font-semibold text-slate-900">[GRA01] Infographie Vectorielle</span>
            <span className="w-7 text-center">4</span>
            <span className="w-10 text-center">15.0</span>
            <span className="w-10 text-center">14.5</span>
            <span className="w-11 text-center font-bold text-slate-900 text-[6.8px]">14.65</span>
            <span className="w-11 text-center font-bold">58.60</span>
            <span className="w-7 text-center">1er</span>
            <span className="w-7 text-center font-bold text-emerald-700">Oui</span>
            <span className="w-16 text-center"><span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">Bien</span></span>
            <span className="flex-1 pl-1.5 truncate text-slate-600">M. TCHOUPO P.</span>
          </div>

          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-slate-50 items-center">
            <span className="w-28 truncate font-semibold text-slate-900">[GRA02] Mise en Page Indesign</span>
            <span className="w-7 text-center">3</span>
            <span className="w-10 text-center">16.0</span>
            <span className="w-10 text-center">15.0</span>
            <span className="w-11 text-center font-bold text-slate-900 text-[6.8px]">15.30</span>
            <span className="w-11 text-center font-bold">45.90</span>
            <span className="w-7 text-center">2e</span>
            <span className="w-7 text-center font-bold text-emerald-700">Oui</span>
            <span className="w-16 text-center"><span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">Très Bien</span></span>
            <span className="flex-1 pl-1.5 truncate text-slate-600">M. FOPA David</span>
          </div>

          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-white items-center">
            <span className="w-28 truncate font-semibold text-slate-900">[GRA03] Traitement d'Images</span>
            <span className="w-7 text-center">2</span>
            <span className="w-10 text-center">14.0</span>
            <span className="w-10 text-center">16.0</span>
            <span className="w-11 text-center font-bold text-slate-900 text-[6.8px]">15.40</span>
            <span className="w-11 text-center font-bold">30.80</span>
            <span className="w-7 text-center">1er</span>
            <span className="w-7 text-center font-bold text-emerald-700">Oui</span>
            <span className="w-16 text-center"><span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">Très Bien</span></span>
            <span className="flex-1 pl-1.5 truncate text-slate-600">Mme NOUBISSI</span>
          </div>

          {/* Groupe 2 : Enseignement Général */}
          <div className="bg-slate-200 font-bold px-2 py-0.5 text-slate-800 text-[6px]">
            ENSEIGNEMENT GÉNÉRAL &amp; TRANSVERSAL (COEF : 4)
          </div>
          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-white items-center">
            <span className="w-28 truncate font-semibold text-slate-900">[ENG01] Anglais Professionnel</span>
            <span className="w-7 text-center">2</span>
            <span className="w-10 text-center">13.0</span>
            <span className="w-10 text-center">14.0</span>
            <span className="w-11 text-center font-bold text-slate-900 text-[6.8px]">13.70</span>
            <span className="w-11 text-center font-bold">27.40</span>
            <span className="w-7 text-center">3e</span>
            <span className="w-7 text-center font-bold text-emerald-700">Oui</span>
            <span className="w-16 text-center"><span className="px-1 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">Assez Bien</span></span>
            <span className="flex-1 pl-1.5 truncate text-slate-600">M. NKWENTI J.</span>
          </div>

          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-slate-50 items-center">
            <span className="w-28 truncate font-semibold text-slate-900">[ENT01] Législation &amp; Éthique</span>
            <span className="w-7 text-center">1</span>
            <span className="w-10 text-center">15.0</span>
            <span className="w-10 text-center">15.0</span>
            <span className="w-11 text-center font-bold text-slate-900 text-[6.8px]">15.00</span>
            <span className="w-11 text-center font-bold">15.00</span>
            <span className="w-7 text-center">2e</span>
            <span className="w-7 text-center font-bold text-emerald-700">Oui</span>
            <span className="w-16 text-center"><span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">Bien</span></span>
            <span className="flex-1 pl-1.5 truncate text-slate-600">Me KAMDEM E.</span>
          </div>

          <div className="flex py-1.5 px-1.5 border-t border-slate-200 bg-white items-center">
            <span className="w-28 truncate font-semibold text-slate-900">[EPS01] Éducation Physique</span>
            <span className="w-7 text-center">1</span>
            <span className="w-10 text-center">14.0</span>
            <span className="w-10 text-center">15.0</span>
            <span className="w-11 text-center font-bold text-slate-900 text-[6.8px]">14.70</span>
            <span className="w-11 text-center font-bold">14.70</span>
            <span className="w-7 text-center">2e</span>
            <span className="w-7 text-center font-bold text-emerald-700">Oui</span>
            <span className="w-16 text-center"><span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">Bien</span></span>
            <span className="flex-1 pl-1.5 truncate text-slate-600">M. BEKONO A.</span>
          </div>

          {/* Ligne Totaux Généraux */}
          <div className="flex py-1.5 px-1.5 border-t-2 border-slate-300 bg-slate-100 font-bold items-center text-[6.8px]">
            <span className="w-28">TOTAL DU SEMESTRE</span>
            <span className="w-7 text-center font-mono">13</span>
            <span className="w-31 text-right pr-2">POINTS :</span>
            <span className="w-11 text-center text-white py-0.5 rounded" style={{ backgroundColor: primaryColor }}>192.40</span>
            <span className="flex-1 text-right text-slate-700 pr-2">
              MOYENNE SEMESTRE : <strong className="text-[7.2px]" style={{ color: primaryColor }}>14.80 / 20</strong>
            </span>
          </div>
        </div>

        {/* 6. Double Matrice Synoptique Rehaussée */}
        <div className="grid grid-cols-2 gap-2 text-[6.5px] pt-1">
          <div className="p-2 rounded border border-slate-300 bg-slate-50 space-y-1">
            <span className="font-bold text-slate-900 block text-[7px] border-b border-slate-200 pb-0.5">
              STATISTIQUES DE LA PROMOTION
            </span>
            <div className="flex justify-between"><span>Moyenne de l'élève :</span><strong className="text-slate-900 text-[7.2px]">14.80 / 20</strong></div>
            <div className="flex justify-between"><span>Moyenne générale classe :</span><span>12.40 / 20</span></div>
            <div className="flex justify-between"><span>Plus forte moyenne :</span><span>16.80 / 20</span></div>
            <div className="flex justify-between"><span>Plus faible moyenne :</span><span>08.40 / 20</span></div>
            <div className="flex justify-between pt-0.5 border-t border-slate-200 font-bold">
              <span>Taux de réussite classe :</span><span className="text-emerald-700">88.5 %</span>
            </div>
          </div>

          <div className="p-2 rounded border border-slate-300 bg-slate-50 space-y-1">
            <span className="font-bold text-slate-900 block text-[7px] border-b border-slate-200 pb-0.5">
              PROFIL, RANG &amp; OBSERVATIONS DU JURY
            </span>
            <div className="flex justify-between">
              <span>Rang de l'apprenant(e) :</span><strong className="text-slate-900">2e sur 26 élèves</strong>
            </div>
            <div className="flex justify-between">
              <span>Mention obtenue :</span><strong className="text-emerald-700">BIEN (Tableau d'honneur)</strong>
            </div>
            <div className="flex justify-between text-[6px] text-slate-500 font-mono">
              <span>Retards : 0</span><span>Absences : 0</span><span>Blâme : 0</span>
            </div>
            <div className="italic text-slate-700 pt-0.5 border-t border-slate-200 text-[6.2px] leading-tight">
              « Très bon travail dans l'ensemble. Résultats solides et réguliers. Tableau d'honneur décerné par le conseil. »
            </div>
          </div>
        </div>

        {/* 7. Signatures Dynamiques Réactives (Itère sur signatories en temps réel) */}
        <div className="flex justify-between items-end pt-2 border-t border-slate-200 text-[6.5px]">
          <div className="p-1 border border-slate-300 rounded text-center">
            <Icon name="qr_code_2" className="text-2xl text-slate-800 mx-auto block" />
            <span className="text-[4.5px] font-mono text-slate-500 font-bold">QR SCELLÉ</span>
          </div>

          <div className="flex justify-end gap-3 flex-1 pl-4">
            {signatories.map((sig, idx) => (
              <div key={idx} className="text-center space-y-0.5 flex-1 min-w-[80px] max-w-[130px]">
                <span className="font-bold block text-slate-900 truncate">{sig.title}</span>
                <span className="text-slate-400 italic text-[5.5px] block">
                  {idx === 0 ? "(Visa formateur)" : "(Cachet et visa)"}
                </span>
                <div className="h-10 border border-slate-300 rounded flex items-center justify-center text-[5.5px] text-slate-400 bg-slate-50 truncate px-1">
                  [Visa : {sig.roleKey || "directeur"}]
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 8. Pied de page STRICTEMENT ANCRÉ en bas de page */}
      <div className="relative z-10 flex justify-between items-center text-[5.5px] text-slate-500 pt-1.5 border-t border-slate-200 mt-2 font-mono">
        <span>{config.footerLegal || "Toute rature ou surcharge annule la validité du présent bulletin officiel • Registre sécurisé CECO ERP."}</span>
        <span className="font-bold tracking-wider" style={{ color: primaryColor }}>CECO SUITE ERP</span>
      </div>
    </div>
  );
}