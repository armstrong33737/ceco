// packages/backend/src/services/pdf/modules/diplomasPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const { bufferFromDataUrl, safeDrawImage } = require("../common/pdfHelpers");
const { drawWatermark, drawDiplomaOrnamentalBorders } = require("../common/pdfGraphics");

function renderSingleGraduationDiplomaPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const primaryColor = tmpl?.primaryColor || "#071A2E";

  drawDiplomaOrnamentalBorders(doc, 842, 595, primaryColor);
  drawWatermark(doc, tmpl, logoBuf, sealBuf, 270, 140, 300);

  doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold").text(
    "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE",
    45, 42, { width: 230, align: "center", lineGap: 1.5 }
  );

  doc.text(
    "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING",
    565, 42, { width: 230, align: "center", lineGap: 1.5 }
  );

  if (logoBuf) safeDrawImage(doc, logoBuf, 345, 40, { fit: [60, 60], align: "center" });
  if (sealBuf) safeDrawImage(doc, sealBuf, 435, 40, { fit: [60, 60], align: "center" });

  doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text(
    (center.name || "ÉTABLISSEMENT DE FORMATION").toUpperCase(),
    50, 115, { width: 742, align: "center" }
  );
  doc.fillColor("#64748B").fontSize(8).font("Helvetica").text(
    `Agrément Ministériel N° : ${center.registrationNumber || "MINEFOP"} • ${center.city || "Cameroun"}`,
    50, 133, { width: 742, align: "center" }
  );

  doc.fillColor("#C39B52").fontSize(20).font("Times-Bold").text(
    "DIPLÔME DE FIN DE FORMATION PROFESSIONNELLE",
    50, 160, { width: 742, align: "center" }
  );
  doc.fillColor("#475569").fontSize(10).font("Times-Italic").text(
    "VOCATIONAL GRADUATION DIPLOMA",
    50, 185, { width: 742, align: "center" }
  );

  doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(
    `Vu la loi portant orientation de la formation professionnelle au Cameroun ;\nVu l'arrêté d'agrément de l'établissement susmentionné ;\nSur proposition du jury de délibération souverain réuni en date officielle ;`,
    75, 215, { width: 692, align: "center", lineGap: 3 }
  );

  doc.fillColor(primaryColor).fontSize(11).font("Times-Bold").text(
    "LE PRÉSENT DIPLÔME EST DÉCERNÉ À :",
    50, 268, { width: 742, align: "center" }
  );

  doc.fillColor("#0B1C30").fontSize(17).font("Helvetica-Bold").text(
    `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`,
    50, 288, { width: 742, align: "center" }
  );

  const birthDateStr = student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—";
  const birthLine = `Né(e) le ${birthDateStr}${student.birthPlace ? ` à ${student.birthPlace}` : ""} • Matricule : ${student.matricule || "—"}`;
  doc.fillColor("#475569").fontSize(9).font("Helvetica").text(birthLine, 50, 312, { width: 742, align: "center" });

  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica").text(
    `Pour avoir suivi avec succès et assiduité l'ensemble des modules prescrits et satisfait aux épreuves de qualification dans la spécialité :`,
    75, 335, { width: 692, align: "center", lineGap: 3 }
  );

  doc.fillColor(primaryColor).fontSize(13).font("Helvetica-Bold").text(
    `${classe.filiereName || "Formation Professionnelle"} (${classe.programTypeCode || "DQP"})`,
    50, 365, { width: 742, align: "center" }
  );

  doc.fillColor("#C39B52").fontSize(10.5).font("Helvetica-Bold").text(
    `MENTION OBTENUE : ${(totals.mention || "PASSABLE").toUpperCase()}`,
    50, 388, { width: 742, align: "center" }
  );

  const sigY = 430;
  if (qrBuf) {
    safeDrawImage(doc, qrBuf, 75, sigY, { width: 70, height: 70 });
    const shortSig = snapshot.qrToken ? snapshot.qrToken.split("?")[0].substring(0, 10) : "CECO";
    doc.fillColor("#64748B").fontSize(5).font("Courier").text(`ID: ${shortSig}`, 75, sigY + 73, { width: 70, align: "center" });
  }

  doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(
    `Fait à ${center.city || "Bafoussam"}, le ${new Date().toLocaleDateString("fr-FR")}`,
    550, sigY - 15, { width: 220, align: "center" }
  );

  const sigDirector = bufferFromDataUrl(center.signatures?.directeur);
  const sigPromoteur = bufferFromDataUrl(center.signatures?.promoteur);

  doc.font("Helvetica-Bold");
  doc.text("Le Promoteur / Fondateur", 280, sigY + 5, { width: 180, align: "center" });
  doc.text("Le Directeur de l'Établissement", 550, sigY + 5, { width: 220, align: "center" });

  if (sigPromoteur) safeDrawImage(doc, sigPromoteur, 320, sigY + 22, { fit: [100, 36], align: "center" });
  if (sigDirector) safeDrawImage(doc, sigDirector, 600, sigY + 22, { fit: [120, 38], align: "center" });

  doc.rect(45, 545, 752, 0.5).stroke("#C39B52");
  doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text("Titre officiel de qualification certifié conforme • Registre sécurisé CECO ERP", 45, 552, { width: 500 });
  doc.fillColor(primaryColor).fontSize(6.5).font("Helvetica-Bold").text("PROPULSÉ PAR CECO ERP", 670, 552, { align: "right" });
}

async function generateGraduationDiplomaPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-DIPLOMA", {
        margin: 0,
        width: 90,
        errorCorrectionLevel: "M",
      });
      renderSingleGraduationDiplomaPage(doc, snapshot, qrBuf);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function generateBatchGraduationDiplomasPdf(snapshotsList, qrPayloadsList, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", layout: "landscape", margins: { top: 20, bottom: 20, left: 20, right: 20 } });
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-DIPLOMA", {
          margin: 0,
          width: 90,
          errorCorrectionLevel: "M",
        });
        renderSingleGraduationDiplomaPage(doc, snapshotsList[i], qrBuf);
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
  generateGraduationDiplomaPdf,
  generateBatchGraduationDiplomasPdf,
};