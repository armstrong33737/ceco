// packages/backend/src/services/pdf/modules/classPvsPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const { bufferFromDataUrl, safeDrawImage } = require("../common/pdfHelpers");
const { drawWatermark } = require("../common/pdfGraphics");
const { renderSignatoriesAndQrCompact } = require("../common/pdfSignatories");

/**
 * Bordereau manuscrit vierge pour enseignant (A4 Portrait)
 */
async function generateBlankGradeSheetPdf(snapshot, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, offering = {}, students = [], templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const primaryColor = tmpl?.primaryColor || "#071A2E";

      const startX = 25;
      const fullWidth = 545;

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.05 }, logoBuf, sealBuf, 130, 260, 280);

      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), startX, 22, { width: fullWidth, align: "center" });
      doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(`Agrément : ${center.registrationNumber || "MINEFOP"} • ${center.city || "Cameroun"}`, startX, 36, { width: fullWidth, align: "center" });

      doc.moveTo(startX, 50).lineTo(startX + fullWidth, 50).lineWidth(1).strokeColor(primaryColor).stroke();

      doc.fillColor("#0F172A").fontSize(10).font("Helvetica-Bold").text("BORDEREAU DE REPORT DE NOTES MANUSCRIT", startX, 60, { width: fullWidth, align: "center" });
      doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text("Document de travail de l'enseignant pour la correction et la saisie", startX, 73, { width: fullWidth, align: "center" });

      doc.rect(startX, 88, fullWidth, 38).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold");
      doc.text(`Classe : ${offering.classeLabel || "—"}`, startX + 10, 95);
      doc.text(`Matière : ${offering.subjectName || "—"} (Coef ${offering.coefficient || 2})`, startX + 190, 95);
      doc.text(`Semestre : ${offering.semesterLabel || "—"}`, startX + 390, 95);

      doc.text(`Groupe : ${offering.categoryName || "Général"}`, startX + 10, 110);
      doc.text(`Formateur : ${offering.formateurName || "Non assigné"}`, startX + 190, 110);
      doc.text(`Effectif : ${students.length} apprenant(s)`, startX + 390, 110);

      let y = 135;
      doc.rect(startX, y, fullWidth, 18).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold");
      doc.text("N°", startX + 5, y + 5, { width: 25, align: "center" });
      doc.text("Matricule", startX + 35, y + 5, { width: 75 });
      doc.text("Nom & Prénom de l'Apprenant", startX + 115, y + 5, { width: 175 });
      doc.text("CC /20", startX + 295, y + 5, { width: 55, align: "center" });
      doc.text("Exam /20", startX + 355, y + 5, { width: 55, align: "center" });
      doc.text("Rattrap. /20", startX + 415, y + 5, { width: 60, align: "center" });
      doc.text("Signature", startX + 480, y + 5, { width: 60, align: "center" });

      y += 18;

      students.forEach((st, idx) => {
        if (y > 750) {
          doc.addPage({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 } });
          y = 30;
        }

        doc.rect(startX, y, fullWidth, 16).strokeColor("#CBD5E1").stroke();
        doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica");
        doc.text(String(idx + 1), startX + 5, y + 4.5, { width: 25, align: "center" });
        doc.font("Helvetica-Bold").text(st.matricule, startX + 35, y + 4.5, { width: 75 });
        doc.font("Helvetica").text(`${st.lastName} ${st.firstName}`, startX + 115, y + 4.5, { width: 175, truncate: true });

        doc.rect(startX + 295, y, 55, 16).strokeColor("#E2E8F0").stroke();
        doc.rect(startX + 355, y, 55, 16).strokeColor("#E2E8F0").stroke();
        doc.rect(startX + 415, y, 60, 16).strokeColor("#E2E8F0").stroke();
        doc.rect(startX + 480, y, 65, 16).strokeColor("#E2E8F0").stroke();

        y += 16;
      });

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Procès-Verbal de Notes de Matière Certifié (A4 Portrait)
 */
async function generateCertifiedGradeSheetPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, offering = {}, rows = [], stats = {}, templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const primaryColor = tmpl?.primaryColor || "#071A2E";

      const startX = 25;
      const fullWidth = 545;

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.06 }, logoBuf, sealBuf, 130, 260, 280);

      doc.fillColor("#0F172A").fontSize(7).font("Helvetica-Bold").text(
        "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE",
        startX, 22, { width: 195, align: "center", lineGap: 1.2 }
      );
      doc.text(
        "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING",
        startX + fullWidth - 195, 22, { width: 195, align: "center", lineGap: 1.2 }
      );

      if (sealBuf) safeDrawImage(doc, sealBuf, startX + (fullWidth - 40) / 2, 20, { fit: [40, 40], align: "center" });

      doc.fillColor(primaryColor).fontSize(10.5).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), startX, 68, { width: fullWidth, align: "center" });
      doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(`Agrément : ${center.registrationNumber || "MINEFOP"} • ${center.city || "Cameroun"}`, startX, 81, { width: fullWidth, align: "center" });

      doc.moveTo(startX, 94).lineTo(startX + fullWidth, 94).lineWidth(1.2).strokeColor(primaryColor).stroke();

      doc.fillColor("#0F172A").fontSize(10.5).font("Helvetica-Bold").text("PROCÈS-VERBAL OFFICIEL DE NOTES DE COURS", startX, 102, { width: fullWidth, align: "center", underline: true });

      doc.rect(startX, 118, fullWidth, 34).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold");
      doc.text(`Classe : ${offering.classeLabel}`, startX + 10, 123);
      doc.text(`Matière : ${offering.subjectName} (Coef ${offering.coefficient})`, startX + 180, 123);
      doc.text(`Période : ${offering.semesterLabel}`, startX + 380, 123);

      doc.text(`Groupe : ${offering.categoryName || "Général"}`, startX + 10, 136);
      doc.text(`Formateur : ${offering.formateurName || "Non assigné"}`, startX + 180, 136);
      doc.text(`Taux de réussite : ${stats.successRate || "0"}%`, startX + 380, 136);

      let y = 160;
      doc.rect(startX, y, fullWidth, 16).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(6.5).font("Helvetica-Bold");
      doc.text("N°", startX + 4, y + 4.5, { width: 20, align: "center" });
      doc.text("Matricule", startX + 28, y + 4.5, { width: 68 });
      doc.text("Nom & Prénom de l'Apprenant", startX + 100, y + 4.5, { width: 170 });
      doc.text("CC /20", startX + 275, y + 4.5, { width: 45, align: "center" });
      doc.text("Normale", startX + 325, y + 4.5, { width: 45, align: "center" });
      doc.text("Rattrap.", startX + 375, y + 4.5, { width: 45, align: "center" });
      doc.text("Finale /20", startX + 425, y + 4.5, { width: 55, align: "center" });
      doc.text("Validé", startX + 485, y + 4.5, { width: 55, align: "center" });

      y += 16;

      rows.forEach((row, idx) => {
        if (y > 720) {
          doc.addPage({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 } });
          y = 30;
        }

        doc.rect(startX, y, fullWidth, 14).strokeColor("#E2E8F0").stroke();
        doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica");
        doc.text(String(idx + 1), startX + 4, y + 3.5, { width: 20, align: "center" });
        doc.font("Helvetica-Bold").text(row.matricule, startX + 28, y + 3.5, { width: 68 });
        doc.font("Helvetica").text(row.fullName, startX + 100, y + 3.5, { width: 170, truncate: true });

        doc.text(row.ccAvg || "—", startX + 275, y + 3.5, { width: 45, align: "center" });
        doc.text(row.normale || "—", startX + 325, y + 3.5, { width: 45, align: "center" });
        doc.text(row.rattrapage || "—", startX + 375, y + 3.5, { width: 45, align: "center" });
        doc.font("Helvetica-Bold").text(row.finalGrade || "—", startX + 425, y + 3.5, { width: 55, align: "center" });
        doc.font("Helvetica-Bold").fillColor(row.isValid ? "#16805A" : "#C73B3B").text(row.isValid ? "Oui" : "Non", startX + 485, y + 3.5, { width: 55, align: "center" });

        y += 14;
      });

      y += 8;
      doc.rect(startX, y, fullWidth, 20).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(7).font("Helvetica-Bold");
      doc.text(`Inscrits : ${stats.total || 0}  •  Évalués : ${stats.evaluated || 0}  •  Validés (≥10) : ${stats.passed || 0}  •  Ajournés : ${stats.failed || 0}  •  Moyenne : ${stats.classAverage || "—"} / 20`, startX + 10, y + 5.5);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-PV", { margin: 0, width: 75 });
      renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, [
        { title: "Le Formateur Responsable", roleKey: "formateur" },
        { title: "Le Directeur Général", roleKey: "directeur" },
      ], 700, fullWidth, startX);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Procès-Verbal de Délibération de Classe A4 Paysage (Semestre & Annuel)
 */
async function generateClassSemesterSummaryPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, classe = {}, offerings = [], summaries = [], periodLabel = "Semestre", templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const primaryColor = tmpl?.primaryColor || "#071A2E";

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.05 }, logoBuf, sealBuf, 250, 130, 300);

      if (logoBuf) safeDrawImage(doc, logoBuf, 25, 18, { fit: [38, 38] });
      if (sealBuf) safeDrawImage(doc, sealBuf, 775, 18, { fit: [38, 38] });

      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), 75, 20, { width: 690, align: "center" });
      doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(
        `GRILLE DE DÉLIBÉRATION OFFICIELLE (${periodLabel.toUpperCase()}) • Classe : ${classe.label} • Filière : ${classe.filiereName}`,
        75, 33, { width: 690, align: "center" }
      );

      doc.moveTo(25, 50).lineTo(815, 50).lineWidth(1).strokeColor(primaryColor).stroke();

      let y = 58;
      const colMatriculeW = 65;
      const colNameW = 140;
      const colSummaryW = 120;
      const availWidth = 790 - (colMatriculeW + colNameW + colSummaryW);
      const colSubW = offerings.length > 0 ? availWidth / offerings.length : 40;

      doc.rect(25, y, 790, 20).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(6.5).font("Helvetica-Bold");
      doc.text("Matricule", 30, y + 5.5, { width: colMatriculeW });
      doc.text("Nom & Prénom de l'Apprenant", 30 + colMatriculeW, y + 5.5, { width: colNameW });

      offerings.forEach((off, idx) => {
        const ox = 30 + colMatriculeW + colNameW + idx * colSubW;
        doc.text(`${off.subject?.code || off.subject?.name?.substring(0, 6)}\n(C${off.coefficient})`, ox, y + 3, { width: colSubW, align: "center" });
      });

      const sx = 30 + colMatriculeW + colNameW + offerings.length * colSubW;
      doc.text("Moyenne", sx, y + 5.5, { width: 45, align: "center" });
      doc.text("Rang", sx + 45, y + 5.5, { width: 30, align: "center" });
      doc.text("Décision", sx + 75, y + 5.5, { width: 45, align: "center" });

      y += 20;

      summaries.forEach((row) => {
        if (y > 500) {
          doc.addPage({ size: "A4", layout: "landscape", margins: { top: 18, bottom: 20, left: 25, right: 25 } });
          y = 25;
        }

        doc.rect(25, y, 790, 15).strokeColor("#CBD5E1").stroke();
        doc.fillColor("#0F172A").fontSize(6).font("Helvetica");
        doc.font("Helvetica-Bold").text(row.student.matricule, 30, y + 3.5, { width: colMatriculeW });
        doc.font("Helvetica").text(`${row.student.lastName} ${row.student.firstName}`, 30 + colMatriculeW, y + 3.5, { width: colNameW, truncate: true });

        offerings.forEach((off, sidx) => {
          const ox = 30 + colMatriculeW + colNameW + sidx * colSubW;
          const subRes = row.subjects.find((s) => s.subjectId === off.subjectId);
          doc.text(subRes && subRes.finalGrade !== null ? String(subRes.finalGrade) : "—", ox, y + 3.5, { width: colSubW, align: "center" });
        });

        doc.font("Helvetica-Bold").text(row.semesterAverage !== null ? String(row.semesterAverage) : "—", sx, y + 3.5, { width: 45, align: "center" });
        doc.font("Helvetica").text(row.rank ? `${row.rank}e` : "—", sx + 45, y + 3.5, { width: 30, align: "center" });

        const isPassed = row.decision === "ADMIS" || row.decision === "VALIDÉ" || row.decision === "DIPLÔMÉ";
        doc.font("Helvetica-Bold").fillColor(isPassed ? "#16805A" : "#C73B3B").text(row.decision, sx + 75, y + 3.5, { width: 45, align: "center" });

        y += 15;
      });

      y += 6;
      const evaluatedRows = summaries.filter((s) => s.semesterAverage !== null);
      const passedCount = evaluatedRows.filter((s) => s.decision === "ADMIS" || s.decision === "VALIDÉ" || s.decision === "DIPLÔMÉ").length;
      const successRate = evaluatedRows.length > 0 ? ((passedCount / evaluatedRows.length) * 100).toFixed(1) : "0";

      doc.rect(25, y, 790, 18).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(7).font("Helvetica-Bold");
      doc.text(
        `RÉCAPITULATIF DE CLASSE : ${summaries.length} Élève(s)  •  ${evaluatedRows.length} Évalué(s)  •  ${passedCount} Validé(s)  •  ${evaluatedRows.length - passedCount} Ajourné(s)  •  Taux de réussite : ${successRate}%`,
        35, y + 5.5
      );

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Procès-Verbal de Contrôle Continu (PV_CC - A4 Paysage)
 */
async function generateClassContinuousAssessmentSummaryPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, classe = {}, offerings = [], summaries = [], periodLabel = "Contrôle Continu", templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const primaryColor = tmpl?.primaryColor || "#071A2E";

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.05 }, logoBuf, sealBuf, 250, 130, 300);

      if (logoBuf) safeDrawImage(doc, logoBuf, 25, 18, { fit: [38, 38] });
      if (sealBuf) safeDrawImage(doc, sealBuf, 775, 18, { fit: [38, 38] });

      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), 75, 20, { width: 690, align: "center" });
      doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(
        `PROCÈS-VERBAL RÉCAPITULATIF DU CONTRÔLE CONTINU (CC & TP) • Classe : ${classe.label} • ${periodLabel}`,
        75, 33, { width: 690, align: "center" }
      );

      doc.moveTo(25, 50).lineTo(815, 50).lineWidth(1).strokeColor(primaryColor).stroke();

      let y = 58;
      const colMatriculeW = 65;
      const colNameW = 140;
      const colSummaryW = 100;
      const availWidth = 790 - (colMatriculeW + colNameW + colSummaryW);
      const colSubW = offerings.length > 0 ? availWidth / offerings.length : 40;

      doc.rect(25, y, 790, 20).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(6.5).font("Helvetica-Bold");
      doc.text("Matricule", 30, y + 5.5, { width: colMatriculeW });
      doc.text("Nom & Prénom de l'Apprenant", 30 + colMatriculeW, y + 5.5, { width: colNameW });

      offerings.forEach((off, idx) => {
        const ox = 30 + colMatriculeW + colNameW + idx * colSubW;
        doc.text(`${off.subject?.code || off.subject?.name?.substring(0, 6)}\n(C${off.coefficient})`, ox, y + 3, { width: colSubW, align: "center" });
      });

      const sx = 30 + colMatriculeW + colNameW + offerings.length * colSubW;
      doc.text("Moy. CC", sx, y + 5.5, { width: 50, align: "center" });
      doc.text("Rang CC", sx + 50, y + 5.5, { width: 50, align: "center" });

      y += 20;

      summaries.forEach((row) => {
        if (y > 500) {
          doc.addPage({ size: "A4", layout: "landscape", margins: { top: 18, bottom: 20, left: 25, right: 25 } });
          y = 25;
        }

        doc.rect(25, y, 790, 15).strokeColor("#CBD5E1").stroke();
        doc.fillColor("#0F172A").fontSize(6).font("Helvetica");
        doc.font("Helvetica-Bold").text(row.student.matricule, 30, y + 3.5, { width: colMatriculeW });
        doc.font("Helvetica").text(`${row.student.lastName} ${row.student.firstName}`, 30 + colMatriculeW, y + 3.5, { width: colNameW, truncate: true });

        offerings.forEach((off, sidx) => {
          const ox = 30 + colMatriculeW + colNameW + sidx * colSubW;
          const subRes = row.subjects.find((s) => s.subjectId === off.subjectId);
          doc.text(subRes && subRes.ccAverage !== null && subRes.ccAverage !== undefined ? String(subRes.ccAverage) : "—", ox, y + 3.5, { width: colSubW, align: "center" });
        });

        doc.font("Helvetica-Bold").text(row.ccAverage !== null && row.ccAverage !== undefined ? String(row.ccAverage) : "—", sx, y + 3.5, { width: 50, align: "center" });
        doc.font("Helvetica").text(row.rank ? `${row.rank}e` : "—", sx + 50, y + 3.5, { width: 50, align: "center" });

        y += 15;
      });

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateBlankGradeSheetPdf,
  generateCertifiedGradeSheetPdf,
  generateClassSemesterSummaryPdf,
  generateClassContinuousAssessmentSummaryPdf,
};