const jwt = require("jsonwebtoken");

// Vérifie le jeton JWT ET s'assure qu'il a été émis pour CE centre — un
// jeton par ailleurs valide mais émis pour un autre centre est refusé.
// C'est le filet de sécurité multi-tenant côté authentification, symétrique
// à scopedRepository côté données.
function verifyJwt(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentification requise." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.centerId !== req.centerId) {
      return res.status(403).json({ error: "Ce jeton n'est pas valide pour ce centre." });
    }

    req.userId = payload.userId;
    req.roleId = payload.roleId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session invalide ou expirée." });
  }
}

module.exports = { verifyJwt };
