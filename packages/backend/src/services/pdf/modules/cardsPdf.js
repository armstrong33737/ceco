// packages/backend/src/services/pdf/modules/cardsPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const { bufferFromDataUrl, safeDrawImage } = require("../common/pdfHelpers");
const { drawStudentAvatar, drawCropMarks } = require("../common/pdfGraphics");
const { centerStoragePath } = require("../../../storage/paths");

const SUPPORTED_BG_EXTS = ["png", "jpg", "jpeg", "webp"];

/**
 * Recherche et résout le buffer binaire de la texture de fond de carte
 */
function resolveCardTextureBuffer(centerId, tmpl = {}) {
  if (tmpl.cardBgDataUrl && typeof tmpl.cardBgDataUrl === "string") {
    const buf = bufferFromDataUrl(tmpl.cardBgDataUrl);
    if (buf) return buf;
  }

  if (centerId) {
    try {
      const brandingDir = centerStoragePath(centerId, "settings/branding");
      if (fs.existsSync(brandingDir)) {
        for (const ext of SUPPORTED_BG_EXTS) {
          const p = path.join(brandingDir, `card_bg.${ext}`);
          if (fs.existsSync(p)) return fs.readFileSync(p);
          const pLong = path.join(brandingDir, `card_background.${ext}`);
          if (fs.existsSync(pLong)) return fs.readFileSync(pLong);
        }
      }
    } catch {}
  }

  const candidateDirs = [
    path.join(__dirname, "../../../../assets"),
    path.join(__dirname, "../../../../../desktop/assets"),
    path.join(process.cwd(), "assets"),
    path.join(process.cwd(), "packages/backend/assets"),
    path.join(process.cwd(), "packages/desktop/assets"),
    ...(process.resourcesPath ? [
      path.join(process.resourcesPath, "backend/assets"),
      path.join(process.resourcesPath, "desktop/assets"),
      path.join(process.resourcesPath, "assets"),
    ] : []),
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      for (const ext of SUPPORTED_BG_EXTS) {
        const p = path.join(dir, `card_bg.${ext}`);
        if (fs.existsSync(p)) return fs.readFileSync(p);
      }
    }
  }

  return null;
}

/**
 * Dessine la face RECTO de la carte avec mise à l'échelle automatique du nom
 */
function renderCardRecto(doc, snapshot, qrBuf, bgBuf, originX = 0, originY = 0) {
  const { center = {}, student = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;
  const logoBuf = bufferFromDataUrl(center.logoDataUrl);
  const photoBuf = bufferFromDataUrl(student.photoDataUrl);

  const themeColor = tmpl.themeColor || "#071A2E";
  const accentColor = tmpl.accentColor || "#18527A";

  const cardW = 243;
  const cardH = 153;

  doc.save();

  // 1. Fond ou Texture
  doc.rect(originX, originY, cardW, cardH).fill("#FFFFFF");
  if (bgBuf) {
    try {
      doc.save();
      doc.rect(originX, originY, cardW, cardH).clip();
      safeDrawImage(doc, bgBuf, originX, originY, { width: cardW, height: cardH });
      doc.restore();
    } catch {}
  }

  doc.rect(originX, originY, cardW, cardH).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

  // 2. Cartouche supérieur officiel
  const boxX = originX + 7;
  const boxY = originY + 7;
  const boxW = cardW - 14;
  const boxH = 33;

  doc.rect(boxX, boxY, boxW, boxH).roundedRect(boxX, boxY, boxW, boxH, 3).fill(themeColor);

  if (logoBuf) {
    doc.rect(boxX + 3.5, boxY + 3.5, 26, 26).roundedRect(boxX + 3.5, boxY + 3.5, 26, 26, 2).fill("#FFFFFF");
    safeDrawImage(doc, logoBuf, boxX + 5, boxY + 5, { fit: [23, 23], align: "center", valign: "center" });
  }

  const headerTextX = logoBuf ? boxX + 34 : boxX + 10;
  const headerTextW = logoBuf ? boxW - 40 : boxW - 20;

  doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold").text(
    (center.name || "CENTRE DE FORMATION PROFESSIONNELLE").toUpperCase(),
    headerTextX, boxY + 6, { width: headerTextW, truncate: true }
  );

  doc.fillColor("#CBD5E1").fontSize(6.5).font("Helvetica-Bold").text(
    (tmpl.cardTitle || "CARTE D’ÉTUDIANT").toUpperCase(),
    headerTextX, boxY + 17.5, { width: headerTextW, characterSpacing: 0.6 }
  );

  // 3. Zone Centrale : Photo 4:4 à gauche
  const photoX = originX + 11;
  const photoY = originY + 46;
  const photoSize = 54;
  drawStudentAvatar(doc, photoBuf, photoX, photoY, photoSize, photoSize);

  // Zone textuelle à droite de la photo
  const infoX = originX + 71;
  const infoW = 118; // Espace réservé avant le cadre QR Code

  // Gestion des noms longs : auto-scaling pour ne jamais déborder sur la filière
  const fullName = `${(student.lastName || "").toUpperCase()} ${student.firstName || ""}`.trim();
  let nameFontSize = 8;
  if (fullName.length > 32) {
    nameFontSize = 5.8;
  } else if (fullName.length > 24) {
    nameFontSize = 6.8;
  }

  doc.fillColor("#0F172A").fontSize(nameFontSize).font("Helvetica-Bold").text(
    fullName,
    infoX, photoY, { width: infoW, height: 11, truncate: true, ellipsis: true }
  );

  // Filière & Spécialité
  doc.fillColor(themeColor).fontSize(6.5).font("Helvetica-Bold").text(
    classe.filiereName || "Formation Professionnelle",
    infoX, photoY + 12, { width: infoW, height: 9, truncate: true }
  );

  // Niveau & Qualification
  doc.fillColor("#334155").fontSize(5.5).font("Helvetica").text(
    `Niveau ${classe.niveauOrder || 1} • Qualification ${classe.programTypeCode || "DQP"}`,
    infoX, photoY + 22, { width: infoW, truncate: true }
  );

  // Date & Lieu de naissance
  const birthDateStr = student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—";
  const birthPlaceStr = student.birthPlace ? ` à ${student.birthPlace.toUpperCase()}` : "";
  doc.fillColor("#64748B").fontSize(5.2).font("Helvetica").text(
    `Né(e) le : ${birthDateStr}${birthPlaceStr}`,
    infoX, photoY + 31, { width: infoW, truncate: true }
  );

  // Genre & Téléphone
  const genreStr = student.gender === "F" ? "Féminin" : "Masculin";
  const phoneStr = student.phone ? `Tél : ${student.phone}` : "Tél : non renseigné";
  doc.fillColor("#64748B").fontSize(5.2).font("Helvetica").text(
    `Genre : ${genreStr}  •  ${phoneStr}`,
    infoX, photoY + 40, { width: infoW, truncate: true }
  );

  // 4. Zone Inférieure : ID Matricule (SANS CADRE)
  const footerY = originY + 110;

  doc.fillColor("#64748B").fontSize(5.5).font("Helvetica-Bold").text(
    "ID / MATRICULE OFFICIEL",
    photoX, footerY
  );

  doc.fillColor(accentColor).fontSize(9).font("Courier-Bold").text(
    student.matricule || "—",
    photoX, footerY + 9, { width: 130 }
  );

  doc.fillColor("#64748B").fontSize(5).font("Helvetica").text(
    `Session : ${classe.academicYearLabel || "2026-2027"} • CECO ID-PASS`,
    photoX, footerY + 22, { width: 130 }
  );

  // 5. Code QR remonté avec cadre ornemental à bordure interne
  const qrSize = 36;
  const qrX = originX + 194;
  const qrY = originY + 92;

  if (qrBuf) {
    const pad = 3;
    const outerX = qrX - pad;
    const outerY = qrY - pad;
    const outerSize = qrSize + pad * 2;

    doc.rect(outerX, outerY, outerSize, outerSize).fill("#FFFFFF");
    doc.rect(outerX, outerY, outerSize, outerSize).lineWidth(0.8).strokeColor(themeColor).stroke();
    doc.rect(outerX + 1.5, outerY + 1.5, outerSize - 3, outerSize - 3).lineWidth(0.4).strokeColor(accentColor).stroke();

    const cornerLen = 3;
    doc.save();
    doc.lineWidth(1).strokeColor(themeColor);
    doc.moveTo(outerX, outerY + cornerLen).lineTo(outerX, outerY).lineTo(outerX + cornerLen, outerY).stroke();
    doc.moveTo(outerX + outerSize - cornerLen, outerY).lineTo(outerX + outerSize, outerY).lineTo(outerX + outerSize, outerY + cornerLen).stroke();
    doc.moveTo(outerX, outerY + outerSize - cornerLen).lineTo(outerX, outerY + outerSize).lineTo(outerX + cornerLen, outerY + outerSize).stroke();
    doc.moveTo(outerX + outerSize - cornerLen, outerY + outerSize).lineTo(outerX + outerSize, outerY + outerSize).lineTo(outerX + outerSize, outerY + outerSize - cornerLen).stroke();
    doc.restore();

    safeDrawImage(doc, qrBuf, qrX, qrY, { width: qrSize, height: qrSize });

    doc.fillColor("#64748B").fontSize(4.2).font("Courier-Bold").text(
      "SCAN VÉRIF",
      outerX, outerY + outerSize + 2, { width: outerSize, align: "center" }
    );
  }

  doc.restore();
}

/**
 * Dessine la face VERSO de la carte avec signature choisie
 */
function renderCardVerso(doc, snapshot, bgBuf, originX = 0, originY = 0) {
  const { center = {}, classe = {}, templateConfig: tmpl = {} } = snapshot;

  // Sélection dynamique du signataire
  const chosenRoleKey = tmpl.signatoryRoleKey || "directeur";
  const sigBuf = bufferFromDataUrl(center.signatures?.[chosenRoleKey] || center.signatures?.directeur);

  const themeColor = tmpl.themeColor || "#071A2E";
  const cardW = 243;
  const cardH = 153;

  doc.save();

  doc.rect(originX, originY, cardW, cardH).fill("#FAFAFA");
  if (bgBuf) {
    try {
      doc.save();
      doc.rect(originX, originY, cardW, cardH).clip();
      safeDrawImage(doc, bgBuf, originX, originY, { width: cardW, height: cardH });
      doc.restore();
    } catch {}
  }
  doc.rect(originX, originY, cardW, cardH).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

  const marginX = originX + 10;
  const contentW = cardW - 20;

  // 1. Message de bienvenue
  const welcomeText = tmpl.welcomeMessage || "Bienvenue au sein de notre centre. L'excellence et la rigueur au service de votre avenir professionnel.";
  doc.fillColor(themeColor).fontSize(5.5).font("Helvetica-BoldOblique").text(
    welcomeText,
    marginX, originY + 8, { width: contentW, align: "center", lineGap: 1 }
  );

  doc.moveTo(marginX, originY + 24).lineTo(marginX + contentW, originY + 24).lineWidth(0.4).strokeColor("#CBD5E1").stroke();

  // 2. Règles d'utilisation
  const rulesText = tmpl.termsOfUse || "Cette carte est strictement personnelle et demeure la propriété exclusive de l'établissement. Sa présentation est obligatoire pour l'accès aux cours, ateliers et examens. En cas de perte, aviser immédiatement la direction.";
  doc.fillColor("#475569").fontSize(4.8).font("Helvetica").text(
    rulesText,
    marginX, originY + 27, { width: contentW, align: "justify", lineGap: 1.1 }
  );

  doc.moveTo(marginX, originY + 54).lineTo(marginX + contentW, originY + 54).lineWidth(0.4).strokeColor("#CBD5E1").stroke();

  // 3. Contacts
  doc.fillColor(themeColor).fontSize(5.5).font("Helvetica-Bold").text("COORDONNÉES OFFICIELLES :", marginX, originY + 57);

  const phoneStr = center.phone ? `Tél : ${center.phone}` : "Tél : non renseigné";
  const emailStr = center.email ? `Email : ${center.email}` : "";
  doc.fillColor("#0F172A").fontSize(5).font("Helvetica").text(
    `${phoneStr}  ${emailStr ? `•  ${emailStr}` : ""}`,
    marginX, originY + 66, { width: contentW }
  );

  const addrStr = `${center.address ? center.address : ""}${center.city ? ` • ${center.city}` : ""}${center.website ? ` • ${center.website}` : ""}`;
  doc.fillColor("#475569").fontSize(4.8).font("Helvetica").text(
    `Localisation : ${addrStr || "Cameroun"}`,
    marginX, originY + 74, { width: contentW, truncate: true }
  );

  doc.moveTo(marginX, originY + 85).lineTo(marginX + contentW, originY + 85).lineWidth(0.4).strokeColor("#CBD5E1").stroke();

  // 4. Validation administrative
  const adminY = originY + 88;

  doc.fillColor("#64748B").fontSize(5).font("Helvetica").text(
    `Agrément MINEFOP : ${center.registrationNumber || "Autorisé / En cours"}`,
    marginX, adminY
  );
  doc.text(
    `Session Académique : ${classe.academicYearLabel || "2026-2027"}`,
    marginX, adminY + 8
  );
  doc.text(
    `Délivré le : ${new Date().toLocaleDateString("fr-FR")}`,
    marginX, adminY + 16
  );

  const sigBoxX = originX + 145;
  const sigBoxW = cardW - 155;

  doc.fillColor("#0F172A").fontSize(5.5).font("Helvetica-Bold").text(
    tmpl.signatoryTitle || center.directorTitle || "Le Directeur Général",
    sigBoxX, adminY, { width: sigBoxW, align: "center" }
  );

  if (sigBuf) {
    safeDrawImage(doc, sigBuf, sigBoxX + (sigBoxW - 55) / 2, adminY + 9, { fit: [55, 22], align: "center" });
  }

  // 5. Pied de page
  doc.rect(originX, originY + 138, cardW, 15).fill(themeColor);
  doc.fillColor("#FFFFFF").fontSize(4.8).font("Helvetica-Bold").text(
    "TITRE OFFICIEL D'IDENTIFICATION ACADÉMIQUE",
    originX + 8, originY + 143
  );
  doc.fillColor("#94A3B8").fontSize(4.8).font("Helvetica").text(
    "PROPULSÉ PAR CECO ERP",
    originX + cardW - 85, originY + 143, { width: 77, align: "right" }
  );

  doc.restore();
}

/**
 * Génère la carte d'apprenant individuelle CR80
 */
async function generateStudentCardPdf(snapshot, offlinePayload, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [243, 153],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        autoFirstPage: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const qrBuf = await QRCode.toBuffer(offlinePayload || snapshot.qrToken || "CECO-CARD", {
        margin: 0,
        width: 80,
        errorCorrectionLevel: "M",
      });

      const bgBuf = resolveCardTextureBuffer(snapshot.center?.id, snapshot.templateConfig);

      renderCardRecto(doc, snapshot, qrBuf, bgBuf, 0, 0);

      doc.addPage({ size: [243, 153], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      renderCardVerso(doc, snapshot, bgBuf, 0, 0);

      doc.end();
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Compile une classe en planches A4 Duplex de 8 cartes
 */
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

      const cardW = 243;
      const cardH = 153;
      const startX = 40;
      const startY = 48;
      const gapX = 28;
      const gapY = 32;

      const CARDS_PER_PAGE = 8;
      const totalPages = Math.ceil(snapshotsList.length / CARDS_PER_PAGE);

      for (let p = 0; p < totalPages; p++) {
        const pageItems = snapshotsList.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);
        const pagePayloads = qrPayloadsList.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);

        if (p > 0) {
          doc.addPage({ size: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 } });
        }

        // Planche RECTO
        for (let i = 0; i < pageItems.length; i++) {
          const row = Math.floor(i / 2);
          const col = i % 2;
          const x = startX + col * (cardW + gapX);
          const y = startY + row * (cardH + gapY);

          drawCropMarks(doc, x, y, cardW, cardH);

          const snap = pageItems[i];
          const payload = pagePayloads[i];
          const qrBuf = await QRCode.toBuffer(payload || snap.qrToken || "CECO-CARD", {
            margin: 0,
            width: 80,
            errorCorrectionLevel: "M",
          });
          const bgBuf = resolveCardTextureBuffer(snap.center?.id, snap.templateConfig);

          renderCardRecto(doc, snap, qrBuf, bgBuf, x, y);
        }

        // Planche VERSO (Inversion miroir)
        doc.addPage({ size: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 } });

        for (let i = 0; i < pageItems.length; i++) {
          const row = Math.floor(i / 2);
          const col = 1 - (i % 2);
          const x = startX + col * (cardW + gapX);
          const y = startY + row * (cardH + gapY);

          drawCropMarks(doc, x, y, cardW, cardH);

          const snap = pageItems[i];
          const bgBuf = resolveCardTextureBuffer(snap.center?.id, snap.templateConfig);

          renderCardVerso(doc, snap, bgBuf, x, y);
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

module.exports = {
  generateStudentCardPdf,
  generateBatchCardsSheetPdf,
  resolveCardTextureBuffer,
};