// packages/backend/src/routes/documents.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { centerStoragePath, ensureStorageTree } = require("../storage/paths");
const {
  generateStudentCardPdf,
  generateBatchCardsSheetPdf,
  generateAttestationPdf,
  generateBatchAttestationsPdf,
  generateFicheInscriptionPdf,
  generateBlankGradeSheetPdf,
  generateCertifiedGradeSheetPdf,
  generateClassSemesterSummaryPdf,
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
  if (!fs.existsSync(brandingDir)) return null;
  const files = fs.readdirSync(brandingDir);
  const sealFile = files.find((f) => f.startsWith("seal."));
  if (sealFile) {
    const ext = path.extname(sealFile).replace(".", "").toLowerCase();
    const mime = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${fs.readFileSync(path.join(brandingDir, sealFile)).toString("base64")}`;
  }
  return null;
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

// Générateur du contenu textuel du QR Code 100% autonome et vérifiable hors-ligne
function generateOfflineQrPayload(snapshot, docType) {
  const c = snapshot.center || {};
  const s = snapshot.student || {};
  const cl = snapshot.classe || snapshot.inscription || {};
  const t = snapshot.totals || {};
  const p = snapshot.period || {};

  let resultDetail = "";
  if (docType === "BULLETIN_SEMESTRE" || docType === "BULLETIN_CC") {
    resultDetail = `Moyenne: ${t.overallAverage !== null ? t.overallAverage + "/20" : "—"} (Rang: ${t.rank ? t.rank + "e/" + t.totalStudents : "—"})`;
  } else if (docType === "RELEVE_ANNUEL") {
    resultDetail = `Moyenne Annuelle: ${t.overallAverage !== null ? t.overallAverage + "/20" : "—"} | Décision: ${t.decision || "—"}`;
  } else if (docType === "DIPLOME_FIN_FORMATION") {
    resultDetail = `Mention: ${t.mention || "Passable"} | Statut: DIPLÔMÉ`;
  } else if (docType === "ATTESTATION_INSCRIPTION" || docType === "CARTE_ETUDIANT") {
    resultDetail = `Statut: Régulièrement inscrit (${cl.status || "en_cours"})`;
  }

  return [
    `=== CERTIFICATION OFFICIELLE CECO ===`,
    `Centre: ${c.name || "Établissement de Formation"}`,
    `Agrément: ${c.registrationNumber || "MINEFOP"} - ${c.city || "Cameroun"}`,
    `Document: ${docType}`,
    `Titulaire: ${s.lastName || ""} ${s.firstName || ""}`,
    `Matricule: ${s.matricule || "—"}`,
    `Filière: ${cl.filiereName || "—"} (${cl.programTypeCode || "DQP"})`,
    `Session: ${cl.academicYearLabel || "—"}${p.label ? " - " + p.label : ""}`,
    resultDetail,
    `Émis le: ${new Date().toLocaleDateString("fr-FR")}`,
    `Sceau ID: ${snapshot.qrToken || "OFFICIAL-CECO"}`,
    `=====================================`,
  ].filter(Boolean).join("\n");
}

const DEFAULT_FAMILY_CONFIGS = {
  CARTE: {
    themeColor: "#0B1C30",
    accentColor: "#5E72E4",
    cardTitle: "CARTE D'APPRENANT OFFICIELLE",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "logo",
    watermarkOpacity: 0.08,
    termsOfUse: "Cette carte est strictement personnelle et obligatoire pour l'accès aux cours, ateliers et examens. En cas de perte, signaler immédiatement à la direction.",
    signatoryTitle: "Le Directeur Général",
  },
  INTERNE: {
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING",
    subHeaderCenter: "DÉLÉGATION RÉGIONALE DU CENTRE\nDÉLÉGATION DÉPARTEMENTALE DU MFOUNDI",
    primaryColor: "#0B1C30",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "logo",
    watermarkOpacity: 0.06,
    engagementText: "Je soussigné(e), certifie sur l'honneur l'exactitude des renseignements fournis et m'engage au respect intégral du règlement intérieur de l'établissement.",
    signatories: [
      { title: "Signature de l'Apprenant(e)", roleKey: "student" },
      { title: "Visa de la Direction", roleKey: "directeur" },
    ],
    footerLegal: "Document administratif interne non diffusable à l'extérieur • CECO ERP",
  },
  EXTERNE: {
    headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE",
    headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING",
    subHeaderCenter: "DÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA",
    primaryColor: "#0B1C30",
    showLogo: true,
    showSeal: true,
    showWatermark: true,
    watermarkType: "seal",
    watermarkOpacity: 0.08,
    signatories: [
      { title: "Le Directeur des Études", roleKey: "directeur_pedagogique" },
      { title: "Le Directeur Général", roleKey: "directeur" },
    ],
    footerLegal: "Toute falsification ou altération du présent document expose son auteur aux poursuites prévues par le Code Pénal.",
  },
};

// 1. Registre Centralisé des Documents Paginé
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

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(5, parseInt(limit) || 25));
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

// 2. Gestion des Gabarits par type ou Famille (CARTE, INTERNE, EXTERNE)
router.get("/documents/templates/:type", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
  try {
    const { type } = req.params;
    const template = await prisma.documentTemplate.findUnique({
      where: { centerId_type: { centerId: req.centerId, type } },
    });

    if (template?.config) {
      return res.json(template.config);
    }

    if (type.startsWith("CARTE")) {
      return res.json(DEFAULT_FAMILY_CONFIGS.CARTE);
    }
    if (["FICHE_INSCRIPTION", "BORDEREAU_VIERGE", "PV_MATIERE", "PV_SEMESTRE", "PV_ANNUEL"].includes(type)) {
      return res.json(DEFAULT_FAMILY_CONFIGS.INTERNE);
    }
    return res.json(DEFAULT_FAMILY_CONFIGS.EXTERNE);
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

// Helper pour préparer les données complètes de calcul pour les bulletins et relevés
async function buildStudentAcademicSnapshot(centerId, studentId, classeId, gradePeriodId) {
  const [center, student, classe, period, offerings, results, grades, delibs, allStudentsInscs] = await Promise.all([
    prisma.center.findUnique({ where: { id: centerId } }),
    prisma.student.findFirst({
      where: { id: studentId, centerId, deletedAt: null },
      include: {
        inscriptions: {
          where: { classeId },
          include: { promotion: true, academicYear: true },
        },
      },
    }),
    prisma.classe.findFirst({
      where: { id: classeId, centerId },
      include: {
        filiere: { include: { programType: true } },
        niveau: true,
        academicYear: true,
      },
    }),
    gradePeriodId ? prisma.gradePeriod.findUnique({ where: { id: gradePeriodId } }) : null,
    prisma.subjectOffering.findMany({
      where: {
        classeId,
        ...(gradePeriodId ? { gradePeriodId } : {}),
      },
      include: { subject: true, category: true, formateur: true, gradePeriod: true },
      orderBy: [{ gradePeriod: { order: "asc" } }, { category: { order: "asc" } }, { subject: { name: "asc" } }],
    }),
    prisma.subjectResult.findMany({
      where: {
        centerId,
        ...(gradePeriodId ? { gradePeriodId } : {}),
      },
    }),
    prisma.grade.findMany({
      where: {
        centerId,
        ...(gradePeriodId ? { gradePeriodId } : {}),
      },
    }),
    prisma.deliberation.findMany({
      where: {
        classeId,
        centerId,
        ...(gradePeriodId ? { gradePeriodId } : { scope: "ANNUEL" }),
      },
      include: { studentResults: true },
    }),
    prisma.inscription.findMany({
      where: { classeId, centerId, student: { deletedAt: null } },
      include: { student: true },
    }),
  ]);

  if (!student || !classe) return null;

  const currentInsc = student.inscriptions[0] || {};

  // Profil de classe (Statistiques calculées pour l'ensemble de la classe)
  const classAverages = [];
  allStudentsInscs.forEach((inscItem) => {
    const stResults = results.filter((r) => r.studentId === inscItem.studentId && offerings.some((o) => o.subjectId === r.subjectId));
    let pts = 0;
    let coeffs = 0;
    offerings.forEach((off) => {
      const res = stResults.find((r) => r.subjectId === off.subjectId);
      if (res && res.finalGrade !== null) {
        pts += res.finalGrade * off.coefficient;
        coeffs += off.coefficient;
      }
    });
    if (coeffs > 0) {
      classAverages.push({
        studentId: inscItem.studentId,
        avg: Number((pts / coeffs).toFixed(2)),
      });
    }
  });

  classAverages.sort((a, b) => b.avg - a.avg);
  const highestClassAvg = classAverages.length > 0 ? classAverages[0].avg : null;
  const lowestClassAvg = classAverages.length > 0 ? classAverages[classAverages.length - 1].avg : null;
  const classMean = classAverages.length > 0
    ? Number((classAverages.reduce((s, c) => s + c.avg, 0) / classAverages.length).toFixed(2))
    : null;

  const studentResults = results.filter((r) => r.studentId === student.id);
  const studentGrades = grades.filter((g) => g.studentId === student.id);

  // Ventilation par groupes / catégories
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
    const subRes = studentResults.find((r) => r.subjectId === off.subjectId && (!gradePeriodId || r.gradePeriodId === off.gradePeriodId));
    const subGrades = studentGrades.filter((g) => g.subjectOfferingId === off.id);

    const cc1 = subGrades.find((g) => g.label === "CC1");
    const cc2 = subGrades.find((g) => g.label === "CC2");
    const norm = subGrades.find((g) => g.evaluationType === "NORMALE");
    const ratt = subGrades.find((g) => g.evaluationType === "RATTRAPAGE");

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

    group.subjects.push({
      subjectId: off.subjectId,
      code: off.subject?.code || "—",
      name: off.subject?.name,
      coefficient: off.coefficient,
      volumeHoraire: off.volumeHoraire,
      formateurName: off.formateur ? `${off.formateur.firstName} ${off.formateur.lastName}` : null,
      cc1: cc1 ? (cc1.isAbsent ? (cc1.absenceReason === "JUSTIFIED" ? "ABS (Just.)" : "0.00") : cc1.value.toFixed(2)) : "—",
      cc2: cc2 ? (cc2.isAbsent ? (cc2.absenceReason === "JUSTIFIED" ? "ABS (Just.)" : "0.00") : cc2.value.toFixed(2)) : "—",
      ccAverage: subRes?.ccAverage !== null && subRes?.ccAverage !== undefined ? subRes.ccAverage.toFixed(2) : "—",
      examGrade: norm ? (norm.isAbsent ? (norm.absenceReason === "JUSTIFIED" ? "ABS (Just.)" : "0.00") : norm.value.toFixed(2)) : "—",
      rattrapage: ratt ? ratt.value.toFixed(2) : "—",
      finalGrade: finalGradeVal !== null ? finalGradeVal.toFixed(2) : "—",
      points: points !== null ? points.toFixed(2) : "—",
      appreciation: getGradeAppreciation(finalGradeVal),
    });
  });

  const categories = Array.from(categoriesMap.values()).sort((a, b) => a.order - b.order);
  categories.forEach((cat) => {
    cat.groupAverage = cat.totalCoeff > 0 ? Number((cat.totalPoints / cat.totalCoeff).toFixed(2)) : null;
  });

  const studentOverallAverage = grandTotalCoeff > 0 ? Number((grandTotalPoints / grandTotalCoeff).toFixed(2)) : null;
  const studentRank = studentOverallAverage !== null ? classAverages.findIndex((c) => c.studentId === student.id) + 1 : null;

  // Résolution souveraine de la décision du jury
  let juryDecision = currentInsc.status || "en_cours";
  const activeDelib = delibs[0];
  const stDelib = activeDelib?.studentResults?.find((d) => d.studentId === student.id);
  if (stDelib) {
    juryDecision = stDelib.decision;
  }

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
      directorName: center.directorName,
      directorTitle: center.directorTitle || "Le Directeur Général",
      logoDataUrl: getCenterLogoBase64(centerId, center.logo),
      sealDataUrl: getCenterSealBase64(centerId),
      signatures: {
        directeur: getRoleSignatureBase64(centerId, "directeur"),
        directeur_pedagogique: getRoleSignatureBase64(centerId, "directeur_pedagogique"),
      },
    },
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
    } : { label: `Année ${classe.academicYear?.label}`, type: "ANNUEL" },
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
      hasEliminatory,
      decision: juryDecision,
      mention: getDiplomaMention(studentOverallAverage),
    },
  };
}

// 3. Génération d'un document individuel
router.post("/documents/generate", verifyJwt, requirePermission("students.read", "grades.read", "bulletins.generate"), async (req, res, next) => {
  try {
    const { studentId, type = "CARTE_ETUDIANT", classeId, gradePeriodId, forceRegenerate = false } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Identifiant apprenant requis." });

    await ensureStorageTree(req.centerId);

    const existingDoc = await prisma.document.findFirst({
      where: {
        centerId: req.centerId,
        studentId,
        type,
        ...(classeId ? { classeId } : {}),
        ...(gradePeriodId ? { qrToken: { contains: gradePeriodId } } : {}),
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

    let targetClasseId = classeId;
    if (!targetClasseId) {
      const st = await prisma.student.findUnique({
        where: { id: studentId },
        include: { inscriptions: { orderBy: { createdAt: "desc" } } },
      });
      targetClasseId = st?.inscriptions[0]?.classeId;
    }
    if (!targetClasseId) return res.status(400).json({ error: "Aucune classe active trouvée pour cet apprenant." });

    const template = await prisma.documentTemplate.findUnique({
      where: { centerId_type: { centerId: req.centerId, type } },
    });
    const templateConfig = template?.config || (
      type.startsWith("CARTE") ? DEFAULT_FAMILY_CONFIGS.CARTE :
      ["FICHE_INSCRIPTION", "BORDEREAU_VIERGE", "PV_MATIERE", "PV_SEMESTRE", "PV_ANNUEL"].includes(type) ? DEFAULT_FAMILY_CONFIGS.INTERNE :
      DEFAULT_FAMILY_CONFIGS.EXTERNE
    );

    const snapshot = await buildStudentAcademicSnapshot(req.centerId, studentId, targetClasseId, gradePeriodId);
    if (!snapshot) return res.status(404).json({ error: "Données académiques introuvables." });

    snapshot.templateConfig = templateConfig;

    // Token unique cryptographique
    const cuid = crypto.randomBytes(8).toString("hex");
    const hmacSig = crypto.createHmac("sha256", process.env.JWT_SECRET || "ceco_key")
      .update(`${cuid}:${snapshot.student.matricule}:${type}:${gradePeriodId || "ANNUEL"}`)
      .digest("hex").slice(0, 16);

    const isExternalDoc = type.startsWith("CARTE") || ["ATTESTATION_INSCRIPTION", "BULLETIN_CC", "BULLETIN_SEMESTRE", "RELEVE_ANNUEL", "DIPLOME_FIN_FORMATION"].includes(type);
    const qrToken = `${cuid}?t=${hmacSig}&st=${snapshot.student.matricule}&doc=${type}`;
    snapshot.qrToken = qrToken;

    // Le QR code encode le certificat textuel structuré hors-ligne pour les documents externes
    const offlinePayload = isExternalDoc ? generateOfflineQrPayload(snapshot, type) : null;
    snapshot.offlineQrPayload = offlinePayload;

    const yearFolder = (snapshot.classe.academicYearLabel || "current").replace(/[^a-zA-Z0-9_-]/g, "_");
    const docFolder = centerStoragePath(req.centerId, "documents", yearFolder, type.toLowerCase());
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const pdfFileName = `${snapshot.student.matricule}_${type}_${Date.now()}.pdf`;
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

// 4. Génération groupée pour toute une classe (Livrets PDF)
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
      ["FICHE_INSCRIPTION", "BORDEREAU_VIERGE", "PV_MATIERE", "PV_SEMESTRE", "PV_ANNUEL"].includes(type) ? DEFAULT_FAMILY_CONFIGS.INTERNE :
      DEFAULT_FAMILY_CONFIGS.EXTERNE
    );

    const isExternalDoc = type.startsWith("CARTE") || ["ATTESTATION_INSCRIPTION", "BULLETIN_CC", "BULLETIN_SEMESTRE", "RELEVE_ANNUEL", "DIPLOME_FIN_FORMATION"].includes(type);
    const snapshotsList = [];
    const qrPayloadsList = [];

    for (const insc of classe.inscriptions) {
      const snap = await buildStudentAcademicSnapshot(req.centerId, insc.studentId, classeId, gradePeriodId);
      if (snap) {
        snap.templateConfig = templateConfig;
        const cuid = crypto.randomBytes(8).toString("hex");
        const hmacSig = crypto.createHmac("sha256", process.env.JWT_SECRET || "ceco_key")
          .update(`${cuid}:${snap.student.matricule}:${type}`)
          .digest("hex").slice(0, 16);
        const qrToken = `${cuid}?t=${hmacSig}&st=${snap.student.matricule}&batch=1`;
        snap.qrToken = qrToken;

        const offlinePayload = isExternalDoc ? generateOfflineQrPayload(snap, type) : null;
        snap.offlineQrPayload = offlinePayload;

        snapshotsList.push(snap);
        qrPayloadsList.push(offlinePayload);
      }
    }

    const yearFolder = (classe.academicYear?.label || "current").replace(/[^a-zA-Z0-9_-]/g, "_");
    const docFolder = centerStoragePath(req.centerId, "documents", yearFolder, "batches");
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const batchFileName = `BATCH_${type}_${classe.label.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.pdf`;
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
    const batchQrToken = `BATCH-${classe.id}-${type}-${Date.now()}`;

    const batchDoc = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type: `LIVRET_${type}`,
        classeId: classe.id,
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

// 5. Prévisualisation directe & Reconstitution Fidèle depuis Snapshot
router.get("/documents/:id/preview", verifyJwt, async (req, res, next) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
    });

    if (!doc) return res.status(404).json({ error: "Document introuvable." });

    if (!fs.existsSync(doc.filePath)) {
      const offlinePayload = doc.renderSnapshot?.offlineQrPayload || generateOfflineQrPayload(doc.renderSnapshot, doc.type);
      fs.mkdirSync(path.dirname(doc.filePath), { recursive: true });

      if (doc.type === "CARTE_ETUDIANT") {
        await generateStudentCardPdf(doc.renderSnapshot, offlinePayload, doc.filePath);
      } else if (doc.type === "FICHE_INSCRIPTION") {
        await generateFicheInscriptionPdf(doc.renderSnapshot, doc.filePath);
      } else if (doc.type === "BORDEREAU_VIERGE") {
        await generateBlankGradeSheetPdf(doc.renderSnapshot, doc.filePath);
      } else if (doc.type === "PV_MATIERE") {
        await generateCertifiedGradeSheetPdf(doc.renderSnapshot, offlinePayload, doc.filePath);
      } else if (doc.type === "PV_SEMESTRE" || doc.type === "PV_ANNUEL") {
        await generateClassSemesterSummaryPdf(doc.renderSnapshot, offlinePayload, doc.filePath);
      } else if (doc.type === "BULLETIN_CC") {
        await generateContinuousAssessmentBulletinPdf(doc.renderSnapshot, offlinePayload, doc.filePath);
      } else if (doc.type === "BULLETIN_SEMESTRE") {
        await generateSemesterBulletinPdf(doc.renderSnapshot, offlinePayload, doc.filePath);
      } else if (doc.type === "RELEVE_ANNUEL") {
        await generateAnnualTranscriptPdf(doc.renderSnapshot, offlinePayload, doc.filePath);
      } else if (doc.type === "DIPLOME_FIN_FORMATION") {
        await generateGraduationDiplomaPdf(doc.renderSnapshot, offlinePayload, doc.filePath);
      } else {
        await generateAttestationPdf(doc.renderSnapshot, offlinePayload, doc.filePath);
      }
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(doc.filePath)}"`);
    fs.createReadStream(doc.filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// 6. Téléchargement physique
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

// 7. Page publique d'authentification web en repli
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
        <style>body{font-family:sans-serif;background:#FEEBEF;color:#F5365C;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:16px;}
        .card{background:white;padding:28px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:400px;text-align:center;border:1.5px solid #F5365C;}</style>
        </head><body><div class="card"><h2>⚠️ Document Non Authentifié</h2><p>Ce document n'existe pas dans le registre cryptographique CECO ou a fait l'objet d'une altération.</p></div></body></html>
      `);
    }

    const snap = doc.renderSnapshot || {};
    let detailsHtml = "";

    if (doc.type === "BULLETIN_SEMESTRE" || doc.type === "BULLETIN_CC") {
      detailsHtml = `
        <div class="row"><span class="label">Titulaire :</span><span class="val">${snap.student?.lastName || ""} ${snap.student?.firstName || ""}</span></div>
        <div class="row"><span class="label">Matricule :</span><span class="val" style="font-family:monospace;color:#5E72E4;">${snap.student?.matricule || "—"}</span></div>
        <div class="row"><span class="label">Classe :</span><span class="val">${snap.classe?.label || "—"}</span></div>
        <div class="row"><span class="label">Période :</span><span class="val">${snap.period?.label || "Semestre"}</span></div>
        <div class="row"><span class="label">Moyenne Générale :</span><span class="val" style="color:#5E72E4;font-size:15px;">${snap.totals?.overallAverage !== null ? `${snap.totals.overallAverage} / 20` : "—"}</span></div>
        <div class="row"><span class="label">Rang :</span><span class="val">${snap.totals?.rank ? `${snap.totals.rank}e sur ${snap.totals.totalStudents}` : "—"}</span></div>
      `;
    } else if (doc.type === "RELEVE_ANNUEL") {
      detailsHtml = `
        <div class="row"><span class="label">Titulaire :</span><span class="val">${snap.student?.lastName || ""} ${snap.student?.firstName || ""}</span></div>
        <div class="row"><span class="label">Matricule :</span><span class="val" style="font-family:monospace;color:#5E72E4;">${snap.student?.matricule || "—"}</span></div>
        <div class="row"><span class="label">Filière :</span><span class="val">${snap.classe?.filiereName || "—"}</span></div>
        <div class="row"><span class="label">Moyenne Annuelle :</span><span class="val" style="color:#5E72E4;font-size:15px;">${snap.totals?.overallAverage !== null ? `${snap.totals.overallAverage} / 20` : "—"}</span></div>
        <div class="row"><span class="label">Décision du Jury :</span><span class="val" style="color:#2DCE89;text-transform:uppercase;">${snap.totals?.decision || "—"}</span></div>
      `;
    } else if (doc.type === "DIPLOME_FIN_FORMATION") {
      detailsHtml = `
        <div class="row"><span class="label">Récipiendaire :</span><span class="val">${snap.student?.lastName || ""} ${snap.student?.firstName || ""}</span></div>
        <div class="row"><span class="label">Matricule :</span><span class="val" style="font-family:monospace;color:#5E72E4;">${snap.student?.matricule || "—"}</span></div>
        <div class="row"><span class="label">Filière :</span><span class="val">${snap.classe?.filiereName || "—"}</span></div>
        <div class="row"><span class="label">Cycle :</span><span class="val">${snap.classe?.programTypeCode || "DQP"}</span></div>
        <div class="row"><span class="label">Mention :</span><span class="val" style="color:#2DCE89;font-weight:bold;">${snap.totals?.mention || "Passable"}</span></div>
      `;
    } else {
      detailsHtml = `
        <div class="row"><span class="label">Titulaire :</span><span class="val">${snap.student?.lastName || ""} ${snap.student?.firstName || ""}</span></div>
        <div class="row"><span class="label">Matricule :</span><span class="val" style="font-family:monospace;color:#5E72E4;">${snap.student?.matricule || "—"}</span></div>
        <div class="row"><span class="label">Classe / Filière :</span><span class="val">${snap.inscription?.filiereName || snap.classe?.label || "—"}</span></div>
      `;
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="fr"><head><meta charset="utf-8"><title>CECO — Authentification Officielle</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#F8F9FF;color:#0B1C30;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box;}
        .card{background:white;padding:28px;border-radius:12px;box-shadow:0 8px 30px rgba(94,114,228,0.15);max-width:480px;width:100%;border:1px solid #E2E5F1;}
        .badge{display:inline-block;background:#E6FAF1;color:#2DCE89;padding:6px 12px;border-radius:6px;font-weight:bold;font-size:12px;margin-bottom:12px;border:1px solid rgba(45,206,137,0.25);}
        .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #EEF1FD;font-size:13px;}
        .label{color:#43474F;} .val{font-weight:bold;text-align:right;}
        .header{border-bottom:2px solid #5E72E4;padding-bottom:14px;margin-bottom:16px;text-align:center;}
        .footer{font-size:10px;color:#94A3B8;text-align:center;margin-top:20px;font-family:monospace;word-break:break-all;line-height:1.4;}
        .ceco-foot{margin-top:16px;text-align:center;font-size:11px;font-weight:bold;color:#5E72E4;}
      </style>
      </head><body>
      <div class="card">
        <div class="header">
          <div class="badge">✓ Document Officiel Authentique</div>
          <h2 style="margin:0;font-size:17px;color:#0B1C30;">${doc.center.name}</h2>
          <p style="margin:4px 0 0;font-size:11px;color:#43474F;">Agrément : ${doc.center.registrationNumber || "MINEFOP"} • ${doc.center.city || "Cameroun"}</p>
        </div>
        <div class="row"><span class="label">Type de document :</span><span class="val">${doc.type}</span></div>
        ${detailsHtml}
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