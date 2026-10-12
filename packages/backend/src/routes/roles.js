// packages/backend/src/routes/roles.js
const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

// Socles fonctionnels minimaux garantis (inaliénables) des rôles système
const SYSTEM_ROLE_BASELINES = {
  "Admin": ["*"],
  "Directeur des Études": [
    "formations.read", "formations.create", "formations.update", "formations.delete",
    "grades.read", "grades.create", "grades.update", "grades.validate",
    "students.read", "bulletins.generate",
  ],
  "Secrétaire": [
    "students.read", "students.create", "students.update",
    "formations.read", "grades.read", "bulletins.generate",
  ],
  "Formateur": [
    "formations.read", "grades.read", "grades.create", "grades.update",
  ],
};

function serializeRole(role) {
  return {
    id: role.id,
    name: role.name,
    isSystem: role.isSystem,
    permissions: (role.permissions || []).map((p) => (typeof p === "object" ? p.action : p)),
  };
}

router.get("/roles", verifyJwt, requirePermission("roles.read"), async (req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      where: { centerId: req.centerId },
      include: { permissions: true },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
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

// Modification d'un rôle : Règle d'augmentation garantie sur les rôles système
router.put("/roles/:id", verifyJwt, requirePermission("roles.update"), async (req, res, next) => {
  try {
    const { name, permissions } = req.body || {};

    const existing = await prisma.role.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
      include: { permissions: true },
    });
    if (!existing) return res.status(404).json({ error: "Rôle introuvable." });

    if (existing.isSystem && name && name.trim() !== existing.name) {
      return res.status(403).json({ error: "Les rôles système protégés ne peuvent pas être renommés." });
    }

    let finalPermissionsList = permissions || [];

    // Sécurisation backend : fusion obligatoire avec le socle minimal inaliénable
    if (existing.isSystem) {
      const baseline = SYSTEM_ROLE_BASELINES[existing.name] || [];
      const submittedActions = (permissions || []).map((p) => (typeof p === "object" ? p.action : p));
      finalPermissionsList = Array.from(new Set([...baseline, ...submittedActions]));
    }

    await prisma.permission.deleteMany({ where: { roleId: req.params.id } });

    const role = await prisma.role.update({
      where: { id: req.params.id },
      data: {
        ...(!existing.isSystem && name !== undefined && { name: name.trim() }),
        permissions: {
          create: finalPermissionsList.map((action) => ({ action })),
        },
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
      return res.status(403).json({ error: "Les rôles système sont protégés et ne peuvent pas être supprimés." });
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