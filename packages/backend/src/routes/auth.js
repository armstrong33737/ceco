const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");

const router = express.Router();

router.post("/auth/login", async (req, res, next) => {
  try {
    const { email, password, remember } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis." });
    }

    // Toujours scopé au centre résolu par le tenant resolver — jamais une
    // recherche globale par email, même en mode local à un seul centre.
    const user = await prisma.user.findFirst({
      where: { centerId: req.centerId, email, isActive: true, deletedAt: null },
    });

    // Message volontairement identique que l'email existe ou non, pour ne
    // pas révéler quels comptes existent dans le centre.
    if (!user) {
      return res.status(401).json({ error: "Identifiants incorrects." });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Identifiants incorrects." });
    }

    const token = jwt.sign(
      { userId: user.id, centerId: user.centerId, roleId: user.roleId },
      process.env.JWT_SECRET,
      { expiresIn: remember ? "30d" : "12h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Permet au frontend de vérifier, au démarrage, si un jeton déjà stocké
// est encore valide — sans redemander les identifiants à chaque lancement.
router.get("/auth/me", verifyJwt, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });
    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;