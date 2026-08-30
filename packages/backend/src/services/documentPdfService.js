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

// 1. Dessin de l'Avatar / Photo d'Identité avec Silhouette Vectorielle de Secours
function drawStudentAvatar(doc, photoBuf, x, y, width = 60, height = 60) {
  doc.save();
  // Fond doux pour l'avatar
  doc.rect(x, y, width, height).fillAndStroke("#F1F5F9", "#CBD5E1");

  if (photoBuf) {
    // clipper la zone pour forcer un rendu carré 4x4 centré
    try {
      doc.save();
      doc.rect(x + 1, y + 1, width - 2, height - 2).clip();
      // dessiner l'image centrée et redimensionnée pour tenir la zone
      safeDrawImage(doc, photoBuf, x + 1, y + 1, { fit: [width - 2, height - 2], align: "center", valign: "center" });
      doc.restore(); // restore clip
      doc.restore(); // restore outer save
      return;
    } catch (err) {
      try { doc.restore(); } catch (e) {}
    }
  }

  // Silhouette vectorielle stylisée (Bonhomme tête + buste) si pas de photo
  const cx = x + width / 2;
  const headRadius = width * 0.20;
  const headCy = y + height * 0.35;

  doc.fillColor("#94A3B8");
  // Tête
  doc.circle(cx, headCy, headRadius).fill();

  // Buste (arc de cercle doux clippé)
  doc.save();
  doc.rect(x + 2, y + 2, width - 4, height - 4).clip();
  doc.circle(cx, y + height * 1.05, width * 0.44).fill();
  doc.restore();

  doc.restore();
}

// 2. En-tête Bilingue Dynamique avec Centrage Automatique des Logos et Bandeau Arrêté
function drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, startY = 20, customWidth = 545, startX = 25) {
  const primaryColor = tmpl?.primaryColor || "#004080";
  const headerLeft = tmpl?.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE";
  const headerRight = tmpl?.headerRight || "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING";

  const colSideWidth = 195;
  const colCenterWidth = customWidth - (colSideWidth * 2); // ~155pt
  const centerColX = startX + colSideWidth;
  const rightColX = startX + customWidth - colSideWidth;

  // Volet Gauche (Français)
  doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(headerLeft, startX, startY, {
    width: colSideWidth,
    align: "center",
    lineGap: 1.2,
  });

  // Volet Droit (Anglais)
  doc.text(headerRight, rightColX, startY, {
    width: colSideWidth,
    align: "center",
    lineGap: 1.2,
  });

  // Bloc Central : Centrage dynamique des logos
  const showLogo = tmpl?.showLogo !== false && Boolean(logoBuf);
  const showSeal = tmpl?.showSeal !== false && Boolean(sealBuf);

  if (showLogo && showSeal) {
    // 2 logos actifs : côte à côte
    const imgSize = 40;
    const gap = 8;
    const totalImgW = (imgSize * 2) + gap;
    const imgStartX = centerColX + (colCenterWidth - totalImgW) / 2;

    safeDrawImage(doc, sealBuf, imgStartX, startY - 2, { fit: [imgSize, imgSize], align: "center" });
    safeDrawImage(doc, logoBuf, imgStartX + imgSize + gap, startY - 2, { fit: [imgSize, imgSize], align: "center" });
  } else if (showLogo || showSeal) {
    // 1 seul logo actif : centrage parfait
    const activeBuf = showSeal ? sealBuf : logoBuf;
    const imgSize = 46;
    const imgStartX = centerColX + (colCenterWidth - imgSize) / 2;
    safeDrawImage(doc, activeBuf, imgStartX, startY - 3, { fit: [imgSize, imgSize], align: "center" });
  }

  // Téléphones / Contacts sous les logos
  if (center.phone) {
    doc.fillColor("#475569").fontSize(6.5).font("Helvetica-Bold").text(`Tél : ${center.phone}`, centerColX, startY + 44, {
      width: colCenterWidth,
      align: "center",
    });
  }

  // Nom de l'établissement en grand
  doc.fillColor(primaryColor).fontSize(10.5).font("Helvetica-Bold").text(
    (center.name || "CENTRE DE FORMATION PROFESSIONNELLE").toUpperCase(),
    startX, startY + 56, { width: customWidth, align: "center" }
  );

  // Bandeau Arrêté Ministériel d'Agrément
  if (center.registrationNumber) {
    doc.rect(startX, startY + 70, customWidth, 13).fillAndStroke("#F8FAFC", "#CBD5E1");
    doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(
      `ARRETÉ D'AGRÉMENT N° ${center.registrationNumber} • ${center.city || "Cameroun"}`.toUpperCase(),
      startX, startY + 73.5, { width: customWidth, align: "center" }
    );
  }

  doc.moveTo(startX, startY + 86).lineTo(startX + customWidth, startY + 86).lineWidth(1.2).strokeColor(primaryColor).stroke();
}

function drawWatermark(doc, tmpl, logoBuf, sealBuf, x, y, size = 260) {
  if (tmpl?.showWatermark === false) return;
  const wmBuf = tmpl?.watermarkType === "seal" && sealBuf ? sealBuf : (logoBuf || sealBuf);
  if (!wmBuf) return;

  doc.save();
  doc.opacity(Number(tmpl?.watermarkOpacity) || 0.06);
  safeDrawImage(doc, wmBuf, x, y, { width: size, fit: [size, size]});
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

function drawDiplomaOrnamentalBorders(doc, width = 842, height = 595) {
  doc.save();
  doc.rect(18, 18, width - 36, height - 36).lineWidth(2).strokeColor("#004080").stroke();
  doc.rect(22, 22, width - 44, height - 44).lineWidth(0.8).strokeColor("#D4AF37").stroke();
  doc.rect(25, 25, width - 50, height - 50).lineWidth(0.4).strokeColor("#004080").stroke();

  const cornerSize = 22;
  const corners = [
    { x: 25, y: 25 },
    { x: width - 25 - cornerSize, y: 25 },
    { x: 25, y: height - 25 - cornerSize },
    { x: width - 25 - cornerSize, y: height - 25 - cornerSize },
  ];

  corners.forEach((c) => {
    doc.rect(c.x, c.y, cornerSize, cornerSize).fillAndStroke("#F8F9FF", "#D4AF37");
    doc.fillColor("#D4AF37").fontSize(8).font("Helvetica-Bold").text("❖", c.x + 5, c.y + 5);
  });
  doc.restore();
}

// 3. Double Grille Synoptique Récapitulative (Moyennes à Gauche, Profil & Décision à Droite)
function drawRecapMatrix(doc, totals, startX = 25, startY = 640, width = 545, height = 62) {
  const colLeftW = width * 0.44;
  const colRightW = width * 0.54;
  const gap = width * 0.02;
  const colRightX = startX + colLeftW + gap;

  // Colonne Gauche - Moyennes
  doc.rect(startX, startY, colLeftW, height).fillAndStroke("#FFFFFF", "#CBD5E1");

  const rowH = height / 5;
  const leftRows = [
    { label: "MOYENNE GÉNÉRALE", val: totals.overallAverage !== null ? `${totals.overallAverage} / 20` : "—", highlight: true },
    { label: "PLUS FORTE MOYENNE", val: totals.highestAverage !== null ? `${totals.highestAverage} / 20` : "—" },
    { label: "PLUS FAIBLE MOYENNE", val: totals.lowestAverage !== null ? `${totals.lowestAverage} / 20` : "—" },
    { label: "MOYENNE DE CLASSE", val: totals.classAverage !== null ? `${totals.classAverage} / 20` : "—" },
    { label: "TAUX DE RÉUSSITE", val: totals.classAverage !== null ? `${(totals.totalStudents > 0 ? ((totals.totalStudents - (totals.failedCount || 0)) / totals.totalStudents) * 100 : 100).toFixed(1)}%` : "100%" },
  ];

  leftRows.forEach((r, idx) => {
    const ry = startY + idx * rowH;
    if (idx > 0) doc.moveTo(startX, ry).lineTo(startX + colLeftW, ry).lineWidth(0.5).strokeColor("#E2E8F0").stroke();

    doc.fillColor("#475569").fontSize(6).font("Helvetica-Bold").text(r.label, startX + 6, ry + 3.5);

    if (r.highlight) {
      doc.rect(startX + colLeftW - 55, ry + 1, 53, rowH - 2).fill("#FFF275");
      doc.fillColor("#004080").fontSize(7.5).font("Helvetica-Bold").text(r.val, startX + colLeftW - 55, ry + 3, { width: 53, align: "center" });
    } else {
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(r.val, startX + colLeftW - 55, ry + 3.5, { width: 53, align: "center" });
    }
  });

  // Colonne Droite - Profil & Décision
  doc.rect(colRightX, startY, colRightW, height).fillAndStroke("#FFFFFF", "#CBD5E1");

  // Rang & Mention (Ligne 1)
  doc.rect(colRightX, startY, colRightW / 2, rowH).fill("#F8FAFC");
  doc.fillColor("#475569").fontSize(6).font("Helvetica-Bold").text("RANG :", colRightX + 4, startY + 3.5);
  doc.rect(colRightX + 35, startY + 1, 35, rowH - 2).fill("#FFF275");
  doc.fillColor("#004080").fontSize(7).font("Helvetica-Bold").text(totals.rank ? `${totals.rank}e / ${totals.totalStudents}` : "—", colRightX + 35, startY + 3, { width: 35, align: "center" });

  doc.rect(colRightX + colRightW / 2, startY, colRightW / 2, rowH).fill("#F8FAFC");
  doc.fillColor("#475569").fontSize(6).font("Helvetica-Bold").text("MENTION :", colRightX + colRightW / 2 + 4, startY + 3.5);
  doc.fillColor("#004080").fontSize(6.5).font("Helvetica-Bold").text((totals.mention || "PASSABLE").toUpperCase(), colRightX + colRightW / 2 + 42, startY + 3.5);

  // Décision Souveraine du Jury (Ligne 2)
  const decColor = totals.decision === "admis" || totals.decision === "valide" || totals.decision === "diplome" || (totals.overallAverage >= 10.0 && !totals.hasEliminatory) ? "#2DCE89" : "#F5365C";
  const decLabel = totals.decision === "diplome" ? "DIPLÔMÉ(E)" : (totals.overallAverage >= 10.0 && !totals.hasEliminatory ? "ADMIS(E) / VALIDÉ(E)" : "AJOURNÉ(E) / ÉCHOUÉ(E)");

  doc.rect(colRightX, startY + rowH, colRightW, rowH).fill("#F1F5F9");
  doc.fillColor(decColor).fontSize(7.5).font("Helvetica-Bold").text(`DÉCISION DU JURY : ${decLabel}`, colRightX, startY + rowH + 3, { width: colRightW, align: "center" });

  // Discipline (Ligne 3)
  const discColW = colRightW / 4;
  const discItems = ["RETARDS: 0", "ABSENCES: 0", "CONSIGNE: 0", "BLÂME: 0"];
  discItems.forEach((d, didx) => {
    const dx = colRightX + didx * discColW;
    doc.rect(dx, startY + rowH * 2, discColW, rowH).strokeColor("#E2E8F0").stroke();
    doc.fillColor("#64748B").fontSize(5.5).font("Helvetica").text(d, dx, startY + rowH * 2 + 3.5, { width: discColW, align: "center" });
  });

  // Observations / Visa (Ligne 4 & 5)
  doc.rect(colRightX, startY + rowH * 3, colRightW, rowH * 2).strokeColor("#CBD5E1").stroke();
  doc.fillColor("#475569").fontSize(5.5).font("Helvetica-Bold").text("OBSERVATIONS / VISA DE L'ÉTABLISSEMENT :", colRightX + 4, startY + rowH * 3 + 2.5);
  doc.fillColor("#0F172A").fontSize(6).font("Helvetica-Oblique").text("Travail régulier et assidu. Poursuivez dans cette voie d'excellence.", colRightX + 4, startY + rowH * 3 + 11);
}

// 4. Rendu des Signataires et du QR Code Autonome Hors-Ligne (Ultra-Compact)
function renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, signatories = [], startY = 708, customWidth = 545, startX = 25) {
  const { center = {}, templateConfig: tmpl = {} } = snapshot;
  const primaryColor = tmpl.primaryColor || "#004080";

  // Date et Lieu
  doc.fillColor("#0F172A").fontSize(7).font("Helvetica").text(
    `Fait à ${center.city || "Bafoussam"}, le ${new Date().toLocaleDateString("fr-FR")}`,
    startX + customWidth - 200, startY - 10, { width: 200, align: "right" }
  );

  // QR Code Hors-Ligne à gauche (si présent)
  if (qrBuf) {
    safeDrawImage(doc, qrBuf, startX, startY, { width: 48, height: 48 });
    doc.fillColor("#64748B").fontSize(4.5).font("Courier").text(snapshot.qrToken || "", startX, startY + 50, { width: 90 });
  }

  const sigStartX = qrBuf ? startX + 95 : startX;
  const sigWidth = qrBuf ? customWidth - 95 : customWidth;

  const count = signatories.length || 2;
  const colW = sigWidth / count;

  signatories.forEach((sig, idx) => {
    const sx = sigStartX + idx * colW;
    const title = sig.title || (idx === 0 ? "Le Promoteur" : "Le Directeur Général");
    const roleKey = sig.roleKey || (idx === 0 ? "promoteur" : "directeur");
    const sigBuf = bufferFromDataUrl(center.signatures?.[roleKey] || (idx === count - 1 ? center.signatures?.directeur : null));

    doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold").text(title, sx, startY + 2, { width: colW, align: "center" });
    doc.fontSize(5.5).font("Helvetica").text("(Cachet et Signature)", sx, startY + 11, { width: colW, align: "center" });

    if (sigBuf) {
      safeDrawImage(doc, sigBuf, sx + (colW - 75) / 2, startY + 18, { fit: [75, 26], align: "center" });
    }
  });

  // Ligne légale de bas de page
  doc.rect(startX, 775, customWidth, 0.5).stroke("#CBD5E1");
  doc.fillColor("#64748B").fontSize(6).font("Helvetica").text(
    tmpl.footerLegal || "Document officiel certifié conforme • Toute rature annule la validité du présent acte.",
    startX, 780, { width: customWidth - 110 }
  );
  doc.fillColor(primaryColor).fontSize(6).font("Helvetica-Bold").text("PROPULSÉ PAR CECO ERP", startX + customWidth - 100, 780, { align: "right" });
}

// ============================================================================
// 1. CARTE D'APPRENANT INDIVIDUELLE (CR80)
// ============================================================================
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

      const themeColor = tmpl.themeColor || "#004080";
      const accentColor = tmpl.accentColor || "#5E72E4";

      // RECTO
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

      // VERSO
      doc.addPage({ size: [243, 153], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      doc.rect(0, 0, 243, 153).fill("#FFFFFF");

      drawWatermark(doc, tmpl, logoBuf, sealBuf, 75, 35, 95);

      doc.fillColor(themeColor).fontSize(6.5).font("Helvetica-Bold").text("CONDITIONS D'UTILISATION", 8, 8);
      doc.fillColor("#475569").fontSize(4.5).font("Helvetica").text(
        tmpl.termsOfUse || "Carte officielle d'apprenant. Présentation obligatoire aux examens et évaluations. En cas de perte, rapporter à la direction.",
        8, 17, { width: 227, lineGap: 1 }
      );

      safeDrawImage(doc, qrBuf, 8, 54, { width: 46, height: 46 });
      doc.fillColor("#64748B").fontSize(4.5).font("Helvetica-Bold").text("Contrôle d'authenticité :", 60, 58);
      doc.fillColor(accentColor).fontSize(4.5).font("Courier").text(snapshot.qrToken || "CECO-OFFICIAL", 60, 68, { width: 175 });

      if (sigBuf) safeDrawImage(doc, sigBuf, 160, 78, { fit: [65, 24], align: "center" });
      doc.fillColor("#0F172A").fontSize(5.5).font("Helvetica-Bold").text(tmpl.signatoryTitle || center.directorTitle || "Le Directeur Général", 150, 106, { width: 85, align: "center" });

      doc.rect(0, 132, 243, 21).fill("#0B1C30");
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

// ============================================================================
// 2. PLANCHE A4 DUPLEX DE BADGES AVEC REPÈRES DE COUPE
// ============================================================================
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

          drawWatermark(doc, tmpl, logoBuf, sealBuf, x + 75, y + 40, 95);

          doc.rect(x, y, cardW, 28).fill(tmpl.themeColor || "#004080");

          if (tmpl.showLogo !== false && logoBuf) safeDrawImage(doc, logoBuf, x + 8, y + 4, { fit: [20, 20] });
          doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold").text((snap.center.name || "").toUpperCase(), x + 32, y + 6, { width: 190, truncate: true });
          doc.fillColor("#CBD5E1").fontSize(5.5).font("Helvetica-Bold").text(tmpl.cardTitle || "CARTE D'APPRENANT OFFICIELLE", x + 32, y + 16);
          if (tmpl.showSeal !== false && sealBuf) safeDrawImage(doc, sealBuf, x + 228, y + 4, { fit: [20, 20] });

          // forcer l'avatar en carré 4x4 sur la vignette carte
          drawStudentAvatar(doc, photoBuf, x + 12, y + 46, 56, 56);

          const ix = x + 76;
          let iy = y + 46;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("NOM :", ix, iy, {continued: true});
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text((snap.student.lastName || "").toUpperCase(), { width: 155, truncate: true });

          iy += 11;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("PRÉNOM :", ix, iy, {continued: true});
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(snap.student.firstName || "", { width: 155, truncate: true });

          iy += 11;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("MATRICULE :", ix, iy, {continued: true});
          doc.fillColor(tmpl.accentColor || "#5E72E4").fontSize(6.5).font("Helvetica-Bold").text(snap.student.matricule || "—", { width: 155, truncate: true });

          iy += 11;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("FILIÈRE :", ix, iy, {continued: true});
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica").text(snap.classe?.filiereName || "—", { width: 155, truncate: true });

          iy += 11;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("NIVEAU :", ix, iy);
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(`Niveau ${snap.classe?.niveauOrder || 1} (${snap.classe?.programTypeCode || "DQP"})`, ix + 28, iy);

          
          iy += 11;
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("COHORTE :", ix, iy, { continued: true });
          doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica").text(snap.classe?.promotionLabel || snap.classe?.academicYearLabel || "—", { width: 145, truncate: true });

          doc.rect(x, y + 146, cardW, 19).fill("#F8FAFC");
          doc.fillColor("#475569").fontSize(5).font("Helvetica").text(`Agrément : ${snap.center.registrationNumber || "MINEFOP"}`, x + 8, y + 152);
          doc.fillColor(tmpl.accentColor || "#5E72E4").fontSize(5.5).font("Helvetica-Bold").text("CECO ID-PASS", x + 195, y + 152);
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
          const logoBuf = bufferFromDataUrl(snap.center?.logoDataUrl);
          const sealBuf = bufferFromDataUrl(snap.center?.sealDataUrl);

          doc.rect(x, y, cardW, cardH).lineWidth(0.5).strokeColor("#CBD5E1").fillAndStroke("#FFFFFF", "#CBD5E1");

          drawWatermark(doc, tmpl, logoBuf, sealBuf, x + 75, y + 35, 95);
          
          doc.fillColor(tmpl.themeColor || "#004080").fontSize(6.5).font("Helvetica-Bold").text("CONDITIONS D'UTILISATION", x + 8, y + 8);
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
// 3. BULLETIN SEMESTRIEL BILINGUE (A4 PORTRAIT) — MODÈLE HAUTE DENSITÉ
// ============================================================================
function renderSingleSemesterBulletinPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, period = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#004080";

  const startX = 25;
  const fullWidth = 545;

  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 280);
  drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 18, fullWidth, startX);

  // Bandeau Titre Officiel (Bleu Nuit avec Liserés Or/Orange)
  const titleY = 108;
  doc.rect(startX, titleY, fullWidth, 20).fillAndStroke(primaryColor, "#FFA500");
  doc.rect(startX, titleY, fullWidth, 1.5).fill("#FFA500");
  doc.rect(startX, titleY + 18.5, fullWidth, 1.5).fill("#FF8C00");
  doc.fillColor("#FFFFFF").fontSize(8.5).font("Helvetica-Bold").text(
    `RELEVÉ DE NOTES DU ${period.label ? period.label.toUpperCase() : "SEMESTRE 1"} • SESSION ACADÉMIQUE ${classe.academicYearLabel || "2026-2027"}`,
    startX, titleY + 5.5, { width: fullWidth, align: "center" }
  );

  // Cartouche Informations Apprenant
  const infoY = 132;
  const infoH = 58;
  const photoW = 54;
  const textW = fullWidth - photoW - 6;

  doc.rect(startX, infoY, textW, infoH).fillAndStroke("#F8FAFC", "#CBD5E1");

  // Nom en surbrillance bleu clair
  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("NOM & PRÉNOM :", startX + 8, infoY + 6);
  doc.rect(startX + 80, infoY + 3.5, 230, 13).fill("#E6F0FF");
  doc.fillColor("#004080").fontSize(8).font("Helvetica-Bold").text(
    `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`,
    startX + 84, infoY + 5.5, { width: 222, truncate: true }
  );

  // Sexe & Matricule (Surbrillance)
  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("SEXE :", startX + 8, infoY + 20);
  doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica").text(student.gender === "F" ? "Féminin" : "Masculin", startX + 42, infoY + 20);

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("MATRICULE :", startX + 130, infoY + 20);
  doc.rect(startX + 185, infoY + 18, 125, 11).fill("#FFF275");
  doc.fillColor("#004080").fontSize(7.5).font("Courier-Bold").text(student.matricule || "—", startX + 188, infoY + 19.5);

  // Date et Lieu de naissance
  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("NÉ(E) LE :", startX + 8, infoY + 33);
  const birthStr = `${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "Non renseignée"}${student.birthPlace ? ` à ${student.birthPlace}` : ""}`;
  doc.fillColor("#0F172A").fontSize(7).font("Helvetica").text(birthStr, startX + 48, infoY + 33, { width: 260, truncate: true });

  // Filière avec Badge Vert Clair
  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("FILIÈRE :", startX + 8, infoY + 45);
  doc.rect(startX + 48, infoY + 43, 262, 11).fill("#D4EDDA");
  doc.fillColor("#155724").fontSize(7).font("Helvetica-Bold").text(
    `${classe.filiereName || "—"} (Niveau ${classe.niveauOrder || 1} • ${classe.programTypeCode || "DQP"})`,
    startX + 52, infoY + 44.5, { width: 254, truncate: true }
  );

  // Photo / Silhouette propre à droite
  drawStudentAvatar(doc, photoBuf, startX + textW + 6, infoY, photoW, infoH);

  // Tableau des Notes & Catégories (Haute Densité)
  let y = 194;
  doc.rect(startX, y, fullWidth, 14).fill("#E8F5E9");
  doc.fillColor("#1B5E20").fontSize(6.5).font("Helvetica-Bold").text(
    `NOTES DES MODULES ENSEIGNÉS DURANT LE ${period.order === 2 ? "SECOND" : "PREMIER"} SEMESTRE`,
    startX, y + 3.5, { width: fullWidth, align: "center" }
  );

  y += 14;

  // En-tête du tableau
  doc.rect(startX, y, fullWidth, 15).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(6).font("Helvetica-Bold");

  const colModW = 160;
  const colCcW = 38;
  const colExamW = 42;
  const colCoefW = 28;
  const colTotW = 44;
  const colAppW = 60;
  const colRangW = 26;
  const colValW = 28;
  const colProfW = fullWidth - (colModW + colCcW + colExamW + colCoefW + colTotW + colAppW + colRangW + colValW); // ~119pt

  doc.text("MODULES / DISCIPLINES", startX + 4, y + 4.5, { width: colModW });
  doc.text("CC /20", startX + colModW, y + 4.5, { width: colCcW, align: "center" });
  doc.text("EXAM /20", startX + colModW + colCcW, y + 4.5, { width: colExamW, align: "center" });
  doc.text("COEF", startX + colModW + colCcW + colExamW, y + 4.5, { width: colCoefW, align: "center" });
  doc.text("NOTE*COEF", startX + colModW + colCcW + colExamW + colCoefW, y + 4.5, { width: colTotW, align: "center" });
  doc.text("APPRÉCIATION", startX + colModW + colCcW + colExamW + colCoefW + colTotW, y + 4.5, { width: colAppW, align: "center" });
  doc.text("RANG", startX + colModW + colCcW + colExamW + colCoefW + colTotW + colAppW, y + 4.5, { width: colRangW, align: "center" });
  doc.text("VAL.", startX + colModW + colCcW + colExamW + colCoefW + colTotW + colAppW + colRangW, y + 4.5, { width: colValW, align: "center" });
  doc.text("ENSEIGNANT", startX + fullWidth - colProfW + 4, y + 4.5, { width: colProfW - 4 });

  y += 15;

  categories.forEach((cat) => {
    // Bandeau sous-groupe / catégorie
    doc.rect(startX, y, fullWidth, 12).fill("#E2E8F0");
    doc.fillColor("#0F172A").fontSize(6).font("Helvetica-Bold").text(
      `${cat.name.toUpperCase()} (Total Coef : ${cat.totalCoeff} • Moyenne Groupe : ${cat.groupAverage !== null ? `${cat.groupAverage}/20` : "—"})`,
      startX + 4, y + 3
    );
    y += 12;

    cat.subjects.forEach((sub) => {
      doc.rect(startX, y, fullWidth, 13).strokeColor("#CBD5E1").stroke();
      doc.fillColor("#0F172A").fontSize(6).font("Helvetica");

      // Nom de matière
      doc.text(`${sub.code ? `[${sub.code}] ` : ""}${sub.name}`, startX + 4, y + 3.5, { width: colModW - 4, truncate: true });

      // Note CC
      doc.text(sub.ccAverage, startX + colModW, y + 3.5, { width: colCcW, align: "center" });

      // Note Examen (avec rattrapage intégré si supérieur)
      doc.text(sub.examGrade, startX + colModW + colCcW, y + 3.5, { width: colExamW, align: "center" });

      // Coefficient
      doc.text(String(sub.coefficient), startX + colModW + colCcW + colExamW, y + 3.5, { width: colCoefW, align: "center" });

      // Points (Note * Coef)
      doc.font("Helvetica-Bold").text(sub.points, startX + colModW + colCcW + colExamW + colCoefW, y + 3.5, { width: colTotW, align: "center" });

      // Pastille couleur pour appréciation
      const finalNum = parseFloat(sub.finalGrade);
      let appBg = "#F1F5F9";
      let appFg = "#475569";
      if (finalNum < 10) { appBg = "#FEEBEF"; appFg = "#F5365C"; }
      else if (finalNum < 12) { appBg = "#FFF3CD"; appFg = "#856404"; }
      else if (finalNum < 14) { appBg = "#E8F4FD"; appFg = "#0C5460"; }
      else { appBg = "#D4EDDA"; appFg = "#155724"; }

      const appBoxX = startX + colModW + colCcW + colExamW + colCoefW + colTotW + 3;
      doc.rect(appBoxX, y + 1.5, colAppW - 6, 10).fill(appBg);
      doc.fillColor(appFg).fontSize(5.5).font("Helvetica-Bold").text(sub.appreciation, appBoxX, y + 3, { width: colAppW - 6, align: "center" });

      // Rang & Validation
      doc.fillColor("#0F172A").fontSize(6).font("Helvetica").text(String(sub.rank || "—"), startX + colModW + colCcW + colExamW + colCoefW + colTotW + colAppW, y + 3.5, { width: colRangW, align: "center" });
      doc.font("Helvetica-Bold").fillColor(sub.isValid ? "#155724" : "#721C24").text(sub.isValid ? "Oui" : "Non", startX + colModW + colCcW + colExamW + colCoefW + colTotW + colAppW + colRangW, y + 3.5, { width: colValW, align: "center" });

      // Enseignant
      doc.fillColor("#475569").fontSize(5.5).font("Helvetica").text(sub.formateurName || "—", startX + fullWidth - colProfW + 4, y + 3.5, { width: colProfW - 4, truncate: true });

      y += 13;
    });
  });

  // Ligne de Total Général
  doc.rect(startX, y, fullWidth, 14).fill("#F0F0F0");
  doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold");
  doc.text("TOTAL GÉNÉRAL", startX + 4, y + 3.5, { width: colModW + colCcW + colExamW });
  doc.text(String(totals.totalCoefficients), startX + colModW + colCcW + colExamW, y + 3.5, { width: colCoefW, align: "center" });

  doc.rect(startX + colModW + colCcW + colExamW + colCoefW, y + 1, colTotW, 12).fill(primaryColor);
  doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold").text(String(totals.totalPoints), startX + colModW + colCcW + colExamW + colCoefW, y + 3, { width: colTotW, align: "center" });

  // Double Grille Synoptique Récapitulative
  drawRecapMatrix(doc, totals, startX, 640, fullWidth, 58);

  // Bas de page, Signatures & QR Code Hors-Ligne
  const signatories = tmpl.signatories || [
    { title: "Le Promoteur", roleKey: "promoteur" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];
  renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, signatories, 706, fullWidth, startX);
}

async function generateSemesterBulletinPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-BULLETIN", { margin: 0, width: 80 });
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
      const doc = new PDFDocument({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 } });
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-BULLETIN", { margin: 0, width: 80 });
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
// 4. BULLETIN DE CONTRÔLE CONTINU (CC & TP)
// ============================================================================
function renderSingleContinuousAssessmentBulletinPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, period = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#004080";

  const startX = 25;
  const fullWidth = 545;

  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 280);
  drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 18, fullWidth, startX);

  const titleY = 108;
  doc.rect(startX, titleY, fullWidth, 20).fillAndStroke(primaryColor, "#FFA500");
  doc.rect(startX, titleY, fullWidth, 1.5).fill("#FFA500");
  doc.rect(startX, titleY + 18.5, fullWidth, 1.5).fill("#FF8C00");
  doc.fillColor("#FFFFFF").fontSize(8.5).font("Helvetica-Bold").text(
    `BULLETIN D'ÉVALUATION CONTINUE (CC & TP) • ${period.label ? period.label.toUpperCase() : "SEMESTRE 1"} • ${classe.academicYearLabel || "2026-2027"}`,
    startX, titleY + 5.5, { width: fullWidth, align: "center" }
  );

  const infoY = 132;
  const infoH = 58;
  const photoW = 54;
  const textW = fullWidth - photoW - 6;

  doc.rect(startX, infoY, textW, infoH).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("NOM & PRÉNOM :", startX + 8, infoY + 6);
  doc.rect(startX + 80, infoY + 3.5, 230, 13).fill("#E6F0FF");
  doc.fillColor("#004080").fontSize(8).font("Helvetica-Bold").text(
    `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`,
    startX + 84, infoY + 5.5, { width: 222, truncate: true }
  );

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("SEXE :", startX + 8, infoY + 20);
  doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica").text(student.gender === "F" ? "Féminin" : "Masculin", startX + 42, infoY + 20);

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("MATRICULE :", startX + 130, infoY + 20);
  doc.rect(startX + 185, infoY + 18, 125, 11).fill("#FFF275");
  doc.fillColor("#004080").fontSize(7.5).font("Courier-Bold").text(student.matricule || "—", startX + 188, infoY + 19.5);

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

  const colModW2 = 200;
  const colCoefW2 = 35;
  const colCcW2 = 55;
  const colTotW2 = 55;
  const colAppW2 = 70;
  const colProfW2 = fullWidth - (colModW2 + colCoefW2 + colCcW2 + colTotW2 + colAppW2);

  doc.text("MODULES / DISCIPLINES", startX + 4, y + 4.5, { width: colModW2 });
  doc.text("COEF", startX + colModW2, y + 4.5, { width: colCoefW2, align: "center" });
  doc.text("MOY. CC /20", startX + colModW2 + colCoefW2, y + 4.5, { width: colCcW2, align: "center" });
  doc.text("POINTS (CC*COEF)", startX + colModW2 + colCoefW2 + colCcW2, y + 4.5, { width: colTotW2, align: "center" });
  doc.text("APPRÉCIATION", startX + colModW2 + colCoefW2 + colCcW2 + colTotW2, y + 4.5, { width: colAppW2, align: "center" });
  doc.text("ENSEIGNANT", startX + fullWidth - colProfW2 + 4, y + 4.5, { width: colProfW2 - 4 });

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
      doc.text(`${sub.code ? `[${sub.code}] ` : ""}${sub.name}`, startX + 4, y + 3.5, { width: colModW2 - 4, truncate: true });
      doc.text(String(sub.coefficient), startX + colModW2, y + 3.5, { width: colCoefW2, align: "center" });
      doc.font("Helvetica-Bold").text(sub.ccAverage, startX + colModW2 + colCoefW2, y + 3.5, { width: colCcW2, align: "center" });

      const ccNum = parseFloat(sub.ccAverage);
      const ccPoints = !isNaN(ccNum) ? (ccNum * sub.coefficient).toFixed(2) : "—";
      doc.text(ccPoints, startX + colModW2 + colCoefW2 + colCcW2, y + 3.5, { width: colTotW2, align: "center" });

      doc.font("Helvetica").text(sub.appreciation, startX + colModW2 + colCoefW2 + colCcW2 + colTotW2, y + 3.5, { width: colAppW2, align: "center" });
      doc.text(sub.formateurName || "—", startX + fullWidth - colProfW2 + 4, y + 3.5, { width: colProfW2 - 4, truncate: true });
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

async function generateContinuousAssessmentBulletinPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
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
      const doc = new PDFDocument({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 18, bottom: 20, left: 25, right: 25 } });
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
// 5. RELEVÉ DE NOTES ANNUEL / ACADEMIC TRANSCRIPT (A4 PORTRAIT)
// ============================================================================
function renderSingleAnnualTranscriptPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, categories = [], totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);
  const primaryColor = tmpl.primaryColor || "#004080";

  const startX = 25;
  const fullWidth = 545;

  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 280);
  drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 18, fullWidth, startX);

  const titleY = 108;
  doc.rect(startX, titleY, fullWidth, 20).fillAndStroke(primaryColor, "#FFA500");
  doc.rect(startX, titleY, fullWidth, 1.5).fill("#FFA500");
  doc.rect(startX, titleY + 18.5, fullWidth, 1.5).fill("#FF8C00");
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
  doc.fillColor("#004080").fontSize(8).font("Helvetica-Bold").text(
    `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`,
    startX + 84, infoY + 5.5, { width: 222, truncate: true }
  );

  doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("MATRICULE :", startX + 8, infoY + 20);
  doc.rect(startX + 60, infoY + 18, 120, 11).fill("#FFF275");
  doc.fillColor("#004080").fontSize(7.5).font("Courier-Bold").text(student.matricule || "—", startX + 63, infoY + 19.5);

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
      doc.font("Helvetica-Bold").fillColor(sub.isValid ? "#155724" : "#721C24").text(sub.isValid ? "Oui" : "Non", startX + fullWidth - colValW3, y + 3.5, { width: colValW3, align: "center" });
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

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-TRANSCRIPT", { margin: 0, width: 80 });
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
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-TRANSCRIPT", { margin: 0, width: 80 });
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
// 6. DIPLÔME DE FIN DE FORMATION (A4 PAYSAGE ORNEMENTAL)
// ============================================================================
function renderSingleGraduationDiplomaPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, totals = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const primaryColor = tmpl.primaryColor || "#004080";

  drawDiplomaOrnamentalBorders(doc, 842, 595);
  drawWatermark(doc, tmpl, logoBuf, sealBuf, 270, 140, 300);

  // En-tête officiel bilingue Paysage
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

  doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text((center.name || "ÉTABLISSEMENT DE FORMATION").toUpperCase(), 50, 115, { width: 742, align: "center" });
  doc.fillColor("#64748B").fontSize(8).font("Helvetica").text(
    `Agrément Ministériel N° : ${center.registrationNumber || "MINEFOP"} • ${center.city || "Cameroun"}`,
    50, 133, { width: 742, align: "center" }
  );

  doc.fillColor("#C39B52").fontSize(20).font("Times-Bold").text("DIPLÔME DE FIN DE FORMATION PROFESSIONNELLE", 50, 160, { width: 742, align: "center" });
  doc.fillColor("#475569").fontSize(10).font("Times-Italic").text("VOCATIONAL GRADUATION DIPLOMA", 50, 185, { width: 742, align: "center" });

  doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(
    `Vu la loi portant orientation de la formation professionnelle au Cameroun ;\nVu l'arrêté d'agrément de l'établissement susmentionné ;\nSur proposition du jury de délibération souverain réuni en date officielle ;`,
    75, 215, { width: 692, align: "center", lineGap: 3 }
  );

  doc.fillColor(primaryColor).fontSize(11).font("Times-Bold").text("LE PRÉSENT DIPLÔME EST DÉCERNÉ À :", 50, 268, { width: 742, align: "center" });

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
  safeDrawImage(doc, qrBuf, 75, sigY, { width: 72, height: 72 });
  doc.fillColor("#64748B").fontSize(5.5).font("Courier").text(snapshot.qrToken || "", 75, sigY + 76, { width: 140 });

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
// 7. CERTIFICAT DE SCOLARITÉ INDIVIDUEL ET LOT (A4 PORTRAIT)
// ============================================================================
function renderSingleAttestationPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const primaryColor = tmpl.primaryColor || "#004080";

  const startX = 25;
  const fullWidth = 545;

  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 300);
  drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 20, fullWidth, startX);

  doc.fillColor("#0F172A").fontSize(13).font("Helvetica-Bold").text(tmpl.documentTitle || "CERTIFICAT DE SCOLARITÉ & D'INSCRIPTION", startX, 135, { width: fullWidth, align: "center", underline: true });
  if (tmpl.subTitle) {
    doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text(tmpl.subTitle, startX, 153, { width: fullWidth, align: "center" });
  }

  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica").text(
    `Je soussigné, ${center.directorName ? center.directorName : "La Direction Générale"}, en qualité de ${center.directorTitle || "Directeur Général"} de l'établissement susmentionné, certifie par la présente que :`,
    startX, 180, { width: fullWidth, lineGap: 3 }
  );

  doc.rect(startX, 210, fullWidth, 95).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("L'Apprenant(e) :", startX + 15, 223);
  doc.fillColor("#004080").fontSize(11).font("Helvetica-Bold").text(`${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`, startX + 125, 221);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Matricule Officiel :", startX + 15, 240);
  doc.fillColor(primaryColor).fontSize(9.5).font("Courier-Bold").text(student.matricule || "—", startX + 125, 240);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Date / Lieu Naissance :", startX + 15, 257);
  const birthStr = `${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "Non renseignée"}${student.birthPlace ? ` à ${student.birthPlace}` : ""}`;
  doc.fillColor("#0F172A").fontSize(9).font("Helvetica").text(birthStr, startX + 125, 257);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Filière d'Études :", startX + 15, 274);
  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica-Bold").text(`${classe.filiereName || "—"} (${classe.programTypeCode || "DQP"})`, startX + 125, 274);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Niveau / Promotion :", startX + 15, 289);
  doc.fillColor("#0F172A").fontSize(9).font("Helvetica").text(`Niveau ${classe.niveauOrder || 1} • ${classe.promotionLabel || `Session ${classe.academicYearLabel}`}`, startX + 125, 289);

  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica").text(
    "Est régulièrement inscrit(e) et poursuit avec assiduité son cycle de formation professionnelle au sein de notre établissement pour la session académique en cours.",
    startX, 325, { width: fullWidth, lineGap: 3.5 }
  );
  doc.text("En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.", startX, 360, { width: fullWidth });

  const signatories = tmpl.signatories || [
    { title: "Le Promoteur", roleKey: "promoteur" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ];
  renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, signatories, 650, fullWidth, startX);
}

async function generateAttestationPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-ATTESTATION", { margin: 0, width: 80 });
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
      const doc = new PDFDocument({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 } });
        const qrBuf = await QRCode.toBuffer(qrPayloadsList[i] || snapshotsList[i].qrToken || "CECO-ATTESTATION", { margin: 0, width: 80 });
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
// 8. FICHE INDIVIDUELLE D'INSCRIPTION A4 (INTERNE)
// ============================================================================
async function generateFicheInscriptionPdf(snapshot, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const photoBuf = bufferFromDataUrl(student.photoDataUrl);
      const primaryColor = tmpl.primaryColor || "#004080";

      const startX = 25;
      const fullWidth = 545;

      drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 300);
      drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, 20, fullWidth, startX);

      doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text(tmpl.documentTitle || "FICHE INDIVIDUELLE D'INSCRIPTION & D'ENGAGEMENT", startX, 120, { width: fullWidth, align: "center", underline: true });
      doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold").text(`SESSION ACADÉMIQUE : ${classe.academicYearLabel || "—"} • ${classe.promotionLabel || ""}`, startX, 135, { width: fullWidth, align: "center" });

      const photoW = 85;
      const photoH = 115;
      drawStudentAvatar(doc, photoBuf, startX + fullWidth - photoW, 155, photoW, photoH);

      doc.rect(startX, 155, fullWidth - photoW - 10, photoH).fillAndStroke("#F8FAFC", "#CBD5E1");
      let ly = 163;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Matricule Officiel :", startX + 10, ly);
      doc.fillColor(primaryColor).fontSize(8.5).font("Courier-Bold").text(student.matricule || "—", startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Nom de famille :", startX + 10, ly);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text((student.lastName || "").toUpperCase(), startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Prénom(s) :", startX + 10, ly);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text(student.firstName || "", startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Genre / Naissance :", startX + 10, ly);
      const genreBirth = `${student.gender === "F" ? "Féminin" : "Masculin"} • Né(e) le ${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—"}${student.birthPlace ? ` à ${student.birthPlace}` : ""}`;
      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica").text(genreBirth, startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Contact Apprenant :", startX + 10, ly);
      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica").text(student.phone || "Non renseigné", startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Parent / Tuteur :", startX + 10, ly);
      const parentInfo = `${student.guardianName || "Non renseigné"}${student.guardianPhone ? ` (${student.guardianPhone})` : ""}`;
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold").text(parentInfo, startX + 130, ly);

      ly += 15;
      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Diplôme d'entrée :", startX + 10, ly);
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(student.entryDiploma || "Aucun / Entrée directe", startX + 130, ly);

      doc.rect(startX, 280, fullWidth, 55).fillAndStroke("#FFFFFF", "#CBD5E1");
      doc.rect(startX, 280, fullWidth, 16).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold").text("AFFECTATION PÉDAGOGIQUE & CYCLE CHOISI", startX + 10, 284.5);

      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Filière de formation :", startX + 10, 303);
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold").text(`${classe.filiereName || "—"} (${classe.programTypeCode || "DQP"})`, startX + 130, 303);

      doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("Classe & Promotion :", startX + 10, 319);
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica").text(`${classe.label || "—"} • ${classe.promotionLabel || ""}`, startX + 130, 319);

      doc.rect(startX, 345, fullWidth, 75).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold").text("ENGAGEMENT DE L'APPRENANT(E) :", startX + 10, 355);
      doc.fillColor("#334155").fontSize(7.5).font("Helvetica").text(
        tmpl.engagementText || "Je soussigné(e), certifie sur l'honneur l'exactitude des informations mentionnées ci-dessus et déclare avoir pris pleine connaissance du règlement intérieur de l'établissement. Je m'engage à faire preuve d'assiduité, de rigueur et de probité tout au long de mon cycle de formation.",
        startX + 10, 368, { width: fullWidth - 20, lineGap: 2.5 }
      );

      const signatories = tmpl.signatories || [
        { title: "Signature de l'Apprenant(e)", roleKey: "student" },
        { title: "Visa de la Direction", roleKey: "directeur" },
      ];
      renderSignatoriesAndQrCompact(doc, snapshot, null, signatories, 650, fullWidth, startX);

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
      const doc = new PDFDocument({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, offering = {}, students = [] } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);

      const startX = 25;
      const fullWidth = 545;

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.05 }, logoBuf, sealBuf, 130, 260, 280);

      doc.fillColor("#004080").fontSize(11).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), startX, 22, { width: fullWidth, align: "center" });
      doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(`Agrément : ${center.registrationNumber || "MINEFOP"} • ${center.city || "Cameroun"}`, startX, 36, { width: fullWidth, align: "center" });

      doc.moveTo(startX, 50).lineTo(startX + fullWidth, 50).lineWidth(1).strokeColor("#004080").stroke();

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
      doc.rect(startX, y, fullWidth, 18).fill("#004080");
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

// ============================================================================
// 10. PV MATIÈRE OFFICIEL SCELLÉ (A4 PORTRAIT)
// ============================================================================
async function generateCertifiedGradeSheetPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 20, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, offering = {}, rows = [], stats = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);

      const startX = 25;
      const fullWidth = 545;

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.06 }, logoBuf, sealBuf, 130, 260, 280);

      doc.fillColor("#0F172A").fontSize(7).font("Helvetica-Bold").text("RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE", startX, 22, { width: 195, align: "center", lineGap: 1.2 });
      doc.text("REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING", startX + fullWidth - 195, 22, { width: 195, align: "center", lineGap: 1.2 });

      if (sealBuf) safeDrawImage(doc, sealBuf, startX + (fullWidth - 40) / 2, 20, { fit: [40, 40], align: "center" });

      doc.fillColor("#004080").fontSize(10.5).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), startX, 68, { width: fullWidth, align: "center" });
      doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(`Agrément : ${center.registrationNumber || "MINEFOP"} • ${center.city || "Cameroun"}`, startX, 81, { width: fullWidth, align: "center" });

      doc.moveTo(startX, 94).lineTo(startX + fullWidth, 94).lineWidth(1.2).strokeColor("#004080").stroke();

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
      doc.rect(startX, y, fullWidth, 16).fill("#004080");
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
        doc.font("Helvetica-Bold").fillColor(row.isValid ? "#155724" : "#721C24").text(row.isValid ? "Oui" : "Non", startX + 485, y + 3.5, { width: 55, align: "center" });

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

// ============================================================================
// 11. PV SYNOPTIQUE DE DÉLIBÉRATION DE CLASSE (A4 PAYSAGE)
// ============================================================================
async function generateClassSemesterSummaryPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: 18, bottom: 20, left: 25, right: 25 }, autoFirstPage: true });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, classe = {}, offerings = [], summaries = [] } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.05 }, logoBuf, sealBuf, 250, 130, 300);

      if (logoBuf) safeDrawImage(doc, logoBuf, 25, 18, { fit: [38, 38] });
      if (sealBuf) safeDrawImage(doc, sealBuf, 775, 18, { fit: [38, 38] });

      doc.fillColor("#004080").fontSize(11).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), 75, 20, { width: 690, align: "center" });
      doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(`GRILLE DE DÉLIBÉRATION OFFICIELLE • Classe : ${classe.label} • Filière : ${classe.filiereName}`, 75, 33, { width: 690, align: "center" });

      doc.moveTo(25, 50).lineTo(815, 50).lineWidth(1).strokeColor("#004080").stroke();

      let y = 58;
      const colMatriculeW = 65;
      const colNameW = 140;
      const colSummaryW = 120;
      const availWidth = 790 - (colMatriculeW + colNameW + colSummaryW);
      const colSubW = offerings.length > 0 ? availWidth / offerings.length : 40;

      doc.rect(25, y, 790, 20).fill("#004080");
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
        doc.font("Helvetica-Bold").fillColor(row.decision === "ADMIS" || row.decision === "VALIDÉ" || row.decision === "DIPLÔMÉ" ? "#2DCE89" : "#F5365C").text(row.decision, sx + 75, y + 3.5, { width: 45, align: "center" });

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