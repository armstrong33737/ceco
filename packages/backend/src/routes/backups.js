const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const extract = require("extract-zip");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");

const router = express.Router();

// Configuration des répertoires physiques du serveur
const BACKUP_DIR = path.join(__dirname, "../../../../backups");
const UPLOADS_DIR = path.join(__dirname, "../../../../uploads");

// S'assure que les dossiers requis existent
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Fonction utilitaire récursive pour copier des répertoires (sans dépendance externe)
function copyFolderRecursiveSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
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

// 1. Lister toutes les sauvegardes physiques réelles (.zip)
router.get("/backups", verifyJwt, async (req, res, next) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    
    const backupFiles = files
      .filter(file => file.endsWith(".zip"))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          sizeBytes: stats.size,
          createdAt: stats.mtime
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json(backupFiles);
  } catch (err) {
    next(err);
  }
});

// 2. Récupérer la configuration de fréquence de sauvegarde
router.get("/backups/config", verifyJwt, async (req, res, next) => {
  try {
    const setting = await prisma.setting.findUnique({
      where: {
        centerId_key: {
          centerId: req.centerId,
          key: "backup.config"
        }
      }
    });

    if (!setting) {
      return res.json({ frequency: "daily" });
    }

    res.json(setting.value);
  } catch (err) {
    next(err);
  }
});

// 3. Mettre à jour la configuration de fréquence de sauvegarde
router.put("/backups/config", verifyJwt, async (req, res, next) => {
  try {
    const { frequency } = req.body || {};
    if (!["daily", "weekly", "monthly"].includes(frequency)) {
      return res.status(400).json({ error: "Fréquence invalide." });
    }

    const setting = await prisma.setting.upsert({
      where: {
        centerId_key: {
          centerId: req.centerId,
          key: "backup.config"
        }
      },
      update: {
        value: { frequency }
      },
      create: {
        centerId: req.centerId,
        key: "backup.config",
        value: { frequency }
      }
    });

    res.json(setting.value);
  } catch (err) {
    next(err);
  }
});

// 4. Déclencher manuellement une sauvegarde compressée .zip (Données + Médias)
router.post("/backups/trigger", verifyJwt, async (req, res, next) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const zipFilename = `ceco-backup-${timestamp}.zip`;
    const zipPath = path.join(BACKUP_DIR, zipFilename);

    // Extraction de la structure complète de la base de données
    const dumpData = {
      metadata: {
        version: "1.0.0",
        timestamp: new Date(),
        centerId: req.centerId
      },
      centers: await prisma.center.findMany(),
      subscriptions: await prisma.subscription.findMany(),
      settings: await prisma.setting.findMany(),
      users: await prisma.user.findMany(),
      roles: await prisma.role.findMany(),
      permissions: await prisma.permission.findMany(),
      programTypes: await prisma.programType.findMany(),
      filieres: await prisma.filiere.findMany(),
      niveaux: await prisma.niveau.findMany(),
      academicYears: await prisma.academicYear.findMany(),
      classes: await prisma.classe.findMany(),
      students: await prisma.student.findMany(),
      inscriptions: await prisma.inscription.findMany(),
      subjects: await prisma.subject.findMany(),
      subjectOfferings: await prisma.subjectOffering.findMany(),
      grades: await prisma.grade.findMany(),
      subjectResults: await prisma.subjectResult.findMany(),
      deliberations: await prisma.deliberation.findMany(),
      studentDeliberations: await prisma.studentDeliberation.findMany(),
    };

    // Création du flux d'écriture compressé .zip
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`[Backup] Archive compressée générée avec succès : ${zipFilename}`);
      res.json({ success: true, file: zipFilename });
    });

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(output);

    // Injection de la structure de données JSON dans l'archive
    archive.append(JSON.stringify(dumpData, null, 2), { name: "db_dump.json" });

    // Injection récursive des fichiers médias réels (photos de profils, logos) dans l'archive
    if (fs.existsSync(UPLOADS_DIR) && fs.readdirSync(UPLOADS_DIR).length > 0) {
      archive.directory(UPLOADS_DIR, "uploads");
    }

    await archive.finalize();

  } catch (err) {
    next(err);
  }
});

// 5. Restaurer le système complet (.zip -> Base de données PostgreSQL + Médias)
router.post("/backups/restore", verifyJwt, async (req, res, next) => {
  const { filename } = req.body || {};
  if (!filename) {
    return res.status(400).json({ error: "Nom de fichier requis." });
  }

  const zipPath = path.join(BACKUP_DIR, filename);
  const tmpDir = path.join(BACKUP_DIR, "tmp_restore");

  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ error: "Fichier de sauvegarde introuvable." });
  }

  try {
    // Étape 1 : Nettoyage et création du dossier temporaire d'extraction
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });

    // Étape 2 : Extraction asynchrone de l'archive .zip
    await extract(zipPath, { dir: tmpDir });

    const dbDumpPath = path.join(tmpDir, "db_dump.json");
    if (!fs.existsSync(dbDumpPath)) {
      throw new Error("L'archive ne contient pas de fichier db_dump.json de base de données valide.");
    }

    // Lecture des données sérialisées
    const dumpData = JSON.parse(fs.readFileSync(dbDumpPath, "utf-8"));

    // Étape 3 : Nettoyage radical de PostgreSQL (TRUNCATE CASCADE)
    // L'ordre et l'usage de CASCADE désactivent temporairement et contournent les contraintes de clés étrangères
    const tablesToTruncate = [
      "StudentDeliberation", "Deliberation", "SubjectResult", "Grade", "SubjectOffering",
      "GradePeriod", "GradingPolicy", "Inscription", "Student", "Classe",
      "Salle", "AcademicYear", "Niveau", "Filiere", "ProgramType",
      "Permission", "User", "Role", "Setting", "Subscription", "Center"
    ];

    for (const table of tablesToTruncate) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }

    // Étape 4 : Ré-injection séquentielle ordonnée des données dans PostgreSQL
    if (dumpData.centers?.length) await prisma.center.createMany({ data: dumpData.centers });
    
    if (dumpData.subscriptions?.length) {
      const parsedSubscriptions = dumpData.subscriptions.map(s => ({
        ...s,
        maxStorage: s.maxStorage ? BigInt(s.maxStorage) : null,
        expiresAt: s.expiresAt ? new Date(s.expiresAt) : null
      }));
      await prisma.subscription.createMany({ data: parsedSubscriptions });
    }

    if (dumpData.settings?.length) await prisma.setting.createMany({ data: dumpData.settings });
    if (dumpData.roles?.length) await prisma.role.createMany({ data: dumpData.roles });
    if (dumpData.permissions?.length) await prisma.permission.createMany({ data: dumpData.permissions });
    if (dumpData.users?.length) await prisma.user.createMany({ data: dumpData.users });
    if (dumpData.programTypes?.length) await prisma.programType.createMany({ data: dumpData.programTypes });
    if (dumpData.filieres?.length) await prisma.filiere.createMany({ data: dumpData.filieres });
    if (dumpData.niveaux?.length) await prisma.niveau.createMany({ data: dumpData.niveaux });
    
    if (dumpData.academicYears?.length) {
      const years = dumpData.academicYears.map(y => ({
        ...y,
        startDate: new Date(y.startDate),
        endDate: new Date(y.endDate)
      }));
      await prisma.academicYear.createMany({ data: years });
    }

    if (dumpData.salles?.length) await prisma.salle.createMany({ data: dumpData.salles });
    if (dumpData.classes?.length) await prisma.classe.createMany({ data: dumpData.classes });
    
    if (dumpData.students?.length) {
      const students = dumpData.students.map(s => ({
        ...s,
        birthDate: s.birthDate ? new Date(s.birthDate) : null,
        createdAt: new Date(s.createdAt)
      }));
      await prisma.student.createMany({ data: students });
    }

    if (dumpData.inscriptions?.length) {
      const inscriptions = dumpData.inscriptions.map(i => ({
        ...i,
        createdAt: new Date(i.createdAt)
      }));
      await prisma.inscription.createMany({ data: inscriptions });
    }

    if (dumpData.subjects?.length) await prisma.subject.createMany({ data: dumpData.subjects });
    if (dumpData.subjectOfferings?.length) await prisma.subjectOffering.createMany({ data: dumpData.subjectOfferings });
    
    if (dumpData.grades?.length) {
      const grades = dumpData.grades.map(g => ({
        ...g,
        createdAt: new Date(g.createdAt)
      }));
      await prisma.grade.createMany({ data: grades });
    }

    if (dumpData.subjectResults?.length) {
      const results = dumpData.subjectResults.map(r => ({
        ...r,
        computedAt: new Date(r.computedAt)
      }));
      await prisma.subjectResult.createMany({ data: results });
    }

    if (dumpData.deliberations?.length) {
      const deliberations = dumpData.deliberations.map(d => ({
        ...d,
        juryDate: new Date(d.juryDate)
      }));
      await prisma.deliberation.createMany({ data: deliberations });
    }

    if (dumpData.studentDeliberations?.length) {
      await prisma.studentDeliberation.createMany({ data: dumpData.studentDeliberations });
    }

    // Étape 5 : Restauration physique du répertoire de stockage des médias (/uploads)
    const extractedUploadsDir = path.join(tmpDir, "uploads");
    if (fs.existsSync(extractedUploadsDir)) {
      // Nettoyage de l'ancien dossier
      if (fs.existsSync(UPLOADS_DIR)) {
        fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
      }
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      copyFolderRecursiveSync(extractedUploadsDir, UPLOADS_DIR);
    }

    // Étape 6 : Nettoyage du dossier temporaire
    fs.rmSync(tmpDir, { recursive: true, force: true });

    console.log(`[Restauration] Restauration du système effectuée avec succès depuis : ${filename}`);
    res.json({ success: true, message: "Système et fichiers restaurés avec succès." });

  } catch (err) {
    // En cas d'erreur de traitement, on nettoie le dossier de transition
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    next(err);
  }
});

module.exports = router;