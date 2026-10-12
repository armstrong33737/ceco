// packages/backend/src/routes/examensBlancs.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { centerStoragePath, ensureStorageTree } = require("../storage/paths");
const {
  generateOfficialMockExamBorderauPdf,
  generateExaminerGradeSheetPdf,
  generateBatchExaminerGradeSheetsPdf,
  generateSessionBundleMockExamPdf,
} = require("../services/documentPdfService");

const router = express.Router();

// ============================================================================
// 1. RÉFÉRENTIEL DES ÉPREUVES D'EXAMEN BLANC (CRUD & CSV)
// ============================================================================

router.get("/mock-subjects", verifyJwt, requirePermission("formations.read", "grades.read"), async (req, res, next) => {
  try {
    const subjects = await prisma.mockSubject.findMany({
      where: { centerId: req.centerId },
      include: { _count: { select: { filiereMockSubjects: true, classeMockExamSubjects: true } } },
      orderBy: { code: "asc" },
    });
    res.json(subjects);
  } catch (err) {
    next(err);
  }
});

router.post("/mock-subjects", verifyJwt, requirePermission("formations.create"), async (req, res, next) => {
  try {
    const { code, name, defaultCoefficient } = req.body || {};
    if (!code || !name) {
      return res.status(400).json({ error: "Code et intitulé de l'épreuve requis." });
    }

    const created = await prisma.mockSubject.create({
      data: {
        centerId: req.centerId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        defaultCoefficient: defaultCoefficient ? parseFloat(defaultCoefficient) : 2.0,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Une épreuve avec ce code existe déjà." });
    }
    next(err);
  }
});

router.put("/mock-subjects/:id", verifyJwt, requirePermission("formations.update"), async (req, res, next) => {
  try {
    const { code, name, defaultCoefficient } = req.body || {};
    const updated = await prisma.mockSubject.update({
      where: { id: req.params.id },
      data: {
        ...(code && { code: code.trim().toUpperCase() }),
        ...(name && { name: name.trim() }),
        ...(defaultCoefficient && { defaultCoefficient: parseFloat(defaultCoefficient) }),
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/mock-subjects/:id", verifyJwt, requirePermission("formations.delete"), async (req, res, next) => {
  try {
    const count = await prisma.classeMockExamSubject.count({ where: { mockSubjectId: req.params.id } });
    if (count > 0) {
      return res.status(409).json({ error: `Cette épreuve est utilisée dans ${count} examen(s) blanc(s) actif(s).` });
    }
    await prisma.filiereMockSubject.deleteMany({ where: { mockSubjectId: req.params.id } });
    await prisma.mockSubject.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/mock-subjects/import", verifyJwt, requirePermission("formations.create"), async (req, res, next) => {
  try {
    const { subjects: items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Liste d'épreuves vide." });
    }

    let createdCount = 0;
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNum = i + 2;

      if (!item.code || !item.name) {
        errors.push({ row: rowNum, reason: "Code ou nom manquant" });
        continue;
      }

      const cleanCode = item.code.trim().toUpperCase();
      const exists = await prisma.mockSubject.findUnique({
        where: { centerId_code: { centerId: req.centerId, code: cleanCode } },
      });

      if (exists) {
        errors.push({ row: rowNum, reason: `Épreuve ${cleanCode} déjà existante` });
        continue;
      }

      try {
        await prisma.mockSubject.create({
          data: {
            centerId: req.centerId,
            code: cleanCode,
            name: item.name.trim(),
            defaultCoefficient: item.coefficient ? parseFloat(item.coefficient) : 2.0,
          },
        });
        createdCount++;
      } catch (err) {
        errors.push({ row: rowNum, reason: err.message });
      }
    }

    res.json({
      success: true,
      createdCount,
      totalCount: items.length,
      errors,
      message: `${createdCount} épreuve(s) d'examen blanc importée(s) avec succès.`,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 2. MAQUETTES PAR FILIÈRE (ATTRIBUTION & COEFFICIENTS PAR DÉFAUT)
// ============================================================================

router.get("/filieres/:id/mock-subjects", verifyJwt, requirePermission("formations.read"), async (req, res, next) => {
  try {
    const items = await prisma.filiereMockSubject.findMany({
      where: { filiereId: req.params.id, centerId: req.centerId },
      include: { mockSubject: true },
      orderBy: { order: "asc" },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post("/filieres/:id/mock-subjects", verifyJwt, requirePermission("formations.update"), async (req, res, next) => {
  try {
    const { mockSubjectId, coefficient, order } = req.body || {};
    if (!mockSubjectId) return res.status(400).json({ error: "Épreuve requise." });

    const count = await prisma.filiereMockSubject.count({ where: { filiereId: req.params.id } });

    const created = await prisma.filiereMockSubject.create({
      data: {
        centerId: req.centerId,
        filiereId: req.params.id,
        mockSubjectId,
        coefficient: coefficient ? parseFloat(coefficient) : 2.0,
        order: order ? parseInt(order, 10) : count + 1,
      },
      include: { mockSubject: true },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Cette épreuve fait déjà partie de la maquette de cette filière." });
    }
    next(err);
  }
});

router.delete("/filieres/mock-subjects/:id", verifyJwt, requirePermission("formations.update"), async (req, res, next) => {
  try {
    await prisma.filiereMockSubject.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 3. SESSIONS D'EXAMEN BLANC & ENRÔLEMENT DES CLASSES SORTANTES
// ============================================================================

router.get("/mock-exam-sessions", verifyJwt, requirePermission("grades.read", "formations.read"), async (req, res, next) => {
  try {
    const { academicYearId } = req.query || {};

    const where = {
      centerId: req.centerId,
      ...(academicYearId ? { academicYearId } : { academicYear: { isCurrent: true } }),
    };

    const sessions = await prisma.mockExamSession.findMany({
      where,
      include: {
        academicYear: true,
        classeMockExams: {
          include: {
            classe: { include: { filiere: { include: { programType: true } } } },
            _count: { select: { subjects: true, summaries: true } },
          },
        },
      },
      orderBy: { startDate: "desc" },
    });
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

router.post("/mock-exam-sessions", verifyJwt, requirePermission("formations.create"), async (req, res, next) => {
  try {
    const {
      title,
      academicYearId,
      startDate,
      endDate,
      targetScope = "ALL",
      manualClasseIds = [],
    } = req.body || {};

    const targetYear = academicYearId
      ? await prisma.academicYear.findFirst({ where: { id: academicYearId, centerId: req.centerId } })
      : await prisma.academicYear.findFirst({ where: { centerId: req.centerId, isCurrent: true } });

    if (!targetYear) return res.status(400).json({ error: "Aucune session académique active trouvée." });

    const sessionTitle = title?.trim() || `EXAMEN REGIONAL DU DQP BLANC, SESSION DE ${targetYear.label.split("-")[0]}`;
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    let targetClasses = [];
    if (targetScope === "MANUAL") {
      targetClasses = await prisma.classe.findMany({
        where: { id: { in: manualClasseIds }, centerId: req.centerId },
        include: { niveau: true, filiere: { include: { programType: true } } },
      });
    } else {
      const allClasses = await prisma.classe.findMany({
        where: { centerId: req.centerId, academicYearId: targetYear.id },
        include: { niveau: true, filiere: { include: { programType: true } } },
      });

      targetClasses = allClasses.filter((c) => {
        const isTerminal = c.niveau.order >= c.filiere.durationInYears;
        if (!isTerminal) return false;
        if (targetScope === "DQP") return c.filiere.programType?.code === "DQP";
        if (targetScope === "CQP") return c.filiere.programType?.code === "CQP";
        return true;
      });
    }

    const diagnosticAlerts = [];
    let totalEnrolledCandidates = 0;
    let enrolledClassesCount = 0;

    const resultSession = await prisma.$transaction(async (tx) => {
      const session = await tx.mockExamSession.create({
        data: {
          centerId: req.centerId,
          academicYearId: targetYear.id,
          title: sessionTitle,
          startDate: start,
          endDate: end,
        },
      });

      for (const cls of targetClasses) {
        const classeExam = await tx.classeMockExam.create({
          data: {
            centerId: req.centerId,
            mockExamSessionId: session.id,
            classeId: cls.id,
          },
        });
        enrolledClassesCount++;

        const templateSubjects = await tx.filiereMockSubject.findMany({
          where: { filiereId: cls.filiereId, centerId: req.centerId },
          orderBy: { order: "asc" },
        });

        if (templateSubjects.length === 0) {
          diagnosticAlerts.push(`La filière "${cls.filiere.name}" n'a pas encore de maquette d'épreuves d'examen blanc configurée.`);
        } else {
          for (const ts of templateSubjects) {
            await tx.classeMockExamSubject.create({
              data: {
                classeMockExamId: classeExam.id,
                mockSubjectId: ts.mockSubjectId,
                coefficient: ts.coefficient,
                order: ts.order,
              },
            });
          }
        }

        const countCandidates = await tx.inscription.count({
          where: { classeId: cls.id, centerId: req.centerId, student: { deletedAt: null } },
        });
        totalEnrolledCandidates += countCandidates;
      }

      return session;
    });

    res.status(201).json({
      success: true,
      session: resultSession,
      diagnostic: {
        enrolledClassesCount,
        totalEnrolledCandidates,
        targetScope,
        alerts: diagnosticAlerts,
        message: `${enrolledClassesCount} classe(s) sortante(s) enrôlée(s) automatiquement (${totalEnrolledCandidates} candidats inscrits).`,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/mock-exam-sessions/:id", verifyJwt, requirePermission("formations.delete"), async (req, res, next) => {
  try {
    const session = await prisma.mockExamSession.findFirst({ where: { id: req.params.id, centerId: req.centerId } });
    if (!session) return res.status(404).json({ error: "Session introuvable." });
    if (session.isLocked) return res.status(403).json({ error: "Impossible de supprimer une session verrouillée." });

    await prisma.mockExamSession.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 4. GESTION DES CANDIDATS (COMMUTATEUR ÉLIGIBILITÉ RETENU / DISQUALIFIÉ)
// ============================================================================

router.put("/mock-exams/classes/:classeMockExamId/candidates/:studentId/status", verifyJwt, requirePermission("grades.update"), async (req, res, next) => {
  try {
    const { classeMockExamId, studentId } = req.params;
    const { status = "RETENU" } = req.body || {}; // "RETENU" | "DISQUALIFIE" | "ABANDON"

    const classeExam = await prisma.classeMockExam.findFirst({
      where: { id: classeMockExamId, centerId: req.centerId },
    });
    if (!classeExam) return res.status(404).json({ error: "Examen de classe introuvable." });
    if (classeExam.isLocked) return res.status(403).json({ error: "Bordereau verrouillé." });

    const summary = await prisma.mockExamSummary.findUnique({
      where: { classeMockExamId_studentId: { classeMockExamId, studentId } },
    });

    const isExcluded = status === "DISQUALIFIE" || status === "ABANDON";
    const decision = isExcluded ? status : (summary?.average >= 10.0 ? "ADMIS" : "REFUSE");

    await prisma.mockExamSummary.upsert({
      where: { classeMockExamId_studentId: { classeMockExamId, studentId } },
      update: { decision },
      create: { classeMockExamId, studentId, decision, totalPoints: 0, totalCoefs: 0, average: 0 },
    });

    res.json({ success: true, studentId, status, decision });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 5. FLEXIBILITÉ POST-INSTANCIATION DES ÉPREUVES DE CLASSE
// ============================================================================

router.post("/mock-exams/classes/:classeMockExamId/subjects", verifyJwt, requirePermission("formations.update"), async (req, res, next) => {
  try {
    const { mockSubjectId, coefficient, order } = req.body || {};
    if (!mockSubjectId) return res.status(400).json({ error: "Épreuve requise." });

    const classeExam = await prisma.classeMockExam.findFirst({
      where: { id: req.params.classeMockExamId, centerId: req.centerId },
    });
    if (!classeExam) return res.status(404).json({ error: "Examen de classe introuvable." });
    if (classeExam.isLocked) return res.status(403).json({ error: "Cet examen est verrouillé." });

    const count = await prisma.classeMockExamSubject.count({ where: { classeMockExamId: classeExam.id } });

    const created = await prisma.classeMockExamSubject.create({
      data: {
        classeMockExamId: classeExam.id,
        mockSubjectId,
        coefficient: coefficient ? parseFloat(coefficient) : 2.0,
        order: order ? parseInt(order, 10) : count + 1,
      },
      include: { mockSubject: true },
    });

    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Cette épreuve est déjà affectée à cet examen de classe." });
    }
    next(err);
  }
});

router.put("/mock-exams/classes/subjects/:classeMockExamSubjectId", verifyJwt, requirePermission("formations.update"), async (req, res, next) => {
  try {
    const { coefficient, order } = req.body || {};
    const subj = await prisma.classeMockExamSubject.findUnique({
      where: { id: req.params.classeMockExamSubjectId },
      include: { classeMockExam: { include: { subjects: true, classe: { include: { inscriptions: true } } } } },
    });

    if (!subj) return res.status(404).json({ error: "Épreuve introuvable." });
    if (subj.classeMockExam.isLocked) return res.status(403).json({ error: "Cet examen est verrouillé." });

    const newCoef = coefficient ? parseFloat(coefficient) : subj.coefficient;

    await prisma.$transaction(async (tx) => {
      await tx.classeMockExamSubject.update({
        where: { id: subj.id },
        data: {
          coefficient: newCoef,
          ...(order !== undefined && { order: parseInt(order, 10) }),
        },
      });

      const existingGrades = await tx.mockExamGrade.findMany({
        where: { classeMockExamSubjectId: subj.id, isAbsent: false, score: { not: null } },
      });

      for (const g of existingGrades) {
        await tx.mockExamGrade.update({
          where: { id: g.id },
          data: { points: Number((g.score * newCoef).toFixed(2)) },
        });
      }

      const allSubjects = await tx.classeMockExamSubject.findMany({ where: { classeMockExamId: subj.classeMockExamId } });
      const allGrades = await tx.mockExamGrade.findMany({ where: { classeMockExamId: subj.classeMockExamId } });
      const studentIds = subj.classeMockExam.classe.inscriptions.map((i) => i.studentId);

      for (const stId of studentIds) {
        let sumPts = 0;
        let sumCoefs = 0;

        allSubjects.forEach((s) => {
          const coefVal = s.id === subj.id ? newCoef : s.coefficient;
          sumCoefs += coefVal;

          const gr = allGrades.find((g) => g.studentId === stId && g.classeMockExamSubjectId === s.id);
          if (gr && !gr.isAbsent && gr.score !== null) {
            sumPts += gr.score * coefVal;
          }
        });

        const avg = sumCoefs > 0 ? Number((sumPts / sumCoefs).toFixed(2)) : 0;
        const currentSummary = await tx.mockExamSummary.findUnique({
          where: { classeMockExamId_studentId: { classeMockExamId: subj.classeMockExamId, studentId: stId } },
        });

        const isExcluded = currentSummary?.decision === "DISQUALIFIE" || currentSummary?.decision === "ABANDON";
        const decision = isExcluded ? currentSummary.decision : (avg >= 10.0 ? "ADMIS" : "REFUSE");

        await tx.mockExamSummary.upsert({
          where: { classeMockExamId_studentId: { classeMockExamId: subj.classeMockExamId, studentId: stId } },
          update: { totalPoints: Number(sumPts.toFixed(2)), totalCoefs: sumCoefs, average: avg, decision },
          create: { classeMockExamId: subj.classeMockExamId, studentId: stId, totalPoints: Number(sumPts.toFixed(2)), totalCoefs: sumCoefs, average: avg, decision },
        });
      }
    });

    res.json({ success: true, message: "Coefficient mis à jour et moyennes recalculées avec succès." });
  } catch (err) {
    next(err);
  }
});

router.delete("/mock-exams/classes/subjects/:classeMockExamSubjectId", verifyJwt, requirePermission("formations.delete"), async (req, res, next) => {
  try {
    const { force = false } = req.query || {};
    const subj = await prisma.classeMockExamSubject.findUnique({
      where: { id: req.params.classeMockExamSubjectId },
      include: { classeMockExam: true },
    });

    if (!subj) return res.status(404).json({ error: "Épreuve introuvable." });
    if (subj.classeMockExam.isLocked) return res.status(403).json({ error: "Cet examen est verrouillé." });

    const notesCount = await prisma.mockExamGrade.count({
      where: { classeMockExamSubjectId: subj.id, OR: [{ score: { not: null } }, { isAbsent: true }] },
    });

    if (notesCount > 0 && force !== "true") {
      return res.status(409).json({
        requiresConfirmation: true,
        notesCount,
        message: `Attention : ${notesCount} candidat(s) possèdent déjà une note sur cette épreuve. Confirmez pour supprimer l'épreuve et recalculer les moyennes.`,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.mockExamGrade.deleteMany({ where: { classeMockExamSubjectId: subj.id } });
      await tx.classeMockExamSubject.delete({ where: { id: subj.id } });
    });

    res.json({ success: true, message: "Épreuve retirée avec succès." });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 6. SAISIE MATRICIELLE & IMPORTATION CSV DES NOTES D'ÉPREUVES
// ============================================================================

router.get("/mock-exams/classes/:classeMockExamId/grid", verifyJwt, requirePermission("grades.read"), async (req, res, next) => {
  try {
    const classeExam = await prisma.classeMockExam.findFirst({
      where: { id: req.params.classeMockExamId, centerId: req.centerId },
      include: {
        mockExamSession: { include: { academicYear: true } },
        classe: {
          include: {
            filiere: true,
            inscriptions: {
              where: { student: { deletedAt: null } },
              include: { student: true },
              orderBy: { student: { lastName: "asc" } },
            },
          },
        },
        subjects: {
          include: { mockSubject: true },
          orderBy: { order: "asc" },
        },
        grades: true,
        summaries: true,
      },
    });

    if (!classeExam) return res.status(404).json({ error: "Examen de classe introuvable." });
    res.json(classeExam);
  } catch (err) {
    next(err);
  }
});

router.post("/mock-exams/classes/:classeMockExamId/grades/batch", verifyJwt, requirePermission("grades.create", "grades.update"), async (req, res, next) => {
  try {
    const { gradesList } = req.body || {};
    if (!Array.isArray(gradesList)) {
      return res.status(400).json({ error: "Liste de notes invalide." });
    }

    const classeExam = await prisma.classeMockExam.findFirst({
      where: { id: req.params.classeMockExamId, centerId: req.centerId },
      include: {
        subjects: true,
        classe: {
          include: {
            inscriptions: {
              where: { student: { deletedAt: null } },
              select: { studentId: true },
            },
          },
        },
      },
    });

    if (!classeExam) return res.status(404).json({ error: "Examen de classe introuvable." });
    if (classeExam.isLocked) return res.status(403).json({ error: "Bordereau verrouillé." });

    const subjectsMap = new Map(classeExam.subjects.map((s) => [s.id, s.coefficient]));

    await prisma.$transaction(async (tx) => {
      for (const row of gradesList) {
        const { classeMockExamSubjectId, studentId, score, isAbsent } = row;
        const coef = subjectsMap.get(classeMockExamSubjectId) || 2.0;

        let numScore = null;
        let points = null;
        const markedAbsent = isAbsent || score === "M" || score === "m";

        if (!markedAbsent && score !== null && score !== undefined && score !== "") {
          const parsed = parseFloat(score);
          if (!isNaN(parsed)) {
            numScore = Math.max(0, Math.min(20, parsed));
            points = Number((numScore * coef).toFixed(2));
          }
        }

        await tx.mockExamGrade.upsert({
          where: {
            classeMockExamSubjectId_studentId: { classeMockExamSubjectId, studentId },
          },
          update: {
            classeMockExamId: classeExam.id,
            score: numScore,
            points: markedAbsent ? null : points,
            isAbsent: markedAbsent,
            absenceCode: markedAbsent ? "M" : null,
          },
          create: {
            classeMockExamId: classeExam.id,
            classeMockExamSubjectId,
            studentId,
            score: numScore,
            points: markedAbsent ? null : points,
            isAbsent: markedAbsent,
            absenceCode: markedAbsent ? "M" : null,
          },
        });
      }

      const studentIds = classeExam.classe.inscriptions.map((i) => i.studentId);
      const allGrades = await tx.mockExamGrade.findMany({ where: { classeMockExamId: classeExam.id } });

      for (const stId of studentIds) {
        const studentGrades = allGrades.filter((g) => g.studentId === stId);
        let sumPoints = 0;
        let sumCoefs = 0;

        classeExam.subjects.forEach((subj) => {
          const g = studentGrades.find((grade) => grade.classeMockExamSubjectId === subj.id);
          const coef = subj.coefficient;
          sumCoefs += coef;

          if (g && !g.isAbsent && g.score !== null) {
            sumPoints += g.score * coef;
          }
        });

        const finalAverage = sumCoefs > 0 ? Number((sumPoints / sumCoefs).toFixed(2)) : 0;
        const currentSummary = await tx.mockExamSummary.findUnique({
          where: { classeMockExamId_studentId: { classeMockExamId: classeExam.id, studentId: stId } },
        });

        const isExcluded = currentSummary?.decision === "DISQUALIFIE" || currentSummary?.decision === "ABANDON";
        const decision = isExcluded ? currentSummary.decision : (finalAverage >= 10.0 ? "ADMIS" : "REFUSE");

        await tx.mockExamSummary.upsert({
          where: { classeMockExamId_studentId: { classeMockExamId: classeExam.id, studentId: stId } },
          update: { totalPoints: Number(sumPoints.toFixed(2)), totalCoefs: sumCoefs, average: finalAverage, decision },
          create: { classeMockExamId: classeExam.id, studentId: stId, totalPoints: Number(sumPoints.toFixed(2)), totalCoefs: sumCoefs, average: finalAverage, decision },
        });
      }
    });

    res.json({ success: true, message: "Bordereau enregistré et moyennes finales calculées." });
  } catch (err) {
    next(err);
  }
});

// Importation directe de notes par épreuve via CSV (Matricule;Note)
router.post("/mock-exams/classes/:classeMockExamId/subjects/:classeMockExamSubjectId/import-grades", verifyJwt, requirePermission("grades.create"), async (req, res, next) => {
  try {
    const { classeMockExamId, classeMockExamSubjectId } = req.params;
    const { rows } = req.body || {}; // [{ matricule: string, score: string|number }]

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "Liste de notes CSV vide." });
    }

    const [classeExam, subj] = await Promise.all([
      prisma.classeMockExam.findFirst({
        where: { id: classeMockExamId, centerId: req.centerId },
        include: {
          classe: { include: { inscriptions: { include: { student: true } } } },
          subjects: true,
        },
      }),
      prisma.classeMockExamSubject.findUnique({ where: { id: classeMockExamSubjectId } }),
    ]);

    if (!classeExam || !subj) return res.status(404).json({ error: "Épreuve ou examen de classe introuvable." });
    if (classeExam.isLocked) return res.status(403).json({ error: "Cet examen est verrouillé." });

    const studentMap = new Map(
      classeExam.classe.inscriptions.map((i) => [i.student.matricule.trim().toUpperCase(), i.student.id])
    );

    let updatedCount = 0;
    const errors = [];

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        if (!row.matricule) continue;
        const cleanMat = row.matricule.trim().toUpperCase();
        const studentId = studentMap.get(cleanMat);

        if (!studentId) {
          errors.push({ matricule: cleanMat, reason: "Matricule non inscrit dans cette classe" });
          continue;
        }

        const rawScore = String(row.score).trim();
        const isAbsent = rawScore.toUpperCase() === "M";
        let numScore = null;
        let points = null;

        if (!isAbsent && rawScore !== "" && !isNaN(parseFloat(rawScore))) {
          numScore = Math.max(0, Math.min(20, parseFloat(rawScore)));
          points = Number((numScore * subj.coefficient).toFixed(2));
        }

        await tx.mockExamGrade.upsert({
          where: { classeMockExamSubjectId_studentId: { classeMockExamSubjectId, studentId } },
          update: {
            classeMockExamId: classeExam.id,
            score: numScore,
            points: isAbsent ? null : points,
            isAbsent,
            absenceCode: isAbsent ? "M" : null,
          },
          create: {
            classeMockExamId: classeExam.id,
            classeMockExamSubjectId,
            studentId,
            score: numScore,
            points: isAbsent ? null : points,
            isAbsent,
            absenceCode: isAbsent ? "M" : null,
          },
        });
        updatedCount++;
      }

      // Recalcul des moyennes pour tous les élèves affectés
      const allGrades = await tx.mockExamGrade.findMany({ where: { classeMockExamId: classeExam.id } });
      for (const insc of classeExam.classe.inscriptions) {
        const stId = insc.studentId;
        const stGrades = allGrades.filter((g) => g.studentId === stId);
        let sumPts = 0;
        let sumCoefs = 0;

        classeExam.subjects.forEach((s) => {
          const g = stGrades.find((grade) => grade.classeMockExamSubjectId === s.id);
          sumCoefs += s.coefficient;
          if (g && !g.isAbsent && g.score !== null) {
            sumPts += g.score * s.coefficient;
          }
        });

        const avg = sumCoefs > 0 ? Number((sumPts / sumCoefs).toFixed(2)) : 0;
        const currentSum = await tx.mockExamSummary.findUnique({
          where: { classeMockExamId_studentId: { classeMockExamId: classeExam.id, studentId: stId } },
        });

        const isExcluded = currentSum?.decision === "DISQUALIFIE" || currentSum?.decision === "ABANDON";
        const decision = isExcluded ? currentSum.decision : (avg >= 10.0 ? "ADMIS" : "REFUSE");

        await tx.mockExamSummary.upsert({
          where: { classeMockExamId_studentId: { classeMockExamId: classeExam.id, studentId: stId } },
          update: { totalPoints: Number(sumPts.toFixed(2)), totalCoefs: sumCoefs, average: avg, decision },
          create: { classeMockExamId: classeExam.id, studentId: stId, totalPoints: Number(sumPts.toFixed(2)), totalCoefs: sumCoefs, average: avg, decision },
        });
      }
    });

    res.json({
      success: true,
      updatedCount,
      errors,
      message: `${updatedCount} note(s) importée(s) et moyennes de classe recalculées.`,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/mock-exams/classes/:classeMockExamId/lock", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    const { lock = true } = req.body || {};
    await prisma.classeMockExam.update({
      where: { id: req.params.classeMockExamId },
      data: { isLocked: Boolean(lock) },
    });
    res.json({ success: true, isLocked: Boolean(lock) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 7. ÉDITION DES ACTES MINEFOP (SANS QR CODE, FORMAT DÉLÉGATION)
// ============================================================================

// Helper : composition du snapshot de classe pour bordereau MINEFOP
async function buildClasseMockExamSnapshot(centerId, classeMockExamId, isBlank = false) {
  const [center, classeExam, template] = await Promise.all([
    prisma.center.findUnique({ where: { id: centerId } }),
    prisma.classeMockExam.findFirst({
      where: { id: classeMockExamId, centerId },
      include: {
        mockExamSession: { include: { academicYear: true } },
        classe: {
          include: {
            filiere: true,
            inscriptions: {
              where: { student: { deletedAt: null } },
              include: { student: true },
              orderBy: { student: { lastName: "asc" } },
            },
          },
        },
        subjects: {
          include: { mockSubject: true },
          orderBy: { order: "asc" },
        },
        grades: true,
        summaries: true,
      },
    }),
    prisma.documentTemplate.findUnique({ where: { centerId_type: { centerId, type: "PV_EXAMEN_BLANC" } } }),
  ]);

  if (!classeExam) return null;

  const diplomas = classeExam.classe.inscriptions.map((i) => i.student.entryDiploma).filter(Boolean);
  const majorityDiploma = diplomas.length > 0 ? diplomas[0] : "BEPC";

  // Filtrage des candidats retenus (exclut les candidats explicitement disqualifiés du bordereau officiel)
  const eligibleInscriptions = isBlank
    ? classeExam.classe.inscriptions
    : classeExam.classe.inscriptions.filter((insc) => {
        const sum = classeExam.summaries.find((s) => s.studentId === insc.studentId);
        return sum?.decision !== "DISQUALIFIE";
      });

  return {
    center: { name: center.name, city: center.city },
    exam: {
      academicYearLabel: classeExam.mockExamSession.academicYear.label,
      filiereName: classeExam.classe.filiere.name,
      entryLevel: majorityDiploma,
      classeLabel: classeExam.classe.label,
    },
    epreuves: classeExam.subjects.map((s) => ({
      id: s.id,
      code: s.mockSubject.code,
      name: s.mockSubject.name,
      coefficient: s.coefficient,
    })),
    candidates: eligibleInscriptions.map((insc) => {
      const st = insc.student;
      const summary = classeExam.summaries.find((sum) => sum.studentId === st.id);
      const grades = classeExam.subjects.map((subj) => {
        const g = classeExam.grades.find((gr) => gr.studentId === st.id && gr.classeMockExamSubjectId === subj.id);
        return {
          epreuveId: subj.id,
          score: g ? (g.isAbsent ? "M" : g.score) : "—",
          isAbsent: g?.isAbsent || false,
        };
      });

      return {
        studentId: st.id,
        fullName: `${st.lastName} ${st.firstName}`,
        birthDate: st.birthDate,
        birthPlace: st.birthPlace,
        grades: isBlank ? [] : grades,
        average: isBlank ? "—" : (summary ? summary.average : 0),
        decision: summary?.decision || "REFUSE",
      };
    }),
    templateConfig: template?.config || {},
    isBlank,
  };
}

// 1. Bordereau officiel scellé de classe
router.post("/mock-exams/classes/:classeMockExamId/borderau-pdf", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    await ensureStorageTree(req.centerId);

    const snapshot = await buildClasseMockExamSnapshot(req.centerId, req.params.classeMockExamId, false);
    if (!snapshot) return res.status(404).json({ error: "Bordereau introuvable." });

    const docFolder = centerStoragePath(req.centerId, "documents", "archive", "pvs");
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const fileName = `BORDEREAU_MINEFOP_${snapshot.exam.classeLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.pdf`;
    const fullPath = path.join(docFolder, fileName);

    await generateOfficialMockExamBorderauPdf(snapshot, fullPath);

    const doc = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type: "PV_EXAMEN_BLANC",
        filePath: fullPath,
        fileHash: "OFFICIAL-MINEFOP-DOCUMENT",
        renderSnapshot: snapshot,
        qrToken: `MINEFOP-${req.params.classeMockExamId}-${Date.now()}`,
      },
    });

    res.json({
      success: true,
      previewUrl: `/documents/${doc.id}/preview`,
      downloadUrl: `/documents/${doc.id}/download`,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Bordereau vierge de synthèse de classe (pour jury plénier)
router.post("/mock-exams/classes/:classeMockExamId/blank-borderau-pdf", verifyJwt, requirePermission("grades.read"), async (req, res, next) => {
  try {
    await ensureStorageTree(req.centerId);

    const snapshot = await buildClasseMockExamSnapshot(req.centerId, req.params.classeMockExamId, true);
    if (!snapshot) return res.status(404).json({ error: "Bordereau introuvable." });

    const docFolder = centerStoragePath(req.centerId, "documents", "temp", "pvs");
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const fileName = `VIERGE_MINEFOP_${snapshot.exam.classeLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.pdf`;
    const fullPath = path.join(docFolder, fileName);

    await generateOfficialMockExamBorderauPdf(snapshot, fullPath);

    const doc = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type: "BORDEREAU_VIERGE_EXAMEN_BLANC",
        filePath: fullPath,
        fileHash: "VIERGE-MINEFOP-DOCUMENT",
        renderSnapshot: snapshot,
        qrToken: `VIERGE-MINEFOP-${req.params.classeMockExamId}-${Date.now()}`,
      },
    });

    res.json({
      success: true,
      previewUrl: `/documents/${doc.id}/preview`,
      downloadUrl: `/documents/${doc.id}/download`,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Fiche d'émargement & notation par épreuve (Examinateur en salle)
router.post("/mock-exams/classes/:classeMockExamId/subjects/:classeMockExamSubjectId/examiner-sheet-pdf", verifyJwt, requirePermission("grades.read"), async (req, res, next) => {
  try {
    await ensureStorageTree(req.centerId);

    const [center, classeExam, subj, template] = await Promise.all([
      prisma.center.findUnique({ where: { id: req.centerId } }),
      prisma.classeMockExam.findFirst({
        where: { id: req.params.classeMockExamId, centerId: req.centerId },
        include: {
          mockExamSession: { include: { academicYear: true } },
          classe: {
            include: {
              filiere: true,
              inscriptions: {
                where: { student: { deletedAt: null } },
                include: { student: true },
                orderBy: { student: { lastName: "asc" } },
              },
            },
          },
        },
      }),
      prisma.classeMockExamSubject.findUnique({
        where: { id: req.params.classeMockExamSubjectId },
        include: { mockSubject: true },
      }),
      prisma.documentTemplate.findUnique({ where: { centerId_type: { centerId: req.centerId, type: "PV_EXAMEN_BLANC" } } }),
    ]);

    if (!classeExam || !subj) return res.status(404).json({ error: "Épreuve ou classe introuvable." });

    const docFolder = centerStoragePath(req.centerId, "documents", "temp", "emargements");
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const fileName = `EMARGEMENT_${subj.mockSubject.code}_${classeExam.classe.label.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.pdf`;
    const fullPath = path.join(docFolder, fileName);

    const snapshot = {
      center: { name: center.name, city: center.city },
      exam: {
        academicYearLabel: classeExam.mockExamSession.academicYear.label,
        filiereName: classeExam.classe.filiere.name,
      },
      epreuve: {
        code: subj.mockSubject.code,
        name: subj.mockSubject.name,
        coefficient: subj.coefficient,
      },
      candidates: classeExam.classe.inscriptions.map((i) => ({
        studentId: i.student.id,
        matricule: i.student.matricule,
        fullName: `${i.student.lastName} ${i.student.firstName}`,
      })),
      templateConfig: template?.config || {},
    };

    await generateExaminerGradeSheetPdf(snapshot, fullPath);

    const doc = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type: "FICHE_EMARGEMENT_EXAMEN_BLANC",
        classeId: classeExam.classeId,
        filePath: fullPath,
        fileHash: "EMARGEMENT-MINEFOP-DOCUMENT",
        renderSnapshot: snapshot,
        qrToken: `EMARG-${subj.id}-${Date.now()}`,
      },
    });

    res.json({
      success: true,
      previewUrl: `/documents/${doc.id}/preview`,
      downloadUrl: `/documents/${doc.id}/download`,
    });
  } catch (err) {
    next(err);
  }
});

// 4. Pack complet des fiches d'émargement de la classe en 1 clic
router.post("/mock-exams/classes/:classeMockExamId/examiner-sheets-batch-pdf", verifyJwt, requirePermission("grades.read"), async (req, res, next) => {
  try {
    await ensureStorageTree(req.centerId);

    const [center, classeExam, template] = await Promise.all([
      prisma.center.findUnique({ where: { id: req.centerId } }),
      prisma.classeMockExam.findFirst({
        where: { id: req.params.classeMockExamId, centerId: req.centerId },
        include: {
          mockExamSession: { include: { academicYear: true } },
          classe: {
            include: {
              filiere: true,
              inscriptions: {
                where: { student: { deletedAt: null } },
                include: { student: true },
                orderBy: { student: { lastName: "asc" } },
              },
            },
          },
          subjects: {
            include: { mockSubject: true },
            orderBy: { order: "asc" },
          },
        },
      }),
      prisma.documentTemplate.findUnique({ where: { centerId_type: { centerId: req.centerId, type: "PV_EXAMEN_BLANC" } } }),
    ]);

    if (!classeExam || classeExam.subjects.length === 0) {
      return res.status(400).json({ error: "Aucune épreuve configurée pour cette classe." });
    }

    const docFolder = centerStoragePath(req.centerId, "documents", "temp", "emargements");
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const fileName = `PACK_EMARGEMENTS_${classeExam.classe.label.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.pdf`;
    const fullPath = path.join(docFolder, fileName);

    const snapshotsList = classeExam.subjects.map((subj) => ({
      center: { name: center.name, city: center.city },
      exam: {
        academicYearLabel: classeExam.mockExamSession.academicYear.label,
        filiereName: classeExam.classe.filiere.name,
      },
      epreuve: {
        code: subj.mockSubject.code,
        name: subj.mockSubject.name,
        coefficient: subj.coefficient,
      },
      candidates: classeExam.classe.inscriptions.map((i) => ({
        studentId: i.student.id,
        matricule: i.student.matricule,
        fullName: `${i.student.lastName} ${i.student.firstName}`,
      })),
      templateConfig: template?.config || {},
    }));

    await generateBatchExaminerGradeSheetsPdf(snapshotsList, fullPath);

    const doc = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type: "PACK_EMARGEMENTS_EXAMEN_BLANC",
        classeId: classeExam.classeId,
        filePath: fullPath,
        fileHash: "PACK-EMARGEMENTS-DOCUMENT",
        renderSnapshot: { count: snapshotsList.length, classeLabel: classeExam.classe.label },
        qrToken: `PACK-EMARG-${classeExam.id}-${Date.now()}`,
      },
    });

    res.json({
      success: true,
      previewUrl: `/documents/${doc.id}/preview`,
      downloadUrl: `/documents/${doc.id}/download`,
    });
  } catch (err) {
    next(err);
  }
});

// 5. RECUEIL UNIQUE COMPILÉ DE TOUTE LA SESSION D'EXAMEN BLANC (TOUTES CLASSES)
router.post("/mock-exam-sessions/:sessionId/bundle-borderau-pdf", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    await ensureStorageTree(req.centerId);

    const session = await prisma.mockExamSession.findFirst({
      where: { id: req.params.sessionId, centerId: req.centerId },
      include: {
        classeMockExams: {
          select: { id: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session || session.classeMockExams.length === 0) {
      return res.status(400).json({ error: "Aucune classe candidate trouvée dans cette session." });
    }

    const classesSnapshots = [];
    for (const ce of session.classeMockExams) {
      const snap = await buildClasseMockExamSnapshot(req.centerId, ce.id, false);
      if (snap && snap.candidates.length > 0) {
        classesSnapshots.push(snap);
      }
    }

    if (classesSnapshots.length === 0) {
      return res.status(400).json({ error: "Aucun candidat éligible à compiler." });
    }

    const docFolder = centerStoragePath(req.centerId, "documents", "archive", "pvs");
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const fileName = `RECUEIL_MINEFOP_${session.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.pdf`;
    const fullPath = path.join(docFolder, fileName);

    await generateSessionBundleMockExamPdf(classesSnapshots, fullPath);

    const doc = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type: "RECUEIL_EXAMEN_BLANC",
        filePath: fullPath,
        fileHash: "BUNDLE-MINEFOP-DOCUMENT",
        renderSnapshot: { sessionTitle: session.title, countClasses: classesSnapshots.length },
        qrToken: `RECUEIL-${session.id}-${Date.now()}`,
      },
    });

    res.json({
      success: true,
      previewUrl: `/documents/${doc.id}/preview`,
      downloadUrl: `/documents/${doc.id}/download`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
