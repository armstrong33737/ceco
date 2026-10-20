// packages/backend/src/services/pdf/common/pdfHelpers.js
const fs = require("fs");
const path = require("path");
const { centerStoragePath } = require("../../../storage/paths");

const SUPPORTED_BG_EXTS = ["jpg", "jpeg", "png", "webp"];

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
    console.warn("[PDFHelpers] Erreur rendu image :", err.message);
    return false;
  }
}

/**
 * Recherche déterministe d'un fichier asset par défaut dans l'arborescence dev et Electron packagée
 */
function findDefaultAssetBuffer(baseNames = []) {
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
      path.join(process.resourcesPath, "app.asar.unpacked/assets"),
      path.join(process.resourcesPath, "app.asar.unpacked/backend/assets"),
    ] : []),
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      for (const name of baseNames) {
        for (const ext of SUPPORTED_BG_EXTS) {
          const p = path.join(dir, `${name}.${ext}`);
          if (fs.existsSync(p)) {
            try {
              return fs.readFileSync(p);
            } catch {}
          }
        }
      }
    }
  }
  return null;
}

/**
 * Résout le buffer de texture d'arrière-plan selon le type de document
 * 1. Priorité aux données DataUrl directes
 * 2. Dossier de branding personnalisé du centre
 * 3. Repli automatique et garanti vers les assets du projet (card_bg.jpg, attestation_bg.jpg, recap_bg.jpg)
 */
function resolveDocumentTextureBuffer(centerId, docType = "card", tmpl = {}) {
  if (tmpl?.bgDataUrl && typeof tmpl.bgDataUrl === "string") {
    const buf = bufferFromDataUrl(tmpl.bgDataUrl);
    if (buf) return buf;
  }

  let prefixes = ["card_bg", "card_background"];
  if (docType === "diploma" || docType === "attestation_reussite") {
    prefixes = ["attestation_bg", "diplome_bg", "certificat_bg", "card_bg"];
  } else if (docType === "transcript" || docType === "recap") {
    prefixes = ["recap_bg", "transcript_bg", "releve_bg", "card_bg"];
  }

  if (centerId) {
    try {
      const brandingDir = centerStoragePath(centerId, "settings/branding");
      if (fs.existsSync(brandingDir)) {
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

  // Repli automatique garanti sur les assets d'origine
  return findDefaultAssetBuffer(prefixes);
}

function resolveCardTextureBuffer(centerId, tmpl = {}) {
  return resolveDocumentTextureBuffer(centerId, "card", tmpl);
}

module.exports = {
  bufferFromDataUrl,
  safeDrawImage,
  resolveDocumentTextureBuffer,
  resolveCardTextureBuffer,
  findDefaultAssetBuffer,
};