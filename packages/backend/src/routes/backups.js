const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { centerStoragePath } = require("../storage/paths");
const fs = require("fs/promises");

const router = express.Router();
const BACKUP_FREQUENCY_KEY = "backup.frequency";

// Liste les archives déjà présentes dans storage/{centerId}/backups.
// Volontairement honnête : le déclenchement AUTOMATIQUE (pg_dump planifié)
// n'est pas encore câblé à ce stade — voir le mécanisme documenté dans le
// document technique (section 6). Ce sera branché une fois le binaire
// pg_dump correctement localisé depuis l'instance PostgreSQL embarquée.
router.get("/backups", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const dir = centerStoragePath(req.centerId, "backups");
    let entries = [];
    try {
      const files = await fs.readdir(dir);
      entries = await Promise.all(
        files.map(async (name) => {
          const stat = await fs.stat(`${dir}/${name}`);
          return { name, sizeBytes: stat.size, createdAt: stat.birthtime };
        })
      );
    } catch {
      entries = []; // dossier pas encore créé — liste vide, pas une erreur
    }
    entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(entries);
  } catch (err) {
    next(err);
  }
});

router.get("/backups/config", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const setting = await prisma.setting.findUnique({
      where: { centerId_key: { centerId: req.centerId, key: BACKUP_FREQUENCY_KEY } },
    });
    res.json({ frequency: setting?.value ?? "daily" });
  } catch (err) {
    next(err);
  }
});

router.put("/backups/config", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { frequency } = req.body || {};
    if (!["daily", "weekly", "monthly"].includes(frequency)) {
      return res.status(400).json({ error: "Fréquence invalide." });
    }
    await prisma.setting.upsert({
      where: { centerId_key: { centerId: req.centerId, key: BACKUP_FREQUENCY_KEY } },
      update: { value: frequency },
      create: { centerId: req.centerId, key: BACKUP_FREQUENCY_KEY, value: frequency },
    });
    res.json({ frequency });
  } catch (err) {
    next(err);
  }
});

module.exports = router;