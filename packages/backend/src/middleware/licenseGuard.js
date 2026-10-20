// packages/backend/src/middleware/licenseGuard.js
const { evaluateCenterLicense } = require("../services/licenseService");

/**
 * Middleware de protection de licence :
 * - Autorise en permanence l'authentification, les licences, les healthchecks et la vérification QR.
 * - En période ACTIVE ou GRACE_PERIOD : autorise 100 % des opérations.
 * - En mode READ_ONLY ou TAMPERED : autorise la consultation (GET/HEAD),
 *   ainsi que la consultation des actes déjà scellés (POST /documents/generate avec forceRegenerate=false).
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
    const isSafeReadMethod = ["GET", "HEAD", "OPTIONS"].includes(req.method);

    // RÈGLE SOUVERAINE : Même en mode READ_ONLY, la consultation d'un acte déjà généré via POST /documents/generate
    // avec forceRegenerate=false est une lecture d'archive permise à vie !
    const isHistoricalDocumentRead =
      req.method === "POST" &&
      req.path === "/documents/generate" &&
      req.body?.forceRegenerate !== true;

    if (isSafeReadMethod || isHistoricalDocumentRead) {
      res.setHeader("X-CECO-License-Status", evaluation.status);
      return next();
    }

    // 4. Blocage strict des modifications réelles en mode Lecture Seule
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

module.exports = checkLicense;
module.exports.checkLicense = checkLicense;