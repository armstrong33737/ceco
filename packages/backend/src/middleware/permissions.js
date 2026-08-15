const prisma = require("../prismaClient");

// Accepte une ou plusieurs actions autorisées : requirePermission("students.read", "students.create")
function requirePermission(...actions) {
  return async (req, res, next) => {
    try {
      if (!req.roleId) {
        return res.status(403).json({ error: "Aucun rôle associé à ce compte." });
      }

      const role = await prisma.role.findFirst({
        where: { id: req.roleId, centerId: req.centerId },
        include: { permissions: true },
      });

      if (!role) {
        return res.status(403).json({ error: "Rôle introuvable pour ce centre." });
      }

      const roleActions = role.permissions.map((p) => p.action);

      // Super-administrateur : accès universel
      if (roleActions.includes("*") || role.name?.toLowerCase() === "admin" || role.name?.toLowerCase() === "administrateur") {
        return next();
      }

      // Vérifie si le rôle détient au moins une des permissions requises
      const isAllowed = actions.some((act) => roleActions.includes(act));
      if (!isAllowed) {
        return res.status(403).json({ error: "Vous n'avez pas la permission requise pour effectuer cette opération." });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePermission };