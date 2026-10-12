// packages/backend/src/services/pdf/modules/mockExamsPdf.js
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { drawRegionalMinefopHeader } = require("../common/pdfHeaders");

function renderSingleMockExamPage(doc, snapshot) {
  const {
    center = {},
    exam = {},
    epreuves = [],
    candidates = [],
    templateConfig: tmpl = {},
    isBlank = false,
  } = snapshot;

  const isLandscape = epreuves.length > 4;
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;

  const startX = 22;
  const fullWidth = pageWidth - (startX * 2);

  // 1. En-tête Régional Officiel MINEFOP
  drawRegionalMinefopHeader(doc, tmpl, center, 20, fullWidth, startX);

  // 2. Bandeau Grisé Supérieur
  const sessionYear = exam.academicYearLabel ? exam.academicYearLabel.split("-")[0] : new Date().getFullYear();
  const examTitle = (tmpl.examBannerTitle || `EXAMEN REGIONAL DU DQP BLANC, SESSION DE ${sessionYear}`).toUpperCase();

  const bannerY = 120;
  doc.rect(startX + 12, bannerY, fullWidth - 24, 18).fill("#D1D5DB");
  doc.fillColor("#000000").fontSize(11).font("Helvetica-Bold").text(examTitle, startX + 12, bannerY + 4, {
    width: fullWidth - 24,
    align: "center",
  });

  // 3. Cadre Rectangulaire
  const frameTitle = isBlank
    ? "BORDEREAU DE DÉLIBÉRATION MANUSCRITE (CASES VIERGES)"
    : (tmpl.examFrameTitle || "BORDEREAU DES NOTES DES CANDIDATS");

  const frameY = bannerY + 24;
  doc.rect(startX + 8, frameY, fullWidth - 16, 22).lineWidth(1.5).strokeColor("#000000").stroke();
  doc.fillColor("#000000").fontSize(13).font("Helvetica-Bold").text(frameTitle, startX + 8, frameY + 5.5, {
    width: fullWidth - 16,
    align: "center",
  });

  // 4. Cartouche d'Identification Métier
  const infoY = frameY + 30;
  const centerName = (center.name || "CEFOPIA").toUpperCase();
  const specialityName = (exam.filiereName || "GRAPHISME DE PRODUCTION").toUpperCase();
  const entryLevel = (exam.entryLevel || "BEPC / NIVEAU 3EME").toUpperCase();

  doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold");
  doc.text(`CENTRE DE FORMATION / TRAINING CENTER : `, startX, infoY, { align: "center", continued: true });
  doc.text(centerName, { underline: true });

  doc.text(`SPECIALITE / SPECIALITY: `, startX, infoY + 14, { align: "center", continued: true });
  doc.text(specialityName, { underline: true });

  doc.text(`NIVEAU D'ENTRÉE / LEVEL OF ENTRY: `, startX, infoY + 28, { align: "center", continued: true });
  doc.text(entryLevel, { underline: true });

  // 5. Tableau Matriciel des Épreuves et Notes
  let tableY = infoY + 46;

  const colNoW = 24;
  const colNameW = isLandscape ? 165 : 125;
  const colBirthDateW = 60;
  const colBirthPlaceW = isLandscape ? 90 : 70;
  const colMoyenneW = 55;

  const fixedWidthSum = colNoW + colNameW + colBirthDateW + colBirthPlaceW + colMoyenneW;
  const availableForEpreuves = fullWidth - fixedWidthSum;
  const numEpreuves = Math.max(1, epreuves.length);
  const singleEpreuveTotalW = availableForEpreuves / numEpreuves;
  const subColNoteW = singleEpreuveTotalW / 2;
  const subColPtsW = singleEpreuveTotalW / 2;

  const headerH1 = 14;
  const headerH2 = 12;
  const totalHeaderH = headerH1 + headerH2;

  doc.rect(startX, tableY, fullWidth, totalHeaderH).fillAndStroke("#D1D5DB", "#000000");

  doc.fillColor("#000000").fontSize(7).font("Helvetica-Bold");
  doc.text("N°", startX, tableY + 8, { width: colNoW, align: "center" });

  doc.fontSize(6).text("NOMS ET PRENOMS DU CANDIDAT\nCANDIDATE'S NAMES AND FIRST NAMES", startX + colNoW + 2, tableY + 3, {
    width: colNameW - 4,
    align: "center",
  });

  doc.text("DATE DE NAISSANCE\nDATE OF BIRTH", startX + colNoW + colNameW, tableY + 5, {
    width: colBirthDateW,
    align: "center",
  });

  doc.text("LIEU DE NAISSANCE\nPLACE OF BIRTH", startX + colNoW + colNameW + colBirthDateW, tableY + 5, {
    width: colBirthPlaceW,
    align: "center",
  });

  let currentX = startX + colNoW + colNameW + colBirthDateW + colBirthPlaceW;

  epreuves.forEach((ep) => {
    doc.rect(currentX, tableY, singleEpreuveTotalW, headerH1).fillAndStroke("#D1D5DB", "#000000");
    doc.fillColor("#000000").fontSize(6.5).font("Helvetica-Bold").text(
      `${(ep.code || ep.name).toUpperCase()} - COEF : ${String(ep.coefficient).padStart(2, "0")}`,
      currentX, tableY + 3.5, { width: singleEpreuveTotalW, align: "center" }
    );

    doc.rect(currentX, tableY + headerH1, subColNoteW, headerH2).fillAndStroke("#E5E7EB", "#000000");
    doc.text("NOTE/20", currentX, tableY + headerH1 + 3, { width: subColNoteW, align: "center" });

    doc.rect(currentX + subColNoteW, tableY + headerH1, subColPtsW, headerH2).fillAndStroke("#E5E7EB", "#000000");
    doc.text("N*COEF", currentX + subColNoteW, tableY + headerH1 + 3, { width: subColPtsW, align: "center" });

    currentX += singleEpreuveTotalW;
  });

  doc.rect(currentX, tableY, colMoyenneW, totalHeaderH).fillAndStroke("#D1D5DB", "#000000");
  doc.fillColor("#000000").fontSize(6.5).font("Helvetica-Bold").text(
    "MOYENNE\nFINALE / 20",
    currentX, tableY + 5, { width: colMoyenneW, align: "center" }
  );

  doc.moveTo(startX + colNoW, tableY).lineTo(startX + colNoW, tableY + totalHeaderH).stroke();
  doc.moveTo(startX + colNoW + colNameW, tableY).lineTo(startX + colNoW + colNameW, tableY + totalHeaderH).stroke();
  doc.moveTo(startX + colNoW + colNameW + colBirthDateW, tableY).lineTo(startX + colNoW + colNameW, tableY + totalHeaderH).stroke();
  doc.moveTo(startX + colNoW + colNameW + colBirthDateW + colBirthPlaceW, tableY).lineTo(startX + colNoW + colNameW + colBirthDateW + colBirthPlaceW, tableY + totalHeaderH).stroke();

  tableY += totalHeaderH;

  const rowHeight = 28;

  candidates.forEach((cand, idx) => {
    if (tableY + rowHeight > pageHeight - 75) {
      doc.addPage({ size: "A4", layout: isLandscape ? "landscape" : "portrait", margins: { top: 20, bottom: 20, left: 22, right: 22 } });
      tableY = 30;
    }

    doc.rect(startX, tableY, fullWidth, rowHeight).lineWidth(0.8).strokeColor("#000000").stroke();

    doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
    doc.text(String(idx + 1), startX, tableY + 9, { width: colNoW, align: "center" });

    doc.fontSize(7.5).font("Helvetica-Bold").text(
      (cand.fullName || "").toUpperCase(),
      startX + colNoW + 4, tableY + 5,
      { width: colNameW - 8, align: "center", lineGap: 1.5 }
    );

    const birthDateStr = cand.birthDate ? new Date(cand.birthDate).toLocaleDateString("fr-FR") : "—";
    doc.fontSize(8).font("Helvetica-Bold").text(birthDateStr, startX + colNoW + colNameW, tableY + 9, {
      width: colBirthDateW,
      align: "center",
    });

    doc.fontSize(7).font("Helvetica-Bold").text((cand.birthPlace || "—").toUpperCase(), startX + colNoW + colNameW + colBirthDateW + 2, tableY + 6, {
      width: colBirthPlaceW - 4,
      align: "center",
    });

    let epX = startX + colNoW + colNameW + colBirthDateW + colBirthPlaceW;

    epreuves.forEach((ep) => {
      let scoreDisplay = "";
      let pointsDisplay = "";

      if (!isBlank) {
        const g = (cand.grades || []).find((gr) => gr.epreuveId === ep.id);
        const isAbsent = g?.isAbsent || g?.score === "M" || g?.score === "ABS";
        scoreDisplay = isAbsent ? "M" : (g && g.score !== null && g.score !== undefined ? String(g.score) : "—");

        if (isAbsent) {
          pointsDisplay = "M";
        } else if (g && g.score !== null && !isNaN(parseFloat(g.score))) {
          pointsDisplay = (parseFloat(g.score) * ep.coefficient).toFixed(2);
          if (pointsDisplay.endsWith(".00")) pointsDisplay = String(parseFloat(pointsDisplay));
        } else {
          pointsDisplay = "—";
        }
      }

      doc.rect(epX, tableY, subColNoteW, rowHeight).stroke();
      if (!isBlank) {
        const isM = scoreDisplay === "M";
        doc.fillColor(isM ? "#C73B3B" : "#000000").fontSize(8).font("Helvetica-Bold").text(scoreDisplay, epX, tableY + 9, { width: subColNoteW, align: "center" });
      }

      doc.rect(epX + subColNoteW, tableY, subColPtsW, rowHeight).stroke();
      if (!isBlank) {
        const isM = pointsDisplay === "M";
        doc.fillColor(isM ? "#C73B3B" : "#000000").fontSize(8).font("Helvetica-Bold").text(pointsDisplay, epX + subColNoteW, tableY + 9, { width: subColPtsW, align: "center" });
      }

      epX += singleEpreuveTotalW;
    });

    doc.rect(epX, tableY, colMoyenneW, rowHeight).stroke();
    if (!isBlank) {
      const avgNum = parseFloat(cand.average);
      const finalAvgText = !isNaN(avgNum) ? avgNum.toFixed(2) : "—";
      doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold").text(finalAvgText, epX, tableY + 9, { width: colMoyenneW, align: "center" });
    }

    doc.moveTo(startX + colNoW, tableY).lineTo(startX + colNoW, tableY + rowHeight).stroke();
    doc.moveTo(startX + colNoW + colNameW, tableY).lineTo(startX + colNoW + colNameW, tableY + rowHeight).stroke();
    doc.moveTo(startX + colNoW + colNameW + colBirthDateW, tableY).lineTo(startX + colNoW + colNameW, tableY + rowHeight).stroke();
    doc.moveTo(startX + colNoW + colNameW + colBirthDateW + colBirthPlaceW, tableY).lineTo(startX + colNoW + colNameW + colBirthDateW + colBirthPlaceW, tableY + rowHeight).stroke();

    tableY += rowHeight;
  });

  // 6. Pied de Page Réglementaire MINEFOP (SANS QR CODE)
  const footerY = Math.max(tableY + 30, pageHeight - 55);
  doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text(
    tmpl.signatoryTitle || "LE DELEGUE DEPARTEMENTAL",
    startX + fullWidth - 250,
    footerY,
    { width: 240, align: "center", underline: true }
  );
}

/**
 * Génère le Bordereau des Notes MINEFOP officiel d'une classe
 */
async function generateOfficialMockExamBorderauPdf(snapshot, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const isLandscape = (snapshot.epreuves || []).length > 4;
      const doc = new PDFDocument({
        size: "A4",
        layout: isLandscape ? "landscape" : "portrait",
        margins: { top: 20, bottom: 20, left: 22, right: 22 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      renderSingleMockExamPage(doc, snapshot);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Compile le Recueil Unique de TOUTES les classes candidates de la session en un seul PDF A4
 */
async function generateSessionBundleMockExamPdf(classesSnapshots, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const firstIsLandscape = (classesSnapshots[0]?.epreuves || []).length > 4;
      const doc = new PDFDocument({
        size: "A4",
        layout: firstIsLandscape ? "landscape" : "portrait",
        margins: { top: 20, bottom: 20, left: 22, right: 22 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      classesSnapshots.forEach((snap, idx) => {
        const isLandscape = (snap.epreuves || []).length > 4;
        if (idx > 0) {
          doc.addPage({
            size: "A4",
            layout: isLandscape ? "landscape" : "portrait",
            margins: { top: 20, bottom: 20, left: 22, right: 22 },
          });
        }
        renderSingleMockExamPage(doc, snap);
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
 * Génère la Fiche de Notation & d'Émargement par Épreuve (A4 Portrait)
 */
async function generateExaminerGradeSheetPdf(snapshot, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const {
        center = {},
        exam = {},
        epreuve = {},
        candidates = [],
        templateConfig: tmpl = {},
      } = snapshot;

      const doc = new PDFDocument({
        size: "A4",
        layout: "portrait",
        margins: { top: 22, bottom: 22, left: 25, right: 25 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const startX = 25;
      const fullWidth = 545.28;

      drawRegionalMinefopHeader(doc, tmpl, center, 20, fullWidth, startX);

      const sessionYear = exam.academicYearLabel ? exam.academicYearLabel.split("-")[0] : new Date().getFullYear();
      doc.rect(startX + 10, 118, fullWidth - 20, 18).fill("#D1D5DB");
      doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text(
        `EXAMEN REGIONAL DU DQP BLANC, SESSION DE ${sessionYear}`,
        startX + 10, 122.5, { width: fullWidth - 20, align: "center" }
      );

      doc.rect(startX + 6, 142, fullWidth - 12, 22).lineWidth(1.5).strokeColor("#000000").stroke();
      doc.fillColor("#000000").fontSize(12).font("Helvetica-Bold").text(
        "FICHE DE NOTATION & D'ÉMARGEMENT PAR ÉPREUVE",
        startX + 6, 147.5, { width: fullWidth - 12, align: "center" }
      );

      const boxY = 172;
      doc.rect(startX, boxY, fullWidth, 48).lineWidth(1).strokeColor("#000000").stroke();

      doc.fillColor("#000000").fontSize(8.5).font("Helvetica-Bold");
      doc.text(`Établissement : ${(center.name || "CEFOPIA").toUpperCase()}`, startX + 10, boxY + 6);
      doc.text(`Filière / Spécialité : ${(exam.filiereName || "—").toUpperCase()}`, startX + 270, boxY + 6);

      doc.text(`Épreuve : ${(epreuve.name || "Épreuve").toUpperCase()} [${(epreuve.code || "").toUpperCase()}]`, startX + 10, boxY + 20);
      doc.text(`Coefficient : ${String(epreuve.coefficient).padStart(2, "0")}  •  Barème : / 20`, startX + 270, boxY + 20);

      doc.text("Nom & Prénom de l'Examinateur / Correcteur : _______________________________________________", startX + 10, boxY + 34);

      let tableY = boxY + 58;
      const rowHeight = 24;

      const colNoW = 24;
      const colMatriculeW = 85;
      const colNameW = 190;
      const colEmargementW = 75;
      const colNoteW = 65;
      const colObsW = fullWidth - (colNoW + colMatriculeW + colNameW + colEmargementW + colNoteW);

      doc.rect(startX, tableY, fullWidth, 18).fillAndStroke("#D1D5DB", "#000000");
      doc.fillColor("#000000").fontSize(7.5).font("Helvetica-Bold");
      doc.text("N°", startX, tableY + 5.5, { width: colNoW, align: "center" });
      doc.text("Matricule", startX + colNoW + 4, tableY + 5.5, { width: colMatriculeW - 8 });
      doc.text("Noms et Prénoms du Candidat", startX + colNoW + colMatriculeW + 4, tableY + 5.5, { width: colNameW - 8 });
      doc.text("Émargement", startX + colNoW + colMatriculeW + colNameW, tableY + 5.5, { width: colEmargementW, align: "center" });
      doc.text("NOTE / 20", startX + colNoW + colMatriculeW + colNameW + colEmargementW, tableY + 5.5, { width: colNoteW, align: "center" });
      doc.text("Observations", startX + fullWidth - colObsW, tableY + 5.5, { width: colObsW, align: "center" });

      tableY += 18;

      candidates.forEach((cand, idx) => {
        if (tableY + rowHeight > 780) {
          doc.addPage({ size: "A4", layout: "portrait", margins: { top: 25, bottom: 25, left: 25, right: 25 } });
          tableY = 35;
        }

        doc.rect(startX, tableY, fullWidth, rowHeight).lineWidth(0.8).strokeColor("#000000").stroke();

        doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
        doc.text(String(idx + 1), startX, tableY + 8, { width: colNoW, align: "center" });
        doc.font("Courier-Bold").text(cand.matricule || "—", startX + colNoW + 4, tableY + 8, { width: colMatriculeW - 8 });
        doc.font("Helvetica-Bold").text((cand.fullName || "").toUpperCase(), startX + colNoW + colMatriculeW + 4, tableY + 8, { width: colNameW - 8, truncate: true });

        doc.rect(startX + colNoW + colMatriculeW + colNameW, tableY, colEmargementW, rowHeight).stroke();
        doc.rect(startX + colNoW + colMatriculeW + colNameW + colEmargementW, tableY, colNoteW, rowHeight).stroke();
        doc.rect(startX + fullWidth - colObsW, tableY, colObsW, rowHeight).stroke();

        tableY += rowHeight;
      });

      const footerY = Math.max(tableY + 16, 760);

      doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
      doc.text(`Total Candidats : ${candidates.length}    •    Présents : _____    •    Absents (M) : _____`, startX + 10, footerY);

      doc.text("Date & Signature de l'Examinateur :", startX + fullWidth - 230, footerY, { width: 220, align: "center" });
      doc.text("___________________________________", startX + fullWidth - 230, footerY + 28, { width: 220, align: "center" });

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Compile toutes les fiches d'émargement d'une classe en un seul PDF multipages
 */
async function generateBatchExaminerGradeSheetsPdf(snapshotsList, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "portrait",
        margins: { top: 22, bottom: 22, left: 25, right: 25 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", layout: "portrait", margins: { top: 22, bottom: 22, left: 25, right: 25 } });

        const snap = snapshotsList[i];
        const { center = {}, exam = {}, epreuve = {}, candidates = [], templateConfig: tmpl = {} } = snap;

        const startX = 25;
        const fullWidth = 545.28;

        drawRegionalMinefopHeader(doc, tmpl, center, 20, fullWidth, startX);

        const sessionYear = exam.academicYearLabel ? exam.academicYearLabel.split("-")[0] : new Date().getFullYear();
        doc.rect(startX + 10, 118, fullWidth - 20, 18).fill("#D1D5DB");
        doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text(
          `EXAMEN REGIONAL DU DQP BLANC, SESSION DE ${sessionYear}`,
          startX + 10, 122.5, { width: fullWidth - 20, align: "center" }
        );

        doc.rect(startX + 6, 142, fullWidth - 12, 22).lineWidth(1.5).strokeColor("#000000").stroke();
        doc.fillColor("#000000").fontSize(12).font("Helvetica-Bold").text(
          "FICHE DE NOTATION & D'ÉMARGEMENT PAR ÉPREUVE",
          startX + 6, 147.5, { width: fullWidth - 12, align: "center" }
        );

        const boxY = 172;
        doc.rect(startX, boxY, fullWidth, 48).lineWidth(1).strokeColor("#000000").stroke();
        doc.fillColor("#000000").fontSize(8.5).font("Helvetica-Bold");
        doc.text(`Établissement : ${(center.name || "CEFOPIA").toUpperCase()}`, startX + 10, boxY + 6);
        doc.text(`Filière / Spécialité : ${(exam.filiereName || "—").toUpperCase()}`, startX + 270, boxY + 6);
        doc.text(`Épreuve : ${(epreuve.name || "Épreuve").toUpperCase()} [${(epreuve.code || "").toUpperCase()}]`, startX + 10, boxY + 20);
        doc.text(`Coefficient : ${String(epreuve.coefficient).padStart(2, "0")}  •  Barème : / 20`, startX + 270, boxY + 20);
        doc.text("Nom & Prénom de l'Examinateur : _______________________________________________", startX + 10, boxY + 34);

        let tableY = boxY + 58;
        const rowHeight = 24;

        const colNoW = 24;
        const colMatriculeW = 85;
        const colNameW = 190;
        const colEmargementW = 75;
        const colNoteW = 65;
        const colObsW = fullWidth - (colNoW + colMatriculeW + colNameW + colEmargementW + colNoteW);

        doc.rect(startX, tableY, fullWidth, 18).fillAndStroke("#D1D5DB", "#000000");
        doc.fillColor("#000000").fontSize(7.5).font("Helvetica-Bold");
        doc.text("N°", startX, tableY + 5.5, { width: colNoW, align: "center" });
        doc.text("Matricule", startX + colNoW + 4, tableY + 5.5, { width: colMatriculeW - 8 });
        doc.text("Noms et Prénoms du Candidat", startX + colNoW + colMatriculeW + 4, tableY + 5.5, { width: colNameW - 8 });
        doc.text("Émargement", startX + colNoW + colMatriculeW + colNameW, tableY + 5.5, { width: colEmargementW, align: "center" });
        doc.text("NOTE / 20", startX + colNoW + colMatriculeW + colNameW + colEmargementW, tableY + 5.5, { width: colNoteW, align: "center" });
        doc.text("Observations", startX + fullWidth - colObsW, tableY + 5.5, { width: colObsW, align: "center" });

        tableY += 18;

        candidates.forEach((cand, idx) => {
          if (tableY + rowHeight > 780) {
            doc.addPage({ size: "A4", layout: "portrait", margins: { top: 25, bottom: 25, left: 25, right: 25 } });
            tableY = 35;
          }

          doc.rect(startX, tableY, fullWidth, rowHeight).lineWidth(0.8).strokeColor("#000000").stroke();
          doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
          doc.text(String(idx + 1), startX, tableY + 8, { width: colNoW, align: "center" });
          doc.font("Courier-Bold").text(cand.matricule || "—", startX + colNoW + 4, tableY + 8, { width: colMatriculeW - 8 });
          doc.font("Helvetica-Bold").text((cand.fullName || "").toUpperCase(), startX + colNoW + colMatriculeW + 4, tableY + 8, { width: colNameW - 8, truncate: true });

          doc.rect(startX + colNoW + colMatriculeW + colNameW, tableY, colEmargementW, rowHeight).stroke();
          doc.rect(startX + colNoW + colMatriculeW + colNameW + colEmargementW, tableY, colNoteW, rowHeight).stroke();
          doc.rect(startX + fullWidth - colObsW, tableY, colObsW, rowHeight).stroke();

          tableY += rowHeight;
        });

        const footerY = Math.max(tableY + 16, 760);
        doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
        doc.text(`Total Candidats : ${candidates.length}   •   Présents : _____   •   Absents (M) : _____`, startX + 10, footerY);
        doc.text("Date & Signature de l'Examinateur :", startX + fullWidth - 230, footerY, { width: 220, align: "center" });
        doc.text("___________________________________", startX + fullWidth - 230, footerY + 28, { width: 220, align: "center" });
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
  generateOfficialMockExamBorderauPdf,
  generateSessionBundleMockExamPdf,
  generateExaminerGradeSheetPdf,
  generateBatchExaminerGradeSheetsPdf,
};