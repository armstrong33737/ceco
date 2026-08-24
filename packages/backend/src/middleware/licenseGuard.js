// packages/backend/src/middleware/licenseGuard.js
const { evaluateCenterLicense } = require("../services/licenseService");

/**
 * Middleware de protection de licence (V4/Prod) :
 * - Autorise en permanence l'authentification, les licences, les healthchecks et la vérification QR.
 * - En période ACTIVE ou GRACE_PERIOD : autorise 100 % des opérations.
 * - En mode READ_ONLY ou TAMPERED : autorise la lecture/impression (GET/HEAD),
 *   mais bloque les écritures (POST, PUT, PATCH, DELETE).
 */
async function checkLicense(req, res, next) {
  // 1. Routes système et d'activation toujours ouvertes
  const isOpenRoute =
    req.path.startsWith("/auth") ||
    req.path.startsWith("/license") ||
    req.path.startsWith("/health") ||
    req.path.startsWith("/verify");

  if (isOpenRoute) {
    return next();
  }

  try {
    const evaluation = await evaluateCenterLicense(req.centerId);

    // Injection de l'état de la licence dans la requête
    req.license = evaluation;

    // 2. Si la licence est active ou en période de grâce, accès total accordé
    if (evaluation.isAllowedToWrite) {
      if (evaluation.status === "GRACE_PERIOD") {
        res.setHeader("X-CECO-License-Warning", "GRACE_PERIOD");
        res.setHeader("X-CECO-Grace-Days", String(evaluation.graceDaysRemaining));
      }
      return next();
    }

    // 3. Mode Lecture Seule / Expiration / Horloge manipulée :
    // Les requêtes de consultation (GET, HEAD, OPTIONS) sont toujours autorisées
    const isSafeReadMethod = ["GET", "HEAD", "OPTIONS"].includes(req.method);

    if (isSafeReadMethod) {
      res.setHeader("X-CECO-License-Status", evaluation.status);
      return next();
    }

    // 4. Blocage strict des modifications (POST, PUT, DELETE, PATCH) en mode Lecture Seule
    return res.status(402).json({
      error: "LICENSE_READ_ONLY",
      code: evaluation.status === "TAMPERED" ? "CLOCK_TAMPERED" : "LICENSE_EXPIRED_READ_ONLY",
      message: evaluation.reason || "Votre licence a expiré. L'application est actuellement en mode Consultation / Lecture seule. Le rechargement est requis pour enregistrer de nouvelles données.",
      status: evaluation.status,
      remainingDays: 0,
      graceDaysRemaining: 0,
    });
  } catch (err) {
    console.error("[LicenseGuard] Erreur d'évaluation :", err.message);
    next(err);
  }
}

// Double export pour parer à tout type d'import (destructuré ou direct)
module.exports = checkLicense;
module.exports.checkLicense = checkLicense;