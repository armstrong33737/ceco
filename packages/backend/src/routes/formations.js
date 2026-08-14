const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");

const router = express.Router();

// Vérifie que l'année académique ciblée est bien active (isCurrent === true)
async function ensureAcademicYearActive(academicYearId, centerId) {
  const year = await prisma.academicYear.findFirst({
    where: { id: academicYearId, centerId }
  });
  if (!year) throw new Error("Année académique introuvable.");
  if (!year.isCurrent) {
    throw new Error(`L'année académique "${year.label}" est clôturée. Aucune modification n'est autorisée.`);
  }
  return year;
}

// ============================================================================
// 1. TYPES DE PROGRAMMES / CYCLES (DQP, CQP...)
// ============================================================================
router.get("/program-types", verifyJwt, async (req, res, next) => {
  try {
    const types = await prisma.programType.findMany({
      where: { centerId: req.centerId },
      include: {
        _count: { select: { filieres: true } }
      },
      orderBy: { code: "asc" }
    });
    res.json(types);
  } catch (err) {
    next(err);
  }
});

router.post("/program-types", verifyJwt, async (req, res, next) => {
  try {
    const { code, label } = req.body || {};
    if (!code || !label) {
      return res.status(400).json({ error: "Le code (ex: DQP) et l'intitulé sont requis." });
    }

    const created = await prisma.programType.create({
      data: {
        centerId: req.centerId,
        code: code.trim().toUpperCase(),
        label: label.trim()
      }
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Un type de programme avec ce code existe déjà." });
    }
    next(err);
  }
});

router.put("/program-types/:id", verifyJwt, async (req, res, next) => {
  try {
    const { code, label } = req.body || {};
    const updated = await prisma.programType.updateMany({
      where: { id: req.params.id, centerId: req.centerId },
      data: {
        ...(code && { code: code.trim().toUpperCase() }),
        ...(label && { label: label.trim() })
      }
    });
    if (updated.count === 0) return res.status(404).json({ error: "Cycle introuvable." });
    
    const result = await prisma.programType.findUnique({ where: { id: req.params.id } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete("/program-types/:id", verifyJwt, async (req, res, next) => {
  try {
    const filieresCount = await prisma.filiere.count({
      where: { programTypeId: req.params.id, centerId: req.centerId }
    });
    if (filieresCount > 0) {
      return res.status(409).json({ error: "Impossible de supprimer : des filières sont rattachées à ce cycle." });
    }

    const deleted = await prisma.programType.deleteMany({
      where: { id: req.params.id, centerId: req.centerId }
    });
    if (deleted.count === 0) return res.status(404).json({ error: "Cycle introuvable." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 2. FILIÈRES & NIVEAUX DU PARCOURS (1 À 3 ANS)
// ============================================================================
router.get("/filieres", verifyJwt, async (req, res, next) => {
  try {
    const filieres = await prisma.filiere.findMany({
      where: { centerId: req.centerId },
      include: {
        programType: true,
        niveaux: { orderBy: { order: "asc" } },
        _count: { select: { classes: true } }
      },
      orderBy: { name: "asc" }
    });
    res.json(filieres);
  } catch (err) {
    next(err);
  }
});

router.post("/filieres", verifyJwt, async (req, res, next) => {
  try {
    const { programTypeId, name, durationInYears } = req.body || {};
    const duration = Math.max(1, Math.min(3, parseInt(durationInYears) || 1));

    if (!programTypeId || !name) {
      return res.status(400).json({ error: "Le cycle de formation et le nom de la filière sont requis." });
    }

    // 1. Création de la filière et de ses niveaux associés (1..duration)
    const filiere = await prisma.filiere.create({
      data: {
        centerId: req.centerId,
        programTypeId,
        name: name.trim(),
        durationInYears: duration,
        niveaux: {
          create: Array.from({ length: duration }, (_, i) => ({ order: i + 1 }))
        }
      },
      include: {
        programType: true,
        niveaux: { orderBy: { order: "asc" } }
      }
    });

    // 2. Si une session académique active existe déjà, on génère automatiquement la classe de Niveau 1
    const currentYear = await prisma.academicYear.findFirst({
      where: { centerId: req.centerId, isCurrent: true }
    });

    if (currentYear) {
      const niveau1 = filiere.niveaux.find((n) => n.order === 1);
      if (niveau1) {
        await prisma.classe.create({
          data: {
            centerId: req.centerId,
            filiereId: filiere.id,
            niveauId: niveau1.id,
            academicYearId: currentYear.id,
            label: `${filiere.name} - Niveau 1 (${currentYear.label})`
          }
        });
      }
    }

    res.status(201).json(filiere);
  } catch (err) {
    next(err);
  }
});

router.put("/filieres/:id", verifyJwt, async (req, res, next) => {
  try {
    const { programTypeId, name, durationInYears } = req.body || {};
    const existing = await prisma.filiere.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
      include: { niveaux: true }
    });
    if (!existing) return res.status(404).json({ error: "Filière introuvable." });

    const newDuration = durationInYears ? Math.max(1, Math.min(3, parseInt(durationInYears))) : existing.durationInYears;

    await prisma.filiere.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(programTypeId && { programTypeId }),
        durationInYears: newDuration
      }
    });

    // Si la durée a augmenté, on crée les niveaux manquants
    if (newDuration > existing.niveaux.length) {
      const missingCount = newDuration - existing.niveaux.length;
      const startOrder = existing.niveaux.length + 1;
      await prisma.niveau.createMany({
        data: Array.from({ length: missingCount }, (_, i) => ({
          filiereId: req.params.id,
          order: startOrder + i
        }))
      });
    }

    const updated = await prisma.filiere.findUnique({
      where: { id: req.params.id },
      include: { programType: true, niveaux: { orderBy: { order: "asc" } } }
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/filieres/:id", verifyJwt, async (req, res, next) => {
  try {
    const classesCount = await prisma.classe.count({
      where: { filiereId: req.params.id, centerId: req.centerId }
    });
    if (classesCount > 0) {
      return res.status(409).json({ error: "Impossible de supprimer : des classes existent pour cette filière." });
    }

    await prisma.niveau.deleteMany({ where: { filiereId: req.params.id } });
    await prisma.filiere.deleteMany({ where: { id: req.params.id, centerId: req.centerId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 3. ANNÉES ACADÉMIQUES & AUTO-GÉNÉRATION DES CLASSES DE NIVEAU 1
// ============================================================================
router.get("/academic-years", verifyJwt, async (req, res, next) => {
  try {
    const years = await prisma.academicYear.findMany({
      where: { centerId: req.centerId },
      include: {
        _count: { select: { classes: true, inscriptions: true } }
      },
      orderBy: { startDate: "desc" }
    });
    res.json(years);
  } catch (err) {
    next(err);
  }
});

router.post("/academic-years", verifyJwt, async (req, res, next) => {
  try {
    const { label, startDate, endDate, isCurrent } = req.body || {};
    if (!label || !startDate || !endDate) {
      return res.status(400).json({ error: "L'intitulé (ex: 2026-2027) et les dates de début/fin sont requis." });
    }

    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: { centerId: req.centerId },
        data: { isCurrent: false }
      });
    }

    // 1. Création de la session
    const createdYear = await prisma.academicYear.create({
      data: {
        centerId: req.centerId,
        label: label.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: Boolean(isCurrent)
      }
    });

    // 2. Découpage temporel par défaut (Semestre 1, Semestre 2, Annuel)
    const sem1End = new Date(startDate);
    sem1End.setMonth(sem1End.getMonth() + 5);

    const sem2Start = new Date(startDate);
    sem2Start.setMonth(sem2Start.getMonth() + 6);

    await prisma.gradePeriod.createMany({
      data: [
        {
          centerId: req.centerId,
          academicYearId: createdYear.id,
          type: "SEMESTRE",
          order: 1,
          label: "Semestre 1",
          startDate: new Date(startDate),
          endDate: sem1End
        },
        {
          centerId: req.centerId,
          academicYearId: createdYear.id,
          type: "SEMESTRE",
          order: 2,
          label: "Semestre 2",
          startDate: sem2Start,
          endDate: new Date(endDate)
        },
        {
          centerId: req.centerId,
          academicYearId: createdYear.id,
          type: "ANNUEL",
          order: 1,
          label: `Année ${label.trim()}`,
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        }
      ]
    });

    // 3. RÈGLE MÉTIER V2.1 : Création automatique des classes de Niveau 1 pour chaque filière
    const filieres = await prisma.filiere.findMany({
      where: { centerId: req.centerId },
      include: { niveaux: { where: { order: 1 } } }
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
            label: `${f.name} - Niveau 1 (${createdYear.label})`
          }
        });
      }
    }

    res.status(201).json(createdYear);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Une année académique porte déjà cet intitulé." });
    }
    next(err);
  }
});

router.put("/academic-years/:id/set-current", verifyJwt, async (req, res, next) => {
  try {
    await prisma.academicYear.updateMany({
      where: { centerId: req.centerId },
      data: { isCurrent: false }
    });

    await prisma.academicYear.updateMany({
      where: { id: req.params.id, centerId: req.centerId },
      data: { isCurrent: true }
    });

    const result = await prisma.academicYear.findUnique({ where: { id: req.params.id } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete("/academic-years/:id", verifyJwt, async (req, res, next) => {
  try {
    const inscriptionsCount = await prisma.inscription.count({
      where: { academicYearId: req.params.id, centerId: req.centerId }
    });
    if (inscriptionsCount > 0) {
      return res.status(409).json({ error: "Impossible de supprimer : des inscriptions existent pour cette année." });
    }

    await prisma.gradePeriod.deleteMany({ where: { academicYearId: req.params.id } });
    await prisma.classe.deleteMany({ where: { academicYearId: req.params.id } });
    await prisma.academicYear.deleteMany({ where: { id: req.params.id, centerId: req.centerId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 4. SALLES DE COURS
// ============================================================================
router.get("/salles", verifyJwt, async (req, res, next) => {
  try {
    const salles = await prisma.salle.findMany({
      where: { centerId: req.centerId },
      include: { _count: { select: { classes: true } } },
      orderBy: { name: "asc" }
    });
    res.json(salles);
  } catch (err) {
    next(err);
  }
});

router.post("/salles", verifyJwt, async (req, res, next) => {
  try {
    const { name, capacity } = req.body || {};
    if (!name) return res.status(400).json({ error: "Le nom de la salle est requis." });

    const created = await prisma.salle.create({
      data: {
        centerId: req.centerId,
        name: name.trim(),
        capacity: capacity ? parseInt(capacity) : null
      }
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put("/salles/:id", verifyJwt, async (req, res, next) => {
  try {
    const { name, capacity } = req.body || {};
    await prisma.salle.updateMany({
      where: { id: req.params.id, centerId: req.centerId },
      data: {
        ...(name && { name: name.trim() }),
        capacity: capacity !== undefined ? (capacity ? parseInt(capacity) : null) : undefined
      }
    });
    const result = await prisma.salle.findUnique({ where: { id: req.params.id } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete("/salles/:id", verifyJwt, async (req, res, next) => {
  try {
    await prisma.classe.updateMany({
      where: { salleId: req.params.id },
      data: { salleId: null }
    });
    await prisma.salle.deleteMany({ where: { id: req.params.id, centerId: req.centerId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 5. CLASSES PROMOTIONNELLES
// ============================================================================
router.get("/classes", verifyJwt, async (req, res, next) => {
  try {
    const classes = await prisma.classe.findMany({
      where: { centerId: req.centerId },
      include: {
        filiere: { include: { programType: true } },
        niveau: true,
        academicYear: true,
        salle: true,
        _count: { select: { inscriptions: true } }
      },
      orderBy: [
        { academicYear: { startDate: "desc" } },
        { filiere: { name: "asc" } },
        { niveau: { order: "asc" } }
      ]
    });
    res.json(classes);
  } catch (err) {
    next(err);
  }
});

router.post("/classes", verifyJwt, async (req, res, next) => {
  try {
    const { filiereId, niveauId, academicYearId, salleId, label } = req.body || {};

    if (!filiereId || !niveauId || !academicYearId) {
      return res.status(400).json({ error: "Filière, niveau et session académique requis." });
    }

    // Protection : impossible de créer une classe dans une année clôturée
    await ensureAcademicYearActive(academicYearId, req.centerId);

    let classLabel = label ? label.trim() : null;
    if (!classLabel) {
      const [filiere, niveau, year] = await Promise.all([
        prisma.filiere.findUnique({ where: { id: filiereId } }),
        prisma.niveau.findUnique({ where: { id: niveauId } }),
        prisma.academicYear.findUnique({ where: { id: academicYearId } })
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
        label: classLabel
      },
      include: {
        filiere: { include: { programType: true } },
        niveau: true,
        academicYear: true,
        salle: true,
        _count: { select: { inscriptions: true } }
      }
    });

    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Une classe existe déjà pour cette filière, ce niveau et cette session." });
    }
    next(err);
  }
});

router.put("/classes/:id", verifyJwt, async (req, res, next) => {
  try {
    const { salleId, label } = req.body || {};
    const existing = await prisma.classe.findFirst({
      where: { id: req.params.id, centerId: req.centerId }
    });
    if (!existing) return res.status(404).json({ error: "Classe introuvable." });

    // Protection de modification sur année clôturée
    await ensureAcademicYearActive(existing.academicYearId, req.centerId);

    await prisma.classe.update({
      where: { id: req.params.id },
      data: {
        ...(label && { label: label.trim() }),
        ...(salleId !== undefined && { salleId: salleId || null })
      }
    });

    const updated = await prisma.classe.findUnique({
      where: { id: req.params.id },
      include: {
        filiere: { include: { programType: true } },
        niveau: true,
        academicYear: true,
        salle: true,
        _count: { select: { inscriptions: true } }
      }
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/classes/:id", verifyJwt, async (req, res, next) => {
  try {
    const existing = await prisma.classe.findFirst({
      where: { id: req.params.id, centerId: req.centerId }
    });
    if (!existing) return res.status(404).json({ error: "Classe introuvable." });

    await ensureAcademicYearActive(existing.academicYearId, req.centerId);

    const inscriptionsCount = await prisma.inscription.count({
      where: { classeId: req.params.id, centerId: req.centerId }
    });
    if (inscriptionsCount > 0) {
      return res.status(409).json({ error: "Impossible de supprimer : des apprenants sont inscrits dans cette classe." });
    }

    await prisma.classe.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;