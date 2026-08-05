const express = require("express");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

const EDITABLE_FIELDS = [
  "name", "email", "phone", "logo",
  "address", "city", "postalCode", "country", "website",
  "registrationNumber", "directorName", "directorTitle", "description",
];

function serializeCenter(center) {
  const out = {};
  for (const field of EDITABLE_FIELDS) out[field] = center[field];
  out.id = center.id;
  return out;
}

router.get("/center", verifyJwt, async (req, res, next) => {
  try {
    const center = await prisma.center.findUnique({ where: { id: req.centerId } });
    if (!center) return res.status(404).json({ error: "Centre introuvable." });
    res.json(serializeCenter(center));
  } catch (err) {
    next(err);
  }
});

router.put("/center", verifyJwt, requirePermission("center.update"), async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Le nom du centre est requis." });
    }

    const data = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field] || null;
    }
    data.name = name.trim();

    const center = await prisma.center.update({ where: { id: req.centerId }, data });
    res.json(serializeCenter(center));
  } catch (err) {
    next(err);
  }
});

module.exports = router;