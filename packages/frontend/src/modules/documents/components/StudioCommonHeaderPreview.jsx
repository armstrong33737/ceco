// packages/frontend/src/modules/documents/components/StudioCommonHeaderPreview.jsx
import React, { useState } from "react";
import Icon from "../../../components/Icon";

export default function StudioCommonHeaderPreview({ config, center, logoUrl, sealUrl }) {
  const [viewMode, setViewMode] = useState("national");
  const primaryColor = config.primaryColor || "#071A2E";
  const headerMode = config.headerMode || "logo";
  const internalConfig = config.internalHeader || {};

  return (
    <div className="w-[390px] min-h-[500px] bg-white rounded border border-slate-300 shadow-xl p-6 flex flex-col justify-between text-[7.5px] leading-tight select-none relative overflow-hidden">
      {/* 1. Filigrane Logo Visible */}
      {logoUrl && config.showWatermark !== false && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center z-0"
          style={{ opacity: config.watermarkOpacity !== undefined ? config.watermarkOpacity : 0.05 }}
        >
          <img src={logoUrl} alt="Filigrane" className="w-48 h-48 object-contain" />
        </div>
      )}

      {/* Contenu z-10 */}
      <div className="relative z-10 space-y-3">
        {/* Sélecteur de prévisualisation */}
        <div className="flex justify-center mb-2">
          <div className="flex p-0.5 bg-slate-100 rounded border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("national")}
              className={`px-2.5 py-1 text-[6.5px] font-bold rounded-[2px] transition-colors ${
                viewMode === "national" ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              En-tête National
            </button>
            <button
              type="button"
              onClick={() => setViewMode("internal")}
              className={`px-2.5 py-1 text-[6.5px] font-bold rounded-[2px] transition-colors ${
                viewMode === "internal" ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              En-tête Interne
            </button>
          </div>
        </div>

        {viewMode === "national" ? (
          /* EN-TÊTE NATIONAL BILINGUE */
          <div className="border-b-2 pb-3 space-y-2" style={{ borderColor: primaryColor }}>
            <div className="flex justify-between items-start text-[6.5px] font-bold">
              <div className="w-[34%] text-center whitespace-pre-line leading-tight text-slate-800">
                {config.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE"}
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
                {config.headerRight || "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING"}
              </div>
            </div>

            <div className="text-center space-y-0.5 pt-1">
              <div className="font-bold text-[10.5px] uppercase tracking-wide truncate" style={{ color: primaryColor }}>
                {center?.name || "CENTRE DE FORMATION PROFESSIONNELLE"}
              </div>
              <div className="text-[7.2px] text-slate-700 font-semibold truncate">
                ARRÊTÉ D'AGRÉMENT MINEFOP : {center?.registrationNumber || "Autorisé / En cours"} • VILLE : {(center?.city || "Cameroun").toUpperCase()}
              </div>
              <div className="text-[6.2px] text-slate-500 truncate">
                Tél : {center?.phone || "Non renseigné"} • Email : {center?.email || "Non renseigné"}{center?.address ? ` • ${center.address}` : ""}
              </div>
            </div>
          </div>
        ) : (
          /* EN-TÊTE INTERNE D'ÉTABLISSEMENT SIMPLE */
          <div className="flex items-center gap-2.5 pb-2.5 border-b-2" style={{ borderColor: primaryColor }}>
            <div className="w-11 h-11 rounded bg-slate-50 border border-slate-200 p-0.5 flex items-center justify-center flex-shrink-0">
              {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <Icon name="storefront" className="text-slate-500 text-[22px]" />}
            </div>
            <div className="truncate flex-1">
              <div className="font-bold text-[10px] uppercase truncate" style={{ color: primaryColor }}>
                {internalConfig.title || center?.name || "CENTRE DE FORMATION PROFESSIONNELLE"}
              </div>
              <div className="text-[7.2px] text-slate-700 font-semibold truncate mt-0.5">
                {internalConfig.accreditation || `ARRÊTÉ MINEFOP : ${center?.registrationNumber || "Autorisé"} • ${center?.city || "Bafoussam"}`}
              </div>
              <div className="text-[6.2px] text-slate-500 truncate mt-0.5">
                {internalConfig.contacts || `Tél : ${center?.phone || "—"} • Email : ${center?.email || "—"}`}
              </div>
            </div>
          </div>
        )}

        <div className="my-auto py-6 space-y-3 text-center">
          <div className="w-20 h-[2px] mx-auto rounded" style={{ backgroundColor: primaryColor }} />
          <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 font-mono">
            [ ZONE DU CORPS DE L'ACTE ACADÉMIQUE ]
          </div>
          <p className="text-[6.5px] text-slate-500 max-w-xs mx-auto leading-relaxed italic">
            Les actes héritent automatiquement de cet en-tête et de la charte de couleur.
          </p>
        </div>
      </div>

      <div className="relative z-10 flex justify-between items-center text-[6px] text-slate-500 pt-2 border-t border-slate-200 mt-4 font-mono">
        <span className="truncate max-w-[260px]">{config.footerLegal || "Document officiel certifié conforme • Toute altération annule la validité du présent acte."}</span>
        <span className="font-bold text-[7px] tracking-wider" style={{ color: primaryColor }}>CECO SUITE ERP</span>
      </div>
    </div>
  );
}