// packages/backend/src/services/pdf/common/pdfHelpers.js
const fs = require("fs");
const path = require("path");
const { centerStoragePath } = require("../../../storage/paths");

const SUPPORTED_BG_EXTS = ["png", "jpg", "jpeg", "webp"];

/**
 * Convertit une chaîne DataURL base64 en Buffer binaire sécurisé
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
 * Insère une image dans le document PDF sans jamais faire planter le processus
 */
function safeDrawImage(doc, imgBuf, x, y, options = {}) {
  if (!imgBuf) return false;
  try {
    doc.image(imgBuf, x, y, options);
    return true;
  } catch (err) {
    console.warn("[PDFHelpers] Erreur rendu image :", err.message);
    return false;
  }
}

/**
 * Résout le buffer de texture d'arrière-plan selon le type de document
 * Prend en charge attestation_bg, diplome_bg, recap_bg, card_bg
 */
function resolveDocumentTextureBuffer(centerId, docType = "card", tmpl = {}) {
  if (tmpl.bgDataUrl && typeof tmpl.bgDataUrl === "string") {
    const buf = bufferFromDataUrl(tmpl.bgDataUrl);
    if (buf) return buf;
  }

  if (centerId) {
    try {
      const brandingDir = centerStoragePath(centerId, "settings/branding");
      if (fs.existsSync(brandingDir)) {
        let prefixes = ["card_bg", "card_background"];

        if (docType === "diploma" || docType === "attestation_reussite") {
          prefixes = ["attestation_bg", "diplome_bg", "certificat_bg", "card_bg"];
        } else if (docType === "transcript" || docType === "recap") {
          prefixes = ["recap_bg", "transcript_bg", "releve_bg", "card_bg"];
        }

        for (const pref of prefixes) {
          for (const ext of SUPPORTED_BG_EXTS) {
            const p = path.join(brandingDir, `${pref}.${ext}`);
            if (fs.existsSync(p)) {
              return fs.readFileSync(p);
            }
          }
        }
      }
    } catch (e) {
      console.warn("[PDFHelpers] Erreur lecture dossier branding :", e.message);
    }
  }

  // Repli dans les assets par défaut
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

  let prefixes = ["card_bg"];
  if (docType === "diploma" || docType === "attestation_reussite") {
    prefixes = ["attestation_bg", "diplome_bg", "card_bg"];
  } else if (docType === "transcript" || docType === "recap") {
    prefixes = ["recap_bg", "transcript_bg", "card_bg"];
  }

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      for (const pref of prefixes) {
        for (const ext of SUPPORTED_BG_EXTS) {
          const p = path.join(dir, `${pref}.${ext}`);
          if (fs.existsSync(p)) return fs.readFileSync(p);
        }
      }
    }
  }

  return null;
}

function resolveCardTextureBuffer(centerId, tmpl = {}) {
  return resolveDocumentTextureBuffer(centerId, "card", tmpl);
}

module.exports = {
  bufferFromDataUrl,
  safeDrawImage,
  resolveDocumentTextureBuffer,
  resolveCardTextureBuffer,
};