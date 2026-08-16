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

// 1. Lister les apprenants
router.get("/students", verifyJwt, requirePermission("students.read"), async (req, res, next) => {
  try {
    const { search, classeId, academicYearId, promotionId, status, filiereId, onlyArchived } = req.query || {};
    const isArchivedQuery = onlyArchived === "true";

    const where = {
      centerId: req.centerId,
      deletedAt: isArchivedQuery ? { not: null } : null,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { matricule: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(classeId && { inscriptions: { some: { classeId } } }),
      ...(promotionId && { inscriptions: { some: { promotionId } } }),
      ...(filiereId && !classeId && { inscriptions: { some: { classe: { filiereId } } } }),
      ...(academicYearId && { inscriptions: { some: { academicYearId } } }),
      ...(status && { inscriptions: { some: { status } } }),
    };

    const students = await prisma.student.findMany({
      where,
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
      orderBy: isArchivedQuery ? { deletedAt: "desc" } : { lastName: "asc" },
    });

    res.json(students);
  } catch (err) {
    next(err);
  }
});

// 2. Fiche apprenant
router.get("/students/:id", verifyJwt, requirePermission("students.read"), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, centerId: req.centerId, deletedAt: null },
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

// 3. Création sécurisée et auto-résolue d'un apprenant
router.post("/students", verifyJwt, requirePermission("students.create"), async (req, res, next) => {
  try {
    const {
      firstName, lastName, gender, birthDate, birthPlace, phone,
      guardianName, guardianPhone, entryDiploma,
      matricule, classeId, academicYearId, photoDataUrl,
    } = req.body || {};

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "Le nom et le prénom de l'apprenant sont obligatoires." });
    }

    await ensureStorageTree(req.centerId);

    // 1. Résolution de la classe
    let targetClass = null;
    if (classeId) {
      targetClass = await prisma.classe.findFirst({
        where: { id: classeId, centerId: req.centerId },
        include: { niveau: true, filiere: true, academicYear: true },
      });
    }

    // Si aucune classe valide n'a été passée, on résout la première classe active disponible
    if (!targetClass) {
      targetClass = await prisma.classe.findFirst({
        where: {
          centerId: req.centerId,
          ...(academicYearId ? { academicYearId } : { academicYear: { isCurrent: true } }),
        },
        include: { niveau: true, filiere: true, academicYear: true },
        orderBy: { label: "asc" },
      });
    }

    if (!targetClass) {
      return res.status(400).json({
        error: "Aucune classe disponible. Veuillez d'abord créer au moins une classe dans le module Formations.",
      });
    }

    // 2. Résolution de la session (déduite de la classe)
    const targetYear = targetClass.academicYear;
    const finalYearId = targetYear?.id || academicYearId;

    // 3. Résolution ou auto-création de la promotion (cohorte)
    let promotion = await prisma.promotion.findFirst({
      where: { centerId: req.centerId, filiereId: targetClass.filiereId, academicYearId: finalYearId },
    });

    if (!promotion) {
      const yearLabel = targetYear?.label || "2026-2027";
      const startYear = parseInt(yearLabel.split("-")[0]) || 2026;
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

    // 4. Génération automatique du matricule si non renseigné
    let autoMatricule = matricule ? matricule.trim().toUpperCase() : null;
    if (!autoMatricule) {
      const yearPrefix = (targetYear?.label || "26").substring(2, 4);
      const count = await prisma.student.count({ where: { centerId: req.centerId } });
      autoMatricule = `STU${yearPrefix}-${String(count + 1).padStart(4, "0")}`;
    }

    // 5. Exécution sous transaction atomique ACID
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          centerId: req.centerId,
          matricule: autoMatricule,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender: gender || "M",
          birthDate: birthDate ? new Date(birthDate) : null,
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
      return res.status(409).json({ error: "Un apprenant avec ce matricule existe déjà dans l'établissement." });
    }
    console.error("[Student Create Error]", err);
    next(err);
  }
});

// 4. Modification
router.put("/students/:id", verifyJwt, requirePermission("students.update"), async (req, res, next) => {
  try {
    const {
      firstName, lastName, gender, birthDate, birthPlace, phone,
      guardianName, guardianPhone, entryDiploma,
      matricule, photoDataUrl,
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
      ...(matricule && { matricule: matricule.trim().toUpperCase() }),
      ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
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

// 5. Photo
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

// 6. Réinscription
router.post("/students/:id/inscribe", verifyJwt, requirePermission("students.create", "students.update"), async (req, res, next) => {
  try {
    const { classeId, academicYearId, status } = req.body || {};
    const studentId = req.params.id;

    if (!classeId || !academicYearId) {
      return res.status(400).json({ error: "Classe et session requises." });
    }

    const year = await prisma.academicYear.findFirst({
      where: { id: academicYearId, centerId: req.centerId },
    });
    if (!year || !year.isCurrent) {
      return res.status(400).json({ error: "La session sélectionnée n'est pas active." });
    }

    const existingInsc = await prisma.inscription.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId } },
    });

    if (existingInsc) {
      return res.status(409).json({ error: "Cet apprenant est déjà inscrit pour cette session académique." });
    }

    const lastInsc = await prisma.inscription.findFirst({
      where: { studentId, centerId: req.centerId },
      orderBy: { createdAt: "asc" },
    });

    const created = await prisma.inscription.create({
      data: {
        centerId: req.centerId,
        studentId,
        classeId,
        academicYearId,
        promotionId: lastInsc?.promotionId || null,
        status: status || "en_cours",
      },
      include: {
        classe: { include: { filiere: true, niveau: true } },
        promotion: true,
        academicYear: true,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// 7. Statut d'inscription
router.put("/inscriptions/:id/status", verifyJwt, requirePermission("students.update"), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!["en_cours", "admis", "redouble", "abandon", "diplome"].includes(status)) {
      return res.status(400).json({ error: "Statut invalide." });
    }

    const updated = await prisma.inscription.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// 8. Suppression douce
router.delete("/students/:id", verifyJwt, requirePermission("students.delete"), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
    });
    if (!student) return res.status(404).json({ error: "Apprenant introuvable." });

    await prisma.student.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 9. Restauration d'un apprenant archivé
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

// 10. Exportation CSV enrichie
router.get("/students-export", verifyJwt, requirePermission("students.read"), async (req, res, next) => {
  try {
    const students = await prisma.student.findMany({
      where: { centerId: req.centerId, deletedAt: null },
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
      orderBy: { lastName: "asc" },
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

// 11. Importation en masse avec bilan d'anomalies
router.post("/students/import", verifyJwt, requirePermission("students.create"), async (req, res, next) => {
  try {
    const { students: items, classeId, academicYearId } = req.body || {};

    if (!Array.isArray(items) || items.length === 0 || !classeId || !academicYearId) {
      return res.status(400).json({ error: "Liste d'apprenants, classe et session requises." });
    }

    const [year, classe] = await Promise.all([
      prisma.academicYear.findFirst({ where: { id: academicYearId, centerId: req.centerId, isCurrent: true } }),
      prisma.classe.findFirst({ where: { id: classeId, centerId: req.centerId }, include: { filiere: true } }),
    ]);

    if (!year) return res.status(400).json({ error: "La session sélectionnée n'est pas active." });
    if (!classe) return res.status(404).json({ error: "Classe introuvable." });

    let promotion = await prisma.promotion.findFirst({
      where: { centerId: req.centerId, filiereId: classe.filiereId, academicYearId: year.id },
    });
    if (!promotion) {
      const startYear = parseInt(year.label.split("-")[0]) || 2026;
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
    const yearPrefix = year.label.substring(2, 4);

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const rowNum = index + 2;

      if (!item.firstName || !item.lastName) {
        errors.push({ row: rowNum, reason: "Nom ou prénom manquant" });
        continue;
      }

      let matricule = item.matricule ? item.matricule.trim().toUpperCase() : null;
      if (!matricule) {
        const count = await prisma.student.count({ where: { centerId: req.centerId } });
        matricule = `STU${yearPrefix}-${String(count + 1 + createdCount).padStart(4, "0")}`;
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
              birthDate: item.birthDate ? new Date(item.birthDate) : null,
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