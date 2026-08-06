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

    // Récupération de l'utilisateur avec son rôle, ses permissions, et l'abonnement de son centre
    const user = await prisma.user.findFirst({
      where: { centerId: req.centerId, email, isActive: true, deletedAt: null },
      include: {
        role: {
          include: {
            permissions: true
          }
        },
        center: {
          include: {
            subscription: true // Jointure essentielle pour le statut de licence
          }
        }
      }
    });

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
        role: user.role,
        center: user.center, // Renvoie le centre avec son abonnement
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/auth/me", verifyJwt, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: req.userId },
      include: {
        role: {
          include: {
            permissions: true
          }
        },
        center: {
          include: {
            subscription: true // Jointure essentielle pour le statut de licence
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }

    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        center: user.center,
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;