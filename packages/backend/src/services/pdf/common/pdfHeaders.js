// packages/backend/src/services/pdf/common/pdfHeaders.js
const { safeDrawImage } = require("./pdfHelpers");

/**
 * 1. EN-TÊTE NATIONAL OFFICIEL BILINGUE ALLONGÉ
 */
function drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, startY = 22, customWidth = 539.28, startX = 28) {
  const primaryColor = tmpl?.primaryColor || "#071A2E";

  const defaultHeaderLeft =
    "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE\n----\nDÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA";

  const defaultHeaderRight =
    "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING\n----\nREGIONAL DELEGATION FOR THE WEST\nDIVISIONAL DELEGATION FOR MENOUA";

  const headerLeft = tmpl?.headerLeft || defaultHeaderLeft;
  const headerRight = tmpl?.headerRight || defaultHeaderRight;

  const colSideWidth = 195;
  const colCenterWidth = customWidth - (colSideWidth * 2);
  const centerColX = startX + colSideWidth;
  const rightColX = startX + customWidth - colSideWidth;

  doc.fillColor("#0F172A").fontSize(6.8).font("Helvetica-Bold").text(headerLeft, startX, startY, {
    width: colSideWidth,
    align: "center",
    lineGap: 1.4,
  });

  doc.text(headerRight, rightColX, startY, {
    width: colSideWidth,
    align: "center",
    lineGap: 1.4,
  });

  const headerMode = tmpl?.headerMode || "logo";
  const showLogo = headerMode === "logo" || headerMode === "both";
  const showSeal = headerMode === "seal" || headerMode === "both";

  const hasLogo = showLogo && Boolean(logoBuf);
  const hasSeal = showSeal && Boolean(sealBuf);

  if (hasLogo && hasSeal) {
    const imgSize = 36;
    const gap = 8;
    const totalImgW = (imgSize * 2) + gap;
    const imgStartX = centerColX + (colCenterWidth - totalImgW) / 2;

    safeDrawImage(doc, sealBuf, imgStartX, startY + 2, { fit: [imgSize, imgSize], align: "center" });
    safeDrawImage(doc, logoBuf, imgStartX + imgSize + gap, startY + 2, { fit: [imgSize, imgSize], align: "center" });
  } else if (hasLogo || hasSeal) {
    const activeBuf = hasLogo ? logoBuf : sealBuf;
    const imgSize = 46;
    const imgStartX = centerColX + (colCenterWidth - imgSize) / 2;
    safeDrawImage(doc, activeBuf, imgStartX, startY, { fit: [imgSize, imgSize], align: "center" });
  }

  const nameY = startY + 58;
  doc.fillColor(primaryColor).fontSize(12).font("Helvetica-Bold").text(
    (center.name || "CENTRE DE FORMATION PROFESSIONNELLE").toUpperCase(),
    startX, nameY, { width: customWidth, align: "center" }
  );

  const accredY = nameY + 16;
  doc.fillColor("#334155").fontSize(8).font("Helvetica-Bold").text(
    `ARRÊTÉ D'AGRÉMENT MINEFOP : ${center.registrationNumber || "Autorisé / En cours"} • VILLE : ${(center.city || "Cameroun").toUpperCase()}`,
    startX, accredY, { width: customWidth, align: "center" }
  );

  const contactsLine = `Tél : ${center.phone || "Non renseigné"}  •  Email : ${center.email || "Non renseigné"}${center.address ? `  •  ${center.address}` : ""}`;
  doc.fillColor("#64748B").fontSize(7.2).font("Helvetica").text(
    contactsLine,
    startX, accredY + 12, { width: customWidth, align: "center", truncate: true }
  );

  const sepY = accredY + 24;
  doc.moveTo(startX, sepY).lineTo(startX + customWidth, sepY).lineWidth(1.2).strokeColor(primaryColor).stroke();
  doc.moveTo(startX, sepY + 2).lineTo(startX + customWidth, sepY + 2).lineWidth(0.5).strokeColor("#D4AF37").stroke();

  return sepY + 6;
}

/**
 * 2. EN-TÊTE INTERNE D'ÉTABLISSEMENT NON OFFICIEL
 */
function drawInternalSimpleHeader(doc, tmpl, center, logoBuf, startY = 25, customWidth = 535.28, startX = 30) {
  const primaryColor = tmpl?.primaryColor || "#071A2E";
  const internalConfig = tmpl?.internalHeader || {};

  const logoSize = 55;
  if (logoBuf) {
    safeDrawImage(doc, logoBuf, startX, startY, { fit: [logoSize, logoSize], align: "left" });
  }

  const textX = logoBuf ? startX + logoSize + 14 : startX;
  const textW = logoBuf ? customWidth - (logoSize + 14) : customWidth;

  const centerTitle = internalConfig.title || center.name || "CENTRE DE FORMATION PROFESSIONNELLE";
  doc.fillColor(primaryColor).fontSize(13).font("Helvetica-Bold").text(
    centerTitle.toUpperCase(),
    textX, startY + 2, { width: textW }
  );

  const accredText = internalConfig.accreditation || `ARRÊTÉ D'AGRÉMENT MINEFOP : ${center.registrationNumber || "Autorisé / En cours"} • ${(center.city || "Cameroun").toUpperCase()}`;
  doc.fillColor("#334155").fontSize(8).font("Helvetica-Bold").text(
    accredText,
    textX, startY + 20, { width: textW }
  );

  const defaultContacts = `Tél : ${center.phone || "Non renseigné"}  •  Email : ${center.email || "Non renseigné"}${center.address ? `  •  ${center.address}` : ""}`;
  const contactsText = internalConfig.contacts || defaultContacts;
  doc.fillColor("#64748B").fontSize(7.5).font("Helvetica").text(
    contactsText,
    textX, startY + 34, { width: textW, truncate: true }
  );

  const lineY = startY + logoSize + 4;
  doc.moveTo(startX, lineY).lineTo(startX + customWidth, lineY).lineWidth(1).strokeColor(primaryColor).stroke();

  return lineY + 6;
}

/**
 * 3. EN-TÊTE RÉGIONAL DÉLÉGATION MINEFOP (Calcul Dynamique Anti-Chevauchement)
 */
function drawRegionalMinefopHeader(doc, config, center, startY = 20, customWidth = 545, startX = 25) {
  const colSideWidth = 230;
  const rightColX = startX + customWidth - colSideWidth;

  const headerLeft = config?.headerLeft || 
    "REPUBLIQUE DU CAMEROUN\nPaix – Travail – Patrie\n*********\nREGION DE L'OUEST\n*********\nDELEGATION REGIONALE DE L'EMPLOI ET DE LA\nFORMATION PROFESSIONNELLE\n*********\nINSPECTION REGIONALE DES FORMATIONS\n*********";

  const headerRight = config?.headerRight || 
    "REPUBLIC OF CAMEROON\nPeace – Work – Fatherland\n*********\nWEST REGION\n*********\nREGIONAL DELEGATION OF EMPLOYMENT\nAND VOCATIONAL TRAINING\n*********\nREGIONAL INSPECTORATE OF TRAININGS\n*********";

  const phone = config?.regionalContacts?.phone || "233 44 53 80 / 233 44 59 00";
  const email = config?.regionalContacts?.email || "drefopouest@yahoo.fr";
  const city = config?.regionalContacts?.city || center?.city || "Bafoussam";

  doc.fillColor("#000000").fontSize(6.5).font("Helvetica-Bold");

  // Calcul exact de la hauteur du bloc texte gauche et droit pour éviter les écrasements
  const heightLeft = doc.heightOfString(headerLeft, { width: colSideWidth, lineGap: 1.5 });
  const heightRight = doc.heightOfString(headerRight, { width: colSideWidth, lineGap: 1.5 });

  doc.text(headerLeft, startX, startY, { width: colSideWidth, align: "center", lineGap: 1.5 });
  doc.text(headerRight, rightColX, startY, { width: colSideWidth, align: "center", lineGap: 1.5 });

  // On place les contacts 12 points en dessous du texte le plus long
  const contactsY = startY + Math.max(heightLeft, heightRight) + 12;

  // Ligne de séparation fine (Optionnelle mais élégante pour la tutelle)
  // doc.moveTo(startX + 40, contactsY - 6).lineTo(startX + colSideWidth - 40, contactsY - 6).lineWidth(0.4).strokeColor("#000000").stroke();
  // doc.moveTo(rightColX + 40, contactsY - 6).lineTo(rightColX + colSideWidth - 40, contactsY - 6).lineWidth(0.4).strokeColor("#000000").stroke();

  // Téléphone (gauche)
  doc.fillColor("#000000").fontSize(6.5).font("Helvetica-Bold").text(`Tél : ${phone}`, startX, contactsY, { width: colSideWidth, align: "center" });

  // Email (droite) : "Email : " en noir et l'adresse en bleu, parfaitement centré dans la colonne droite
  const emailPrefix = "Email : ";
  const prefixW = doc.widthOfString(emailPrefix);
  const emailW = doc.widthOfString(email);
  const totalEmailW = prefixW + emailW;
  const emailStartX = rightColX + Math.max(0, (colSideWidth - totalEmailW) / 2);

  doc.fillColor("#000000").text(emailPrefix, emailStartX, contactsY, { continued: true });
  doc.fillColor("#1A73E8").text(email);

  // Date (on réinitialise la couleur à noir)
  const dateY = contactsY + 16;
  doc.fillColor("#000000").fontSize(7).font("Helvetica").text(`${city}, le _______________________`, rightColX, dateY, { width: colSideWidth, align: "right" });

  // On retourne la coordonnée Y finale exacte pour la suite du document
  return dateY + 15;
}

module.exports = {
  drawDynamicBilingualHeader,
  drawInternalSimpleHeader,
  drawRegionalMinefopHeader,
};