// packages/backend/src/services/pdf/modules/attestationsPdf.js
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { bufferFromDataUrl, safeDrawImage } = require("../common/pdfHelpers");
const { drawInternalSimpleHeader } = require("../common/pdfHeaders");
const { drawStudentAvatar } = require("../common/pdfGraphics");

/**
 * En-tête bilingue officiel pour certificat de scolarité
 */
function drawAttestationBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, startY = 25, customWidth = 531.28, startX = 32) {
  const primaryColor = tmpl?.primaryColor || "#071A2E";
  const headerLeft = tmpl?.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE";
  const headerRight = tmpl?.headerRight || "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING";

  const colSideWidth = 188;
  const colCenterWidth = customWidth - (colSideWidth * 2);
  const centerColX = startX + colSideWidth;
  const rightColX = startX + customWidth - colSideWidth;

  doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold").text(headerLeft, startX, startY, {
    width: colSideWidth,
    align: "center",
    lineGap: 1.5,
  });

  doc.text(headerRight, rightColX, startY, {
    width: colSideWidth,
    align: "center",
    lineGap: 1.5,
  });

  const headerMode = tmpl?.headerMode || "logo";
  const showLogo = headerMode === "logo" || headerMode === "both";
  const showSeal = headerMode === "seal" || headerMode === "both";

  const hasLogo = showLogo && Boolean(logoBuf);
  const hasSeal = showSeal && Boolean(sealBuf);

  if (hasLogo && hasSeal) {
    const imgSize = 38;
    const gap = 8;
    const totalW = (imgSize * 2) + gap;
    const imgStartX = centerColX + (colCenterWidth - totalW) / 2;
    safeDrawImage(doc, sealBuf, imgStartX, startY - 2, { fit: [imgSize, imgSize], align: "center" });
    safeDrawImage(doc, logoBuf, imgStartX + imgSize + gap, startY - 2, { fit: [imgSize, imgSize], align: "center" });
  } else if (hasLogo || hasSeal) {
    const activeBuf = hasLogo ? logoBuf : sealBuf;
    const imgSize = 46;
    const imgStartX = centerColX + (colCenterWidth - imgSize) / 2;
    safeDrawImage(doc, activeBuf, imgStartX, startY - 3, { fit: [imgSize, imgSize], align: "center" });
  }

  const nameY = startY + 56;
  doc.fillColor(primaryColor).fontSize(13.5).font("Helvetica-Bold").text(
    (center.name || "CENTRE DE FORMATION PROFESSIONNELLE").toUpperCase(),
    startX, nameY, { width: customWidth, align: "center" }
  );

  const accredY = nameY + 18;
  doc.fillColor("#334155").fontSize(8.5).font("Helvetica-Bold").text(
    `ARRÊTÉ D'AGRÉMENT MINEFOP : ${center.registrationNumber || "Autorisé / En cours"} • VILLE : ${(center.city || "Cameroun").toUpperCase()}`,
    startX, accredY, { width: customWidth, align: "center" }
  );

  const contactsLine = `Tél : ${center.phone || "Non renseigné"}  •  Email : ${center.email || "Non renseigné"}${center.address ? `  •  ${center.address}` : ""}`;
  doc.fillColor("#64748B").fontSize(8).font("Helvetica").text(
    contactsLine,
    startX, accredY + 13, { width: customWidth, align: "center", truncate: true }
  );

  const sepY = accredY + 26;
  doc.moveTo(startX, sepY).lineTo(startX + customWidth, sepY).lineWidth(1.2).strokeColor(primaryColor).stroke();
  doc.moveTo(startX, sepY + 2).lineTo(startX + customWidth, sepY + 2).lineWidth(0.5).strokeColor("#D4AF37").stroke();

  return sepY + 8;
}

/**
 * DOCUMENT 03 : CERTIFICAT DE SCOLARITÉ & D'INSCRIPTION (SANS QR CODE)
 */
function renderSingleAttestationPage(doc, snapshot) {
  const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#071A2E";

  const startX = 32;
  const fullWidth = 531.28;

  if (tmpl.showWatermark !== false && logoBuf) {
    doc.save();
    doc.opacity(Number(tmpl.watermarkOpacity) || 0.05);
    safeDrawImage(doc, logoBuf, 140, 270, { width: 260, fit: [260, 260] });
    doc.restore();
  }

  const endHeaderY = drawAttestationBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 25, fullWidth, startX);

  const titleY = endHeaderY + 14;
  doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text(
    (tmpl.documentTitle || "CERTIFICAT DE SCOLARITÉ & D'INSCRIPTION").toUpperCase(),
    startX, titleY, { width: fullWidth, align: "center", characterSpacing: 0.8 }
  );

  const subTitleText = tmpl.subTitle || "ATTESTATION OF SCHOOL ATTENDANCE & ENROLMENT";
  doc.fillColor("#64748B").fontSize(8.5).font("Helvetica-Bold").text(
    subTitleText.toUpperCase(),
    startX, titleY + 18, { width: fullWidth, align: "center", characterSpacing: 0.5 }
  );

  const ruleW = 110;
  const ruleX = startX + (fullWidth - ruleW) / 2;
  doc.moveTo(ruleX, titleY + 31).lineTo(ruleX + ruleW, titleY + 31).lineWidth(1.2).strokeColor(primaryColor).stroke();

  const introY = titleY + 44;
  const cleanTitle = (center.directorTitle || "Directeur Général").replace(/^(le|la)\s+/i, "");

  let introSentence = "";
  if (center.directorName && center.directorName.trim()) {
    introSentence = `Je soussigné, ${center.directorName.trim()}, en qualité de ${cleanTitle} de l'établissement susmentionné, certifie par la présente que :`;
  } else {
    introSentence = `Je soussigné, le Directeur Général de l'établissement susmentionné, certifie par la présente que :`;
  }

  doc.fillColor("#0F172A").fontSize(10).font("Helvetica").text(
    introSentence,
    startX + 8, introY, { width: fullWidth - 16, lineGap: 3.5, align: "justify" }
  );

  const boxY = introY + 28;
  const boxH = 152;

  doc.rect(startX + 8, boxY, 3.5, boxH).fill(primaryColor);
  doc.rect(startX + 12, boxY, fullWidth - 20, boxH).fill("#F8FAFC");
  doc.rect(startX + 12, boxY, fullWidth - 20, boxH).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

  const photoSize = 76;
  const photoX = startX + fullWidth - photoSize - 22;
  const photoY = boxY + (boxH - photoSize) / 2;
  drawStudentAvatar(doc, photoBuf, photoX, photoY, photoSize, photoSize);

  let curY = boxY + 16;
  const labelX = startX + 24;
  const valueX = startX + 155;
  const textValW = fullWidth - photoSize - 188;
  const lineH = 20;

  const drawRow = (label, value, isPrimary = false, isMono = false) => {
    doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text(label, labelX, curY);
    if (isMono) {
      doc.fillColor(primaryColor).fontSize(9.5).font("Courier-Bold").text(value || "—", valueX, curY - 0.5, { width: textValW, truncate: true });
    } else {
      doc.fillColor(isPrimary ? primaryColor : "#0F172A").fontSize(isPrimary ? 10.5 : 9.5).font(isPrimary ? "Helvetica-Bold" : "Helvetica").text(
        value || "—",
        valueX, curY - 0.5, { width: textValW, truncate: true }
      );
    }
    curY += lineH;
  };

  drawRow("L'Apprenant(e) :", `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`, true);
  drawRow("Matricule Officiel :", student.matricule, false, true);

  const birthDateStr = student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "Non renseignée";
  const birthPlaceStr = student.birthPlace ? ` à ${student.birthPlace.toUpperCase()}` : "";
  drawRow("Né(e) le :", `${birthDateStr}${birthPlaceStr}`);

  drawRow("Filière d'Études :", `${classe.filiereName || "Formation Professionnelle"}`);
  drawRow("Cycle & Qualification :", `${classe.programTypeCode || "DQP"} (Niveau ${classe.niveauOrder || 1})`);
  drawRow("Session Académique :", `${classe.academicYearLabel || "2026-2027"} • ${classe.promotionLabel || "Promotion active"}`);

  const legalTextY = boxY + boxH + 28;
  const attestationBody = tmpl.attestationBodyText ||
    "Est régulièrement inscrit(e) au registre matricule de notre établissement et poursuit avec assiduité et régularité l'ensemble des enseignements théoriques, travaux dirigés et ateliers pratiques prescrits pour le compte de la session académique susmentionnée.";

  doc.fillColor("#0F172A").fontSize(10).font("Helvetica").text(
    attestationBody,
    startX + 8, legalTextY, { width: fullWidth - 16, lineGap: 4.5, align: "justify" }
  );

  doc.text(
    "En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.",
    startX + 8, legalTextY + 46, { width: fullWidth - 16, lineGap: 4 }
  );

  const cityDateY = legalTextY + 95;
  const cityDateText = `Fait à ${center.city || "Bafoussam"}, le ${new Date().toLocaleDateString("fr-FR")}`;

  doc.fillColor("#0F172A").fontSize(9).font("Helvetica").text(
    cityDateText,
    startX, cityDateY, { width: fullWidth - 10, align: "right" }
  );

  const sigStartY = cityDateY + 22;
  const signatories = tmpl.signatories && tmpl.signatories.length > 0 ? tmpl.signatories : [
    { title: center.directorTitle || "Le Directeur Général", roleKey: "directeur" },
  ];

  const sigCount = Math.max(1, signatories.length);
  const sigColW = (fullWidth - 20) / sigCount;

  signatories.forEach((sig, idx) => {
    const sx = startX + 10 + idx * sigColW;
    const roleKey = sig.roleKey || "directeur";
    const sigBuf = bufferFromDataUrl(center.signatures?.[roleKey] || center.signatures?.directeur);

    doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica-Bold").text(
      sig.title || "Le Directeur Général",
      sx, sigStartY, { width: sigColW - 10, align: "center" }
    );

    doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(
      "(Cachet officiel et signature)",
      sx, sigStartY + 13, { width: sigColW - 10, align: "center" }
    );

    const sigBoxW = 150;
    const sigBoxH = 58;
    const sigBoxX = sx + (sigColW - 10 - sigBoxW) / 2;
    doc.rect(sigBoxX, sigStartY + 27, sigBoxW, sigBoxH).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

    if (sigBuf) {
      safeDrawImage(doc, sigBuf, sigBoxX + (sigBoxW - 110) / 2, sigStartY + 31, { fit: [110, 50], align: "center" });
    }
  });

  const footerY = 795;
  doc.moveTo(startX, footerY).lineTo(startX + fullWidth, footerY).lineWidth(0.6).strokeColor("#CBD5E1").stroke();

  doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(
    tmpl.footerLegal || "Document officiel certifié conforme • Toute surcharge ou altération annule la validité du présent acte.",
    startX, footerY + 6, { width: fullWidth - 120 }
  );

  doc.fillColor(primaryColor).fontSize(7).font("Helvetica-Bold").text(
    "CECO SUITE ERP",
    startX + fullWidth - 110, footerY + 6, { width: 110, align: "right" }
  );
}

async function generateAttestationPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 25, bottom: 25, left: 32, right: 32 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      renderSingleAttestationPage(doc, snapshot);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function generateBatchAttestationsPdf(snapshotsList, qrPayloadsList, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 25, bottom: 25, left: 32, right: 32 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 25, bottom: 25, left: 32, right: 32 } });
        renderSingleAttestationPage(doc, snapshotsList[i]);
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
 * DOCUMENT 02 : FICHE D'INSCRIPTION AVEC EN-TÊTE INTERNE D'ÉTABLISSEMENT SIMPLE
 */
async function generateFicheInscriptionPdf(snapshot, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 26, bottom: 26, left: 32, right: 32 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const photoBuf = bufferFromDataUrl(student.photoDataUrl);
      const primaryColor = tmpl.primaryColor || "#071A2E";

      const startX = 32;
      const fullWidth = 531.28;

      if (tmpl.showWatermark !== false && logoBuf) {
        doc.save();
        doc.opacity(Number(tmpl.watermarkOpacity) || 0.05);
        safeDrawImage(doc, logoBuf, 140, 270, { width: 250, fit: [250, 250] });
        doc.restore();
      }

      // En-tête interne simple et professionnel (sans en-tête républicain)
      const endHeaderY = drawInternalSimpleHeader(doc, tmpl, center, logoBuf, 28, fullWidth, startX);

      const titleY = endHeaderY + 12;
      doc.fillColor(primaryColor).fontSize(12.5).font("Helvetica-Bold").text(
        (tmpl.documentTitle || "FICHE INDIVIDUELLE D'INSCRIPTION & D'ENGAGEMENT").toUpperCase(),
        startX, titleY, { width: fullWidth, align: "center", characterSpacing: 0.5 }
      );

      doc.fillColor("#64748B").fontSize(8.5).font("Helvetica-Bold").text(
        `SESSION ACADÉMIQUE : ${classe.academicYearLabel || "2026-2027"}  •  PROMOTION : ${classe.promotionLabel || "Cohorte d'entrée"}`,
        startX, titleY + 18, { width: fullWidth, align: "center" }
      );

      const drawSectionHeader = (title, y) => {
        doc.rect(startX, y, 3.5, 13).fill(primaryColor);
        doc.fillColor(primaryColor).fontSize(9.5).font("Helvetica-Bold").text(title.toUpperCase(), startX + 9, y + 1.5);
        doc.moveTo(startX + 9, y + 15).lineTo(startX + fullWidth, y + 15).lineWidth(0.5).strokeColor("#CBD5E1").stroke();
      };

      let curY = titleY + 42;
      drawSectionHeader("I. Identité Civile de l'Apprenant(e)", curY);

      const photoSize = 75;
      const photoX = startX + fullWidth - photoSize - 6;
      drawStudentAvatar(doc, photoBuf, photoX, curY + 24, photoSize, photoSize);

      const col1X = startX + 10;
      const col2X = startX + 130;
      const infoTextW = fullWidth - photoSize - 146;
      let fieldY = curY + 24;
      const lineH = 19;

      const drawField = (label, value, isBold = false) => {
        doc.fillColor("#64748B").fontSize(8.5).font("Helvetica-Bold").text(label, col1X, fieldY);
        doc.fillColor(isBold ? primaryColor : "#0F172A").fontSize(9.5).font(isBold ? "Helvetica-Bold" : "Helvetica").text(
          value || "—",
          col2X, fieldY, { width: infoTextW, truncate: true }
        );
        fieldY += lineH;
      };

      drawField("Nom de famille :", (student.lastName || "").toUpperCase(), true);
      drawField("Prénom(s) :", student.firstName || "", true);
      drawField("Matricule Officiel :", student.matricule || "Attribution en cours", true);

      const birthStr = `${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "Non renseignée"}${student.birthPlace ? ` à ${student.birthPlace.toUpperCase()}` : ""}`;
      drawField("Date & Lieu Naiss. :", birthStr);

      const genreStr = student.gender === "F" ? "Féminin" : "Masculin";
      drawField("Genre & Contact :", `${genreStr}  •  Tél : ${student.phone || "Non renseigné"}`);

      curY = 274;
      drawSectionHeader("II. Parent / Tuteur Légal & Diplôme d'Entrée", curY);

      fieldY = curY + 22;
      const w3 = (fullWidth - 20) / 3;
      const drawColumnBlock = (label, val, x, w) => {
        doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text(label, x, fieldY);
        doc.fillColor("#0F172A").fontSize(9).font("Helvetica").text(val || "Non renseigné", x, fieldY + 11, { width: w, truncate: true });
      };

      drawColumnBlock("Nom du Parent / Tuteur :", student.guardianName, startX + 10, w3);
      drawColumnBlock("Téléphone d'Urgence :", student.guardianPhone, startX + 10 + w3, w3);
      drawColumnBlock("Diplôme d'Entrée Présenté :", student.entryDiploma || "CEP / Entrée directe", startX + 10 + w3 * 2, w3);

      curY = 348;
      drawSectionHeader("III. Affectation Académique & Cycle Choisi", curY);

      fieldY = curY + 22;
      drawColumnBlock("Filière de Formation :", `${classe.filiereName || "—"}`, startX + 10, w3);
      drawColumnBlock("Qualification & Cycle :", `${classe.programTypeCode || "DQP"} (Niveau ${classe.niveauOrder || 1})`, startX + 10 + w3, w3);
      drawColumnBlock("Classe & Promotion :", `${classe.label || "—"}`, startX + 10 + w3 * 2, w3);

      curY = 422;
      drawSectionHeader("IV. Engagement Formel de l'Apprenant(e) & Règlement Intérieur", curY);

      const defaultEngagement = tmpl.engagementText ||
        "Je soussigné(e), déclare sur l'honneur l'exactitude des informations fournies et reconnais avoir pris pleine connaissance du règlement intérieur de l'établissement. Je m'engage formellement à faire preuve d'assiduité, de ponctualité, de probité et de respect envers le corps professoral et les équipements de formation tout au long de mon cycle d'apprentissage au sein du centre.";

      doc.rect(startX + 10, curY + 22, 2, 42).fill(primaryColor);
      doc.fillColor("#334155").fontSize(8.5).font("Helvetica").text(
        defaultEngagement,
        startX + 18, curY + 22, { width: fullWidth - 32, align: "justify", lineGap: 3 }
      );

      curY = 514;
      drawSectionHeader("V. Validation de l'Inscription & Émargements Bilatéraux", curY);

      const cityDateText = `Fait à ${center.city || "Bafoussam"}, le ${new Date().toLocaleDateString("fr-FR")}`;
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(
        cityDateText,
        startX, curY + 22, { width: fullWidth - 10, align: "right" }
      );

      const sigStartY = curY + 44;
      const signatories = tmpl.signatories && tmpl.signatories.length > 0 ? tmpl.signatories : [
        { title: "Signature de l'Apprenant(e) / Tuteur", roleKey: "student" },
        { title: "Visa & Cachet de la Direction", roleKey: "directeur" },
      ];

      const sigCount = Math.max(1, signatories.length);
      const sigColW = (fullWidth - 20) / sigCount;

      signatories.forEach((sig, idx) => {
        const sx = startX + 10 + idx * sigColW;
        const isDirector = sig.roleKey === "directeur" || sig.roleKey === "promoteur";
        const sigBuf = isDirector ? bufferFromDataUrl(center.signatures?.[sig.roleKey] || center.signatures?.directeur) : null;

        doc.fillColor("#0F172A").fontSize(9).font("Helvetica-Bold").text(
          sig.title,
          sx, sigStartY, { width: sigColW - 15, align: "center" }
        );

        if (!isDirector) {
          doc.fillColor("#64748B").fontSize(6.8).font("Helvetica").text(
            "(Précédée de la mention manuscrite 'Lu et approuvé')",
            sx, sigStartY + 12, { width: sigColW - 15, align: "center" }
          );
        } else {
          doc.fillColor("#64748B").fontSize(6.8).font("Helvetica").text(
            "(Cachet officiel et visa administratif)",
            sx, sigStartY + 12, { width: sigColW - 15, align: "center" }
          );
        }

        const boxSigW = 125;
        const boxSigH = 55;
        const boxSigX = sx + (sigColW - 15 - boxSigW) / 2;
        doc.rect(boxSigX, sigStartY + 25, boxSigW, boxSigH).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

        if (sigBuf) {
          safeDrawImage(doc, sigBuf, boxSigX + (boxSigW - 95) / 2, sigStartY + 29, { fit: [95, 45], align: "center" });
        }
      });

      const footerY = 795;
      doc.moveTo(startX, footerY).lineTo(startX + fullWidth, footerY).lineWidth(0.6).strokeColor("#CBD5E1").stroke();

      doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(
        tmpl.footerLegal || "Document officiel d'inscription académique conservé aux archives de l'établissement • Toute rature ou fausse déclaration annule la validité du présent acte.",
        startX, footerY + 6, { width: fullWidth - 120 }
      );

      doc.fillColor(primaryColor).fontSize(7).font("Helvetica-Bold").text(
        "CECO SUITE ERP",
        startX + fullWidth - 110, footerY + 6, { width: 110, align: "right" }
      );

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateAttestationPdf,
  generateBatchAttestationsPdf,
  generateFicheInscriptionPdf,
};