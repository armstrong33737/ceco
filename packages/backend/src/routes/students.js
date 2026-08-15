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
    const { search, classeId, academicYearId, status, filiereId } = req.query || {};

    const where = {
      centerId: req.centerId,
      deletedAt: null,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { matricule: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(classeId && {
        inscriptions: { some: { classeId } }
      }),
      ...(filiereId && !classeId && {
        inscriptions: { some: { classe: { filiereId } } }
      }),
      ...(academicYearId && {
        inscriptions: { some: { academicYearId } }
      }),
      ...(status && {
        inscriptions: { some: { status } }
      }),
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
              }
            },
            academicYear: true
          },
          orderBy: { academicYear: { startDate: "desc" } }
        }
      },
      orderBy: { lastName: "asc" }
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
              }
            },
            academicYear: true
          },
          orderBy: { academicYear: { startDate: "desc" } }
        }
      }
    });

    if (!student) return res.status(404).json({ error: "Apprenant introuvable." });
    res.json(student);
  } catch (err) {
    next(err);
  }
});

// 3. Création
router.post("/students", verifyJwt, requirePermission("students.create"), async (req, res, next) => {
  try {
    const { firstName, lastName, birthDate, matricule, classeId, academicYearId, photoDataUrl } = req.body || {};

    if (!firstName || !lastName || !classeId || !academicYearId) {
      return res.status(400).json({ error: "Prénom, nom, classe et année académique requis." });
    }

    await ensureStorageTree(req.centerId);

    const year = await prisma.academicYear.findFirst({
      where: { id: academicYearId, centerId: req.centerId }
    });
    if (!year || !year.isCurrent) {
      return res.status(400).json({ error: "Les inscriptions ne sont autorisées que sur l'année académique active." });
    }

    let autoMatricule = matricule ? matricule.trim().toUpperCase() : null;
    if (!autoMatricule) {
      const yearPrefix = year.label.substring(2, 4);
      const count = await prisma.student.count({ where: { centerId: req.centerId } });
      autoMatricule = `STU${yearPrefix}-${String(count + 1).padStart(4, "0")}`;
    }

    const student = await prisma.student.create({
      data: {
        centerId: req.centerId,
        matricule: autoMatricule,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate: birthDate ? new Date(birthDate) : null,
      }
    });

    if (photoDataUrl && photoDataUrl.startsWith("data:image/")) {
      const photoFileName = saveStudentPhoto(req.centerId, student.id, photoDataUrl);
      await prisma.student.update({
        where: { id: student.id },
        data: { photoPath: photoFileName }
      });
    }

    await prisma.inscription.create({
      data: {
        centerId: req.centerId,
        studentId: student.id,
        classeId,
        academicYearId,
        status: "en_cours"
      }
    });

    const result = await prisma.student.findUnique({
      where: { id: student.id },
      include: {
        inscriptions: {
          include: {
            classe: { include: { filiere: true, niveau: true } },
            academicYear: true
          }
        }
      }
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
    const { firstName, lastName, birthDate, matricule, photoDataUrl } = req.body || {};

    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, centerId: req.centerId, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ error: "Apprenant introuvable." });

    const updateData = {
      ...(firstName && { firstName: firstName.trim() }),
      ...(lastName && { lastName: lastName.trim() }),
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
            academicYear: true
          }
        }
      }
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
      where: { id: req.params.id, centerId: req.centerId, deletedAt: null }
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
      return res.status(400).json({ error: "Classe et année académique requises." });
    }

    const year = await prisma.academicYear.findFirst({
      where: { id: academicYearId, centerId: req.centerId }
    });
    if (!year || !year.isCurrent) {
      return res.status(400).json({ error: "L'année académique sélectionnée n'est pas active." });
    }

    const existingInsc = await prisma.inscription.findUnique({
      where: {
        studentId_academicYearId: {
          studentId,
          academicYearId
        }
      }
    });

    if (existingInsc) {
      return res.status(409).json({ error: "Cet apprenant est déjà inscrit pour cette année académique." });
    }

    const created = await prisma.inscription.create({
      data: {
        centerId: req.centerId,
        studentId,
        classeId,
        academicYearId,
        status: status || "en_cours"
      },
      include: {
        classe: { include: { filiere: true, niveau: true } },
        academicYear: true
      }
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
    if (!["en_cours", "admis", "redouble", "abandon"].includes(status)) {
      return res.status(400).json({ error: "Statut invalide." });
    }

    const updated = await prisma.inscription.update({
      where: { id: req.params.id },
      data: { status }
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
      where: { id: req.params.id, centerId: req.centerId }
    });
    if (!student) return res.status(404).json({ error: "Apprenant introuvable." });

    await prisma.student.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 9. Exportation CSV
router.get("/students-export", verifyJwt, requirePermission("students.read", "students.generate"), async (req, res, next) => {
  try {
    const students = await prisma.student.findMany({
      where: { centerId: req.centerId, deletedAt: null },
      include: {
        inscriptions: {
          include: {
            classe: { include: { filiere: true, niveau: true } },
            academicYear: true
          },
          orderBy: { academicYear: { startDate: "desc" } }
        }
      },
      orderBy: { lastName: "asc" }
    });

    const headers = ["Matricule", "Nom", "Prenom", "DateNaissance", "Classe", "Filiere", "Session", "Statut"];
    const rows = students.map((s) => {
      const currentInsc = s.inscriptions[0];
      return [
        `"${s.matricule}"`,
        `"${s.lastName}"`,
        `"${s.firstName}"`,
        `"${s.birthDate ? new Date(s.birthDate).toISOString().split("T")[0] : ""}"`,
        `"${currentInsc?.classe?.label || ""}"`,
        `"${currentInsc?.classe?.filiere?.name || ""}"`,
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

// 10. Importation en masse
router.post("/students/import", verifyJwt, requirePermission("students.create"), async (req, res, next) => {
  try {
    const { students: items, classeId, academicYearId } = req.body || {};

    if (!Array.isArray(items) || items.length === 0 || !classeId || !academicYearId) {
      return res.status(400).json({ error: "Liste d'apprenants, classe et session académique requis." });
    }

    const year = await prisma.academicYear.findFirst({
      where: { id: academicYearId, centerId: req.centerId, isCurrent: true }
    });
    if (!year) {
      return res.status(400).json({ error: "L'année académique sélectionnée n'est pas active." });
    }

    let createdCount = 0;
    const yearPrefix = year.label.substring(2, 4);

    for (const item of items) {
      if (!item.firstName || !item.lastName) continue;

      let matricule = item.matricule ? item.matricule.trim().toUpperCase() : null;
      if (!matricule) {
        const count = await prisma.student.count({ where: { centerId: req.centerId } });
        matricule = `STU${yearPrefix}-${String(count + 1 + createdCount).padStart(4, "0")}`;
      }

      const existing = await prisma.student.findFirst({
        where: { centerId: req.centerId, matricule }
      });

      if (!existing) {
        const student = await prisma.student.create({
          data: {
            centerId: req.centerId,
            matricule,
            firstName: item.firstName.trim(),
            lastName: item.lastName.trim(),
            birthDate: item.birthDate ? new Date(item.birthDate) : null,
          }
        });

        await prisma.inscription.create({
          data: {
            centerId: req.centerId,
            studentId: student.id,
            classeId,
            academicYearId,
            status: "en_cours"
          }
        });

        createdCount++;
      }
    }

    res.json({ success: true, count: createdCount, message: `${createdCount} apprenant(s) importé(s) avec succès.` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;