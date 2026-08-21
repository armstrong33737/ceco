// packages/backend/src/middleware/errorHandler.js
const { Prisma } = require("@prisma/client");

function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.originalUrl} :`, err);

  // 1. Erreurs Prisma spécifiques
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : err.meta?.target || "inconnu";
        let message = `Un enregistrement avec cette information (${target}) existe déjà dans l'établissement.`;
        if (target.includes("matricule")) message = "Ce matricule est déjà attribué à un autre apprenant dans l'établissement.";
        if (target.includes("email")) message = "Cette adresse email est déjà utilisée par un autre compte utilisateur.";
        if (target.includes("code")) message = "Ce code identifiant existe déjà pour cet élément.";
        if (target.includes("name")) message = "Un élément portant ce libellé existe déjà.";
        return res.status(409).json({ error: message, code: "DUPLICATE_ENTRY", target });
      }

      case "P2003": {
        const field = err.meta?.field_name || "associé";
        return res.status(409).json({
          error: `Impossible de supprimer ou modifier cet élément : il est activement lié à d'autres données du système (classes, notes ou inscriptions).`,
          code: "FOREIGN_KEY_CONFLICT",
          field,
        });
      }

      case "P2025": {
        return res.status(404).json({
          error: "L'enregistrement demandé est introuvable ou a déjà été supprimé.",
          code: "NOT_FOUND",
        });
      }

      default: {
        return res.status(400).json({
          error: `Erreur de base de données (${err.code}). Veuillez vérifier la cohérence des données soumises.`,
          code: err.code,
        });
      }
    }
  }

  // 2. Erreurs de validation de schéma Zod
  if (err.name === "ZodError") {
    const issues = err.issues?.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    return res.status(400).json({
      error: `Données invalides : ${issues}`,
      code: "VALIDATION_ERROR",
      details: err.issues,
    });
  }

  // 3. Erreurs avec code HTTP personnalisé
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Une erreur interne est survenue sur le serveur.";

  return res.status(status).json({
    error: message,
    code: err.code || "INTERNAL_SERVER_ERROR",
  });
}

module.exports = { errorHandler };