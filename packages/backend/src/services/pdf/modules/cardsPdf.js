// packages/backend/src/services/pdf/modules/cardsPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const { bufferFromDataUrl, safeDrawImage } = require("../common/pdfHelpers");
const { drawStudentAvatar, drawWatermark, drawCropMarks } = require("../common/pdfGraphics");

/**
 * Génère la carte d'apprenant individuelle (Format badge CR80 : 85.6mm x 53.98mm soit 243pt x 153pt)
 */
async function generateStudentCardPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [243, 153], margins: { top: 0, bottom: 0, left: 0, right: 0 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const photoBuf = bufferFromDataUrl(student.photoDataUrl);
      const sigBuf = bufferFromDataUrl(center.signatures?.directeur);
      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-CARD", { margin: 0, width: 85 });

      const themeColor = tmpl.themeColor || "#071A2E";
      const accentColor = tmpl.accentColor || "#18527A";

      // --- FACE RECTO ---
      doc.rect(0, 0, 243, 153).fill("#FFFFFF");
      doc.rect(0, 0, 243, 26).fill(themeColor);

      drawWatermark(doc, tmpl, logoBuf, sealBuf, 75, 40, 95);

      if (tmpl.showLogo !== false && logoBuf) safeDrawImage(doc, logoBuf, 8, 3, { fit: [20, 20] });
      doc.fillColor("#FFFFFF").fontSize(6.5).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), 32, 5, { width: 175, truncate: true });
      doc.fillColor("#CBD5E1").fontSize(5).font("Helvetica-Bold").text(tmpl.cardTitle || "CARTE D'APPRENANT OFFICIELLE", 32, 15);
      if (tmpl.showSeal !== false && sealBuf) safeDrawImage(doc, sealBuf, 216, 3, { fit: [20, 20] });

      drawStudentAvatar(doc, photoBuf, 12, 46, 55, 55);

      const ix = 76;
      let iy = 46;
      doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("NOM :", ix, iy, { continued: true });
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text((student.lastName || "").toUpperCase(), { width: 145, truncate: true });

      iy += 11;
      doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("PRÉNOM :", ix, iy, { continued: true });
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(student.firstName || "", { width: 145, truncate: true });

      iy += 11;
      doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("MATRICULE :", ix, iy, { continued: true });
      doc.fillColor(accentColor).fontSize(6.5).font("Helvetica-Bold").text(student.matricule || "—", { width: 145, truncate: true });

      iy += 11;
      doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("FILIÈRE :", ix, iy, { continued: true });
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica").text(classe.filiereName || "—", { width: 145, truncate: true });

      iy += 11;
      doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("NIVEAU :", ix, iy, { continued: true });
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(`Niveau ${classe.niveauOrder || 1} (${classe.programTypeCode || "DQP"})`, { width: 145, truncate: true });

      iy += 11;
      doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("COHORTE :", ix, iy, { continued: true });
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica").text(classe.promotionLabel || classe.academicYearLabel || "—", { width: 145, truncate: true });

      doc.rect(0, 137, 243, 16).fill("#F8FAFC");
      doc.fillColor("#475569").fontSize(5).font("Helvetica").text(`Agrément : ${center.registrationNumber || "MINEFOP"}`, 8, 140);
      doc.fillColor(accentColor).fontSize(5.5).font("Helvetica-Bold").text("CECO ID-PASS", 195, 142);

      // --- FACE VERSO ---
      doc.addPage({ size: [243, 153], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      doc.rect(0, 0, 243, 153).fill("#FFFFFF");

      drawWatermark(doc, tmpl, logoBuf, sealBuf, 75, 35, 95);

      doc.fillColor(themeColor).fontSize(6.5).font("Helvetica-Bold").text("CONDITIONS D'UTILISATION", 8, 8);
      doc.fillColor("#475569").fontSize(4.5).font("Helvetica").text(
        tmpl.termsOfUse || "Carte officielle d'apprenant. Présentation obligatoire aux examens et évaluations. En cas de perte, rapporter à la direction.",
        8, 17, { width: 227, lineGap: 1 }
      );

      safeDrawImage(doc, qrBuf, 8, 54, { width: 46, height: 46 });
      doc.fillColor("#64748B").fontSize(4.5).font("Helvetica-Bold").text("Authentification :", 60, 58);
      doc.fillColor(accentColor).fontSize(4.5).font("Courier").text(snapshot.qrToken || "CECO-OFFICIAL", 60, 68, { width: 175 });

      if (sigBuf) safeDrawImage(doc, sigBuf, 160, 78, { fit: [65, 24], align: "center" });
      doc.fillColor("#0F172A").fontSize(5.5).font("Helvetica-Bold").text(tmpl.signatoryTitle || center.directorTitle || "Le Directeur Général", 150, 106, { width: 85, align: "center" });

      doc.rect(0, 132, 243, 21).fill("#071A2E");
      doc.fillColor("#94A3B8").fontSize(4.5).font("Helvetica").text("Propriété exclusive du centre.", 8, 138, { width: 155 });
      doc.fillColor("#FFFFFF").fontSize(6).font("Helvetica-Bold").text("PROPULSÉ PAR CECO", 175, 140);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Compile une classe en planches A4 Duplex découpables (8 badges par page avec repères d'imprimerie)
 */
async function generateBatchCardsSheetPdf(snapshotsList, qrPayloadsList, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const cardW = 255;
      const cardH = 165;
      const startX = 35;
      const startY = 35;
      const gapX = 15;
      const gapY = 15;

      const CARDS_PER_PAGE = 8;
      const totalPages = Math.ceil(snapshotsList.length / CARDS_PER_PAGE);

      for (let p = 0; p < totalPages; p++) {
        const pageItems = snapshotsList.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);
        const pagePayloads = qrPayloadsList.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);
        if (p > 0) {
          doc.addPage({ size: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 } });
        }

        // Planche RECTO
        for (let i = 0; i < pageItems.length; i++) {
          const row = Math.floor(i / 2);
          const col = i % 2;
          const x = startX + col * (cardW + gapX);
          const y = startY + row * (cardH + gapY);

          drawCropMarks(doc, x, y, cardW, cardH);

          const snap = pageItems[i];
          const tmpl = snap.templateConfig || {};
          const logoBuf = bufferFromDataUrl(snap.center.logoDataUrl);
          const sealBuf = bufferFromDataUrl(snap.center.sealDataUrl);
          const photoBuf = bufferFromDataUrl(snap.student.photoDataUrl);

          doc.rect(x, y, cardW, cardH).lineWidth(0.5).strokeColor("#CBD5E1").fillAndStroke("#FFFFFF", "#CBD5E1");
          drawWatermark(doc, tmpl, logoBuf, sealBuf, x + 75, y + 40, 95);

          doc.rect(x, y, cardW, 28).fill(tmpl.themeColor || "#071A2E");

          if (tmpl.showLogo !== false && logoBuf) safeDrawImage(doc, logoBuf, x + 8, y + 4, { fit: [20, 20] });
          doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold").text((snap.center.name || "").toUpperCase(), x + 32, y + 6, { width: 190, truncate: true });
          doc.fillColor("#CBD5E1").fontSize(5.5).font("Helvetica-Bold").text(tmpl.cardTitle || "CARTE D'APPRENANT OFFICIELLE", x + 32, y + 16);
          if (tmpl.showSeal !== false && sealBuf) safeDrawImage(doc, sealBuf, x + 228, y + 4, { fit: [20, 20] });

          drawStudentAvatar(doc, photoBuf, x + 12, y + 46, 56, 56);

          const ix = x + 76;
          let iy = y + 46;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("NOM :", ix, iy, { continued: true });
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text((snap.student.lastName || "").toUpperCase(), { width: 155, truncate: true });

          iy += 11;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("PRÉNOM :", ix, iy, { continued: true });
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(snap.student.firstName || "", { width: 155, truncate: true });

          iy += 11;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("MATRICULE :", ix, iy, { continued: true });
          doc.fillColor(tmpl.accentColor || "#18527A").fontSize(6.5).font("Helvetica-Bold").text(snap.student.matricule || "—", { width: 155, truncate: true });

          iy += 11;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("FILIÈRE :", ix, iy, { continued: true });
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica").text(snap.classe?.filiereName || "—", { width: 155, truncate: true });

          iy += 11;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("NIVEAU :", ix, iy);
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(`Niveau ${snap.classe?.niveauOrder || 1} (${snap.classe?.programTypeCode || "DQP"})`, ix + 28, iy);

          iy += 11;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("COHORTE :", ix, iy, { continued: true });
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica").text(snap.classe?.promotionLabel || snap.classe?.academicYearLabel || "—", { width: 145, truncate: true });

          doc.rect(x, y + 146, cardW, 19).fill("#F8FAFC");
          doc.fillColor("#475569").fontSize(5).font("Helvetica").text(`Agrément : ${snap.center.registrationNumber || "MINEFOP"}`, x + 8, y + 152);
          doc.fillColor(tmpl.accentColor || "#18527A").fontSize(5.5).font("Helvetica-Bold").text("CECO ID-PASS", x + 195, y + 152);
        }

        // Planche VERSO (symétrie inversée pour impression recto-verso parfaite)
        doc.addPage({ size: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 } });

        for (let i = 0; i < pageItems.length; i++) {
          const row = Math.floor(i / 2);
          const col = 1 - (i % 2);
          const x = startX + col * (cardW + gapX);
          const y = startY + row * (cardH + gapY);

          drawCropMarks(doc, x, y, cardW, cardH);

          const snap = pageItems[i];
          const payload = pagePayloads[i];
          const qrBuf = await QRCode.toBuffer(payload || snap.qrToken || "CECO-CARD", { margin: 0, width: 85 });
          const tmpl = snap.templateConfig || {};
          const logoBuf = bufferFromDataUrl(snap.center?.logoDataUrl);
          const sealBuf = bufferFromDataUrl(snap.center?.sealDataUrl);

          doc.rect(x, y, cardW, cardH).lineWidth(0.5).strokeColor("#CBD5E1").fillAndStroke("#FFFFFF", "#CBD5E1");
          drawWatermark(doc, tmpl, logoBuf, sealBuf, x + 75, y + 35, 95);

          doc.fillColor(tmpl.themeColor || "#071A2E").fontSize(6.5).font("Helvetica-Bold").text("CONDITIONS D'UTILISATION", x + 8, y + 8);
          doc.fillColor("#475569").fontSize(5).font("Helvetica").text(
            tmpl.termsOfUse || "Carte officielle d'apprenant. Présentation obligatoire aux examens et évaluations. En cas de perte, rapporter à la direction.",
            x + 8, y + 18, { width: 235, lineGap: 1 }
          );

          safeDrawImage(doc, qrBuf, x + 8, y + 54, { width: 46, height: 46 });
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("Authentification :", x + 60, y + 56);
          doc.fillColor(tmpl.accentColor || "#18527A").fontSize(5).font("Courier").text(snap.qrToken || "CECO-OFFICIAL", x + 60, y + 66, { width: 185 });

          const sigBuf = bufferFromDataUrl(snap.center.signatures?.directeur);
          if (sigBuf) safeDrawImage(doc, sigBuf, x + 165, y + 80, { fit: [70, 24], align: "center" });
          doc.fillColor("#0F172A").fontSize(5.5).font("Helvetica-Bold").text(tmpl.signatoryTitle || snap.center.directorTitle || "Le Directeur Général", x + 160, y + 108, { width: 85, align: "center" });

          doc.rect(x, y + 144, cardW, 21).fill("#071A2E");
          doc.fillColor("#94A3B8").fontSize(4.5).font("Helvetica").text(`Agrément : ${snap.center.registrationNumber || "MINEFOP"}`, x + 8, y + 151);
          doc.fillColor("#FFFFFF").fontSize(6).font("Helvetica-Bold").text("PROPULSÉ PAR CECO", x + 185, y + 151);
        }
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
  generateStudentCardPdf,
  generateBatchCardsSheetPdf,
};