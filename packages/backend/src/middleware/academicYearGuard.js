// packages/backend/src/middleware/academicYearGuard.js
const prisma = require("../prismaClient");

async function assertEditableAcademicYear(academicYearId, centerId, { allowUpcoming = true } = {}) {
  if (!academicYearId) return null;

  const year = await prisma.academicYear.findFirst({
    where: { id: academicYearId, centerId },
  });

  if (!year) {
    const err = new Error("La session académique demandée est introuvable.");
    err.status = 404;
    throw err;
  }

  // Interdiction formelle et absolue sur toute session clôturée
  if (year.status === "CLOSED" || (!year.isCurrent && year.status !== "UPCOMING")) {
    const err = new Error(`Opération refusée : la session "${year.label}" est officiellement clôturée et archivée. Aucune modification n'est autorisée sur les archives historiques.`);
    err.status = 403;
    throw err;
  }

  if (!allowUpcoming && year.status === "UPCOMING") {
    const err = new Error(`Cette opération requiert que la session "${year.label}" soit préalablement activée.`);
    err.status = 400;
    throw err;
  }

  return year;
}

// Vérifie que la session est spécifiquement la session active en cours
async function assertActiveAcademicYear(academicYearId, centerId) {
  return assertEditableAcademicYear(academicYearId, centerId, { allowUpcoming: false });
}

module.exports = {
  assertEditableAcademicYear,
  assertActiveAcademicYear,
};