// packages/backend/src/routes/center.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { centerStoragePath, ensureStorageTree } = require("../storage/paths");
const { getDefaultSealFilePath, ensureDefaultSealOnDisk } = require("../storage/defaultSeal");
const { findDefaultAssetBuffer } = require("../services/pdf/common/pdfHelpers");

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

const DEFAULT_SIGNATURE_ROLES = [
  { key: "directeur", title: "Directeur Général", desc: "Signature officielle de la Direction" },
  { key: "promoteur", title: "Promoteur / Fondateur", desc: "Signature officielle du Promoteur" },
  { key: "delegue", title: "Le Délégué Départemental", desc: "Visa de la tutelle MINEFOP pour examens blancs" },
];

function brandingDir(centerId) {
  return centerStoragePath(centerId, "settings/branding");
}

function signaturesDir(centerId) {
  return centerStoragePath(centerId, "settings/signatures");
}

function removeExistingLogoFiles(centerId) {
  const dir = centerStoragePath(centerId, "settings/branding");
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith("logo.")) {
      try { fs.unlinkSync(path.join(dir, file)); } catch {}
    }
  }
}

function removeExistingSealFiles(centerId) {
  const dir = centerStoragePath(centerId, "settings/branding");
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith("seal.")) {
      try { fs.unlinkSync(path.join(dir, file)); } catch {}
    }
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
  const targetDir = centerStoragePath(centerId, "settings/branding");
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, `logo.${ext}`), buffer);
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
  const targetDir = centerStoragePath(centerId, "settings/branding");
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, `seal.${ext}`), buffer);
  return ext;
}

function serializeCenter(center) {
  const out = {};
  for (const field of EDITABLE_FIELDS) out[field] = center[field];
  out.id = center.id;
  out.hasLogo = Boolean(center.logo);
  return out;
}

// 1. Informations du centre
router.get("/center", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
  try {
    const [center, matriculeSetting] = await Promise.all([
      prisma.center.findUnique({ where: { id: req.centerId } }),
      prisma.setting.findUnique({
        where: { centerId_key: { centerId: req.centerId, key: "center.matricule_format" } },
      }),
    ]);

    if (!center) return res.status(404).json({ error: "Centre introuvable." });

    ensureDefaultSealOnDisk(req.centerId);

    const branding = brandingDir(req.centerId);
    let hasCustomSeal = false;
    if (fs.existsSync(branding)) {
      const files = fs.readdirSync(branding);
      hasCustomSeal = files.some((f) => f.startsWith("seal."));
    }

    const payload = serializeCenter(center);
    payload.hasSeal = hasCustomSeal || Boolean(getDefaultSealFilePath());
    payload.isDefaultSeal = !hasCustomSeal;
    payload.matriculeFormat = matriculeSetting?.value?.format || "{CTR}-{FIL}{YY}-{NUM4}";

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// 2. Logo du centre
router.get("/center/logo", verifyJwt, async (req, res, next) => {
  try {
    const center = await prisma.center.findUnique({ where: { id: req.centerId } });
    if (!center?.logo) return res.status(404).json({ error: "Aucun logo défini." });

    const filePath = path.join(brandingDir(req.centerId), `logo.${center.logo}`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Fichier logo introuvable." });

    res.setHeader("Content-Type", EXT_TO_MIME[center.logo] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// 3. Texture de fond de la carte (Toujours disponible avec fallback asset)
router.get("/center/card-bg", verifyJwt, async (req, res, next) => {
  try {
    const dir = brandingDir(req.centerId);
    if (fs.existsSync(dir)) {
      const file = fs.readdirSync(dir).find((f) => f.startsWith("card_bg."));
      if (file) {
        const filePath = path.join(dir, file);
        const ext = path.extname(file).replace(".", "").toLowerCase();
        res.setHeader("Content-Type", EXT_TO_MIME[ext] || "image/jpeg");
        res.setHeader("Cache-Control", "no-cache");
        return fs.createReadStream(filePath).pipe(res);
      }
    }

    // Repli garanti sur l'asset par défaut card_bg.jpg
    const buffer = findDefaultAssetBuffer(["card_bg", "card_background"]);
    if (buffer) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.end(buffer);
    }

    res.status(404).json({ error: "Aucune texture de carte disponible." });
  } catch (err) {
    next(err);
  }
});

router.post("/center/card-bg", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { bgDataUrl } = req.body || {};
    if (!bgDataUrl || !bgDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Fichier image invalide." });
    }

    await ensureStorageTree(req.centerId);
    const targetDir = centerStoragePath(req.centerId, "settings/branding");
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    for (const file of fs.readdirSync(targetDir)) {
      if (file.startsWith("card_bg.")) {
        try { fs.unlinkSync(path.join(targetDir, file)); } catch {}
      }
    }

    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(bgDataUrl);
    const ext = MIME_TO_EXT[match[1]] || "png";
    const buffer = Buffer.from(match[2], "base64");

    fs.writeFileSync(path.join(targetDir, `card_bg.${ext}`), buffer);
    res.json({ success: true, message: "Texture de carte enregistrée avec succès." });
  } catch (err) {
    next(err);
  }
});

// 4. Texture de fond du Relevé Annuel (Toujours disponible avec fallback asset recap_bg.jpg)
router.get("/center/transcript-bg", verifyJwt, async (req, res, next) => {
  try {
    const dir = brandingDir(req.centerId);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const foundFile =
        files.find((f) => f.startsWith("recap_bg.")) ||
        files.find((f) => f.startsWith("transcript_bg.")) ||
        files.find((f) => f.startsWith("releve_bg.")) ||
        files.find((f) => f.startsWith("card_bg."));

      if (foundFile) {
        const filePath = path.join(dir, foundFile);
        const ext = path.extname(foundFile).replace(".", "").toLowerCase();
        res.setHeader("Content-Type", EXT_TO_MIME[ext] || "image/jpeg");
        res.setHeader("Cache-Control", "no-cache");
        return fs.createReadStream(filePath).pipe(res);
      }
    }

    // Repli garanti sur recap_bg.jpg
    const buffer = findDefaultAssetBuffer(["recap_bg", "transcript_bg", "card_bg"]);
    if (buffer) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.end(buffer);
    }

    res.status(404).json({ error: "Aucun fond pour relevé disponible." });
  } catch (err) {
    next(err);
  }
});

router.post("/center/transcript-bg", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { bgDataUrl } = req.body || {};
    if (!bgDataUrl || !bgDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Fichier image invalide." });
    }

    await ensureStorageTree(req.centerId);
    const targetDir = centerStoragePath(req.centerId, "settings/branding");
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    for (const file of fs.readdirSync(targetDir)) {
      if (file.startsWith("recap_bg.") || file.startsWith("transcript_bg.") || file.startsWith("releve_bg.")) {
        try { fs.unlinkSync(path.join(targetDir, file)); } catch {}
      }
    }

    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(bgDataUrl);
    const ext = MIME_TO_EXT[match[1]] || "png";
    const buffer = Buffer.from(match[2], "base64");

    fs.writeFileSync(path.join(targetDir, `recap_bg.${ext}`), buffer);
    res.json({ success: true, message: "Texture de relevé (recap_bg) enregistrée avec succès." });
  } catch (err) {
    next(err);
  }
});

// 5. Fond de l'Attestation de Fin de Formation (Toujours disponible avec fallback asset attestation_bg.jpg)
router.get("/center/diploma-bg", verifyJwt, async (req, res, next) => {
  try {
    const dir = brandingDir(req.centerId);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const foundFile =
        files.find((f) => f.startsWith("attestation_bg.")) ||
        files.find((f) => f.startsWith("diplome_bg.")) ||
        files.find((f) => f.startsWith("certificat_bg.")) ||
        files.find((f) => f.startsWith("card_bg."));

      if (foundFile) {
        const filePath = path.join(dir, foundFile);
        const ext = path.extname(foundFile).replace(".", "").toLowerCase();
        res.setHeader("Content-Type", EXT_TO_MIME[ext] || "image/jpeg");
        res.setHeader("Cache-Control", "no-cache");
        return fs.createReadStream(filePath).pipe(res);
      }
    }

    // Repli garanti sur attestation_bg.jpg
    const buffer = findDefaultAssetBuffer(["attestation_bg", "diplome_bg", "card_bg"]);
    if (buffer) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.end(buffer);
    }

    res.status(404).json({ error: "Aucun fond pour attestation disponible." });
  } catch (err) {
    next(err);
  }
});

router.post("/center/diploma-bg", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { bgDataUrl } = req.body || {};
    if (!bgDataUrl || !bgDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Fichier image invalide." });
    }

    await ensureStorageTree(req.centerId);
    const targetDir = centerStoragePath(req.centerId, "settings/branding");
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    for (const file of fs.readdirSync(targetDir)) {
      if (file.startsWith("attestation_bg.") || file.startsWith("diplome_bg.") || file.startsWith("certificat_bg.")) {
        try { fs.unlinkSync(path.join(targetDir, file)); } catch {}
      }
    }

    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(bgDataUrl);
    const ext = MIME_TO_EXT[match[1]] || "png";
    const buffer = Buffer.from(match[2], "base64");

    fs.writeFileSync(path.join(targetDir, `attestation_bg.${ext}`), buffer);
    res.json({ success: true, message: "Fond d'attestation (attestation_bg) enregistré avec succès." });
  } catch (err) {
    next(err);
  }
});

// 6. Sceau de la République (Streaming)
router.get("/center/seal", verifyJwt, async (req, res, next) => {
  try {
    const dir = brandingDir(req.centerId);
    let filePath = null;
    let ext = "png";

    if (fs.existsSync(dir)) {
      const file = fs.readdirSync(dir).find((f) => f.startsWith("seal."));
      if (file) {
        filePath = path.join(dir, file);
        ext = path.extname(file).replace(".", "").toLowerCase();
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      const defaultAsset = getDefaultSealFilePath();
      if (defaultAsset) {
        filePath = defaultAsset.filePath;
        ext = defaultAsset.ext;
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Aucun fichier image de sceau trouvé." });
    }

    res.setHeader("Content-Type", EXT_TO_MIME[ext] || "image/png");
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// 7. Mise à jour des coordonnées & direction
router.put("/center", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { name, logo, seal, matriculeFormat } = req.body || {};
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

    if (seal === "default" || seal === "") {
      removeExistingSealFiles(req.centerId);
      ensureDefaultSealOnDisk(req.centerId);
    } else if (typeof seal === "string" && seal.startsWith("data:image/")) {
      saveSealFromDataUrl(req.centerId, seal);
    }

    let savedMatriculeFormat = "{CTR}-{FIL}{YY}-{NUM4}";
    if (matriculeFormat && typeof matriculeFormat === "string") {
      const cleanFormat = matriculeFormat.trim();
      await prisma.setting.upsert({
        where: { centerId_key: { centerId: req.centerId, key: "center.matricule_format" } },
        update: { value: { format: cleanFormat } },
        create: { centerId: req.centerId, key: "center.matricule_format", value: { format: cleanFormat } },
      });
      savedMatriculeFormat = cleanFormat;
    }

    const center = await prisma.center.update({ where: { id: req.centerId }, data });
    const payload = serializeCenter(center);
    payload.hasSeal = true;
    payload.matriculeFormat = savedMatriculeFormat;

    res.json(payload);
  } catch (err) {
    if (err.message?.includes("Image trop volumineuse") || err.message?.includes("Format")) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// 8. Rétablissement du Sceau par défaut
router.post("/center/seal/reset", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    removeExistingSealFiles(req.centerId);
    ensureDefaultSealOnDisk(req.centerId);
    res.json({ success: true, message: "Sceau par défaut rétabli." });
  } catch (err) {
    next(err);
  }
});

// 9. Rôles de signatures configurés
router.get("/center/signature-roles", verifyJwt, async (req, res, next) => {
  try {
    const setting = await prisma.setting.findUnique({
      where: { centerId_key: { centerId: req.centerId, key: "center.signature_roles" } },
    });
    res.json(setting?.value || DEFAULT_SIGNATURE_ROLES);
  } catch (err) {
    next(err);
  }
});

router.put("/center/signature-roles", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { roles } = req.body || {};
    if (!Array.isArray(roles)) {
      return res.status(400).json({ error: "Liste de rôles invalide." });
    }

    const setting = await prisma.setting.upsert({
      where: { centerId_key: { centerId: req.centerId, key: "center.signature_roles" } },
      update: { value: roles },
      create: { centerId: req.centerId, key: "center.signature_roles", value: roles },
    });

    res.json(setting.value);
  } catch (err) {
    next(err);
  }
});

// 10. Signatures physiques existantes
router.get("/center/signatures", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
  try {
    const dir = signaturesDir(req.centerId);
    await ensureStorageTree(req.centerId);

    const signatures = {};
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith(".png")) {
          const roleKey = path.basename(file, ".png");
          signatures[roleKey] = true;
        }
      }
    }

    res.json(signatures);
  } catch (err) {
    next(err);
  }
});

router.get("/center/signatures/:roleKey", verifyJwt, async (req, res, next) => {
  try {
    const dir = signaturesDir(req.centerId);
    const safeKey = req.params.roleKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const filePath = path.join(dir, `${safeKey}.png`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Signature introuvable." });
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(filePath).pipe(res);
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
    if (!match) return res.status(400).json({ error: "Format d'image invalide." });

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