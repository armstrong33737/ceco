// packages/backend/src/services/pdf/common/pdfGraphics.js
const { safeDrawImage } = require("./pdfHelpers");

/**
 * Dessine un avatar d'apprenant avec cadrage parfait ou silhouette vectorielle de remplacement
 */
function drawStudentAvatar(doc, photoBuf, x, y, width = 60, height = 60) {
  doc.save();
  doc.rect(x, y, width, height).fillAndStroke("#F1F5F9", "#CBD5E1");

  if (photoBuf) {
    try {
      doc.save();
      doc.rect(x + 1, y + 1, width - 2, height - 2).clip();
      safeDrawImage(doc, photoBuf, x + 1, y + 1, { fit: [width - 2, height - 2], align: "center", valign: "center" });
      doc.restore();
      doc.restore();
      return;
    } catch {
      try { doc.restore(); } catch {}
    }
  }

  // Silhouette vectorielle moderne de secours
  const cx = x + width / 2;
  const headRadius = width * 0.20;
  const headCy = y + height * 0.35;

  doc.fillColor("#94A3B8");
  doc.circle(cx, headCy, headRadius).fill();

  doc.save();
  doc.rect(x + 2, y + 2, width - 4, height - 4).clip();
  doc.circle(cx, y + height * 1.05, width * 0.44).fill();
  doc.restore();

  doc.restore();
}

/**
 * Dessine un filigrane translucide haute définition.
 * RÈGLE D'OR : Le filigrane est UNIQUEMENT le logo de l'établissement (jamais le Sceau d'État).
 */
function drawWatermark(doc, tmpl, logoBuf, sealBuf, x, y, size = 260) {
  if (tmpl?.showWatermark === false) return;
  // Uniquement le logo du centre
  const wmBuf = logoBuf;
  if (!wmBuf) return;

  doc.save();
  const opacity = tmpl?.watermarkOpacity !== undefined ? Number(tmpl.watermarkOpacity) : 0.05;
  doc.opacity(Math.max(0.01, Math.min(0.25, opacity)));
  safeDrawImage(doc, wmBuf, x, y, { width: size, fit: [size, size] });
  doc.restore();
  doc.opacity(1.0);
}

/**
 * Dessine les repères de coupe (massicot) d'imprimerie pour les planches de badges
 */
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
  doc.moveTo(x + w, y + h).lineTo(x + w, y + h + markLen).stroke();

  doc.restore();
}

/**
 * Dessine les triples bordures dorées et fleurons d'angle ornementaux des diplômes officiels
 */
function drawDiplomaOrnamentalBorders(doc, width = 842, height = 595, primaryColor = "#071A2E") {
  doc.save();
  doc.rect(18, 18, width - 36, height - 36).lineWidth(2).strokeColor(primaryColor).stroke();
  doc.rect(22, 22, width - 44, height - 44).lineWidth(0.8).strokeColor("#D4AF37").stroke();
  doc.rect(25, 25, width - 50, height - 50).lineWidth(0.4).strokeColor(primaryColor).stroke();

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

module.exports = {
  drawStudentAvatar,
  drawWatermark,
  drawCropMarks,
  drawDiplomaOrnamentalBorders,
};