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
const { resetTenantCache } = require("../middleware/tenantResolver");

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

// 1. Liste des sauvegardes
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

// 2. Téléchargement d'archive
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

// 3. Déclenchement manuel d'une sauvegarde complète
router.post("/backups/trigger", verifyJwt, requirePermission("backups.generate"), async (req, res, next) => {
  try {
    await ensureStorageTree(req.centerId);
    const dir = backupDir(req.centerId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const zipFilename = `ceco-backup-${timestamp}.zip`;
    const zipPath = path.join(dir, zipFilename);

    const dumpData = {
      metadata: { version: "4.2.0", timestamp: new Date(), centerId: req.centerId },
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
      mockSubjects: await prisma.mockSubject.findMany({ where: { centerId: req.centerId } }),
      filiereMockSubjects: await prisma.filiereMockSubject.findMany({ where: { centerId: req.centerId } }),
      mockExamSessions: await prisma.mockExamSession.findMany({ where: { centerId: req.centerId } }),
      classeMockExams: await prisma.classeMockExam.findMany({ where: { centerId: req.centerId } }),
      classeMockExamSubjects: await prisma.classeMockExamSubject.findMany({ where: { classeMockExam: { centerId: req.centerId } } }),
      mockExamGrades: await prisma.mockExamGrade.findMany({ where: { classeMockExam: { centerId: req.centerId } } }),
      mockExamSummaries: await prisma.mockExamSummary.findMany({ where: { classeMockExam: { centerId: req.centerId } } }),
    };

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`[Backup] Archive complète générée : ${zipFilename}`);
      res.json({ success: true, file: zipFilename });
    });
    archive.on("error", (err) => { throw err; });
    archive.pipe(output);
    archive.append(JSON.stringify(dumpData, null, 2), { name: "db_dump.json" });

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

// 4. Importation d'archive (.zip)
router.post("/backups/upload", verifyJwt, requirePermission("backups.generate"), async (req, res, next) => {
  const { filename, fileDataBase64 } = req.body || {};
  if (!fileDataBase64) {
    return res.status(400).json({ error: "Fichier d'archive manquant." });
  }

  await ensureStorageTree(req.centerId);
  const dir = backupDir(req.centerId);
  const cleanBaseName = filename ? path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_") : `import_${Date.now()}.zip`;
  const finalFilename = cleanBaseName.endsWith(".zip") ? cleanBaseName : `${cleanBaseName}.zip`;

  let destinationPath = path.join(dir, finalFilename);
  if (fs.existsSync(destinationPath)) {
    const uniquePrefix = `imported_${new Date().toISOString().replace(/[:.]/g, "-")}_`;
    destinationPath = path.join(dir, `${uniquePrefix}${finalFilename}`);
  }

  const tmpValidateDir = path.join(dir, `tmp_val_${Date.now()}`);

  try {
    const match = /^data:application\/[a-zA-Z0-9+.-]+;base64,(.+)$/.exec(fileDataBase64);
    const rawBase64 = match ? match[1] : fileDataBase64;
    const buffer = Buffer.from(rawBase64, "base64");

    if (buffer.length === 0) {
      return res.status(400).json({ error: "L'archive transmise est vide." });
    }

    const tempZipPath = path.join(dir, `temp_check_${Date.now()}.zip`);
    fs.writeFileSync(tempZipPath, buffer);

    fs.mkdirSync(tmpValidateDir, { recursive: true });
    await extract(tempZipPath, { dir: tmpValidateDir });

    const dbDumpPath = path.join(tmpValidateDir, "db_dump.json");
    if (!fs.existsSync(dbDumpPath)) {
      fs.unlinkSync(tempZipPath);
      fs.rmSync(tmpValidateDir, { recursive: true, force: true });
      return res.status(400).json({
        error: "Archive invalide : le fichier db_dump.json structuré par CECO Suite ERP est introuvable.",
      });
    }

    fs.renameSync(tempZipPath, destinationPath);
    fs.rmSync(tmpValidateDir, { recursive: true, force: true });

    const stats = fs.statSync(destinationPath);
    res.json({
      success: true,
      message: `Archive "${path.basename(destinationPath)}" importée avec succès.`,
      backup: {
        name: path.basename(destinationPath),
        sizeBytes: stats.size,
        createdAt: stats.mtime,
      },
    });
  } catch (err) {
    if (fs.existsSync(tmpValidateDir)) fs.rmSync(tmpValidateDir, { recursive: true, force: true });
    next(err);
  }
});

// 5. Suppression d'archive
router.delete("/backups/:filename", verifyJwt, requirePermission("backups.delete"), async (req, res, next) => {
  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const filePath = path.join(backupDir(req.centerId), safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Fichier de sauvegarde introuvable." });
    }

    fs.unlinkSync(filePath);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * 6. RESTAURATION DU PRA SOUVERAIN AVEC TRANSPLANTATION D'IDENTITÉ RELATIONNELLE
 * Permet de restaurer une sauvegarde d'un ancien centre sur une machine neuve
 * sans invalider la licence Ed25519 de la nouvelle machine ni briser les clés étrangères.
 */
router.post("/backups/restore", verifyJwt, requirePermission("backups.delete"), async (req, res, next) => {
  const { filename } = req.body || {};
  if (!filename) return res.status(400).json({ error: "Nom de fichier requis." });

  const currentHostCenterId = req.centerId;
  const dir = backupDir(currentHostCenterId);
  const zipPath = path.join(dir, filename);
  const tmpDir = path.join(dir, `tmp_restore_${Date.now()}`);

  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ error: "Fichier de sauvegarde introuvable." });
  }

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    await extract(zipPath, { dir: tmpDir });

    const dbDumpPath = path.join(tmpDir, "db_dump.json");
    if (!fs.existsSync(dbDumpPath)) {
      throw new Error("L'archive ne contient pas de fichier db_dump.json valide.");
    }

    const dumpData = JSON.parse(fs.readFileSync(dbDumpPath, "utf-8"));
    const oldCenterId = dumpData.metadata?.centerId || dumpData.centers?.[0]?.id;

    // Récupération de la licence et souscription de la machine hôte actuelle
    const [hostLicense, hostSubscription, hostCenter] = await Promise.all([
      prisma.license.findUnique({ where: { centerId: currentHostCenterId } }),
      prisma.subscription.findUnique({ where: { centerId: currentHostCenterId } }),
      prisma.center.findUnique({ where: { id: currentHostCenterId } }),
    ]);

    // Mappage relationnel si l'identifiant du centre a changé (nouvelle installation / machine de secours)
    const remapCenterId = (list = []) => {
      if (!Array.isArray(list)) return [];
      if (!oldCenterId || oldCenterId === currentHostCenterId) return list;
      return list.map((item) => {
        const cloned = { ...item };
        if (cloned.centerId === oldCenterId) {
          cloned.centerId = currentHostCenterId;
        }
        return cloned;
      });
    };

    const tablesToTruncate = [
      "MockExamGrade", "MockExamSummary", "ClasseMockExamSubject", "ClasseMockExam",
      "MockExamSession", "FiliereMockSubject", "MockSubject",
      "StudentDeliberation", "Deliberation", "SubjectResult", "Grade", "SubjectOffering",
      "FiliereSubject", "SubjectCategory", "Promotion", "GradePeriod", "GradingPolicy",
      "Inscription", "Student", "Classe", "Salle", "AcademicYear", "Niveau", "Filiere",
      "ProgramType", "Subject", "Formateur", "Document", "DocumentTemplate",
      "Permission", "User", "Role", "Setting", "Subscription", "License", "Center",
    ];

    for (const table of tablesToTruncate) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }

    // Réinjection du centre avec préservation de l'ID hôte pour maintenir la licence
    const backupCenterMeta = dumpData.centers?.[0] || {};
    await prisma.center.create({
      data: {
        id: currentHostCenterId,
        name: backupCenterMeta.name || hostCenter?.name || "Centre CECO",
        slug: hostCenter?.slug || backupCenterMeta.slug || "local",
        logo: backupCenterMeta.logo || null,
        email: backupCenterMeta.email || null,
        phone: backupCenterMeta.phone || null,
        address: backupCenterMeta.address || null,
        city: backupCenterMeta.city || "Bafoussam",
        postalCode: backupCenterMeta.postalCode || null,
        country: backupCenterMeta.country || "Cameroun",
        website: backupCenterMeta.website || null,
        registrationNumber: backupCenterMeta.registrationNumber || null,
        directorName: backupCenterMeta.directorName || null,
        directorTitle: backupCenterMeta.directorTitle || "Le Directeur Général",
        description: backupCenterMeta.description || null,
        subscriptionPlan: hostSubscription?.plan || backupCenterMeta.subscriptionPlan || "local",
      },
    });

    // Maintien de la licence valide de la machine hôte
    if (hostLicense) {
      await prisma.license.create({
        data: {
          centerId: currentHostCenterId,
          signedPayload: hostLicense.signedPayload,
          publicKeyId: hostLicense.publicKeyId,
          expiresAt: hostLicense.expiresAt,
        },
      });
    }

    if (hostSubscription) {
      await prisma.subscription.create({
        data: {
          centerId: currentHostCenterId,
          plan: hostSubscription.plan,
          status: hostSubscription.status,
          expiresAt: hostSubscription.expiresAt,
          maxUsers: hostSubscription.maxUsers,
          maxStorage: hostSubscription.maxStorage,
        },
      });
    }

    // Réinjection de toutes les données pédagogiques avec le centerId cible
    const settingsData = remapCenterId(dumpData.settings);
    if (settingsData.length) await prisma.setting.createMany({ data: settingsData });

    const rolesData = remapCenterId(dumpData.roles);
    if (rolesData.length) await prisma.role.createMany({ data: rolesData });

    if (dumpData.permissions?.length) await prisma.permission.createMany({ data: dumpData.permissions });

    const usersData = remapCenterId(dumpData.users);
    if (usersData.length) await prisma.user.createMany({ data: usersData });

    const programTypesData = remapCenterId(dumpData.programTypes);
    if (programTypesData.length) await prisma.programType.createMany({ data: programTypesData });

    const filieresData = remapCenterId(dumpData.filieres);
    if (filieresData.length) await prisma.filiere.createMany({ data: filieresData });

    if (dumpData.niveaux?.length) await prisma.niveau.createMany({ data: dumpData.niveaux });

    const sallesData = remapCenterId(dumpData.salles);
    if (sallesData.length) await prisma.salle.createMany({ data: sallesData });

    const yearsData = remapCenterId(dumpData.academicYears);
    if (yearsData.length) {
      await prisma.academicYear.createMany({
        data: yearsData.map((y) => ({
          ...y,
          startDate: new Date(y.startDate),
          endDate: new Date(y.endDate),
        })),
      });
    }

    const promotionsData = remapCenterId(dumpData.promotions);
    if (promotionsData.length) await prisma.promotion.createMany({ data: promotionsData });

    const classesData = remapCenterId(dumpData.classes);
    if (classesData.length) await prisma.classe.createMany({ data: classesData });

    const studentsData = remapCenterId(dumpData.students);
    if (studentsData.length) {
      await prisma.student.createMany({
        data: studentsData.map((s) => ({
          ...s,
          birthDate: s.birthDate ? new Date(s.birthDate) : null,
          createdAt: new Date(s.createdAt),
        })),
      });
    }

    const inscriptionsData = remapCenterId(dumpData.inscriptions);
    if (inscriptionsData.length) {
      await prisma.inscription.createMany({
        data: inscriptionsData.map((i) => ({ ...i, createdAt: new Date(i.createdAt) })),
      });
    }

    const formateursData = remapCenterId(dumpData.formateurs);
    if (formateursData.length) await prisma.formateur.createMany({ data: formateursData });

    const categoriesData = remapCenterId(dumpData.subjectCategories);
    if (categoriesData.length) await prisma.subjectCategory.createMany({ data: categoriesData });

    const subjectsData = remapCenterId(dumpData.subjects);
    if (subjectsData.length) await prisma.subject.createMany({ data: subjectsData });

    const filiereSubjectsData = remapCenterId(dumpData.filiereSubjects);
    if (filiereSubjectsData.length) await prisma.filiereSubject.createMany({ data: filiereSubjectsData });

    const gradingPoliciesData = remapCenterId(dumpData.gradingPolicies);
    if (gradingPoliciesData.length) {
      await prisma.gradingPolicy.createMany({
        data: gradingPoliciesData.map((g) => ({
          ...g,
          effectiveFrom: new Date(g.effectiveFrom),
          effectiveTo: g.effectiveTo ? new Date(g.effectiveTo) : null,
        })),
      });
    }

    const gradePeriodsData = remapCenterId(dumpData.gradePeriods);
    if (gradePeriodsData.length) {
      await prisma.gradePeriod.createMany({
        data: gradePeriodsData.map((g) => ({
          ...g,
          startDate: new Date(g.startDate),
          endDate: new Date(g.endDate),
        })),
      });
    }

    if (dumpData.subjectOfferings?.length) await prisma.subjectOffering.createMany({ data: dumpData.subjectOfferings });

    const gradesData = remapCenterId(dumpData.grades);
    if (gradesData.length) {
      await prisma.grade.createMany({
        data: gradesData.map((g) => ({ ...g, createdAt: new Date(g.createdAt) })),
      });
    }

    const subjectResultsData = remapCenterId(dumpData.subjectResults);
    if (subjectResultsData.length) {
      await prisma.subjectResult.createMany({
        data: subjectResultsData.map((r) => ({ ...r, computedAt: new Date(r.computedAt) })),
      });
    }

    const deliberationsData = remapCenterId(dumpData.deliberations);
    if (deliberationsData.length) {
      await prisma.deliberation.createMany({
        data: deliberationsData.map((d) => ({ ...d, juryDate: new Date(d.juryDate) })),
      });
    }

    if (dumpData.studentDeliberations?.length) await prisma.studentDeliberation.createMany({ data: dumpData.studentDeliberations });

    const templatesData = remapCenterId(dumpData.documentTemplates);
    if (templatesData.length) await prisma.documentTemplate.createMany({ data: templatesData });

    const documentsData = remapCenterId(dumpData.documents);
    if (documentsData.length) {
      await prisma.document.createMany({
        data: documentsData.map((d) => ({ ...d, generatedAt: new Date(d.generatedAt) })),
      });
    }

    // Réinjection des tables Miroir Examens Blancs
    const mockSubjectsData = remapCenterId(dumpData.mockSubjects);
    if (mockSubjectsData.length) await prisma.mockSubject.createMany({ data: mockSubjectsData });

    const filiereMockSubjectsData = remapCenterId(dumpData.filiereMockSubjects);
    if (filiereMockSubjectsData.length) await prisma.filiereMockSubject.createMany({ data: filiereMockSubjectsData });

    const mockSessionsData = remapCenterId(dumpData.mockExamSessions);
    if (mockSessionsData.length) {
      await prisma.mockExamSession.createMany({
        data: mockSessionsData.map((ms) => ({
          ...ms,
          startDate: new Date(ms.startDate),
          endDate: new Date(ms.endDate),
        })),
      });
    }

    const classeMockExamsData = remapCenterId(dumpData.classeMockExams);
    if (classeMockExamsData.length) await prisma.classeMockExam.createMany({ data: classeMockExamsData });

    if (dumpData.classeMockExamSubjects?.length) await prisma.classeMockExamSubject.createMany({ data: dumpData.classeMockExamSubjects });
    if (dumpData.mockExamGrades?.length) await prisma.mockExamGrade.createMany({ data: dumpData.mockExamGrades });
    if (dumpData.mockExamSummaries?.length) await prisma.mockExamSummary.createMany({ data: dumpData.mockExamSummaries });

    // Restauration des fichiers physiques dans le dossier de la machine hôte
    const extractedMediaDir = path.join(tmpDir, "media");
    if (fs.existsSync(extractedMediaDir)) {
      const mediaRoot = centerStoragePath(currentHostCenterId);
      for (const entry of fs.readdirSync(extractedMediaDir)) {
        const target = path.join(mediaRoot, entry);
        if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
        copyFolderRecursiveSync(path.join(extractedMediaDir, entry), target);
      }
    }

    // Réinitialisation immédiate du cache du tenant
    resetTenantCache();

    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`[Restauration PRA] Succès depuis "${filename}" vers le centre "${currentHostCenterId}".`);

    res.json({
      success: true,
      message: "Base relationnelle et médias restaurés avec succès. La licence de la machine hôte a été conservée.",
    });
  } catch (err) {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    next(err);
  }
});

module.exports = router;