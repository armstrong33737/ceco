// packages/frontend/src/modules/documents/components/StudioInternalPvPreview.jsx
import React from "react";
import Icon from "../../../components/Icon";

export default function StudioInternalPvPreview({ config, center, logoUrl, docType = "PV_SEMESTRE" }) {
  const primaryColor = config.primaryColor || "#071A2E";
  const internalConfig = config.internalHeader || {};
  const isLandscape = docType === "PV_SEMESTRE" || docType === "PV_ANNUEL" || docType === "PV_CC";

  const sampleSubjects = [
    { code: "GRA01", name: "Infographie Vectorielle 2D", coef: 4 },
    { code: "GRA02", name: "Mise en Page Indesign", coef: 3 },
    { code: "GRA03", name: "Traitement d'Images", coef: 2 },
    { code: "ENG01", name: "Anglais Professionnel", coef: 2 },
    { code: "ENT01", name: "Législation & Éthique", coef: 1 },
  ];

  return (
    <div
      className={`${
        isLandscape ? "w-[560px] min-h-[390px]" : "w-[410px] min-h-[580px]"
      } bg-white rounded border border-slate-300 shadow-xl p-4 flex flex-col justify-between text-[6.5px] leading-tight select-none relative overflow-hidden transition-all duration-150`}
    >
      {/* 1. Filigrane : UNIQUEMENT LE LOGO DU CENTRE */}
      {logoUrl && config.showWatermark !== false && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center z-0"
          style={{ opacity: config.watermarkOpacity !== undefined ? config.watermarkOpacity : 0.05 }}
        >
          <img src={logoUrl} alt="Filigrane" className="w-48 h-48 object-contain" />
        </div>
      )}

      {/* Contenu z-10 */}
      <div className="relative z-10 space-y-2">
        {/* 2. EN-TÊTE INTERNE D'ÉTABLISSEMENT : DISPOSITION CÔTE À CÔTE CENTRÉE AU MILIEU DE PAGE */}
        <div className="border-b pb-2 flex items-center justify-center gap-3.5" style={{ borderColor: primaryColor }}>
          {logoUrl ? (
            <div className="w-11 h-11 rounded bg-slate-50 border border-slate-200 p-0.5 flex items-center justify-center shadow-xs flex-shrink-0">
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
              <Icon name="storefront" className="text-[22px]" />
            </div>
          )}

          <div className="text-left space-y-0.5 max-w-[420px]">
            <div className="font-bold text-[10px] uppercase tracking-wide truncate" style={{ color: primaryColor }}>
              {internalConfig.title || center?.name || "CENTRE DE FORMATION PROFESSIONNELLE"}
            </div>

            <div className="text-[6.8px] text-slate-700 font-semibold truncate">
              {internalConfig.accreditation || `ARRÊTÉ D'AGRÉMENT MINEFOP : ${center?.registrationNumber || "Autorisé / En cours"} • VILLE : ${(center?.city || "Cameroun").toUpperCase()}`}
            </div>

            <div className="text-[6.2px] text-slate-500 truncate">
              {internalConfig.contacts || `Tél : ${center?.phone || "Non renseigné"} • Email : ${center?.email || "Non renseigné"}`}
            </div>
          </div>
        </div>

        {/* 3. Titre de Délibération */}
        <div className="py-1 px-2 text-center font-bold text-[8.5px] uppercase tracking-wide text-white rounded" style={{ backgroundColor: primaryColor }}>
          {docType === "PV_CC" ? "PROCÈS-VERBAL DU CONTRÔLE CONTINU (CC & TP)" :
           docType === "PV_ANNUEL" ? "GRILLE OFFICIELLE DE DÉLIBÉRATION ANNUELLE" :
           docType === "PV_MATIERE" ? "PROCÈS-VERBAL DE NOTES DE COURS" :
           docType === "BORDEREAU_VIERGE" ? "BORDEREAU DE REPORT DE NOTES MANUSCRIT" : "GRILLE OFFICIELLE DE DÉLIBÉRATION SEMESTRIELLE"}
        </div>

        {/* 4. Table Synthétique de Notes */}
        <div className="border border-slate-300 rounded overflow-hidden text-[6px]">
          <div className="flex text-white font-bold py-1 px-1.5" style={{ backgroundColor: primaryColor }}>
            <span className="w-6 text-center">N°</span>
            <span className="w-20">MATRICULE</span>
            <span className="w-32">NOMS ET PRÉNOMS</span>
            {sampleSubjects.map((s) => (
              <span key={s.code} className="flex-1 text-center font-mono">
                {s.code} (C{s.coef})
              </span>
            ))}
            <span className="w-14 text-center">MOYENNE</span>
            <span className="w-14 text-center">DÉCISION</span>
          </div>

          <div className="flex py-1 px-1.5 border-t border-slate-200 bg-white items-center">
            <span className="w-6 text-center font-mono">1</span>
            <span className="w-20 font-mono font-bold text-slate-900">CEF-GP26-0001</span>
            <span className="w-32 truncate font-semibold text-slate-900">NGALEU ARMSTRONG</span>
            <span className="flex-1 text-center">15.50</span>
            <span className="flex-1 text-center">14.00</span>
            <span className="flex-1 text-center">16.00</span>
            <span className="flex-1 text-center">13.50</span>
            <span className="flex-1 text-center">15.00</span>
            <span className="w-14 text-center font-bold text-[7px]" style={{ color: primaryColor }}>14.80</span>
            <span className="w-14 text-center font-bold text-emerald-700">ADMIS</span>
          </div>

          <div className="flex py-1 px-1.5 border-t border-slate-200 bg-slate-50 items-center">
            <span className="w-6 text-center font-mono">2</span>
            <span className="w-20 font-mono font-bold text-slate-900">CEF-GP26-0002</span>
            <span className="w-32 truncate font-semibold text-slate-900">CHOUAPI DAVILA</span>
            <span className="flex-1 text-center">12.00</span>
            <span className="flex-1 text-center">11.50</span>
            <span className="flex-1 text-center">13.00</span>
            <span className="flex-1 text-center">14.00</span>
            <span className="flex-1 text-center">12.50</span>
            <span className="w-14 text-center font-bold text-[7px]" style={{ color: primaryColor }}>12.45</span>
            <span className="w-14 text-center font-bold text-emerald-700">ADMIS</span>
          </div>
        </div>

        {/* 5. LÉGENDE DE CORRESPONDANCE DES CODES AUX MATIÈRES AU BAS DU DOCUMENT */}
        <div className="p-2 rounded border border-slate-300 bg-slate-50 space-y-1">
          <div className="font-bold text-[6.5px] uppercase tracking-wider" style={{ color: primaryColor }}>
            LÉGENDE DES CODES &amp; DISCIPLINES ENSEIGNÉES :
          </div>
          <div className="text-[5.8px] text-slate-600 leading-tight">
            {sampleSubjects.map((s) => `[${s.code}] : ${s.name} (Coef ${s.coef})`).join("   •   ")}
          </div>
        </div>
      </div>

      {/* 6. Pied de page */}
      <div className="relative z-10 flex justify-between items-center text-[5.5px] text-slate-500 pt-1 border-t border-slate-200 mt-2 font-mono">
        <span className="truncate max-w-[320px]">
          {config.footerLegal || "Document officiel de délibération pédagogique conservé aux archives de l'établissement"}
        </span>
        <span className="font-bold tracking-wider" style={{ color: primaryColor }}>CECO SUITE ERP</span>
      </div>
    </div>
  );
}