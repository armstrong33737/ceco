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

// 2. Activation par Clé de Licence Hors-Ligne Signée (Ed25519)
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

module.exports = router;