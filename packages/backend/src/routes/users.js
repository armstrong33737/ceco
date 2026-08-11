const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { scopedRepository } = require("../repositories/base");

const router = express.Router();

function serializeUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    isActive: user.isActive,
    role: user.role ? { id: user.role.id, name: user.role.name } : null,
  };
}

router.get("/users", verifyJwt, requirePermission("users.read"), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { centerId: req.centerId, deletedAt: null },
      include: { role: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(users.map(serializeUser));
  } catch (err) {
    next(err);
  }
});

router.post("/users", verifyJwt, requirePermission("users.create"), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, roleId } = req.body || {};
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "Tous les champs sont requis." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
    }

    const users = scopedRepository("user", req.centerId);
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await users.create({
      data: { email, password: hashedPassword, firstName, lastName, roleId: roleId || null },
    });

    const withRole = await prisma.user.findUnique({ where: { id: user.id }, include: { role: true } });
    res.status(201).json(serializeUser(withRole));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Cet email est déjà utilisé dans ce centre." });
    }
    next(err);
  }
});

router.put("/users/:id", verifyJwt, requirePermission("users.update"), async (req, res, next) => {
  try {
    const { firstName, lastName, roleId, isActive } = req.body || {};
    const users = scopedRepository("user", req.centerId);

    const result = await users.update({
      where: { id: req.params.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(roleId !== undefined && { roleId }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    if (result.count === 0) return res.status(404).json({ error: "Utilisateur introuvable." });

    const updated = await prisma.user.findUnique({ where: { id: req.params.id }, include: { role: true } });
    res.json(serializeUser(updated));
  } catch (err) {
    next(err);
  }
});

router.put(
  "/users/:id/password",
  verifyJwt,
  requirePermission("users.update"),
  async (req, res, next) => {
    try {
      const { password } = req.body || {};
      if (!password || password.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
      }

      const users = scopedRepository("user", req.centerId);
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await users.update({ where: { id: req.params.id }, data: { password: hashedPassword } });

      if (result.count === 0) return res.status(404).json({ error: "Utilisateur introuvable." });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// Suppression douce : jamais de destruction réelle, conforme au principe
// de non-destruction retenu pour tout le projet (audit, historique).
router.delete("/users/:id", verifyJwt, requirePermission("users.delete"), async (req, res, next) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
    }

    const users = scopedRepository("user", req.centerId);
    const result = await users.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    if (result.count === 0) return res.status(404).json({ error: "Utilisateur introuvable." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;