// packages/backend/src/storage/defaultSeal.js
const fs = require("fs");
const path = require("path");
const { centerStoragePath } = require("./paths");

const SUPPORTED_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp"];

/**
 * Recherche le fichier physique de sceau par défaut dans les dossiers d'assets
 */
function getDefaultSealFilePath() {
  const possibleDirs = [
    path.join(__dirname, "../../assets"),
    path.join(process.cwd(), "assets"),
    path.join(process.cwd(), "packages/backend/assets"),
    path.join(process.cwd(), "packages/desktop/assets"),
    ...(process.resourcesPath ? [path.join(process.resourcesPath, "backend/assets"), path.join(process.resourcesPath, "assets")] : []),
  ];

  for (const dir of possibleDirs) {
    if (fs.existsSync(dir)) {
      for (const ext of SUPPORTED_EXTENSIONS) {
        const filePath = path.join(dir, `seal.${ext}`);
        if (fs.existsSync(filePath)) {
          return { filePath, ext };
        }
      }
    }
  }

  return null;
}

/**
 * Renvoie le Sceau par défaut sous forme de Data URL Base64
 */
function getDefaultSealBase64() {
  const found = getDefaultSealFilePath();
  if (!found) return null;

  try {
    const buffer = fs.readFileSync(found.filePath);
    const mime = found.ext === "svg" ? "image/svg+xml" : found.ext === "png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.warn("[DefaultSeal] Erreur lecture image sceau par défaut :", err.message);
    return null;
  }
}

/**
 * Copie le fichier image par défaut dans le stockage du centre si aucun sceau n'existe
 */
function ensureDefaultSealOnDisk(centerId) {
  const brandingDir = centerStoragePath(centerId, "settings/branding");
  if (!fs.existsSync(brandingDir)) {
    fs.mkdirSync(brandingDir, { recursive: true });
  }

  const existingSeal = fs.readdirSync(brandingDir).find((f) => f.startsWith("seal."));
  if (!existingSeal) {
    const defaultAsset = getDefaultSealFilePath();
    if (defaultAsset) {
      const destPath = path.join(brandingDir, `seal.${defaultAsset.ext}`);
      fs.copyFileSync(defaultAsset.filePath, destPath);
    }
  }
}

module.exports = {
  getDefaultSealFilePath,
  getDefaultSealBase64,
  ensureDefaultSealOnDisk,
};