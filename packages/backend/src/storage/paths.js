const path = require("path");
const fs = require("fs/promises");

const STORAGE_ROOT = process.env.CECO_STORAGE_ROOT || path.join(process.cwd(), "data", "storage");

const SUBFOLDERS = [
  "students/photos",
  "students/documents",
  "documents/bulletins",
  "documents/attestations",
  "documents/diplomes",
  "documents/pv",
  "documents/presence",
  "stages/conventions",
  "stages/rapports",
  "finance/recus",
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

module.exports = { STORAGE_ROOT, centerStoragePath, ensureStorageTree, getStorageUsage };
