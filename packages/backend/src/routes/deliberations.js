// packages/backend/src/routes/deliberations.js
const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { assertEditableAcademicYear } = require("../middleware/academicYearGuard");
const { computeStudentAcademicResults } = require("../services/academicCalculator");

const router = express.Router();

/**
 * 1. CONSULTATION DE LA DÉLIBÉRATION (SEMESTRIELLE OU ANNUELLE)
 * Calcule toujours en temps réel la moyenne officielle avec la formule prescrite.
 */
router.get("/deliberations", verifyJwt, requirePermission("grades.read", "formations.read"), async (req, res, next) => {
  try {
    const { classeId, gradePeriodId, scope = "ANNUEL" } = req.query || {};
    if (!classeId || !gradePeriodId) {
      return res.status(400).json({ error: "Classe et période d'évaluation requises." });
    }

    const [classe, period, existingDelib] = await Promise.all([
      prisma.classe.findFirst({
        where: { id: classeId, centerId: req.centerId },
        include: {
          filiere: { include: { programType: true } },
          niveau: true,
          academicYear: { include: { gradePeriods: true } },
          inscriptions: {
            where: { student: { deletedAt: null } },
            include: { student: true, promotion: true },
            orderBy: { student: { lastName: "asc" } },
          },
        },
      }),
      prisma.gradePeriod.findFirst({
        where: { id: gradePeriodId, centerId: req.centerId },
      }),
      prisma.deliberation.findUnique({
        where: {
          classeId_gradePeriodId_scope: {
            classeId,
            gradePeriodId,
            scope,
          },
        },
        include: { studentResults: { include: { student: true } } },
      }),
    ]);

    if (!classe) return res.status(404).json({ error: "Classe introuvable." });
    if (!period) return res.status(404).json({ error: "Période d'évaluation introuvable." });

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        classeId,
        ...(scope === "SEMESTRE" ? { gradePeriodId } : {}),
      },
      include: { subject: true, category: true, gradePeriod: true },
      orderBy: [{ gradePeriod: { order: "asc" } }, { category: { order: "asc" } }, { subject: { name: "asc" } }],
    });

    const subjectResults = await prisma.subjectResult.findMany({
      where: {
        centerId: req.centerId,
        studentId: { in: classe.inscriptions.map((i) => i.studentId) },
        subjectId: { in: offerings.map((o) => o.subjectId) },
      },
    });

    const isFinalYear = classe.niveau.order >= classe.filiere.durationInYears;
    const totalPrescribedCoeffs = offerings.reduce((sum, o) => sum + (o.coefficient || 0), 0);

    const studentsCalculation = classe.inscriptions.map((insc) => {
      const st = insc.student;
      const stExistingDelib = existingDelib?.studentResults?.find((d) => d.studentId === st.id);

      const calc = computeStudentAcademicResults({
        studentId: st.id,
        offerings,
        subjectResults,
        scope,
        isFinalYear,
        existingDecision: stExistingDelib?.decision,
      });

      return {
        ...calc,
        matricule: st.matricule,
        firstName: st.firstName,
        lastName: st.lastName,
        promotionLabel: insc.promotion?.label,
        currentInscriptionStatus: insc.status,
        rang: stExistingDelib ? stExistingDelib.rang : null,
      };
    });

    const sorted = [...studentsCalculation]
      .filter((s) => s.moyenne !== null)
      .sort((a, b) => b.moyenne - a.moyenne);

    studentsCalculation.forEach((st) => {
      if (st.moyenne !== null) {
        st.calculatedRank = sorted.findIndex((s) => s.studentId === st.studentId) + 1;
        if (!st.rang) st.rang = st.calculatedRank;
      }
    });

    res.json({
      classe: {
        id: classe.id,
        label: classe.label,
        filiereName: classe.filiere.name,
        durationInYears: classe.filiere.durationInYears,
        niveauOrder: classe.niveau.order,
        isFinalYear,
      },
      period: {
        id: period.id,
        label: period.label,
        type: period.type,
      },
      scope,
      totalPrescribedCoeffs,
      offerings,
      isDeliberated: Boolean(existingDelib),
      deliberationId: existingDelib?.id || null,
      juryDate: existingDelib?.juryDate || new Date().toISOString(),
      results: studentsCalculation,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. DÉLIBÉRATION AUTOMATIQUE D'UNE CLASSE
 */
router.post("/deliberations/auto-run", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    const { classeId, gradePeriodId, scope = "ANNUEL", juryDate } = req.body || {};
    if (!classeId || !gradePeriodId) {
      return res.status(400).json({ error: "Classe et période requises." });
    }

    const [classe, period] = await Promise.all([
      prisma.classe.findFirst({
        where: { id: classeId, centerId: req.centerId },
        include: {
          filiere: true,
          niveau: true,
          inscriptions: {
            where: { student: { deletedAt: null } },
            include: { student: true },
          },
        },
      }),
      prisma.gradePeriod.findFirst({ where: { id: gradePeriodId, centerId: req.centerId } }),
    ]);

    if (!classe) return res.status(404).json({ error: "Classe introuvable." });
    if (!period) return res.status(404).json({ error: "Période introuvable." });

    await assertEditableAcademicYear(classe.academicYearId, req.centerId);

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        classeId,
        ...(scope === "SEMESTRE" ? { gradePeriodId } : {}),
      },
      include: { category: true, subject: true },
    });

    const subjectResults = await prisma.subjectResult.findMany({
      where: {
        centerId: req.centerId,
        studentId: { in: classe.inscriptions.map((i) => i.studentId) },
        subjectId: { in: offerings.map((o) => o.subjectId) },
      },
    });

    const isFinalYear = classe.niveau.order >= classe.filiere.durationInYears;
    const finalJuryDate = juryDate ? new Date(juryDate) : new Date();

    const computedList = classe.inscriptions.map((insc) => {
      const calc = computeStudentAcademicResults({
        studentId: insc.studentId,
        offerings,
        subjectResults,
        scope,
        isFinalYear,
      });
      return {
        studentId: insc.studentId,
        moyenne: calc.computedAverage,
        hasScore: calc.totalPoints > 0,
        decision: calc.autoDecision,
      };
    });

    const ranked = [...computedList]
      .filter((s) => s.hasScore)
      .sort((a, b) => b.moyenne - a.moyenne);

    computedList.forEach((st) => {
      st.rang = st.hasScore ? ranked.findIndex((s) => s.studentId === st.studentId) + 1 : 1;
    });

    await prisma.$transaction(async (tx) => {
      const deliberation = await tx.deliberation.upsert({
        where: {
          classeId_gradePeriodId_scope: {
            classeId,
            gradePeriodId,
            scope,
          },
        },
        update: { juryDate: finalJuryDate },
        create: {
          centerId: req.centerId,
          classeId,
          gradePeriodId,
          scope,
          juryDate: finalJuryDate,
        },
      });

      await tx.studentDeliberation.deleteMany({
        where: { deliberationId: deliberation.id },
      });

      for (const item of computedList) {
        await tx.studentDeliberation.create({
          data: {
            deliberationId: deliberation.id,
            studentId: item.studentId,
            moyenne: item.moyenne,
            rang: item.rang,
            decision: item.decision,
          },
        });

        if (scope === "ANNUEL") {
          await tx.inscription.updateMany({
            where: { studentId: item.studentId, classeId, centerId: req.centerId },
            data: { status: item.decision },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          centerId: req.centerId,
          userId: req.userId,
          action: "AUTO_RUN_DELIBERATION",
          entity: "Deliberation",
          entityId: deliberation.id,
          metadata: {
            classeLabel: classe.label,
            scope,
            juryDate: finalJuryDate.toISOString(),
            studentsCount: computedList.length,
          },
        },
      });
    });

    res.json({
      success: true,
      message: `Délibération automatique calculée et scellée pour ${computedList.length} apprenant(s).`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. DÉLIBÉRATION GLOBALE DE TOUT LE CENTRE EN 1 CLIC
 */
router.post("/deliberations/center-wide-run", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    const { academicYearId, scope = "ANNUEL", semesterOrder = 1, juryDate } = req.body || {};

    const targetYear = academicYearId
      ? await prisma.academicYear.findFirst({ where: { id: academicYearId, centerId: req.centerId }, include: { gradePeriods: true } })
      : await prisma.academicYear.findFirst({ where: { centerId: req.centerId, isCurrent: true }, include: { gradePeriods: true } });

    if (!targetYear) {
      return res.status(404).json({ error: "Aucune session active trouvée." });
    }

    await assertEditableAcademicYear(targetYear.id, req.centerId);

    const targetPeriod = scope === "ANNUEL"
      ? targetYear.gradePeriods.find((p) => p.type === "ANNUEL")
      : targetYear.gradePeriods.find((p) => p.type === "SEMESTRE" && p.order === parseInt(semesterOrder, 10));

    if (!targetPeriod) {
      return res.status(400).json({ error: "Période d'évaluation introuvable pour cette session." });
    }

    const classes = await prisma.classe.findMany({
      where: { centerId: req.centerId, academicYearId: targetYear.id },
      include: {
        filiere: true,
        niveau: true,
        inscriptions: {
          where: { student: { deletedAt: null } },
          include: { student: true },
        },
        subjectOfferings: {
          where: scope === "SEMESTRE" ? { gradePeriodId: targetPeriod.id } : {},
          include: { category: true, subject: true },
        },
      },
    });

    if (classes.length === 0) {
      return res.status(400).json({ error: "Aucune classe active trouvée pour cette session." });
    }

    const finalJuryDate = juryDate ? new Date(juryDate) : new Date();

    let totalStudentsDeliberated = 0;
    let totalAdmis = 0;
    let totalDiplomes = 0;
    let totalAjournes = 0;
    let totalRedoublants = 0;

    await prisma.$transaction(async (tx) => {
      for (const classe of classes) {
        const isFinalYear = classe.niveau.order >= classe.filiere.durationInYears;
        const offerings = classe.subjectOfferings;
        const studentIds = classe.inscriptions.map((i) => i.studentId);

        const subjectResults = await tx.subjectResult.findMany({
          where: {
            centerId: req.centerId,
            studentId: { in: studentIds },
            subjectId: { in: offerings.map((o) => o.subjectId) },
          },
        });

        const computedStudents = classe.inscriptions.map((insc) => {
          const calc = computeStudentAcademicResults({
            studentId: insc.studentId,
            offerings,
            subjectResults,
            scope,
            isFinalYear,
          });

          if (calc.autoDecision === "admis" || calc.autoDecision === "valide") totalAdmis++;
          else if (calc.autoDecision === "diplome") totalDiplomes++;
          else if (calc.autoDecision === "redouble") totalRedoublants++;
          else totalAjournes++;

          totalStudentsDeliberated++;

          return {
            studentId: insc.studentId,
            moyenne: calc.computedAverage,
            hasScore: calc.totalPoints > 0,
            decision: calc.autoDecision,
          };
        });

        const ranked = [...computedStudents]
          .filter((s) => s.hasScore)
          .sort((a, b) => b.moyenne - a.moyenne);

        computedStudents.forEach((st) => {
          st.rang = st.hasScore ? ranked.findIndex((s) => s.studentId === st.studentId) + 1 : 1;
        });

        const deliberation = await tx.deliberation.upsert({
          where: {
            classeId_gradePeriodId_scope: {
              classeId: classe.id,
              gradePeriodId: targetPeriod.id,
              scope,
            },
          },
          update: { juryDate: finalJuryDate },
          create: {
            centerId: req.centerId,
            classeId: classe.id,
            gradePeriodId: targetPeriod.id,
            scope,
            juryDate: finalJuryDate,
          },
        });

        await tx.studentDeliberation.deleteMany({
          where: { deliberationId: deliberation.id },
        });

        for (const item of computedStudents) {
          await tx.studentDeliberation.create({
            data: {
              deliberationId: deliberation.id,
              studentId: item.studentId,
              moyenne: item.moyenne,
              rang: item.rang,
              decision: item.decision,
            },
          });

          if (scope === "ANNUEL") {
            await tx.inscription.updateMany({
              where: { studentId: item.studentId, classeId: classe.id, centerId: req.centerId },
              data: { status: item.decision },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          centerId: req.centerId,
          userId: req.userId,
          action: "CENTER_WIDE_DELIBERATION",
          entity: "AcademicYear",
          entityId: targetYear.id,
          metadata: {
            yearLabel: targetYear.label,
            scope,
            totalClasses: classes.length,
            totalStudents: totalStudentsDeliberated,
            totalAdmis,
            totalDiplomes,
            totalRedoublants,
            totalAjournes,
          },
        },
      });
    });

    res.json({
      success: true,
      message: `Délibération globale terminée pour la session ${targetYear.label}.`,
      report: {
        totalClasses: classes.length,
        totalStudents: totalStudentsDeliberated,
        totalAdmis,
        totalDiplomes,
        totalRedoublants,
        totalAjournes,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. SAUVEGARDE DE LA DÉLIBÉRATION MANUELLE SOUVERAINE (« VALIDER & SCELLER »)
 * Calcule avec rigueur la moyenne sur les coefficients prescrits de la classe
 * tout en respectant l'arbitrage souverain de la décision accordée par le jury.
 */
router.post("/deliberations/run", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    const { classeId, gradePeriodId, scope = "ANNUEL", juryDate, results } = req.body || {};
    if (!classeId || !gradePeriodId || !Array.isArray(results)) {
      return res.status(400).json({ error: "Données de délibération incomplètes." });
    }

    const classe = await prisma.classe.findFirst({
      where: { id: classeId, centerId: req.centerId },
      include: { niveau: true, filiere: true },
    });
    if (!classe) return res.status(404).json({ error: "Classe introuvable." });

    await assertEditableAcademicYear(classe.academicYearId, req.centerId);

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        classeId,
        ...(scope === "SEMESTRE" ? { gradePeriodId } : {}),
      },
      include: { category: true, subject: true },
    });

    const subjectResults = await prisma.subjectResult.findMany({
      where: {
        centerId: req.centerId,
        studentId: { in: results.map((r) => r.studentId) },
        subjectId: { in: offerings.map((o) => o.subjectId) },
      },
    });

    const isFinalYear = classe.niveau.order >= classe.filiere.durationInYears;
    const finalJuryDate = juryDate ? new Date(juryDate) : new Date();

    // Recalcul souverain partagé
    const sanitizedResults = results.map((resItem) => {
      const calc = computeStudentAcademicResults({
        studentId: resItem.studentId,
        offerings,
        subjectResults,
        scope,
        isFinalYear,
      });

      return {
        studentId: resItem.studentId,
        // La moyenne est garantie rigoureusement identique à la délibération globale
        moyenne: calc.computedAverage,
        rang: resItem.rang ? parseInt(resItem.rang, 10) : 1,
        // La décision respecte l'arbitrage humain du jury (repêchage, grâce...)
        decision: resItem.decision || calc.autoDecision,
      };
    });

    await prisma.$transaction(async (tx) => {
      const deliberation = await tx.deliberation.upsert({
        where: {
          classeId_gradePeriodId_scope: {
            classeId,
            gradePeriodId,
            scope,
          },
        },
        update: { juryDate: finalJuryDate },
        create: {
          centerId: req.centerId,
          classeId,
          gradePeriodId,
          scope,
          juryDate: finalJuryDate,
        },
      });

      await tx.studentDeliberation.deleteMany({
        where: { deliberationId: deliberation.id },
      });

      for (const resItem of sanitizedResults) {
        await tx.studentDeliberation.create({
          data: {
            deliberationId: deliberation.id,
            studentId: resItem.studentId,
            moyenne: resItem.moyenne,
            rang: resItem.rang,
            decision: resItem.decision,
          },
        });

        if (scope === "ANNUEL") {
          await tx.inscription.updateMany({
            where: { studentId: resItem.studentId, classeId, centerId: req.centerId },
            data: { status: resItem.decision },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          centerId: req.centerId,
          userId: req.userId,
          action: "MANUAL_DELIBERATION_SAVE",
          entity: "Deliberation",
          entityId: deliberation.id,
          metadata: {
            classeLabel: classe.label,
            scope,
            juryDate: finalJuryDate.toISOString(),
            studentsCount: sanitizedResults.length,
          },
        },
      });
    });

    res.json({
      success: true,
      message: `Délibération souveraine enregistrée : moyennes recalculées avec exactitude sur les coefficients prescrits (${offerings.reduce((s, o) => s + o.coefficient, 0)} coefs).`,
      results: sanitizedResults,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;