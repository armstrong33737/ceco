// packages/frontend/src/modules/examensBlancs/components/BordereauGrid.jsx
import React from "react";
import Button from "../../../design-system/primitives/Button";
import Badge from "../../../design-system/primitives/Badge";
import Icon from "../../../components/Icon";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "../../../design-system/data-grid/Table";

export default function BordereauGrid({
  currentClasseExam,
  inputGrades,
  onScoreChange,
  onSaveGrades,
  savingGrades,
  onToggleLock,
  onPrintOfficial,
  onPrintBlank,
  onPrintExaminerBatch,
  onPrintSingleExaminer,
  onAddSubject,
  onEditSubject,
  onDeleteSubject,
  onOpenImportCsvModal,
  onToggleCandidateEligibility,
}) {
  if (!currentClasseExam) return null;

  const computeRow = (studentId) => {
    let sumPts = 0;
    let sumCoefs = 0;
    const pointsMap = {};

    currentClasseExam.subjects.forEach((subj) => {
      const cell = inputGrades[studentId]?.[subj.id] || { score: "", isAbsent: false };
      const coef = subj.coefficient || 2.0;
      sumCoefs += coef;

      if (cell.isAbsent || cell.score === "M") {
        pointsMap[subj.id] = "M";
      } else if (cell.score !== "" && cell.score !== undefined) {
        const num = parseFloat(cell.score);
        if (!isNaN(num)) {
          const pt = num * coef;
          pointsMap[subj.id] = pt.toFixed(2);
          sumPts += pt;
        } else {
          pointsMap[subj.id] = "—";
        }
      } else {
        pointsMap[subj.id] = "—";
      }
    });

    const avg = sumCoefs > 0 ? (sumPts / sumCoefs).toFixed(2) : "—";
    return { pointsMap, avg };
  };

  return (
    <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
      <div className="p-4 border-b border-border flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-[#FAFBFD] dark:bg-[#07111D]">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-body-md font-bold text-ink-primary dark:text-white">
              Bordereau : {currentClasseExam.classe.label}
            </h3>
            <span className="text-caption text-ink-muted">({currentClasseExam.subjects.length} épreuves)</span>
            {currentClasseExam.isLocked && (
              <Badge variant="warning">🔒 Verrouillé</Badge>
            )}
          </div>
          <p className="text-caption text-ink-muted mt-0.5">
            Notes de 0 à 20 • Tapez <strong>« M »</strong> pour absence. Utilisez les boutons d'épreuve pour l'import CSV de notes.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!currentClasseExam.isLocked && (
            <Button variant="secondary" size="sm" icon="add" onClick={onAddSubject}>
              Ajouter Épreuve
            </Button>
          )}

          <Button variant="secondary" size="sm" icon="edit_note" onClick={onPrintBlank}>
            Bordereau Vierge
          </Button>

          <Button variant="secondary" size="sm" icon="badge" onClick={onPrintExaminerBatch}>
            Pack Émargements
          </Button>

          <Button variant="secondary" size="sm" icon={currentClasseExam.isLocked ? "lock_open" : "lock"} onClick={onToggleLock}>
            {currentClasseExam.isLocked ? "Déverrouiller" : "Verrouiller"}
          </Button>

          <Button variant="primary" size="sm" icon="print" onClick={onPrintOfficial}>
            Imprimer Bordereau MINEFOP
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell className="w-10 text-center">N°</TableHeaderCell>
              <TableHeaderCell className="w-48">Noms et Prénoms du Candidat</TableHeaderCell>
              <TableHeaderCell className="w-24 text-center">Date Naiss.</TableHeaderCell>
              <TableHeaderCell className="w-28 text-center">Lieu Naiss.</TableHeaderCell>
              <TableHeaderCell className="w-24 text-center">Statut Candidat</TableHeaderCell>

              {currentClasseExam.subjects.map((subj) => (
                <TableHeaderCell key={subj.id} className="text-center w-36 border-l border-border dark:border-border-dark">
                  <div className="flex items-center justify-between gap-1 pb-1">
                    <span className="font-mono font-bold text-[11px] text-brand-900 dark:text-brand-500">
                      {subj.mockSubject.code} (C{subj.coefficient})
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onOpenImportCsvModal(subj)}
                        className="text-ink-muted hover:text-brand-900 p-0.5"
                        title="Importer notes CSV pour cette épreuve (Matricule;Note)"
                      >
                        <Icon name="upload_file" className="text-[14px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onPrintSingleExaminer(subj.id, subj.mockSubject.code)}
                        className="text-ink-muted hover:text-ink-primary p-0.5"
                        title="Imprimer feuille d'émargement examinateur"
                      >
                        <Icon name="print" className="text-[14px]" />
                      </button>
                      {!currentClasseExam.isLocked && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditSubject(subj)}
                            className="text-ink-muted hover:text-ink-primary p-0.5"
                            title="Modifier le coefficient"
                          >
                            <Icon name="tune" className="text-[14px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSubject(subj.id)}
                            className="text-error/70 hover:text-error p-0.5"
                            title="Retirer cette épreuve"
                          >
                            <Icon name="close" className="text-[14px]" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 text-[10px] text-ink-muted border-t border-border dark:border-border-dark pt-0.5 font-semibold">
                    <span>NOTE/20</span>
                    <span className="border-l border-border dark:border-border-dark">N*COEF</span>
                  </div>
                </TableHeaderCell>
              ))}

              <TableHeaderCell className="w-24 text-center border-l border-border dark:border-border-dark font-bold">
                MOYENNE / 20
              </TableHeaderCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {currentClasseExam.classe?.inscriptions?.map((insc, idx) => {
              const st = insc.student;
              const { pointsMap, avg } = computeRow(st.id);
              const summary = currentClasseExam.summaries?.find((s) => s.studentId === st.id);
              const isDisqualified = summary?.decision === "DISQUALIFIE" || summary?.decision === "ABANDON";

              return (
                <TableRow key={st.id} className={isDisqualified ? "opacity-60 bg-error-subtle/30" : ""}>
                  <TableCell align="center" className="font-mono text-caption text-ink-muted">{idx + 1}</TableCell>
                  <TableCell className="font-bold text-ink-primary dark:text-white uppercase text-[12px]">
                    {st.lastName} {st.firstName}
                  </TableCell>
                  <TableCell align="center" className="font-mono text-caption">
                    {st.birthDate ? new Date(st.birthDate).toLocaleDateString("fr-FR") : "—"}
                  </TableCell>
                  <TableCell align="center" className="text-caption uppercase truncate max-w-[120px]">{st.birthPlace || "—"}</TableCell>

                  <TableCell align="center">
                    <button
                      type="button"
                      disabled={currentClasseExam.isLocked}
                      onClick={() => onToggleCandidateEligibility(st.id, isDisqualified ? "RETENU" : "DISQUALIFIE")}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                        isDisqualified
                          ? "bg-error-subtle text-error border-error/30"
                          : "bg-success-subtle text-success border-success/30"
                      }`}
                      title={isDisqualified ? "Candidat exclu du bordereau officiel. Cliquer pour retenir." : "Candidat retenu. Cliquer pour disqualifier."}
                    >
                      {isDisqualified ? "Disqualifié" : "Retenu"}
                    </button>
                  </TableCell>

                  {currentClasseExam.subjects.map((subj) => {
                    const cell = inputGrades[st.id]?.[subj.id] || { score: "", isAbsent: false };
                    const pt = pointsMap[subj.id];
                    const isM = cell.isAbsent || cell.score === "M";

                    return (
                      <TableCell key={subj.id} className="border-l border-border dark:border-border-dark p-1">
                        <div className="grid grid-cols-2 gap-1 items-center">
                          <input
                            type="text"
                            disabled={currentClasseExam.isLocked || isDisqualified}
                            value={cell.score}
                            onChange={(e) => onScoreChange(st.id, subj.id, e.target.value)}
                            placeholder="—"
                            className={`h-7 w-full text-center rounded border font-mono font-bold text-caption outline-none transition-colors ${
                              isM
                                ? "bg-error-subtle text-error border-error font-extrabold"
                                : "bg-surface border-border focus:border-brand-700 dark:bg-surface-dark dark:border-border-dark dark:text-white"
                            }`}
                          />
                          <span className={`font-mono text-caption text-center font-semibold ${isM ? "text-error font-bold" : "text-ink-secondary dark:text-ink-secondary-dark"}`}>
                            {pt}
                          </span>
                        </div>
                      </TableCell>
                    );
                  })}

                  <TableCell align="center" className="border-l border-border dark:border-border-dark font-mono font-bold text-body text-brand-900 bg-[#F5F7FA] dark:text-brand-500 dark:bg-[#07111D]">
                    {isDisqualified ? "DISQ." : avg}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="p-4 border-t border-border bg-[#FAFBFD] dark:bg-[#07111D] dark:border-border-dark flex justify-end">
        <Button variant="primary" onClick={onSaveGrades} isLoading={savingGrades} disabled={currentClasseExam.isLocked}>
          Enregistrer les Notes du Bordereau
        </Button>
      </div>
    </div>
  );
}