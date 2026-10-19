// packages/backend/src/routes/documents.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { centerStoragePath, ensureStorageTree, cleanTempStorage } = require("../storage/paths");
const { getDefaultSealBase64 } = require("../storage/defaultSeal");
const {
  generateStudentCardPdf,
  generateBatchCardsSheetPdf,
  generateAttestationPdf,
  generateBatchAttestationsPdf,
  generateFicheInscriptionPdf,
  generateContinuousAssessmentBulletinPdf,
  generateBatchContinuousAssessmentBulletinsPdf,
  generateSemesterBulletinPdf,
  generateBatchSemesterBulletinsPdf,
  generateAnnualTranscriptPdf,
  generateBatchAnnualTranscriptsPdf,
  generateGraduationDiplomaPdf,
  generateBatchGraduationDiplomasPdf,
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

/**
 * Récupère le motif de fond du document (Recherche prioritaire recap_bg, transcript_bg, puis card_bg)
 */
function getCenterDocumentBgBase64(centerId, docCategory = "card") {
  const brandingDir = centerStoragePath(centerId, "settings/branding");
  const exts = ["png", "jpg", "jpeg", "webp"];

  const prefixes = docCategory === "transcript" || docCategory === "recap"
    ? ["recap_bg", "transcript_bg", "releve_bg", "card_bg"]
    : ["card_bg", "card_background"];

  if (fs.existsSync(brandingDir)) {
    for (const pref of prefixes) {
      for (const ext of exts) {
        const p = path.join(brandingDir, `${pref}.${ext}`);
        if (fs.existsSync(p)) {
          const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
          return `data:${mime};base64,${fs.readFileSync(p).toString("base64")}`;
        }
      }
    }
  }

  // Repli par défaut
  const candidateDirs = [
    path.join(__dirname, "../../assets"),
    path.join(process.cwd(), "packages/backend/assets"),
    path.join(process.cwd(), "packages/desktop/assets"),
  ];
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      for (const pref of prefixes) {
        for (const ext of exts) {
          const p = path.join(dir, `${pref}.${ext}`);
          if (fs.existsSync(p)) {
            const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
            return `data:${mime};base64,${fs.readFileSync(p).toString("base64")}`;
          }
        }
      }
    }
  }
  return null;
}

function getAllCenterSignaturesBase64(centerId) {
  const dir = centerStoragePath(centerId, "settings/signatures");
  const signatures = {};
  if (!fs.existsSync(dir)) return signatures;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith(".png")) {
      const roleKey = path.basename(file, ".png");
      const filePath = path.join(dir, file);
      try {
        signatures[roleKey] = `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;
      } catch (e) {
        console.warn(`[Documents] Erreur lecture signature ${roleKey} :`, e.message);
      }
    }
  }
  return signatures;
}

function getStudentPhotoBase64(centerId, photoPath) {
  if (!photoPath) return null;
  const filePath = path.join(centerStoragePath(centerId, "students/photos"), photoPath);
  if (fs.existsSync(filePath)) {
    const ext = path.extname(photoPath).replace(".", "").toLowerCase();
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
  }
  return null;
}

function getGradeAppreciation(val) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const g = parseFloat(val);
  if (g < 6.0) return "Médiocre";
  if (g < 8.0) return "Faible";
  if (g < 10.0) return "Insuffisant";
  if (g < 12.0) return "Passable";
  if (g < 14.0) return "Assez Bien";
  if (g < 16.0) return "Bien";
  if (g < 18.0) return "Très Bien";
  return "Excellent";
}

function getDiplomaMention(avg) {
  if (avg === null || avg === undefined || isNaN(avg)) return "Passable";
  const a = parseFloat(avg);
  if (a >= 16.0) return "Très Bien";
  if (a >= 14.0) return "Bien";
  if (a >= 12.0) return "Assez Bien";
  return "Passable";
}

function getGeneralObservation(avg, hasEliminatory) {
  if (hasEliminatory) {
    return "Échec dû à une note éliminatoire (< 08/20) en matière de spécialité. Rattrapage obligatoire.";
  }
  if (avg === null || avg === undefined || isNaN(avg)) {
    return "Résultats académiques en cours de délibération.";
  }
  const a = parseFloat(avg);
  if (a >= 16.0) return "Excellent travail. Félicitations du conseil et encouragements à maintenir ce niveau d'excellence.";
  if (a >= 14.0) return "Très bon travail. Résultats solides et réguliers. Tableau d'honneur.";
  if (a >= 12.0) return "Bon travail dans l'ensemble. Résultats satisfaisants, poursuivez dans cette voie.";
  if (a >= 10.0) return "Travail passable. Des efforts supplémentaires sont attendus pour consolider les acquis.";
  if (a >= 8.0) return "Résultats insuffisants. Travail irrégulier, un redoublement d'efforts est impératif au rattrapage.";
  return "Résultats très faibles. Manque d'assiduité ou de méthode. Avertissement du conseil de discipline.";
}

function generateOfflineQrPayload(snapshot, docType) {
  const c = (snapshot.center?.name || "CECO").replace(/[^a-zA-Z0-9]/g, "").substring(0, 10).toUpperCase();
  const mat = (snapshot.student?.matricule || "—").substring(0, 16);
  const nom = `${snapshot.student?.lastName || ""} ${(snapshot.student?.firstName || "")[0] || ""}`.substring(0, 16).trim().toUpperCase();
  const moy = snapshot.totals?.overallAverage !== null && snapshot.totals?.overallAverage !== undefined
    ? Number(snapshot.totals.overallAverage).toFixed(2)
    : "—";
  const rng = snapshot.totals?.rank ? `${snapshot.totals.rank}e` : "—";
  const dec = (snapshot.totals?.decision || "EN_COURS").substring(0, 6).toUpperCase();
  const sig = (snapshot.qrToken ? snapshot.qrToken.split("?")[0] : "CECO").substring(0, 8);
  const docCode = docType.replace(/[^a-zA-Z]/g, "").substring(0, 6).toUpperCase();

  const payload = `CECO:V1|CTR:${c}|MAT:${mat}|DOC:${docCode}|NOM:${nom}|MOY:${moy}|RNG:${rng}|DEC:${dec}|SIG:${sig}`;
  return payload.length > 145 ? payload.substring(0, 144) : payload;
}

const DEFAULT_FAMILY_CONFIGS = {
  GENERAL_CONFIG: {
    headerMode: "logo",
    primaryColor: "#071A2E",
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI\nET DE LA FORMATION PROFESSIONNELLE\n----\nDÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT\nAND VOCATIONAL TRAINING\n----\nREGIONAL DELEGATION FOR THE WEST\nDIVISIONAL DELEGATION FOR MENOUA",
    watermarkOpacity: 0.05,
    bgTextureOpacity: 0.22,
    footerLegal: "Document officiel certifié conforme • Toute surcharge ou altération annule la validité du présent acte.",
    internalHeader: {
      title: "",
      accreditation: "",
      contacts: "",
    },
  },
  CARTE: {
    themeColor: "#071A2E",
    accentColor: "#18527A",
    cardTitle: "CARTE D’ÉTUDIANT",
    showLogo: true,
    showSeal: false,
    showWatermark: true,
    watermarkType: "logo",
    watermarkOpacity: 0.08,
    termsOfUse: "Cette carte est strictement personnelle et demeure la propriété exclusive du centre. Sa présentation est obligatoire pour l'accès aux cours, ateliers et examens.",
    signatoryRoleKey: "directeur",
    signatoryTitle: "Le Directeur Général",
  },
  INTERNE: {
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING",
    primaryColor: "#071A2E",
    showLogo: true,
    showSeal: false,
    showWatermark: true,
    watermarkType: "logo",
    watermarkOpacity: 0.05,
    signatories: [
      { title: "Signature de l'Apprenant(e) / Tuteur", roleKey: "student" },
      { title: "Visa & Cachet de la Direction", roleKey: "directeur" },
    ],
    footerLegal: "Document administratif interne non diffusable à l'extérieur • CECO ERP",
  },
  EXTERNE: {
    headerMode: "logo",
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING",
    primaryColor: "#071A2E",
    showLogo: true,
    showSeal: false,
    showWatermark: true,
    watermarkType: "logo",
    watermarkOpacity: 0.05,
    bgTextureOpacity: 0.22,
    signatories: [
      { title: "Le Directeur Général", roleKey: "directeur" },
    ],
    footerLegal: "Toute falsification ou altération du présent document expose son auteur aux poursuites prévues par le Code Pénal.",
  },
};

// 1. Registre Centralisé des Documents
router.get("/documents", verifyJwt, requirePermission("students.read", "grades.read"), async (req, res, next) => {
  try {
    const { type, classeId, search, page = 1, limit = 25 } = req.query || {};

    const where = {
      centerId: req.centerId,
      ...(type && { type }),
      ...(classeId && { classeId }),
      ...(search && search.trim() && {
        OR: [
          { qrToken: { contains: search.trim(), mode: "insensitive" } },
          { fileHash: { contains: search.trim(), mode: "insensitive" } },
        ],
      }),
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(5, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [total, documents] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { generatedAt: "desc" },
      }),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.json({
      data: documents.map((d) => ({
        id: d.id,
        type: d.type,
        studentId: d.studentId,
        classeId: d.classeId,
        gradePeriodId: d.gradePeriodId,
        fileHash: d.fileHash,
        qrToken: d.qrToken,
        generatedAt: d.generatedAt,
        previewUrl: `/documents/${d.id}/preview`,
        downloadUrl: `/documents/${d.id}/download`,
      })),
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

// 2. Gestion des Gabarits
router.get("/documents/templates/:type", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
  try {
    const { type } = req.params;

    const globalTemplate = await prisma.documentTemplate.findUnique({
      where: { centerId_type: { centerId: req.centerId, type: "GENERAL_CONFIG" } },
    });
    const globalConfig = globalTemplate?.config || DEFAULT_FAMILY_CONFIGS.GENERAL_CONFIG;

    const template = await prisma.documentTemplate.findUnique({
      where: { centerId_type: { centerId: req.centerId, type } },
    });

    const fallbackFamily = type.startsWith("CARTE") ? DEFAULT_FAMILY_CONFIGS.CARTE :
      ["FICHE_INSCRIPTION", "BORDEREAU_VIERGE", "PV_MATIERE", "PV_SEMESTRE", "PV_ANNUEL", "PV_CC"].includes(type) ? DEFAULT_FAMILY_CONFIGS.INTERNE :
      type === "GENERAL_CONFIG" ? DEFAULT_FAMILY_CONFIGS.GENERAL_CONFIG : DEFAULT_FAMILY_CONFIGS.EXTERNE;

    const merged = {
      ...fallbackFamily,
      ...(type !== "GENERAL_CONFIG" ? {
        headerLeft: globalConfig.headerLeft || fallbackFamily.headerLeft,
        headerRight: globalConfig.headerRight || fallbackFamily.headerRight,
        headerMode: globalConfig.headerMode || fallbackFamily.headerMode,
        primaryColor: globalConfig.primaryColor || fallbackFamily.primaryColor,
        watermarkOpacity: globalConfig.watermarkOpacity !== undefined ? globalConfig.watermarkOpacity : fallbackFamily.watermarkOpacity,
        bgTextureOpacity: globalConfig.bgTextureOpacity !== undefined ? globalConfig.bgTextureOpacity : fallbackFamily.bgTextureOpacity,
      } : {}),
      ...(template?.config || {}),
    };

    res.json(merged);
  } catch (err) {
    next(err);
  }
});

router.put("/documents/templates/:type", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { type } = req.params;
    const { config } = req.body || {};

    const template = await prisma.documentTemplate.upsert({
      where: { centerId_type: { centerId: req.centerId, type } },
      update: { config, isActive: true },
      create: { centerId: req.centerId, type, config: config || {}, isActive: true },
    });

    res.json(template.config);
  } catch (err) {
    next(err);
  }
});

// 3. Snapshot Académique Tolérant avec résolution dynamique de recap_bg et card_bg
async function buildStudentAcademicSnapshot(centerId, studentIdentifier, targetClasseId, gradePeriodId) {
  const student = await prisma.student.findFirst({
    where: {
      centerId,
      OR: [{ id: studentIdentifier }, { matricule: studentIdentifier }],
    },
    include: {
      inscriptions: {
        include: {
          classe: {
            include: {
              filiere: { include: { programType: true } },
              niveau: true,
              academicYear: { include: { gradePeriods: true } },
            },
          },
          promotion: true,
          academicYear: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!student) return null;

  let finalClasseId = targetClasseId;
  let currentInsc = student.inscriptions.find((i) => i.classeId === finalClasseId);

  if (!currentInsc) {
    currentInsc = student.inscriptions[0];
    finalClasseId = currentInsc?.classeId;
  }
  if (!finalClasseId || !currentInsc) return null;

  const [center, classe, globalTmpl] = await Promise.all([
    prisma.center.findUnique({ where: { id: centerId } }),
    prisma.classe.findFirst({
      where: { id: finalClasseId, centerId },
      include: {
        filiere: { include: { programType: true } },
        niveau: true,
        academicYear: { include: { gradePeriods: true } },
      },
    }),
    prisma.documentTemplate.findUnique({
      where: { centerId_type: { centerId, type: "GENERAL_CONFIG" } },
    }),
  ]);

  if (!center || !classe) return null;

  let period = null;
  if (gradePeriodId) {
    period = await prisma.gradePeriod.findFirst({
      where: { id: gradePeriodId, centerId },
    });
  }
  if (!period && classe.academicYear?.gradePeriods?.length > 0) {
    period = classe.academicYear.gradePeriods.find((p) => p.type === "SEMESTRE") || classe.academicYear.gradePeriods[0];
  }

  const isPeriodSpecific = period && period.type === "SEMESTRE";

  const [offerings, results, grades, delibs, allStudentsInscs] = await Promise.all([
    prisma.subjectOffering.findMany({
      where: {
        classeId: finalClasseId,
        ...(isPeriodSpecific ? { gradePeriodId: period.id } : {}),
      },
      include: { subject: true, category: true, formateur: true, gradePeriod: true },
      orderBy: [{ gradePeriod: { order: "asc" } }, { category: { order: "asc" } }, { subject: { name: "asc" } }],
    }),
    prisma.subjectResult.findMany({
      where: {
        centerId,
        studentId: student.id,
        ...(isPeriodSpecific ? { gradePeriodId: period.id } : {}),
      },
    }),
    prisma.grade.findMany({
      where: {
        centerId,
        studentId: student.id,
        ...(isPeriodSpecific ? { gradePeriodId: period.id } : {}),
      },
    }),
    prisma.deliberation.findMany({
      where: {
        classeId: finalClasseId,
        centerId,
        ...(isPeriodSpecific ? { gradePeriodId: period.id } : { scope: "ANNUEL" }),
      },
      include: { studentResults: true },
    }),
    prisma.inscription.findMany({
      where: { classeId: finalClasseId, centerId, student: { deletedAt: null } },
      include: { student: true },
    }),
  ]);

  const classAverages = [];
  const allResults = await prisma.subjectResult.findMany({
    where: {
      centerId,
      studentId: { in: allStudentsInscs.map((i) => i.studentId) },
      ...(isPeriodSpecific ? { gradePeriodId: period?.id } : {}),
    },
  });

  allStudentsInscs.forEach((inscItem) => {
    const stResults = allResults.filter((r) => r.studentId === inscItem.studentId && offerings.some((o) => o.subjectId === r.subjectId));
    let pts = 0;
    let coeffs = 0;
    let stHasElim = false;

    offerings.forEach((off) => {
      const res = stResults.find((r) => r.subjectId === off.subjectId);
      if (res && res.finalGrade !== null) {
        pts += res.finalGrade * off.coefficient;
        coeffs += off.coefficient;
        if (off.category?.isEliminatory && res.finalGrade < 8.0) {
          stHasElim = true;
        }
      }
    });

    if (coeffs > 0) {
      classAverages.push({
        studentId: inscItem.studentId,
        avg: Number((pts / coeffs).toFixed(2)),
        hasElim: stHasElim,
      });
    }
  });

  classAverages.sort((a, b) => b.avg - a.avg);
  const highestClassAvg = classAverages.length > 0 ? classAverages[0].avg : null;
  const lowestClassAvg = classAverages.length > 0 ? classAverages[classAverages.length - 1].avg : null;
  const classMean = classAverages.length > 0
    ? Number((classAverages.reduce((s, c) => s + c.avg, 0) / classAverages.length).toFixed(2))
    : null;

  const passedStudentsCount = classAverages.filter((c) => c.avg >= 10.0 && !c.hasElim).length;
  const failedStudentsCount = allStudentsInscs.length - passedStudentsCount;
  const realSuccessRate = allStudentsInscs.length > 0
    ? Number(((passedStudentsCount / allStudentsInscs.length) * 100).toFixed(1))
    : 0.0;

  const categoriesMap = new Map();
  let grandTotalPoints = 0;
  let grandTotalCoeff = 0;
  let hasEliminatory = false;

  offerings.forEach((off) => {
    const catName = off.category?.name || "Enseignement Général";
    const catOrder = off.category?.order || 99;
    const catCode = off.category?.code || null;
    const isElim = off.category?.isEliminatory || false;

    if (!categoriesMap.has(catName)) {
      categoriesMap.set(catName, {
        name: catName,
        code: catCode,
        order: catOrder,
        isEliminatory: isElim,
        totalCoeff: 0,
        totalPoints: 0,
        subjects: [],
      });
    }

    const group = categoriesMap.get(catName);
    const subRes = results.find((r) => r.subjectId === off.subjectId);
    const subGrades = grades.filter((g) => g.subjectOfferingId === off.id);

    const normGrade = subGrades.find((g) => g.evaluationType === "NORMALE");
    const rattGrade = subGrades.find((g) => g.evaluationType === "RATTRAPAGE");

    let effectiveExamValue = null;
    let isExamAbsent = false;
    let isExamJustified = false;

    if (normGrade) {
      if (normGrade.isAbsent) {
        isExamAbsent = true;
        isExamJustified = normGrade.absenceReason === "JUSTIFIED";
      } else {
        effectiveExamValue = normGrade.value;
      }
    }

    if (rattGrade && !rattGrade.isAbsent) {
      if (effectiveExamValue === null || rattGrade.value > effectiveExamValue) {
        effectiveExamValue = rattGrade.value;
        isExamAbsent = false;
      }
    }

    const finalGradeVal = subRes?.finalGrade !== null && subRes?.finalGrade !== undefined ? subRes.finalGrade : null;
    const points = finalGradeVal !== null ? Number((finalGradeVal * off.coefficient).toFixed(2)) : null;

    if (finalGradeVal !== null) {
      group.totalCoeff += off.coefficient;
      group.totalPoints += points;
      grandTotalCoeff += off.coefficient;
      grandTotalPoints += points;

      if (isElim && finalGradeVal < 8.0) {
        hasEliminatory = true;
      }
    }

    const allScoresForSubject = allResults
      .filter((r) => r.subjectId === off.subjectId && r.finalGrade !== null)
      .map((r) => r.finalGrade)
      .sort((a, b) => b - a);

    const subjectRank = finalGradeVal !== null ? allScoresForSubject.indexOf(finalGradeVal) + 1 : null;

    group.subjects.push({
      subjectId: off.subjectId,
      code: off.subject?.code || "—",
      name: off.subject?.name,
      coefficient: off.coefficient,
      volumeHoraire: off.volumeHoraire,
      formateurName: off.formateur ? `${off.formateur.firstName} ${off.formateur.lastName}` : null,
      ccAverage: subRes?.ccAverage !== null && subRes?.ccAverage !== undefined ? subRes.ccAverage.toFixed(2) : "—",
      examGrade: isExamAbsent
        ? (isExamJustified ? "ABS (Just.)" : "0.00")
        : (effectiveExamValue !== null ? effectiveExamValue.toFixed(2) : (subRes?.normalAverage !== null && subRes?.normalAverage !== undefined ? subRes.normalAverage.toFixed(2) : "—")),
      finalGrade: finalGradeVal !== null ? finalGradeVal.toFixed(2) : "—",
      points: points !== null ? points.toFixed(2) : "—",
      rank: subjectRank || "—",
      isValid: finalGradeVal !== null ? finalGradeVal >= 10.0 : false,
      appreciation: getGradeAppreciation(finalGradeVal),
    });
  });

  const categories = Array.from(categoriesMap.values()).sort((a, b) => a.order - b.order);
  categories.forEach((cat) => {
    cat.groupAverage = cat.totalCoeff > 0 ? Number((cat.totalPoints / cat.totalCoeff).toFixed(2)) : null;
  });

  const studentOverallAverage = grandTotalCoeff > 0 ? Number((grandTotalPoints / grandTotalCoeff).toFixed(2)) : null;
  const studentRank = studentOverallAverage !== null ? classAverages.findIndex((c) => c.studentId === student.id) + 1 : null;

  let juryDecision = currentInsc.status || "en_cours";
  const activeDelib = delibs[0];
  const stDelib = activeDelib?.studentResults?.find((d) => d.studentId === student.id);
  if (stDelib) juryDecision = stDelib.decision;

  return {
    center: {
      id: center.id,
      name: center.name,
      email: center.email,
      phone: center.phone,
      address: center.address,
      city: center.city,
      country: center.country,
      registrationNumber: center.registrationNumber,
      directorName: center.directorName || "",
      directorTitle: center.directorTitle || "Le Directeur Général",
      logoDataUrl: getCenterLogoBase64(centerId, center.logo),
      sealDataUrl: getCenterSealBase64(centerId),
      cardBgDataUrl: getCenterDocumentBgBase64(centerId, "card"),
      transcriptBgDataUrl: getCenterDocumentBgBase64(centerId, "transcript"), // <-- Résolution automatique de recap_bg.*
      signatures: getAllCenterSignaturesBase64(centerId),
    },
    commonDefaults: globalTmpl?.config || DEFAULT_FAMILY_CONFIGS.GENERAL_CONFIG,
    student: {
      id: student.id,
      matricule: student.matricule,
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender,
      birthDate: student.birthDate,
      birthPlace: student.birthPlace,
      phone: student.phone,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      entryDiploma: student.entryDiploma,
      photoDataUrl: getStudentPhotoBase64(centerId, student.photoPath),
    },
    classe: {
      id: classe.id,
      label: classe.label,
      filiereName: classe.filiere?.name,
      programTypeCode: classe.filiere?.programType?.code || "DQP",
      durationInYears: classe.filiere?.durationInYears || 1,
      niveauOrder: classe.niveau?.order || 1,
      academicYearLabel: classe.academicYear?.label || "2026-2027",
      promotionLabel: currentInsc.promotion?.label || `Promotion ${classe.academicYear?.label}`,
      status: currentInsc.status,
    },
    period: period ? {
      id: period.id,
      label: period.label,
      type: period.type,
      order: period.order,
    } : { label: `Année ${classe.academicYear?.label || "2026-2027"}`, type: "ANNUEL" },
    categories,
    totals: {
      totalCoefficients: grandTotalCoeff,
      totalPoints: Number(grandTotalPoints.toFixed(2)),
      overallAverage: studentOverallAverage,
      rank: studentRank,
      totalStudents: allStudentsInscs.length,
      classAverage: classMean,
      highestAverage: highestClassAvg,
      lowestAverage: lowestClassAvg,
      passedCount: passedStudentsCount,
      failedCount: failedStudentsCount,
      classSuccessRate: realSuccessRate,
      hasEliminatory,
      decision: juryDecision,
      mention: getDiplomaMention(studentOverallAverage),
      generalObservation: getGeneralObservation(studentOverallAverage, hasEliminatory),
    },
  };
}

// 4. Génération d'un document individuel
router.post("/documents/generate", verifyJwt, requirePermission("students.read", "grades.read", "bulletins.generate"), async (req, res, next) => {
  try {
    const { studentId, type = "CARTE_ETUDIANT", classeId, gradePeriodId, forceRegenerate = false } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Identifiant apprenant requis." });

    await ensureStorageTree(req.centerId);
    cleanTempStorage(req.centerId);

    const snapshot = await buildStudentAcademicSnapshot(req.centerId, studentId, classeId, gradePeriodId);
    if (!snapshot) {
      return res.status(404).json({ error: "Données académiques introuvables pour cet apprenant." });
    }

    const targetClasseId = snapshot.classe.id;
    const isPermanentLegalDoc = ["BULLETIN_SEMESTRE", "RELEVE_ANNUEL", "DIPLOME_FIN_FORMATION", "ATTESTATION_INSCRIPTION"].includes(type);

    const existingDoc = await prisma.document.findFirst({
      where: {
        centerId: req.centerId,
        studentId: snapshot.student.id,
        type,
        classeId: targetClasseId,
        ...(snapshot.period?.id ? { gradePeriodId: snapshot.period.id } : {}),
      },
      orderBy: { generatedAt: "desc" },
    });

    if (!forceRegenerate && existingDoc && fs.existsSync(existingDoc.filePath)) {
      return res.json({
        success: true,
        reused: true,
        document: {
          id: existingDoc.id,
          qrToken: existingDoc.qrToken,
          fileHash: existingDoc.fileHash,
          renderSnapshot: existingDoc.renderSnapshot,
          downloadUrl: `/documents/${existingDoc.id}/download`,
          previewUrl: `/documents/${existingDoc.id}/preview`,
        },
      });
    }

    const template = await prisma.documentTemplate.findUnique({
      where: { centerId_type: { centerId: req.centerId, type } },
    });

    const templateConfig = {
      ...(snapshot.commonDefaults || {}),
      ...(template?.config || (
        type.startsWith("CARTE") ? DEFAULT_FAMILY_CONFIGS.CARTE :
        ["FICHE_INSCRIPTION", "BORDEREAU_VIERGE", "PV_MATIERE", "PV_SEMESTRE", "PV_ANNUEL", "PV_CC"].includes(type) ? DEFAULT_FAMILY_CONFIGS.INTERNE :
        DEFAULT_FAMILY_CONFIGS.EXTERNE
      )),
    };

    snapshot.templateConfig = templateConfig;

    const cuid = crypto.randomBytes(8).toString("hex");
    const hmacSig = crypto.createHmac("sha256", process.env.JWT_SECRET || "ceco_key")
      .update(`${cuid}:${snapshot.student.matricule}:${type}:${snapshot.period?.id || "ANNUEL"}`)
      .digest("hex").slice(0, 16);

    const qrToken = `${cuid}?t=${hmacSig}&st=${snapshot.student.matricule}&doc=${type}`;
    snapshot.qrToken = qrToken;

    const isExternalDocWithQr = type.startsWith("CARTE") || ["BULLETIN_CC", "BULLETIN_SEMESTRE", "RELEVE_ANNUEL", "DIPLOME_FIN_FORMATION"].includes(type);
    const offlinePayload = isExternalDocWithQr ? generateOfflineQrPayload(snapshot, type) : null;
    snapshot.offlineQrPayload = offlinePayload;

    const yearFolder = (snapshot.classe.academicYearLabel || "current").replace(/[^a-zA-Z0-9_-]/g, "_");
    const subFolderCategory = isPermanentLegalDoc ? "archive" : "temp";
    const docFolder = centerStoragePath(req.centerId, "documents", subFolderCategory, yearFolder);
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const cleanMatricule = (snapshot.student.matricule || "STU").replace(/[^a-zA-Z0-9_-]/g, "_");
    const pdfFileName = `${cleanMatricule}_${type}_${snapshot.period?.id ? snapshot.period.id.substring(0, 6) : "ANNUEL"}_${Date.now()}.pdf`;
    const fullPdfPath = path.join(docFolder, pdfFileName);

    if (type === "CARTE_ETUDIANT") {
      await generateStudentCardPdf(snapshot, offlinePayload, fullPdfPath);
    } else if (type === "FICHE_INSCRIPTION") {
      await generateFicheInscriptionPdf(snapshot, fullPdfPath);
    } else if (type === "ATTESTATION_INSCRIPTION") {
      await generateAttestationPdf(snapshot, offlinePayload, fullPdfPath);
    } else if (type === "BULLETIN_CC") {
      await generateContinuousAssessmentBulletinPdf(snapshot, offlinePayload, fullPdfPath);
    } else if (type === "BULLETIN_SEMESTRE") {
      await generateSemesterBulletinPdf(snapshot, offlinePayload, fullPdfPath);
    } else if (type === "RELEVE_ANNUEL") {
      await generateAnnualTranscriptPdf(snapshot, offlinePayload, fullPdfPath);
    } else if (type === "DIPLOME_FIN_FORMATION") {
      await generateGraduationDiplomaPdf(snapshot, offlinePayload, fullPdfPath);
    } else {
      await generateAttestationPdf(snapshot, offlinePayload, fullPdfPath);
    }

    const pdfBuffer = fs.readFileSync(fullPdfPath);
    const fileHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    const document = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type,
        studentId: snapshot.student.id,
        classeId: targetClasseId,
        gradePeriodId: snapshot.period?.id || null,
        filePath: fullPdfPath,
        fileHash,
        renderSnapshot: snapshot,
        qrToken,
      },
    });

    res.json({
      success: true,
      document: {
        id: document.id,
        qrToken,
        fileHash,
        renderSnapshot: snapshot,
        downloadUrl: `/documents/${document.id}/download`,
        previewUrl: `/documents/${document.id}/preview`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5. Génération groupée pour toute une classe
router.post("/documents/generate-batch", verifyJwt, requirePermission("students.read", "grades.read", "bulletins.generate"), async (req, res, next) => {
  try {
    const { classeId, type = "BULLETIN_SEMESTRE", gradePeriodId } = req.body || {};
    if (!classeId) return res.status(400).json({ error: "Identifiant de classe requis." });

    await ensureStorageTree(req.centerId);

    const classe = await prisma.classe.findFirst({
      where: { id: classeId, centerId: req.centerId },
      include: {
        academicYear: true,
        inscriptions: {
          where: { student: { deletedAt: null } },
          include: { student: true },
          orderBy: { student: { lastName: "asc" } },
        },
      },
    });

    if (!classe || classe.inscriptions.length === 0) {
      return res.status(400).json({ error: "Aucun apprenant trouvé dans cette classe." });
    }

    const template = await prisma.documentTemplate.findUnique({
      where: { centerId_type: { centerId: req.centerId, type } },
    });
    const templateConfig = template?.config || (
      type.startsWith("CARTE") ? DEFAULT_FAMILY_CONFIGS.CARTE :
      ["FICHE_INSCRIPTION", "BORDEREAU_VIERGE", "PV_MATIERE", "PV_SEMESTRE", "PV_ANNUEL", "PV_CC"].includes(type) ? DEFAULT_FAMILY_CONFIGS.INTERNE :
      DEFAULT_FAMILY_CONFIGS.EXTERNE
    );

    const isExternalDocWithQr = type.startsWith("CARTE") || ["BULLETIN_CC", "BULLETIN_SEMESTRE", "RELEVE_ANNUEL", "DIPLOME_FIN_FORMATION"].includes(type);
    const snapshotsList = [];
    const qrPayloadsList = [];

    for (const insc of classe.inscriptions) {
      const snap = await buildStudentAcademicSnapshot(req.centerId, insc.studentId, classeId, gradePeriodId);
      if (snap) {
        snap.templateConfig = {
          ...(snap.commonDefaults || {}),
          ...templateConfig,
        };
        const cuid = crypto.randomBytes(8).toString("hex");
        const hmacSig = crypto.createHmac("sha256", process.env.JWT_SECRET || "ceco_key")
          .update(`${cuid}:${snap.student.matricule}:${type}`)
          .digest("hex").slice(0, 16);
        const qrToken = `${cuid}?t=${hmacSig}&st=${snap.student.matricule}&batch=1`;
        snap.qrToken = qrToken;

        const offlinePayload = isExternalDocWithQr ? generateOfflineQrPayload(snap, type) : null;
        snap.offlineQrPayload = offlinePayload;

        snapshotsList.push(snap);
        qrPayloadsList.push(offlinePayload);
      }
    }

    const yearFolder = (classe.academicYear?.label || "current").replace(/[^a-zA-Z0-9_-]/g, "_");
    const docFolder = centerStoragePath(req.centerId, "documents", "archive", yearFolder, "batches");
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const batchFileName = `BATCH_${type}_${classe.label.replace(/[^a-zA-Z0-9_-]/g, "_")}_${gradePeriodId ? gradePeriodId.substring(0, 6) : "ANNUEL"}_${Date.now()}.pdf`;
    const fullBatchPath = path.join(docFolder, batchFileName);

    if (type === "CARTE_ETUDIANT") {
      await generateBatchCardsSheetPdf(snapshotsList, qrPayloadsList, fullBatchPath);
    } else if (type === "ATTESTATION_INSCRIPTION") {
      await generateBatchAttestationsPdf(snapshotsList, qrPayloadsList, fullBatchPath);
    } else if (type === "BULLETIN_CC") {
      await generateBatchContinuousAssessmentBulletinsPdf(snapshotsList, qrPayloadsList, fullBatchPath);
    } else if (type === "BULLETIN_SEMESTRE") {
      await generateBatchSemesterBulletinsPdf(snapshotsList, qrPayloadsList, fullBatchPath);
    } else if (type === "RELEVE_ANNUEL") {
      await generateBatchAnnualTranscriptsPdf(snapshotsList, qrPayloadsList, fullBatchPath);
    } else if (type === "DIPLOME_FIN_FORMATION") {
      await generateBatchGraduationDiplomasPdf(snapshotsList, qrPayloadsList, fullBatchPath);
    } else {
      await generateBatchSemesterBulletinsPdf(snapshotsList, qrPayloadsList, fullBatchPath);
    }

    const pdfBuffer = fs.readFileSync(fullBatchPath);
    const fileHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    const batchQrToken = `BATCH-${classe.id}-${type}-${gradePeriodId || "ANNUEL"}-${Date.now()}`;

    const batchDoc = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type: `LIVRET_${type}`,
        classeId: classe.id,
        gradePeriodId: gradePeriodId || null,
        filePath: fullBatchPath,
        fileHash,
        renderSnapshot: { count: snapshotsList.length, classeLabel: classe.label, type },
        qrToken: batchQrToken,
      },
    });

    res.json({
      success: true,
      count: snapshotsList.length,
      batchDocument: {
        id: batchDoc.id,
        downloadUrl: `/documents/${batchDoc.id}/download`,
        previewUrl: `/documents/${batchDoc.id}/preview`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 6. Prévisualisation directe tolérante
router.get("/documents/:id/preview", verifyJwt, async (req, res, next) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
    });

    if (!doc) return res.status(404).json({ error: "Document introuvable." });

    if (!fs.existsSync(doc.filePath)) {
      return res.status(404).json({ error: "Fichier PDF introuvable sur le disque. Veuillez forcer la ré-émission de l'acte." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(doc.filePath)}"`);
    fs.createReadStream(doc.filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// 7. Téléchargement physique
router.get("/documents/:id/download", verifyJwt, async (req, res, next) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
    });

    if (!doc || !fs.existsSync(doc.filePath)) {
      return res.status(404).json({ error: "Fichier PDF introuvable sur le serveur." });
    }

    res.download(doc.filePath, path.basename(doc.filePath));
  } catch (err) {
    next(err);
  }
});

// 8. Page publique d'authentification par QR Code
router.get("/verify/:token", async (req, res, next) => {
  try {
    const token = req.params.token;
    const cuid = token.split("?")[0];

    const doc = await prisma.document.findFirst({
      where: { qrToken: { startsWith: cuid } },
      include: { center: true },
    });

    if (!doc) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="fr"><head><meta charset="utf-8"><title>CECO — Non Authentifié</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>body{font-family:sans-serif;background:#FDECEC;color:#C73B3B;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:16px;}
        .card{background:white;padding:28px;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:400px;text-align:center;border:1.5px solid #C73B3B;}</style>
        </head><body><div class="card"><h2>⚠️ Document Non Authentifié</h2><p>Ce document n'existe pas dans le registre cryptographique CECO ou a fait l'objet d'une altération.</p></div></body></html>
      `);
    }

    const snap = doc.renderSnapshot || {};
    res.send(`
      <!DOCTYPE html>
      <html lang="fr"><head><meta charset="utf-8"><title>CECO — Authentification Officielle</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,"IBM Plex Sans",sans-serif;background:#F5F7FA;color:#0B1C30;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box;}
        .card{background:white;padding:28px;border-radius:4px;box-shadow:0 8px 30px rgba(7,26,46,0.12);max-width:480px;width:100%;border:1px solid #D9E0E8;}
        .badge{display:inline-block;background:#E8F6F0;color:#16805A;padding:6px 12px;border-radius:2px;font-weight:bold;font-size:12px;margin-bottom:12px;border:1px solid rgba(22,128,90,0.25);}
        .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #D9E0E8;font-size:13px;}
        .label{color:#526173;} .val{font-weight:bold;text-align:right;}
        .header{border-bottom:2px solid #071A2E;padding-bottom:14px;margin-bottom:16px;text-align:center;}
        .footer{font-size:10px;color:#738195;text-align:center;margin-top:20px;font-family:monospace;word-break:break-all;line-height:1.4;}
        .ceco-foot{margin-top:16px;text-align:center;font-size:11px;font-weight:bold;color:#071A2E;}
      </style>
      </head><body>
      <div class="card">
        <div class="header">
          <div class="badge">✓ Document Officiel Authentique</div>
          <h2 style="margin:0;font-size:17px;color:#071A2E;">${doc.center?.name || "Établissement CECO"}</h2>
          <p style="margin:4px 0 0;font-size:11px;color:#526173;">Agrément : ${doc.center?.registrationNumber || "MINEFOP"} • ${doc.center?.city || "Cameroun"}</p>
        </div>
        <div class="row"><span class="label">Type de document :</span><span class="val">${doc.type}</span></div>
        <div class="row"><span class="label">Titulaire :</span><span class="val">${snap.student?.lastName || ""} ${snap.student?.firstName || ""}</span></div>
        <div class="row"><span class="label">Matricule :</span><span class="val" style="font-family:monospace;color:#071A2E;">${snap.student?.matricule || "—"}</span></div>
        <div class="row"><span class="label">Classe :</span><span class="val">${snap.classe?.label || "—"}</span></div>
        <div class="row"><span class="label">Date d'émission :</span><span class="val">${new Date(doc.generatedAt).toLocaleDateString("fr-FR")}</span></div>
        <div class="ceco-foot">REGISTRE DE CERTIFICATION SÉCURISÉ CECO</div>
        <div class="footer">Empreinte Cryptographique SHA-256 :<br>${doc.fileHash}</div>
      </div></body></html>
    `);
  } catch (err) {
    next(err);
  }
});

module.exports = router;