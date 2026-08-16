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

function signaturesDir(centerId) {
  return centerStoragePath(centerId, "settings/signatures");
}

function removeExistingLogoFiles(centerId) {
  const dir = brandingDir(centerId);
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith("logo.")) fs.unlinkSync(path.join(dir, file));
  }
}

function removeExistingSealFiles(centerId) {
  const dir = brandingDir(centerId);
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith("seal.")) fs.unlinkSync(path.join(dir, file));
  }
}

function saveLogoFromDataUrl(centerId, dataUrl) {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Format d'image invalide.");
  const [, mime, base64Payload] = match;
  const ext = MIME_TO_EXT[mime];
  if (!ext) throw new Error("Format d'image non supporté (PNG, JPEG, WEBP ou SVG).");

  const buffer = Buffer.from(base64Payload, "base64");
  if (buffer.length > 3 * 1024 * 1024) throw new Error("Image trop volumineuse (3 Mo max).");

  removeExistingLogoFiles(centerId);
  fs.writeFileSync(path.join(brandingDir(centerId), `logo.${ext}`), buffer);
  return ext;
}

function saveSealFromDataUrl(centerId, dataUrl) {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Format de sceau invalide.");
  const [, mime, base64Payload] = match;
  const ext = MIME_TO_EXT[mime] || "png";

  const buffer = Buffer.from(base64Payload, "base64");
  if (buffer.length > 3 * 1024 * 1024) throw new Error("Image du sceau trop volumineuse (3 Mo max).");

  removeExistingSealFiles(centerId);
  fs.writeFileSync(path.join(brandingDir(centerId), `seal.${ext}`), buffer);
  return ext;
}

function serializeCenter(center) {
  const out = {};
  for (const field of EDITABLE_FIELDS) out[field] = center[field];
  out.id = center.id;
  out.hasLogo = !!center.logo;
  return out;
}

router.get("/center", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
  try {
    const center = await prisma.center.findUnique({ where: { id: req.centerId } });
    if (!center) return res.status(404).json({ error: "Centre introuvable." });
    
    // Vérification de la présence physique du sceau d'État
    const branding = brandingDir(req.centerId);
    let hasSeal = false;
    if (fs.existsSync(branding)) {
      hasSeal = fs.readdirSync(branding).some((f) => f.startsWith("seal."));
    }

    const payload = serializeCenter(center);
    payload.hasSeal = hasSeal;
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

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

router.get("/center/seal", verifyJwt, async (req, res, next) => {
  try {
    const dir = brandingDir(req.centerId);
    if (!fs.existsSync(dir)) return res.status(404).json({ error: "Aucun sceau." });

    const file = fs.readdirSync(dir).find((f) => f.startsWith("seal."));
    if (!file) return res.status(404).json({ error: "Aucun sceau." });

    const filePath = path.join(dir, file);
    const ext = path.extname(file).replace(".", "").toLowerCase();

    res.setHeader("Content-Type", EXT_TO_MIME[ext] || "image/png");
    res.setHeader("Cache-Control", "private, max-age=60");
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

router.put("/center", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { name, logo, seal } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Le nom du centre est requis." });
    }

    await ensureStorageTree(req.centerId);

    const data = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field] || null;
    }
    data.name = name.trim();

    if (logo === "") {
      removeExistingLogoFiles(req.centerId);
      data.logo = null;
    } else if (typeof logo === "string" && logo.startsWith("data:image/")) {
      data.logo = saveLogoFromDataUrl(req.centerId, logo);
    }

    if (seal === "") {
      removeExistingSealFiles(req.centerId);
    } else if (typeof seal === "string" && seal.startsWith("data:image/")) {
      saveSealFromDataUrl(req.centerId, seal);
    }

    const center = await prisma.center.update({ where: { id: req.centerId }, data });
    res.json(serializeCenter(center));
  } catch (err) {
    if (err.message?.includes("Image trop volumineuse") || err.message?.includes("Format")) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Gestion des signatures indexées par rôle
router.get("/center/signatures", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
  try {
    const dir = signaturesDir(req.centerId);
    await ensureStorageTree(req.centerId);

    const signatures = {};
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const roleKey = path.basename(file, path.extname(file));
        signatures[roleKey] = true;
      }
    }

    res.json(signatures);
  } catch (err) {
    next(err);
  }
});

router.post("/center/signatures", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { roleKey, signatureDataUrl } = req.body || {};
    if (!roleKey || !signatureDataUrl || !signatureDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Rôle institutionnel et image de signature requis." });
    }

    await ensureStorageTree(req.centerId);
    const dir = signaturesDir(req.centerId);

    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(signatureDataUrl);
    if (!match) return res.status(400).json({ error: "Format invalide." });

    const [, , base64Payload] = match;
    const buffer = Buffer.from(base64Payload, "base64");
    const safeKey = roleKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

    fs.writeFileSync(path.join(dir, `${safeKey}.png`), buffer);
    res.json({ success: true, roleKey: safeKey });
  } catch (err) {
    next(err);
  }
});

router.delete("/center/signatures/:roleKey", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const dir = signaturesDir(req.centerId);
    const safeKey = req.params.roleKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const filePath = path.join(dir, `${safeKey}.png`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;