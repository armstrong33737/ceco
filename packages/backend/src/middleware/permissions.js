const prisma = require("../prismaClient");

// "*" (attribué au rôle admin par le seed) donne tous les droits.
// Sinon, l'action précise doit être présente dans les permissions du rôle.
function requirePermission(action) {
  return async (req, res, next) => {
    try {
      if (!req.roleId) {
        return res.status(403).json({ error: "Aucun rôle associé à ce compte." });
      }

      const role = await prisma.role.findFirst({
        where: { id: req.roleId, centerId: req.centerId },
        include: { permissions: true },
      });

      if (!role) return res.status(403).json({ error: "Rôle introuvable pour ce centre." });

      const allowed = role.permissions.some((p) => p.action === "*" || p.action === action);
      if (!allowed) {
        return res.status(403).json({ error: "Vous n'avez pas la permission requise." });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePermission };