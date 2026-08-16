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

// 1. Templates graphiques actifs
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

// 2. Génération / Réutilisation avec Figeage Strict du Document (Immuabilité)
router.post("/documents/generate", verifyJwt, requirePermission("students.read", "students.create"), async (req, res, next) => {
  try {
    const { studentId, type = "CARTE_ETUDIANT", classeId, forceRegenerate = false } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Identifiant apprenant requis." });

    await ensureStorageTree(req.centerId);

    // VÉRIFICATION D'UN DOCUMENT DÉJÀ ÉMIS (Évite la multiplication de fichiers)
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
      // Cas 1 : Le fichier physique existe déjà sur disque -> On le sert directement sans regénérer
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

      // Cas 2 : Le fichier physique a été effacé -> Régénération STRICTE depuis le snapshot figé en DB
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

    // NOUVELLE ÉMISSION : Résolution et figeage du snapshot
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

    // QR Token unique et scellé
    const cuid = crypto.randomBytes(8).toString("hex");
    const hmacSig = crypto.createHmac("sha256", process.env.JWT_SECRET || "ceco_key")
      .update(`${cuid}:${student.matricule}:${type}`)
      .digest("hex").slice(0, 16);

    const qrToken = `${cuid}?t=${hmacSig}`;
    const host = req.get("host");
    const protocol = req.protocol;
    const verificationUrl = `${protocol}://${host}/verify/${qrToken}`;

    // Le renderSnapshot fige TOUT ce qui est nécessaire pour reproduire le PDF des années plus tard
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
    console.error("[Documents Generate Error]", err);
    next(err);
  }
});

// 3. Impression groupée par classe (ICI EST PLACÉ VOTRE BLOC DE CODE)
router.post("/documents/generate-batch", verifyJwt, requirePermission("students.read", "students.create"), async (req, res, next) => {
  try {
    const { classeId, type = "CARTE_ETUDIANT" } = req.body || {};
    if (!classeId) return res.status(400).json({ error: "Classe requise." });

    await ensureStorageTree(req.centerId);

    const [center, template, classe] = await Promise.all([
      prisma.center.findUnique({ where: { id: req.centerId } }),
      prisma.documentTemplate.findUnique({
        where: { centerId_type: { centerId: req.centerId, type } },
      }),
      prisma.classe.findFirst({
        where: { id: classeId, centerId: req.centerId },
        include: {
          filiere: { include: { programType: true } },
          niveau: true,
          academicYear: true,
          inscriptions: {
            where: { student: { deletedAt: null } },
            include: { student: true, promotion: true },
            orderBy: { student: { lastName: "asc" } },
          },
        },
      }),
    ]);

    if (!classe) return res.status(404).json({ error: "Classe introuvable." });
    if (classe.inscriptions.length === 0) {
      return res.status(400).json({ error: "Aucun apprenant inscrit dans cette classe." });
    }

    const logoBase64 = getCenterLogoBase64(req.centerId, center?.logo);
    const sealBase64 = getCenterSealBase64(req.centerId);
    const signatureDirecteur = getRoleSignatureBase64(req.centerId, "directeur");
    const signaturePedagogique = getRoleSignatureBase64(req.centerId, "directeur_pedagogique");

    const yearFolder = (classe.academicYear?.label || "current").replace(/[^a-zA-Z0-9_-]/g, "_");
    const docFolder = centerStoragePath(req.centerId, "documents", yearFolder, type.toLowerCase());
    if (!fs.existsSync(docFolder)) fs.mkdirSync(docFolder, { recursive: true });

    const host = req.get("host");
    const protocol = req.protocol;

    const snapshotsList = [];
    const qrUrlsList = [];

    for (const insc of classe.inscriptions) {
      const student = insc.student;
      const studentPhotoBase64 = getStudentPhotoBase64(req.centerId, student.photoPath);

      const cuid = crypto.randomBytes(8).toString("hex");
      const hmacSig = crypto.createHmac("sha256", process.env.JWT_SECRET || "ceco_key")
        .update(`${cuid}:${student.matricule}:${type}`)
        .digest("hex").slice(0, 16);

      const qrToken = `${cuid}?t=${hmacSig}`;
      const verificationUrl = `${protocol}://${host}/verify/${qrToken}`;

      const snapshot = {
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
          classeId: classe.id,
          classeLabel: classe.label,
          filiereName: classe.filiere?.name || "Filière",
          programTypeCode: classe.filiere?.programType?.code || "DQP",
          niveauOrder: classe.niveau?.order || 1,
          academicYearLabel: classe.academicYear?.label || "2026-2027",
          promotionLabel: insc.promotion?.label || `Promotion ${classe.academicYear?.label}`,
          status: insc.status,
        },
        qrToken,
        verificationUrl,
      };

      snapshotsList.push(snapshot);
      qrUrlsList.push(verificationUrl);
    }

    // =========================================================================
    // VOTRE BLOC DE CODE PLACÉ ICI : COMPILATION DU FICHIER PDF GROUPÉ
    // =========================================================================
    const batchPdfFileName = `BATCH_${type}_${classe.label.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.pdf`;
    const fullBatchPdfPath = path.join(docFolder, batchPdfFileName);

    if (type === "CARTE_ETUDIANT") {
      await generateBatchCardsSheetPdf(snapshotsList, qrUrlsList, fullBatchPdfPath);
    } else {
      await generateBatchAttestationsPdf(snapshotsList, qrUrlsList, fullBatchPdfPath);
    }
    // =========================================================================

    const pdfBuffer = fs.readFileSync(fullBatchPdfPath);
    const fileHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    const batchDocument = await prisma.document.create({
      data: {
        centerId: req.centerId,
        type: `BATCH_${type}`,
        classeId: classe.id,
        filePath: fullBatchPdfPath,
        fileHash,
        renderSnapshot: { count: snapshotsList.length, classeLabel: classe.label },
        qrToken: `BATCH-${classe.id}-${Date.now()}`,
      },
    });

    res.json({
      success: true,
      count: snapshotsList.length,
      batchDocument: {
        id: batchDocument.id,
        downloadUrl: `/documents/${batchDocument.id}/download`,
        previewUrl: `/documents/${batchDocument.id}/preview`,
      },
    });
  } catch (err) {
    console.error("[Batch Error]", err);
    next(err);
  }
});

// 4. Prévisualisation directe
router.get("/documents/:id/preview", verifyJwt, async (req, res, next) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
    });

    if (!doc) return res.status(404).json({ error: "Document introuvable." });

    // Si le fichier physique a été effacé du disque -> Reconstitution fidèle depuis renderSnapshot
    if (!fs.existsSync(doc.filePath)) {
      const host = req.get("host");
      const protocol = req.protocol;
      const verificationUrl = `${protocol}://${host}/verify/${doc.qrToken}`;
      fs.mkdirSync(path.dirname(doc.filePath), { recursive: true });

      if (doc.type.includes("CARTE_ETUDIANT")) {
        await generateStudentCardPdf(doc.renderSnapshot, verificationUrl, doc.filePath);
      } else if (doc.type.includes("FICHE_INSCRIPTION")) {
        await generateFicheInscriptionPdf(doc.renderSnapshot, verificationUrl, doc.filePath);
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

// 5. Téléchargement
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

// 6. Page publique d'authentification QR Code (Scan Smartphone)
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
        <html lang="fr"><head><meta charset="utf-8"><title>CECO — Document Non Authentifié</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>body{font-family:sans-serif;background:#FEEBEF;color:#F5365C;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:16px;}
        .card{background:white;padding:28px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:400px;text-align:center;border:1px solid #F5365C;}</style>
        </head><body><div class="card"><h2>⚠️ Document Non Authentifié</h2><p>Ce document n'existe pas dans le registre sécurisé CECO ou a fait l'objet d'une altération.</p></div></body></html>
      `);
    }

    const snap = doc.renderSnapshot || {};

    res.send(`
      <!DOCTYPE html>
      <html lang="fr"><head><meta charset="utf-8"><title>CECO — Authentification Officielle</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#F8F9FF;color:#0B1C30;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box;}
        .card{background:white;padding:28px;border-radius:12px;box-shadow:0 8px 30px rgba(94,114,228,0.15);max-width:480px;width:100%;border:1px solid #E2E5F1;}
        .badge{display:inline-block;background:#E6FAF1;color:#2DCE89;padding:4px 10px;border-radius:6px;font-weight:bold;font-size:12px;margin-bottom:12px;}
        .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEF1FD;font-size:13px;}
        .label{color:#43474F;} .val{font-weight:bold;text-align:right;}
        .header{border-bottom:2px solid #5E72E4;padding-bottom:12px;margin-bottom:16px;text-align:center;}
        .footer{font-size:11px;color:#94A3B8;text-align:center;margin-top:20px;font-family:monospace;word-break:break-all;}
      </style>
      </head><body>
      <div class="card">
        <div class="header">
          <div class="badge">✓ Document Officiel Certifié</div>
          <h2 style="margin:0;font-size:16px;color:#5E72E4;">${doc.center.name}</h2>
          <p style="margin:4px 0 0;font-size:11px;color:#43474F;">Agrément : ${doc.center.registrationNumber || "MINEFOP"}</p>
        </div>
        <div class="row"><span class="label">Type de document :</span><span class="val">${doc.type}</span></div>
        <div class="row"><span class="label">Apprenant :</span><span class="val">${snap.student?.lastName || ""} ${snap.student?.firstName || ""}</span></div>
        <div class="row"><span class="label">Matricule :</span><span class="val" style="font-family:monospace;color:#5E72E4;">${snap.student?.matricule || "—"}</span></div>
        <div class="row"><span class="label">Filière :</span><span class="val">${snap.inscription?.filiereName || "—"}</span></div>
        <div class="row"><span class="label">Niveau de parcours :</span><span class="val">Niveau ${snap.inscription?.niveauOrder || "—"} (${snap.inscription?.programTypeCode || "DQP"})</span></div>
        <div class="row"><span class="label">Session Académique :</span><span class="val">${snap.inscription?.academicYearLabel || "—"}</span></div>
        <div class="row"><span class="label">Date d'émission :</span><span class="val">${new Date(doc.generatedAt).toLocaleDateString("fr-FR")}</span></div>
        <div class="footer">Empreinte SHA-256 :<br>${doc.fileHash}</div>
      </div></body></html>
    `);
  } catch (err) {
    next(err);
  }
});

module.exports = router;