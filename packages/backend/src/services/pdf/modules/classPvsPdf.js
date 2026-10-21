// packages/backend/src/services/pdf/modules/classPvsPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const { bufferFromDataUrl, safeDrawImage } = require("../common/pdfHelpers");
const { drawInternalSimpleHeader } = require("../common/pdfHeaders");
const { drawWatermark } = require("../common/pdfGraphics");
const { renderSignatoriesAndQrCompact } = require("../common/pdfSignatories");

/**
 * Normalise la décision du jury de façon insensible à la casse et aux accents
 */
function parseJuryDecision(decisionStr) {
  const normalized = String(decisionStr || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const isPassed = normalized === "ADMIS" || normalized === "VALIDE" || normalized === "DIPLOME";

  let label = "AJOURNÉ";
  if (normalized === "DIPLOME") label = "DIPLÔMÉ";
  else if (normalized === "VALIDE") label = "VALIDÉ";
  else if (normalized === "ADMIS") label = "ADMIS";
  else if (normalized === "REDOUBLE") label = "REDOUBLE";
  else if (normalized === "EXCLU") label = "EXCLU";

  return {
    isPassed,
    color: isPassed ? "#16805A" : "#C73B3B",
    label,
  };
}

/**
 * 1. BORDEREAU DE NOTES MANUSCRIT VIERGE (A4 Portrait)
 */
async function generateBlankGradeSheetPdf(snapshot, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, offering = {}, students = [], templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const primaryColor = tmpl?.primaryColor || "#071A2E";

      const startX = 25;
      const fullWidth = 545.28;

      drawWatermark(doc, tmpl, logoBuf, null, 130, 260, 280);

      const endHeaderY = drawInternalSimpleHeader(doc, tmpl, center, logoBuf, 18, fullWidth, startX);

      const titleY = endHeaderY + 8;
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text(
        "BORDEREAU DE REPORT DE NOTES MANUSCRIT",
        startX, titleY, { width: fullWidth, align: "center", underline: true }
      );
      doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text(
        "Document de travail pour l'évaluation continue et la saisie des notes",
        startX, titleY + 14, { width: fullWidth, align: "center" }
      );

      const cardY = titleY + 26;
      doc.rect(startX, cardY, fullWidth, 36).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold");
      doc.text(`Classe : ${offering.classeLabel || "—"}`, startX + 10, cardY + 6);
      doc.text(`Matière : ${offering.subjectName || "—"} (Coef ${offering.coefficient || 2})`, startX + 190, cardY + 6);
      doc.text(`Semestre : ${offering.semesterLabel || "—"}`, startX + 390, cardY + 6);

      doc.text(`Groupe : ${offering.categoryName || "Général"}`, startX + 10, cardY + 20);
      doc.text(`Formateur : ${offering.formateurName || "Non assigné"}`, startX + 190, cardY + 20);
      doc.text(`Effectif : ${students.length} apprenant(s)`, startX + 390, cardY + 20);

      let y = cardY + 44;
      doc.rect(startX, y, fullWidth, 18).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold");
      doc.text("N°", startX + 5, y + 5.5, { width: 25, align: "center" });
      doc.text("Matricule", startX + 35, y + 5.5, { width: 75 });
      doc.text("Nom & Prénom de l'Apprenant", startX + 115, y + 5.5, { width: 175 });
      doc.text("CC /20", startX + 295, y + 5.5, { width: 55, align: "center" });
      doc.text("Exam /20", startX + 355, y + 5.5, { width: 55, align: "center" });
      doc.text("Rattrap. /20", startX + 415, y + 5.5, { width: 60, align: "center" });
      doc.text("Signature", startX + 480, y + 5.5, { width: 60, align: "center" });

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
 * 2. PROCÈS-VERBAL DE MATIÈRE (PV_MATIERE - A4 Portrait)
 */
async function generateCertifiedGradeSheetPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, offering = {}, rows = [], stats = {}, templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const primaryColor = tmpl?.primaryColor || "#071A2E";

      const startX = 25;
      const fullWidth = 545.28;

      drawWatermark(doc, tmpl, logoBuf, null, 130, 260, 280);

      const endHeaderY = drawInternalSimpleHeader(doc, tmpl, center, logoBuf, 18, fullWidth, startX);

      const titleY = endHeaderY + 8;
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text(
        "PROCÈS-VERBAL OFFICIEL DE NOTES DE COURS",
        startX, titleY, { width: fullWidth, align: "center", underline: true }
      );

      const boxY = titleY + 16;
      doc.rect(startX, boxY, fullWidth, 34).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold");
      doc.text(`Classe : ${offering.classeLabel}`, startX + 10, boxY + 6);
      doc.text(`Matière : [${offering.subjectCode || "—"}] ${offering.subjectName} (Coef ${offering.coefficient})`, startX + 180, boxY + 6);
      doc.text(`Période : ${offering.semesterLabel}`, startX + 380, boxY + 6);

      doc.text(`Groupe : ${offering.categoryName || "Général"}`, startX + 10, boxY + 19);
      doc.text(`Formateur : ${offering.formateurName || "Non assigné"}`, startX + 180, boxY + 19);
      doc.text(`Taux de réussite : ${stats.successRate || "0"}%`, startX + 380, boxY + 19);

      let y = boxY + 40;
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
        if (y > 690) {
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
      doc.text(
        `Inscrits : ${stats.total || 0}  •  Évalués : ${stats.evaluated || 0}  •  Validés (≥10) : ${stats.passed || 0}  •  Ajournés : ${stats.failed || 0}  •  Moyenne : ${stats.classAverage || "—"} / 20`,
        startX + 10, y + 5.5
      );

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-PV", { margin: 0, width: 75 });
      renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, [
        { title: "Le Formateur Responsable", roleKey: "formateur" },
        { title: center.directorTitle || "Le Directeur Général", roleKey: "directeur" },
      ], 706, fullWidth, startX);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 3. PROCÈS-VERBAL DE DÉLIBÉRATION (PV_SEMESTRE / PV_ANNUEL - A4 Paysage)
 * Avec détection exacte de la décision (vert émeraude pour ADMIS/VALIDÉ/DIPLÔMÉ, rouge pour AJOURNÉ/REDOUBLE)
 */
async function generateClassSemesterSummaryPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: 16, bottom: 18, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, classe = {}, offerings = [], summaries = [], periodLabel = "Semestre", templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const primaryColor = tmpl?.primaryColor || "#071A2E";

      const startX = 25;
      const fullWidth = 791.89;

      drawWatermark(doc, tmpl, logoBuf, null, 250, 130, 300);

      const endHeaderY = drawInternalSimpleHeader(doc, tmpl, center, logoBuf, 14, fullWidth, startX);

      const titleY = endHeaderY + 5;
      doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Bold").text(
        `GRILLE OFFICIELLE DE DÉLIBÉRATION (${periodLabel.toUpperCase()}) • CLASSE : ${(classe.label || "").toUpperCase()} • FILIÈRE : ${(classe.filiereName || "").toUpperCase()}`,
        startX, titleY, { width: fullWidth, align: "center", underline: true }
      );

      let y = titleY + 15;
      const colMatriculeW = 65;
      const colNameW = 140;
      const colSummaryW = 120;
      const availWidth = fullWidth - (colMatriculeW + colNameW + colSummaryW);
      const colSubW = offerings.length > 0 ? availWidth / offerings.length : 40;

      doc.rect(startX, y, fullWidth, 19).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(6.5).font("Helvetica-Bold");
      doc.text("Matricule", startX + 5, y + 5, { width: colMatriculeW });
      doc.text("Nom & Prénom de l'Apprenant", startX + 5 + colMatriculeW, y + 5, { width: colNameW });

      offerings.forEach((off, idx) => {
        const ox = startX + 5 + colMatriculeW + colNameW + idx * colSubW;
        doc.text(`${off.subject?.code || off.subject?.name?.substring(0, 5)}\n(C${off.coefficient})`, ox, y + 2.5, { width: colSubW, align: "center" });
      });

      const sx = startX + 5 + colMatriculeW + colNameW + offerings.length * colSubW;
      doc.text("Moyenne", sx, y + 5, { width: 45, align: "center" });
      doc.text("Rang", sx + 45, y + 5, { width: 30, align: "center" });
      doc.text("Décision", sx + 75, y + 5, { width: 45, align: "center" });

      y += 19;

      summaries.forEach((row) => {
        if (y > 450) {
          doc.addPage({ size: "A4", layout: "landscape", margins: { top: 16, bottom: 18, left: 25, right: 25 } });
          y = 25;
        }

        doc.rect(startX, y, fullWidth, 14).strokeColor("#CBD5E1").stroke();
        doc.fillColor("#0F172A").fontSize(6).font("Helvetica");
        doc.font("Helvetica-Bold").text(row.student.matricule, startX + 5, y + 3.5, { width: colMatriculeW });
        doc.font("Helvetica").text(`${row.student.lastName} ${row.student.firstName}`, startX + 5 + colMatriculeW, y + 3.5, { width: colNameW, truncate: true });

        offerings.forEach((off, sidx) => {
          const ox = startX + 5 + colMatriculeW + colNameW + sidx * colSubW;
          const subRes = row.subjects.find((s) => s.subjectId === off.subjectId);
          doc.text(subRes && subRes.finalGrade !== null ? String(subRes.finalGrade) : "—", ox, y + 3.5, { width: colSubW, align: "center" });
        });

        doc.font("Helvetica-Bold").text(row.semesterAverage !== null ? String(row.semesterAverage) : "—", sx, y + 3.5, { width: 45, align: "center" });
        doc.font("Helvetica").text(row.rank ? `${row.rank}e` : "—", sx + 45, y + 3.5, { width: 30, align: "center" });

        // GESTION EXACTE DE LA COULEUR DE LA DÉCISION (INSENSIBLE À LA CASSE)
        const decInfo = parseJuryDecision(row.decision);
        doc.font("Helvetica-Bold").fillColor(decInfo.color).text(decInfo.label, sx + 75, y + 3.5, { width: 45, align: "center" });

        y += 14;
      });

      y += 5;

      // Calcul intègre du nombre d'admis dans le récapitulatif
      const evaluatedRows = summaries.filter((s) => s.semesterAverage !== null);
      const passedCount = evaluatedRows.filter((s) => parseJuryDecision(s.decision).isPassed).length;
      const successRate = evaluatedRows.length > 0 ? ((passedCount / evaluatedRows.length) * 100).toFixed(1) : "0";

      // Bloc Récapitulatif
      doc.rect(startX, y, fullWidth, 17).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(6.8).font("Helvetica-Bold");
      doc.text(
        `BILAN DE CLASSE : ${summaries.length} Élève(s)  •  ${evaluatedRows.length} Évalué(s)  •  ${passedCount} Validé(s)  •  ${evaluatedRows.length - passedCount} Ajourné(s)  •  Taux de réussite : ${successRate}%`,
        startX + 10, y + 5
      );
      y += 21;

      // Légende des matières au bas du document
      if (offerings && offerings.length > 0) {
        doc.rect(startX, y, fullWidth, 24).fillAndStroke("#FFFFFF", "#CBD5E1");
        doc.fillColor(primaryColor).fontSize(6).font("Helvetica-Bold").text("LÉGENDE DES CODES & DISCIPLINES ENSEIGNÉES :", startX + 6, y + 3.5);

        const legendPairs = offerings.map((o) => {
          const codeStr = o.subject?.code ? `[${o.subject.code}]` : `[${o.subject?.name?.substring(0, 5)}]`;
          return `${codeStr} : ${(o.subject?.name || "Matière")} (Coef ${o.coefficient})`;
        });

        doc.fillColor("#334155").fontSize(5.6).font("Helvetica").text(
          legendPairs.join("   •   "),
          startX + 6, y + 12, { width: fullWidth - 12, truncate: true }
        );
      }

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 4. PROCÈS-VERBAL DU CONTRÔLE CONTINU (PV_CC - A4 Paysage)
 */
async function generateClassContinuousAssessmentSummaryPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: 16, bottom: 18, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, classe = {}, offerings = [], summaries = [], periodLabel = "Contrôle Continu", templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const primaryColor = tmpl?.primaryColor || "#071A2E";

      const startX = 25;
      const fullWidth = 791.89;

      drawWatermark(doc, tmpl, logoBuf, null, 250, 130, 300);

      const endHeaderY = drawInternalSimpleHeader(doc, tmpl, center, logoBuf, 14, fullWidth, startX);

      const titleY = endHeaderY + 5;
      doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Bold").text(
        `PROCÈS-VERBAL DU CONTRÔLE CONTINU (CC & TP) • CLASSE : ${(classe.label || "").toUpperCase()} • ${periodLabel.toUpperCase()}`,
        startX, titleY, { width: fullWidth, align: "center", underline: true }
      );

      let y = titleY + 15;
      const colMatriculeW = 65;
      const colNameW = 140;
      const colSummaryW = 100;
      const availWidth = fullWidth - (colMatriculeW + colNameW + colSummaryW);
      const colSubW = offerings.length > 0 ? availWidth / offerings.length : 40;

      doc.rect(startX, y, fullWidth, 19).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(6.5).font("Helvetica-Bold");
      doc.text("Matricule", startX + 5, y + 5, { width: colMatriculeW });
      doc.text("Nom & Prénom de l'Apprenant", startX + 5 + colMatriculeW, y + 5, { width: colNameW });

      offerings.forEach((off, idx) => {
        const ox = startX + 5 + colMatriculeW + colNameW + idx * colSubW;
        doc.text(`${off.subject?.code || off.subject?.name?.substring(0, 5)}\n(C${off.coefficient})`, ox, y + 2.5, { width: colSubW, align: "center" });
      });

      const sx = startX + 5 + colMatriculeW + colNameW + offerings.length * colSubW;
      doc.text("Moy. CC", sx, y + 5, { width: 50, align: "center" });
      doc.text("Rang CC", sx + 50, y + 5, { width: 50, align: "center" });

      y += 19;

      summaries.forEach((row) => {
        if (y > 450) {
          doc.addPage({ size: "A4", layout: "landscape", margins: { top: 16, bottom: 18, left: 25, right: 25 } });
          y = 25;
        }

        doc.rect(startX, y, fullWidth, 14).strokeColor("#CBD5E1").stroke();
        doc.fillColor("#0F172A").fontSize(6).font("Helvetica");
        doc.font("Helvetica-Bold").text(row.student.matricule, startX + 5, y + 3.5, { width: colMatriculeW });
        doc.font("Helvetica").text(`${row.student.lastName} ${row.student.firstName}`, startX + 5 + colMatriculeW, y + 3.5, { width: colNameW, truncate: true });

        offerings.forEach((off, sidx) => {
          const ox = startX + 5 + colMatriculeW + colNameW + sidx * colSubW;
          const subRes = row.subjects.find((s) => s.subjectId === off.subjectId);
          doc.text(subRes && subRes.ccAverage !== null && subRes.ccAverage !== undefined ? String(subRes.ccAverage) : "—", ox, y + 3.5, { width: colSubW, align: "center" });
        });

        doc.font("Helvetica-Bold").text(row.ccAverage !== null && row.ccAverage !== undefined ? String(row.ccAverage) : "—", sx, y + 3.5, { width: 50, align: "center" });
        doc.font("Helvetica").text(row.rank ? `${row.rank}e` : "—", sx + 50, y + 3.5, { width: 50, align: "center" });

        y += 14;
      });

      y += 5;

      if (offerings && offerings.length > 0) {
        doc.rect(startX, y, fullWidth, 24).fillAndStroke("#FFFFFF", "#CBD5E1");
        doc.fillColor(primaryColor).fontSize(6).font("Helvetica-Bold").text("LÉGENDE DES CODES & DISCIPLINES ENSEIGNÉES :", startX + 6, y + 3.5);

        const legendPairs = offerings.map((o) => {
          const codeStr = o.subject?.code ? `[${o.subject.code}]` : `[${o.subject?.name?.substring(0, 5)}]`;
          return `${codeStr} : ${(o.subject?.name || "Matière")} (Coef ${o.coefficient})`;
        });

        doc.fillColor("#334155").fontSize(5.6).font("Helvetica").text(
          legendPairs.join("   •   "),
          startX + 6, y + 12, { width: fullWidth - 12, truncate: true }
        );
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
  generateBlankGradeSheetPdf,
  generateCertifiedGradeSheetPdf,
  generateClassSemesterSummaryPdf,
  generateClassContinuousAssessmentSummaryPdf,
};