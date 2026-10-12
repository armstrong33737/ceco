// packages/backend/src/services/pdf/modules/transcriptsPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const { bufferFromDataUrl } = require("../common/pdfHelpers");
const { drawDynamicBilingualHeader } = require("../common/pdfHeaders");
const { drawWatermark, drawStudentAvatar } = require("../common/pdfGraphics");
const { drawRecapMatrix } = require("../common/pdfEvaluation");
const { renderSignatoriesAndQrCompact } = require("../common/pdfSignatories");

function renderSingleAnnualTranscriptPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
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
    `RELEVÉ DE NOTES ANNUEL (TRANSCRIPT) • CUMUL S1 + S2 • SESSION ${classe.academicYearLabel || "2026-2027"}`,
    startX, titleY + 5.5, { width: fullWidth, align: "center" }
  );

  const infoY = 132;
  const infoH = 58;
  const photoW = 54;
  const textW = fullWidth - photoW - 6;

  doc.rect(startX, infoY, textW, infoH).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("NOM & PRÉNOM :", startX + 8, infoY + 6);
  doc.rect(startX + 80, infoY + 3.5, 230, 13).fill("#E6F0FF");
  doc.fillColor(primaryColor).fontSize(8).font("Helvetica-Bold").text(
    `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`,
    startX + 84, infoY + 5.5, { width: 222, truncate: true }
  );

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("MATRICULE :", startX + 8, infoY + 20);
  doc.rect(startX + 60, infoY + 18, 120, 11).fill("#FFF275");
  doc.fillColor(primaryColor).fontSize(7.5).font("Courier-Bold").text(student.matricule || "—", startX + 63, infoY + 19.5);

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("FILIÈRE :", startX + 8, infoY + 45);
  doc.rect(startX + 48, infoY + 43, 262, 11).fill("#D4EDDA");
  doc.fillColor("#155724").fontSize(7).font("Helvetica-Bold").text(
    `${classe.filiereName || "—"} (Niveau ${classe.niveauOrder || 1} • ${classe.programTypeCode || "DQP"})`,
    startX + 52, infoY + 44.5, { width: 254, truncate: true }
  );

  drawStudentAvatar(doc, photoBuf, startX + textW + 6, infoY, photoW, infoH);

  let y = 194;
  doc.rect(startX, y, fullWidth, 15).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(6.5).font("Helvetica-Bold");

  const colModW3 = 210;
  const colCoefW3 = 35;
  const colNoteW3 = 60;
  const colPtsW3 = 55;
  const colAppW3 = 85;
  const colValW3 = fullWidth - (colModW3 + colCoefW3 + colNoteW3 + colPtsW3 + colAppW3);

  doc.text("MODULES / DISCIPLINES DE L'ANNÉE", startX + 4, y + 4.5, { width: colModW3 });
  doc.text("COEF", startX + colModW3, y + 4.5, { width: colCoefW3, align: "center" });
  doc.text("NOTE ANNUELLE /20", startX + colModW3 + colCoefW3, y + 4.5, { width: colNoteW3, align: "center" });
  doc.text("POINTS ANNUELS", startX + colModW3 + colCoefW3 + colNoteW3, y + 4.5, { width: colPtsW3, align: "center" });
  doc.text("APPRÉCIATION", startX + colModW3 + colCoefW3 + colNoteW3 + colPtsW3, y + 4.5, { width: colAppW3, align: "center" });
  doc.text("VALIDÉ", startX + fullWidth - colValW3, y + 4.5, { width: colValW3, align: "center" });

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
      doc.text(`${sub.code ? `[${sub.code}] ` : ""}${sub.name}`, startX + 4, y + 3.5, { width: colModW3 - 4, truncate: true });
      doc.text(String(sub.coefficient), startX + colModW3, y + 3.5, { width: colCoefW3, align: "center" });
      doc.font("Helvetica-Bold").text(sub.finalGrade, startX + colModW3 + colCoefW3, y + 3.5, { width: colNoteW3, align: "center" });
      doc.font("Helvetica-Bold").text(sub.points, startX + colModW3 + colCoefW3 + colNoteW3, y + 3.5, { width: colPtsW3, align: "center" });
      doc.font("Helvetica").text(sub.appreciation, startX + colModW3 + colCoefW3 + colNoteW3 + colPtsW3, y + 3.5, { width: colAppW3, align: "center" });
      doc.font("Helvetica-Bold").fillColor(sub.isValid ? "#16805A" : "#C73B3B").text(sub.isValid ? "Oui" : "Non", startX + fullWidth - colValW3, y + 3.5, { width: colValW3, align: "center" });
      y += 13;
    });
  });

  drawRecapMatrix(doc, totals, startX, 640, fullWidth, 58);

  const signatories = tmpl.signatories || [
    { title: "Le Promoteur", roleKey: "promoteur" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];
  renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, signatories, 706, fullWidth, startX);
}

async function generateAnnualTranscriptPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
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
      const doc = new PDFDocument({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 } });
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