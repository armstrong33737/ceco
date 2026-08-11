const express = require("express");
const fs = require("fs");
const path = require("path");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { centerStoragePath, ensureStorageTree } = require("../storage/paths");

const router = express.Router();

const EDITABLE_FIELDS = [
  "name", "email", "phone",
  "address", "city", "postalCode", "country", "website",
  "registrationNumber", "directorName", "directorTitle", "description",
];

const MIME_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const EXT_TO_MIME = Object.fromEntries(Object.entries(MIME_TO_EXT).map(([m, e]) => [e, m]));

function brandingDir(centerId) {
  return centerStoragePath(centerId, "settings/branding");
}

// Supprime tout fichier logo.* existant, quelle que soit son extension —
// évite d'accumuler d'anciens formats si l'utilisateur change de logo.
function removeExistingLogoFiles(centerId) {
  const dir = brandingDir(centerId);
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith("logo.")) fs.unlinkSync(path.join(dir, file));
  }
}

// Décode un data URL (data:image/png;base64,...) envoyé par le frontend et
// écrit l'image comme un VRAI fichier sur disque, scopé au centre — jamais
// stockée en base64 en base de données (voir storage/{centerId}/settings/branding).
function saveLogoFromDataUrl(centerId, dataUrl) {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Format d'image invalide.");
  const [, mime, base64Payload] = match;
  const ext = MIME_TO_EXT[mime];
  if (!ext) throw new Error("Format d'image non supporté (PNG, JPEG, WEBP ou SVG uniquement).");

  const buffer = Buffer.from(base64Payload, "base64");
  const MAX_SIZE = 2 * 1024 * 1024; // 2 Mo — un logo n'a pas besoin d'être plus lourd
  if (buffer.length > MAX_SIZE) throw new Error("Image trop volumineuse (2 Mo maximum).");

  removeExistingLogoFiles(centerId);
  fs.writeFileSync(path.join(brandingDir(centerId), `logo.${ext}`), buffer);
  return ext;
}

function serializeCenter(center) {
  const out = {};
  for (const field of EDITABLE_FIELDS) out[field] = center[field];
  out.id = center.id;
  out.hasLogo = !!center.logo; // center.logo ne stocke plus qu'une extension ("png", "svg"...)
  return out;
}

router.get("/center", verifyJwt, async (req, res, next) => {
  try {
    const center = await prisma.center.findUnique({ where: { id: req.centerId } });
    if (!center) return res.status(404).json({ error: "Centre introuvable." });
    res.json(serializeCenter(center));
  } catch (err) {
    next(err);
  }
});

// Sert le fichier logo réel — appelé via fetch() authentifié côté frontend
// (pas un <img src> direct, puisqu'une balise <img> ne peut pas envoyer
// l'en-tête Authorization).
router.get("/center/logo", verifyJwt, async (req, res, next) => {
  try {
    const center = await prisma.center.findUnique({ where: { id: req.centerId } });
    if (!center?.logo) return res.status(404).json({ error: "Aucun logo défini." });

    const filePath = path.join(brandingDir(req.centerId), `logo.${center.logo}`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Fichier logo introuvable." });

    res.setHeader("Content-Type", EXT_TO_MIME[center.logo] || "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=60");
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

router.put("/center", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { name, logo } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Le nom du centre est requis." });
    }

    await ensureStorageTree(req.centerId);

    const data = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field] || null;
    }
    data.name = name.trim();

    // logo : trois cas possibles.
    // - non fourni (undefined)  -> on ne touche à rien.
    // - chaîne vide ("")        -> suppression explicite du logo.
    // - data URL (data:image/…)  -> nouvel upload, écrit comme fichier réel.
    if (logo === "") {
      removeExistingLogoFiles(req.centerId);
      data.logo = null;
    } else if (typeof logo === "string" && logo.startsWith("data:image/")) {
      data.logo = saveLogoFromDataUrl(req.centerId, logo);
    }

    const center = await prisma.center.update({ where: { id: req.centerId }, data });
    res.json(serializeCenter(center));
  } catch (err) {
    if (err.message?.includes("Image trop volumineuse") || err.message?.includes("Format d'image")) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;