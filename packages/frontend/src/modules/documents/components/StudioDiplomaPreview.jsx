// packages/frontend/src/modules/documents/components/StudioDiplomaPreview.jsx
import React from "react";
import Icon from "../../../components/Icon";

export default function StudioDiplomaPreview({ config, center, logoUrl, diplomaBgUrl }) {
  const primaryColor = config.primaryColor || "#071A2E";
  const accentColor = config.accentColor || "#007799";

  return (
    <div className="w-[520px] h-[368px] bg-white rounded border border-slate-300 shadow-2xl p-4 flex flex-col justify-between text-[7px] leading-tight select-none relative overflow-hidden">
      {/* 1. Image de fond pleine page : TOUJOURS 100% NETTE */}
      {diplomaBgUrl ? (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-100">
          <img src={diplomaBgUrl} alt="Fond Attestation" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute left-[38px] top-0 bottom-0 w-[58px] bg-[#071A2E] flex flex-col justify-between items-center shadow-md">
            <div className="w-[2px] h-full bg-[#0B2742] absolute left-1.5" />
            <div className="w-[2px] h-full bg-[#0B2742] absolute right-1.5" />
          </div>
          <div className="absolute left-[30px] top-[145px] w-[74px] h-[74px] rounded-full bg-slate-200 border-2 border-slate-300 flex items-center justify-center shadow-xl">
            <div className="w-[60px] h-[60px] rounded-full bg-slate-100 border border-slate-400 flex items-center justify-center">
              <Icon name="school" className="text-3xl text-[#071A2E]" />
            </div>
          </div>
        </div>
      )}

      {/* 2. Zone de Contenu : Décalée à droite (pl-40) */}
      <div className="relative z-10 pl-40 pr-4 h-full flex flex-col justify-between text-center">
        {/* En-tête : Logo & Nom Établissement entouré de deux filets */}
        <div className="space-y-1 pt-0.5">
          <div className="w-9 h-9 mx-auto rounded bg-white/90 p-0.5 border border-slate-200 flex items-center justify-center shadow-xs">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Icon name="school" className="text-xl text-[#071A2E]" />
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            <div className="h-[0.8px] bg-slate-300 flex-1 max-w-[85px]" />
            <span className="font-bold text-[8.5px] uppercase tracking-wide truncate max-w-[250px]" style={{ color: primaryColor }}>
              {center?.name || "CENTRE DE FORMATION PROFESSIONNELLE"}
            </span>
            <div className="h-[0.8px] bg-slate-300 flex-1 max-w-[85px]" />
          </div>
        </div>

        {/* Titre & Sous-titre Grands Formats */}
        <div className="space-y-0.5">
          <div className="font-bold text-[14px] uppercase tracking-wider leading-none" style={{ color: primaryColor }}>
            {config.documentTitle || "ATTESTATION DE FIN DE FORMATION"}
          </div>
          <div className="font-bold text-[8.8px] uppercase tracking-widest pt-0.5" style={{ color: accentColor }}>
            {config.subTitle || "CERTIFICAT DE RÉUSSITE"}
          </div>
          <div className="w-9 h-[2px] mx-auto rounded mt-0.5" style={{ backgroundColor: accentColor }} />
        </div>

        {/* Formule Cursive & Nom du Lauréat */}
        <div className="space-y-0.5">
          <span
            className="text-[9.5px] text-slate-700 block italic"
            style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
          >
            Nous certifions que
          </span>
          <div className="font-bold text-[16px] uppercase text-slate-900 tracking-wide leading-tight">
            NGALEU ARMSTRONG EUCLADOR
          </div>
          <div className="text-[6.5px] text-slate-500 font-mono">
            Né(e) le 12/11/2004 à Bafoussam
          </div>
        </div>

        {/* Formule Cursive de Succès & Formation */}
        <div className="space-y-0.5">
          <span
            className="text-[9px] text-slate-700 block italic"
            style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
          >
            a suivi avec succès la formation
          </span>
          <div className="font-bold text-[13px] uppercase tracking-wide leading-tight" style={{ color: primaryColor }}>
            GRAPHISME DE PRODUCTION
          </div>

          <div className="flex items-center justify-center gap-2 pt-0.5">
            <div className="h-[0.8px] bg-slate-300 flex-1 max-w-[70px]" />
            <span className="font-bold text-[7.2px] text-slate-600">
              {config.trainingDuration || "Durée : 1 an(s) (Session 2026-2027) • DQP (Niveau 1)"}
            </span>
            <div className="h-[0.8px] bg-slate-300 flex-1 max-w-[70px]" />
          </div>
        </div>

        {/* Date & Signature */}
        <div className="space-y-0.5">
          <span className="text-[7.5px] text-slate-600 block">
            Fait à {center?.city || "Bafoussam"}, le {new Date().toLocaleDateString("fr-FR")}
          </span>

          <div className="w-32 mx-auto">
            <div className="h-7 flex items-center justify-center">
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="text-slate-900 stroke-current">
                <path d="M5 16C12 4 18 22 26 10C30 3 38 4 45 12C50 18 35 15 55 14" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div className="h-[0.8px] bg-slate-800 w-full mb-0.5" />
            <span className="font-bold text-[7.5px] text-slate-800 block truncate">
              {config.signatoryTitle || "Le Directeur Général"}
            </span>
          </div>
        </div>

        {/* Pied de page */}
        <div className="flex justify-between items-center text-[6.5px] text-slate-500 pt-0.5 border-t border-slate-200">
          <span className="font-bold text-slate-700">N° ATTESTATION : CEFOPIA-GP26-0001</span>
          <span>Agrément MINEFOP : {center?.registrationNumber || "Autorisé"}</span>
        </div>
      </div>
    </div>
  );
}