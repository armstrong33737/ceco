// packages/backend/src/services/academicCalculator.js

/**
 * Calcule de façon intègre les résultats académiques d'un apprenant.
 * RÈGLE D'OR MINEFOP : La moyenne officielle divise par le TOTAL DES COEFFICIENTS PRESCRITS
 * de la classe, empêchant toute admission frauduleuse lorsqu'un cours obligatoire n'a pas été évalué.
 */
function computeStudentAcademicResults({
  studentId,
  offerings = [],
  subjectResults = [],
  scope = "ANNUEL",
  isFinalYear = false,
  existingDecision = null,
}) {
  const totalPrescribedCoeffs = offerings.reduce((sum, o) => sum + (o.coefficient || 0), 0);
  let totalPoints = 0;
  let evaluatedCoeffs = 0;
  let hasEliminatoryGrade = false;
  const subjectsDetail = [];
  let missingGradesCount = 0;

  offerings.forEach((off) => {
    const sRes = subjectResults.find((r) => r.studentId === studentId && r.subjectId === off.subjectId);
    const gradeVal = (sRes && sRes.finalGrade !== undefined && sRes.finalGrade !== null)
      ? sRes.finalGrade
      : null;

    if (gradeVal !== null) {
      totalPoints += gradeVal * off.coefficient;
      evaluatedCoeffs += off.coefficient;

      if (off.category?.isEliminatory && gradeVal < 8.0) {
        hasEliminatoryGrade = true;
      }
    } else {
      missingGradesCount++;
    }

    subjectsDetail.push({
      offeringId: off.id,
      subjectId: off.subjectId,
      subjectName: off.subject?.name || "Matière",
      subjectCode: off.subject?.code || "—",
      categoryName: off.category?.name || "Général",
      semesterLabel: off.gradePeriod?.label,
      coefficient: off.coefficient,
      grade: gradeVal,
    });
  });

  // Moyenne officielle divisée par le total des coefficients prescrits de la classe
  const computedAverage = totalPrescribedCoeffs > 0
    ? Number((totalPoints / totalPrescribedCoeffs).toFixed(2))
    : 0.0;

  const hasMissingGrades = missingGradesCount > 0;

  // Décision automatique intègre : Admission bloquée si des matières obligatoires manquent
  let autoDecision = "ajourne";
  if (computedAverage >= 10.0 && !hasEliminatoryGrade && !hasMissingGrades) {
    if (scope === "ANNUEL") {
      autoDecision = isFinalYear ? "diplome" : "admis";
    } else {
      autoDecision = "valide";
    }
  } else {
    autoDecision = scope === "ANNUEL" ? "redouble" : "ajourne";
  }

  return {
    studentId,
    totalPoints: Number(totalPoints.toFixed(2)),
    totalCoeffs: totalPrescribedCoeffs,
    evaluatedCoeffs,
    missingGradesCount,
    hasMissingGrades,
    computedAverage,
    moyenne: computedAverage,
    decision: existingDecision || autoDecision,
    autoDecision,
    hasEliminatoryGrade,
    subjectsDetail,
  };
}

module.exports = {
  computeStudentAcademicResults,
};