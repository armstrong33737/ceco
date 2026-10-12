// packages/backend/src/services/pdf/common/pdfHelpers.js

/**
 * Convertit une chaîne DataURL base64 en Buffer binaire sécurisé
 * @param {string} dataUrl 
 * @returns {Buffer|null}
 */
function bufferFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.includes(",")) return null;
  try {
    const base64 = dataUrl.split(",")[1];
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
}

/**
 * Insère une image dans le document PDF sans jamais faire planter le processus en cas de fichier corrompu
 * @param {PDFKit.PDFDocument} doc 
 * @param {Buffer} imgBuf 
 * @param {number} x 
 * @param {number} y 
 * @param {object} options 
 * @returns {boolean}
 */
function safeDrawImage(doc, imgBuf, x, y, options = {}) {
  if (!imgBuf) return false;
  try {
    doc.image(imgBuf, x, y, options);
    return true;
  } catch (err) {
    console.warn("[PDFHelpers] Erreur lors du rendu de l'image :", err.message);
    return false;
  }
}

module.exports = {
  bufferFromDataUrl,
  safeDrawImage,
};