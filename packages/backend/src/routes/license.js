const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");

const router = express.Router();

// Récupérer les données réelles de la licence
router.get("/license", verifyJwt, async (req, res, next) => {
  try {
    const centerId = req.centerId;

    // 1. Compte réel des utilisateurs actifs du centre en base de données
    const currentUserCount = await prisma.user.count({
      where: { centerId, deletedAt: null }
    });

    // 2. Recherche ou initialisation de la ligne d'abonnement du centre
    let subscription = await prisma.subscription.findUnique({
      where: { centerId }
    });

    if (!subscription) {
      // Attribution automatique des 2 mois d'essai gratuits si absent de la base de données
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // +60 jours
      subscription = await prisma.subscription.create({
        data: {
          centerId,
          plan: "local",
          status: "active",
          expiresAt,
          maxUsers: 50,
          maxStorage: BigInt(10 * 1024 * 1024 * 1024) // 10 Go par défaut
        }
      });
    }

    res.json({
      plan: subscription.plan,
      status: subscription.status,
      expiresAt: subscription.expiresAt,
      currentUserCount,
      maxUsers: subscription.maxUsers,
      maxStorage: subscription.maxStorage ? subscription.maxStorage.toString() : null
    });

  } catch (err) {
    next(err);
  }
});

// Enregistrer un rechargement de mois réels
router.post("/license/pay", verifyJwt, async (req, res, next) => {
  try {
    const centerId = req.centerId;
    const { operator, phoneNumber, months } = req.body || {};

    if (!phoneNumber || !months) {
      return res.status(400).json({ error: "Numéro de téléphone et durée requis." });
    }

    // Récupère l'abonnement actuel
    let subscription = await prisma.subscription.findUnique({
      where: { centerId }
    });

    const additionTime = parseInt(months) * 30 * 24 * 60 * 60 * 1000;
    let currentExpiry = subscription ? new Date(subscription.expiresAt).getTime() : Date.now();
    
    // Si la licence est expirée, on repart d'aujourd'hui
    if (currentExpiry < Date.now()) {
      currentExpiry = Date.now();
    }

    const newExpiry = new Date(currentExpiry + additionTime);

    // Mise à jour de la licence en base de données
    if (subscription) {
      subscription = await prisma.subscription.update({
        where: { centerId },
        data: { expiresAt: newExpiry }
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          centerId,
          plan: "local",
          status: "active",
          expiresAt: newExpiry,
          maxUsers: 50,
          maxStorage: BigInt(10 * 1024 * 1024 * 1024)
        }
      });
    }

    const currentUserCount = await prisma.user.count({
      where: { centerId, deletedAt: null }
    });

    res.json({
      plan: subscription.plan,
      status: subscription.status,
      expiresAt: subscription.expiresAt,
      currentUserCount,
      maxUsers: subscription.maxUsers,
      maxStorage: subscription.maxStorage ? subscription.maxStorage.toString() : null
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;