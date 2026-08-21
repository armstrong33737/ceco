// packages/backend/src/routes/audit.js
const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

router.get("/audit-logs", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { action, entity, search, page = 1, limit = 25 } = req.query || {};

    const where = {
      centerId: req.centerId,
      ...(action && action.trim() && { action: action.trim() }),
      ...(entity && entity.trim() && { entity: entity.trim() }),
      ...(search && search.trim() && {
        OR: [
          { action: { contains: search.trim(), mode: "insensitive" } },
          { entity: { contains: search.trim(), mode: "insensitive" } },
        ],
      }),
    };

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(5, parseInt(limit) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Résolution des auteurs (User)
    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    const enrichedLogs = logs.map((log) => {
      const author = users.find((u) => u.id === log.userId);
      return {
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata,
        createdAt: log.createdAt,
        author: author ? {
          name: `${author.firstName} ${author.lastName}`,
          email: author.email,
        } : null,
      };
    });

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.json({
      data: enrichedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;