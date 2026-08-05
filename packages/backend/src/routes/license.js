const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");

const router = express.Router();

// En V1 local, il n'existe pas encore de licence signée RSA distribuée
// (mécanisme prévu pour la préparation SaaS, V8+) — cet écran reflète
// honnêtement l'état actuel : le plan/abonnement du centre, créé par le
// seed d'installation avec des valeurs illimitées en mode local.
router.get("/license", verifyJwt, async (req, res, next) => {
  try {
    const subscription = await prisma.subscription.findUnique({ where: { centerId: req.centerId } });
    const userCount = await prisma.user.count({ where: { centerId: req.centerId, deletedAt: null } });

    if (!subscription) {
      return res.status(404).json({ error: "Aucun abonnement trouvé pour ce centre." });
    }

    res.json({
      plan: subscription.plan,
      status: subscription.status,
      maxUsers: subscription.maxUsers, // null = illimité
      maxStorage: subscription.maxStorage ? Number(subscription.maxStorage) : null,
      expiresAt: subscription.expiresAt,
      currentUserCount: userCount,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;