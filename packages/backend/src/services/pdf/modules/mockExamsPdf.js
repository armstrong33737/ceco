// packages/backend/src/services/pdf/modules/mockExamsPdf.js
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { drawRegionalMinefopHeader } = require("../common/pdfHeaders");

/**
 * Rendu d'une page de bordereau d'examen blanc officiel MINEFOP
 */
function renderSingleMockExamPage(doc, snapshot) {
  const {
    center = {},
    exam = {},
    epreuves = [],
    candidates = [],
    templateConfig: tmpl = {},
    isBlank = false,
  } = snapshot;

  const isLandscape = (epreuves || []).length >= 5;
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;

  const startX = 22;
  const fullWidth = pageWidth - (startX * 2);

  // 1. En-tête Régional (La fonction retourne dynamiquement le bas de l'en-tête)
  const endHeaderY = drawRegionalMinefopHeader(doc, tmpl, center, 20, fullWidth, startX);

  // 2. Bandeau Grisé Supérieur (Espacement aéré)
  const sessionYear = exam.academicYearLabel ? exam.academicYearLabel.split("-")[0] : new Date().getFullYear();
  const examTitle = (tmpl.examBannerTitle || `EXAMEN REGIONAL DU DQP BLANC, SESSION DE ${sessionYear}`).toUpperCase();

  const bannerY = endHeaderY + 12;
  doc.rect(startX + 10, bannerY, fullWidth - 20, 18).fillAndStroke("#D1D5DB", "#9CA3AF");
  doc.fillColor("#000000").fontSize(10.5).font("Helvetica-Bold").text(examTitle, startX + 10, bannerY + 4, {
    width: fullWidth - 20,
    align: "center",
  });

  // 3. Cadre Intitulé Fermé (Aéré de +30 pt par rapport au bandeau)
  const frameTitle = isBlank
    ? "BORDEREAU DE DÉLIBÉRATION MANUSCRITE (CASES VIERGES)"
    : (tmpl.examFrameTitle || "BORDEREAU DES NOTES DES CANDIDATS");

  const frameY = bannerY + 30;
  doc.rect(startX + 8, frameY, fullWidth - 16, 22).lineWidth(1.5).strokeColor("#000000").stroke();
  doc.fillColor("#000000").fontSize(12.5).font("Helvetica-Bold").text(frameTitle, startX + 8, frameY + 5.5, {
    width: fullWidth - 16,
    align: "center",
  });

  // 4. Cartouche d'Identification Métier (Aéré de +35 pt par rapport au cadre)
  const infoY = frameY + 35;
  const centerName = (center.name || "CEFOPIA").toUpperCase();
  const specialityName = (exam.filiereName || "GRAPHISME DE PRODUCTION").toUpperCase();
  const entryLevel = (exam.entryLevel || "BEPC / NIVEAU 3EME").toUpperCase();

  const drawCenteredInfoLine = (label, value, y) => {
    doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold");
    const labelW = doc.widthOfString(label);
    const valueW = doc.widthOfString(value);
    const totalW = labelW + valueW;
    const lineX = startX + Math.max(0, (fullWidth - totalW) / 2);

    doc.text(label, lineX, y, { continued: true });
    doc.text(value, { underline: true });
  };

  drawCenteredInfoLine("CENTRE DE FORMATION / TRAINING CENTER : ", centerName, infoY);
  drawCenteredInfoLine("SPECIALITE / SPECIALITY : ", specialityName, infoY + 16);
  drawCenteredInfoLine("NIVEAU D'ENTRÉE / LEVEL OF ENTRY : ", entryLevel, infoY + 32);

  // 5. Tableau Matriciel des Épreuves et Notes (Aéré de +55 pt)
  let tableY = infoY + 55;

  const colNoW = 24;
  const colNameW = isLandscape ? 165 : 135;
  const colBirthDateW = 60;
  const colBirthPlaceW = isLandscape ? 90 : 75;
  const colMoyenneW = isLandscape ? 60 : 55;

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
    // Bandeau nom d'épreuve et coef
    doc.rect(currentX, tableY, singleEpreuveTotalW, headerH1).fillAndStroke("#D1D5DB", "#000000");
    doc.fillColor("#000000").fontSize(6.5).font("Helvetica-Bold").text(
      `${(ep.code || ep.name).toUpperCase()} - COEF : ${String(ep.coefficient).padStart(2, "0")}`,
      currentX, tableY + 3.5, { width: singleEpreuveTotalW, align: "center" }
    );

    // Sous-colonne NOTE/20 : mise en exergue avec la couleur d'en-tête (#D1D5DB) et texte noir forcé
    doc.rect(currentX, tableY + headerH1, subColNoteW, headerH2).fillAndStroke("#D1D5DB", "#000000");
    doc.fillColor("#000000").fontSize(6).font("Helvetica-Bold").text("NOTE/20", currentX, tableY + headerH1 + 3, {
      width: subColNoteW,
      align: "center",
    });

    // Sous-colonne N*COEF : fond gris clair (#E5E7EB) et texte noir forcé
    doc.rect(currentX + subColNoteW, tableY + headerH1, subColPtsW, headerH2).fillAndStroke("#E5E7EB", "#000000");
    doc.fillColor("#000000").fontSize(6).font("Helvetica-Bold").text("N*COEF", currentX + subColNoteW, tableY + headerH1 + 3, {
      width: subColPtsW,
      align: "center",
    });

    currentX += singleEpreuveTotalW;
  });

  // Colonne MOYENNE FINALE
  doc.rect(currentX, tableY, colMoyenneW, totalHeaderH).fillAndStroke("#D1D5DB", "#000000");
  doc.fillColor("#000000").fontSize(6.5).font("Helvetica-Bold").text(
    "MOYENNE\nFINALE / 20",
    currentX, tableY + 5, { width: colMoyenneW, align: "center" }
  );

  doc.moveTo(startX + colNoW, tableY).lineTo(startX + colNoW, tableY + totalHeaderH).stroke();
  doc.moveTo(startX + colNoW + colNameW, tableY).lineTo(startX + colNoW + colNameW, tableY + totalHeaderH).stroke();
  doc.moveTo(startX + colNoW + colNameW + colBirthDateW, tableY).lineTo(startX + colNoW + colNameW + colBirthDateW, tableY + totalHeaderH).stroke();
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

      // Colonne NOTE mise en exergue avec la couleur d'en-tête (#F3F4F6) et 'M' toujours en noir
      doc.rect(epX, tableY, subColNoteW, rowHeight).fillAndStroke("#F3F4F6", "#000000");
      if (!isBlank) {
        doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold").text(scoreDisplay, epX, tableY + 9, { width: subColNoteW, align: "center" });
      }

      // Colonne Points N*COEF (M également en noir)
      doc.rect(epX + subColNoteW, tableY, subColPtsW, rowHeight).stroke();
      if (!isBlank) {
        doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold").text(pointsDisplay, epX + subColNoteW, tableY + 9, { width: subColPtsW, align: "center" });
      }

      epX += singleEpreuveTotalW;
    });

    // Colonne Moyenne finale mise en exergue (#E5E7EB)
    doc.rect(epX, tableY, colMoyenneW, rowHeight).fillAndStroke("#E5E7EB", "#000000");
    if (!isBlank) {
      const avgNum = parseFloat(cand.average);
      const finalAvgText = !isNaN(avgNum) ? avgNum.toFixed(2) : "—";
      doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold").text(finalAvgText, epX, tableY + 9, { width: colMoyenneW, align: "center" });
    }

    doc.moveTo(startX + colNoW, tableY).lineTo(startX + colNoW, tableY + rowHeight).stroke();
    doc.moveTo(startX + colNoW + colNameW, tableY).lineTo(startX + colNoW + colNameW, tableY + rowHeight).stroke();
    doc.moveTo(startX + colNoW + colNameW + colBirthDateW, tableY).lineTo(startX + colNoW + colNameW + colBirthDateW, tableY + rowHeight).stroke();
    doc.moveTo(startX + colNoW + colNameW + colBirthDateW + colBirthPlaceW, tableY).lineTo(startX + colNoW + colNameW + colBirthDateW + colBirthPlaceW, tableY + rowHeight).stroke();

    tableY += rowHeight;
  });

  // Zone de signature dynamique et aérée (rehaussée par rapport au bord bas)
  const maxFooterY = pageHeight - 95;
  let footerY;

  if (tableY + 30 + 45 > pageHeight - 20) {
    doc.addPage({ size: "A4", layout: isLandscape ? "landscape" : "portrait", margins: { top: 20, bottom: 20, left: 22, right: 22 } });
    footerY = 40;
  } else {
    // Si peu d'enregistrements, la signature suit dynamiquement le tableau sans être collée au fond
    footerY = Math.min(tableY + 30, maxFooterY);
  }

  doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text(
    tmpl.signatoryTitle || "LE DELEGUE DEPARTEMENTAL",
    startX + fullWidth - 250,
    footerY,
    { width: 240, align: "center", underline: true }
  );
}

async function generateOfficialMockExamBorderauPdf(snapshot, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const isLandscape = (snapshot.epreuves || []).length >= 5;
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

async function generateSessionBundleMockExamPdf(classesSnapshots, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const firstIsLandscape = (classesSnapshots[0]?.epreuves || []).length >= 5;
      const doc = new PDFDocument({
        size: "A4",
        layout: firstIsLandscape ? "landscape" : "portrait",
        margins: { top: 20, bottom: 20, left: 22, right: 22 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      classesSnapshots.forEach((snap, idx) => {
        const isLandscape = (snap.epreuves || []).length >= 5;
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

      const endHeaderY = drawRegionalMinefopHeader(doc, tmpl, center, 20, fullWidth, startX);

      const sessionYear = exam.academicYearLabel ? exam.academicYearLabel.split("-")[0] : new Date().getFullYear();
      const bannerY = endHeaderY + 10;
      doc.rect(startX + 10, bannerY, fullWidth - 20, 18).fill("#D1D5DB");
      doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text(
        `EXAMEN REGIONAL DU DQP BLANC, SESSION DE ${sessionYear}`,
        startX + 10, bannerY + 4.5, { width: fullWidth - 20, align: "center" }
      );

      const frameY = bannerY + 28;
      doc.rect(startX + 6, frameY, fullWidth - 12, 22).lineWidth(1.5).strokeColor("#000000").stroke();
      doc.fillColor("#000000").fontSize(12).font("Helvetica-Bold").text(
        "FICHE DE NOTATION & D'ÉMARGEMENT PAR ÉPREUVE",
        startX + 6, frameY + 5.5, { width: fullWidth - 12, align: "center" }
      );

      const boxY = frameY + 35;
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
        // Colonne NOTE mise en exergue avec la couleur d'en-tête (#F3F4F6)
        doc.rect(startX + colNoW + colMatriculeW + colNameW + colEmargementW, tableY, colNoteW, rowHeight).fillAndStroke("#F3F4F6", "#000000");
        doc.rect(startX + fullWidth - colObsW, tableY, colObsW, rowHeight).stroke();

        tableY += rowHeight;
      });

      // Zone signature dynamique
      const footerY = Math.min(tableY + 25, 750);

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

        const endHeaderY = drawRegionalMinefopHeader(doc, tmpl, center, 20, fullWidth, startX);

        const sessionYear = exam.academicYearLabel ? exam.academicYearLabel.split("-")[0] : new Date().getFullYear();
        const bannerY = endHeaderY + 10;
        doc.rect(startX + 10, bannerY, fullWidth - 20, 18).fill("#D1D5DB");
        doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text(
          `EXAMEN REGIONAL DU DQP BLANC, SESSION DE ${sessionYear}`,
          startX + 10, bannerY + 4.5, { width: fullWidth - 20, align: "center" }
        );

        const frameY = bannerY + 28;
        doc.rect(startX + 6, frameY, fullWidth - 12, 22).lineWidth(1.5).strokeColor("#000000").stroke();
        doc.fillColor("#000000").fontSize(12).font("Helvetica-Bold").text(
          "FICHE DE NOTATION & D'ÉMARGEMENT PAR ÉPREUVE",
          startX + 6, frameY + 5.5, { width: fullWidth - 12, align: "center" }
        );

        const boxY = frameY + 35;
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
          // Colonne NOTE mise en exergue avec la couleur d'en-tête (#F3F4F6)
          doc.rect(startX + colNoW + colMatriculeW + colNameW + colEmargementW, tableY, colNoteW, rowHeight).fillAndStroke("#F3F4F6", "#000000");
          doc.rect(startX + fullWidth - colObsW, tableY, colObsW, rowHeight).stroke();

          tableY += rowHeight;
        });

        // Zone signature dynamique
        const footerY = Math.min(tableY + 25, 750);
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