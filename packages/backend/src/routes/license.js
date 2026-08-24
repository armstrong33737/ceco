// packages/backend/src/routes/license.js
const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const {
  evaluateCenterLicense,
  verifyLicenseToken,
} = require("../services/licenseService");

const router = express.Router();

// 1. Récupération de l'état en temps réel de la licence et des quotas
router.get("/license", verifyJwt, async (req, res, next) => {
  try {
    const centerId = req.centerId;

    const [center, evaluation, currentUserCount] = await Promise.all([
      prisma.center.findUnique({ where: { id: centerId } }),
      evaluateCenterLicense(centerId),
      prisma.user.count({ where: { centerId, deletedAt: null } }),
    ]);

    res.json({
      ...evaluation,
      centerId,
      centerName: center?.name,
      currentUserCount,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Activation par Clé de Licence Hors-Ligne Signée
router.post("/license/activate-offline", verifyJwt, async (req, res, next) => {
  try {
    const { activationKey } = req.body || {};
    if (!activationKey || typeof activationKey !== "string") {
      return res.status(400).json({ error: "Veuillez fournir une clé d'activation valide." });
    }

    const centerId = req.centerId;
    const cleanKey = activationKey.trim().replace(/^CECO-/, "").replace(/\s+/g, "");
    const verification = verifyLicenseToken(cleanKey, centerId);

    if (!verification.isValid) {
      return res.status(400).json({
        error: "Clé de licence invalide : " + (verification.reason || "Signature cryptographique non reconnue."),
      });
    }

    const { expiresAt, plan, maxUsers } = verification;

    await prisma.$transaction([
      // 1. Enregistrement du jeton cryptographique scellé
      prisma.license.upsert({
        where: { centerId },
        update: {
          signedPayload: cleanKey,
          publicKeyId: "ceco_ed25519_v1",
          expiresAt,
        },
        create: {
          centerId,
          signedPayload: cleanKey,
          publicKeyId: "ceco_ed25519_v1",
          expiresAt,
        },
      }),
      // 2. Synchronisation de la table d'abonnement
      prisma.subscription.upsert({
        where: { centerId },
        update: {
          plan,
          status: "active",
          expiresAt,
          maxUsers,
        },
        create: {
          centerId,
          plan,
          status: "active",
          expiresAt,
          maxUsers,
        },
      }),
      // 3. Traçabilité dans le journal d'audit
      prisma.auditLog.create({
        data: {
          centerId,
          userId: req.userId,
          action: "ACTIVATE_OFFLINE_LICENSE",
          entity: "License",
          entityId: centerId,
          metadata: {
            plan,
            expiresAt: expiresAt.toISOString(),
            activatedBy: req.userId,
          },
        },
      }),
    ]);

    const refreshed = await evaluateCenterLicense(centerId);
    const currentUserCount = await prisma.user.count({ where: { centerId, deletedAt: null } });

    res.json({
      success: true,
      message: `Licence activée avec succès jusqu'au ${expiresAt.toLocaleDateString("fr-FR")}.`,
      evaluation: {
        ...refreshed,
        currentUserCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 3. Simulation de paiement Mobile Money en ligne
router.post("/license/pay", verifyJwt, async (req, res, next) => {
  try {
    const centerId = req.centerId;
    const { operator, phoneNumber, months } = req.body || {};

    if (!phoneNumber || !months) {
      return res.status(400).json({ error: "Numéro de téléphone et durée en mois requis." });
    }

    const currentEval = await evaluateCenterLicense(centerId);
    const monthCount = Math.max(1, parseInt(months, 10) || 1);

    let baseTime = currentEval.expiresAt ? new Date(currentEval.expiresAt).getTime() : Date.now();
    if (baseTime < Date.now()) {
      baseTime = Date.now();
    }

    const additionMs = monthCount * 30 * 24 * 60 * 60 * 1000;
    const newExpiresAt = new Date(baseTime + additionMs);

    await prisma.subscription.upsert({
      where: { centerId },
      update: {
        plan: "local_pro",
        status: "active",
        expiresAt: newExpiresAt,
        maxUsers: 50,
      },
      create: {
        centerId,
        plan: "local_pro",
        status: "active",
        expiresAt: newExpiresAt,
        maxUsers: 50,
      },
    });

    const refreshed = await evaluateCenterLicense(centerId);
    const currentUserCount = await prisma.user.count({ where: { centerId, deletedAt: null } });

    res.json({
      success: true,
      message: `Rechargement de ${monthCount} mois effectué avec succès.`,
      plan: refreshed.plan,
      status: refreshed.status,
      expiresAt: refreshed.expiresAt,
      remainingDays: refreshed.remainingDays,
      currentUserCount,
      maxUsers: refreshed.maxUsers,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;