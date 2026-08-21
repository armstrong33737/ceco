// packages/backend/src/routes/formations.js
const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { assertEditableAcademicYear } = require("../middleware/academicYearGuard");

const router = express.Router();

// Validation stricte du format et des dates de session
function validateAcademicYearPayload(label, startDate, endDate) {
  if (!label || !label.trim()) {
    throw new Error("L'intitulé de la session académique est obligatoire.");
  }
  const cleanLabel = label.trim();
  const labelRegex = /^\d{4}-\d{4}$/;
  if (!labelRegex.test(cleanLabel)) {
    throw new Error("L'intitulé de la session doit respecter strictement le format YYYY-YYYY (ex: 2026-2027).");
  }

  const [startYearStr, endYearStr] = cleanLabel.split("-");
  const startYearNum = parseInt(startYearStr);
  const endYearNum = parseInt(endYearStr);

  if (endYearNum !== startYearNum + 1) {
    throw new Error(`Incohérence d'intitulé : l'année de fin (${endYearNum}) doit être égale à l'année de début + 1 (ex: ${startYearNum}-${startYearNum + 1}).`);
  }

  if (!startDate || !endDate) {
    throw new Error("Les dates de début et de fin de session sont obligatoires.");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Les dates fournies sont invalides.");
  }

  if (start >= end) {
    throw new Error("La date de début de session doit être strictement antérieure à la date de fin.");
  }

  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 240) { // Moins de 8 mois (240 jours)
    const months = (diffDays / 30.44).toFixed(1);
    throw new Error(`Durée de session insuffisante : la session couvre seulement ${months} mois. Une session académique valide doit durer au minimum 8 mois (240 jours).`);
  }

  if (diffDays > 430) { // Plus de 14 mois
    throw new Error("Durée de session excessive : une session académique ne peut pas dépasser 14 mois.");
  }

  return { label: cleanLabel, startDate: start, endDate: end };
}

function computePromotionLabel(yearLabel, durationInYears) {
  const parts = yearLabel.split("-");
  const startYear = parseInt(parts[0]) || new Date().getFullYear();
  const endYear = startYear + durationInYears;
  return `Promotion ${startYear}-${endYear}`;
}

async function ensureYearGradePeriods(centerId, academicYear) {
  let periods = await prisma.gradePeriod.findMany({
    where: { centerId, academicYearId: academicYear.id },
    orderBy: { order: "asc" },
  });

  if (periods.length === 0) {
    const s1End = new Date(academicYear.startDate);
    s1End.setMonth(s1End.getMonth() + 5);
    const s2Start = new Date(academicYear.startDate);
    s2Start.setMonth(s2Start.getMonth() + 6);

    await prisma.gradePeriod.createMany({
      data: [
        { centerId, academicYearId: academicYear.id, type: "SEMESTRE", order: 1, label: "Semestre 1", startDate: new Date(academicYear.startDate), endDate: s1End },
        { centerId, academicYearId: academicYear.id, type: "SEMESTRE", order: 2, label: "Semestre 2", startDate: s2Start, endDate: new Date(academicYear.endDate) },
        { centerId, academicYearId: academicYear.id, type: "ANNUEL", order: 1, label: `Année ${academicYear.label}`, startDate: new Date(academicYear.startDate), endDate: new Date(academicYear.endDate) },
      ],
    });

    periods = await prisma.gradePeriod.findMany({
      where: { centerId, academicYearId: academicYear.id },
      orderBy: { order: "asc" },
    });
  }
  return periods;
}

// 1. CYCLES
router.get("/program-types", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
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

// 2. FILIÈRES & NIVEAUX
router.get("/filieres", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
  try {
    const filieres = await prisma.filiere.findMany({
      where: { centerId: req.centerId },
      include: {
        programType: true,
        niveaux: { orderBy: { order: "asc" } },
        _count: { select: { classes: true, promotions: true } },
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

    const currentYear = await prisma.academicYear.findFirst({ where: { centerId: req.centerId, isCurrent: true } });
    if (currentYear) {
      await ensureYearGradePeriods(req.centerId, currentYear);
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

      await prisma.promotion.create({
        data: {
          centerId: req.centerId,
          filiereId: filiere.id,
          academicYearId: currentYear.id,
          label: computePromotionLabel(currentYear.label, duration),
          expectedEndYear: String((parseInt(currentYear.label.split("-")[0]) || 2026) + duration),
        },
      });
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
    if (classesCount > 0) return res.status(409).json({ error: "Des classes actives existent pour cette filière." });
    await prisma.promotion.deleteMany({ where: { filiereId: req.params.id, centerId: req.centerId } });
    await prisma.niveau.deleteMany({ where: { filiereId: req.params.id } });
    await prisma.filiere.deleteMany({ where: { id: req.params.id, centerId: req.centerId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 3. PROMOTIONS
router.get("/promotions", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
  try {
    const promotions = await prisma.promotion.findMany({
      where: { centerId: req.centerId },
      include: {
        filiere: { include: { programType: true } },
        academicYear: true,
        _count: { select: { inscriptions: true } },
      },
      orderBy: { academicYear: { startDate: "desc" } },
    });
    res.json(promotions);
  } catch (err) {
    next(err);
  }
});

router.post("/promotions", verifyJwt, requirePermission("center.create", "center.update"), async (req, res, next) => {
  try {
    const { filiereId, academicYearId, label, expectedEndYear } = req.body || {};
    if (!filiereId || !academicYearId || !label) return res.status(400).json({ error: "Filière, session et libellé requis." });

    await assertEditableAcademicYear(academicYearId, req.centerId);

    const created = await prisma.promotion.create({
      data: {
        centerId: req.centerId,
        filiereId,
        academicYearId,
        label: label.trim(),
        expectedEndYear: expectedEndYear ? expectedEndYear.trim() : null,
      },
      include: { filiere: true, academicYear: true },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Une promotion existe déjà pour cette filière et session." });
    next(err);
  }
});

router.put("/promotions/:id", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { label, expectedEndYear } = req.body || {};
    const existing = await prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Promotion introuvable." });

    await assertEditableAcademicYear(existing.academicYearId, req.centerId);

    const updated = await prisma.promotion.update({
      where: { id: req.params.id },
      data: {
        ...(label && { label: label.trim() }),
        ...(expectedEndYear !== undefined && { expectedEndYear: expectedEndYear ? expectedEndYear.trim() : null }),
      },
      include: { filiere: true, academicYear: true, _count: { select: { inscriptions: true } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/promotions/:id", verifyJwt, requirePermission("center.delete", "center.update"), async (req, res, next) => {
  try {
    const existing = await prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Promotion introuvable." });

    await assertEditableAcademicYear(existing.academicYearId, req.centerId);

    const count = await prisma.inscription.count({ where: { promotionId: req.params.id, centerId: req.centerId } });
    if (count > 0) return res.status(409).json({ error: "Des apprenants sont rattachés à cette promotion." });
    await prisma.promotion.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 4. SESSIONS ACADÉMIQUES : VALIDATION & CASCADE DE VERROUILLAGE
router.get("/academic-years", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
  try {
    const years = await prisma.academicYear.findMany({
      where: { centerId: req.centerId },
      include: {
        gradePeriods: { orderBy: { order: "asc" } },
        _count: { select: { classes: true, inscriptions: true, promotions: true } },
      },
      orderBy: { startDate: "desc" },
    });

    for (const yr of years) {
      if (!yr.gradePeriods || yr.gradePeriods.length === 0) {
        yr.gradePeriods = await ensureYearGradePeriods(req.centerId, yr);
      }
    }

    res.json(years);
  } catch (err) {
    next(err);
  }
});

// Création d'une session avec validation stricte du format YYYY-YYYY et durée >= 8 mois
router.post("/academic-years", verifyJwt, requirePermission("center.create", "center.update"), async (req, res, next) => {
  try {
    const { label, startDate, endDate, isCurrent } = req.body || {};
    const valid = validateAcademicYearPayload(label, startDate, endDate);

    // Règle d'unicité : 1 seule session préparatoire (UPCOMING) en avance
    if (!isCurrent) {
      const existingUpcoming = await prisma.academicYear.findFirst({
        where: { centerId: req.centerId, status: "UPCOMING" },
      });
      if (existingUpcoming) {
        return res.status(409).json({
          error: `Une session préparatoire ("${existingUpcoming.label}") existe déjà. Activez-la ou clôturez-la avant d'en créer une nouvelle.`,
        });
      }
    }

    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: { centerId: req.centerId, isCurrent: true },
        data: { isCurrent: false, status: "CLOSED" },
      });
    }

    const createdYear = await prisma.academicYear.create({
      data: {
        centerId: req.centerId,
        label: valid.label,
        startDate: valid.startDate,
        endDate: valid.endDate,
        isCurrent: Boolean(isCurrent),
        status: isCurrent ? "CURRENT" : "UPCOMING",
      },
    });

    const gradePeriods = await ensureYearGradePeriods(req.centerId, createdYear);

    // Auto-création des classes Niveau 1 et Promotions
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

      await prisma.promotion.create({
        data: {
          centerId: req.centerId,
          filiereId: f.id,
          academicYearId: createdYear.id,
          label: computePromotionLabel(createdYear.label, f.durationInYears),
          expectedEndYear: String((parseInt(createdYear.label.split("-")[0]) || 2026) + f.durationInYears),
        },
      });
    }

    res.status(201).json({ ...createdYear, gradePeriods });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Cette session existe déjà." });
    next(err);
  }
});

router.put("/academic-years/:id", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { label, startDate, endDate } = req.body || {};
    const existing = await prisma.academicYear.findFirst({ where: { id: req.params.id, centerId: req.centerId } });
    if (!existing) return res.status(404).json({ error: "Session introuvable." });

    if (existing.status === "CLOSED") {
      return res.status(403).json({ error: `Impossible de modifier la session "${existing.label}" car elle est officiellement clôturée et archivée.` });
    }

    const valid = validateAcademicYearPayload(label || existing.label, startDate || existing.startDate, endDate || existing.endDate);

    const updated = await prisma.academicYear.update({
      where: { id: req.params.id },
      data: {
        label: valid.label,
        startDate: valid.startDate,
        endDate: valid.endDate,
      },
      include: { gradePeriods: { orderBy: { order: "asc" } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Activation d'une session (Interdiction de réactiver une session passée CLOSED)
router.put("/academic-years/:id/set-current", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const target = await prisma.academicYear.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
    });

    if (!target) return res.status(404).json({ error: "Session académique introuvable." });

    if (target.status === "CLOSED") {
      return res.status(403).json({
        error: `Impossible de réactiver la session passée "${target.label}". Les sessions clôturées sont des archives scellées à vie.`,
      });
    }

    await prisma.$transaction([
      prisma.academicYear.updateMany({
        where: { centerId: req.centerId, isCurrent: true },
        data: { isCurrent: false, status: "CLOSED" },
      }),
      prisma.academicYear.update({
        where: { id: target.id },
        data: { isCurrent: true, status: "CURRENT" },
      }),
    ]);

    const updated = await prisma.academicYear.findUnique({
      where: { id: target.id },
      include: { gradePeriods: { orderBy: { order: "asc" } } },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Clôture formelle d'une session avec VERROUILLAGE EN CASCADE de toutes les notes et délibérations
router.put("/academic-years/:id/close", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const year = await prisma.academicYear.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
      include: { gradePeriods: true },
    });

    if (!year) return res.status(404).json({ error: "Session introuvable." });
    if (year.status === "CLOSED") return res.status(400).json({ error: "Cette session est déjà clôturée." });

    const periodIds = year.gradePeriods.map((p) => p.id);

    await prisma.$transaction([
      // 1. Clôture de l'année
      prisma.academicYear.update({
        where: { id: year.id },
        data: { isCurrent: false, status: "CLOSED" },
      }),
      // 2. Cascade de verrouillage de toutes les notes de matière de cette session
      prisma.subjectResult.updateMany({
        where: { centerId: req.centerId, gradePeriodId: { in: periodIds } },
        data: { isLocked: true },
      }),
      // 3. Audit log
      prisma.auditLog.create({
        data: {
          centerId: req.centerId,
          userId: req.userId,
          action: "CLOSE_ACADEMIC_YEAR",
          entity: "AcademicYear",
          entityId: year.id,
          metadata: {
            yearLabel: year.label,
            lockedPeriodsCount: periodIds.length,
          },
        },
      }),
    ]);

    const updated = await prisma.academicYear.findUnique({
      where: { id: year.id },
      include: { gradePeriods: { orderBy: { order: "asc" } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/academic-years/:targetYearId/duplicate-classes", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { sourceYearId } = req.body || {};
    const { targetYearId } = req.params;

    const targetYear = await assertEditableAcademicYear(targetYearId, req.centerId);

    const sourceClasses = await prisma.classe.findMany({
      where: { academicYearId: sourceYearId, centerId: req.centerId },
      include: { niveau: true, filiere: true },
    });

    let createdCount = 0;
    for (const sc of sourceClasses) {
      const exists = await prisma.classe.findFirst({
        where: {
          centerId: req.centerId,
          filiereId: sc.filiereId,
          niveauId: sc.niveauId,
          academicYearId: targetYear.id,
        },
      });

      if (!exists) {
        await prisma.classe.create({
          data: {
            centerId: req.centerId,
            filiereId: sc.filiereId,
            niveauId: sc.niveauId,
            academicYearId: targetYear.id,
            salleId: sc.salleId,
            label: `${sc.filiere.name} - Niveau ${sc.niveau.order} (${targetYear.label})`,
          },
        });
        createdCount++;
      }
    }

    res.json({
      success: true,
      createdCount,
      message: `${createdCount} classe(s) préparée(s) pour la session ${targetYear.label}.`,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/academic-years/:newYearId/transition", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { previousYearId } = req.body || {};
    const { newYearId } = req.params;

    const newYear = await assertEditableAcademicYear(newYearId, req.centerId);
    await ensureYearGradePeriods(req.centerId, newYear);

    const previousYear = await prisma.academicYear.findFirst({
      where: { id: previousYearId, centerId: req.centerId },
      include: { gradePeriods: true },
    });

    const pastInscriptions = await prisma.inscription.findMany({
      where: { centerId: req.centerId, academicYearId: previousYearId },
      include: {
        student: true,
        promotion: true,
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

    const prevPeriodIds = previousYear?.gradePeriods?.map((p) => p.id) || [];

    await prisma.$transaction(async (tx) => {
      for (const insc of pastInscriptions) {
        const currentNiveauOrder = insc.classe.niveau.order;
        const filiere = insc.classe.filiere;

        let targetNiveauOrder = null;
        if (insc.status === "admis") {
          if (currentNiveauOrder + 1 <= filiere.durationInYears) {
            targetNiveauOrder = currentNiveauOrder + 1;
          } else {
            await tx.inscription.update({
              where: { id: insc.id },
              data: { status: "diplome" },
            });
            graduatedCount++;
          }
        } else if (insc.status === "redouble") {
          targetNiveauOrder = currentNiveauOrder;
        }

        if (targetNiveauOrder !== null) {
          const targetNiveau = filiere.niveaux.find((n) => n.order === targetNiveauOrder);
          if (targetNiveau) {
            let targetClass = await tx.classe.findFirst({
              where: {
                centerId: req.centerId,
                filiereId: filiere.id,
                niveauId: targetNiveau.id,
                academicYearId: newYear.id,
              },
            });

            if (!targetClass) {
              targetClass = await tx.classe.create({
                data: {
                  centerId: req.centerId,
                  filiereId: filiere.id,
                  niveauId: targetNiveau.id,
                  academicYearId: newYear.id,
                  label: `${filiere.name} - Niveau ${targetNiveauOrder} (${newYear.label})`,
                },
              });
            }

            const existingInsc = await tx.inscription.findUnique({
              where: {
                studentId_academicYearId: {
                  studentId: insc.studentId,
                  academicYearId: newYear.id,
                },
              },
            });

            if (!existingInsc) {
              await tx.inscription.create({
                data: {
                  centerId: req.centerId,
                  studentId: insc.studentId,
                  classeId: targetClass.id,
                  academicYearId: newYear.id,
                  promotionId: insc.promotionId,
                  status: "en_cours",
                },
              });

              if (insc.status === "admis") promotedCount++;
              if (insc.status === "redouble") repeatedCount++;
            }
          }
        }
      }

      // Clôture et verrouillage en cascade de la session précédente
      await tx.academicYear.updateMany({
        where: { id: previousYearId, centerId: req.centerId },
        data: { isCurrent: false, status: "CLOSED" },
      });

      if (prevPeriodIds.length > 0) {
        await tx.subjectResult.updateMany({
          where: { centerId: req.centerId, gradePeriodId: { in: prevPeriodIds } },
          data: { isLocked: true },
        });
      }
    });

    res.json({
      success: true,
      promotedCount,
      repeatedCount,
      graduatedCount,
      message: `Transition effectuée : ${promotedCount} admis promus en Niveau supérieur, ${repeatedCount} redoublants réinscrits, ${graduatedCount} lauréats diplômés.`,
    });
  } catch (err) {
    next(err);
  }
});

// 5. CLASSES & SALLES
router.get("/classes", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
  try {
    const classes = await prisma.classe.findMany({
      where: { centerId: req.centerId },
      include: {
        filiere: { include: { programType: true } },
        niveau: true,
        academicYear: { include: { gradePeriods: { orderBy: { order: "asc" } } } },
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

router.get("/classes/:id/students", verifyJwt, requirePermission("students.read"), async (req, res, next) => {
  try {
    const classe = await prisma.classe.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
      include: {
        filiere: { include: { programType: true } },
        niveau: true,
        academicYear: { include: { gradePeriods: { orderBy: { order: "asc" } } } },
        salle: true,
        inscriptions: {
          where: { student: { deletedAt: null } },
          include: { student: true, promotion: true },
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
    await assertEditableAcademicYear(academicYearId, req.centerId);

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

    await assertEditableAcademicYear(existing.academicYearId, req.centerId);

    const updated = await prisma.classe.update({
      where: { id: req.params.id },
      data: { ...(label && { label: label.trim() }), ...(salleId !== undefined && { salleId: salleId || null }) },
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

    await assertEditableAcademicYear(existing.academicYearId, req.centerId);

    const count = await prisma.inscription.count({ where: { classeId: req.params.id, centerId: req.centerId } });
    if (count > 0) return res.status(409).json({ error: "Des apprenants sont inscrits dans cette classe." });

    await prisma.classe.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 6. SALLES
router.get("/salles", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
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