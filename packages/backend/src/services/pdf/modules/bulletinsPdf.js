// packages/backend/src/services/pdf/modules/bulletinsPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const { bufferFromDataUrl, safeDrawImage } = require("../common/pdfHelpers");
const { drawDynamicBilingualHeader } = require("../common/pdfHeaders");
const { drawStudentAvatar } = require("../common/pdfGraphics");
const { drawRecapMatrix } = require("../common/pdfEvaluation");
const { renderSignatoriesAndQrCompact } = require("../common/pdfSignatories");

/**
 * 1. RENDU DU BULLETIN SEMESTRIEL BILINGUE (S1 / S2)
 */
function renderSingleSemesterBulletinPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, period = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#071A2E";

  const startX = 28;
  const fullWidth = 539.28;

  // Filigrane translucide du Logo
  if (tmpl.showWatermark !== false && logoBuf) {
    doc.save();
    doc.opacity(Number(tmpl.watermarkOpacity) || 0.05);
    safeDrawImage(doc, logoBuf, 145, 270, { width: 250, fit: [250, 250] });
    doc.restore();
  }

  // En-tête Bilingue Officiel Allongé
  const endHeaderY = drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 20, fullWidth, startX);

  // Bandeau Titre
  const titleY = endHeaderY + 8;
  const periodLabel = period?.label ? period.label.toUpperCase() : "SEMESTRE 1";
  doc.rect(startX, titleY, fullWidth, 22).fillAndStroke(primaryColor, primaryColor);
  doc.rect(startX, titleY, fullWidth, 1.5).fill("#D4AF37");
  doc.rect(startX, titleY + 20.5, fullWidth, 1.5).fill("#D4AF37");

  doc.fillColor("#FFFFFF").fontSize(9.5).font("Helvetica-Bold").text(
    `BULLETIN SEMESTRIEL DE NOTES / SEMESTER REPORT CARD • ${periodLabel}`,
    startX, titleY + 6, { width: fullWidth, align: "center", characterSpacing: 0.5 }
  );

  // Cartouche de l'apprenant
  const infoY = titleY + 28;
  const infoH = 60;
  const photoSize = 56;
  const photoX = startX + fullWidth - photoSize - 8;

  doc.rect(startX, infoY, fullWidth, infoH).fillAndStroke("#F8FAFC", "#CBD5E1");
  drawStudentAvatar(doc, photoBuf, photoX, infoY + 2, photoSize, photoSize);

  const textStartX = startX + 12;
  const textW = fullWidth - photoSize - 32;

  doc.fillColor("#475569").fontSize(7.8).font("Helvetica-Bold").text("NOM & PRÉNOM :", textStartX, infoY + 7);
  doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text(
    `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`,
    textStartX + 88, infoY + 6, { width: textW - 98, truncate: true }
  );

  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("MATRICULE :", textStartX, infoY + 21);
  doc.fillColor(primaryColor).fontSize(8.5).font("Courier-Bold").text(student.matricule || "—", textStartX + 88, infoY + 20.5);

  const birthStr = `${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—"}${student.birthPlace ? ` à ${student.birthPlace.toUpperCase()}` : ""}`;
  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("NÉ(E) LE :", textStartX + 210, infoY + 21);
  doc.fillColor("#0F172A").fontSize(7.8).font("Helvetica").text(birthStr, textStartX + 255, infoY + 21, { width: 145, truncate: true });

  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("SPÉCIALITÉ :", textStartX, infoY + 34);
  doc.fillColor("#0F172A").fontSize(8.2).font("Helvetica-Bold").text(
    `${classe.filiereName || "—"} [${classe.programTypeCode || "DQP"} • Niveau ${classe.niveauOrder || 1}]`,
    textStartX + 88, infoY + 33.5, { width: textW - 98, truncate: true }
  );

  doc.fillColor("#64748B").fontSize(7.2).font("Helvetica").text(
    `Classe : ${classe.label || "—"}  •  Session : ${classe.academicYearLabel || "2026-2027"} • Cohorte : ${classe.promotionLabel || "Active"}`,
    textStartX + 88, infoY + 46
  );

  // Tableau des Notes Semestrielles
  let tableY = infoY + infoH + 8;
  doc.rect(startX, tableY, fullWidth, 17).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(6.5).font("Helvetica-Bold");

  const colDisciplineW = 145;
  const colCoefW = 26;
  const colCcW = 32;
  const colExamW = 36;
  const colNoteW = 36;
  const colPointsW = 40;
  const colRangW = 26;
  const colValW = 24;
  const colApprecW = 68;
  const colProfW = fullWidth - (colDisciplineW + colCoefW + colCcW + colExamW + colNoteW + colPointsW + colRangW + colValW + colApprecW);

  doc.text("MODULES / DISCIPLINES", startX + 5, tableY + 5.5, { width: colDisciplineW });
  doc.text("COEF", startX + colDisciplineW, tableY + 5.5, { width: colCoefW, align: "center" });
  doc.text("CC /20", startX + colDisciplineW + colCoefW, tableY + 5.5, { width: colCcW, align: "center" });
  doc.text("EXAM", startX + colDisciplineW + colCoefW + colCcW, tableY + 5.5, { width: colExamW, align: "center" });
  doc.text("NOTE /20", startX + colDisciplineW + colCoefW + colCcW + colExamW, tableY + 5.5, { width: colNoteW, align: "center" });
  doc.text("N × C", startX + colDisciplineW + colCoefW + colCcW + colExamW + colNoteW, tableY + 5.5, { width: colPointsW, align: "center" });
  doc.text("RANG", startX + colDisciplineW + colCoefW + colCcW + colExamW + colNoteW + colPointsW, tableY + 5.5, { width: colRangW, align: "center" });
  doc.text("VAL.", startX + colDisciplineW + colCoefW + colCcW + colExamW + colNoteW + colPointsW + colRangW, tableY + 5.5, { width: colValW, align: "center" });
  doc.text("APPRÉCIATION", startX + colDisciplineW + colCoefW + colCcW + colExamW + colNoteW + colPointsW + colRangW + colValW, tableY + 5.5, { width: colApprecW, align: "center" });
  doc.text("ENSEIGNANT", startX + fullWidth - colProfW + 4, tableY + 5.5, { width: colProfW - 6 });

  tableY += 17;

  const totalSubjectCount = categories.reduce((sum, c) => sum + (c.subjects?.length || 0), 0);
  const rowHeight = totalSubjectCount <= 6 ? 18.5 : totalSubjectCount <= 9 ? 16 : 13.5;

  categories.forEach((cat) => {
    doc.rect(startX, tableY, fullWidth, 13).fill("#E2E8F0");
    doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(
      `${cat.name.toUpperCase()} (Total Coef : ${cat.totalCoeff} • Moyenne Groupe : ${cat.groupAverage !== null ? `${cat.groupAverage}/20` : "—"})`,
      startX + 6, tableY + 3.5
    );
    tableY += 13;

    cat.subjects.forEach((sub, sIdx) => {
      const isEven = sIdx % 2 === 0;
      doc.rect(startX, tableY, fullWidth, rowHeight).fillAndStroke(isEven ? "#FFFFFF" : "#F8FAFC", "#CBD5E1");

      const textBaselineY = tableY + (rowHeight - 8) / 2;

      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica");
      doc.text(`${sub.code ? `[${sub.code}] ` : ""}${sub.name}`, startX + 5, textBaselineY, { width: colDisciplineW - 7, truncate: true });

      doc.text(String(sub.coefficient), startX + colDisciplineW, textBaselineY, { width: colCoefW, align: "center" });
      doc.text(sub.ccAverage || "—", startX + colDisciplineW + colCoefW, textBaselineY, { width: colCcW, align: "center" });
      doc.text(sub.examGrade || "—", startX + colDisciplineW + colCoefW + colCcW, textBaselineY, { width: colExamW, align: "center" });

      doc.font("Helvetica-Bold").text(sub.finalGrade, startX + colDisciplineW + colCoefW + colCcW + colExamW, textBaselineY, { width: colNoteW, align: "center" });
      doc.text(sub.points, startX + colDisciplineW + colCoefW + colCcW + colExamW + colNoteW, textBaselineY, { width: colPointsW, align: "center" });

      doc.font("Helvetica").text(String(sub.rank || "—"), startX + colDisciplineW + colCoefW + colCcW + colExamW + colNoteW + colPointsW, textBaselineY, { width: colRangW, align: "center" });

      doc.font("Helvetica-Bold").fillColor(sub.isValid ? "#16805A" : "#C73B3B").text(
        sub.isValid ? "Oui" : "Non",
        startX + colDisciplineW + colCoefW + colCcW + colExamW + colNoteW + colPointsW + colRangW,
        textBaselineY,
        { width: colValW, align: "center" }
      );

      const finalNum = parseFloat(sub.finalGrade);
      let appBg = "#F1F5F9";
      let appFg = "#475569";
      if (finalNum < 10) { appBg = "#FEEBEF"; appFg = "#C73B3B"; }
      else if (finalNum < 12) { appBg = "#FFF6DE"; appFg = "#B7791F"; }
      else if (finalNum < 14) { appBg = "#EAF3F9"; appFg = "#216D9E"; }
      else { appBg = "#E8F6F0"; appFg = "#16805A"; }

      const appBoxX = startX + colDisciplineW + colCoefW + colCcW + colExamW + colNoteW + colPointsW + colRangW + colValW + 3;
      const appH = Math.min(12, rowHeight - 4);
      const appY = tableY + (rowHeight - appH) / 2;

      doc.rect(appBoxX, appY, colApprecW - 6, appH).roundedRect(appBoxX, appY, colApprecW - 6, appH, 2).fill(appBg);
      doc.fillColor(appFg).fontSize(5.6).font("Helvetica-Bold").text(
        sub.appreciation,
        appBoxX, appY + 2.5, { width: colApprecW - 6, align: "center" }
      );

      doc.fillColor("#475569").fontSize(6).font("Helvetica").text(
        sub.formateurName || "Non assigné",
        startX + fullWidth - colProfW + 4, textBaselineY, { width: colProfW - 6, truncate: true }
      );

      tableY += rowHeight;
    });
  });

  // Totaux
  doc.rect(startX, tableY, fullWidth, 16).fill("#F1F5F9").stroke("#CBD5E1");
  doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold");
  doc.text("TOTAL GÉNÉRAL DU SEMESTRE", startX + 6, tableY + 4.5, { width: colDisciplineW });
  doc.text(String(totals.totalCoefficients), startX + colDisciplineW, tableY + 4.5, { width: colCoefW, align: "center" });

  doc.rect(startX + colDisciplineW + colCoefW + colCcW + colExamW + colNoteW, tableY + 1.5, colPointsW, 13).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold").text(
    String(totals.totalPoints),
    startX + colDisciplineW + colCoefW + colCcW + colExamW + colNoteW, tableY + 4,
    { width: colPointsW, align: "center" }
  );

  // Matrice synoptique
  tableY += 22;
  const recapH = 64;
  drawRecapMatrix(doc, totals, startX, tableY, fullWidth, recapH);

  // Signatures
  const signatories = tmpl.signatories && tmpl.signatories.length > 0 ? tmpl.signatories : [
    { title: "Le Formateur Titulaire", roleKey: "formateur" },
    { title: center.directorTitle || "Le Directeur Général", roleKey: "directeur" },
  ];

  renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, signatories, 706, fullWidth, startX);
}

/**
 * 2. RENDU DU BULLETIN DE CONTRÔLE CONTINU (CC & TP)
 */
function renderSingleContinuousAssessmentBulletinPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, period = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#071A2E";

  const startX = 28;
  const fullWidth = 539.28;

  if (tmpl.showWatermark !== false && logoBuf) {
    doc.save();
    doc.opacity(Number(tmpl.watermarkOpacity) || 0.05);
    safeDrawImage(doc, logoBuf, 145, 270, { width: 250, fit: [250, 250] });
    doc.restore();
  }

  const endHeaderY = drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 20, fullWidth, startX);

  const titleY = endHeaderY + 8;
  const periodLabel = period?.label ? period.label.toUpperCase() : "CONTRÔLE CONTINU";
  doc.rect(startX, titleY, fullWidth, 22).fillAndStroke(primaryColor, primaryColor);
  doc.rect(startX, titleY, fullWidth, 1.5).fill("#D4AF37");
  doc.rect(startX, titleY + 20.5, fullWidth, 1.5).fill("#D4AF37");

  doc.fillColor("#FFFFFF").fontSize(9.5).font("Helvetica-Bold").text(
    `BULLETIN D'ÉVALUATION CONTINUE (CC & TRAVAUX PRATIQUES) • ${periodLabel}`,
    startX, titleY + 6, { width: fullWidth, align: "center", characterSpacing: 0.5 }
  );

  const infoY = titleY + 28;
  const infoH = 60;
  const photoSize = 56;
  const photoX = startX + fullWidth - photoSize - 8;

  doc.rect(startX, infoY, fullWidth, infoH).fillAndStroke("#F8FAFC", "#CBD5E1");

  drawStudentAvatar(doc, photoBuf, photoX, infoY + 2, photoSize, photoSize);

  const textStartX = startX + 12;
  const textW = fullWidth - photoSize - 32;

  doc.fillColor("#475569").fontSize(7.8).font("Helvetica-Bold").text("NOM & PRÉNOM :", textStartX, infoY + 7);
  doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text(
    `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`,
    textStartX + 88, infoY + 6, { width: textW - 98, truncate: true }
  );

  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("MATRICULE :", textStartX, infoY + 21);
  doc.fillColor(primaryColor).fontSize(8.5).font("Courier-Bold").text(student.matricule || "—", textStartX + 88, infoY + 20.5);

  const birthStr = `${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—"}${student.birthPlace ? ` à ${student.birthPlace.toUpperCase()}` : ""}`;
  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("NÉ(E) LE :", textStartX + 210, infoY + 21);
  doc.fillColor("#0F172A").fontSize(7.8).font("Helvetica").text(birthStr, textStartX + 255, infoY + 21, { width: 145, truncate: true });

  doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text("SPÉCIALITÉ :", textStartX, infoY + 34);
  doc.fillColor("#0F172A").fontSize(8.2).font("Helvetica-Bold").text(
    `${classe.filiereName || "—"} [${classe.programTypeCode || "DQP"} • Niveau ${classe.niveauOrder || 1}]`,
    textStartX + 88, infoY + 33.5, { width: textW - 98, truncate: true }
  );

  doc.fillColor("#64748B").fontSize(7.2).font("Helvetica").text(
    `Classe : ${classe.label || "—"}  •  Session : ${classe.academicYearLabel || "2026-2027"} • Cohorte : ${classe.promotionLabel || "Active"}`,
    textStartX + 88, infoY + 46
  );

  let tableY = infoY + infoH + 8;
  doc.rect(startX, tableY, fullWidth, 17).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(6.8).font("Helvetica-Bold");

  const colDisciplineW = 165;
  const colCoefW = 30;
  const colNoteCcW = 55;
  const colPointsW = 55;
  const colRangW = 30;
  const colApprecW = 75;
  const colProfW = fullWidth - (colDisciplineW + colCoefW + colNoteCcW + colPointsW + colRangW + colApprecW);

  doc.text("MODULES / DISCIPLINES", startX + 6, tableY + 5.5, { width: colDisciplineW });
  doc.text("COEF", startX + colDisciplineW, tableY + 5.5, { width: colCoefW, align: "center" });
  doc.text("NOTE CC /20", startX + colDisciplineW + colCoefW, tableY + 5.5, { width: colNoteCcW, align: "center" });
  doc.text("NOTE × COEF", startX + colDisciplineW + colCoefW + colNoteCcW, tableY + 5.5, { width: colPointsW, align: "center" });
  doc.text("RANG", startX + colDisciplineW + colCoefW + colNoteCcW + colPointsW, tableY + 5.5, { width: colRangW, align: "center" });
  doc.text("APPRÉCIATION", startX + colDisciplineW + colCoefW + colNoteCcW + colPointsW + colRangW, tableY + 5.5, { width: colApprecW, align: "center" });
  doc.text("ENSEIGNANT / FORMATEUR", startX + fullWidth - colProfW + 4, tableY + 5.5, { width: colProfW - 6 });

  tableY += 17;

  const totalSubjectCount = categories.reduce((sum, c) => sum + (c.subjects?.length || 0), 0);
  const rowHeight = totalSubjectCount <= 6 ? 19.5 : totalSubjectCount <= 9 ? 16.5 : 14;

  categories.forEach((cat) => {
    doc.rect(startX, tableY, fullWidth, 13).fill("#E2E8F0");
    doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(
      `${cat.name.toUpperCase()} (Total Coef : ${cat.totalCoeff} • Moyenne CC Groupe : ${cat.groupAverage !== null ? `${cat.groupAverage} / 20` : "—"})`,
      startX + 6, tableY + 3.5
    );
    tableY += 13;

    cat.subjects.forEach((sub, sIdx) => {
      const isEven = sIdx % 2 === 0;
      doc.rect(startX, tableY, fullWidth, rowHeight).fillAndStroke(isEven ? "#FFFFFF" : "#F8FAFC", "#CBD5E1");

      const textBaselineY = tableY + (rowHeight - 8) / 2;

      doc.fillColor("#0F172A").fontSize(6.8).font("Helvetica");
      doc.text(`${sub.code ? `[${sub.code}] ` : ""}${sub.name}`, startX + 6, textBaselineY, { width: colDisciplineW - 8, truncate: true });

      doc.text(String(sub.coefficient), startX + colDisciplineW, textBaselineY, { width: colCoefW, align: "center" });
      doc.font("Helvetica-Bold").text(sub.ccAverage, startX + colDisciplineW + colCoefW, textBaselineY, { width: colNoteCcW, align: "center" });
      doc.text(sub.points, startX + colDisciplineW + colCoefW + colNoteCcW, textBaselineY, { width: colPointsW, align: "center" });

      doc.font("Helvetica").text(String(sub.rank || "—"), startX + colDisciplineW + colCoefW + colNoteCcW + colPointsW, textBaselineY, { width: colRangW, align: "center" });

      const numScore = parseFloat(sub.ccAverage);
      let appBg = "#F1F5F9";
      let appFg = "#475569";
      if (numScore < 10) { appBg = "#FEEBEF"; appFg = "#C73B3B"; }
      else if (numScore < 12) { appBg = "#FFF6DE"; appFg = "#B7791F"; }
      else if (numScore < 14) { appBg = "#EAF3F9"; appFg = "#216D9E"; }
      else { appBg = "#E8F6F0"; appFg = "#16805A"; }

      const appBoxX = startX + colDisciplineW + colCoefW + colNoteCcW + colPointsW + colRangW + 4;
      const appH = Math.min(12, rowHeight - 4);
      const appY = tableY + (rowHeight - appH) / 2;

      doc.rect(appBoxX, appY, colApprecW - 8, appH).roundedRect(appBoxX, appY, colApprecW - 8, appH, 2).fill(appBg);
      doc.fillColor(appFg).fontSize(5.8).font("Helvetica-Bold").text(
        sub.appreciation,
        appBoxX, appY + 2.5, { width: colApprecW - 8, align: "center" }
      );

      doc.fillColor("#475569").fontSize(6.2).font("Helvetica").text(
        sub.formateurName || "Non assigné",
        startX + fullWidth - colProfW + 6, textBaselineY, { width: colProfW - 10, truncate: true }
      );

      tableY += rowHeight;
    });
  });

  doc.rect(startX, tableY, fullWidth, 16).fill("#F1F5F9").stroke("#CBD5E1");
  doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold");
  doc.text("TOTAL DU CONTRÔLE CONTINU", startX + 6, tableY + 4.5, { width: colDisciplineW });
  doc.text(String(totals.totalCoefficients), startX + colDisciplineW, tableY + 4.5, { width: colCoefW, align: "center" });

  doc.rect(startX + colDisciplineW + colCoefW + colNoteCcW, tableY + 1.5, colPointsW, 13).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold").text(
    String(totals.totalPoints),
    startX + colDisciplineW + colCoefW + colNoteCcW, tableY + 4,
    { width: colPointsW, align: "center" }
  );

  tableY += 22;
  const recapH = 64;
  drawRecapMatrix(doc, totals, startX, tableY, fullWidth, recapH);

  const signatories = tmpl.signatories && tmpl.signatories.length > 0 ? tmpl.signatories : [
    { title: "Le Formateur Titulaire", roleKey: "formateur" },
    { title: center.directorTitle || "Le Directeur Général", roleKey: "directeur" },
  ];

  renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, signatories, 706, fullWidth, startX);
}

/**
 * 3. GÉNÉRATEURS DE FLUX PDF EXPORTÉS (SEMESTRE & CC)
 */
async function generateSemesterBulletinPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-BULLETIN", {
        margin: 0,
        width: 80,
        errorCorrectionLevel: "M",
      });
      renderSingleSemesterBulletinPage(doc, snapshot, qrBuf);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function generateBatchSemesterBulletinsPdf(snapshotsList, qrPayloadsList, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 } });
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-BULLETIN", {
          margin: 0,
          width: 80,
          errorCorrectionLevel: "M",
        });
        renderSingleSemesterBulletinPage(doc, snapshotsList[i], qrBuf);
      }

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function generateContinuousAssessmentBulletinPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 20, bottom: 20, left: 28, right: 28 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-CC", {
        margin: 0,
        width: 80,
        errorCorrectionLevel: "M",
      });

      renderSingleContinuousAssessmentBulletinPage(doc, snapshot, qrBuf);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function generateBatchContinuousAssessmentBulletinsPdf(snapshotsList, qrPayloadsList, outputPath) {
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
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-CC", {
          margin: 0,
          width: 80,
          errorCorrectionLevel: "M",
        });
        renderSingleContinuousAssessmentBulletinPage(doc, snapshotsList[i], qrBuf);
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
  generateSemesterBulletinPdf,
  generateBatchSemesterBulletinsPdf,
  generateContinuousAssessmentBulletinPdf,
  generateBatchContinuousAssessmentBulletinsPdf,
};