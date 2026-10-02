// packages/backend/src/routes/grades.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { centerStoragePath, ensureStorageTree } = require("../storage/paths");
const { assertActiveAcademicYear, assertEditableAcademicYear } = require("../middleware/academicYearGuard");
const { getDefaultSealBase64 } = require("../storage/defaultSeal");
const {
  generateBlankGradeSheetPdf,
  generateCertifiedGradeSheetPdf,
  generateClassSemesterSummaryPdf,
  generateClassContinuousAssessmentSummaryPdf,
} = require("../services/documentPdfService");

const router = express.Router();

function getCenterLogoBase64(centerId, logoExt) {
  if (!logoExt) return null;
  const logoPath = path.join(centerStoragePath(centerId, "settings/branding"), `logo.${logoExt}`);
  if (fs.existsSync(logoPath)) {
    const ext = logoExt.toLowerCase();
    const mime = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${fs.readFileSync(logoPath).toString("base64")}`;
  }
  return null;
}

function getCenterSealBase64(centerId) {
  const brandingDir = centerStoragePath(centerId, "settings/branding");
  if (fs.existsSync(brandingDir)) {
    const files = fs.readdirSync(brandingDir);
    const sealFile = files.find((f) => f.startsWith("seal."));
    if (sealFile) {
      const ext = path.extname(sealFile).replace(".", "").toLowerCase();
      const mime = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : "image/jpeg";
      return `data:${mime};base64,${fs.readFileSync(path.join(brandingDir, sealFile)).toString("base64")}`;
    }
  }
  return getDefaultSealBase64();
}

function getRoleSignatureBase64(centerId, roleKey) {
  if (!roleKey) return null;
  const safeKey = roleKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const sigPath = path.join(centerStoragePath(centerId, "settings/signatures"), `${safeKey}.png`);
  if (fs.existsSync(sigPath)) {
    return `data:image/png;base64,${fs.readFileSync(sigPath).toString("base64")}`;
  }
  return null;
}

async function getConnectedFormateur(req) {
  if (!req.userId) return null;
  return prisma.formateur.findFirst({
    where: { centerId: req.centerId, userId: req.userId },
  });
}

// 1. Grille de Saisie Matricielle avec Scoping & Sanitisation
router.get("/grades/grid", verifyJwt, requirePermission("grades.read", "grades.create"), async (req, res, next) => {
  try {
    const { offeringId, classeId, gradePeriodId, subjectId } = req.query || {};

    let offering = null;
    if (offeringId) {
      offering = await prisma.subjectOffering.findUnique({
        where: { id: offeringId },
        include: {
          subject: true,
          category: true,
          gradePeriod: { include: { academicYear: true } },
          formateur: true,
          classe: {
            include: {
              filiere: true,
              inscriptions: {
                where: { student: { deletedAt: null } },
                include: { student: true, promotion: true },
                orderBy: { student: { lastName: "asc" } },
              },
            },
          },
        },
      });
    } else if (classeId && gradePeriodId && subjectId) {
      offering = await prisma.subjectOffering.findUnique({
        where: {
          subjectId_classeId_gradePeriodId: {
            subjectId,
            classeId,
            gradePeriodId,
          },
        },
        include: {
          subject: true,
          category: true,
          gradePeriod: { include: { academicYear: true } },
          formateur: true,
          classe: {
            include: {
              filiere: true,
              inscriptions: {
                where: { student: { deletedAt: null } },
                include: { student: true, promotion: true },
                orderBy: { student: { lastName: "asc" } },
              },
            },
          },
        },
      });
    }

    if (!offering) return res.status(404).json({ error: "Cours sélectionné introuvable pour cette classe et ce semestre." });

    // Sécurité Enseignant : Un formateur ne peut consulter que ses propres cours
    const connectedFormateur = await getConnectedFormateur(req);
    if (connectedFormateur && offering.formateurId && offering.formateurId !== connectedFormateur.id) {
      return res.status(403).json({ error: "Accès refusé : vous n'êtes pas l'enseignant assigné à ce cours." });
    }

    const [grades, results, policy] = await Promise.all([
      prisma.grade.findMany({
        where: { subjectOfferingId: offering.id, centerId: req.centerId },
      }),
      prisma.subjectResult.findMany({
        where: {
          subjectId: offering.subjectId,
          gradePeriodId: offering.gradePeriodId,
          centerId: req.centerId,
        },
      }),
      prisma.gradingPolicy.findFirst({
        where: { centerId: req.centerId, OR: [{ filiereId: offering.classe.filiereId }, { filiereId: null }] },
        orderBy: { effectiveFrom: "desc" },
      }),
    ]);

    res.json({
      offering: {
        id: offering.id,
        coefficient: offering.coefficient,
        volumeHoraire: offering.volumeHoraire,
        subject: offering.subject,
        category: offering.category,
        gradePeriod: offering.gradePeriod,
        formateur: offering.formateur,
        classe: {
          id: offering.classe.id,
          label: offering.classe.label,
          filiere: offering.classe.filiere,
          academicYearId: offering.classe.academicYearId,
          isCurrentSession: offering.gradePeriod.academicYear?.isCurrent || false,
        },
      },
      // Sanitisation : transmission exclusive des champs nécessaires à l'évaluation
      students: offering.classe.inscriptions.map((i) => ({
        id: i.student.id,
        matricule: i.student.matricule,
        firstName: i.student.firstName,
        lastName: i.student.lastName,
        gender: i.student.gender,
        promotionLabel: i.promotion?.label,
      })),
      grades,
      results,
      gradingPolicy: policy || { ccWeight: 0.30, normalWeight: 0.70 },
      isLocked: results.some((r) => r.isLocked),
    });
  } catch (err) {
    next(err);
  }
});

// 2. Enregistrement transactionnel des notes
router.post("/grades/batch", verifyJwt, requirePermission("grades.create", "grades.update"), async (req, res, next) => {
  try {
    const { offeringId, gradesList } = req.body || {};
    if (!offeringId || !Array.isArray(gradesList)) {
      return res.status(400).json({ error: "Données de bordereau invalides." });
    }

    const offering = await prisma.subjectOffering.findUnique({
      where: { id: offeringId },
      include: { gradePeriod: { include: { academicYear: true } }, classe: true },
    });
    if (!offering) return res.status(404).json({ error: "Cours introuvable." });

    // Garde-fou session close
    const yearId = offering.classe.academicYearId || offering.gradePeriod.academicYearId;
    await assertActiveAcademicYear(yearId, req.centerId);

    // Contrôle d'accès formateur
    const connectedFormateur = await getConnectedFormateur(req);
    if (connectedFormateur && offering.formateurId && offering.formateurId !== connectedFormateur.id) {
      return res.status(403).json({ error: "Accès refusé : vous n'êtes pas l'enseignant assigné à ce cours." });
    }

    // Vérification du verrouillage
    const lockedCount = await prisma.subjectResult.count({
      where: {
        subjectId: offering.subjectId,
        gradePeriodId: offering.gradePeriodId,
        centerId: req.centerId,
        isLocked: true,
      },
    });
    if (lockedCount > 0) {
      return res.status(403).json({ error: "Les notes de ce cours sont officiellement verrouillées par la direction." });
    }

    const policy = await prisma.gradingPolicy.findFirst({
      where: { centerId: req.centerId, OR: [{ filiereId: offering.classe.filiereId }, { filiereId: null }] },
      orderBy: { effectiveFrom: "desc" },
    });
    const ccWeight = policy?.ccWeight || 0.30;
    const normalWeight = policy?.normalWeight || 0.70;

    await prisma.$transaction(async (tx) => {
      for (const item of gradesList) {
        const {
          studentId,
          cc1, cc2,
          cc1Absent, cc1AbsenceReason,
          cc2Absent, cc2AbsenceReason,
          normale, normaleAbsent, normaleAbsenceReason,
          rattrapage, rattrapageAbsent,
        } = item;

        await tx.grade.deleteMany({
          where: { studentId, subjectOfferingId: offering.id, centerId: req.centerId },
        });

        const validCcScores = [];

        // CC1
        if (cc1Absent) {
          await tx.grade.create({
            data: {
              centerId: req.centerId,
              studentId,
              subjectOfferingId: offering.id,
              gradePeriodId: offering.gradePeriodId,
              evaluationType: "CC_TP",
              label: "CC1",
              value: 0.0,
              isAbsent: true,
              absenceReason: cc1AbsenceReason || "UNJUSTIFIED",
            },
          });
          if (cc1AbsenceReason === "UNJUSTIFIED") validCcScores.push(0.0);
        } else if (cc1 !== null && cc1 !== undefined && cc1 !== "") {
          const val = Math.max(0, Math.min(20, parseFloat(cc1)));
          await tx.grade.create({
            data: {
              centerId: req.centerId,
              studentId,
              subjectOfferingId: offering.id,
              gradePeriodId: offering.gradePeriodId,
              evaluationType: "CC_TP",
              label: "CC1",
              value: val,
              isAbsent: false,
            },
          });
          validCcScores.push(val);
        }

        // CC2
        if (cc2Absent) {
          await tx.grade.create({
            data: {
              centerId: req.centerId,
              studentId,
              subjectOfferingId: offering.id,
              gradePeriodId: offering.gradePeriodId,
              evaluationType: "CC_TP",
              label: "CC2",
              value: 0.0,
              isAbsent: true,
              absenceReason: cc2AbsenceReason || "UNJUSTIFIED",
            },
          });
          if (cc2AbsenceReason === "UNJUSTIFIED") validCcScores.push(0.0);
        } else if (cc2 !== null && cc2 !== undefined && cc2 !== "") {
          const val = Math.max(0, Math.min(20, parseFloat(cc2)));
          await tx.grade.create({
            data: {
              centerId: req.centerId,
              studentId,
              subjectOfferingId: offering.id,
              gradePeriodId: offering.gradePeriodId,
              evaluationType: "CC_TP",
              label: "CC2",
              value: val,
              isAbsent: false,
            },
          });
          validCcScores.push(val);
        }

        // Examen Session Normale
        let examScore = null;
        if (normaleAbsent) {
          await tx.grade.create({
            data: {
              centerId: req.centerId,
              studentId,
              subjectOfferingId: offering.id,
              gradePeriodId: offering.gradePeriodId,
              evaluationType: "NORMALE",
              label: "Examen Final",
              value: 0.0,
              isAbsent: true,
              absenceReason: normaleAbsenceReason || "UNJUSTIFIED",
            },
          });
          if (normaleAbsenceReason === "UNJUSTIFIED") examScore = 0.0;
        } else if (normale !== null && normale !== undefined && normale !== "") {
          examScore = Math.max(0, Math.min(20, parseFloat(normale)));
          await tx.grade.create({
            data: {
              centerId: req.centerId,
              studentId,
              subjectOfferingId: offering.id,
              gradePeriodId: offering.gradePeriodId,
              evaluationType: "NORMALE",
              label: "Examen Final",
              value: examScore,
              isAbsent: false,
            },
          });
        }

        // Session de Rattrapage
        if (rattrapage !== null && rattrapage !== undefined && rattrapage !== "" && !rattrapageAbsent) {
          const rattVal = Math.max(0, Math.min(20, parseFloat(rattrapage)));
          await tx.grade.create({
            data: {
              centerId: req.centerId,
              studentId,
              subjectOfferingId: offering.id,
              gradePeriodId: offering.gradePeriodId,
              evaluationType: "RATTRAPAGE",
              label: "Rattrapage",
              value: rattVal,
              isAbsent: false,
            },
          });
          if (examScore === null || rattVal > examScore) {
            examScore = rattVal;
          }
        }

        // Calcul automatique SubjectResult
        const ccAverage = validCcScores.length > 0
          ? Number((validCcScores.reduce((a, b) => a + b, 0) / validCcScores.length).toFixed(2))
          : null;

        let finalGrade = null;
        if (ccAverage !== null && examScore !== null) {
          finalGrade = Number(((ccAverage * ccWeight) + (examScore * normalWeight)).toFixed(2));
        } else if (examScore !== null) {
          finalGrade = Number(examScore.toFixed(2));
        } else if (ccAverage !== null) {
          finalGrade = Number(ccAverage.toFixed(2));
        }

        if (finalGrade !== null) {
          await tx.subjectResult.upsert({
            where: {
              studentId_subjectId_gradePeriodId: {
                studentId,
                subjectId: offering.subjectId,
                gradePeriodId: offering.gradePeriodId,
              },
            },
            update: {
              ccAverage,
              normalAverage: examScore,
              ccWeight,
              normalWeight,
              coefficient: offering.coefficient,
              finalGrade,
              computedAt: new Date(),
            },
            create: {
              centerId: req.centerId,
              studentId,
              subjectId: offering.subjectId,
              gradePeriodId: offering.gradePeriodId,
              computationMode: "CC_NORMALE",
              ccAverage,
              normalAverage: examScore,
              ccWeight,
              normalWeight,
              coefficient: offering.coefficient,
              finalGrade,
            },
          });
        }
      }
    });

    res.json({ success: true, message: "Bordereau enregistré et moyennes calculées avec succès." });
  } catch (err) {
    next(err);
  }
});

// 3. Verrouillage Officiel par la Direction
router.post("/grades/lock", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    const { offeringId } = req.body || {};
    const offering = await prisma.subjectOffering.findUnique({ where: { id: offeringId } });
    if (!offering) return res.status(404).json({ error: "Cours introuvable." });

    await prisma.subjectResult.updateMany({
      where: {
        subjectId: offering.subjectId,
        gradePeriodId: offering.gradePeriodId,
        centerId: req.centerId,
      },
      data: { isLocked: true },
    });

    res.json({ success: true, isLocked: true, message: "Bordereau de notes officiellement verrouillé." });
  } catch (err) {
    next(err);
  }
});

// 4. Déverrouillage d'urgence tracé dans AuditLog
router.post("/grades/unlock", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { offeringId, reason } = req.body || {};
    const offering = await prisma.subjectOffering.findUnique({
      where: { id: offeringId },
      include: { subject: true, classe: { include: { academicYear: true } } },
    });
    if (!offering) return res.status(404).json({ error: "Cours introuvable." });

    if (offering.classe.academicYear?.status === "CLOSED" || (!offering.classe.academicYear?.isCurrent && offering.classe.academicYear?.status !== "UPCOMING")) {
      return res.status(403).json({
        error: `Opération refusée : la session "${offering.classe.academicYear?.label}" est officiellement clôturée. Aucun déverrouillage n'est autorisé sur les archives historiques.`,
      });
    }

    await prisma.$transaction([
      prisma.subjectResult.updateMany({
        where: {
          subjectId: offering.subjectId,
          gradePeriodId: offering.gradePeriodId,
          centerId: req.centerId,
        },
        data: { isLocked: false },
      }),
      prisma.auditLog.create({
        data: {
          centerId: req.centerId,
          userId: req.userId,
          action: "UNLOCK_GRADES",
          entity: "SubjectOffering",
          entityId: offering.id,
          metadata: {
            subjectName: offering.subject.name,
            classeLabel: offering.classe.label,
            reason: reason || "Déverrouillage exceptionnel par la direction",
          },
        },
      }),
    ]);

    res.json({ success: true, isLocked: false, message: "Bordereau déverrouillé et consigné dans le journal d'audit." });
  } catch (err) {
    next(err);
  }
});

// 5. Bordereau Vierge PDF
router.post("/grades/offerings/:offeringId/blank-sheet", verifyJwt, requirePermission("grades.read"), async (req, res, next) => {
  try {
    const { offeringId } = req.params;
    const { forceRegenerate = false } = req.body || {};
    await ensureStorageTree(req.centerId);

    const [offering, center, template] = await Promise.all([
      prisma.subjectOffering.findUnique({
        where: { id: offeringId },
        include: {
          subject: true,
          category: true,
          gradePeriod: { include: { academicYear: true } },
          formateur: true,
          classe: {
            include: {
              inscriptions: {
                where: { student: { deletedAt: null } },
                include: { student: true },
                orderBy: { student: { lastName: "asc" } },
              },
            },
          },
        },
      }),
      prisma.center.findUnique({ where: { id: req.centerId } }),
      prisma.documentTemplate.findUnique({ where: { centerId_type: { centerId: req.centerId, type: "BORDEREAU_VIERGE" } } }),
    ]);

    if (!offering) return res.status(404).json({ error: "Cours introuvable." });

    const qrTokenKey = `BLANK-${offering.id}`;
    const existingDoc = await prisma.document.findFirst({
      where: { centerId: req.centerId, qrToken: { startsWith: qrTokenKey } },
      orderBy: { generatedAt: "desc" },
    });

    if (!forceRegenerate && existingDoc && fs.existsSync(existingDoc.filePath)) {
      return res.json({
        success: true,
        reused: true,
        previewUrl: `/documents/${existingDoc.id}/preview`,
        downloadUrl: `/documents/${existingDoc.id}/download`,
      });
    }

    const yearFolder = (offering.gradePeriod.academicYear?.label || "current").replace(/[^a-zA-Z0-9_-]/g, "_");
    const docFolder = centerStoragePath(req.centerId, "documents", yearFolder, "pvs");
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const fileName = `VIERGE_${offering.subject.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${offering.id.substring(0, 6)}.pdf`;
    const fullPath = path.join(docFolder, fileName);

    const snapshot = {
      center: {
        name: center.name,
        registrationNumber: center.registrationNumber,
        city: center.city,
        logoDataUrl: getCenterLogoBase64(req.centerId, center.logo),
        sealDataUrl: getCenterSealBase64(req.centerId),
      },
      offering: {
        classeLabel: offering.classe.label,
        subjectName: offering.subject.name,
        categoryName: offering.category?.name,
        semesterLabel: offering.gradePeriod.label,
        coefficient: offering.coefficient,
        volumeHoraire: offering.volumeHoraire,
        formateurName: offering.formateur ? `${offering.formateur.firstName} ${offering.formateur.lastName}` : null,
      },
      students: offering.classe.inscriptions.map((i) => i.student),
      templateConfig: template?.config || { primaryColor: "#071A2E" },
    };

    await generateBlankGradeSheetPdf(snapshot, fullPath);

    const doc = await prisma.document.upsert({
      where: { qrToken: qrTokenKey },
      update: {
        filePath: fullPath,
        fileHash: crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex"),
        renderSnapshot: snapshot,
        generatedAt: new Date(),
      },
      create: {
        centerId: req.centerId,
        type: "BORDEREAU_VIERGE",
        classeId: offering.classeId,
        filePath: fullPath,
        fileHash: crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex"),
        renderSnapshot: snapshot,
        qrToken: qrTokenKey,
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

// 6. Bordereau Officiel Certifié Scellé par QR Code (PV_MATIERE)
router.post("/grades/offerings/:offeringId/certified-sheet", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    const { offeringId } = req.params;
    const { forceRegenerate = false } = req.body || {};
    await ensureStorageTree(req.centerId);

    const [center, offering, grades, results, template] = await Promise.all([
      prisma.center.findUnique({ where: { id: req.centerId } }),
      prisma.subjectOffering.findUnique({
        where: { id: offeringId },
        include: {
          subject: true,
          category: true,
          gradePeriod: { include: { academicYear: true } },
          formateur: true,
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
      prisma.grade.findMany({ where: { subjectOfferingId: offeringId, centerId: req.centerId } }),
      prisma.subjectResult.findMany({ where: { subjectId: (await prisma.subjectOffering.findUnique({ where: { id: offeringId } }))?.subjectId, centerId: req.centerId } }),
      prisma.documentTemplate.findUnique({ where: { centerId_type: { centerId: req.centerId, type: "PV_MATIERE" } } }),
    ]);

    if (!offering) return res.status(404).json({ error: "Cours introuvable." });

    const docType = "PV_MATIERE";
    const existingDoc = await prisma.document.findFirst({
      where: { centerId: req.centerId, type: docType, classeId: offering.classeId, qrToken: { contains: offering.id } },
      orderBy: { generatedAt: "desc" },
    });

    if (!forceRegenerate && existingDoc && fs.existsSync(existingDoc.filePath)) {
      return res.json({
        success: true,
        reused: true,
        previewUrl: `/documents/${existingDoc.id}/preview`,
        downloadUrl: `/documents/${existingDoc.id}/download`,
      });
    }

    const cuid = crypto.randomBytes(8).toString("hex");
    const hmacSig = crypto.createHmac("sha256", process.env.JWT_SECRET || "ceco_key").update(`${cuid}:${offering.id}`).digest("hex").slice(0, 16);
    const qrToken = `${cuid}?t=${hmacSig}&off=${offering.id}`;
    const verificationUrl = `${req.protocol}://${req.get("host")}/verify/${qrToken}`;

    const rows = offering.classe.inscriptions.map((insc) => {
      const st = insc.student;
      const stGrades = grades.filter((g) => g.studentId === st.id);
      const stRes = results.find((r) => r.studentId === st.id && r.gradePeriodId === offering.gradePeriodId);

      const gCc1 = stGrades.find((g) => g.label === "CC1");
      const gCc2 = stGrades.find((g) => g.label === "CC2");
      const gNorm = stGrades.find((g) => g.evaluationType === "NORMALE");
      const gRatt = stGrades.find((g) => g.evaluationType === "RATTRAPAGE");

      return {
        matricule: st.matricule,
        fullName: `${st.lastName} ${st.firstName}`,
        cc1: gCc1 ? (gCc1.isAbsent ? `ABS (${gCc1.absenceReason === "JUSTIFIED" ? "Justifiée" : "0.00"})` : gCc1.value.toFixed(2)) : "—",
        cc2: gCc2 ? (gCc2.isAbsent ? `ABS (${gCc2.absenceReason === "JUSTIFIED" ? "Justifiée" : "0.00"})` : gCc2.value.toFixed(2)) : "—",
        ccAvg: stRes?.ccAverage !== null && stRes?.ccAverage !== undefined ? stRes.ccAverage.toFixed(2) : "—",
        normale: gNorm ? (gNorm.isAbsent ? `ABS (${gNorm.absenceReason === "JUSTIFIED" ? "Justifiée" : "0.00"})` : gNorm.value.toFixed(2)) : "—",
        rattrapage: gRatt ? gRatt.value.toFixed(2) : "—",
        finalGrade: stRes?.finalGrade !== null && stRes?.finalGrade !== undefined ? stRes.finalGrade.toFixed(2) : "—",
        isValid: stRes ? stRes.finalGrade >= 10.0 : false,
      };
    });

    const evaluatedRows = rows.filter((r) => r.finalGrade !== "—");
    const passedCount = evaluatedRows.filter((r) => r.isValid).length;
    const stats = {
      total: rows.length,
      evaluated: evaluatedRows.length,
      passed: passedCount,
      failed: evaluatedRows.length - passedCount,
      successRate: evaluatedRows.length > 0 ? ((passedCount / evaluatedRows.length) * 100).toFixed(1) : "0",
      classAverage: evaluatedRows.length > 0 ? (evaluatedRows.reduce((sum, r) => sum + parseFloat(r.finalGrade), 0) / evaluatedRows.length).toFixed(2) : "—",
    };

    const snapshot = {
      center: {
        name: center.name,
        registrationNumber: center.registrationNumber,
        city: center.city,
        logoDataUrl: getCenterLogoBase64(req.centerId, center.logo),
        sealDataUrl: getCenterSealBase64(req.centerId),
        signatures: {
          directeur: getRoleSignatureBase64(req.centerId, "directeur"),
          formateur: getRoleSignatureBase64(req.centerId, "formateur") || getRoleSignatureBase64(req.centerId, "directeur"),
        },
      },
      offering: {
        classeLabel: offering.classe.label,
        subjectName: offering.subject.name,
        categoryName: offering.category?.name,
        semesterLabel: offering.gradePeriod.label,
        coefficient: offering.coefficient,
        formateurName: offering.formateur ? `${offering.formateur.firstName} ${offering.formateur.lastName}` : null,
      },
      rows,
      stats,
      qrToken,
      templateConfig: template?.config || { primaryColor: "#071A2E" },
    };

    const yearFolder = (offering.gradePeriod.academicYear?.label || "current").replace(/[^a-zA-Z0-9_-]/g, "_");
    const docFolder = centerStoragePath(req.centerId, "documents", yearFolder, "pvs");
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const fileName = `PV_MATIERE_${offering.subject.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${offering.id.substring(0, 6)}.pdf`;
    const fullPath = path.join(docFolder, fileName);

    await generateCertifiedGradeSheetPdf(snapshot, verificationUrl, fullPath);

    const doc = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type: docType,
        classeId: offering.classeId,
        filePath: fullPath,
        fileHash: crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex"),
        renderSnapshot: snapshot,
        qrToken,
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

// 7. PV de Délibération de Classe (A4 Paysage - PV_SEMESTRE & PV_ANNUEL)
router.post("/grades/classes/:classeId/semester-sheet", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    const { classeId } = req.params;
    const { gradePeriodId, forceRegenerate = false } = req.body || {};
    if (!gradePeriodId) return res.status(400).json({ error: "Période semestrielle ou annuelle requise." });

    await ensureStorageTree(req.centerId);

    const [center, classe, period] = await Promise.all([
      prisma.center.findUnique({ where: { id: req.centerId } }),
      prisma.classe.findFirst({
        where: { id: classeId, centerId: req.centerId },
        include: {
          filiere: true,
          niveau: true,
          academicYear: true,
          inscriptions: {
            where: { student: { deletedAt: null } },
            include: { student: true },
            orderBy: { student: { lastName: "asc" } },
          },
        },
      }),
      prisma.gradePeriod.findUnique({ where: { id: gradePeriodId } }),
    ]);

    if (!classe) return res.status(404).json({ error: "Classe introuvable." });
    if (!period) return res.status(404).json({ error: "Période introuvable." });

    const isAnnual = period.type === "ANNUEL";
    const docType = isAnnual ? "PV_ANNUEL" : "PV_SEMESTRE";

    const [template, offerings, results] = await Promise.all([
      prisma.documentTemplate.findUnique({ where: { centerId_type: { centerId: req.centerId, type: docType } } }),
      prisma.subjectOffering.findMany({
        where: {
          classeId,
          ...(!isAnnual ? { gradePeriodId } : {}),
        },
        include: { subject: true, category: true, gradePeriod: true },
        orderBy: [{ gradePeriod: { order: "asc" } }, { category: { order: "asc" } }, { subject: { name: "asc" } }],
      }),
      prisma.subjectResult.findMany({
        where: {
          centerId: req.centerId,
          subjectId: { in: (await prisma.subjectOffering.findMany({ where: { classeId }, select: { subjectId: true } })).map((o) => o.subjectId) },
          studentId: { in: classe.inscriptions.map((i) => i.studentId) },
        },
      }),
    ]);

    const existingDoc = await prisma.document.findFirst({
      where: { centerId: req.centerId, type: docType, classeId, qrToken: { contains: period.id } },
      orderBy: { generatedAt: "desc" },
    });

    if (!forceRegenerate && existingDoc && fs.existsSync(existingDoc.filePath)) {
      return res.json({
        success: true,
        reused: true,
        previewUrl: `/documents/${existingDoc.id}/preview`,
        downloadUrl: `/documents/${existingDoc.id}/download`,
      });
    }

    const cuid = crypto.randomBytes(8).toString("hex");
    const hmacSig = crypto.createHmac("sha256", process.env.JWT_SECRET || "ceco_key").update(`${cuid}:${classeId}`).digest("hex").slice(0, 16);
    const qrToken = `${cuid}?t=${hmacSig}&cls=${classeId}&p=${period.id}`;
    const verificationUrl = `${req.protocol}://${req.get("host")}/verify/${qrToken}`;

    const isFinalYear = classe.niveau?.order >= classe.filiere?.durationInYears;

    const summaries = classe.inscriptions.map((insc) => {
      const st = insc.student;
      const stResults = results.filter((r) => r.studentId === st.id);

      let totalPoints = 0;
      let evaluatedCoeff = 0;
      let hasEliminatory = false;

      const subjectDetails = offerings.map((off) => {
        const res = stResults.find((r) => r.subjectId === off.subjectId);
        const gradeVal = res && res.finalGrade !== null ? res.finalGrade : null;
        if (gradeVal !== null) {
          totalPoints += gradeVal * off.coefficient;
          evaluatedCoeff += off.coefficient;
          if (off.category?.isEliminatory && gradeVal < 8.0) {
            hasEliminatory = true;
          }
        }
        return {
          subjectId: off.subjectId,
          finalGrade: gradeVal,
        };
      });

      const average = evaluatedCoeff > 0 ? Number((totalPoints / evaluatedCoeff).toFixed(2)) : null;

      let decision = "EN_ATTENTE";
      if (average !== null) {
        if (average >= 10.0 && !hasEliminatory) {
          decision = isAnnual ? (isFinalYear ? "DIPLÔMÉ" : "ADMIS") : "VALIDÉ";
        } else {
          decision = isAnnual ? "REDOUBLE" : "AJOURNÉ";
        }
      }

      return {
        student: { matricule: st.matricule, firstName: st.firstName, lastName: st.lastName },
        subjects: subjectDetails,
        semesterAverage: average,
        decision,
      };
    });

    const sorted = [...summaries].filter((s) => s.semesterAverage !== null).sort((a, b) => b.semesterAverage - a.semesterAverage);
    summaries.forEach((s) => {
      s.rank = s.semesterAverage !== null ? sorted.findIndex((st) => st.student.matricule === s.student.matricule) + 1 : null;
    });

    const snapshot = {
      center: {
        name: center.name,
        registrationNumber: center.registrationNumber,
        city: center.city,
        logoDataUrl: getCenterLogoBase64(req.centerId, center.logo),
        sealDataUrl: getCenterSealBase64(req.centerId),
      },
      classe: { label: classe.label, filiereName: classe.filiere.name },
      periodLabel: period.label,
      offerings,
      summaries,
      qrToken,
      templateConfig: template?.config || { primaryColor: "#071A2E" },
    };

    const yearFolder = (classe.academicYear?.label || "current").replace(/[^a-zA-Z0-9_-]/g, "_");
    const docFolder = centerStoragePath(req.centerId, "documents", yearFolder, "pvs");
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const fileName = `${docType}_${classe.label.replace(/[^a-zA-Z0-9_-]/g, "_")}_${period.id.substring(0, 6)}.pdf`;
    const fullPath = path.join(docFolder, fileName);

    await generateClassSemesterSummaryPdf(snapshot, verificationUrl, fullPath);

    const doc = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type: docType,
        classeId: classe.id,
        filePath: fullPath,
        fileHash: crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex"),
        renderSnapshot: snapshot,
        qrToken,
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

// 8. PV Récapitulatif du Contrôle Continu de Classe (PV_CC - A4 Paysage)
router.post("/grades/classes/:classeId/cc-sheet", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    const { classeId } = req.params;
    const { gradePeriodId, forceRegenerate = false } = req.body || {};
    await ensureStorageTree(req.centerId);

    const [center, classe, period] = await Promise.all([
      prisma.center.findUnique({ where: { id: req.centerId } }),
      prisma.classe.findFirst({
        where: { id: classeId, centerId: req.centerId },
        include: {
          filiere: true,
          academicYear: true,
          inscriptions: {
            where: { student: { deletedAt: null } },
            include: { student: true },
            orderBy: { student: { lastName: "asc" } },
          },
        },
      }),
      gradePeriodId ? prisma.gradePeriod.findUnique({ where: { id: gradePeriodId } }) : null,
    ]);

    if (!classe) return res.status(404).json({ error: "Classe introuvable." });

    const docType = "PV_CC";
    const template = await prisma.documentTemplate.findUnique({ where: { centerId_type: { centerId: req.centerId, type: docType } } });

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        classeId,
        ...(gradePeriodId ? { gradePeriodId } : {}),
      },
      include: { subject: true, category: true, gradePeriod: true },
      orderBy: [{ gradePeriod: { order: "asc" } }, { category: { order: "asc" } }, { subject: { name: "asc" } }],
    });

    const results = await prisma.subjectResult.findMany({
      where: {
        centerId: req.centerId,
        subjectId: { in: offerings.map((o) => o.subjectId) },
        studentId: { in: classe.inscriptions.map((i) => i.studentId) },
      },
    });

    const existingDoc = await prisma.document.findFirst({
      where: { centerId: req.centerId, type: docType, classeId, qrToken: { contains: gradePeriodId || "cc" } },
      orderBy: { generatedAt: "desc" },
    });

    if (!forceRegenerate && existingDoc && fs.existsSync(existingDoc.filePath)) {
      return res.json({
        success: true,
        reused: true,
        previewUrl: `/documents/${existingDoc.id}/preview`,
        downloadUrl: `/documents/${existingDoc.id}/download`,
      });
    }

    const cuid = crypto.randomBytes(8).toString("hex");
    const hmacSig = crypto.createHmac("sha256", process.env.JWT_SECRET || "ceco_key").update(`${cuid}:${classeId}`).digest("hex").slice(0, 16);
    const qrToken = `${cuid}?t=${hmacSig}&cls=${classeId}&doc=PV_CC`;
    const verificationUrl = `${req.protocol}://${req.get("host")}/verify/${qrToken}`;

    const summaries = classe.inscriptions.map((insc) => {
      const st = insc.student;
      const stResults = results.filter((r) => r.studentId === st.id);

      let totalCcPoints = 0;
      let evaluatedCoeff = 0;

      const subjectDetails = offerings.map((off) => {
        const res = stResults.find((r) => r.subjectId === off.subjectId);
        const ccVal = res && res.ccAverage !== null && res.ccAverage !== undefined ? res.ccAverage : null;
        if (ccVal !== null) {
          totalCcPoints += ccVal * off.coefficient;
          evaluatedCoeff += off.coefficient;
        }
        return {
          subjectId: off.subjectId,
          ccAverage: ccVal,
        };
      });

      const ccAverage = evaluatedCoeff > 0 ? Number((totalCcPoints / evaluatedCoeff).toFixed(2)) : null;

      return {
        student: { matricule: st.matricule, firstName: st.firstName, lastName: st.lastName },
        subjects: subjectDetails,
        ccAverage,
      };
    });

    const sorted = [...summaries].filter((s) => s.ccAverage !== null).sort((a, b) => b.ccAverage - a.ccAverage);
    summaries.forEach((s) => {
      s.rank = s.ccAverage !== null ? sorted.findIndex((st) => st.student.matricule === s.student.matricule) + 1 : null;
    });

    const snapshot = {
      center: {
        name: center.name,
        registrationNumber: center.registrationNumber,
        city: center.city,
        logoDataUrl: getCenterLogoBase64(req.centerId, center.logo),
        sealDataUrl: getCenterSealBase64(req.centerId),
      },
      classe: { label: classe.label, filiereName: classe.filiere.name },
      periodLabel: period?.label || "Contrôle Continu",
      offerings,
      summaries,
      qrToken,
      templateConfig: template?.config || { primaryColor: "#071A2E" },
    };

    const yearFolder = (classe.academicYear?.label || "current").replace(/[^a-zA-Z0-9_-]/g, "_");
    const docFolder = centerStoragePath(req.centerId, "documents", yearFolder, "pvs");
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const fileName = `PV_CC_${classe.label.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.pdf`;
    const fullPath = path.join(docFolder, fileName);

    await generateClassContinuousAssessmentSummaryPdf(snapshot, verificationUrl, fullPath);

    const doc = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type: docType,
        classeId: classe.id,
        filePath: fullPath,
        fileHash: crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex"),
        renderSnapshot: snapshot,
        qrToken,
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