// packages/backend/src/services/pdf/modules/diplomasPdf.js
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { bufferFromDataUrl, safeDrawImage, resolveDocumentTextureBuffer } = require("../common/pdfHelpers");

function resolveScriptFontPath() {
  const candidateDirs = [
    path.join(__dirname, "../../../../assets"),
    path.join(__dirname, "../../../../../desktop/assets"),
    path.join(process.cwd(), "assets"),
    path.join(process.cwd(), "packages/backend/assets"),
    path.join(process.cwd(), "packages/desktop/assets"),
    ...(process.resourcesPath ? [
      path.join(process.resourcesPath, "backend/assets"),
      path.join(process.resourcesPath, "assets"),
      path.join(process.resourcesPath, "desktop/assets"),
      path.join(process.resourcesPath, "app.asar.unpacked/assets"),
      path.join(process.resourcesPath, "app.asar.unpacked/backend/assets"),
    ] : []),
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      const p = path.join(dir, "PinyonScript-Regular.ttf");
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function drawFallbackRibbonAndMedal(doc) {
  const ribbonX = 68;
  const ribbonW = 95;

  doc.save();

  doc.rect(22, 22, 841.89 - 44, 595.28 - 44).lineWidth(1.2).strokeColor("#071A2E").stroke();
  doc.rect(26, 26, 841.89 - 52, 595.28 - 52).lineWidth(0.5).strokeColor("#D4AF37").stroke();

  doc.rect(ribbonX, 22, ribbonW, 595.28 - 44).fill("#071A2E");
  doc.rect(ribbonX + 5, 22, 1.5, 595.28 - 44).fill("#0B2742");
  doc.rect(ribbonX + ribbonW - 6.5, 22, 1.5, 595.28 - 44).fill("#0B2742");

  const ribbonBottomY = 595.28 - 22;
  doc.polygon(
    [ribbonX, ribbonBottomY],
    [ribbonX + ribbonW / 2, ribbonBottomY - 26],
    [ribbonX + ribbonW, ribbonBottomY],
    [ribbonX + ribbonW, ribbonBottomY - 10],
    [ribbonX, ribbonBottomY - 10]
  ).fill("#071A2E");

  const medalCenterX = ribbonX + ribbonW / 2;
  const medalCenterY = 275;
  const medalRadius = 60;

  doc.circle(medalCenterX, medalCenterY, medalRadius + 4).fillAndStroke("#E2E8F0", "#94A3B8");
  doc.circle(medalCenterX, medalCenterY, medalRadius).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.circle(medalCenterX, medalCenterY, medalRadius - 8).lineWidth(1).strokeColor("#94A3B8").stroke();

  doc.fillColor("#071A2E");
  doc.polygon(
    [medalCenterX, medalCenterY - 15],
    [medalCenterX + 25, medalCenterY - 3],
    [medalCenterX, medalCenterY + 9],
    [medalCenterX - 25, medalCenterY - 3]
  ).fill();
  doc.rect(medalCenterX - 11, medalCenterY + 6, 22, 7).roundedRect(medalCenterX - 11, medalCenterY + 6, 22, 7, 2).fill();

  doc.restore();
}

function drawCursiveSignatureStroke(doc, x, y) {
  doc.save();
  doc.lineWidth(1.2).strokeColor("#0B1C30");
  doc.moveTo(x - 35, y + 10)
    .bezierCurveTo(x - 20, y - 25, x - 10, y + 20, x + 5, y - 10)
    .bezierCurveTo(x + 15, y - 28, x + 30, y - 5, x + 40, y + 8)
    .bezierCurveTo(x + 50, y + 18, x - 10, y + 14, x + 60, y + 12)
    .stroke();
  doc.restore();
}

function renderSingleGraduationDiplomaPage(doc, snapshot) {
  const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const primaryColor = tmpl.primaryColor || "#071A2E";
  const accentColor = tmpl.accentColor || "#007799";

  const pageWidth = 841.89;
  const pageHeight = 595.28;

  const fontPath = resolveScriptFontPath();
  let hasScriptFont = false;
  if (fontPath) {
    try {
      doc.registerFont("ScriptAttestation", fontPath);
      hasScriptFont = true;
    } catch (err) {
      console.warn("[DiplomasPdf] Impossible d'enregistrer PinyonScript :", err.message);
    }
  }

  // Résolution du fond officiel attestation_bg.jpg
  const bgBuf =
    bufferFromDataUrl(center.diplomaBgDataUrl) ||
    resolveDocumentTextureBuffer(center.id, "diploma", tmpl);

  // RÈGLE MÉTIER STRICTE : L'image d'attestation porte les décorations, elle est TOUJOURS à 100% d'opacité nette
  if (bgBuf) {
    doc.save();
    doc.opacity(1.0);
    safeDrawImage(doc, bgBuf, 0, 0, { width: pageWidth, height: pageHeight });
    doc.restore();
  } else {
    drawFallbackRibbonAndMedal(doc);
  }

  const startX = 220;
  const contentWidth = 565;
  const centerX = startX + contentWidth / 2;

  const logoY = 40;
  const logoSize = 46;
  if (logoBuf) {
    safeDrawImage(doc, logoBuf, centerX - logoSize / 2, logoY, {
      fit: [logoSize, logoSize],
      align: "center",
      valign: "center",
    });
  }

  const nameY = logoY + logoSize + 8;
  const centerNameText = (center.name || "CENTRE DE FORMATION PROFESSIONNELLE").toUpperCase();
  doc.fillColor(primaryColor).fontSize(10.5).font("Helvetica-Bold");

  const nameTextW = doc.widthOfString(centerNameText);
  doc.text(centerNameText, startX, nameY, { width: contentWidth, align: "center" });

  const linePad = 14;
  const leftLineEnd = centerX - nameTextW / 2 - linePad;
  const rightLineStart = centerX + nameTextW / 2 + linePad;
  const lineY = nameY + 6.5;

  doc.moveTo(startX + 45, lineY).lineTo(leftLineEnd, lineY).lineWidth(0.8).strokeColor("#CBD5E1").stroke();
  doc.moveTo(rightLineStart, lineY).lineTo(startX + contentWidth - 45, lineY).lineWidth(0.8).strokeColor("#CBD5E1").stroke();

  const titleY = nameY + 22;
  doc.fillColor(primaryColor).fontSize(28).font("Helvetica-Bold").text(
    (tmpl.documentTitle || "ATTESTATION DE FIN DE FORMATION").toUpperCase(),
    startX, titleY, { width: contentWidth, align: "center", characterSpacing: 1.2 }
  );

  const subTitleY = titleY + 28;
  doc.fillColor(accentColor).fontSize(12).font("Helvetica-Bold").text(
    (tmpl.subTitle || "CERTIFICAT DE RÉUSSITE").toUpperCase(),
    startX, subTitleY, { width: contentWidth, align: "center", characterSpacing: 2.8 }
  );

  doc.rect(centerX - 24, subTitleY + 18, 48, 2.5).fill(accentColor);

  const introY = subTitleY + 32;
  doc.fillColor("#334155").fontSize(13.5).font("Times-Italic").text(
    "Nous certifions que",
    startX, introY, { width: contentWidth, align: "center" }
  );

  const studentY = introY + 21;
  const formatTitleCase = (str) =>
    (str || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const lastName = formatTitleCase(student.lastName);
  const firstNames = formatTitleCase(student.firstName).split(" ").filter(Boolean);
  let fullName = `${lastName} ${firstNames.join(" ")}`.trim();

  if (hasScriptFont) {
    doc.font("ScriptAttestation").fontSize(40);
    if (doc.widthOfString(fullName) > contentWidth && firstNames.length > 1) {
      const mainFirstName = firstNames[0];
      const abbreviatedOthers = firstNames.slice(1).map((n) => `.${n.charAt(0)}`).join(" ");
      fullName = `${lastName} ${mainFirstName}, ${abbreviatedOthers}`.trim();
    }
  } else {
    doc.font("Helvetica-Bold").fontSize(22);
  }

  doc.fillColor(primaryColor).text(
    fullName,
    startX,
    studentY,
    { width: contentWidth, align: "center", lineBreak: false }
  );

  const detailsY = studentY + 50;
  const birthStr = student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—";
  const birthLine = `Né(e) le ${birthStr}${student.birthPlace ? ` à ${student.birthPlace.toUpperCase()}` : ""}`;
  doc.fillColor("#64748B").fontSize(8.5).font("Helvetica").text(
    birthLine,
    startX, detailsY, { width: contentWidth, align: "center" }
  );

  const successY = detailsY + 17;
  doc.fillColor("#334155").fontSize(13).font("Times-Italic").text(
    "a suivi avec succès la formation",
    startX, successY, { width: contentWidth, align: "center" }
  );

  const trainingY = successY + 20;
  const trainingName = (classe.filiereName || "Formation Professionnelle").toUpperCase();
  doc.fillColor(primaryColor).fontSize(20).font("Helvetica-Bold").text(
    trainingName,
    startX, trainingY, { width: contentWidth, align: "center" }
  );

  const durationY = trainingY + 30;
  const qualificationStr = `${classe.programTypeCode || "DQP"} (Niveau ${classe.niveauOrder || 1})`;
  const durationText = tmpl.trainingDuration || `Durée : ${classe.durationInYears || 1} an(s) (Session ${classe.academicYearLabel || "2026-2027"}) • ${qualificationStr}`;

  doc.fillColor("#475569").fontSize(10).font("Helvetica-Bold");
  const durTextW = doc.widthOfString(durationText);
  doc.text(durationText, startX, durationY, { width: contentWidth, align: "center" });

  const durLineY = durationY + 6;
  const durLineLeftEnd = centerX - durTextW / 2 - 14;
  const durLineRightStart = centerX + durTextW / 2 + 14;
  doc.moveTo(startX + 55, durLineY).lineTo(durLineLeftEnd, durLineY).lineWidth(0.8).strokeColor("#CBD5E1").stroke();
  doc.moveTo(durLineRightStart, durLineY).lineTo(startX + contentWidth - 55, durLineY).lineWidth(0.8).strokeColor("#CBD5E1").stroke();

  const dateY = durationY + 26;
  doc.fillColor("#0F172A").fontSize(10).font("Helvetica").text(
    `Fait à ${center.city || "Bafoussam"}, le ${new Date().toLocaleDateString("fr-FR")}`,
    startX, dateY, { width: contentWidth, align: "center" }
  );

  const sigY = dateY + 20;
  const chosenRoleKey = tmpl.signatoryRoleKey || "directeur";
  const sigBuf = bufferFromDataUrl(center.signatures?.[chosenRoleKey] || center.signatures?.directeur);

  const sigBoxW = 180;
  const sigBoxX = centerX - sigBoxW / 2;

  if (sigBuf) {
    safeDrawImage(doc, sigBuf, centerX - 55, sigY - 2, { fit: [110, 42], align: "center" });
  } else {
    drawCursiveSignatureStroke(doc, centerX, sigY + 18);
  }

  doc.moveTo(sigBoxX, sigY + 44).lineTo(sigBoxX + sigBoxW, sigY + 44).lineWidth(1).strokeColor("#0F172A").stroke();

  const signatoryLabel = tmpl.signatoryTitle || center.directorTitle || "Le Directeur Général";
  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica-Bold").text(
    signatoryLabel,
    startX, sigY + 48, { width: contentWidth, align: "center" }
  );

  if (center.directorName) {
    doc.fillColor("#64748B").fontSize(8).font("Helvetica").text(
      center.directorName,
      startX, sigY + 61, { width: contentWidth, align: "center" }
    );
  }

  const bottomY = pageHeight - 44;
  const certNumber = snapshot.certificateNumber || student.matricule || "ATT-2026-001";
  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text(
    `N° ATTESTATION : ${certNumber}`,
    startX + 14, bottomY
  );

  doc.fillColor("#64748B").fontSize(8).font("Helvetica").text(
    `Agrément MINEFOP : ${center.registrationNumber || "Autorisé"} • Registre CECO ERP`,
    startX, bottomY, { width: contentWidth - 14, align: "right" }
  );
}

async function generateGraduationDiplomaPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      renderSingleGraduationDiplomaPage(doc, snapshot);

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
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", layout: "landscape", margins: { top: 0, bottom: 0, left: 0, right: 0 } });
        renderSingleGraduationDiplomaPage(doc, snapshotsList[i]);
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