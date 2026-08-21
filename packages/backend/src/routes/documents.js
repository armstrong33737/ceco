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

const DEFAULT_TEMPLATE_CONFIG = {
  headerLeft: "RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\n----\nMINISTÈRE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE",
  headerRight: "REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\n----\nMINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING",
  subHeaderCenter: "DÉLÉGATION RÉGIONALE DE L'OUEST\nDÉLÉGATION DÉPARTEMENTALE DE LA MENOUA",
  showSeal: true,
  showLogo: true,
  showWatermark: true,
  watermarkType: "logo",
  watermarkOpacity: 0.08,
  primaryColor: "#0B1C30",
  signatories: [
    { title: "Le Chef de Département", roleKey: "directeur_pedagogique" },
    { title: "Le Directeur Général", roleKey: "directeur" },
  ],
  footerLegal: "Toute falsification du présent document expose son auteur aux sanctions prévues par le Code Pénal.",
};

// 1. Registre Centralisé des Documents Paginé avec Recherche
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

// 2. Templates graphiques actifs
router.get("/documents/templates/:type", verifyJwt, requirePermission("center.read", "center.update", "students.read"), async (req, res, next) => {
  try {
    const template = await prisma.documentTemplate.findUnique({
      where: { centerId_type: { centerId: req.centerId, type: req.params.type } },
    });
    res.json(template?.config || DEFAULT_TEMPLATE_CONFIG);
  } catch (err) {
    next(err);
  }
});

router.put("/documents/templates/:type", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { config } = req.body || {};
    const template = await prisma.documentTemplate.upsert({
      where: { centerId_type: { centerId: req.centerId, type: req.params.type } },
      update: { config, isActive: true },
      create: { centerId: req.centerId, type: req.params.type, config: config || {}, isActive: true },
    });
    res.json(template.config);
  } catch (err) {
    next(err);
  }
});

// 3. Génération d'acte individuel (Apprenant) avec Figeage Strict
router.post("/documents/generate", verifyJwt, requirePermission("students.read", "students.create"), async (req, res, next) => {
  try {
    const { studentId, type = "CARTE_ETUDIANT", classeId, forceRegenerate = false } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Identifiant apprenant requis." });

    await ensureStorageTree(req.centerId);

    const existingDoc = await prisma.document.findFirst({
      where: {
        centerId: req.centerId,
        studentId,
        type,
        ...(classeId ? { classeId } : {}),
      },
      orderBy: { generatedAt: "desc" },
    });

    if (!forceRegenerate && existingDoc) {
      if (fs.existsSync(existingDoc.filePath)) {
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

      // Reconstitution fidèle depuis le snapshot
      const host = req.get("host");
      const protocol = req.protocol;
      const verificationUrl = `${protocol}://${host}/verify/${existingDoc.qrToken}`;
      fs.mkdirSync(path.dirname(existingDoc.filePath), { recursive: true });

      if (type === "CARTE_ETUDIANT") {
        await generateStudentCardPdf(existingDoc.renderSnapshot, verificationUrl, existingDoc.filePath);
      } else if (type === "FICHE_INSCRIPTION") {
        await generateFicheInscriptionPdf(existingDoc.renderSnapshot, verificationUrl, existingDoc.filePath);
      } else {
        await generateAttestationPdf(existingDoc.renderSnapshot, verificationUrl, existingDoc.filePath);
      }

      return res.json({
        success: true,
        restored: true,
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

    const [center, template, student] = await Promise.all([
      prisma.center.findUnique({ where: { id: req.centerId } }),
      prisma.documentTemplate.findUnique({
        where: { centerId_type: { centerId: req.centerId, type } },
      }),
      prisma.student.findFirst({
        where: { id: studentId, centerId: req.centerId, deletedAt: null },
        include: {
          inscriptions: {
            where: classeId ? { classeId } : undefined,
            include: {
              classe: { include: { filiere: { include: { programType: true } }, niveau: true } },
              promotion: true,
              academicYear: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
    ]);

    if (!student) return res.status(404).json({ error: "Apprenant introuvable." });
    const inscription = student.inscriptions[0];
    if (!inscription) return res.status(400).json({ error: "Aucune inscription active trouvée pour cet apprenant." });

    const logoBase64 = getCenterLogoBase64(req.centerId, center?.logo);
    const sealBase64 = getCenterSealBase64(req.centerId);
    const studentPhotoBase64 = getStudentPhotoBase64(req.centerId, student.photoPath);
    const signatureDirecteur = getRoleSignatureBase64(req.centerId, "directeur");
    const signaturePedagogique = getRoleSignatureBase64(req.centerId, "directeur_pedagogique");

    const cuid = crypto.randomBytes(8).toString("hex");
    const hmacSig = crypto.createHmac("sha256", process.env.JWT_SECRET || "ceco_key")
      .update(`${cuid}:${student.matricule}:${type}`)
      .digest("hex").slice(0, 16);

    const qrToken = `${cuid}?t=${hmacSig}`;
    const host = req.get("host");
    const protocol = req.protocol;
    const verificationUrl = `${protocol}://${host}/verify/${qrToken}`;

    const renderSnapshot = {
      generatedAt: new Date().toISOString(),
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
        logoDataUrl: logoBase64,
        sealDataUrl: sealBase64,
        signatures: {
          directeur: signatureDirecteur,
          directeur_pedagogique: signaturePedagogique,
        },
      },
      templateConfig: template?.config || DEFAULT_TEMPLATE_CONFIG,
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
        photoDataUrl: studentPhotoBase64,
      },
      inscription: {
        classeId: inscription.classeId,
        classeLabel: inscription.classe?.label || "Classe",
        filiereName: inscription.classe?.filiere?.name || "Filière",
        programTypeCode: inscription.classe?.filiere?.programType?.code || "DQP",
        niveauOrder: inscription.classe?.niveau?.order || 1,
        academicYearLabel: inscription.academicYear?.label || "2026-2027",
        promotionLabel: inscription.promotion?.label || `Promotion ${inscription.academicYear?.label}`,
        status: inscription.status,
      },
      qrToken,
      verificationUrl,
    };

    const yearFolder = (inscription.academicYear?.label || "current").replace(/[^a-zA-Z0-9_-]/g, "_");
    const docFolder = centerStoragePath(req.centerId, "documents", yearFolder, type.toLowerCase());
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const pdfFileName = `${student.matricule}_${Date.now()}.pdf`;
    const fullPdfPath = path.join(docFolder, pdfFileName);

    if (type === "CARTE_ETUDIANT") {
      await generateStudentCardPdf(renderSnapshot, verificationUrl, fullPdfPath);
    } else if (type === "FICHE_INSCRIPTION") {
      await generateFicheInscriptionPdf(renderSnapshot, verificationUrl, fullPdfPath);
    } else {
      await generateAttestationPdf(renderSnapshot, verificationUrl, fullPdfPath);
    }

    const pdfBuffer = fs.readFileSync(fullPdfPath);
    const fileHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    const document = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type,
        studentId: student.id,
        classeId: inscription.classeId,
        filePath: fullPdfPath,
        fileHash,
        renderSnapshot,
        qrToken,
      },
    });

    res.json({
      success: true,
      document: {
        id: document.id,
        qrToken,
        fileHash,
        renderSnapshot,
        downloadUrl: `/documents/${document.id}/download`,
        previewUrl: `/documents/${document.id}/preview`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4. Prévisualisation directe & Reconstitution Automatique
router.get("/documents/:id/preview", verifyJwt, async (req, res, next) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
    });

    if (!doc) return res.status(404).json({ error: "Document introuvable." });

    // Reconstitution fidèle depuis le snapshot si le fichier sur disque a été effacé
    if (!fs.existsSync(doc.filePath)) {
      const host = req.get("host");
      const protocol = req.protocol;
      const verificationUrl = `${protocol}://${host}/verify/${doc.qrToken}`;
      fs.mkdirSync(path.dirname(doc.filePath), { recursive: true });

      if (doc.type.includes("CARTE_ETUDIANT")) {
        await generateStudentCardPdf(doc.renderSnapshot, verificationUrl, doc.filePath);
      } else if (doc.type.includes("FICHE_INSCRIPTION")) {
        await generateFicheInscriptionPdf(doc.renderSnapshot, verificationUrl, doc.filePath);
      } else if (doc.type.includes("BORDEREAU_VIERGE")) {
        await generateBlankGradeSheetPdf(doc.renderSnapshot, doc.filePath);
      } else if (doc.type.includes("PV_MATIERE")) {
        await generateCertifiedGradeSheetPdf(doc.renderSnapshot, verificationUrl, doc.filePath);
      } else if (doc.type.includes("PV_SEMESTRE") || doc.type.includes("PV_ANNUEL")) {
        await generateClassSemesterSummaryPdf(doc.renderSnapshot, verificationUrl, doc.filePath);
      } else {
        await generateAttestationPdf(doc.renderSnapshot, verificationUrl, doc.filePath);
      }
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(doc.filePath)}"`);
    fs.createReadStream(doc.filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// 5. Téléchargement physique
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

// 6. Page publique d'authentification QR Code Universelle (Smartphones)
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
        </head><body><div class="card"><h2>⚠️ Document Non Authentifié</h2><p>Ce document n'existe pas dans le registre cryptographique CECO ou a fait l'objet d'une altération physique.</p></div></body></html>
      `);
    }

    const snap = doc.renderSnapshot || {};

    // Affichage contextuel selon le type d'acte (Pédagogique vs Apprenant)
    let detailsHtml = "";
    if (doc.type === "PV_MATIERE") {
      detailsHtml = `
        <div class="row"><span class="label">Matière :</span><span class="val">${snap.offering?.subjectName || "—"}</span></div>
        <div class="row"><span class="label">Classe :</span><span class="val">${snap.offering?.classeLabel || "—"}</span></div>
        <div class="row"><span class="label">Formateur :</span><span class="val">${snap.offering?.formateurName || "—"}</span></div>
        <div class="row"><span class="label">Taux de réussite :</span><span class="val" style="color:#2DCE89;">${snap.stats?.successRate || "0"}%</span></div>
        <div class="row"><span class="label">Moyenne de classe :</span><span class="val">${snap.stats?.classAverage || "—"} / 20</span></div>
      `;
    } else if (doc.type === "PV_SEMESTRE" || doc.type === "PV_ANNUEL") {
      detailsHtml = `
        <div class="row"><span class="label">Classe :</span><span class="val">${snap.classe?.label || "—"}</span></div>
        <div class="row"><span class="label">Période de Délibération :</span><span class="val">${snap.periodLabel || "Semestre"}</span></div>
        <div class="row"><span class="label">Effectif Délibéré :</span><span class="val">${snap.summaries?.length || 0} apprenants</span></div>
      `;
    } else {
      detailsHtml = `
        <div class="row"><span class="label">Titulaire :</span><span class="val">${snap.student?.lastName || ""} ${snap.student?.firstName || ""}</span></div>
        <div class="row"><span class="label">Matricule :</span><span class="val" style="font-family:monospace;color:#5E72E4;">${snap.student?.matricule || "—"}</span></div>
        <div class="row"><span class="label">Filière d'études :</span><span class="val">${snap.inscription?.filiereName || "—"}</span></div>
        <div class="row"><span class="label">Promotion (Cohorte) :</span><span class="val">${snap.inscription?.promotionLabel || "—"}</span></div>
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
          <div class="badge">✓ Document Officiel Certifié</div>
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