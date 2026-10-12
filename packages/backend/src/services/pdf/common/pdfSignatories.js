// packages/backend/src/services/pdf/common/pdfSignatories.js
const { bufferFromDataUrl, safeDrawImage } = require("./pdfHelpers");

/**
 * Rendu compact officiel des blocs de signature, date, mentions légales et QR Code haute lisibilité
 */
function renderSignatoriesAndQrCompact(doc, snapshot, qrBuf, signatories = [], startY = 708, customWidth = 545, startX = 25) {
  const { center = {}, templateConfig: tmpl = {} } = snapshot;
  const primaryColor = tmpl?.primaryColor || "#071A2E";

  const dateText = `Fait à ${center.city || "Bafoussam"}, le ${new Date().toLocaleDateString("fr-FR")}`;
  doc.fillColor("#0F172A").fontSize(7).font("Helvetica").text(
    dateText,
    startX + customWidth - 200, startY - 11, { width: 200, align: "right" }
  );

  // QR Code compact scellé (< 150 caractères)
  const qrSize = 48;
  if (qrBuf) {
    doc.rect(startX - 1, startY - 1, qrSize + 2, qrSize + 2).strokeColor("#CBD5E1").lineWidth(0.5).stroke();
    safeDrawImage(doc, qrBuf, startX, startY, { width: qrSize, height: qrSize });

    const sigCuid = snapshot.qrToken ? snapshot.qrToken.split("?")[0].substring(0, 10) : "CECO";
    doc.fillColor("#475569").fontSize(5).font("Courier").text(
      `ID: ${sigCuid}`,
      startX, startY + qrSize + 2, { width: qrSize + 8, align: "center" }
    );
  }

  const sigStartX = qrBuf ? startX + qrSize + 16 : startX;
  const sigWidth = qrBuf ? customWidth - qrSize - 16 : customWidth;

  const count = Math.max(1, signatories.length || 2);
  const colW = sigWidth / count;

  signatories.forEach((sig, idx) => {
    const sx = sigStartX + idx * colW;
    const title = sig.title || (idx === 0 ? "Le Promoteur" : "Le Directeur Général");
    const roleKey = sig.roleKey || (idx === 0 ? "promoteur" : "directeur");
    const sigBuf = bufferFromDataUrl(center.signatures?.[roleKey] || (idx === count - 1 ? center.signatures?.directeur : null));

    doc.fillColor("#0F172A").fontSize(7.5).font("Helvetica-Bold").text(title, sx, startY + 1, { width: colW, align: "center" });
    doc.fontSize(5.5).font("Helvetica").text("(Cachet et Signature)", sx, startY + 10, { width: colW, align: "center" });

    if (sigBuf) {
      safeDrawImage(doc, sigBuf, sx + (colW - 80) / 2, startY + 16, { fit: [80, 28], align: "center" });
    }
  });

  // Séparateur fin et mentions de pied de page
  doc.moveTo(startX, 774).lineTo(startX + customWidth, 774).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

  doc.fillColor("#64748B").fontSize(6).font("Helvetica").text(
    tmpl?.footerLegal || "Document officiel certifié conforme • Toute altération physique ou numérique annule la validité du présent acte.",
    startX, 778, { width: customWidth - 110 }
  );

  doc.fillColor(primaryColor).fontSize(6).font("Helvetica-Bold").text("PROPULSÉ PAR CECO ERP", startX + customWidth - 100, 778, { align: "right" });
}

module.exports = {
  renderSignatoriesAndQrCompact,
};