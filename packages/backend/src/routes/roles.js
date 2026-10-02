// packages/backend/src/routes/roles.js
const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

function serializeRole(role) {
  return {
    id: role.id,
    name: role.name,
    isSystem: role.isSystem,
    permissions: role.permissions.map((p) => p.action),
  };
}

router.get("/roles", verifyJwt, requirePermission("roles.read"), async (req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      where: { centerId: req.centerId },
      include: { permissions: true },
      orderBy: { name: "asc" },
    });
    res.json(roles.map(serializeRole));
  } catch (err) {
    next(err);
  }
});

router.post("/roles", verifyJwt, requirePermission("roles.create"), async (req, res, next) => {
  try {
    const { name, permissions } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Le nom du rôle est requis." });
    }

    const role = await prisma.role.create({
      data: {
        centerId: req.centerId,
        name: name.trim(),
        isSystem: false,
        permissions: { create: (permissions || []).map((action) => ({ action })) },
      },
      include: { permissions: true },
    });

    res.status(201).json(serializeRole(role));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Un rôle porte déjà ce nom dans ce centre." });
    }
    next(err);
  }
});

// Modification d'un rôle : Autorise l'augmentation des permissions sur un rôle système, mais interdit son renommage
router.put("/roles/:id", verifyJwt, requirePermission("roles.update"), async (req, res, next) => {
  try {
    const { name, permissions } = req.body || {};

    const existing = await prisma.role.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
    });
    if (!existing) return res.status(404).json({ error: "Rôle introuvable." });

    // Si c'est un rôle système, interdire la modification du nom, mais autoriser l'augmentation des permissions
    if (existing.isSystem && name && name.trim() !== existing.name) {
      return res.status(403).json({ error: "Les rôles système ne peuvent pas être renommés." });
    }

    await prisma.permission.deleteMany({ where: { roleId: req.params.id } });

    const role = await prisma.role.update({
      where: { id: req.params.id },
      data: {
        ...(!existing.isSystem && name !== undefined && { name: name.trim() }),
        permissions: { create: (permissions || []).map((action) => ({ action })) },
      },
      include: { permissions: true },
    });

    res.json(serializeRole(role));
  } catch (err) {
    next(err);
  }
});

// Suppression : Interdiction stricte de supprimer un rôle système
router.delete("/roles/:id", verifyJwt, requirePermission("roles.delete"), async (req, res, next) => {
  try {
    const role = await prisma.role.findFirst({ where: { id: req.params.id, centerId: req.centerId } });
    if (!role) return res.status(404).json({ error: "Rôle introuvable." });
    if (role.isSystem) {
      return res.status(403).json({ error: "Les rôles système ne peuvent pas être supprimés." });
    }

    const assignedCount = await prisma.user.count({ where: { roleId: role.id, deletedAt: null } });
    if (assignedCount > 0) {
      return res.status(409).json({
        error: `Ce rôle est encore attribué à ${assignedCount} utilisateur(s). Réassignez-les avant de le supprimer.`,
      });
    }

    await prisma.permission.deleteMany({ where: { roleId: role.id } });
    await prisma.role.delete({ where: { id: role.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;