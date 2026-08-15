// packages/backend/src/routes/formations.js
const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

async function ensureAcademicYearActive(academicYearId, centerId) {
  const year = await prisma.academicYear.findFirst({
    where: { id: academicYearId, centerId },
  });
  if (!year) throw new Error("Année académique introuvable.");
  if (!year.isCurrent) {
    throw new Error(`La session "${year.label}" est clôturée. Les modifications sont restreintes.`);
  }
  return year;
}

// ============================================================================
// 1. CYCLES / TYPES DE PROGRAMMES (DQP, CQP...)
// ============================================================================
router.get("/program-types", verifyJwt, requirePermission("center.read", "center.update"), async (req, res, next) => {
  try {
    const types = await prisma.programType.findMany({
      where: { centerId: req.centerId },
      include: { _count: { select: { filieres: true } } },
      orderBy: { code: "asc" },
    });
    res.json(types);
  } catch (err) {
    next(err);
  }
});

router.post("/program-types", verifyJwt, requirePermission("center.create", "center.update"), async (req, res, next) => {
  try {
    const { code, label } = req.body || {};
    if (!code || !label) return res.status(400).json({ error: "Code et libellé requis." });

    const created = await prisma.programType.create({
      data: { centerId: req.centerId, code: code.trim().toUpperCase(), label: label.trim() },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Ce code de cycle existe déjà." });
    next(err);
  }
});

router.put("/program-types/:id", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { code, label } = req.body || {};
    await prisma.programType.updateMany({
      where: { id: req.params.id, centerId: req.centerId },
      data: { ...(code && { code: code.trim().toUpperCase() }), ...(label && { label: label.trim() }) },
    });
    const result = await prisma.programType.findUnique({ where: { id: req.params.id } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete("/program-types/:id", verifyJwt, requirePermission("center.delete", "center.update"), async (req, res, next) => {
  try {
    const count = await prisma.filiere.count({ where: { programTypeId: req.params.id, centerId: req.centerId } });
    if (count > 0) return res.status(409).json({ error: "Des filières sont rattachées à ce cycle." });
    await prisma.programType.deleteMany({ where: { id: req.params.id, centerId: req.centerId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 2. FILIÈRES & NIVEAUX
// ============================================================================
router.get("/filieres", verifyJwt, requirePermission("center.read", "center.update"), async (req, res, next) => {
  try {
    const filieres = await prisma.filiere.findMany({
      where: { centerId: req.centerId },
      include: {
        programType: true,
        niveaux: { orderBy: { order: "asc" } },
        _count: { select: { classes: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json(filieres);
  } catch (err) {
    next(err);
  }
});

router.post("/filieres", verifyJwt, requirePermission("center.create", "center.update"), async (req, res, next) => {
  try {
    const { programTypeId, name, durationInYears } = req.body || {};
    const duration = Math.max(1, Math.min(3, parseInt(durationInYears) || 1));
    if (!programTypeId || !name) return res.status(400).json({ error: "Cycle et nom requis." });

    const filiere = await prisma.filiere.create({
      data: {
        centerId: req.centerId,
        programTypeId,
        name: name.trim(),
        durationInYears: duration,
        niveaux: { create: Array.from({ length: duration }, (_, i) => ({ order: i + 1 })) },
      },
      include: { programType: true, niveaux: { orderBy: { order: "asc" } } },
    });

    // Création automatique de la classe Niveau 1 sur la session active
    const currentYear = await prisma.academicYear.findFirst({ where: { centerId: req.centerId, isCurrent: true } });
    if (currentYear) {
      const niveau1 = filiere.niveaux.find((n) => n.order === 1);
      if (niveau1) {
        await prisma.classe.create({
          data: {
            centerId: req.centerId,
            filiereId: filiere.id,
            niveauId: niveau1.id,
            academicYearId: currentYear.id,
            label: `${filiere.name} - Niveau 1 (${currentYear.label})`,
          },
        });
      }
    }
    res.status(201).json(filiere);
  } catch (err) {
    next(err);
  }
});

router.put("/filieres/:id", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { programTypeId, name, durationInYears } = req.body || {};
    const existing = await prisma.filiere.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
      include: { niveaux: true },
    });
    if (!existing) return res.status(404).json({ error: "Filière introuvable." });

    const newDuration = durationInYears ? Math.max(1, Math.min(3, parseInt(durationInYears))) : existing.durationInYears;
    await prisma.filiere.update({
      where: { id: req.params.id },
      data: { ...(name && { name: name.trim() }), ...(programTypeId && { programTypeId }), durationInYears: newDuration },
    });

    // Ajustement dynamique des niveaux
    if (newDuration > existing.niveaux.length) {
      const missingCount = newDuration - existing.niveaux.length;
      const startOrder = existing.niveaux.length + 1;
      await prisma.niveau.createMany({
        data: Array.from({ length: missingCount }, (_, i) => ({ filiereId: req.params.id, order: startOrder + i })),
      });
    }

    const updated = await prisma.filiere.findUnique({
      where: { id: req.params.id },
      include: { programType: true, niveaux: { orderBy: { order: "asc" } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/filieres/:id", verifyJwt, requirePermission("center.delete", "center.update"), async (req, res, next) => {
  try {
    const classesCount = await prisma.classe.count({ where: { filiereId: req.params.id, centerId: req.centerId } });
    if (classesCount > 0) return res.status(409).json({ error: "Des classes existent pour cette filière." });
    await prisma.niveau.deleteMany({ where: { filiereId: req.params.id } });
    await prisma.filiere.deleteMany({ where: { id: req.params.id, centerId: req.centerId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 3. SESSIONS ACADÉMIQUES & TRANSITION
// ============================================================================
router.get("/academic-years", verifyJwt, requirePermission("center.read", "center.update"), async (req, res, next) => {
  try {
    const years = await prisma.academicYear.findMany({
      where: { centerId: req.centerId },
      include: { _count: { select: { classes: true, inscriptions: true } } },
      orderBy: { startDate: "desc" },
    });
    res.json(years);
  } catch (err) {
    next(err);
  }
});

router.post("/academic-years", verifyJwt, requirePermission("center.create", "center.update"), async (req, res, next) => {
  try {
    const { label, startDate, endDate, isCurrent } = req.body || {};
    if (!label || !startDate || !endDate) return res.status(400).json({ error: "Intitulé et dates requis." });

    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: { centerId: req.centerId },
        data: { isCurrent: false },
      });
    }

    const createdYear = await prisma.academicYear.create({
      data: {
        centerId: req.centerId,
        label: label.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: Boolean(isCurrent),
      },
    });

    // Auto-création systématique des classes Niveau 1 pour chaque filière
    const filieres = await prisma.filiere.findMany({
      where: { centerId: req.centerId },
      include: { niveaux: { where: { order: 1 } } },
    });

    for (const f of filieres) {
      const niveau1 = f.niveaux[0];
      if (niveau1) {
        await prisma.classe.create({
          data: {
            centerId: req.centerId,
            filiereId: f.id,
            niveauId: niveau1.id,
            academicYearId: createdYear.id,
            label: `${f.name} - Niveau 1 (${createdYear.label})`,
          },
        });
      }
    }

    res.status(201).json(createdYear);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Cette session existe déjà." });
    next(err);
  }
});

router.put("/academic-years/:id", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { label, startDate, endDate } = req.body || {};
    const updated = await prisma.academicYear.update({
      where: { id: req.params.id },
      data: {
        ...(label && { label: label.trim() }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.put("/academic-years/:id/set-current", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    await prisma.academicYear.updateMany({
      where: { centerId: req.centerId },
      data: { isCurrent: false },
    });
    const updated = await prisma.academicYear.update({
      where: { id: req.params.id },
      data: { isCurrent: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Moteur de transition annuelle (Promotion des admis, réinscription des redoublants)
router.post("/academic-years/:newYearId/transition", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { previousYearId } = req.body || {};
    const { newYearId } = req.params;

    const newYear = await ensureAcademicYearActive(newYearId, req.centerId);

    const pastInscriptions = await prisma.inscription.findMany({
      where: { centerId: req.centerId, academicYearId: previousYearId },
      include: {
        student: true,
        classe: {
          include: {
            filiere: { include: { niveaux: { orderBy: { order: "asc" } } } },
            niveau: true,
          },
        },
      },
    });

    let promotedCount = 0;
    let repeatedCount = 0;
    let graduatedCount = 0;

    for (const insc of pastInscriptions) {
      const currentNiveauOrder = insc.classe.niveau.order;
      const filiere = insc.classe.filiere;

      let targetNiveauOrder = null;
      if (insc.status === "admis") {
        if (currentNiveauOrder + 1 <= filiere.durationInYears) {
          targetNiveauOrder = currentNiveauOrder + 1; // Montée en classe supérieure
        } else {
          graduatedCount++; // Diplômé en fin de cycle
        }
      } else if (insc.status === "redouble") {
        targetNiveauOrder = currentNiveauOrder; // Répétition même niveau
      }

      if (targetNiveauOrder !== null) {
        const targetNiveau = filiere.niveaux.find((n) => n.order === targetNiveauOrder);
        if (targetNiveau) {
          let targetClass = await prisma.classe.findFirst({
            where: {
              centerId: req.centerId,
              filiereId: filiere.id,
              niveauId: targetNiveau.id,
              academicYearId: newYear.id,
            },
          });

          if (!targetClass) {
            targetClass = await prisma.classe.create({
              data: {
                centerId: req.centerId,
                filiereId: filiere.id,
                niveauId: targetNiveau.id,
                academicYearId: newYear.id,
                label: `${filiere.name} - Niveau ${targetNiveauOrder} (${newYear.label})`,
              },
            });
          }

          const existingInsc = await prisma.inscription.findUnique({
            where: {
              studentId_academicYearId: {
                studentId: insc.studentId,
                academicYearId: newYear.id,
              },
            },
          });

          if (!existingInsc) {
            await prisma.inscription.create({
              data: {
                centerId: req.centerId,
                studentId: insc.studentId,
                classeId: targetClass.id,
                academicYearId: newYear.id,
                status: "en_cours",
              },
            });

            if (insc.status === "admis") promotedCount++;
            if (insc.status === "redouble") repeatedCount++;
          }
        }
      }
    }

    // Clôture formelle de la session passée
    await prisma.academicYear.updateMany({
      where: { id: previousYearId, centerId: req.centerId },
      data: { isCurrent: false },
    });

    res.json({
      success: true,
      promotedCount,
      repeatedCount,
      graduatedCount,
      message: `Transition effectuée avec succès : ${promotedCount} admis promus en niveau supérieur, ${repeatedCount} redoublants réinscrits, ${graduatedCount} lauréats diplômés.`,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 4. CLASSES PROMOTIONNELLES
// ============================================================================
router.get("/classes", verifyJwt, requirePermission("center.read", "center.update"), async (req, res, next) => {
  try {
    const classes = await prisma.classe.findMany({
      where: { centerId: req.centerId },
      include: {
        filiere: { include: { programType: true } },
        niveau: true,
        academicYear: true,
        salle: true,
        _count: { select: { inscriptions: true } },
      },
      orderBy: [
        { academicYear: { startDate: "desc" } },
        { filiere: { name: "asc" } },
        { niveau: { order: "asc" } },
      ],
    });
    res.json(classes);
  } catch (err) {
    next(err);
  }
});

// Détail et effectif complet d'une classe
router.get("/classes/:id/students", verifyJwt, requirePermission("students.read"), async (req, res, next) => {
  try {
    const classe = await prisma.classe.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
      include: {
        filiere: { include: { programType: true } },
        niveau: true,
        academicYear: true,
        salle: true,
        inscriptions: {
          where: { student: { deletedAt: null } },
          include: { student: true },
          orderBy: { student: { lastName: "asc" } },
        },
      },
    });
    if (!classe) return res.status(404).json({ error: "Classe introuvable." });
    res.json(classe);
  } catch (err) {
    next(err);
  }
});

router.post("/classes", verifyJwt, requirePermission("center.create", "center.update"), async (req, res, next) => {
  try {
    const { filiereId, niveauId, academicYearId, salleId, label } = req.body || {};
    await ensureAcademicYearActive(academicYearId, req.centerId);

    let classLabel = label ? label.trim() : null;
    if (!classLabel) {
      const [filiere, niveau, year] = await Promise.all([
        prisma.filiere.findUnique({ where: { id: filiereId } }),
        prisma.niveau.findUnique({ where: { id: niveauId } }),
        prisma.academicYear.findUnique({ where: { id: academicYearId } }),
      ]);
      classLabel = `${filiere.name} - Niveau ${niveau.order} (${year.label})`;
    }

    const created = await prisma.classe.create({
      data: {
        centerId: req.centerId,
        filiereId,
        niveauId,
        academicYearId,
        salleId: salleId || null,
        label: classLabel,
      },
      include: {
        filiere: { include: { programType: true } },
        niveau: true,
        academicYear: true,
        salle: true,
        _count: { select: { inscriptions: true } },
      },
    });

    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Cette classe existe déjà." });
    next(err);
  }
});

router.put("/classes/:id", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { salleId, label } = req.body || {};
    const existing = await prisma.classe.findFirst({ where: { id: req.params.id, centerId: req.centerId } });
    if (!existing) return res.status(404).json({ error: "Classe introuvable." });

    await ensureAcademicYearActive(existing.academicYearId, req.centerId);

    await prisma.classe.update({
      where: { id: req.params.id },
      data: { ...(label && { label: label.trim() }), ...(salleId !== undefined && { salleId: salleId || null }) },
    });

    const updated = await prisma.classe.findUnique({
      where: { id: req.params.id },
      include: { filiere: { include: { programType: true } }, niveau: true, academicYear: true, salle: true, _count: { select: { inscriptions: true } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/classes/:id", verifyJwt, requirePermission("center.delete", "center.update"), async (req, res, next) => {
  try {
    const existing = await prisma.classe.findFirst({ where: { id: req.params.id, centerId: req.centerId } });
    if (!existing) return res.status(404).json({ error: "Classe introuvable." });

    await ensureAcademicYearActive(existing.academicYearId, req.centerId);

    const count = await prisma.inscription.count({ where: { classeId: req.params.id, centerId: req.centerId } });
    if (count > 0) return res.status(409).json({ error: "Des apprenants sont inscrits dans cette classe." });

    await prisma.classe.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 5. SALLES & ESPACES
// ============================================================================
router.get("/salles", verifyJwt, requirePermission("center.read", "center.update"), async (req, res, next) => {
  try {
    const salles = await prisma.salle.findMany({
      where: { centerId: req.centerId },
      include: { _count: { select: { classes: true } } },
      orderBy: { name: "asc" },
    });
    res.json(salles);
  } catch (err) {
    next(err);
  }
});

router.post("/salles", verifyJwt, requirePermission("center.create", "center.update"), async (req, res, next) => {
  try {
    const { name, capacity } = req.body || {};
    if (!name) return res.status(400).json({ error: "Nom requis." });
    const created = await prisma.salle.create({
      data: { centerId: req.centerId, name: name.trim(), capacity: capacity ? parseInt(capacity) : null },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put("/salles/:id", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { name, capacity } = req.body || {};
    await prisma.salle.updateMany({
      where: { id: req.params.id, centerId: req.centerId },
      data: { ...(name && { name: name.trim() }), capacity: capacity !== undefined ? (capacity ? parseInt(capacity) : null) : undefined },
    });
    const result = await prisma.salle.findUnique({ where: { id: req.params.id } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete("/salles/:id", verifyJwt, requirePermission("center.delete", "center.update"), async (req, res, next) => {
  try {
    await prisma.classe.updateMany({ where: { salleId: req.params.id }, data: { salleId: null } });
    await prisma.salle.deleteMany({ where: { id: req.params.id, centerId: req.centerId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;