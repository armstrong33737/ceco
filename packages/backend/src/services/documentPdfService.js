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
  doc.opacity(Number(tmpl?.watermarkOpacity) || 0.07);
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
      { title: "Le Chef de Département", roleKey: "directeur_pedagogique" },
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

    doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text(title, colX, startY, {
      width: colWidth - 10,
      align: "center",
    });

    if (sigBuf) {
      safeDrawImage(doc, sigBuf, colX + (colWidth - 100) / 2, startY + 14, { fit: [90, 36], align: "center" });
    }
  });
}

// 1. CARTE D'APPRENANT INDIVIDUELLE (CR80)
async function generateStudentCardPdf(snapshot, qrUrl, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [243, 153],
        margins: { top: 6, bottom: 6, left: 8, right: 8 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, student = {}, inscription: insc = {}, templateConfig: tmpl = {} } = snapshot;

      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const photoBuf = bufferFromDataUrl(student.photoDataUrl);
      const sigBuf = bufferFromDataUrl(center.signatures?.directeur);
      const qrBuf = await QRCode.toBuffer(qrUrl, { margin: 0, width: 85 });

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
      doc.fillColor("#0F172A").fontSize(6).font("Helvetica").text(insc.filiereName || "—", ix + 28, iy, { width: 145, truncate: true });

      iy += 9;
      doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("NIVEAU :", ix, iy);
      doc.fillColor("#0F172A").fontSize(6).font("Helvetica-Bold").text(`Niveau ${insc.niveauOrder || 1} (${insc.programTypeCode || "DQP"})`, ix + 28, iy);

      iy += 9;
      doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("COHORTE :", ix, iy);
      doc.fillColor("#0F172A").fontSize(6).font("Helvetica").text(insc.promotionLabel || insc.academicYearLabel || "—", ix + 28, iy);

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

      safeDrawImage(doc, qrBuf, 8, 60, { width: 44, height: 44 });
      doc.fillColor("#64748B").fontSize(4.5).font("Helvetica-Bold").text("Scan pour vérification :", 56, 62);
      doc.fillColor(accentColor).fontSize(4.5).font("Courier").text(snapshot.qrToken || "", 56, 70, { width: 175 });

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

// 2. PLANCHE A4 DUPLEX AVEC REPÈRES DE COUPE
async function generateBatchCardsSheetPdf(snapshotsList, qrUrlsList, outputPath) {
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
        const pageQrUrls = qrUrlsList.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);

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
          doc.fillColor("#0F172A").fontSize(6).font("Helvetica").text(snap.inscription.filiereName || "—", ix + 30, iy, { width: 150, truncate: true });

          iy += 10;
          doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text("NIVEAU :", ix, iy);
          doc.fillColor("#0F172A").fontSize(6).font("Helvetica-Bold").text(`Niveau ${snap.inscription.niveauOrder || 1} (${snap.inscription.programTypeCode || "DQP"})`, ix + 30, iy);

          doc.rect(x, y + 146, cardW, 19).fill("#F8FAFC");
          doc.fillColor("#64748B").fontSize(5).font("Helvetica").text(`Cohorte : ${snap.inscription.promotionLabel || snap.inscription.academicYearLabel || "—"}`, x + 8, y + 152);
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
          const qrUrl = pageQrUrls[i];
          const qrBuf = await QRCode.toBuffer(qrUrl, { margin: 0, width: 85 });
          const tmpl = snap.templateConfig || {};

          doc.rect(x, y, cardW, cardH).lineWidth(0.5).strokeColor("#CBD5E1").fillAndStroke("#FFFFFF", "#CBD5E1");

          doc.fillColor(tmpl.themeColor || "#0B1C30").fontSize(6.5).font("Helvetica-Bold").text("CONDITIONS D'UTILISATION", x + 8, y + 8);
          doc.fillColor("#475569").fontSize(5).font("Helvetica").text(
            tmpl.termsOfUse || "Carte officielle d'apprenant. Présentation obligatoire aux examens et évaluations. En cas de perte, rapporter à la direction.",
            x + 8, y + 18, { width: 235, lineGap: 1 }
          );

          safeDrawImage(doc, qrBuf, x + 8, y + 54, { width: 46, height: 46 });
          doc.fillColor("#64748B").fontSize(5).font("Helvetica-Bold").text("Authentification :", x + 60, y + 56);
          doc.fillColor(tmpl.accentColor || "#5E72E4").fontSize(5).font("Courier").text(snap.qrToken || "", x + 60, y + 66, { width: 185 });

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

// 3. CERTIFICAT DE SCOLARITÉ INDIVIDUEL A4
function renderSingleAttestationPage(doc, snapshot, qrBuf) {
  const { center = {}, student = {}, inscription: insc = {}, templateConfig: tmpl = {} } = snapshot;

  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const sealBuf = bufferFromDataUrl(center.sealDataUrl);
  const primaryColor = tmpl.primaryColor || "#0B1C30";

  drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 330);

  const headerLeft = tmpl.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE";
  const headerRight = tmpl.headerRight || "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING";

  doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold").text(headerLeft, 35, 30, { width: 190, align: "center", lineGap: 1.5 });
  doc.text(headerRight, 370, 30, { width: 190, align: "center", lineGap: 1.5 });

  if (tmpl.showLogo !== false && logoBuf) safeDrawImage(doc, logoBuf, 240, 30, { fit: [50, 50], align: "center" });
  if (tmpl.showSeal !== false && sealBuf) safeDrawImage(doc, sealBuf, 300, 30, { fit: [50, 50], align: "center" });

  if (tmpl.subHeaderCenter) {
    doc.fillColor("#475569").fontSize(7).font("Helvetica").text(tmpl.subHeaderCenter.toUpperCase(), 35, 95, { width: 525, align: "center" });
  }
  doc.fillColor(primaryColor).fontSize(13).font("Helvetica-Bold").text((center.name || "CENTRE D'EXCELLENCE").toUpperCase(), 35, 112, { width: 525, align: "center" });
  doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text(
    `Agrément : ${center.registrationNumber || "MINEFOP"} • ${center.address || ""}, ${center.city || ""} • Tél : ${center.phone || ""}`,
    35, 128, { width: 525, align: "center" }
  );

  doc.moveTo(35, 142).lineTo(560, 142).lineWidth(1.5).strokeColor(primaryColor).stroke();

  doc.fillColor("#0F172A").fontSize(13).font("Helvetica-Bold").text(tmpl.documentTitle || "CERTIFICAT DE SCOLARITÉ & D'INSCRIPTION", 35, 165, { width: 525, align: "center", underline: true });
  if (tmpl.subTitle) {
    doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text(tmpl.subTitle, 35, 182, { width: 525, align: "center" });
  }

  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica").text(
    `Je soussigné, ${center.directorName ? center.directorName : "La Direction Générale"}, en qualité de ${center.directorTitle || "Directeur Général"} de l'établissement susmentionné, certifie par la présente que :`,
    35, 215, { width: 525, lineGap: 3 }
  );

  doc.rect(35, 245, 525, 95).fillAndStroke("#F8FAFC", "#CBD5E1");
  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("L'Apprenant(e) :", 50, 258);
  doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text(`${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`, 145, 256);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Matricule Officiel :", 50, 275);
  doc.fillColor(primaryColor).fontSize(9.5).font("Courier-Bold").text(student.matricule || "—", 145, 275);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Date / Lieu Naissance :", 50, 292);
  const birthStr = `${student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "Non renseignée"}${student.birthPlace ? ` à ${student.birthPlace}` : ""}`;
  doc.fillColor("#0F172A").fontSize(9).font("Helvetica").text(birthStr, 145, 292);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Filière d'Études :", 50, 309);
  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica-Bold").text(`${insc.filiereName || "—"} (${insc.programTypeCode || "DQP"})`, 145, 309);

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Niveau / Promotion :", 50, 324);
  doc.fillColor("#0F172A").fontSize(9).font("Helvetica").text(`Niveau ${insc.niveauOrder || 1} • ${insc.promotionLabel || `Session ${insc.academicYearLabel}`}`, 145, 324);

  doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica").text(
    "Est régulièrement inscrit(e) et poursuit avec assiduité son cycle de formation professionnelle au sein de notre établissement pour la session académique en cours.",
    35, 360, { width: 525, lineGap: 3.5 }
  );
  doc.text("En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.", 35, 395, { width: 525 });

  const qrY = 460;
  safeDrawImage(doc, qrBuf, 35, qrY, { width: 68, height: 68 });
  doc.fillColor("#64748B").fontSize(6.5).font("Helvetica-Bold").text("VÉRIFICATION D'AUTHENTICITÉ", 35, qrY + 72);
  doc.fillColor(primaryColor).fontSize(5.5).font("Courier").text(snapshot.qrToken || "", 35, qrY + 80, { width: 140 });

  doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(
    `Fait à ${center.city || "Bafoussam"}, le ${new Date().toLocaleDateString("fr-FR")}`,
    350, 442, { width: 210, align: "right" }
  );

  const signatories = tmpl.signatories || [
    { title: tmpl.signatoryTitleLeft || "Le Chef de Département", roleKey: "directeur_pedagogique" },
    { title: tmpl.signatoryTitleRight || "Le Directeur Général", roleKey: "directeur" },
  ];
  renderSignatoryBlocks(doc, signatories, center.signatures || {}, 460);

  doc.rect(35, 765, 525, 0.5).stroke("#CBD5E1");
  doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text(tmpl.footerLegal || "Document officiel scellé. Toute falsification expose son auteur à des poursuites judiciaires.", 35, 772, { width: 440 });
  doc.fillColor(primaryColor).fontSize(6.5).font("Helvetica-Bold").text("PROPULSÉ PAR CECO", 480, 772, { align: "right" });
}

async function generateAttestationPdf(snapshot, qrUrl, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 30, bottom: 30, left: 35, right: 35 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(qrUrl, { margin: 0, width: 85 });
      renderSingleAttestationPage(doc, snapshot, qrBuf);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// 4. ATTESTATIONS EN LOT PAR CLASSE (MULTI-PAGES A4)
async function generateBatchAttestationsPdf(snapshotsList, qrUrlsList, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 30, bottom: 30, left: 35, right: 35 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      for (let i = 0; i < snapshotsList.length; i++) {
        if (i > 0) doc.addPage({ size: "A4", margins: { top: 30, bottom: 30, left: 35, right: 35 } });
        const qrBuf = await QRCode.toBuffer(qrUrlsList[i], { margin: 0, width: 85 });
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

// 5. FICHE INDIVIDUELLE D'INSCRIPTION A4
async function generateFicheInscriptionPdf(snapshot, qrUrl, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 30, bottom: 30, left: 35, right: 35 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, student = {}, inscription: insc = {}, templateConfig: tmpl = {} } = snapshot;

      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const photoBuf = bufferFromDataUrl(student.photoDataUrl);
      const qrBuf = await QRCode.toBuffer(qrUrl, { margin: 0, width: 75 });

      const primaryColor = tmpl.primaryColor || "#0B1C30";

      drawWatermark(doc, tmpl, logoBuf, sealBuf, 130, 240, 330);

      if (tmpl.showLogo !== false && logoBuf) safeDrawImage(doc, logoBuf, 35, 30, { fit: [45, 45] });
      if (tmpl.showSeal !== false && sealBuf) safeDrawImage(doc, sealBuf, 515, 30, { fit: [45, 45] });

      doc.fillColor(primaryColor).fontSize(12).font("Helvetica-Bold").text((center.name || "CENTRE D'EXCELLENCE").toUpperCase(), 90, 35, { width: 420, align: "center" });
      doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text(
        `Agrément : ${center.registrationNumber || "MINEFOP"} • ${center.address || ""}, ${center.city || ""} • Contact : ${center.phone || ""}`,
        90, 52, { width: 420, align: "center" }
      );

      doc.moveTo(35, 85).lineTo(560, 85).lineWidth(1.2).strokeColor(primaryColor).stroke();

      doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text(tmpl.documentTitle || "FICHE INDIVIDUELLE D'INSCRIPTION & D'ENGAGEMENT", 35, 100, { width: 525, align: "center", underline: true });
      doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text(`SESSION ACADÉMIQUE : ${insc.academicYearLabel || "—"} • ${insc.promotionLabel || ""}`, 35, 116, { width: 525, align: "center" });

      doc.rect(465, 135, 95, 125).fillAndStroke("#F8FAFC", "#CBD5E1");
      if (!safeDrawImage(doc, photoBuf, 465, 135, { fit: [95, 125], align: "center", valign: "center" })) {
        doc.fillColor("#64748B").fontSize(8).font("Helvetica-Bold").text("PHOTO D'IDENTITÉ", 475, 190, { width: 75, align: "center" });
      }

      doc.rect(35, 135, 415, 125).fillAndStroke("#F8FAFC", "#CBD5E1");
      let ly = 143;
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
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(student.entryDiploma || "Aucun / Niveau d'entrée direct", 155, ly);

      doc.rect(35, 270, 525, 65).fillAndStroke("#FFFFFF", "#CBD5E1");
      doc.rect(35, 270, 525, 18).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold").text("AFFECTATION PÉDAGOGIQUE & CYCLE CHOISI", 45, 275);

      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Filière de formation :", 45, 296);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text(`${insc.filiereName || "—"} (${insc.programTypeCode || "DQP"})`, 160, 296);

      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text("Classe & Promotion :", 45, 314);
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica").text(`${insc.classeLabel || "—"} • ${insc.promotionLabel || ""}`, 160, 314);

      doc.rect(35, 345, 525, 80).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(8.5).font("Helvetica-Bold").text("ENGAGEMENT DE L'APPRENANT(E) :", 45, 355);
      doc.fillColor("#334155").fontSize(8).font("Helvetica").text(
        tmpl.engagementText || "Je soussigné(e), certifie sur l'honneur l'exactitude des informations mentionnées ci-dessus et déclare avoir pris pleine connaissance du règlement intérieur de l'établissement. Je m'engage à faire preuve d'assiduité, de rigueur et de probité tout au long de mon cycle de formation.",
        45, 370, { width: 505, lineGap: 2.5 }
      );

      const sigY = 445;
      safeDrawImage(doc, qrBuf, 35, sigY, { width: 60, height: 60 });
      doc.fillColor("#64748B").fontSize(5.5).font("Courier").text(snapshot.qrToken || "", 35, sigY + 65, { width: 130 });

      const signatories = tmpl.signatories || [
        { title: tmpl.signatoryTitleLeft || "Signature de l'Apprenant(e)", roleKey: "student" },
        { title: tmpl.signatoryTitleRight || "Visa de la Direction", roleKey: "directeur" },
      ];
      renderSignatoryBlocks(doc, signatories, center.signatures || {}, 445);

      doc.rect(35, 765, 525, 0.5).stroke("#CBD5E1");
      doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text(tmpl.footerLegal || "Fiche d'inscription conservée aux archives officielles de l'établissement.", 35, 772, { width: 440 });
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
// 6. BORDEREAU DE NOTES VIERGE POUR ENSEIGNANT (A4 PORTRAIT)
// ============================================================================
async function generateBlankGradeSheetPdf(snapshot, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 25, bottom: 25, left: 30, right: 30 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, offering = {}, students = [] } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.05 }, logoBuf, sealBuf, 130, 260, 330);

      // En-tête
      if (logoBuf) safeDrawImage(doc, logoBuf, 30, 25, { fit: [45, 45] });
      if (sealBuf) safeDrawImage(doc, sealBuf, 525, 25, { fit: [45, 45] });

      doc.fillColor("#0B1C30").fontSize(12).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), 80, 30, { width: 440, align: "center" });
      doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text(`Agrément : ${center.registrationNumber || "MINEFOP"} • ${center.city || "Cameroun"}`, 80, 46, { width: 440, align: "center" });

      doc.moveTo(30, 75).lineTo(565, 75).lineWidth(1.2).strokeColor("#0B1C30").stroke();

      // Titre
      doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text("BORDEREAU DE REPORT DE NOTES MANUSCRIT", 30, 88, { width: 535, align: "center" });
      doc.fillColor("#64748B").fontSize(8).font("Helvetica").text("Document de travail de l'enseignant pour la correction et la saisie", 30, 102, { width: 535, align: "center" });

      // Cartouche d'informations du cours
      doc.rect(30, 118, 535, 42).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
      doc.text(`Classe : ${offering.classeLabel || "—"}`, 40, 126);
      doc.text(`Matière : ${offering.subjectName || "—"} (Coef ${offering.coefficient || 2})`, 220, 126);
      doc.text(`Semestre : ${offering.semesterLabel || "—"}`, 430, 126);

      doc.text(`Groupe : ${offering.categoryName || "Général"}`, 40, 144);
      doc.text(`Formateur : ${offering.formateurName || "Non assigné"}`, 220, 144);
      doc.text(`Effectif : ${students.length} apprenant(s)`, 430, 144);

      // Tableau quadrillé
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

        // Colonnes vides quadrillées pour inscription au stylo
        doc.rect(320, y, 50, 18).strokeColor("#E2E8F0").stroke();
        doc.rect(375, y, 50, 18).strokeColor("#E2E8F0").stroke();
        doc.rect(430, y, 60, 18).strokeColor("#E2E8F0").stroke();
        doc.rect(495, y, 70, 18).strokeColor("#E2E8F0").stroke();

        y += 18;
      });

      // Signatures de bas de page
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
// 7. BORDEREAU OFFICIEL DE MATIÈRE SCELLÉ PAR QR CODE (A4 PORTRAIT)
// ============================================================================
async function generateCertifiedGradeSheetPdf(snapshot, qrUrl, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 25, bottom: 25, left: 30, right: 30 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const { center = {}, offering = {}, rows = [], stats = {} } = snapshot;
      const logoBuf = bufferFromDataUrl(center.logoDataUrl);
      const sealBuf = bufferFromDataUrl(center.sealDataUrl);
      const sigBuf = bufferFromDataUrl(center.signatures?.directeur);
      const qrBuf = await QRCode.toBuffer(qrUrl, { margin: 0, width: 80 });

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.06 }, logoBuf, sealBuf, 130, 260, 330);

      // En-tête officiel
      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold").text("RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE", 30, 25, { width: 190, align: "center", lineGap: 1.5 });
      doc.text("REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING", 375, 25, { width: 190, align: "center", lineGap: 1.5 });

      if (logoBuf) safeDrawImage(doc, logoBuf, 245, 25, { fit: [45, 45], align: "center" });
      if (sealBuf) safeDrawImage(doc, sealBuf, 305, 25, { fit: [45, 45], align: "center" });

      doc.fillColor("#0B1C30").fontSize(11).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), 30, 80, { width: 535, align: "center" });
      doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text(`Agrément : ${center.registrationNumber || "MINEFOP"} • ${center.city || "Cameroun"}`, 30, 94, { width: 535, align: "center" });

      doc.moveTo(30, 108).lineTo(565, 108).lineWidth(1.2).strokeColor("#0B1C30").stroke();

      // Titre
      doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text("PROCÈS-VERBAL OFFICIEL DE NOTES CERTIFIÉES", 30, 118, { width: 535, align: "center", underline: true });

      // Cartouche
      doc.rect(30, 136, 535, 36).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
      doc.text(`Classe : ${offering.classeLabel}`, 40, 142);
      doc.text(`Matière : ${offering.subjectName} (Coef ${offering.coefficient})`, 220, 142);
      doc.text(`Période : ${offering.semesterLabel}`, 420, 142);

      doc.text(`Groupe : ${offering.categoryName || "Général"}`, 40, 156);
      doc.text(`Formateur : ${offering.formateurName || "Non assigné"}`, 220, 156);
      doc.text(`Taux de réussite : ${stats.successRate || "0"}%`, 420, 156);

      // Tableau des notes
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

      // Statistiques de fin de PV
      y += 10;
      doc.rect(30, y, 535, 24).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold");
      doc.text(`Inscrits : ${stats.total || 0}  •  Évalués : ${stats.evaluated || 0}  •  Validés (≥10) : ${stats.passed || 0}  •  Non Validés : ${stats.failed || 0}  •  Moyenne de classe : ${stats.classAverage || "—"} / 20`, 40, y + 7);

      // Signatures et QR Code
      y = Math.max(y + 35, 680);
      if (y > 740) {
        doc.addPage({ size: "A4", margins: { top: 25, bottom: 25, left: 30, right: 30 } });
        y = 40;
      }

      safeDrawImage(doc, qrBuf, 35, y, { width: 65, height: 65 });
      doc.fillColor("#64748B").fontSize(5.5).font("Courier").text(snapshot.qrToken || "", 35, y + 68, { width: 130 });

      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
      doc.text("Le Formateur Responsable", 180, y, { width: 140, align: "center" });
      doc.text("Le Directeur Général", 400, y, { width: 140, align: "center" });
      if (sigBuf) safeDrawImage(doc, sigBuf, 420, y + 14, { fit: [90, 32] });

      doc.rect(30, 800, 535, 0.5).stroke("#CBD5E1");
      doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text("Procès-verbal pédagogique sécurisé • CECO ERP", 30, 808);
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
// 8. PV SEMESTRIEL RÉCAPITULATIF DE CLASSE (A4 PAYSAGE / LANDSCAPE)
// ============================================================================
async function generateClassSemesterSummaryPdf(snapshot, qrUrl, outputPath) {
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
      const qrBuf = await QRCode.toBuffer(qrUrl, { margin: 0, width: 70 });

      drawWatermark(doc, { showWatermark: true, watermarkOpacity: 0.05 }, logoBuf, sealBuf, 250, 130, 300);

      // En-tête paysage
      if (logoBuf) safeDrawImage(doc, logoBuf, 25, 20, { fit: [40, 40] });
      if (sealBuf) safeDrawImage(doc, sealBuf, 775, 20, { fit: [40, 40] });

      doc.fillColor("#0B1C30").fontSize(11).font("Helvetica-Bold").text((center.name || "CENTRE DE FORMATION").toUpperCase(), 75, 22, { width: 690, align: "center" });
      doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text(`GRILLE DE DÉLIBÉRATION SEMESTRIELLE • Classe : ${classe.label} • Filière : ${classe.filiereName}`, 75, 36, { width: 690, align: "center" });

      doc.moveTo(25, 55).lineTo(815, 55).lineWidth(1).strokeColor("#0B1C30").stroke();

      // En-tête du tableau synoptique
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

      summaries.forEach((row, idx) => {
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
        doc.font("Helvetica-Bold").fillColor(row.decision === "ADMIS" ? "#2DCE89" : "#F5365C").text(row.decision, sx + 75, y + 4, { width: 45, align: "center" });

        y += 16;
      });

      // Signatures bas de page
      y = Math.max(y + 20, 480);
      if (y > 510) {
        doc.addPage({ size: "A4", layout: "landscape", margins: { top: 20, bottom: 20, left: 25, right: 25 } });
        y = 30;
      }

      safeDrawImage(doc, qrBuf, 35, y, { width: 50, height: 50 });
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");
      doc.text("Le Jury de Délibération", 250, y + 10, { width: 200, align: "center" });
      doc.text("Le Directeur Général", 550, y + 10, { width: 200, align: "center" });

      doc.rect(25, 560, 790, 0.5).stroke("#CBD5E1");
      doc.fillColor("#64748B").fontSize(6.5).font("Helvetica").text("Procès-verbal de délibération semestrielle • CECO ERP", 25, 568);
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
};