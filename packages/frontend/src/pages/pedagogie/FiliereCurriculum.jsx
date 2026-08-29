// packages/frontend/src/pages/pedagogie/FiliereCurriculum.jsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import Icon from "../../components/Icon";

export default function FiliereCurriculum() {
  const [filieres, setFilieres] = useState([]);
  const [selectedFiliereId, setSelectedFiliereId] = useState("");
  const [curriculumData, setCurriculumData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAddModal, setShowAddModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formPayload, setFormPayload] = useState({ subjectId: "", categoryId: "", defaultCoefficient: 2, defaultVolumeHoraire: 45 });
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([apiFetch("/filieres"), apiFetch("/subjects"), apiFetch("/categories")]).then(([fils, subs, cats]) => {
      setFilieres(fils || []);
      setSubjects(subs || []);
      setCategories(cats || []);
      if (fils?.length > 0) setSelectedFiliereId(fils[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedFiliereId) return;
    apiFetch(`/filieres/${selectedFiliereId}/curriculum`).then((data) => setCurriculumData(data)).catch((e) => setError(e.message));
  }, [selectedFiliereId]);

  async function handleAddSubject(e) {
    e.preventDefault();
    try {
      await apiFetch(`/filieres/${selectedFiliereId}/subjects`, {
        method: "POST",
        body: JSON.stringify({
          niveauOrder: showAddModal.niveauOrder,
          semesterOrder: showAddModal.semesterOrder,
          ...formPayload,
        }),
      });
      setShowAddModal(null);
      showToast("Matière intégrée au cursus de la filière.", "success");
      const data = await apiFetch(`/filieres/${selectedFiliereId}/curriculum`);
      setCurriculumData(data);
    } catch (err) {
      showToast(err.message || "Erreur lors de l'ajout au cursus.", "error");
    }
  }

  async function confirmDeleteSubject() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/filieres/subjects/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast("Matière retirée du cursus de la filière.", "warning");
      const data = await apiFetch(`/filieres/${selectedFiliereId}/curriculum`);
      setCurriculumData(data);
    } catch (err) {
      showToast(err.message || "Impossible de retirer cette matière.", "error");
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur de Filière */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white p-4 rounded-lg border border-slate-200 shadow-card">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase text-slate-700">Filière d'études :</label>
          <select value={selectedFiliereId} onChange={(e) => setSelectedFiliereId(e.target.value)} className="input-field w-80">
            {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code}) — {f.durationInYears} an(s)</option>)}
          </select>
        </div>
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-semibold">{error}</div>}

      {/* Cursus par Niveaux */}
      {curriculumData?.curriculum?.map((niv) => (
        <div key={niv.niveauOrder} className="rounded-lg bg-white border border-slate-200 shadow-card overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center font-bold text-xs">
            <span className="text-slate-900">NIVEAU {niv.niveauOrder} (Cycle de {curriculumData.filiere?.durationInYears} ans)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {niv.semesters.map((sem) => (
              <div key={sem.semesterOrder} className="p-3.5 space-y-2.5">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="font-bold text-xs text-blue-700">{sem.label}</span>
                  <button
                    onClick={() => {
                      setFormPayload({ subjectId: subjects[0]?.id || "", categoryId: categories[0]?.id || "", defaultCoefficient: 2, defaultVolumeHoraire: 45 });
                      setShowAddModal({ niveauOrder: niv.niveauOrder, semesterOrder: sem.semesterOrder });
                    }}
                    className="text-[11px] font-bold text-blue-700 hover:underline"
                  >
                    + Ajouter une matière
                  </button>
                </div>

                <div className="space-y-1.5">
                  {sem.subjects.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic py-2">Aucune matière affectée pour ce semestre.</p>
                  ) : (
                    sem.subjects.map((fs) => (
                      <div key={fs.id} className="flex justify-between items-center p-2.5 rounded bg-slate-50 border border-slate-200 text-xs">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="badge-blue font-mono">
                              {fs.subject?.code || "—"}
                            </span>
                            <span>{fs.subject?.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {fs.category?.name || "Sans groupe"} • Coef {fs.defaultCoefficient} • {fs.defaultVolumeHoraire ? `${fs.defaultVolumeHoraire}h` : "—"}
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteTarget({ id: fs.id, name: fs.subject?.name, code: fs.subject?.code, niveau: niv.niveauOrder, semester: sem.label })}
                          className="text-rose-600 p-1 hover:bg-rose-50 rounded"
                          title="Retirer du cursus"
                        >
                          <Icon name="delete" className="text-[16px]" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* PORTAIL DES MODALES */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {showAddModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleAddSubject}
                className="w-full max-w-md bg-white p-5 rounded-xl shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900">Ajouter au Cursus (Niv {showAddModal.niveauOrder} - {showAddModal.semesterOrder === 1 ? "S1" : "S2"})</h4>
                  <button type="button" onClick={() => setShowAddModal(null)} className="text-slate-400 hover:text-slate-700"><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Matière *</label>
                    <select value={formPayload.subjectId} onChange={(e) => setFormPayload({ ...formPayload, subjectId: e.target.value })} className="input-field w-full">
                      {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code || "—"})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Groupe / Catégorie</label>
                    <select value={formPayload.categoryId} onChange={(e) => setFormPayload({ ...formPayload, categoryId: e.target.value })} className="input-field w-full">
                      <option value="">Aucune catégorie (Général)</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Coefficient</label>
                      <input type="number" step="0.5" min="0.5" value={formPayload.defaultCoefficient} onChange={(e) => setFormPayload({ ...formPayload, defaultCoefficient: e.target.value })} className="input-field w-full font-mono font-bold" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Volume Horaire (h)</label>
                      <input type="number" value={formPayload.defaultVolumeHoraire} onChange={(e) => setFormPayload({ ...formPayload, defaultVolumeHoraire: e.target.value })} className="input-field w-full font-mono" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setShowAddModal(null)} className="btn-secondary">Annuler</button>
                  <button type="submit" className="btn-primary">Ajouter au Cursus</button>
                </div>
              </motion.form>
            </div>
          )}

          {deleteTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center gap-2 text-rose-600 border-b border-slate-200 pb-2">
                  <Icon name="warning" className="text-[20px]" />
                  <h3 className="text-sm font-bold text-slate-900">Retirer du Cursus</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Retirer définitivement la matière <strong>{deleteTarget.name}</strong> ({deleteTarget.code || "Sans code"}) du <strong>Niveau {deleteTarget.niveau} ({deleteTarget.semester})</strong> ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Annuler</button>
                  <button onClick={confirmDeleteSubject} className="btn-primary bg-rose-600 hover:bg-rose-700">
                    Confirmer le retrait
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}