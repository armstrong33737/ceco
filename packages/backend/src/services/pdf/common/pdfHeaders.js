// packages/backend/src/services/pdf/common/pdfHeaders.js
const { safeDrawImage } = require("./pdfHelpers");

/**
 * 1. EN-TÊTE NATIONAL OFFICIEL BILINGUE ALLONGÉ (Actes d'État, Diplômes, Certificats)
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
 * 2. EN-TÊTE INTERNE D'ÉTABLISSEMENT : DISPOSITION CÔTE À CÔTE CENTRÉE (SANS CHEVAUCHEMENT)
 * Logo à gauche, textes empilés à droite (Titre, Agrément, Contacts), bloc global centré.
 */
function drawInternalSimpleHeader(doc, tmpl, center, logoBuf, startY = 16, customWidth = 535.28, startX = 30) {
  const primaryColor = tmpl?.primaryColor || "#071A2E";
  const internalConfig = tmpl?.internalHeader || {};

  const logoSize = 48;
  const gap = 14;

  const centerTitle = internalConfig.title || center.name || "CENTRE DE FORMATION PROFESSIONNELLE";
  const defaultAccred = `ARRÊTÉ D'AGRÉMENT MINEFOP : ${center.registrationNumber || "Autorisé / En cours"} • VILLE : ${(center.city || "Cameroun").toUpperCase()}`;
  const accredText = internalConfig.accreditation || defaultAccred;
  const defaultContacts = `Tél : ${center.phone || "Non renseigné"}  •  Email : ${center.email || "Non renseigné"}${center.address ? `  •  ${center.address}` : ""}`;
  const contactsText = internalConfig.contacts || defaultContacts;

  // Mesure des textes
  doc.fontSize(11.5).font("Helvetica-Bold");
  const titleW = doc.widthOfString(centerTitle.toUpperCase());
  doc.fontSize(7.8).font("Helvetica-Bold");
  const accredW = doc.widthOfString(accredText);
  doc.fontSize(7.2).font("Helvetica");
  const contactsW = doc.widthOfString(contactsText);

  // Largeur disponible généreuse avec marge de respiration de sécurité pour éviter tout repli
  const maxAvailTextW = logoBuf ? customWidth - (logoSize + gap) : customWidth;
  const naturalTextW = Math.max(titleW, accredW, contactsW) + 20;
  const textW = Math.min(maxAvailTextW, naturalTextW);

  // Centrage horizontal de l'ensemble du bloc [Logo + Marge + Texte]
  const totalGroupW = logoBuf ? logoSize + gap + textW : textW;
  const groupStartX = startX + Math.max(0, (customWidth - totalGroupW) / 2);
  const textX = logoBuf ? groupStartX + logoSize + gap : groupStartX;

  if (logoBuf) {
    safeDrawImage(doc, logoBuf, groupStartX, startY, { fit: [logoSize, logoSize], align: "center", valign: "center" });
  }

  // Ligne 1 : Titre de l'établissement
  doc.fillColor(primaryColor).fontSize(11.5).font("Helvetica-Bold").text(
    centerTitle.toUpperCase(),
    textX, startY + 2, { width: textW, align: "left", lineBreak: false }
  );

  // Ligne 2 : Agrément Ministériel & Ville (sur une seule ligne protégée)
  doc.fillColor("#334155").fontSize(7.8).font("Helvetica-Bold").text(
    accredText,
    textX, startY + 18, { width: textW, align: "left", lineBreak: false }
  );

  // Ligne 3 : Coordonnées
  doc.fillColor("#64748B").fontSize(7.2).font("Helvetica").text(
    contactsText,
    textX, startY + 31, { width: textW, align: "left", lineBreak: false }
  );

  // Filet de séparation noble
  const lineY = startY + logoSize + 4;
  doc.moveTo(startX, lineY).lineTo(startX + customWidth, lineY).lineWidth(1).strokeColor(primaryColor).stroke();

  return lineY + 6;
}

/**
 * 3. EN-TÊTE RÉGIONAL DÉLÉGATION MINEFOP (Pour Bordereaux d'Examen Blanc Régional)
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

  const heightLeft = doc.heightOfString(headerLeft, { width: colSideWidth, lineGap: 1.5 });
  const heightRight = doc.heightOfString(headerRight, { width: colSideWidth, lineGap: 1.5 });

  doc.text(headerLeft, startX, startY, { width: colSideWidth, align: "center", lineGap: 1.5 });
  doc.text(headerRight, rightColX, startY, { width: colSideWidth, align: "center", lineGap: 1.5 });

  const contactsY = startY + Math.max(heightLeft, heightRight) + 12;

  doc.fillColor("#000000").fontSize(6.5).font("Helvetica-Bold").text(`Tél : ${phone}`, startX, contactsY, { width: colSideWidth, align: "center" });

  const emailPrefix = "Email : ";
  const prefixW = doc.widthOfString(emailPrefix);
  const emailW = doc.widthOfString(email);
  const totalEmailW = prefixW + emailW;
  const emailStartX = rightColX + Math.max(0, (colSideWidth - totalEmailW) / 2);

  doc.fillColor("#000000").text(emailPrefix, emailStartX, contactsY, { continued: true });
  doc.fillColor("#1A73E8").text(email);

  const dateY = contactsY + 16;
  doc.fillColor("#000000").fontSize(7).font("Helvetica").text(`${city}, le _______________________`, rightColX, dateY, { width: colSideWidth, align: "right" });

  return dateY + 15;
}

module.exports = {
  drawDynamicBilingualHeader,
  drawInternalSimpleHeader,
  drawRegionalMinefopHeader,
};