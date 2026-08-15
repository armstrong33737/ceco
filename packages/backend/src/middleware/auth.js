const jwt = require("jsonwebtoken");

// Vérifie le jeton JWT (via l'en-tête Authorization ou via le query param ?token= pour les exports)
function verifyJwt(req, res, next) {
  const header = req.headers.authorization || "";
  let token = header.startsWith("Bearer ") ? header.slice(7) : null;

  // Permet l'authentification directe lors du téléchargement de fichiers dans le navigateur
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

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