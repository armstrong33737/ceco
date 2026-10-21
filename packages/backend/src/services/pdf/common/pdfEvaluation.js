// packages/backend/src/services/pdf/common/pdfEvaluation.js

function getGradeAppreciation(val) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const g = parseFloat(val);
  if (g < 6.0) return "Très Faible";
  if (g < 8.0) return "Faible";
  if (g < 10.0) return "Médiocre";
  if (g < 12.0) return "Passable";
  if (g < 14.0) return "Assez Bien";
  if (g < 16.0) return "Bien";
  if (g < 18.0) return "Très Bien";
  return "Excellent";
}

function getDiplomaMention(avg) {
  if (avg === null || avg === undefined || isNaN(avg)) return "—";
  const a = parseFloat(avg);
  if (a >= 16.0) return "Très Bien";
  if (a >= 14.0) return "Bien";
  if (a >= 12.0) return "Assez Bien";
  if (a >= 10.0) return "Passable";
  if (a >= 8.0) return "Médiocre";
  return "Faible";
}

function getGeneralObservation(overallAvg, hasEliminatory) {
  if (hasEliminatory) {
    return "Échec dû à une note éliminatoire (< 08/20) en matière de spécialité. Rattrapage obligatoire.";
  }
  if (overallAvg === null || overallAvg === undefined || isNaN(overallAvg)) {
    return "Résultats académiques en cours de délibération.";
  }
  const avg = parseFloat(overallAvg);
  if (avg >= 16.0) return "Excellent travail. Félicitations du conseil et encouragements à maintenir ce niveau d'excellence.";
  if (avg >= 14.0) return "Très bon travail. Résultats solides et réguliers. Tableau d'honneur.";
  if (avg >= 12.0) return "Bon travail dans l'ensemble. Résultats satisfaisants, poursuivez dans cette voie.";
  if (avg >= 10.0) return "Travail passable. Des efforts supplémentaires sont attendus pour consolider les acquis.";
  if (avg >= 8.0) return "Travail médiocre. Résultats sous la moyenne, admis ou ajourné avec recommandation d'efforts sérieux.";
  if (avg >= 6.0) return "Résultats très faibles. Travail irrégulier, un redoublement d'efforts est impératif au rattrapage.";
  return "Résultats insuffisants. Manque prononcé d'assiduité ou de méthode.";
}

/**
 * Dessine la double grille synoptique récapitulative avec taux de réussite réel et observations dynamiques
 */
function drawRecapMatrix(doc, totals, startX = 25, startY = 640, width = 545, height = 58) {
  const colLeftW = width * 0.44;
  const colRightW = width * 0.54;
  const gap = width * 0.02;
  const colRightX = startX + colLeftW + gap;

  const successRateText = totals.classSuccessRate !== undefined && totals.classSuccessRate !== null
    ? `${totals.classSuccessRate}%`
    : (totals.totalStudents > 0 && totals.passedCount !== undefined
      ? `${((totals.passedCount / totals.totalStudents) * 100).toFixed(1)}%`
      : "—");

  // Colonne Gauche - Statistiques de la Promotion
  doc.rect(startX, startY, colLeftW, height).fillAndStroke("#FFFFFF", "#CBD5E1");

  const rowH = height / 5;
  const leftRows = [
    { label: "MOYENNE GÉNÉRALE", val: totals.overallAverage !== null ? `${totals.overallAverage} / 20` : "—", highlight: true },
    { label: "PLUS FORTE MOYENNE", val: totals.highestAverage !== null ? `${totals.highestAverage} / 20` : "—" },
    { label: "PLUS FAIBLE MOYENNE", val: totals.lowestAverage !== null ? `${totals.lowestAverage} / 20` : "—" },
    { label: "MOYENNE DE CLASSE", val: totals.classAverage !== null ? `${totals.classAverage} / 20` : "—" },
    { label: "TAUX DE RÉUSSITE CLASSE", val: successRateText },
  ];

  leftRows.forEach((r, idx) => {
    const ry = startY + idx * rowH;
    if (idx > 0) doc.moveTo(startX, ry).lineTo(startX + colLeftW, ry).lineWidth(0.5).strokeColor("#E2E8F0").stroke();

    doc.fillColor("#475569").fontSize(6).font("Helvetica-Bold").text(r.label, startX + 6, ry + 3);

    if (r.highlight) {
      doc.rect(startX + colLeftW - 55, ry + 1, 53, rowH - 2).fill("#FFF275");
      doc.fillColor("#071A2E").fontSize(7.5).font("Helvetica-Bold").text(r.val, startX + colLeftW - 55, ry + 2.5, { width: 53, align: "center" });
    } else {
      doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text(r.val, startX + colLeftW - 55, ry + 3, { width: 53, align: "center" });
    }
  });

  // Colonne Droite - Décision du Jury & Profil
  doc.rect(colRightX, startY, colRightW, height).fillAndStroke("#FFFFFF", "#CBD5E1");

  doc.rect(colRightX, startY, colRightW / 2, rowH).fill("#F8FAFC");
  doc.fillColor("#475569").fontSize(6).font("Helvetica-Bold").text("RANG :", colRightX + 4, startY + 3);
  doc.rect(colRightX + 35, startY + 1, 35, rowH - 2).fill("#FFF275");
  doc.fillColor("#071A2E").fontSize(7).font("Helvetica-Bold").text(totals.rank ? `${totals.rank}e / ${totals.totalStudents}` : "—", colRightX + 35, startY + 2.5, { width: 35, align: "center" });

  doc.rect(colRightX + colRightW / 2, startY, colRightW / 2, rowH).fill("#F8FAFC");
  doc.fillColor("#475569").fontSize(6).font("Helvetica-Bold").text("MENTION :", colRightX + colRightW / 2 + 4, startY + 3);
  doc.fillColor("#0F172A").fontSize(6.5).font("Helvetica-Bold").text((totals.mention || "MÉDIOCRE").toUpperCase(), colRightX + colRightW / 2 + 42, startY + 3);

  // Évaluation insensible à la casse de la décision
  const rawDec = String(totals.decision || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const admissionCutoff = totals.admissionThreshold || 10.0;
  const isPassed = rawDec === "ADMIS" || rawDec === "VALIDE" || rawDec === "DIPLOME" || (totals.overallAverage >= admissionCutoff && !totals.hasEliminatory);

  const decColor = isPassed ? "#16805A" : "#C73B3B";
  const decLabel = rawDec === "DIPLOME"
    ? "DIPLÔMÉ(E)"
    : isPassed
    ? "ADMIS(E) / VALIDÉ(E)"
    : "AJOURNÉ(E) / ÉCHOUÉ(E)";

  doc.rect(colRightX, startY + rowH, colRightW, rowH).fill("#F1F5F9");
  doc.fillColor(decColor).fontSize(7.5).font("Helvetica-Bold").text(`DÉCISION DU JURY : ${decLabel}`, colRightX, startY + rowH + 2.5, { width: colRightW, align: "center" });

  const discColW = colRightW / 4;
  const discItems = ["RETARDS: 0", "ABSENCES: 0", "CONSIGNE: 0", "BLÂME: 0"];
  discItems.forEach((d, didx) => {
    const dx = colRightX + didx * discColW;
    doc.rect(dx, startY + rowH * 2, discColW, rowH).strokeColor("#E2E8F0").stroke();
    doc.fillColor("#64748B").fontSize(5.5).font("Helvetica").text(d, dx, startY + rowH * 2 + 3, { width: discColW, align: "center" });
  });

  doc.rect(colRightX, startY + rowH * 3, colRightW, rowH * 2).strokeColor("#CBD5E1").stroke();
  doc.fillColor("#475569").fontSize(5.5).font("Helvetica-Bold").text("OBSERVATIONS / VISA DE L'ÉTABLISSEMENT :", colRightX + 4, startY + rowH * 3 + 2);

  const observationText = totals.generalObservation || getGeneralObservation(totals.overallAverage, totals.hasEliminatory);
  doc.fillColor("#0F172A").fontSize(6).font("Helvetica-Oblique").text(observationText, colRightX + 4, startY + rowH * 3 + 10, {
    width: colRightW - 8,
    lineGap: 1.2,
  });
}

module.exports = {
  getGradeAppreciation,
  getDiplomaMention,
  getGeneralObservation,
  drawRecapMatrix,
};