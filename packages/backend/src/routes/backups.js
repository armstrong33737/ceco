// packages/backend/src/routes/backups.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const extract = require("extract-zip");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { centerStoragePath, ensureStorageTree } = require("../storage/paths");

const router = express.Router();

function backupDir(centerId) {
  return centerStoragePath(centerId, "backups");
}

function copyFolderRecursiveSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  const elements = fs.readdirSync(from);
  for (const element of elements) {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderRecursiveSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  }
}

// 1. Liste des sauvegardes existantes
router.get("/backups", verifyJwt, requirePermission("backups.read"), async (req, res, next) => {
  try {
    const dir = backupDir(req.centerId);
    await ensureStorageTree(req.centerId);
    const files = fs.readdirSync(dir);

    const backupFiles = files
      .filter((file) => file.endsWith(".zip"))
      .map((file) => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        return { name: file, sizeBytes: stats.size, createdAt: stats.mtime };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json(backupFiles);
  } catch (err) {
    next(err);
  }
});

// 2. Configuration automatique
router.get("/backups/config", verifyJwt, requirePermission("backups.read"), async (req, res, next) => {
  try {
    const setting = await prisma.setting.findUnique({
      where: { centerId_key: { centerId: req.centerId, key: "backup.config" } },
    });
    res.json(setting?.value || { frequency: "daily" });
  } catch (err) {
    next(err);
  }
});

router.put("/backups/config", verifyJwt, requirePermission("backups.update"), async (req, res, next) => {
  try {
    const { frequency } = req.body || {};
    if (!["daily", "weekly", "monthly"].includes(frequency)) {
      return res.status(400).json({ error: "Fréquence invalide." });
    }
    const setting = await prisma.setting.upsert({
      where: { centerId_key: { centerId: req.centerId, key: "backup.config" } },
      update: { value: { frequency } },
      create: { centerId: req.centerId, key: "backup.config", value: { frequency } },
    });
    res.json(setting.value);
  } catch (err) {
    next(err);
  }
});

// 3. Téléchargement / Export physique de l'archive vers disque ou clé USB
router.get("/backups/:filename/download", verifyJwt, requirePermission("backups.read"), async (req, res, next) => {
  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const filePath = path.join(backupDir(req.centerId), safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Fichier d'archive introuvable." });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// 4. Génération d'une archive compressée .zip complète
router.post("/backups/trigger", verifyJwt, requirePermission("backups.generate"), async (req, res, next) => {
  try {
    await ensureStorageTree(req.centerId);
    const dir = backupDir(req.centerId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const zipFilename = `ceco-backup-${timestamp}.zip`;
    const zipPath = path.join(dir, zipFilename);

    const dumpData = {
      metadata: { version: "4.0.0", timestamp: new Date(), centerId: req.centerId },
      centers: await prisma.center.findMany({ where: { id: req.centerId } }),
      subscriptions: await prisma.subscription.findMany({ where: { centerId: req.centerId } }),
      licenses: await prisma.license.findMany({ where: { centerId: req.centerId } }),
      settings: await prisma.setting.findMany({ where: { centerId: req.centerId } }),
      users: await prisma.user.findMany({ where: { centerId: req.centerId } }),
      roles: await prisma.role.findMany({ where: { centerId: req.centerId } }),
      permissions: await prisma.permission.findMany({ where: { role: { centerId: req.centerId } } }),
      programTypes: await prisma.programType.findMany({ where: { centerId: req.centerId } }),
      filieres: await prisma.filiere.findMany({ where: { centerId: req.centerId } }),
      niveaux: await prisma.niveau.findMany({ where: { filiere: { centerId: req.centerId } } }),
      salles: await prisma.salle.findMany({ where: { centerId: req.centerId } }),
      academicYears: await prisma.academicYear.findMany({ where: { centerId: req.centerId } }),
      promotions: await prisma.promotion.findMany({ where: { centerId: req.centerId } }),
      classes: await prisma.classe.findMany({ where: { centerId: req.centerId } }),
      students: await prisma.student.findMany({ where: { centerId: req.centerId } }),
      inscriptions: await prisma.inscription.findMany({ where: { centerId: req.centerId } }),
      formateurs: await prisma.formateur.findMany({ where: { centerId: req.centerId } }),
      subjectCategories: await prisma.subjectCategory.findMany({ where: { centerId: req.centerId } }),
      subjects: await prisma.subject.findMany({ where: { centerId: req.centerId } }),
      filiereSubjects: await prisma.filiereSubject.findMany({ where: { centerId: req.centerId } }),
      subjectOfferings: await prisma.subjectOffering.findMany({ where: { subject: { centerId: req.centerId } } }),
      gradingPolicies: await prisma.gradingPolicy.findMany({ where: { centerId: req.centerId } }),
      gradePeriods: await prisma.gradePeriod.findMany({ where: { centerId: req.centerId } }),
      grades: await prisma.grade.findMany({ where: { centerId: req.centerId } }),
      subjectResults: await prisma.subjectResult.findMany({ where: { centerId: req.centerId } }),
      deliberations: await prisma.deliberation.findMany({ where: { centerId: req.centerId } }),
      studentDeliberations: await prisma.studentDeliberation.findMany({ where: { deliberation: { centerId: req.centerId } } }),
      documentTemplates: await prisma.documentTemplate.findMany({ where: { centerId: req.centerId } }),
      documents: await prisma.document.findMany({ where: { centerId: req.centerId } }),
    };

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`[Backup] Archive V4 générée : ${zipFilename}`);
      res.json({ success: true, file: zipFilename });
    });
    archive.on("error", (err) => { throw err; });
    archive.pipe(output);
    archive.append(JSON.stringify(dumpData, null, 2), { name: "db_dump.json" });

    // Médias
    const mediaRoot = centerStoragePath(req.centerId);
    if (fs.existsSync(mediaRoot)) {
      for (const entry of fs.readdirSync(mediaRoot)) {
        if (entry === "backups" || entry === "temp") continue;
        archive.directory(path.join(mediaRoot, entry), `media/${entry}`);
      }
    }

    await archive.finalize();
  } catch (err) {
    next(err);
  }
});

// 5. Restauration transactionnelle sécurisée
router.post("/backups/restore", verifyJwt, requirePermission("backups.delete"), async (req, res, next) => {
  const { filename } = req.body || {};
  if (!filename) return res.status(400).json({ error: "Nom de fichier requis." });

  const dir = backupDir(req.centerId);
  const zipPath = path.join(dir, filename);
  const tmpDir = path.join(dir, "tmp_restore");

  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ error: "Fichier de sauvegarde introuvable." });
  }

  try {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    await extract(zipPath, { dir: tmpDir });

    const dbDumpPath = path.join(tmpDir, "db_dump.json");
    if (!fs.existsSync(dbDumpPath)) {
      throw new Error("L'archive ne contient pas de db_dump.json valide.");
    }
    const dumpData = JSON.parse(fs.readFileSync(dbDumpPath, "utf-8"));

    const tablesToTruncate = [
      "StudentDeliberation", "Deliberation", "SubjectResult", "Grade", "SubjectOffering",
      "FiliereSubject", "SubjectCategory", "Promotion", "GradePeriod", "GradingPolicy",
      "Inscription", "Student", "Classe", "Salle", "AcademicYear", "Niveau", "Filiere",
      "ProgramType", "Subject", "Formateur", "Document", "DocumentTemplate",
      "Permission", "User", "Role", "Setting", "Subscription", "License", "Center",
    ];

    for (const table of tablesToTruncate) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }

    if (dumpData.centers?.length) await prisma.center.createMany({ data: dumpData.centers });
    if (dumpData.subscriptions?.length) {
      await prisma.subscription.createMany({
        data: dumpData.subscriptions.map((s) => ({
          ...s,
          maxStorage: s.maxStorage ? BigInt(s.maxStorage) : null,
          expiresAt: s.expiresAt ? new Date(s.expiresAt) : null,
        })),
      });
    }
    if (dumpData.licenses?.length) {
      await prisma.license.createMany({
        data: dumpData.licenses.map((l) => ({
          ...l,
          expiresAt: new Date(l.expiresAt),
          createdAt: new Date(l.createdAt),
        })),
      });
    }
    if (dumpData.settings?.length) await prisma.setting.createMany({ data: dumpData.settings });
    if (dumpData.roles?.length) await prisma.role.createMany({ data: dumpData.roles });
    if (dumpData.permissions?.length) await prisma.permission.createMany({ data: dumpData.permissions });
    if (dumpData.users?.length) await prisma.user.createMany({ data: dumpData.users });
    if (dumpData.programTypes?.length) await prisma.programType.createMany({ data: dumpData.programTypes });
    if (dumpData.filieres?.length) await prisma.filiere.createMany({ data: dumpData.filieres });
    if (dumpData.niveaux?.length) await prisma.niveau.createMany({ data: dumpData.niveaux });
    if (dumpData.salles?.length) await prisma.salle.createMany({ data: dumpData.salles });
    if (dumpData.academicYears?.length) {
      await prisma.academicYear.createMany({
        data: dumpData.academicYears.map((y) => ({ ...y, startDate: new Date(y.startDate), endDate: new Date(y.endDate) })),
      });
    }
    if (dumpData.promotions?.length) await prisma.promotion.createMany({ data: dumpData.promotions });
    if (dumpData.classes?.length) await prisma.classe.createMany({ data: dumpData.classes });
    if (dumpData.students?.length) {
      await prisma.student.createMany({
        data: dumpData.students.map((s) => ({ ...s, birthDate: s.birthDate ? new Date(s.birthDate) : null, createdAt: new Date(s.createdAt) })),
      });
    }
    if (dumpData.inscriptions?.length) {
      await prisma.inscription.createMany({ data: dumpData.inscriptions.map((i) => ({ ...i, createdAt: new Date(i.createdAt) })) });
    }
    if (dumpData.formateurs?.length) await prisma.formateur.createMany({ data: dumpData.formateurs });
    if (dumpData.subjectCategories?.length) await prisma.subjectCategory.createMany({ data: dumpData.subjectCategories });
    if (dumpData.subjects?.length) await prisma.subject.createMany({ data: dumpData.subjects });
    if (dumpData.filiereSubjects?.length) await prisma.filiereSubject.createMany({ data: dumpData.filiereSubjects });
    if (dumpData.gradingPolicies?.length) {
      await prisma.gradingPolicy.createMany({
        data: dumpData.gradingPolicies.map((g) => ({ ...g, effectiveFrom: new Date(g.effectiveFrom), effectiveTo: g.effectiveTo ? new Date(g.effectiveTo) : null })),
      });
    }
    if (dumpData.gradePeriods?.length) {
      await prisma.gradePeriod.createMany({
        data: dumpData.gradePeriods.map((g) => ({ ...g, startDate: new Date(g.startDate), endDate: new Date(g.endDate) })),
      });
    }
    if (dumpData.subjectOfferings?.length) await prisma.subjectOffering.createMany({ data: dumpData.subjectOfferings });
    if (dumpData.grades?.length) {
      await prisma.grade.createMany({ data: dumpData.grades.map((g) => ({ ...g, createdAt: new Date(g.createdAt) })) });
    }
    if (dumpData.subjectResults?.length) {
      await prisma.subjectResult.createMany({ data: dumpData.subjectResults.map((r) => ({ ...r, computedAt: new Date(r.computedAt) })) });
    }
    if (dumpData.deliberations?.length) {
      await prisma.deliberation.createMany({ data: dumpData.deliberations.map((d) => ({ ...d, juryDate: new Date(d.juryDate) })) });
    }
    if (dumpData.studentDeliberations?.length) await prisma.studentDeliberation.createMany({ data: dumpData.studentDeliberations });
    if (dumpData.documentTemplates?.length) await prisma.documentTemplate.createMany({ data: dumpData.documentTemplates });
    if (dumpData.documents?.length) {
      await prisma.document.createMany({ data: dumpData.documents.map((d) => ({ ...d, generatedAt: new Date(d.generatedAt) })) });
    }

    const extractedMediaDir = path.join(tmpDir, "media");
    if (fs.existsSync(extractedMediaDir)) {
      const mediaRoot = centerStoragePath(req.centerId);
      for (const entry of fs.readdirSync(extractedMediaDir)) {
        const target = path.join(mediaRoot, entry);
        if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
        copyFolderRecursiveSync(path.join(extractedMediaDir, entry), target);
      }
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`[Restauration V4] Effectuée avec succès depuis : ${filename}`);
    res.json({ success: true, message: "Base relationnelle, licences et médias restaurés avec succès." });
  } catch (err) {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    next(err);
  }
});

module.exports = router;