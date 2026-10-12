// packages/backend/src/services/pdf/common/pdfHeaders.js
const { safeDrawImage } = require("./pdfHelpers");

/**
 * En-tête bilingue national officiel (Français / Anglais) avec centrage des logos et de l'arrêté d'agrément
 */
function drawDynamicBilingualHeader(doc, tmpl, center, logoBuf, sealBuf, startY = 20, customWidth = 545, startX = 25) {
  const primaryColor = tmpl?.primaryColor || "#071A2E";
  const headerLeft = tmpl?.headerLeft || "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE";
  const headerRight = tmpl?.headerRight || "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING";

  const colSideWidth = 195;
  const colCenterWidth = customWidth - (colSideWidth * 2);
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

  // Bloc Central : Centrage dynamique des armoiries et du logo
  const showLogo = tmpl?.showLogo !== false && Boolean(logoBuf);
  const showSeal = tmpl?.showSeal !== false && Boolean(sealBuf);

  if (showLogo && showSeal) {
    const imgSize = 40;
    const gap = 8;
    const totalImgW = (imgSize * 2) + gap;
    const imgStartX = centerColX + (colCenterWidth - totalImgW) / 2;

    safeDrawImage(doc, sealBuf, imgStartX, startY - 2, { fit: [imgSize, imgSize], align: "center" });
    safeDrawImage(doc, logoBuf, imgStartX + imgSize + gap, startY - 2, { fit: [imgSize, imgSize], align: "center" });
  } else if (showLogo || showSeal) {
    const activeBuf = showSeal ? sealBuf : logoBuf;
    const imgSize = 46;
    const imgStartX = centerColX + (colCenterWidth - imgSize) / 2;
    safeDrawImage(doc, activeBuf, imgStartX, startY - 3, { fit: [imgSize, imgSize], align: "center" });
  }

  if (center.phone) {
    doc.fillColor("#475569").fontSize(6.5).font("Helvetica-Bold").text(`Tél : ${center.phone}`, centerColX, startY + 44, {
      width: colCenterWidth,
      align: "center",
    });
  }

  doc.fillColor(primaryColor).fontSize(10.5).font("Helvetica-Bold").text(
    (center.name || "CENTRE DE FORMATION PROFESSIONNELLE").toUpperCase(),
    startX, startY + 56, { width: customWidth, align: "center" }
  );

  if (center.registrationNumber) {
    doc.rect(startX, startY + 70, customWidth, 13).fillAndStroke("#F8FAFC", "#CBD5E1");
    doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(
      `ARRETÉ D'AGRÉMENT N° ${center.registrationNumber} • ${center.city || "Cameroun"}`.toUpperCase(),
      startX, startY + 73.5, { width: customWidth, align: "center" }
    );
  }

  doc.moveTo(startX, startY + 86).lineTo(startX + customWidth, startY + 86).lineWidth(1.2).strokeColor(primaryColor).stroke();
}

/**
 * En-tête officiel MINEFOP Régional (modèle spécifique pour bordereaux officiels de délégation)
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

  // Volet Gauche (Français)
  doc.fillColor("#000000").fontSize(6.5).font("Helvetica-Bold").text(headerLeft, startX, startY, {
    width: colSideWidth,
    align: "center",
    lineGap: 1.5,
  });

  doc.fontSize(6.5).font("Helvetica-Bold").text(`Tél : ${phone}`, startX, startY + 75, {
    width: colSideWidth,
    align: "center",
  });

  // Volet Droit (Anglais)
  doc.text(headerRight, rightColX, startY, {
    width: colSideWidth,
    align: "center",
    lineGap: 1.5,
  });

  doc.fontSize(6.5).font("Helvetica-Bold").text(`Email : ${email}`, rightColX, startY + 75, {
    width: colSideWidth,
    align: "center",
  });

  // Date d'émission
  doc.fontSize(7).font("Helvetica").text(`${city}, le _______________________`, rightColX, startY + 92, {
    width: colSideWidth,
    align: "right",
  });
}

module.exports = {
  drawDynamicBilingualHeader,
  drawRegionalMinefopHeader,
};