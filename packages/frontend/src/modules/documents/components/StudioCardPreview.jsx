// packages/frontend/src/modules/documents/components/StudioCardPreview.jsx
import React, { useState } from "react";
import Icon from "../../../components/Icon";

export default function StudioCardPreview({ config, center, logoUrl, cardBgUrl }) {
  const [side, setSide] = useState("recto");

  const sampleLongName = "TCHIENTCHEU TCHOKOMENI JEAN-BAPTISTE CYRILLE";
  let nameFontSize = "text-[8.5px]";
  if (sampleLongName.length > 32) {
    nameFontSize = "text-[6.5px]";
  } else if (sampleLongName.length > 24) {
    nameFontSize = "text-[7.5px]";
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="flex p-0.5 bg-[#F5F7FA] rounded border border-border dark:bg-[#07111D] dark:border-border-dark">
          <button
            type="button"
            onClick={() => setSide("recto")}
            className={`px-3 py-1 text-caption font-semibold rounded-[2px] transition-colors ${
              side === "recto" ? "bg-brand-900 text-white dark:bg-brand-500" : "text-ink-secondary"
            }`}
          >
            Face Recto
          </button>
          <button
            type="button"
            onClick={() => setSide("verso")}
            className={`px-3 py-1 text-caption font-semibold rounded-[2px] transition-colors ${
              side === "verso" ? "bg-brand-900 text-white dark:bg-brand-500" : "text-ink-secondary"
            }`}
          >
            Dos Verso
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center p-4">
        {side === "recto" ? (
          /* RECTO */
          <div
            className="w-[340px] h-[215px] rounded border border-slate-300 shadow-lg p-3 flex flex-col justify-between relative overflow-hidden select-none bg-white"
          >
            {/* Texture de fond si présente */}
            {cardBgUrl && (
              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <img src={cardBgUrl} alt="Fond" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Cartouche supérieur */}
            <div
              className="rounded p-2 flex items-center gap-2 text-white shadow-xs relative z-10"
              style={{ backgroundColor: config.themeColor || "#071A2E" }}
            >
              <div className="w-7 h-7 rounded bg-white p-0.5 flex items-center justify-center flex-shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Icon name="storefront" className="text-brand-900 text-[18px]" />
                )}
              </div>
              <div className="truncate flex-1">
                <div className="font-bold text-[8.5px] uppercase truncate leading-tight">
                  {center?.name || "CENTRE DE FORMATION PROFESSIONNELLE"}
                </div>
                <div className="text-[7px] text-slate-300 font-bold uppercase tracking-wider mt-0.5">
                  {config.cardTitle || "CARTE D’ÉTUDIANT"}
                </div>
              </div>
            </div>

            {/* Zone Centrale */}
            <div className="flex gap-2.5 items-center my-auto px-1 relative z-10">
              <div className="w-16 h-16 rounded-[2px] bg-slate-100 border border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                <Icon name="person" className="text-4xl text-slate-400" />
              </div>
              <div className="space-y-0.5 truncate flex-1 leading-tight">
                <div className={`font-bold text-slate-900 uppercase truncate ${nameFontSize}`}>
                  {sampleLongName}
                </div>
                <div className="text-[7.5px] font-bold truncate" style={{ color: config.themeColor || "#071A2E" }}>
                  Développement Web &amp; Multimédia
                </div>
                <div className="text-[6.5px] text-slate-700 font-medium">
                  Niveau 1 • Qualification DQP
                </div>
                <div className="text-[6px] text-slate-500 truncate">
                  Né(e) le : 12/11/2004 à Bafoussam
                </div>
                <div className="text-[6px] text-slate-500 truncate">
                  Genre : Masculin • Tél : +237 670 000 111
                </div>
              </div>
            </div>

            {/* Zone Inférieure : ID à gauche (SANS CADRE) & QR Code remonté */}
            <div className="flex items-end justify-between border-t border-slate-200 pt-1 px-1 relative z-10">
              <div className="space-y-0.5 pb-0.5">
                <span className="text-[6px] text-slate-400 uppercase font-bold block">ID / MATRICULE OFFICIEL</span>
                <span
                  className="font-mono font-bold text-[9.5px] tracking-wider block"
                  style={{ color: config.accentColor || "#18527A" }}
                >
                  ETU-2026-00124
                </span>
                <span className="text-[5.5px] text-slate-400 font-mono block">
                  Session : 2026-2027 • CECO ID-PASS
                </span>
              </div>

              {/* Cadre ornemental autour du QR Code */}
              <div className="flex flex-col items-center mb-0.5">
                <div
                  className="p-1 rounded bg-white shadow-xs relative border"
                  style={{ borderColor: config.themeColor || "#071A2E" }}
                >
                  <div
                    className="border p-0.5 rounded-[1px]"
                    style={{ borderColor: config.accentColor || "#18527A" }}
                  >
                    <Icon name="qr_code_2" className="text-[28px] text-slate-900 block" />
                  </div>
                </div>
                <span className="text-[5px] font-mono font-bold text-slate-500 mt-0.5">SCAN VÉRIF</span>
              </div>
            </div>
          </div>
        ) : (
          /* VERSO */
          <div className="w-[340px] h-[215px] rounded bg-[#FAFAFA] border border-slate-300 shadow-lg p-3 flex flex-col justify-between select-none relative overflow-hidden">
            {/* Texture de fond si présente */}
            {cardBgUrl && (
              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <img src={cardBgUrl} alt="Fond" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="space-y-1.5 text-center relative z-10">
              <p
                className="text-[7px] italic font-semibold"
                style={{ color: config.themeColor || "#071A2E" }}
              >
                « {config.welcomeMessage || "Bienvenue au sein de notre établissement. L'excellence et la rigueur au service de votre avenir."} »
              </p>
              <div className="h-[0.5px] bg-slate-200 mx-4" />
              <p className="text-[6px] text-slate-600 leading-normal text-justify px-2">
                {config.termsOfUse || "Cette carte est strictement personnelle et demeure la propriété exclusive du centre. Sa présentation est obligatoire pour l'accès aux cours, ateliers et examens."}
              </p>
            </div>

            <div className="bg-white/95 p-2 rounded border border-slate-200 text-[6.5px] space-y-0.5 relative z-10 shadow-xs">
              <span className="font-bold text-slate-900 block uppercase" style={{ color: config.themeColor || "#071A2E" }}>
                Contacts de l'établissement :
              </span>
              <div className="text-slate-700">Tél : {center?.phone || "+237 600 000 000"} • Email : {center?.email || "contact@ceco.cm"}</div>
              <div className="text-slate-500 truncate">Adresse : {center?.address || "Quartier Administratif"} • {center?.city || "Bafoussam"}</div>
            </div>

            <div className="flex items-center justify-between text-[6.5px] px-1 relative z-10">
              <div className="space-y-0.5 text-slate-500 font-mono">
                <div>Agrément : {center?.registrationNumber || "MINEFOP N° 0042"}</div>
                <div>Session : 2026-2027</div>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-800 block text-[7px]">
                  {config.signatoryTitle || "Le Directeur Général"}
                </span>
                <span className="text-[6px] italic text-slate-400 font-serif">
                  [Visa : {config.signatoryRoleKey || "directeur"}]
                </span>
              </div>
            </div>

            <div
              className="-mx-3 -mb-3 px-3 py-1 flex items-center justify-between text-white text-[6px] font-bold relative z-10"
              style={{ backgroundColor: config.themeColor || "#071A2E" }}
            >
              <span>TITRE OFFICIEL D'IDENTIFICATION ACADÉMIQUE</span>
              <span className="text-slate-300">PROPULSÉ PAR CECO ERP</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}