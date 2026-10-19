// packages/backend/src/services/pdf/modules/transcriptsPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const { bufferFromDataUrl, safeDrawImage, resolveDocumentTextureBuffer } = require("../common/pdfHelpers");
const { drawDynamicBilingualHeader } = require("../common/pdfHeaders");
const { drawStudentAvatar } = require("../common/pdfGraphics");
const { renderSignatoriesAndQrCompact } = require("../common/pdfSignatories");

/**
 * Convertit une note sur 20 en Grade alphabétique universitaire standard
 */
function getLetterGrade(score) {
  if (score === null || score === undefined || isNaN(score)) return "—";
  const s = parseFloat(score);
  if (s >= 16.0) return "A";
  if (s >= 14.0) return "B";
  if (s >= 12.0) return "C";
  if (s >= 10.0) return "D";
  return "F";
}

/**
 * DOCUMENT 06 : RELEVÉ DE NOTES ANNUEL OFFICIEL (TRANSCRIPT UNIVERSITAIRE SANS RANG NI STATS CLASSE)
 */
function renderSingleAnnualTranscriptPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#071A2E";

  const startX = 28;
  const fullWidth = 539.28;

  // 1. Texture de Fond (Cherche prioritairement recap_bg.* puis card_bg.*)
  const bgBuf =
    bufferFromDataUrl(center.transcriptBgDataUrl) ||
    bufferFromDataUrl(center.cardBgDataUrl) ||
    resolveDocumentTextureBuffer(center.id, "transcript", tmpl);

  if (bgBuf) {
    doc.save();
    // Opacité par défaut à 22% pour garantir une visibilité nette du motif
    const textureOpacity = tmpl.bgTextureOpacity !== undefined ? Number(tmpl.bgTextureOpacity) : 0.22;
    doc.opacity(textureOpacity);
    safeDrawImage(doc, bgBuf, 0, 0, { width: 595.28, height: 841.89 });
    doc.restore();
  }

  // Filigrane Logo centré si activé
  if (tmpl.showWatermark !== false && logoBuf) {
    doc.save();
    doc.opacity(Number(tmpl.watermarkOpacity) || 0.04);
    safeDrawImage(doc, logoBuf, 145, 270, { width: 250, fit: [250, 250] });
    doc.restore();
  }

  // 2. En-tête Bilingue Officiel National
  const endHeaderY = drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 22, fullWidth, startX);

  // 3. Titre Officiel Solennel (Transcript Académique Supérieur)
  const titleY = endHeaderY + 8;
  doc.rect(startX, titleY, fullWidth, 23).fillAndStroke(primaryColor, primaryColor);
  doc.rect(startX, titleY, fullWidth, 1.5).fill("#D4AF37");
  doc.rect(startX, titleY + 21.5, fullWidth, 1.5).fill("#D4AF37");

  doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica-Bold").text(
    (tmpl.documentTitle || "RELEVÉ DE NOTES ANNUEL OFFICIEL / OFFICIAL ACADEMIC TRANSCRIPT").toUpperCase(),
    startX, titleY + 6.5, { width: fullWidth, align: "center", characterSpacing: 0.6 }
  );

  // 4. Cartouche d'Identification Spacieux de l'Étudiant (Translucide pour révéler la texture)
  const infoY = titleY + 29;
  const infoH = 62;
  const photoSize = 58;
  const photoX = startX + fullWidth - photoSize - 8;

  // Contour sans fond opaque étouffant
  doc.rect(startX, infoY, fullWidth, infoH).lineWidth(0.8).strokeColor("#CBD5E1").stroke();
  drawStudentAvatar(doc, photoBuf, photoX, infoY + 2, photoSize, photoSize);

  const textStartX = startX + 12;
  const textW = fullWidth - photoSize - 32;

  // Ligne 1 : Nom et Prénom
  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("NOM & PRÉNOM(S) :", textStartX, infoY + 7);
  doc.fillColor(primaryColor).fontSize(9.5).font("Helvetica-Bold").text(
    `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`,
    textStartX + 95, infoY + 5.5, { width: textW - 105, truncate: true }
  );

  // Ligne 2 : Matricule & Date de naissance
  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("MATRICULE ÉTUDIANT :", textStartX, infoY + 21);
  doc.fillColor(primaryColor).fontSize(8.5).font("Courier-Bold").text(student.matricule || "—", textStartX + 95, infoY + 20.5);

  const birthStr = `${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—"}${student.birthPlace ? ` à ${student.birthPlace.toUpperCase()}` : ""}`;
  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("NÉ(E) LE :", textStartX + 220, infoY + 21);
  doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(birthStr, textStartX + 265, infoY + 21, { width: 145, truncate: true });

  // Ligne 3 : Filière, Cycle & Session
  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("DOMAINE / SPÉCIALITÉ :", textStartX, infoY + 35);
  doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text(
    `${classe.filiereName || "—"} [${classe.programTypeCode || "DQP"} • Niveau ${classe.niveauOrder || 1}]`,
    textStartX + 95, infoY + 34.5, { width: textW - 105, truncate: true }
  );

  doc.fillColor("#64748B").fontSize(7.2).font("Helvetica").text(
    `Session Académique : ${classe.academicYearLabel || "2026-2027"}  •  Promotion : ${classe.promotionLabel || "Cohorte certifiée"}`,
    textStartX + 95, infoY + 47
  );

  // 5. Tableau Académique des Unités d'Enseignement (Translucide)
  let tableY = infoY + infoH + 9;
  doc.rect(startX, tableY, fullWidth, 18).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold");

  const colCodeW = 55;
  const colDisciplineW = 215;
  const colCoefW = 50;
  const colNoteW = 60;
  const colPointsW = 60;
  const colGradeW = 40;
  const colStatutW = fullWidth - (colCodeW + colDisciplineW + colCoefW + colNoteW + colPointsW + colGradeW);

  doc.text("CODE UE", startX + 6, tableY + 5.5, { width: colCodeW - 8 });
  doc.text("UNITÉS D'ENSEIGNEMENT & MODULES ANNUELS", startX + colCodeW, tableY + 5.5, { width: colDisciplineW - 6 });
  doc.text("CRÉDITS", startX + colCodeW + colDisciplineW, tableY + 5.5, { width: colCoefW, align: "center" });
  doc.text("NOTE / 20", startX + colCodeW + colDisciplineW + colCoefW, tableY + 5.5, { width: colNoteW, align: "center" });
  doc.text("POINTS (NxC)", startX + colCodeW + colDisciplineW + colCoefW + colNoteW, tableY + 5.5, { width: colPointsW, align: "center" });
  doc.text("GRADE", startX + colCodeW + colDisciplineW + colCoefW + colNoteW + colPointsW, tableY + 5.5, { width: colGradeW, align: "center" });
  doc.text("RÉSULTAT", startX + fullWidth - colStatutW, tableY + 5.5, { width: colStatutW - 4, align: "center" });

  tableY += 18;

  const totalSubjectCount = categories.reduce((sum, c) => sum + (c.subjects?.length || 0), 0);
  const rowHeight = totalSubjectCount <= 6 ? 20.5 : totalSubjectCount <= 9 ? 17.5 : 14.5;

  let validatedCreditsCount = 0;
  let totalCreditsCount = 0;

  categories.forEach((cat) => {
    // Bannière de Catégorie avec légère transparence
    doc.rect(startX, tableY, fullWidth, 13).fill("#E2E8F0");
    doc.fillColor("#0F172A").fontSize(6.8).font("Helvetica-Bold").text(
      `${cat.name.toUpperCase()} (Total Crédits : ${cat.totalCoeff})`,
      startX + 6, tableY + 3.5
    );
    tableY += 13;

    cat.subjects.forEach((sub) => {
      doc.rect(startX, tableY, fullWidth, rowHeight).lineWidth(0.4).strokeColor("#CBD5E1").stroke();

      const textY = tableY + (rowHeight - 8) / 2;

      // Code UE
      doc.fillColor(primaryColor).fontSize(7).font("Courier-Bold").text(
        sub.code || "UE",
        startX + 6, textY, { width: colCodeW - 8 }
      );

      // Intitulé
      doc.fillColor("#0F172A").fontSize(7).font("Helvetica-Bold").text(
        sub.name,
        startX + colCodeW, textY, { width: colDisciplineW - 8, truncate: true }
      );

      // Crédits / Coef
      doc.font("Helvetica").text(String(sub.coefficient), startX + colCodeW + colDisciplineW, textY, { width: colCoefW, align: "center" });

      // Note annuelle /20
      doc.font("Helvetica-Bold").text(sub.finalGrade, startX + colCodeW + colDisciplineW + colCoefW, textY, { width: colNoteW, align: "center" });

      // Points pondérés
      doc.font("Helvetica").text(sub.points, startX + colCodeW + colDisciplineW + colCoefW + colNoteW, textY, { width: colPointsW, align: "center" });

      // Grade alphabétique
      const letterGrade = getLetterGrade(sub.finalGrade);
      doc.font("Helvetica-Bold").text(letterGrade, startX + colCodeW + colDisciplineW + colCoefW + colNoteW + colPointsW, textY, { width: colGradeW, align: "center" });

      // Résultat : Validé / Ajourné
      totalCreditsCount += sub.coefficient;
      if (sub.isValid) {
        validatedCreditsCount += sub.coefficient;
        doc.fillColor("#16805A").font("Helvetica-Bold").text(
          "VALIDÉ",
          startX + fullWidth - colStatutW, textY, { width: colStatutW - 4, align: "center" }
        );
      } else {
        doc.fillColor("#C73B3B").font("Helvetica-Bold").text(
          "AJOURNÉ",
          startX + fullWidth - colStatutW, textY, { width: colStatutW - 4, align: "center" }
        );
      }

      tableY += rowHeight;
    });
  });

  // 6. Ligne Récapitulative des Crédits et Points
  doc.rect(startX, tableY, fullWidth, 17).fill("#F1F5F9").stroke("#CBD5E1");
  doc.fillColor("#0F172A").fontSize(7.8).font("Helvetica-Bold");
  doc.text("TOTAL DES UNITÉS D'ENSEIGNEMENT", startX + 6, tableY + 5, { width: colCodeW + colDisciplineW });
  doc.text(String(totals.totalCoefficients), startX + colCodeW + colDisciplineW, tableY + 5, { width: colCoefW, align: "center" });

  doc.rect(startX + colCodeW + colDisciplineW + colCoefW + colNoteW, tableY + 1.5, colPointsW, 14).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(8.5).font("Helvetica-Bold").text(
    String(totals.totalPoints),
    startX + colCodeW + colDisciplineW + colCoefW + colNoteW, tableY + 4,
    { width: colPointsW, align: "center" }
  );

  // 7. Cartouche Universitaire de Synthèse Individuelle (Translucide)
  tableY += 24;
  const recapBoxH = 68;
  const colHalfW = (fullWidth - 10) / 2;

  // Boîte Gauche
  doc.rect(startX, tableY, colHalfW, recapBoxH).lineWidth(0.8).strokeColor("#CBD5E1").stroke();
  doc.rect(startX, tableY, colHalfW, 16).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold").text(
    "BILAN ACADÉMIQUE DE L'ÉTUDIANT(E)",
    startX + 8, tableY + 4.5
  );

  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("Crédits Validés :", startX + 8, tableY + 23);
  doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold").text(
    `${validatedCreditsCount} / ${totalCreditsCount} crédits`,
    startX + 115, tableY + 23
  );

  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("Moyenne Générale :", startX + 8, tableY + 37);
  doc.rect(startX + 115, tableY + 34, 60, 15).fill("#FFF275");
  doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text(
    totals.overallAverage !== null ? `${totals.overallAverage} / 20` : "—",
    startX + 115, tableY + 37, { width: 60, align: "center" }
  );

  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("Mention Obtenue :", startX + 8, tableY + 53);
  doc.fillColor("#16805A").fontSize(8.5).font("Helvetica-Bold").text(
    (totals.mention || "PASSABLE").toUpperCase(),
    startX + 115, tableY + 53
  );

  // Boîte Droite
  const boxRightX = startX + colHalfW + 10;
  doc.rect(boxRightX, tableY, colHalfW, recapBoxH).lineWidth(0.8).strokeColor("#CBD5E1").stroke();
  doc.rect(boxRightX, tableY, colHalfW, 16).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold").text(
    "DÉCISION DU JURY DE FIN D'ANNÉE",
    boxRightX + 8, tableY + 4.5
  );

  const isPassed = totals.decision === "admis" || totals.decision === "diplome" || totals.decision === "valide" || (totals.overallAverage >= 10.0 && !totals.hasEliminatory);
  const decisionText = totals.decision === "diplome"
    ? "DIPLÔMÉ(E) AVEC SUCCÈS"
    : isPassed
    ? "ADMIS(E) EN NIVEAU SUPÉRIEUR"
    : "AJOURNÉ(E) / REDOUBLE";

  const decBadgeColor = isPassed ? "#E8F6F0" : "#FEEBEF";
  const decTextColor = isPassed ? "#16805A" : "#C73B3B";

  doc.rect(boxRightX + 8, tableY + 22, colHalfW - 16, 17).roundedRect(boxRightX + 8, tableY + 22, colHalfW - 16, 17, 2).fill(decBadgeColor);
  doc.fillColor(decTextColor).fontSize(8.5).font("Helvetica-Bold").text(
    decisionText,
    boxRightX + 8, tableY + 26, { width: colHalfW - 16, align: "center" }
  );

  doc.fillColor("#64748B").fontSize(6.5).font("Helvetica-Oblique").text(
    "Le présent relevé de notes annuel officiel est délivré pour servir et valoir ce que de droit sous réserve de l'obtention du diplôme définitif.",
    boxRightX + 8, tableY + 44, { width: colHalfW - 16, lineGap: 1.5, align: "justify" }
  );

  // 8. Signatures Officielles & QR Code Compact
  const signatories = tmpl.signatories && tmpl.signatories.length > 0 ? tmpl.signatories : [
    { title: "Le Directeur des Études", roleKey: "directeur" },
    { title: center.directorTitle || "Le Directeur Général", roleKey: "directeur" },
  ];

  renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, signatories, 706, fullWidth, startX);
}

async function generateAnnualTranscriptPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 20, bottom: 20, left: 28, right: 28 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-TRANSCRIPT", {
        margin: 0,
        width: 80,
        errorCorrectionLevel: "M",
      });

      renderSingleAnnualTranscriptPage(doc, snapshot, qrBuf);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function generateBatchAnnualTranscriptsPdf(snapshotsList, qrPayloadsList, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 20, bottom: 20, left: 28, right: 28 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 20, bottom: 20, left: 28, right: 28 } });
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-TRANSCRIPT", {
          margin: 0,
          width: 80,
          errorCorrectionLevel: "M",
        });
        renderSingleAnnualTranscriptPage(doc, snapshotsList[i], qrBuf);
      }

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateAnnualTranscriptPdf,
  generateBatchAnnualTranscriptsPdf,
};