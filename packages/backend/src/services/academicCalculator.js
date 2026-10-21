// packages/backend/src/services/academicCalculator.js

/**
 * Attribue la mention académique selon l'échelle officielle MINEFOP :
 * - >= 16.00 : Très Bien
 * - >= 14.00 : Bien
 * - >= 12.00 : Assez Bien
 * - >= 10.00 : Passable
 * - >= 08.00 : Médiocre (tolérance du jury / repêchage)
 * - < 08.00  : Faible
 */
function getAcademicMention(average) {
  if (average === null || average === undefined || isNaN(average)) return "—";
  const a = parseFloat(average);
  if (a >= 16.0) return "Très Bien";
  if (a >= 14.0) return "Bien";
  if (a >= 12.0) return "Assez Bien";
  if (a >= 10.0) return "Passable";
  if (a >= 8.0) return "Médiocre";
  return "Faible";
}

/**
 * Calcule de façon intègre les résultats académiques d'un apprenant.
 * Le seuil d'admission `admissionThreshold` est paramétrable par le jury (défaut : 10.00 / 20).
 */
function computeStudentAcademicResults({
  studentId,
  offerings = [],
  subjectResults = [],
  scope = "ANNUEL",
  isFinalYear = false,
  existingDecision = null,
  admissionThreshold = 10.0,
}) {
  const threshold = parseFloat(admissionThreshold) || 10.0;
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

      // Note éliminatoire de spécialité (< 08.00)
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

  // Moyenne officielle calculée sur le total des coefficients prescrits de la classe
  const computedAverage = totalPrescribedCoeffs > 0
    ? Number((totalPoints / totalPrescribedCoeffs).toFixed(2))
    : 0.0;

  const hasMissingGrades = missingGradesCount > 0;

  // Décision automatique basée sur le seuil d'admission paramétré par le jury
  let autoDecision = "ajourne";
  if (computedAverage >= threshold && !hasEliminatoryGrade && !hasMissingGrades) {
    if (scope === "ANNUEL") {
      autoDecision = isFinalYear ? "diplome" : "admis";
    } else {
      autoDecision = "valide";
    }
  } else {
    autoDecision = scope === "ANNUEL" ? "redouble" : "ajourne";
  }

  const mention = getAcademicMention(computedAverage);

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
    mention,
    admissionThreshold: threshold,
    hasEliminatoryGrade,
    subjectsDetail,
  };
}

module.exports = {
  computeStudentAcademicResults,
  getAcademicMention,
};