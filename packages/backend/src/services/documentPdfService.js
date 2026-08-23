// packages/backend/src/services/documentPdfService.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");

function bufferFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.includes(",")) return null;
  try {
    const base64 = dataUrl.split(",")[1];
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
}

function safeDrawImage(doc, imgBuf, x, y, options = {}) {
  if (!imgBuf) return false;
  try {
    doc.image(imgBuf, x, y, options);
    return true;
  } catch (err) {
    console.warn("[PDFService] Erreur rendu image :", err.message);
    return false;
  }
}

function drawWatermark(doc, tmpl, logoBuf, sealBuf, x, y, size) {
  if (tmpl?.showWatermark === false) return;
  const wmBuf = tmpl?.watermarkType === "seal" && sealBuf ? sealBuf : logoBuf;
  if (!wmBuf) return;

  doc.save();
  doc.opacity(Number(tmpl?.watermarkOpacity) || 0.06);
  safeDrawImage(doc, wmBuf, x, y, { width: size, fit: [size, size], align: "center", valign: "center" });
  doc.restore();
  doc.opacity(1.0);
}

function drawCropMarks(doc, x, y, w, h) {
  const markLen = 6;
  doc.save();
  doc.lineWidth(0.4).strokeColor("#94A3B8");

  doc.moveTo(x - markLen, y).lineTo(x, y).stroke();
  doc.moveTo(x, y - markLen).lineTo(x, y).stroke();

  doc.moveTo(x + w, y - markLen).lineTo(x + w, y).stroke();
  doc.moveTo(x + w, y).lineTo(x + w + markLen, y).stroke();

  doc.moveTo(x - markLen, y + h).lineTo(x, y + h).stroke();
  doc.moveTo(x, y + h).lineTo(x, y + h + markLen).stroke();

  doc.moveTo(x + w + markLen, y + h).lineTo(x + w, y + h).stroke();
  doc.moveTo(x + w, y + h).lineTo(x + w + markLen, y + h).stroke();

  doc.restore();
}

function renderSignatoryBlocks(doc, signatories = [], signatures = {}, startY = 460, customWidth = 525, startX = 35) {
  if (!Array.isArray(signatories) || signatories.length === 0) {
    signatories = [
      { title: "Le Directeur des Études", roleKey: "directeur_pedagogique" },
      { title: "Le Directeur Général", roleKey: "directeur" },
    ];
  }

  const count = signatories.length;
  const colWidth = customWidth / count;

  signatories.forEach((sig, idx) => {
    const colX = startX + idx * colWidth;
    const title = sig.title || "Le Signataire";
    const roleKey = sig.roleKey || "directeur";
    const sigBuf = bufferFromDataUrl(signatures[roleKey] || (idx === count - 1 ? signatures.directeur : null));

    doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold").text(title, colX, startY, {
      width: colWidth - 10,
      align: "center",
    });

    if (sigBuf) {
      safeDrawImage(doc, sigBuf, colX + (colWidth - 90) / 2, startY + 12, { fit: [90, 32], align: "center" });
    }
  });
}

function drawBilingualRepublicHeader(doc, tmpl, center, logoBuf, sealBuf, startY = 25) {
  const primaryColor = tmpl?.primaryColor || "#0B1C30";
  const headerLeft = tmpl?.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE";
  const headerRight = tmpl?.headerRight || "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING";

  doc.fillColor("#0F172A").fontSize(7).font("Helvetica-Bold").text(headerLeft, 35, startY, { width: 195, align: "center", lineGap: 1.2 });
  doc.text(headerRight, 365, startY, { width: 195, align: "center", lineGap: 1.2 });

  if (tmpl?.showLogo !== false && logoBuf) safeDrawImage(doc, logoBuf, 240, startY - 2, { fit: [46, 46], align: "center" });
  if (tmpl?.showSeal !== false && sealBuf) safeDrawImage(doc, sealBuf, 305, startY - 2, { fit: [46, 46], align: "center" });

  if (tmpl?.subHeaderCenter) {
    doc.fillColor("#475569").fontSize(6.5).font("Helvetica").text(tmpl.subHeaderCenter.toUpperCase(), 35, startY + 52, { width: 525, align: "center" });
  }

  doc.fillColor(primaryColor).fontSize(12).font("Helvetica-Bold").text((center.name || "CENTRE D'EXCELLENCE").toUpperCase(), 35, startY + 65, { width: 525, align: "center" });
  doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(
    `Agrément : ${center.registrationNumber || "MINEFOP"} • ${center.address || ""}, ${center.city || "Cameroun"} • Tél : ${center.phone || ""}`,
    35, startY + 79, { width: 525, align: "center" }
  );

  doc.moveTo(35, startY + 92).lineTo(560, startY + 92).lineWidth(1.2).strokeColor(primaryColor).stroke();
}

function drawDiplomaOrnamentalBorders(doc, width = 842, height = 595) {
  doc.save();
  // Cadre externe or / marine
  doc.rect(20, 20, width - 40, height - 40).lineWidth(2).strokeColor("#0B1C30").stroke();
  doc.rect(24, 24, width - 48, height - 48).lineWidth(0.8).strokeColor("#C39B52").stroke();
  doc.rect(28, 28, width - 56, height - 56).lineWidth(0.4).strokeColor("#0B1C30").stroke();

  // Coins ornementaux
  const cornerSize = 24;
  const corners = [
    { x: 28, y: 28 },
    { x: width - 28 - cornerSize, y: 28 },
    { x: 28, y: height - 28 - cornerSize },
    { x: width - 28 - cornerSize, y: height - 28 - cornerSize },
  ];

  corners.forEach((c) => {
    doc.rect(c.x, c.y, cornerSize, cornerSize).fillAndStroke("#F8F9FF", "#C39B52");
    doc.fillColor("#C39B52").fontSize(9).font("Helvetica-Bold").text("❖", c.x + 6, c.y + 6);
  });
  doc.restore();
}

// ============================================================================
// 1. CARTE D'APPRENANT INDIVIDUELLE (CR80)
// ============================================================================
async function generateStudentCardPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [243, 153],
        margins: { top: 6, bottom: 6, left: 8, right: 8 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const photoBuf = bufferFromDataUrl(student.photoDataUrl);
      const sigBuf = bufferFromDataUrl(center.signatures?.directeur);
      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-CARD", { margin: 0, width: 85 });

      const themeColor = tmpl.themeColor || "#0B1C30";
      const accentColor = tmpl.accentColor || "#5E72E4";

      // RECTO
      doc.rect(0, 0, 243, 153).fill("#FFFFFF");
      doc.rect(0, 0, 243, 28).fill(themeColor);

      drawWatermark(doc, tmpl, logoBuf, sealBuf, 75, 40, 95);

      if (tmpl.showLogo !== false && logoBuf) safeDrawImage(doc, logoBuf, 8, 4, { fit: [20, 20] });
      doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), 32, 6, { width: 175, truncate: true });
      doc.fillColor("#CBD5E1").fontSize(5.5).font("Helvetica-Bold").text(tmpl.cardTitle || "CARTE D'APPRENANT OFFICIELLE", 32, 16);
      if (tmpl.showSeal !== false && sealBuf) safeDrawImage(doc, sealBuf, 216, 4, { fit: [20, 20] });

      const photoX = 10;
      const photoY = 36;
      const photoW = 48;
      const photoH = 60;
      doc.rect(photoX - 1, photoY - 1, photoW + 2, photoH + 2).fillAndStroke("#F8FAFC", "#CBD5E1");
      if (!safeDrawImage(doc, photoBuf, photoX, photoY, { fit: [photoW, photoH], align: "center", valign: "center" })) {
        doc.fillColor("#64748B").fontSize(9).font("Helvetica-Bold").text(
          `${(student.lastName || "E").charAt(0)}${(student.firstName || "T").charAt(0)}`,
          photoX + 16, photoY + 24
        );
      }

      const ix = 66;
      let iy = 36;
      doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("NOM :", ix, iy);
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text((student.lastName || "").toUpperCase(), ix + 28, iy, { width: 145, truncate: true });

      iy += 10;
      doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("PRÉNOM :", ix, iy);
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(student.firstName || "", ix + 28, iy, { width: 145, truncate: true });

      iy += 10;
      doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("MATRICULE :", ix, iy);
      doc.fillColor(accentColor).fontSize(7).font("Helvetica-Bold").text(student.matricule || "—", ix + 28, iy);

      iy += 10;
      doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("FILIÈRE :", ix, iy);
      doc.fillColor("#0F172A").fontSize(6).font("Helvetica").text(classe.filiereName || "—", ix + 28, iy, { width: 145, truncate: true });

      iy += 9;
      doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("NIVEAU :", ix, iy);
      doc.fillColor("#0F172A").fontSize(6).font("Helvetica-Bold").text(`Niveau ${classe.niveauOrder || 1} (${classe.programTypeCode || "DQP"})`, ix + 28, iy);

      iy += 9;
      doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("COHORTE :", ix, iy);
      doc.fillColor("#0F172A").fontSize(6).font("Helvetica").text(classe.promotionLabel || classe.academicYearLabel || "—", ix + 28, iy);

      doc.rect(0, 137, 243, 16).fill("#F8FAFC");
      doc.rect(0, 137, 243, 0.5).stroke("#E2E8F0");
      doc.fillColor("#475569").fontSize(5).font("Helvetica").text(`Agrément : ${center.registrationNumber || "MINEFOP"}`, 8, 142);
      doc.fillColor(accentColor).fontSize(5.5).font("Helvetica-Bold").text("CECO ID-PASS", 195, 142);

      // VERSO
      doc.addPage({ size: [243, 153], margins: { top: 6, bottom: 6, left: 8, right: 8 } });
      doc.rect(0, 0, 243, 153).fill("#FFFFFF");

      drawWatermark(doc, tmpl, logoBuf, sealBuf, 75, 35, 95);

      doc.fillColor(themeColor).fontSize(6.5).font("Helvetica-Bold").text("CONDITIONS D'UTILISATION", 8, 8);
      doc.fillColor("#475569").fontSize(4.5).font("Helvetica").text(
        tmpl.termsOfUse || "Cette carte est strictement personnelle. Elle confère le statut d'apprenant au sein de l'établissement et doit être obligatoirement présentée lors de l'accès aux cours, ateliers et examens.",
        8, 18, { width: 227, lineGap: 1 }
      );

      doc.fillColor("#334155").fontSize(5).font("Helvetica-Bold").text(`Centre : ${center.phone || ""} • ${center.email || ""}`, 8, 38);
      doc.text(`Adresse : ${center.address || ""}, ${center.city || ""}`, 8, 46);

      safeDrawImage(doc, qrBuf, 8, 58, { width: 46, height: 46 });
      doc.fillColor("#64748B").fontSize(4.5).font("Helvetica-Bold").text("Contrôle d'authenticité :", 58, 62);
      doc.fillColor(accentColor).fontSize(4.5).font("Courier").text(snapshot.qrToken || "CECO-OFFICIAL", 58, 70, { width: 175 });

      if (sigBuf) safeDrawImage(doc, sigBuf, 160, 80, { fit: [65, 24], align: "center" });
      doc.fillColor("#0F172A").fontSize(5.5).font("Helvetica-Bold").text(tmpl.signatoryTitle || center.directorTitle || "Le Directeur Général", 150, 108, { width: 85, align: "center" });

      doc.rect(0, 132, 243, 21).fill("#0B1C30");
      doc.fillColor("#94A3B8").fontSize(4.5).font("Helvetica").text("Propriété exclusive de l'établissement. En cas de perte, merci de rapporter à la direction.", 8, 138, { width: 155 });
      doc.fillColor("#FFFFFF").fontSize(6).font("Helvetica-Bold").text("PROPULSÉ PAR CECO", 175, 140);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================================
// 2. PLANCHE A4 DUPLEX DE BADGES AVEC REPÈRES DE COUPE
// ============================================================================
async function generateBatchCardsSheetPdf(snapshotsList, qrPayloadsList, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
        autoFirstPage: true,
      });

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

        if (p > 0) doc.addPage({ size: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 } });

        // PLANCHE RECTO
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
          doc.rect(x, y, cardW, 28).fill(tmpl.themeColor || "#0B1C30");

          if (tmpl.showLogo !== false && logoBuf) safeDrawImage(doc, logoBuf, x + 8, y + 4, { fit: [20, 20] });
          doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold").text((snap.center.name || "").toUpperCase(), x + 32, y + 6, { width: 190, truncate: true });
          doc.fillColor("#CBD5E1").fontSize(5.5).font("Helvetica-Bold").text(tmpl.cardTitle || "CARTE D'APPRENANT OFFICIELLE", x + 32, y + 16);
          if (tmpl.showSeal !== false && sealBuf) safeDrawImage(doc, sealBuf, x + 228, y + 4, { fit: [20, 20] });

          doc.rect(x + 10, y + 36, 50, 64).fillAndStroke("#F8FAFC", "#CBD5E1");
          if (!safeDrawImage(doc, photoBuf, x + 10, y + 36, { fit: [50, 64], align: "center", valign: "center" })) {
            doc.fillColor("#64748B").fontSize(9).font("Helvetica-Bold").text("ID", x + 28, y + 62);
          }

          const ix = x + 68;
          let iy = y + 36;
          doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("NOM :", ix, iy);
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text((snap.student.lastName || "").toUpperCase(), ix + 30, iy, { width: 150, truncate: true });

          iy += 11;
          doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("PRÉNOM :", ix, iy);
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(snap.student.firstName || "", ix + 30, iy, { width: 150, truncate: true });

          iy += 11;
          doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("MATRICULE :", ix, iy);
          doc.fillColor(tmpl.accentColor || "#5E72E4").fontSize(7).font("Helvetica-Bold").text(snap.student.matricule || "—", ix + 30, iy);

          iy += 11;
          doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("FILIÈRE :", ix, iy);
          doc.fillColor("#0F172A").fontSize(6).font("Helvetica").text(snap.classe?.filiereName || "—", ix + 30, iy, { width: 150, truncate: true });

          iy += 10;
          doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("NIVEAU :", ix, iy);
          doc.fillColor("#0F172A").fontSize(6).font("Helvetica-Bold").text(`Niveau ${snap.classe?.niveauOrder || 1} (${snap.classe?.programTypeCode || "DQP"})`, ix + 30, iy);

          doc.rect(x, y + 146, cardW, 19).fill("#F8FAFC");
          doc.fillColor("#64748B").fontSize(5).font("Helvetica").text(`Cohorte : ${snap.classe?.promotionLabel || snap.classe?.academicYearLabel || "—"}`, x + 8, y + 152);
          doc.fillColor(tmpl.accentColor || "#5E72E4").fontSize(6).font("Helvetica-Bold").text("CECO ID-PASS", x + 195, y + 152);
        }

        // PLANCHE VERSO
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

          doc.rect(x, y, cardW, cardH).lineWidth(0.5).strokeColor("#CBD5E1").fillAndStroke("#FFFFFF", "#CBD5E1");

          doc.fillColor(tmpl.themeColor || "#0B1C30").fontSize(6.5).font("Helvetica-Bold").text("CONDITIONS D'UTILISATION", x + 8, y + 8);
          doc.fillColor("#475569").fontSize(5).font("Helvetica").text(
            tmpl.termsOfUse || "Carte officielle d'apprenant. Présentation obligatoire aux examens et évaluations. En cas de perte, rapporter à la direction.",
            x + 8, y + 18, { width: 235, lineGap: 1 }
          );

          safeDrawImage(doc, qrBuf, x + 8, y + 54, { width: 46, height: 46 });
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("Authentification :", x + 60, y + 56);
          doc.fillColor(tmpl.accentColor || "#5E72E4").fontSize(5).font("Courier").text(snap.qrToken || "CECO-OFFICIAL", x + 60, y + 66, { width: 185 });

          const sigBuf = bufferFromDataUrl(snap.center.signatures?.directeur);
          if (sigBuf) safeDrawImage(doc, sigBuf, x + 165, y + 80, { fit: [70, 24], align: "center" });
          doc.fillColor("#0F172A").fontSize(5.5).font("Helvetica-Bold").text(tmpl.signatoryTitle || snap.center.directorTitle || "Le Directeur Général", x + 160, y + 108, { width: 85, align: "center" });

          doc.rect(x, y + 144, cardW, 21).fill("#0B1C30");
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

// ============================================================================
// 3. CERTIFICAT DE SCOLARITÉ INDIVIDUEL ET LOT (A4 PORTRAIT)
// ============================================================================
function renderSingleAttestationPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const primaryColor = tmpl.primaryColor || "#0B1C30";

  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 330);
  drawBilingualRepublicHeader(doc, tmpl, center, logoBuf, sealBuf, 25);

  doc.fillColor("#0F172A").fontSize(13).font("Helvetica-Bold").text(tmpl.documentTitle || "CERTIFICAT DE SCOLARITÉ & D'INSCRIPTION", 35, 140, { width: 525, align: "center", underline: true });
  if (tmpl.subTitle) {
    doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text(tmpl.subTitle, 35, 158, { width: 525, align: "center" });
  }

  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica").text(
    `Je soussigné, ${center.directorName ? center.directorName : "La Direction Générale"}, en qualité de ${center.directorTitle || "Directeur Général"} de l'établissement susmentionné, certifie par la présente que :`,
    35, 185, { width: 525, lineGap: 3 }
  );

  doc.rect(35, 215, 525, 95).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("L'Apprenant(e) :", 50, 228);
  doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text(`${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`, 145, 226);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Matricule Officiel :", 50, 245);
  doc.fillColor(primaryColor).fontSize(9.5).font("Courier-Bold").text(student.matricule || "—", 145, 245);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Date / Lieu Naissance :", 50, 262);
  const birthStr = `${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "Non renseignée"}${student.birthPlace ? ` à ${student.birthPlace}` : ""}`;
  doc.fillColor("#0F172A").fontSize(9).font("Helvetica").text(birthStr, 145, 262);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Filière d'Études :", 50, 279);
  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica-Bold").text(`${classe.filiereName || "—"} (${classe.programTypeCode || "DQP"})`, 145, 279);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Niveau / Promotion :", 50, 294);
  doc.fillColor("#0F172A").fontSize(9).font("Helvetica").text(`Niveau ${classe.niveauOrder || 1} • ${classe.promotionLabel || `Session ${classe.academicYearLabel}`}`, 145, 294);

  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica").text(
    "Est régulièrement inscrit(e) et poursuit avec assiduité son cycle de formation professionnelle au sein de notre établissement pour la session académique en cours.",
    35, 330, { width: 525, lineGap: 3.5 }
  );
  doc.text("En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.", 35, 365, { width: 525 });

  const qrY = 440;
  safeDrawImage(doc, qrBuf, 35, qrY, { width: 68, height: 68 });
  doc.fillColor("#64748B").fontSize(6.5).font("Helvetica-Bold").text("VÉRIFICATION OFFICIELLE", 35, qrY + 72);
  doc.fillColor(primaryColor).fontSize(5.5).font("Courier").text(snapshot.qrToken || "", 35, qrY + 80, { width: 140 });

  doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(
    `Fait à ${center.city || "Bafoussam"}, le ${new Date().toLocaleDateString("fr-FR")}`,
    350, 420, { width: 210, align: "right" }
  );

  const signatories = tmpl.signatories || [
    { title: "Le Directeur des Études", roleKey: "directeur_pedagogique" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];
  renderSignatoryBlocks(doc, signatories, center.signatures || {}, 440);

  doc.rect(35, 765, 525, 0.5).stroke("#CBD5E1");
  doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text(tmpl.footerLegal || "Document officiel scellé. Toute falsification expose son auteur à des poursuites judiciaires.", 35, 772, { width: 440 });
  doc.fillColor(primaryColor).fontSize(6.5).font("Helvetica-Bold").text("PROPULSÉ PAR CECO", 480, 772, { align: "right" });
}

async function generateAttestationPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-ATTESTATION", { margin: 0, width: 85 });
      renderSingleAttestationPage(doc, snapshot, qrBuf);

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
      const doc = new PDFDocument({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 } });
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-ATTESTATION", { margin: 0, width: 85 });
        renderSingleAttestationPage(doc, snapshotsList[i], qrBuf);
      }

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================================
// 4. FICHE INDIVIDUELLE D'INSCRIPTION A4 (INTERNE)
// ============================================================================
async function generateFicheInscriptionPdf(snapshot, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const photoBuf = bufferFromDataUrl(student.photoDataUrl);
      const primaryColor = tmpl.primaryColor || "#0B1C30";

      drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 330);
      drawBilingualRepublicHeader(doc, tmpl, center, logoBuf, sealBuf, 25);

      doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text(tmpl.documentTitle || "FICHE INDIVIDUELLE D'INSCRIPTION & D'ENGAGEMENT", 35, 125, { width: 525, align: "center", underline: true });
      doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text(`SESSION ACADÉMIQUE : ${classe.academicYearLabel || "—"} • ${classe.promotionLabel || ""}`, 35, 140, { width: 525, align: "center" });

      doc.rect(465, 160, 95, 125).fillAndStroke("#F8FAFC", "#CBD5E1");
      if (!safeDrawImage(doc, photoBuf, 465, 160, { fit: [95, 125], align: "center", valign: "center" })) {
        doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text("PHOTO D'IDENTITÉ", 475, 215, { width: 75, align: "center" });
      }

      doc.rect(35, 160, 415, 125).fillAndStroke("#F8FAFC", "#CBD5E1");
      let ly = 168;
      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Matricule Officiel :", 45, ly);
      doc.fillColor(primaryColor).fontSize(8.5).font("Courier-Bold").text(student.matricule || "—", 155, ly);

      ly += 16;
      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Nom de famille :", 45, ly);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text((student.lastName || "").toUpperCase(), 155, ly);

      ly += 16;
      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Prénom(s) :", 45, ly);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text(student.firstName || "", 155, ly);

      ly += 16;
      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Genre / Naissance :", 45, ly);
      const genreBirth = `${student.gender === "F" ? "Féminin" : "Masculin"} • Né(e) le ${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—"}${student.birthPlace ? ` à ${student.birthPlace}` : ""}`;
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(genreBirth, 155, ly);

      ly += 16;
      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Contact Apprenant :", 45, ly);
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(student.phone || "Non renseigné", 155, ly);

      ly += 16;
      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Parent / Tuteur (Urgence) :", 45, ly);
      const parentInfo = `${student.guardianName || "Non renseigné"}${student.guardianPhone ? ` (${student.guardianPhone})` : ""}`;
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text(parentInfo, 155, ly);

      ly += 16;
      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Dernier diplôme obtenu :", 45, ly);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(student.entryDiploma || "Aucun / Entrée directe", 155, ly);

      doc.rect(35, 295, 525, 60).fillAndStroke("#FFFFFF", "#CBD5E1");
      doc.rect(35, 295, 525, 18).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold").text("AFFECTATION PÉDAGOGIQUE & CYCLE CHOISI", 45, 300);

      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Filière de formation :", 45, 320);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text(`${classe.filiereName || "—"} (${classe.programTypeCode || "DQP"})`, 160, 320);

      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Classe & Promotion :", 45, 336);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(`${classe.label || "—"} • ${classe.promotionLabel || ""}`, 160, 336);

      doc.rect(35, 365, 525, 75).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text("ENGAGEMENT DE L'APPRENANT(E) :", 45, 375);
      doc.fillColor("#334155").fontSize(8).font("Helvetica").text(
        tmpl.engagementText || "Je soussigné(e), certifie sur l'honneur l'exactitude des informations mentionnées ci-dessus et déclare avoir pris pleine connaissance du règlement intérieur de l'établissement. Je m'engage à faire preuve d'assiduité, de rigueur et de probité tout au long de mon cycle de formation.",
        45, 388, { width: 505, lineGap: 2.5 }
      );

      const signatories = tmpl.signatories || [
        { title: "Signature de l'Apprenant(e)", roleKey: "student" },
        { title: "Visa de la Direction", roleKey: "directeur" },
      ];
      renderSignatoryBlocks(doc, signatories, center.signatures || {}, 460);

      doc.rect(35, 765, 525, 0.5).stroke("#CBD5E1");
      doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text(tmpl.footerLegal || "Document administratif interne conservé aux archives académiques.", 35, 772, { width: 440 });
      doc.fillColor(primaryColor).fontSize(6.5).font("Helvetica-Bold").text("PROPULSÉ PAR CECO", 480, 772, { align: "right" });

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================================
// 5. BULLETIN INTERMÉDIAIRE DE CONTRÔLE CONTINU (A4 PORTRAIT)
// ============================================================================
function renderSingleContinuousAssessmentBulletinPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, period = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#0B1C30";

  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 330);
  drawBilingualRepublicHeader(doc, tmpl, center, logoBuf, sealBuf, 25);

  // Titre
  doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text("BULLETIN D'ÉVALUATIONS CONTINUES (CC & TP)", 35, 125, { width: 525, align: "center", underline: true });
  doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text(`${period.label || "Semestre 1"} • SESSION ACADÉMIQUE ${classe.academicYearLabel || "2026-2027"}`, 35, 138, { width: 525, align: "center" });

  // Cartouche Apprenant + Photo
  doc.rect(35, 155, 455, 68).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.rect(495, 155, 65, 68).fillAndStroke("#FFFFFF", "#CBD5E1");
  if (!safeDrawImage(doc, photoBuf, 495, 155, { fit: [65, 68], align: "center", valign: "center" })) {
    doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text("PHOTO", 510, 185);
  }

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Apprenant(e) :", 45, 163);
  doc.fillColor("#0F172A").fontSize(9).font("Helvetica-Bold").text(`${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`, 125, 163);

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Matricule :", 45, 178);
  doc.fillColor(primaryColor).fontSize(8.5).font("Courier-Bold").text(student.matricule || "—", 125, 178);

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Classe / Filière :", 45, 193);
  doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(`${classe.label || ""} (${classe.filiereName || ""})`, 125, 193);

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Cohorte :", 45, 207);
  doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(`${classe.promotionLabel || "—"} • Effectif classe : ${totals.totalStudents || 0}`, 125, 207);

  // Tableau CC
  let y = 232;
  doc.rect(35, y, 525, 18).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold");
  doc.text("Discipline / Matière", 40, y + 5, { width: 170 });
  doc.text("Coef", 215, y + 5, { width: 30, align: "center" });
  doc.text("CC 1 /20", 250, y + 5, { width: 45, align: "center" });
  doc.text("CC 2 /20", 300, y + 5, { width: 45, align: "center" });
  doc.text("Moy. CC /20", 350, y + 5, { width: 55, align: "center" });
  doc.text("Appréciation", 410, y + 5, { width: 70, align: "center" });
  doc.text("Formateur", 485, y + 5, { width: 70 });

  y += 18;

  categories.forEach((cat) => {
    doc.rect(35, y, 525, 14).fill("#E2E8F0");
    doc.fillColor("#0F172A").fontSize(7).font("Helvetica-Bold").text(`${cat.name.toUpperCase()} (Total Coef : ${cat.totalCoeff})`, 40, y + 3);
    y += 14;

    cat.subjects.forEach((sub) => {
      doc.rect(35, y, 525, 15).strokeColor("#CBD5E1").stroke();
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica");
      doc.text(`${sub.code ? `[${sub.code}] ` : ""}${sub.name}`, 40, y + 4, { width: 170, truncate: true });
      doc.text(String(sub.coefficient), 215, y + 4, { width: 30, align: "center" });
      doc.text(sub.cc1, 250, y + 4, { width: 45, align: "center" });
      doc.text(sub.cc2, 300, y + 4, { width: 45, align: "center" });
      doc.font("Helvetica-Bold").text(sub.ccAverage, 350, y + 4, { width: 55, align: "center" });
      doc.font("Helvetica").text(sub.appreciation, 410, y + 4, { width: 70, align: "center" });
      doc.text(sub.formateurName || "—", 485, y + 4, { width: 70, truncate: true });
      y += 15;
    });
  });

  // Bilan
  y += 8;
  doc.rect(35, y, 525, 40).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
  doc.text(`Total Coefficients : ${totals.totalCoefficients}`, 45, y + 8);
  doc.text(`Moyenne Continue : ${totals.overallAverage !== null ? `${totals.overallAverage} / 20` : "—"}`, 45, y + 22);

  doc.text(`Rang : ${totals.rank ? `${totals.rank}e sur ${totals.totalStudents}` : "—"}`, 220, y + 8);
  doc.text(`Moyenne Classe : ${totals.classAverage || "—"} / 20`, 220, y + 22);

  doc.text(`Plus forte moyenne : ${totals.highestAverage || "—"}`, 390, y + 8);
  doc.text(`Plus faible moyenne : ${totals.lowestAverage || "—"}`, 390, y + 22);

  const qrY = 660;
  safeDrawImage(doc, qrBuf, 35, qrY, { width: 62, height: 62 });
  doc.fillColor("#64748B").fontSize(5.5).font("Courier").text(snapshot.qrToken || "", 35, qrY + 66, { width: 130 });

  const signatories = tmpl.signatories || [
    { title: "Le Directeur des Études", roleKey: "directeur_pedagogique" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];
  renderSignatoryBlocks(doc, signatories, center.signatures || {}, 660);

  doc.rect(35, 775, 525, 0.5).stroke("#CBD5E1");
  doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text(tmpl.footerLegal || "Bulletin officiel d'évaluation continue • CECO ERP", 35, 782, { width: 440 });
  doc.fillColor(primaryColor).fontSize(6.5).font("Helvetica-Bold").text("PROPULSÉ PAR CECO", 480, 782, { align: "right" });
}

async function generateContinuousAssessmentBulletinPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-CC", { margin: 0, width: 80 });
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
      const doc = new PDFDocument({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 } });
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-CC", { margin: 0, width: 80 });
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

// ============================================================================
// 6. BULLETIN SEMESTRIEL BILINGUE (A4 PORTRAIT)
// ============================================================================
function renderSingleSemesterBulletinPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, period = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#0B1C30";

  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 330);
  drawBilingualRepublicHeader(doc, tmpl, center, logoBuf, sealBuf, 25);

  // Titre bilingue
  doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text("BULLETIN SEMESTRIEL DE NOTES / SEMESTER REPORT CARD", 35, 125, { width: 525, align: "center", underline: true });
  doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text(`${period.label || "Semestre 1"} • SESSION ACADÉMIQUE ${classe.academicYearLabel || "2026-2027"}`, 35, 138, { width: 525, align: "center" });

  // Cartouche Apprenant + Photo
  doc.rect(35, 155, 455, 68).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.rect(495, 155, 65, 68).fillAndStroke("#FFFFFF", "#CBD5E1");
  if (!safeDrawImage(doc, photoBuf, 495, 155, { fit: [65, 68], align: "center", valign: "center" })) {
    doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text("PHOTO", 510, 185);
  }

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Apprenant(e) :", 45, 163);
  doc.fillColor("#0F172A").fontSize(9).font("Helvetica-Bold").text(`${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`, 125, 163);

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Matricule :", 45, 178);
  doc.fillColor(primaryColor).fontSize(8.5).font("Courier-Bold").text(student.matricule || "—", 125, 178);

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Classe / Filière :", 45, 193);
  doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(`${classe.label || ""} (${classe.filiereName || ""})`, 125, 193);

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Cohorte :", 45, 207);
  doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(`${classe.promotionLabel || "—"} • Effectif classe : ${totals.totalStudents || 0}`, 125, 207);

  // Tableau Semestriel avec Ventilation par Groupes
  let y = 230;
  doc.rect(35, y, 525, 18).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(6.5).font("Helvetica-Bold");
  doc.text("Discipline / Matière", 40, y + 5, { width: 145 });
  doc.text("Coef", 190, y + 5, { width: 25, align: "center" });
  doc.text("CC /20", 220, y + 5, { width: 35, align: "center" });
  doc.text("Exam /20", 260, y + 5, { width: 40, align: "center" });
  doc.text("Rattrap.", 305, y + 5, { width: 35, align: "center" });
  doc.text("Finale", 345, y + 5, { width: 35, align: "center" });
  doc.text("Points", 385, y + 5, { width: 35, align: "center" });
  doc.text("Appréciation", 425, y + 5, { width: 65, align: "center" });
  doc.text("Formateur", 495, y + 5, { width: 60 });

  y += 18;

  categories.forEach((cat) => {
    doc.rect(35, y, 525, 14).fill("#E2E8F0");
    doc.fillColor("#0F172A").fontSize(7).font("Helvetica-Bold");
    doc.text(`${cat.name.toUpperCase()} (Total Coef : ${cat.totalCoeff} • Moyenne Groupe : ${cat.groupAverage !== null ? `${cat.groupAverage}/20` : "—"})`, 40, y + 3);
    y += 14;

    cat.subjects.forEach((sub) => {
      doc.rect(35, y, 525, 14).strokeColor("#CBD5E1").stroke();
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica");
      doc.text(`${sub.code ? `[${sub.code}] ` : ""}${sub.name}`, 40, y + 3.5, { width: 145, truncate: true });
      doc.text(String(sub.coefficient), 190, y + 3.5, { width: 25, align: "center" });
      doc.text(sub.ccAverage, 220, y + 3.5, { width: 35, align: "center" });
      doc.text(sub.examGrade, 260, y + 3.5, { width: 40, align: "center" });
      doc.text(sub.rattrapage, 305, y + 3.5, { width: 35, align: "center" });
      doc.font("Helvetica-Bold").text(sub.finalGrade, 345, y + 3.5, { width: 35, align: "center" });
      doc.font("Helvetica-Bold").text(sub.points, 385, y + 3.5, { width: 35, align: "center" });
      doc.font("Helvetica").text(sub.appreciation, 425, y + 3.5, { width: 65, align: "center" });
      doc.text(sub.formateurName || "—", 495, y + 3.5, { width: 60, truncate: true });
      y += 14;
    });
  });

  // Profil de Classe & Bilan
  y += 8;
  doc.rect(35, y, 525, 44).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
  doc.text(`Total Coef : ${totals.totalCoefficients}`, 45, y + 8);
  doc.text(`Total Points : ${totals.totalPoints} pts`, 45, y + 22);

  doc.fillColor(primaryColor).text(`Moyenne Générale : ${totals.overallAverage !== null ? `${totals.overallAverage} / 20` : "—"}`, 170, y + 8);
  doc.fillColor("#0F172A").text(`Rang : ${totals.rank ? `${totals.rank}e sur ${totals.totalStudents}` : "—"}`, 170, y + 22);

  doc.text(`Moyenne Classe : ${totals.classAverage || "—"} / 20`, 330, y + 8);
  doc.text(`Min : ${totals.lowestAverage || "—"}  •  Max : ${totals.highestAverage || "—"}`, 330, y + 22);

  const decColor = totals.overallAverage >= 10.0 && !totals.hasEliminatory ? "#2DCE89" : "#F5365C";
  const decLabel = totals.overallAverage >= 10.0 && !totals.hasEliminatory ? "SEMESTRE VALIDÉ" : "AJOURNÉ";
  doc.fillColor(decColor).fontSize(8.5).text(`Décision : ${decLabel}`, 45, y + 32);

  const qrY = 660;
  safeDrawImage(doc, qrBuf, 35, qrY, { width: 64, height: 64 });
  doc.fillColor("#64748B").fontSize(5.5).font("Courier").text(snapshot.qrToken || "", 35, qrY + 68, { width: 130 });

  const signatories = tmpl.signatories || [
    { title: "Le Directeur des Études", roleKey: "directeur_pedagogique" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];
  renderSignatoryBlocks(doc, signatories, center.signatures || {}, 660);

  doc.rect(35, 775, 525, 0.5).stroke("#CBD5E1");
  doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text(tmpl.footerLegal || "Bulletin officiel semestriel certifié conforme • CECO ERP", 35, 782, { width: 440 });
  doc.fillColor(primaryColor).fontSize(6.5).font("Helvetica-Bold").text("PROPULSÉ PAR CECO", 480, 782, { align: "right" });
}

async function generateSemesterBulletinPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-BULLETIN", { margin: 0, width: 85 });
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
      const doc = new PDFDocument({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 } });
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-BULLETIN", { margin: 0, width: 85 });
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

// ============================================================================
// 7. RELEVÉ DE NOTES ANNUEL / ACADEMIC TRANSCRIPT (A4 PORTRAIT)
// ============================================================================
function renderSingleAnnualTranscriptPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#0B1C30";

  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 330);
  drawBilingualRepublicHeader(doc, tmpl, center, logoBuf, sealBuf, 25);

  doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text("RELEVÉ DE NOTES ANNUEL / OFFICIAL ACADEMIC TRANSCRIPT", 35, 125, { width: 525, align: "center", underline: true });
  doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text(`CUMUL PÉDAGOGIQUE (SEMESTRE 1 + SEMESTRE 2) • SESSION ${classe.academicYearLabel || "2026-2027"}`, 35, 138, { width: 525, align: "center" });

  doc.rect(35, 155, 455, 68).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.rect(495, 155, 65, 68).fillAndStroke("#FFFFFF", "#CBD5E1");
  if (!safeDrawImage(doc, photoBuf, 495, 155, { fit: [65, 68], align: "center", valign: "center" })) {
    doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text("PHOTO", 510, 185);
  }

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Apprenant(e) :", 45, 163);
  doc.fillColor("#0F172A").fontSize(9).font("Helvetica-Bold").text(`${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`, 125, 163);

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Matricule :", 45, 178);
  doc.fillColor(primaryColor).fontSize(8.5).font("Courier-Bold").text(student.matricule || "—", 125, 178);

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Filière & Cycle :", 45, 193);
  doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(`${classe.filiereName || ""} (${classe.programTypeCode || "DQP"})`, 125, 193);

  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Niveau / Cohorte :", 45, 207);
  doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(`Niveau ${classe.niveauOrder || 1} • ${classe.promotionLabel || "—"}`, 125, 207);

  // Tableau Annuel
  let y = 230;
  doc.rect(35, y, 525, 18).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold");
  doc.text("Discipline / Matière", 40, y + 5, { width: 200 });
  doc.text("Coef", 245, y + 5, { width: 35, align: "center" });
  doc.text("Note Annuelle /20", 290, y + 5, { width: 85, align: "center" });
  doc.text("Points", 385, y + 5, { width: 45, align: "center" });
  doc.text("Appréciation", 440, y + 5, { width: 110, align: "center" });

  y += 18;

  categories.forEach((cat) => {
    doc.rect(35, y, 525, 14).fill("#E2E8F0");
    doc.fillColor("#0F172A").fontSize(7).font("Helvetica-Bold");
    doc.text(`${cat.name.toUpperCase()} (Total Coef : ${cat.totalCoeff})`, 40, y + 3);
    y += 14;

    cat.subjects.forEach((sub) => {
      doc.rect(35, y, 525, 14).strokeColor("#CBD5E1").stroke();
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica");
      doc.text(`${sub.code ? `[${sub.code}] ` : ""}${sub.name}`, 40, y + 3.5, { width: 200, truncate: true });
      doc.text(String(sub.coefficient), 245, y + 3.5, { width: 35, align: "center" });
      doc.font("Helvetica-Bold").text(sub.finalGrade, 290, y + 3.5, { width: 85, align: "center" });
      doc.font("Helvetica-Bold").text(sub.points, 385, y + 3.5, { width: 45, align: "center" });
      doc.font("Helvetica").text(sub.appreciation, 440, y + 3.5, { width: 110, align: "center" });
      y += 14;
    });
  });

  // Synthèse Annuelle
  y += 10;
  doc.rect(35, y, 525, 46).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
  doc.text(`Total Coeffs Annuels : ${totals.totalCoefficients}`, 45, y + 8);
  doc.text(`Points Annuels : ${totals.totalPoints} pts`, 45, y + 22);

  doc.fillColor(primaryColor).text(`Moyenne Annuelle : ${totals.overallAverage !== null ? `${totals.overallAverage} / 20` : "—"}`, 190, y + 8);
  doc.fillColor("#0F172A").text(`Rang Annuel : ${totals.rank ? `${totals.rank}e sur ${totals.totalStudents}` : "—"}`, 190, y + 22);

  doc.text(`Moyenne de Classe : ${totals.classAverage || "—"} / 20`, 350, y + 8);
  doc.fillColor(totals.decision === "admis" || totals.decision === "diplome" ? "#2DCE89" : "#F5365C")
    .text(`DÉCISION DU JURY : ${(totals.decision || "ajourne").toUpperCase()}`, 350, y + 22);

  const qrY = 660;
  safeDrawImage(doc, qrBuf, 35, qrY, { width: 64, height: 64 });
  doc.fillColor("#64748B").fontSize(5.5).font("Courier").text(snapshot.qrToken || "", 35, qrY + 68, { width: 130 });

  const signatories = tmpl.signatories || [
    { title: "Le Directeur des Études", roleKey: "directeur_pedagogique" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];
  renderSignatoryBlocks(doc, signatories, center.signatures || {}, 660);

  doc.rect(35, 775, 525, 0.5).stroke("#CBD5E1");
  doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text(tmpl.footerLegal || "Relevé officiel annuel certifié conforme • CECO ERP", 35, 782, { width: 440 });
  doc.fillColor(primaryColor).fontSize(6.5).font("Helvetica-Bold").text("PROPULSÉ PAR CECO", 480, 782, { align: "right" });
}

async function generateAnnualTranscriptPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-TRANSCRIPT", { margin: 0, width: 85 });
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
      const doc = new PDFDocument({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 25, bottom: 25, left: 35, right: 35 } });
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-TRANSCRIPT", { margin: 0, width: 85 });
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

// ============================================================================
// 8. DIPLÔME DE FIN DE FORMATION (A4 PAYSAGE ORNEMENTAL)
// ============================================================================
function renderSingleGraduationDiplomaPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const sigBuf = bufferFromDataUrl(center.signatures?.directeur);
  const primaryColor = tmpl.primaryColor || "#0B1C30";

  drawDiplomaOrnamentalBorders(doc, 842, 595);
  drawWatermark(doc, tmpl, logoBuf, sealBuf, 270, 140, 300);

  // En-tête officiel bilingue Paysage
  doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold").text(
    "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE",
    45, 42, { width: 230, align: "center", lineGap: 1.5 }
  );

  doc.text(
    "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING",
    565, 42, { width: 230, align: "center", lineGap: 1.5 }
  );

  if (logoBuf) safeDrawImage(doc, logoBuf, 345, 40, { fit: [60, 60], align: "center" });
  if (sealBuf) safeDrawImage(doc, sealBuf, 435, 40, { fit: [60, 60], align: "center" });

  doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text((center.name || "ÉTABLISSEMENT DE FORMATION").toUpperCase(), 50, 115, { width: 742, align: "center" });
  doc.fillColor("#64748B").fontSize(8).font("Helvetica").text(
    `Agrément Ministériel N° : ${center.registrationNumber || "MINEFOP"} • ${center.city || "Cameroun"}`,
    50, 133, { width: 742, align: "center" }
  );

  // Grand Titre du Diplôme
  doc.fillColor("#C39B52").fontSize(20).font("Times-Bold").text("DIPLÔME DE FIN DE FORMATION PROFESSIONNELLE", 50, 160, { width: 742, align: "center" });
  doc.fillColor("#475569").fontSize(10).font("Times-Italic").text("VOCATIONAL GRADUATION DIPLOMA", 50, 185, { width: 742, align: "center" });

  // Visa légal
  doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(
    `Vu la loi portant orientation de la formation professionnelle au Cameroun ;\nVu l'arrêté d'agrément de l'établissement susmentionné ;\nSur proposition du jury de délibération souverain réuni en date officielle ;`,
    75, 215, { width: 692, align: "center", lineGap: 3 }
  );

  doc.fillColor(primaryColor).fontSize(11).font("Times-Bold").text("LE PRÉSENT DIPLÔME EST DÉCERNÉ À :", 50, 268, { width: 742, align: "center" });

  // Nom du Lauréat
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

  // Spécialité et Mention
  doc.fillColor(primaryColor).fontSize(13).font("Helvetica-Bold").text(
    `${classe.filiereName || "Formation Professionnelle"} (${classe.programTypeCode || "DQP"})`,
    50, 365, { width: 742, align: "center" }
  );

  doc.fillColor("#C39B52").fontSize(10.5).font("Helvetica-Bold").text(
    `MENTION OBTENUE : ${(totals.mention || "PASSABLE").toUpperCase()}`,
    50, 388, { width: 742, align: "center" }
  );

  // Signatures et QR Code hors-ligne
  const sigY = 430;
  safeDrawImage(doc, qrBuf, 75, sigY, { width: 72, height: 72 });
  doc.fillColor("#64748B").fontSize(5.5).font("Courier").text(snapshot.qrToken || "", 75, sigY + 76, { width: 140 });

  doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(
    `Fait à ${center.city || "Bafoussam"}, le ${new Date().toLocaleDateString("fr-FR")}`,
    550, sigY - 15, { width: 220, align: "center" }
  );

  doc.font("Helvetica-Bold");
  doc.text("Le Président du Jury", 280, sigY + 5, { width: 180, align: "center" });
  doc.text("Le Directeur de l'Établissement", 550, sigY + 5, { width: 220, align: "center" });

  if (sigBuf) safeDrawImage(doc, sigBuf, 590, sigY + 22, { fit: [140, 42], align: "center" });

  doc.rect(45, 545, 752, 0.5).stroke("#C39B52");
  doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text("Titre officiel de qualification certifié conforme • Registre sécurisé CECO", 45, 552, { width: 500 });
  doc.fillColor(primaryColor).fontSize(6.5).font("Helvetica-Bold").text("PROPULSÉ PAR CECO ERP", 670, 552, { align: "right" });
}

async function generateGraduationDiplomaPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: 20, bottom: 20, left: 20, right: 20 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-DIPLOMA", { margin: 0, width: 90 });
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
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: 20, bottom: 20, left: 20, right: 20 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", layout: "landscape", margins: { top: 20, bottom: 20, left: 20, right: 20 } });
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-DIPLOMA", { margin: 0, width: 90 });
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

// ============================================================================
// 9. BORDEREAU DE NOTES VIERGE POUR ENSEIGNANT (A4 PORTRAIT)
// ============================================================================
async function generateBlankGradeSheetPdf(snapshot, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 25, bottom: 25, left: 30, right: 30 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, offering = {}, students = [] } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.05 }, logoBuf, sealBuf, 130, 260, 330);

      if (logoBuf) safeDrawImage(doc, logoBuf, 30, 25, { fit: [45, 45] });
      if (sealBuf) safeDrawImage(doc, sealBuf, 525, 25, { fit: [45, 45] });

      doc.fillColor("#0B1C30").fontSize(12).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), 80, 30, { width: 440, align: "center" });
      doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text(`Agrément : ${center.registrationNumber || "MINEFOP"} • ${center.city || "Cameroun"}`, 80, 46, { width: 440, align: "center" });

      doc.moveTo(30, 75).lineTo(565, 75).lineWidth(1.2).strokeColor("#0B1C30").stroke();

      doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text("BORDEREAU DE REPORT DE NOTES MANUSCRIT", 30, 88, { width: 535, align: "center" });
      doc.fillColor("#64748B").fontSize(8).font("Helvetica").text("Document de travail de l'enseignant pour la correction et la saisie", 30, 102, { width: 535, align: "center" });

      doc.rect(30, 118, 535, 42).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
      doc.text(`Classe : ${offering.classeLabel || "—"}`, 40, 126);
      doc.text(`Matière : ${offering.subjectName || "—"} (Coef ${offering.coefficient || 2})`, 220, 126);
      doc.text(`Semestre : ${offering.semesterLabel || "—"}`, 430, 126);

      doc.text(`Groupe : ${offering.categoryName || "Général"}`, 40, 144);
      doc.text(`Formateur : ${offering.formateurName || "Non assigné"}`, 220, 144);
      doc.text(`Effectif : ${students.length} apprenant(s)`, 430, 144);

      let y = 172;
      doc.rect(30, y, 535, 20).fill("#0B1C30");
      doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold");
      doc.text("N°", 35, y + 6, { width: 25, align: "center" });
      doc.text("Matricule", 65, y + 6, { width: 75 });
      doc.text("Nom & Prénom de l'Apprenant", 145, y + 6, { width: 170 });
      doc.text("CC 1 /20", 320, y + 6, { width: 50, align: "center" });
      doc.text("CC 2 /20", 375, y + 6, { width: 50, align: "center" });
      doc.text("Examen /20", 430, y + 6, { width: 60, align: "center" });
      doc.text("Rattrap. /20", 495, y + 6, { width: 65, align: "center" });

      y += 20;

      students.forEach((st, idx) => {
        if (y > 730) {
          doc.addPage({ size: "A4", margins: { top: 25, bottom: 25, left: 30, right: 30 } });
          y = 35;
        }

        doc.rect(30, y, 535, 18).strokeColor("#CBD5E1").stroke();
        doc.fillColor("#0F172A").fontSize(7).font("Helvetica");
        doc.text(String(idx + 1), 35, y + 5, { width: 25, align: "center" });
        doc.font("Helvetica-Bold").text(st.matricule, 65, y + 5, { width: 75 });
        doc.font("Helvetica").text(`${st.lastName} ${st.firstName}`, 145, y + 5, { width: 170, truncate: true });

        doc.rect(320, y, 50, 18).strokeColor("#E2E8F0").stroke();
        doc.rect(375, y, 50, 18).strokeColor("#E2E8F0").stroke();
        doc.rect(430, y, 60, 18).strokeColor("#E2E8F0").stroke();
        doc.rect(495, y, 70, 18).strokeColor("#E2E8F0").stroke();

        y += 18;
      });

      y = Math.max(y + 25, 730);
      if (y > 760) {
        doc.addPage({ size: "A4", margins: { top: 25, bottom: 25, left: 30, right: 30 } });
        y = 40;
      }

      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
      doc.text("Signature de l'Enseignant :", 50, y);
      doc.text("Visa de la Direction des Études :", 360, y);

      doc.rect(30, 800, 535, 0.5).stroke("#CBD5E1");
      doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text("Bordereau académique d'évaluation • CECO ERP", 30, 808);
      doc.text("PROPULSÉ PAR CECO", 480, 808, { align: "right" });

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================================
// 10. PV MATIÈRE OFFICIEL SCELLÉ (A4 PORTRAIT)
// ============================================================================
async function generateCertifiedGradeSheetPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 25, bottom: 25, left: 30, right: 30 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, offering = {}, rows = [], stats = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const sigBuf = bufferFromDataUrl(center.signatures?.directeur);

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.06 }, logoBuf, sealBuf, 130, 260, 330);

      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold").text("RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE", 30, 25, { width: 190, align: "center", lineGap: 1.5 });
      doc.text("REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING", 375, 25, { width: 190, align: "center", lineGap: 1.5 });

      if (logoBuf) safeDrawImage(doc, logoBuf, 245, 25, { fit: [45, 45], align: "center" });
      if (sealBuf) safeDrawImage(doc, sealBuf, 305, 25, { fit: [45, 45], align: "center" });

      doc.fillColor("#0B1C30").fontSize(11).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), 30, 80, { width: 535, align: "center" });
      doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text(`Agrément : ${center.registrationNumber || "MINEFOP"} • ${center.city || "Cameroun"}`, 30, 94, { width: 535, align: "center" });

      doc.moveTo(30, 108).lineTo(565, 108).lineWidth(1.2).strokeColor("#0B1C30").stroke();

      doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text("PROCÈS-VERBAL OFFICIEL DE NOTES DE COURS", 30, 118, { width: 535, align: "center", underline: true });

      doc.rect(30, 136, 535, 36).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
      doc.text(`Classe : ${offering.classeLabel}`, 40, 142);
      doc.text(`Matière : ${offering.subjectName} (Coef ${offering.coefficient})`, 220, 142);
      doc.text(`Période : ${offering.semesterLabel}`, 420, 142);

      doc.text(`Groupe : ${offering.categoryName || "Général"}`, 40, 156);
      doc.text(`Formateur : ${offering.formateurName || "Non assigné"}`, 220, 156);
      doc.text(`Taux de réussite : ${stats.successRate || "0"}%`, 420, 156);

      let y = 182;
      doc.rect(30, y, 535, 18).fill("#0B1C30");
      doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold");
      doc.text("N°", 35, y + 5, { width: 20, align: "center" });
      doc.text("Matricule", 60, y + 5, { width: 70 });
      doc.text("Nom & Prénom de l'Apprenant", 135, y + 5, { width: 160 });
      doc.text("CC 1", 300, y + 5, { width: 35, align: "center" });
      doc.text("CC 2", 340, y + 5, { width: 35, align: "center" });
      doc.text("Moy. CC", 380, y + 5, { width: 45, align: "center" });
      doc.text("Normale", 430, y + 5, { width: 40, align: "center" });
      doc.text("Rattrap.", 475, y + 5, { width: 40, align: "center" });
      doc.text("Note /20", 520, y + 5, { width: 40, align: "center" });

      y += 18;

      rows.forEach((row, idx) => {
        if (y > 700) {
          doc.addPage({ size: "A4", margins: { top: 25, bottom: 25, left: 30, right: 30 } });
          y = 35;
        }

        doc.rect(30, y, 535, 16).strokeColor("#E2E8F0").stroke();
        doc.fillColor("#0F172A").fontSize(7).font("Helvetica");
        doc.text(String(idx + 1), 35, y + 4, { width: 20, align: "center" });
        doc.font("Helvetica-Bold").text(row.matricule, 60, y + 4, { width: 70 });
        doc.font("Helvetica").text(row.fullName, 135, y + 4, { width: 160, truncate: true });

        doc.text(row.cc1 || "—", 300, y + 4, { width: 35, align: "center" });
        doc.text(row.cc2 || "—", 340, y + 4, { width: 35, align: "center" });
        doc.font("Helvetica-Bold").text(row.ccAvg || "—", 380, y + 4, { width: 45, align: "center" });
        doc.font("Helvetica").text(row.normale || "—", 430, y + 4, { width: 40, align: "center" });
        doc.text(row.rattrapage || "—", 475, y + 4, { width: 40, align: "center" });
        doc.font("Helvetica-Bold").fillColor(row.isValid ? "#0B1C30" : "#F5365C").text(row.finalGrade || "—", 520, y + 4, { width: 40, align: "center" });

        y += 16;
      });

      y += 10;
      doc.rect(30, y, 535, 24).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold");
      doc.text(`Inscrits : ${stats.total || 0}  •  Évalués : ${stats.evaluated || 0}  •  Validés (≥10) : ${stats.passed || 0}  •  Non Validés : ${stats.failed || 0}  •  Moyenne de classe : ${stats.classAverage || "—"} / 20`, 40, y + 7);

      y = Math.max(y + 35, 700);
      if (y > 740) {
        doc.addPage({ size: "A4", margins: { top: 25, bottom: 25, left: 30, right: 30 } });
        y = 40;
      }

      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
      doc.text("Le Formateur Responsable", 80, y, { width: 160, align: "center" });
      doc.text("Le Directeur Général", 360, y, { width: 160, align: "center" });
      if (sigBuf) safeDrawImage(doc, sigBuf, 390, y + 14, { fit: [100, 32] });

      doc.rect(30, 800, 535, 0.5).stroke("#CBD5E1");
      doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text("Procès-verbal pédagogique • CECO ERP", 30, 808);
      doc.text("PROPULSÉ PAR CECO", 480, 808, { align: "right" });

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================================
// 11. PV SYNOPTIQUE DE DÉLIBÉRATION DE CLASSE (A4 PAYSAGE)
// ============================================================================
async function generateClassSemesterSummaryPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: { top: 20, bottom: 20, left: 25, right: 25 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, classe = {}, offerings = [], summaries = [] } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.05 }, logoBuf, sealBuf, 250, 130, 300);

      if (logoBuf) safeDrawImage(doc, logoBuf, 25, 20, { fit: [40, 40] });
      if (sealBuf) safeDrawImage(doc, sealBuf, 775, 20, { fit: [40, 40] });

      doc.fillColor("#0B1C30").fontSize(11).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), 75, 22, { width: 690, align: "center" });
      doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text(`GRILLE DE DÉLIBÉRATION OFFICIELLE • Classe : ${classe.label} • Filière : ${classe.filiereName}`, 75, 36, { width: 690, align: "center" });

      doc.moveTo(25, 55).lineTo(815, 55).lineWidth(1).strokeColor("#0B1C30").stroke();

      let y = 65;
      const colMatriculeW = 65;
      const colNameW = 140;
      const colSummaryW = 120;
      const availWidth = 790 - (colMatriculeW + colNameW + colSummaryW);
      const colSubW = offerings.length > 0 ? availWidth / offerings.length : 40;

      doc.rect(25, y, 790, 22).fill("#0B1C30");
      doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold");
      doc.text("Matricule", 30, y + 6, { width: colMatriculeW });
      doc.text("Nom & Prénom de l'Apprenant", 30 + colMatriculeW, y + 6, { width: colNameW });

      offerings.forEach((off, idx) => {
        const ox = 30 + colMatriculeW + colNameW + idx * colSubW;
        doc.text(`${off.subject?.code || off.subject?.name?.substring(0, 6)}\n(C${off.coefficient})`, ox, y + 3, { width: colSubW, align: "center" });
      });

      const sx = 30 + colMatriculeW + colNameW + offerings.length * colSubW;
      doc.text("Moyenne", sx, y + 6, { width: 45, align: "center" });
      doc.text("Rang", sx + 45, y + 6, { width: 30, align: "center" });
      doc.text("Décision", sx + 75, y + 6, { width: 45, align: "center" });

      y += 22;

      summaries.forEach((row) => {
        if (y > 480) {
          doc.addPage({ size: "A4", layout: "landscape", margins: { top: 20, bottom: 20, left: 25, right: 25 } });
          y = 25;
        }

        doc.rect(25, y, 790, 16).strokeColor("#CBD5E1").stroke();
        doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica");
        doc.font("Helvetica-Bold").text(row.student.matricule, 30, y + 4, { width: colMatriculeW });
        doc.font("Helvetica").text(`${row.student.lastName} ${row.student.firstName}`, 30 + colMatriculeW, y + 4, { width: colNameW, truncate: true });

        offerings.forEach((off, sidx) => {
          const ox = 30 + colMatriculeW + colNameW + sidx * colSubW;
          const subRes = row.subjects.find((s) => s.subjectId === off.subjectId);
          doc.text(subRes && subRes.finalGrade !== null ? String(subRes.finalGrade) : "—", ox, y + 4, { width: colSubW, align: "center" });
        });

        doc.font("Helvetica-Bold").text(row.semesterAverage !== null ? String(row.semesterAverage) : "—", sx, y + 4, { width: 45, align: "center" });
        doc.font("Helvetica").text(row.rank ? `${row.rank}e` : "—", sx + 45, y + 4, { width: 30, align: "center" });
        doc.font("Helvetica-Bold").fillColor(row.decision === "ADMIS" || row.decision === "VALIDÉ" || row.decision === "DIPLÔMÉ" ? "#2DCE89" : "#F5365C").text(row.decision, sx + 75, y + 4, { width: 45, align: "center" });

        y += 16;
      });

      y = Math.max(y + 20, 480);
      if (y > 510) {
        doc.addPage({ size: "A4", layout: "landscape", margins: { top: 20, bottom: 20, left: 25, right: 25 } });
        y = 30;
      }

      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
      doc.text("Le Jury de Délibération", 180, y + 10, { width: 200, align: "center" });
      doc.text("Le Directeur Général", 520, y + 10, { width: 200, align: "center" });

      doc.rect(25, 560, 790, 0.5).stroke("#CBD5E1");
      doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text("Procès-verbal de délibération • CECO ERP", 25, 568);
      doc.text("PROPULSÉ PAR CECO", 730, 568, { align: "right" });

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
  generateAttestationPdf,
  generateBatchAttestationsPdf,
  generateFicheInscriptionPdf,
  generateBlankGradeSheetPdf,
  generateCertifiedGradeSheetPdf,
  generateClassSemesterSummaryPdf,
  generateContinuousAssessmentBulletinPdf,
  generateBatchContinuousAssessmentBulletinsPdf,
  generateSemesterBulletinPdf,
  generateBatchSemesterBulletinsPdf,
  generateAnnualTranscriptPdf,
  generateBatchAnnualTranscriptsPdf,
  generateGraduationDiplomaPdf,
  generateBatchGraduationDiplomasPdf,
};