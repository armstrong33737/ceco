// packages/backend/src/services/pdf/modules/attestationsPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const { bufferFromDataUrl } = require("../common/pdfHelpers");
const { drawDynamicBilingualHeader } = require("../common/pdfHeaders");
const { drawWatermark, drawStudentAvatar } = require("../common/pdfGraphics");
const { renderSignatoriesAndQrCompact } = require("../common/pdfSignatories");

function renderSingleAttestationPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const primaryColor = tmpl.primaryColor || "#071A2E";

  const startX = 25;
  const fullWidth = 545;

  // 1. Filigrane & En-tête officiel
  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 230, 290);
  drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 20, fullWidth, startX);

  // 2. Titre Officiel Encadré
  const titleY = 126;
  doc.rect(startX, titleY, fullWidth, 24).fillAndStroke(primaryColor, primaryColor);
  doc.rect(startX, titleY, fullWidth, 1.5).fill("#D4AF37");
  doc.rect(startX, titleY + 22.5, fullWidth, 1.5).fill("#D4AF37");

  doc.fillColor("#FFFFFF").fontSize(10.5).font("Helvetica-Bold").text(
    (tmpl.documentTitle || "CERTIFICAT DE SCOLARITÉ & D'INSCRIPTION").toUpperCase(),
    startX, titleY + 6.5, { width: fullWidth, align: "center", characterSpacing: 0.5 }
  );

  if (tmpl.subTitle) {
    doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold").text(
      tmpl.subTitle.toUpperCase(),
      startX, titleY + 28, { width: fullWidth, align: "center" }
    );
  }

  // 3. Formule d'ouverture officielle
  const introY = 160;
  const directorTitle = center.directorTitle || "Directeur Général";
  const directorName = center.directorName ? `Monsieur / Madame ${center.directorName}` : "La Direction de l'Établissement";

  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica").text(
    `Je soussigné, ${directorName}, en qualité de ${directorTitle} de l'établissement susmentionné, certifie par la présente que :`,
    startX, introY, { width: fullWidth, lineGap: 3.5, align: "justify" }
  );

  // 4. Cartouche d'Identification de l'Apprenant
  const boxY = 196;
  const boxH = 120;
  doc.rect(startX, boxY, fullWidth, boxH).fillAndStroke("#F8FAFC", "#CBD5E1");

  const avatarW = 68;
  const avatarH = 68;
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  drawStudentAvatar(doc, photoBuf, startX + fullWidth - avatarW - 14, boxY + 12, avatarW, avatarH);

  let curY = boxY + 11;
  const labelX = startX + 14;
  const valueX = startX + 130;
  const lineSpacing = 17;

  // Ligne 1 : Nom complet
  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("L'Apprenant(e) :", labelX, curY);
  doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Bold").text(
    `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`,
    valueX, curY - 1
  );

  // Ligne 2 : Matricule
  curY += lineSpacing;
  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Matricule Officiel :", labelX, curY);
  doc.rect(valueX, curY - 1.5, 120, 13).fill("#FFF275");
  doc.fillColor(primaryColor).fontSize(8.5).font("Courier-Bold").text(student.matricule || "—", valueX + 4, curY, { width: 112, align: "center" });

  // Ligne 3 : Date et lieu de naissance
  curY += lineSpacing;
  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Date & Lieu Naiss. :", labelX, curY);
  const birthDateStr = student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "Non renseignée";
  const birthPlaceStr = student.birthPlace ? ` à ${student.birthPlace.toUpperCase()}` : "";
  doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(`${birthDateStr}${birthPlaceStr}`, valueX, curY);

  // Ligne 4 : Filière & Cycle
  curY += lineSpacing;
  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Filière d'Études :", labelX, curY);
  doc.fillColor("#0F172A").fontSize(9).font("Helvetica-Bold").text(
    `${classe.filiereName || "—"} [${classe.programTypeCode || "DQP"}]`,
    valueX, curY
  );

  // Ligne 5 : Niveau & Session
  curY += lineSpacing;
  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Niveau / Promotion :", labelX, curY);
  doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(
    `Niveau ${classe.niveauOrder || 1} • Session Académique ${classe.academicYearLabel || "2026-2027"}`,
    valueX, curY
  );

  // Ligne 6 : Diplôme d'entrée
  curY += lineSpacing;
  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Diplôme d'entrée :", labelX, curY);
  doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(student.entryDiploma || "CEP / Entrée directe", valueX, curY);

  // 5. Attestation formelle d'assiduité
  const textY = boxY + boxH + 20;
  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica").text(
    "Est régulièrement inscrit(e) et poursuit avec assiduité son cycle de formation professionnelle au sein de notre établissement pour le compte de la session académique en cours.",
    startX, textY, { width: fullWidth, lineGap: 3.5, align: "justify" }
  );

  doc.text(
    "En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.",
    startX, textY + 40, { width: fullWidth }
  );

  // 6. Bloc de Signatures & QR Code Compact
  const signatories = tmpl.signatories || [
    { title: "Le Promoteur", roleKey: "promoteur" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];
  renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, signatories, 680, fullWidth, startX);
}

async function generateAttestationPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 20, bottom: 20, left: 25, right: 25 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-ATTESTATION", {
        margin: 0,
        width: 80,
        errorCorrectionLevel: "M",
      });

      renderSingleAttestationPage(doc, snapshot, qrBuf);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function generateBatchAttestationsPdf(snapshotsList, qrPayloadsList, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 20, bottom: 20, left: 25, right: 25 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 } });
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-ATTESTATION", {
          margin: 0,
          width: 80,
          errorCorrectionLevel: "M",
        });
        renderSingleAttestationPage(doc, snapshotsList[i], qrBuf);
      }

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function generateFicheInscriptionPdf(snapshot, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 20, bottom: 20, left: 25, right: 25 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const photoBuf = bufferFromDataUrl(student.photoDataUrl);
      const primaryColor = tmpl.primaryColor || "#071A2E";

      const startX = 25;
      const fullWidth = 545;

      drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 290);
      drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 20, fullWidth, startX);

      const titleY = 120;
      doc.rect(startX, titleY, fullWidth, 22).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica-Bold").text(
        tmpl.documentTitle || "FICHE INDIVIDUELLE D'INSCRIPTION & D'ENGAGEMENT",
        startX, titleY + 6, { width: fullWidth, align: "center" }
      );

      doc.rect(startX, 150, fullWidth, 115).fillAndStroke("#F8FAFC", "#CBD5E1");

      const photoW = 65;
      const photoH = 65;
      drawStudentAvatar(doc, photoBuf, startX + fullWidth - photoW - 16, 175, photoW, photoH);

      let ly = 158;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Matricule Officiel :", startX + 10, ly);
      doc.fillColor(primaryColor).fontSize(8.5).font("Courier-Bold").text(student.matricule || "—", startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Nom de famille :", startX + 10, ly);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text((student.lastName || "").toUpperCase(), startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Prénom(s) :", startX + 10, ly);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text(student.firstName || "", startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Genre / Naissance :", startX + 10, ly);
      const genreBirth = `${student.gender === "F" ? "Féminin" : "Masculin"} • Né(e) le ${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—"}${student.birthPlace ? ` à ${student.birthPlace}` : ""}`;
      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica").text(genreBirth, startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Contact Apprenant :", startX + 10, ly);
      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica").text(student.phone || "Non renseigné", startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Parent / Tuteur :", startX + 10, ly);
      const parentInfo = `${student.guardianName || "Non renseigné"}${student.guardianPhone ? ` (${student.guardianPhone})` : ""}`;
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold").text(parentInfo, startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Diplôme d'entrée :", startX + 10, ly);
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(student.entryDiploma || "Aucun / Entrée directe", startX + 130, ly);

      doc.rect(startX, 275, fullWidth, 55).fillAndStroke("#FFFFFF", "#CBD5E1");
      doc.rect(startX, 275, fullWidth, 16).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold").text("AFFECTATION PÉDAGOGIQUE & CYCLE CHOISI", startX + 10, 279.5);

      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Filière de formation :", startX + 10, 298);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text(`${classe.filiereName || "—"} (${classe.programTypeCode || "DQP"})`, startX + 130, 298);

      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Classe & Promotion :", startX + 10, 314);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text(`${classe.label || "—"} • ${classe.promotionLabel || ""}`, startX + 130, 314);

      doc.rect(startX, 340, fullWidth, 75).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold").text("ENGAGEMENT DE L'APPRENANT(E) :", startX + 10, 350);
      doc.fillColor("#334155").fontSize(7.5).font("Helvetica").text(
        tmpl.engagementText || "Je soussigné(e), certifie sur l'honneur l'exactitude des informations mentionnées ci-dessus et déclare avoir pris pleine connaissance du règlement intérieur de l'établissement. Je m'engage à faire preuve d'assiduité, de rigueur et de probité tout au long de mon cycle de formation.",
        startX + 10, 363, { width: fullWidth - 20, lineGap: 2.5 }
      );

      const signatories = tmpl.signatories || [
        { title: "Signature de l'Apprenant(e)", roleKey: "student" },
        { title: "Visa de la Direction", roleKey: "directeur" },
      ];
      renderSignatoriesAndQrCompact(doc, snapshot, null, signatories, 680, fullWidth, startX);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateAttestationPdf,
  generateBatchAttestationsPdf,
  generateFicheInscriptionPdf,
};