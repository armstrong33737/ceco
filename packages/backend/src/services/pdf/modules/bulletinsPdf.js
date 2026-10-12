// packages/backend/src/services/pdf/modules/bulletinsPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const { bufferFromDataUrl } = require("../common/pdfHelpers");
const { drawDynamicBilingualHeader } = require("../common/pdfHeaders");
const { drawWatermark, drawStudentAvatar } = require("../common/pdfGraphics");
const { drawRecapMatrix } = require("../common/pdfEvaluation");
const { renderSignatoriesAndQrCompact } = require("../common/pdfSignatories");

function renderSingleSemesterBulletinPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, period = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#071A2E";

  const startX = 25;
  const fullWidth = 545;

  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 280);
  drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 18, fullWidth, startX);

  const titleY = 108;
  doc.rect(startX, titleY, fullWidth, 20).fillAndStroke(primaryColor, primaryColor);
  doc.rect(startX, titleY, fullWidth, 1.5).fill("#D4AF37");
  doc.rect(startX, titleY + 18.5, fullWidth, 1.5).fill("#D4AF37");
  doc.fillColor("#FFFFFF").fontSize(8.5).font("Helvetica-Bold").text(
    `RELEVÉ DE NOTES DU ${period.label ? period.label.toUpperCase() : "SEMESTRE 1"} • SESSION ACADÉMIQUE ${classe.academicYearLabel || "2026-2027"}`,
    startX, titleY + 5.5, { width: fullWidth, align: "center" }
  );

  const infoY = 132;
  const infoH = 58;
  const photoW = 54;
  const textW = fullWidth;

  doc.rect(startX, infoY, textW, infoH).fillAndStroke("#F8FAFC", "#CBD5E1");

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("NOM & PRÉNOM :", startX + 8, infoY + 6);
  doc.rect(startX + 80, infoY + 3.5, 230, 13).fill("#E6F0FF");
  doc.fillColor(primaryColor).fontSize(8).font("Helvetica-Bold").text(
    `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`,
    startX + 84, infoY + 5.5, { width: 222, truncate: true }
  );

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("SEXE :", startX + 8, infoY + 20);
  doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica").text(student.gender === "F" ? "Féminin" : "Masculin", startX + 42, infoY + 20);

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("MATRICULE :", startX + 130, infoY + 20);
  doc.rect(startX + 185, infoY + 18, 125, 11).fill("#FFF275");
  doc.fillColor(primaryColor).fontSize(7.5).font("Courier-Bold").text(student.matricule || "—", startX + 188, infoY + 19.5);

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("NÉ(E) LE :", startX + 8, infoY + 33);
  const birthStr = `${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "Non renseignée"}${student.birthPlace ? ` à ${student.birthPlace}` : ""}`;
  doc.fillColor("#0F172A").fontSize(7).font("Helvetica").text(birthStr, startX + 48, infoY + 33, { width: 260, truncate: true });

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("FILIÈRE :", startX + 8, infoY + 45);
  doc.rect(startX + 48, infoY + 43, 262, 11).fill("#D4EDDA");
  doc.fillColor("#155724").fontSize(7).font("Helvetica-Bold").text(
    `${classe.filiereName || "—"} (Niveau ${classe.niveauOrder || 1} • ${classe.programTypeCode || "DQP"})`,
    startX + 52, infoY + 44.5, { width: 254, truncate: true }
  );

  drawStudentAvatar(doc, photoBuf, startX + textW - photoW - 10, infoY + 2, photoW, photoW);

  let y = 194;
  doc.rect(startX, y, fullWidth, 14).fill("#E8F5E9");
  doc.fillColor("#1B5E20").fontSize(6.5).font("Helvetica-Bold").text(
    `NOTES DES MODULES ENSEIGNÉS DURANT LE ${period.order === 2 ? "SECOND" : "PREMIER"} SEMESTRE`,
    startX, y + 3.5, { width: fullWidth, align: "center" }
  );

  y += 14;
  doc.rect(startX, y, fullWidth, 15).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(6).font("Helvetica-Bold");

  const colModW = 160;
  const colCcW = 38;
  const colExamW = 42;
  const colCoefW = 28;
  const colTotW = 44;
  const colAppW = 60;
  const colRangW = 26;
  const colValW = 28;
  const colProfW = fullWidth - (colModW + colCcW + colExamW + colCoefW + colTotW + colAppW + colRangW + colValW);

  doc.text("MODULES / DISCIPLINES", startX + 4, y + 4.5, { width: colModW });
  doc.text("CC /20", startX + colModW, y + 4.5, { width: colCcW, align: "center" });
  doc.text("EXAM /20", startX + colModW + colCcW, y + 4.5, { width: colExamW, align: "center" });
  doc.text("COEF", startX + colModW + colCcW + colExamW, y + 4.5, { width: colCoefW, align: "center" });
  doc.text("NOTE*COEF", startX + colModW + colCcW + colExamW + colCoefW, y + 4.5, { width: colTotW, align: "center" });
  doc.text("APPRÉCIATION", startX + colModW + colCcW + colExamW + colCoefW + colTotW, y + 4.5, { width: colAppW, align: "center" });
  doc.text("RANG", startX + colModW + colCcW + colExamW + colCoefW + colTotW + colAppW, y + 4.5, { width: colRangW, align: "center" });
  doc.text("VAL.", startX + colModW + colCcW + colExamW + colCoefW + colTotW + colAppW + colRangW, y + 4.5, { width: colValW, align: "center" });
  doc.text("ENSEIGNANT", startX + fullWidth - colProfW + 4, y + 4.5, { width: colProfW - 4 });

  y += 15;

  categories.forEach((cat) => {
    doc.rect(startX, y, fullWidth, 12).fill("#E2E8F0");
    doc.fillColor("#0F172A").fontSize(6).font("Helvetica-Bold").text(
      `${cat.name.toUpperCase()} (Total Coef : ${cat.totalCoeff} • Moyenne Groupe : ${cat.groupAverage !== null ? `${cat.groupAverage}/20` : "—"})`,
      startX + 4, y + 3
    );
    y += 12;

    cat.subjects.forEach((sub) => {
      doc.rect(startX, y, fullWidth, 13).strokeColor("#CBD5E1").stroke();
      doc.fillColor("#0F172A").fontSize(6).font("Helvetica");

      doc.text(`${sub.code ? `[${sub.code}] ` : ""}${sub.name}`, startX + 4, y + 3.5, { width: colModW - 4, truncate: true });
      doc.text(sub.ccAverage, startX + colModW, y + 3.5, { width: colCcW, align: "center" });
      doc.text(sub.examGrade, startX + colModW + colCcW, y + 3.5, { width: colExamW, align: "center" });
      doc.text(String(sub.coefficient), startX + colModW + colCcW + colExamW, y + 3.5, { width: colCoefW, align: "center" });
      doc.font("Helvetica-Bold").text(sub.points, startX + colModW + colCcW + colExamW + colCoefW, y + 3.5, { width: colTotW, align: "center" });

      const finalNum = parseFloat(sub.finalGrade);
      let appBg = "#F1F5F9";
      let appFg = "#475569";
      if (finalNum < 10) { appBg = "#FEEBEF"; appFg = "#C73B3B"; }
      else if (finalNum < 12) { appBg = "#FFF6DE"; appFg = "#B7791F"; }
      else if (finalNum < 14) { appBg = "#EAF3F9"; appFg = "#216D9E"; }
      else { appBg = "#E8F6F0"; appFg = "#16805A"; }

      const appBoxX = startX + colModW + colCcW + colExamW + colCoefW + colTotW + 3;
      doc.rect(appBoxX, y + 1.5, colAppW - 6, 10).fill(appBg);
      doc.fillColor(appFg).fontSize(5.5).font("Helvetica-Bold").text(sub.appreciation, appBoxX, y + 3, { width: colAppW - 6, align: "center" });

      doc.fillColor("#0F172A").fontSize(6).font("Helvetica").text(String(sub.rank || "—"), startX + colModW + colCcW + colExamW + colCoefW + colTotW + colAppW, y + 3.5, { width: colRangW, align: "center" });
      doc.font("Helvetica-Bold").fillColor(sub.isValid ? "#16805A" : "#C73B3B").text(sub.isValid ? "Oui" : "Non", startX + colModW + colCcW + colExamW + colCoefW + colTotW + colAppW + colRangW, y + 3.5, { width: colValW, align: "center" });
      doc.fillColor("#475569").fontSize(5.5).font("Helvetica").text(sub.formateurName || "—", startX + fullWidth - colProfW + 4, y + 3.5, { width: colProfW - 4, truncate: true });

      y += 13;
    });
  });

  doc.rect(startX, y, fullWidth, 14).fill("#F0F0F0");
  doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold");
  doc.text("TOTAL GÉNÉRAL", startX + 4, y + 3.5, { width: colModW + colCcW + colExamW });
  doc.text(String(totals.totalCoefficients), startX + colModW + colCcW + colExamW, y + 3.5, { width: colCoefW, align: "center" });

  doc.rect(startX + colModW + colCcW + colExamW + colCoefW, y + 1, colTotW, 12).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold").text(String(totals.totalPoints), startX + colModW + colCcW + colExamW + colCoefW, y + 3, { width: colTotW, align: "center" });

  drawRecapMatrix(doc, totals, startX, y + 15, fullWidth, 58);

  const signatories = tmpl.signatories || [
    { title: "Le Promoteur", roleKey: "promoteur" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];
  renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, signatories, 706, fullWidth, startX);
}

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

function renderSingleContinuousAssessmentBulletinPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, period = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#071A2E";

  const startX = 25;
  const fullWidth = 545;

  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 280);
  drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 18, fullWidth, startX);

  const titleY = 108;
  doc.rect(startX, titleY, fullWidth, 20).fillAndStroke(primaryColor, primaryColor);
  doc.rect(startX, titleY, fullWidth, 1.5).fill("#D4AF37");
  doc.rect(startX, titleY + 18.5, fullWidth, 1.5).fill("#D4AF37");
  doc.fillColor("#FFFFFF").fontSize(8.5).font("Helvetica-Bold").text(
    `BULLETIN D'ÉVALUATION CONTINUE (CC & TP) • ${period.label ? period.label.toUpperCase() : "SEMESTRE 1"} • ${classe.academicYearLabel || "2026-2027"}`,
    startX, titleY + 5.5, { width: fullWidth, align: "center" }
  );

  const infoY = 132;
  const infoH = 58;
  const photoW = 54;
  const textW = fullWidth;

  doc.rect(startX, infoY, textW, infoH).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("NOM & PRÉNOM :", startX + 8, infoY + 6);
  doc.rect(startX + 80, infoY + 3.5, 230, 13).fill("#E6F0FF");
  doc.fillColor(primaryColor).fontSize(8).font("Helvetica-Bold").text(
    `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`,
    startX + 84, infoY + 5.5, { width: 222, truncate: true }
  );

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("SEXE :", startX + 8, infoY + 20);
  doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica").text(student.gender === "F" ? "Féminin" : "Masculin", startX + 42, infoY + 20);

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("MATRICULE :", startX + 130, infoY + 20);
  doc.rect(startX + 185, infoY + 18, 125, 11).fill("#FFF275");
  doc.fillColor(primaryColor).fontSize(7.5).font("Courier-Bold").text(student.matricule || "—", startX + 188, infoY + 19.5);

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("FILIÈRE :", startX + 8, infoY + 45);
  doc.rect(startX + 48, infoY + 43, 262, 11).fill("#D4EDDA");
  doc.fillColor("#155724").fontSize(7).font("Helvetica-Bold").text(
    `${classe.filiereName || "—"} (Niveau ${classe.niveauOrder || 1} • ${classe.programTypeCode || "DQP"})`,
    startX + 52, infoY + 44.5, { width: 254, truncate: true }
  );

  drawStudentAvatar(doc, photoBuf, startX + textW - photoW - 10, infoY + 2, photoW, photoW);

  let y = 194;
  doc.rect(startX, y, fullWidth, 15).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(6.5).font("Helvetica-Bold");

  const colModW2 = 200;
  const colCoefW2 = 35;
  const colCcW2 = 55;
  const colTotW2 = 55;
  const colAppW2 = 70;
  const colProfW2 = fullWidth - (colModW2 + colCoefW2 + colCcW2 + colTotW2 + colAppW2);

  doc.text("MODULES / DISCIPLINES", startX + 4, y + 4.5, { width: colModW2 });
  doc.text("COEF", startX + colModW2, y + 4.5, { width: colCoefW2, align: "center" });
  doc.text("MOY. CC /20", startX + colModW2 + colCoefW2, y + 4.5, { width: colCcW2, align: "center" });
  doc.text("CC*COEF", startX + colModW2 + colCoefW2 + colCcW2, y + 4.5, { width: colTotW2, align: "center" });
  doc.text("APPRÉCIATION", startX + colModW2 + colCoefW2 + colCcW2 + colTotW2, y + 4.5, { width: colAppW2, align: "center" });
  doc.text("ENSEIGNANT", startX + fullWidth - colProfW2 + 4, y + 4.5, { width: colProfW2 - 4 });

  y += 15;

  categories.forEach((cat) => {
    doc.rect(startX, y, fullWidth, 12).fill("#E2E8F0");
    doc.fillColor("#0F172A").fontSize(6).font("Helvetica-Bold").text(
      `${cat.name.toUpperCase()} (Total Coef : ${cat.totalCoeff})`,
      startX + 4, y + 3
    );
    y += 12;

    cat.subjects.forEach((sub) => {
      doc.rect(startX, y, fullWidth, 13).strokeColor("#CBD5E1").stroke();
      doc.fillColor("#0F172A").fontSize(6).font("Helvetica");
      doc.text(`${sub.code ? `[${sub.code}] ` : ""}${sub.name}`, startX + 4, y + 3.5, { width: colModW2 - 4, truncate: true });
      doc.text(String(sub.coefficient), startX + colModW2, y + 3.5, { width: colCoefW2, align: "center" });
      doc.font("Helvetica-Bold").text(sub.ccAverage, startX + colModW2 + colCoefW2, y + 3.5, { width: colCcW2, align: "center" });

      const ccNum = parseFloat(sub.ccAverage);
      const ccPoints = !isNaN(ccNum) ? (ccNum * sub.coefficient).toFixed(2) : "—";
      doc.text(ccPoints, startX + colModW2 + colCoefW2 + colCcW2, y + 3.5, { width: colTotW2, align: "center" });

      doc.font("Helvetica").text(sub.appreciation, startX + colModW2 + colCoefW2 + colCcW2 + colTotW2, y + 3.5, { width: colAppW2, align: "center" });
      doc.text(sub.formateurName || "—", startX + fullWidth - colProfW2 + 4, y + 3.5, { width: colProfW2 - 4, truncate: true });
      y += 13;
    });
  });

  doc.rect(startX, y, fullWidth, 14).fill("#F0F0F0");
  doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold");
  doc.text("TOTAL GÉNÉRAL", startX + 4, y + 3.5, { width: colModW2 + colCcW2 });
  doc.text(String(totals.totalCoefficients), startX + colModW2 + colCcW2, y + 3.5, { width: colCoefW2, align: "center" });

  doc.rect(startX + colModW2 + colCcW2 + colCoefW2, y + 1, colTotW2, 12).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold").text(String(totals.totalPoints), startX + colModW2 + colCcW2 + colCoefW2, y + 3, { width: colTotW2, align: "center" });

  drawRecapMatrix(doc, totals, startX, y + 15, fullWidth, 58);

  const signatories = tmpl.signatories || [
    { title: "Le Promoteur", roleKey: "promoteur" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];
  renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, signatories, 706, fullWidth, startX);
}

async function generateContinuousAssessmentBulletinPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
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
      const doc = new PDFDocument({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 } });
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