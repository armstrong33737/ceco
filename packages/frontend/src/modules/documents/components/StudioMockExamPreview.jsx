// packages/frontend/src/modules/documents/components/StudioMockExamPreview.jsx
import React, { useState } from "react";

export default function StudioMockExamPreview({ config, center }) {
  const [previewSubjectCount, setPreviewSubjectCount] = useState(4); // 4 épreuves = Portrait, 5 épreuves = Paysage
  const isLandscape = previewSubjectCount >= 5;

  const regionalContacts = config.regionalContacts || {
    phone: "233 44 53 80 / 233 44 59 00",
    email: "drefopouest@yahoo.fr",
    city: "Bafoussam",
  };

  const sampleSubjects = [
    { code: "EPS", coef: "02" },
    { code: "MSP", coef: "05" },
    { code: "EPT", coef: "03" },
    { code: "EPP", coef: "04" },
    { code: "LÉG", coef: "02" },
    { code: "ANG", coef: "02" },
  ].slice(0, previewSubjectCount);

  return (
    <div className="space-y-3 w-full flex flex-col items-center">
      {/* Contrôle interactif du nombre d'épreuves pour vérifier la bascule dynamique à 5 */}
      <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded border border-slate-300 shadow-xs text-[11px] text-slate-700 w-full max-w-[560px]">
        <span className="font-semibold">Simulateur d'orientation dynamique :</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPreviewSubjectCount(4)}
            className={`px-2.5 py-1 rounded text-caption font-bold transition-colors ${
              previewSubjectCount === 4 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            4 Épreuves (A4 Portrait)
          </button>
          <button
            type="button"
            onClick={() => setPreviewSubjectCount(5)}
            className={`px-2.5 py-1 rounded text-caption font-bold transition-colors ${
              previewSubjectCount === 5 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            5 Épreuves (A4 Paysage)
          </button>
        </div>
      </div>

      {/* Rendu du Bordereau MINEFOP Conforme (Avec aération verticale) */}
      <div
        className={`${
          isLandscape ? "w-[560px] min-h-[390px]" : "w-[410px] min-h-[580px]"
        } bg-white rounded border border-slate-300 shadow-xl p-4 flex flex-col justify-between text-[6.5px] leading-tight select-none relative overflow-hidden transition-all duration-150`}
      >
        <div>
          {/* 1. En-tête Régional */}
          <div className="flex justify-between items-start text-[5.5px] font-bold text-black pb-1">
            <div className="w-[45%] text-center whitespace-pre-line leading-relaxed">
              {config.headerLeft || "REPUBLIQUE DU CAMEROUN\nPaix – Travail – Patrie\n*********\nREGION DE L'OUEST\n*********\nDELEGATION REGIONALE DE L'EMPLOI ET DE LA\nFORMATION PROFESSIONNELLE\n*********\nINSPECTION REGIONALE DES FORMATIONS\n*********"}
              <div className="mt-2 pt-1">Tél : {regionalContacts.phone}</div>
            </div>
            <div className="w-[45%] text-center whitespace-pre-line leading-relaxed">
              {config.headerRight || "REPUBLIC OF CAMEROON\nPeace – Work – Fatherland\n*********\nWEST REGION\n*********\nREGIONAL DELEGATION OF EMPLOYMENT\nAND VOCATIONAL TRAINING\n*********\nREGIONAL INSPECTORATE OF TRAININGS\n*********"}
              <div className="mt-2 pt-1">Email : {regionalContacts.email}</div>
              <div className="mt-2 font-normal text-right">{regionalContacts.city}, le _______________________</div>
            </div>
          </div>

          {/* 2. Bandeau Grisé Supérieur (Aéré) */}
          <div className="mt-4 py-1.5 px-2 bg-slate-300 text-center font-bold text-[8px] border border-slate-400 uppercase tracking-tight text-black">
            {config.examBannerTitle || "EXAMEN REGIONAL DU DQP BLANC, SESSION DE 2026"}
          </div>

          {/* 3. Cadre Intitulé Épais (Aéré) */}
          <div className="mt-3 py-1.5 px-2 border-2 border-black text-center font-bold text-[9px] uppercase tracking-wide text-black">
            {config.examFrameTitle || "BORDEREAU DES NOTES DES CANDIDATS"}
          </div>

          {/* 4. Cartouche Métier Souligné (Aéré) */}
          <div className="mt-4 mb-3 text-center font-bold space-y-1 text-[6.5px] text-black">
            <div>CENTRE DE FORMATION / TRAINING CENTER : <span className="underline">{center?.name || "CEFOPIA"}</span></div>
            <div>SPECIALITE / SPECIALITY: <span className="underline">GRAPHISME DE PRODUCTION</span></div>
            <div>NIVEAU D'ENTRÉE / LEVEL OF ENTRY: <span className="underline">BEPC / NIVEAU 3EME</span></div>
          </div>

          {/* 5. Tableau des Candidats */}
          <div className="border border-black overflow-hidden text-[6px] text-black">
            <div className="flex bg-slate-200 font-bold border-b border-black text-center items-center">
              <div className="w-5 py-1 border-r border-black">N°</div>
              <div className="w-32 py-1 border-r border-black leading-none">NOMS ET PRENOMS DU CANDIDAT</div>
              <div className="w-14 py-1 border-r border-black leading-none">DATE DE NAISS.</div>
              <div className="w-16 py-1 border-r border-black leading-none">LIEU DE NAISS.</div>

              {sampleSubjects.map((sub, i) => (
                <div key={i} className="flex-1 border-r border-black">
                  <div className="border-b border-black py-0.5 font-bold">{sub.code} - COEF : {sub.coef}</div>
                  <div className="flex text-[5.5px]">
                    <span className="w-1/2 border-r border-black py-0.2">NOTE</span>
                    <span className="w-1/2 py-0.2">N*C</span>
                  </div>
                </div>
              ))}

              <div className="w-14 py-1 font-bold leading-none">MOYENNE / 20</div>
            </div>

            {/* Candidat 1 */}
            <div className="flex border-b border-black text-center items-center font-bold">
              <div className="w-5 py-1.5 border-r border-black">1</div>
              <div className="w-32 py-1.5 border-r border-black text-left pl-1 truncate">CHOUAPI NGAGOUM DAVILA</div>
              <div className="w-14 py-1.5 border-r border-black">12/11/2006</div>
              <div className="w-16 py-1.5 border-r border-black truncate">MTE BAMKA</div>
              {sampleSubjects.map((sub, i) => (
                <div key={i} className="flex-1 flex border-r border-black">
                  <span className="w-1/2 border-r border-black py-1.5">14.00</span>
                  <span className="w-1/2 py-1.5">{(14 * parseInt(sub.coef)).toFixed(0)}.00</span>
                </div>
              ))}
              <div className="w-14 py-1.5 font-bold">14.00</div>
            </div>

            {/* Candidat 2 : Absent (M) */}
            <div className="flex border-b border-black text-center items-center font-bold">
              <div className="w-5 py-1.5 border-r border-black">2</div>
              <div className="w-32 py-1.5 border-r border-black text-left pl-1 truncate">NOUWA SIEWE BRENDA</div>
              <div className="w-14 py-1.5 border-r border-black">12/02/2004</div>
              <div className="w-16 py-1.5 border-r border-black truncate">BANGOU</div>
              {sampleSubjects.map((sub, i) => (
                <div key={i} className="flex-1 flex border-r border-black">
                  {i === 1 ? (
                    <>
                      <span className="w-1/2 border-r border-black py-1.5 text-red-600">M</span>
                      <span className="w-1/2 py-1.5 text-red-600">M</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1/2 border-r border-black py-1.5">12.50</span>
                      <span className="w-1/2 py-1.5">{(12.5 * parseInt(sub.coef)).toFixed(1)}</span>
                    </>
                  )}
                </div>
              ))}
              <div className="w-14 py-1.5 font-bold">11.80</div>
            </div>
          </div>
        </div>

        {/* 6. Signature Officielle */}
        <div className="mt-8 text-right font-bold text-[7.5px] pr-4 text-black">
          <span className="underline">{config.signatoryTitle || "LE DELEGUE DEPARTEMENTAL"}</span>
        </div>
      </div>
    </div>
  );
}
