// packages/backend/src/storage/paths.js
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");

const STORAGE_ROOT = process.env.CECO_STORAGE_ROOT || path.join(process.cwd(), "data", "storage");

const SUBFOLDERS = [
  "students/photos",
  "students/documents",
  "documents/archive",
  "documents/archive/bulletins",
  "documents/archive/attestations",
  "documents/archive/diplomes",
  "documents/archive/transcripts",
  "documents/archive/pvs",
  "documents/temp",
  "documents/temp/emargements",
  "documents/temp/bordereaux_vierges",
  "stages/conventions",
  "stages/rapports",
  "settings/branding",
  "settings/signatures",
  "backups",
  "temp",
];

// Aucun module ne construit un chemin à la main : tout passe par cette fonction.
function centerStoragePath(centerId, ...segments) {
  if (!centerId) throw new Error("centerStoragePath appelé sans centerId.");
  return path.join(STORAGE_ROOT, centerId, ...segments);
}

async function ensureStorageTree(centerId) {
  for (const sub of SUBFOLDERS) {
    await fs.mkdir(centerStoragePath(centerId, sub), { recursive: true });
  }
}

async function getDirectorySize(dirPath) {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    total += entry.isDirectory()
      ? await getDirectorySize(fullPath)
      : (await fs.stat(fullPath)).size;
  }
  return total;
}

async function getStorageUsage(centerId) {
  return getDirectorySize(centerStoragePath(centerId));
}

// Nettoyage régulier du cache temporaire (fichiers éphémères de plus de 24h)
function cleanTempStorage(centerId) {
  try {
    const tempDir = centerStoragePath(centerId, "documents/temp");
    if (!fsSync.existsSync(tempDir)) return;

    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;

    const walkAndClean = (dir) => {
      const files = fsSync.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          walkAndClean(fullPath);
        } else {
          const stats = fsSync.statSync(fullPath);
          if (now - stats.mtimeMs > maxAge) {
            try { fsSync.unlinkSync(fullPath); } catch {}
          }
        }
      }
    };

    walkAndClean(tempDir);
  } catch (err) {
    console.warn("[Storage] Avertissement purge dossier temporaire :", err.message);
  }
}

module.exports = {
  STORAGE_ROOT,
  centerStoragePath,
  ensureStorageTree,
  getStorageUsage,
  cleanTempStorage,
};