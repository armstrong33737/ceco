// packages/backend/src/routes/students.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { centerStoragePath, ensureStorageTree } = require("../storage/paths");

const router = express.Router();

const MIME_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};
const EXT_TO_MIME = Object.fromEntries(Object.entries(MIME_TO_EXT).map(([m, e]) => [e, m]));

function studentPhotosDir(centerId) {
  return centerStoragePath(centerId, "students/photos");
}

function removeExistingPhoto(centerId, studentId) {
  const dir = studentPhotosDir(centerId);
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith(`${studentId}.`)) {
      try { fs.unlinkSync(path.join(dir, file)); } catch {}
    }
  }
}

function saveStudentPhoto(centerId, studentId, dataUrl) {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Format d'image invalide.");
  const [, mime, base64Payload] = match;
  const ext = MIME_TO_EXT[mime];
  if (!ext) throw new Error("Format non supporté (PNG, JPG, WEBP).");

  const buffer = Buffer.from(base64Payload, "base64");
  if (buffer.length > 3 * 1024 * 1024) throw new Error("Photo trop volumineuse (3 Mo max).");

  const dir = studentPhotosDir(centerId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  removeExistingPhoto(centerId, studentId);
  const fileName = `${studentId}.${ext}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return fileName;
}

/**
 * Normalisation de la date de naissance en UTC midi pour éliminer tout glissement de journée
 */
function parseBirthDateSafe(birthDateStr) {
  if (!birthDateStr) return null;
  const cleanStr = String(birthDateStr).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    return new Date(`${cleanStr}T12:00:00.000Z`);
  }
  const d = new Date(birthDateStr);
  return isNaN(d.getTime()) ? null : d;
}

function deriveFiliereCode(filiereName) {
  if (!filiereName) return "GEN";
  const clean = filiereName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.substring(0, 3).toUpperCase();
}

async function generateDynamicMatricule(centerId, targetClass, targetYear, offset = 0) {
  const [center, matriculeSetting] = await Promise.all([
    prisma.center.findUnique({ where: { id: centerId }, select: { slug: true, name: true } }),
    prisma.setting.findUnique({ where: { centerId_key: { centerId, key: "center.matricule_format" } } }),
  ]);

  const pattern = matriculeSetting?.value?.format || "{CTR}-{FIL}{YY}-{NUM4}";

  let centerPrefix = "CECO";
  if (center?.slug && center.slug !== "local") {
    centerPrefix = center.slug.substring(0, 7).toUpperCase();
  } else if (center?.name) {
    const letters = center.name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 7).toUpperCase();
    if (letters.length >= 2) centerPrefix = letters;
  }

  const filiereCode = deriveFiliereCode(targetClass?.filiere?.name);
  const cycleCode = (targetClass?.filiere?.programType?.code || "DQP").toUpperCase();
  const yearLabel = targetYear?.label || new Date().getFullYear().toString();
  const yearSuffix = yearLabel.substring(2, 4);
  const fullYear = yearLabel.split("-")[0] || "2026";

  const countTotalStudents = await prisma.student.count({ where: { centerId } });
  let seq = countTotalStudents + 1 + offset;

  const replaceTokens = (num) => {
    return pattern
      .replace(/\{CTR\}|\{CENTER\}/g, centerPrefix)
      .replace(/\{FIL\}|\{FILIERE\}/g, filiereCode)
      .replace(/\{CYCLE\}/g, cycleCode)
      .replace(/\{YY\}|\{YEAR\}/g, yearSuffix)
      .replace(/\{YYYY\}/g, fullYear)
      .replace(/\{NUM5\}/g, String(num).padStart(5, "0"))
      .replace(/\{NUM4\}|\{NUM\}/g, String(num).padStart(4, "0"));
  };

  let finalMatricule = replaceTokens(seq);

  let exists = await prisma.student.findFirst({ where: { centerId, matricule: finalMatricule } });
  while (exists) {
    seq++;
    finalMatricule = replaceTokens(seq);
    exists = await prisma.student.findFirst({ where: { centerId, matricule: finalMatricule } });
  }

  return finalMatricule;
}

function buildStudentWhereClause(centerId, query) {
  const {
    search, classeId, academicYearId, promotionId, status, filiereId, onlyArchived,
  } = query || {};

  const isArchivedQuery = onlyArchived === "true";

  const inscriptionWhere = {};
  if (classeId) inscriptionWhere.classeId = classeId;
  if (promotionId) inscriptionWhere.promotionId = promotionId;
  if (academicYearId) inscriptionWhere.academicYearId = academicYearId;
  if (status) inscriptionWhere.status = status;
  if (filiereId && !classeId) {
    inscriptionWhere.classe = { filiereId };
  }

  return {
    centerId,
    deletedAt: isArchivedQuery ? { not: null } : null,
    ...(search && search.trim() && {
      OR: [
        { firstName: { contains: search.trim(), mode: "insensitive" } },
        { lastName: { contains: search.trim(), mode: "insensitive" } },
        { matricule: { contains: search.trim(), mode: "insensitive" } },
        { phone: { contains: search.trim(), mode: "insensitive" } },
        { guardianName: { contains: search.trim(), mode: "insensitive" } },
      ],
    }),
    ...(Object.keys(inscriptionWhere).length > 0 && {
      inscriptions: { some: inscriptionWhere },
    }),
  };
}

// 1. Lister les apprenants
router.get("/students", verifyJwt, requirePermission("students.read"), async (req, res, next) => {
  try {
    const { page = 1, limit = 25, all = "false" } = req.query || {};
    const where = buildStudentWhereClause(req.centerId, req.query);
    const isArchived = req.query.onlyArchived === "true";

    const includeQuery = {
      inscriptions: {
        include: {
          classe: {
            include: {
              filiere: { include: { programType: true } },
              niveau: true,
              salle: true,
            },
          },
          promotion: true,
          academicYear: true,
        },
        orderBy: { createdAt: "desc" },
      },
    };

    if (all === "true") {
      const students = await prisma.student.findMany({
        where,
        include: includeQuery,
        orderBy: isArchived ? { deletedAt: "desc" } : { lastName: "asc" },
      });
      return res.json({ data: students, pagination: { total: students.length, page: 1, limit: students.length, totalPages: 1 } });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(5, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: includeQuery,
        skip,
        take: limitNum,
        orderBy: isArchived ? { deletedAt: "desc" } : { lastName: "asc" },
      }),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.json({
      data: students,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 2. Fiche apprenant
router.get("/students/:id", verifyJwt, requirePermission("students.read"), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        centerId: req.centerId,
        deletedAt: null,
        OR: [{ id: req.params.id }, { matricule: req.params.id }],
      },
      include: {
        inscriptions: {
          include: {
            classe: {
              include: {
                filiere: { include: { programType: true } },
                niveau: true,
                salle: true,
              },
            },
            promotion: true,
            academicYear: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!student) return res.status(404).json({ error: "Apprenant introuvable." });
    res.json(student);
  } catch (err) {
    next(err);
  }
});

// 3. Création transactionnelle
router.post("/students", verifyJwt, requirePermission("students.create"), async (req, res, next) => {
  try {
    const {
      firstName, lastName, gender, birthDate, birthPlace, phone,
      guardianName, guardianPhone, entryDiploma,
      classeId, academicYearId, photoDataUrl,
    } = req.body || {};

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "Le nom et le prénom de l'apprenant sont obligatoires." });
    }

    await ensureStorageTree(req.centerId);

    let targetClass = null;
    if (classeId) {
      targetClass = await prisma.classe.findFirst({
        where: { id: classeId, centerId: req.centerId },
        include: { niveau: true, filiere: { include: { programType: true } }, academicYear: true },
      });
    }

    if (!targetClass) {
      targetClass = await prisma.classe.findFirst({
        where: {
          centerId: req.centerId,
          ...(academicYearId ? { academicYearId } : { academicYear: { isCurrent: true } }),
        },
        include: { niveau: true, filiere: { include: { programType: true } }, academicYear: true },
        orderBy: { label: "asc" },
      });
    }

    if (!targetClass) {
      return res.status(400).json({
        error: "Aucune classe disponible. Veuillez d'abord créer une classe dans le module Formations.",
      });
    }

    const targetYear = targetClass.academicYear;
    const finalYearId = targetYear?.id || academicYearId;

    let promotion = await prisma.promotion.findFirst({
      where: { centerId: req.centerId, filiereId: targetClass.filiereId, academicYearId: finalYearId },
    });

    if (!promotion) {
      const yearLabel = targetYear?.label || "2026-2027";
      const startYear = parseInt(yearLabel.split("-")[0], 10) || 2026;
      const duration = targetClass.filiere?.durationInYears || 2;
      promotion = await prisma.promotion.create({
        data: {
          centerId: req.centerId,
          filiereId: targetClass.filiereId,
          academicYearId: finalYearId,
          label: `Promotion ${startYear}-${startYear + duration}`,
          expectedEndYear: String(startYear + duration),
        },
      });
    }

    const autoMatricule = await generateDynamicMatricule(req.centerId, targetClass, targetYear);

    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          centerId: req.centerId,
          matricule: autoMatricule,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender: gender || "M",
          birthDate: parseBirthDateSafe(birthDate),
          birthPlace: birthPlace ? birthPlace.trim() : null,
          phone: phone ? phone.trim() : null,
          guardianName: guardianName ? guardianName.trim() : null,
          guardianPhone: guardianPhone ? guardianPhone.trim() : null,
          entryDiploma: entryDiploma ? entryDiploma.trim() : "BEPC",
        },
      });

      if (photoDataUrl && typeof photoDataUrl === "string" && photoDataUrl.startsWith("data:image/")) {
        const photoFileName = saveStudentPhoto(req.centerId, student.id, photoDataUrl);
        await tx.student.update({
          where: { id: student.id },
          data: { photoPath: photoFileName },
        });
      }

      await tx.inscription.create({
        data: {
          centerId: req.centerId,
          studentId: student.id,
          classeId: targetClass.id,
          academicYearId: finalYearId,
          promotionId: promotion.id,
          status: "en_cours",
        },
      });

      return tx.student.findUnique({
        where: { id: student.id },
        include: {
          inscriptions: {
            include: {
              classe: { include: { filiere: true, niveau: true } },
              promotion: true,
              academicYear: true,
            },
          },
        },
      });
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Un apprenant avec ce matricule existe déjà." });
    }
    next(err);
  }
});

// 4. Modification
router.put("/students/:id", verifyJwt, requirePermission("students.update"), async (req, res, next) => {
  try {
    const {
      firstName, lastName, gender, birthDate, birthPlace, phone,
      guardianName, guardianPhone, entryDiploma, photoDataUrl,
    } = req.body || {};

    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, centerId: req.centerId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: "Apprenant introuvable." });

    const updateData = {
      ...(firstName && { firstName: firstName.trim() }),
      ...(lastName && { lastName: lastName.trim() }),
      ...(gender !== undefined && { gender: gender || null }),
      ...(birthPlace !== undefined && { birthPlace: birthPlace ? birthPlace.trim() : null }),
      ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
      ...(guardianName !== undefined && { guardianName: guardianName ? guardianName.trim() : null }),
      ...(guardianPhone !== undefined && { guardianPhone: guardianPhone ? guardianPhone.trim() : null }),
      ...(entryDiploma !== undefined && { entryDiploma: entryDiploma ? entryDiploma.trim() : null }),
      ...(birthDate !== undefined && { birthDate: parseBirthDateSafe(birthDate) }),
    };

    if (photoDataUrl === "") {
      removeExistingPhoto(req.centerId, existing.id);
      updateData.photoPath = null;
    } else if (photoDataUrl && photoDataUrl.startsWith("data:image/")) {
      updateData.photoPath = saveStudentPhoto(req.centerId, existing.id, photoDataUrl);
    }

    const updated = await prisma.student.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        inscriptions: {
          include: {
            classe: { include: { filiere: true, niveau: true } },
            promotion: true,
            academicYear: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// 5. Récupération photo
router.get("/students/:id/photo", verifyJwt, requirePermission("students.read"), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, centerId: req.centerId, deletedAt: null },
    });
    if (!student || !student.photoPath) {
      return res.status(404).json({ error: "Aucune photo enregistrée." });
    }

    const filePath = path.join(studentPhotosDir(req.centerId), student.photoPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Fichier photo introuvable." });
    }

    const ext = path.extname(student.photoPath).replace(".", "").toLowerCase();
    res.setHeader("Content-Type", EXT_TO_MIME[ext] || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=120");
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

/**
 * 6. SUPPRESSION INTELLIGENTE À DOUBLE NIVEAU :
 * - Si antécédents académiques / notes présents -> Archivage Légal (Soft Delete)
 * - Si zéro historique (erreur de saisie) -> Suppression Définitive Réelle (Hard Delete + libération matricule)
 */
router.delete("/students/:id", verifyJwt, requirePermission("students.delete"), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
    });
    if (!student) return res.status(404).json({ error: "Apprenant introuvable." });

    // Contrôle d'antécédents académiques réels
    const [
      gradesCount,
      subjectResultsCount,
      studentDeliberationsCount,
      mockExamGradesCount,
      mockExamSummariesCount,
      presencesCount,
      stagesCount,
      documentsCount,
    ] = await Promise.all([
      prisma.grade.count({ where: { studentId: student.id, centerId: req.centerId } }),
      prisma.subjectResult.count({ where: { studentId: student.id, centerId: req.centerId } }),
      prisma.studentDeliberation.count({ where: { studentId: student.id } }),
      prisma.mockExamGrade.count({ where: { studentId: student.id } }),
      prisma.mockExamSummary.count({ where: { studentId: student.id } }),
      prisma.presence.count({ where: { studentId: student.id, centerId: req.centerId } }),
      prisma.stage.count({ where: { studentId: student.id, centerId: req.centerId } }),
      prisma.document.count({ where: { studentId: student.id, centerId: req.centerId } }),
    ]);

    const hasAcademicHistory =
      gradesCount > 0 ||
      subjectResultsCount > 0 ||
      studentDeliberationsCount > 0 ||
      mockExamGradesCount > 0 ||
      mockExamSummariesCount > 0 ||
      presencesCount > 0 ||
      stagesCount > 0 ||
      documentsCount > 0;

    if (hasAcademicHistory) {
      // CAS A : Archivage légal avec scellement de traçabilité
      await prisma.student.update({
        where: { id: student.id },
        data: { deletedAt: new Date() },
      });
      return res.json({
        action: "ARCHIVED",
        message: `L'apprenant "${student.lastName} ${student.firstName}" possède un historique académique/des notes. Son dossier a été archivé pour préserver l'intégrité légale du registre.`,
      });
    }

    // CAS B : Erreur de manipulation sans antécédents -> Suppression Définitive Réelle (Hard Delete)
    await prisma.$transaction(async (tx) => {
      await tx.inscription.deleteMany({ where: { studentId: student.id, centerId: req.centerId } });
      await tx.student.delete({ where: { id: student.id } });
    });

    removeExistingPhoto(req.centerId, student.id);

    return res.json({
      action: "DELETED",
      message: `L'apprenant "${student.lastName} ${student.firstName}" n'ayant aucune note ni acte officiel, son dossier et son matricule (${student.matricule}) ont été définitivement supprimés.`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 7. PURGE DÉFINITIVE DEPUIS LES ARCHIVES
 */
router.delete("/students/:id/purge", verifyJwt, requirePermission("students.delete"), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, centerId: req.centerId, deletedAt: { not: null } },
    });
    if (!student) return res.status(404).json({ error: "Dossier archivé introuvable." });

    const [gradesCount, subjectResultsCount, studentDeliberationsCount, mockExamGradesCount, documentsCount] = await Promise.all([
      prisma.grade.count({ where: { studentId: student.id, centerId: req.centerId } }),
      prisma.subjectResult.count({ where: { studentId: student.id, centerId: req.centerId } }),
      prisma.studentDeliberation.count({ where: { studentId: student.id } }),
      prisma.mockExamGrade.count({ where: { studentId: student.id } }),
      prisma.document.count({ where: { studentId: student.id, centerId: req.centerId } }),
    ]);

    const hasHistory = gradesCount > 0 || subjectResultsCount > 0 || studentDeliberationsCount > 0 || mockExamGradesCount > 0 || documentsCount > 0;

    if (hasHistory) {
      return res.status(409).json({
        error: `Impossible de purger définitivement ce dossier : il est rattaché à ${gradesCount + mockExamGradesCount} note(s), des délibérations ou des actes officiels délivrés.`,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.inscription.deleteMany({ where: { studentId: student.id, centerId: req.centerId } });
      await tx.student.delete({ where: { id: student.id } });
    });

    removeExistingPhoto(req.centerId, student.id);

    res.json({
      success: true,
      message: `Dossier et matricule (${student.matricule}) définitivement purgés du système.`,
    });
  } catch (err) {
    next(err);
  }
});

// 8. Restauration
router.put("/students/:id/restore", verifyJwt, requirePermission("students.update"), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, centerId: req.centerId, deletedAt: { not: null } },
    });
    if (!student) return res.status(404).json({ error: "Apprenant archivé introuvable." });

    const restored = await prisma.student.update({
      where: { id: req.params.id },
      data: { deletedAt: null },
      include: {
        inscriptions: {
          include: {
            classe: { include: { filiere: true, niveau: true } },
            promotion: true,
            academicYear: true,
          },
        },
      },
    });

    res.json(restored);
  } catch (err) {
    next(err);
  }
});

// 9. Export CSV
router.get("/students-export", verifyJwt, requirePermission("students.read"), async (req, res, next) => {
  try {
    const where = buildStudentWhereClause(req.centerId, req.query);
    const isArchived = req.query.onlyArchived === "true";

    const students = await prisma.student.findMany({
      where,
      include: {
        inscriptions: {
          include: {
            classe: { include: { filiere: true, niveau: true } },
            promotion: true,
            academicYear: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: isArchived ? { deletedAt: "desc" } : { lastName: "asc" },
    });

    const headers = [
      "Matricule", "Nom", "Prenom", "Genre", "DateNaissance", "LieuNaissance",
      "Telephone", "Tuteur", "TelUrgence", "DiplomeEntree",
      "Classe", "Filiere", "Promotion", "Session", "Statut",
    ];

    const rows = students.map((s) => {
      const currentInsc = s.inscriptions[0];
      return [
        `"${s.matricule}"`,
        `"${s.lastName}"`,
        `"${s.firstName}"`,
        `"${s.gender || ""}"`,
        `"${s.birthDate ? new Date(s.birthDate).toISOString().split("T")[0] : ""}"`,
        `"${s.birthPlace || ""}"`,
        `"${s.phone || ""}"`,
        `"${s.guardianName || ""}"`,
        `"${s.guardianPhone || ""}"`,
        `"${s.entryDiploma || ""}"`,
        `"${currentInsc?.classe?.label || ""}"`,
        `"${currentInsc?.classe?.filiere?.name || ""}"`,
        `"${currentInsc?.promotion?.label || ""}"`,
        `"${currentInsc?.academicYear?.label || ""}"`,
        `"${currentInsc?.status || "en_cours"}"`,
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="apprenants_ceco.csv"');
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

// 10. Import CSV
router.post("/students/import", verifyJwt, requirePermission("students.create"), async (req, res, next) => {
  try {
    const { students: items, classeId, academicYearId } = req.body || {};

    if (!Array.isArray(items) || items.length === 0 || !classeId || !academicYearId) {
      return res.status(400).json({ error: "Liste d'apprenants, classe et session requises." });
    }

    const [year, classe] = await Promise.all([
      prisma.academicYear.findFirst({ where: { id: academicYearId, centerId: req.centerId, isCurrent: true } }),
      prisma.classe.findFirst({ where: { id: classeId, centerId: req.centerId }, include: { filiere: { include: { programType: true } } } }),
    ]);

    if (!year) return res.status(400).json({ error: "La session sélectionnée n'est pas active." });
    if (!classe) return res.status(404).json({ error: "Classe introuvable." });

    let promotion = await prisma.promotion.findFirst({
      where: { centerId: req.centerId, filiereId: classe.filiereId, academicYearId: year.id },
    });
    if (!promotion) {
      const startYear = parseInt(year.label.split("-")[0], 10) || 2026;
      promotion = await prisma.promotion.create({
        data: {
          centerId: req.centerId,
          filiereId: classe.filiereId,
          academicYearId: year.id,
          label: `Promotion ${startYear}-${startYear + (classe.filiere?.durationInYears || 2)}`,
        },
      });
    }

    let createdCount = 0;
    const errors = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const rowNum = index + 2;

      if (!item.firstName || !item.lastName) {
        errors.push({ row: rowNum, reason: "Nom ou prénom manquant" });
        continue;
      }

      let matricule = item.matricule ? item.matricule.trim().toUpperCase() : null;
      if (!matricule) {
        matricule = await generateDynamicMatricule(req.centerId, classe, year, createdCount);
      }

      const existing = await prisma.student.findFirst({
        where: { centerId: req.centerId, matricule },
      });

      if (existing) {
        errors.push({ row: rowNum, matricule, reason: "Matricule déjà attribué à un autre apprenant" });
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          const student = await tx.student.create({
            data: {
              centerId: req.centerId,
              matricule,
              firstName: item.firstName.trim(),
              lastName: item.lastName.trim(),
              gender: item.gender ? item.gender.trim().toUpperCase().charAt(0) : "M",
              birthDate: parseBirthDateSafe(item.birthDate),
              birthPlace: item.birthPlace ? item.birthPlace.trim() : null,
              phone: item.phone ? item.phone.trim() : null,
              guardianName: item.guardianName ? item.guardianName.trim() : null,
              guardianPhone: item.guardianPhone ? item.guardianPhone.trim() : null,
              entryDiploma: item.entryDiploma ? item.entryDiploma.trim() : "BEPC",
            },
          });

          await tx.inscription.create({
            data: {
              centerId: req.centerId,
              studentId: student.id,
              classeId,
              academicYearId,
              promotionId: promotion.id,
              status: "en_cours",
            },
          });
        });

        createdCount++;
      } catch (e) {
        errors.push({ row: rowNum, matricule, reason: e.message || "Erreur de base de données" });
      }
    }

    res.json({
      success: true,
      createdCount,
      totalCount: items.length,
      errors,
      message: `${createdCount} apprenant(s) importé(s) avec succès sur ${items.length} lignes traitées.`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;