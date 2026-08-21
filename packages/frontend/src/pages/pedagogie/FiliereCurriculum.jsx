// packages/frontend/src/pages/pedagogie/FiliereCurriculum.jsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import Icon from "../../components/Icon";

const inputCls = "h-9 rounded bg-surface px-2.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary w-full";

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
      const data = await apiFetch(`/filieres/${selectedFiliereId}/curriculum`);
      setCurriculumData(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDeleteSubject() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/filieres/subjects/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      const data = await apiFetch(`/filieres/${selectedFiliereId}/curriculum`);
      setCurriculumData(data);
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-md">
      <div className="flex justify-between items-center bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase text-on-surface-variant">Filière d'études :</label>
          <select value={selectedFiliereId} onChange={(e) => setSelectedFiliereId(e.target.value)} className={`${inputCls} w-72`}>
            {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code}) — {f.durationInYears} an(s)</option>)}
          </select>
        </div>
      </div>

      {error && <div className="p-3 bg-error-container text-error text-xs rounded-md font-semibold">{error}</div>}

      {curriculumData?.curriculum?.map((niv) => (
        <div key={niv.niveauOrder} className="rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs overflow-hidden">
          <div className="p-3 bg-surface border-b flex justify-between items-center font-bold text-xs">
            <span>NIVEAU {niv.niveauOrder} (Cycle de {curriculumData.filiere?.durationInYears} ans)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-outline-variant/20">
            {niv.semesters.map((sem) => (
              <div key={sem.semesterOrder} className="p-3 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-bold text-xs text-primary">{sem.label}</span>
                  <button
                    onClick={() => {
                      setFormPayload({ subjectId: subjects[0]?.id || "", categoryId: categories[0]?.id || "", defaultCoefficient: 2, defaultVolumeHoraire: 45 });
                      setShowAddModal({ niveauOrder: niv.niveauOrder, semesterOrder: sem.semesterOrder });
                    }}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    + Ajouter une matière
                  </button>
                </div>

                <div className="space-y-1.5">
                  {sem.subjects.length === 0 ? (
                    <p className="text-[11px] text-on-surface-variant italic py-2">Aucune matière affectée.</p>
                  ) : (
                    sem.subjects.map((fs) => (
                      <div key={fs.id} className="flex justify-between items-center p-2 rounded bg-surface border text-xs">
                        <div>
                          <div className="font-bold text-on-surface flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-primary bg-primary-light px-1.5 py-0.2 rounded border border-primary/20">
                              {fs.subject?.code || "—"}
                            </span>
                            <span>{fs.subject?.name}</span>
                          </div>
                          <div className="text-[10px] text-on-surface-variant font-mono mt-0.5">
                            {fs.category?.name || "Sans groupe"} • Coef {fs.defaultCoefficient} • {fs.defaultVolumeHoraire ? `${fs.defaultVolumeHoraire}h` : "—"}
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteTarget({ id: fs.id, name: fs.subject?.name, code: fs.subject?.code, niveau: niv.niveauOrder, semester: sem.label })}
                          className="text-error p-1 hover:bg-error-container/20 rounded"
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
          {/* 1. MODALE AJOUT AU CURSUS */}
          {showAddModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleAddSubject}
                className="w-full max-w-md bg-white p-md sm:p-lg rounded-md shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-bold text-sm text-on-surface">Ajouter au Cursus (Niv {showAddModal.niveauOrder} - S{showAddModal.semesterOrder})</h4>
                  <button type="button" onClick={() => setShowAddModal(null)}><Icon name="close" className="text-[18px]" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Matière *</label>
                    <select value={formPayload.subjectId} onChange={(e) => setFormPayload({ ...formPayload, subjectId: e.target.value })} className={inputCls}>
                      {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code || "—"})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Catégorie / Groupe pour cette filière</label>
                    <select value={formPayload.categoryId} onChange={(e) => setFormPayload({ ...formPayload, categoryId: e.target.value })} className={inputCls}>
                      <option value="">Aucune catégorie (Général)</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold block mb-1">Coefficient</label>
                      <input type="number" step="0.5" min="0.5" value={formPayload.defaultCoefficient} onChange={(e) => setFormPayload({ ...formPayload, defaultCoefficient: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Volume Horaire (h)</label>
                      <input type="number" value={formPayload.defaultVolumeHoraire} onChange={(e) => setFormPayload({ ...formPayload, defaultVolumeHoraire: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setShowAddModal(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">Ajouter</button>
                </div>s
              </motion.form>
            </div>
          )}

          {/* 2. MODALE SUPPRESSION */}
          {deleteTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-md bg-white p-md sm:p-lg shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center gap-2 text-error border-b pb-2">
                  <Icon name="warning" className="text-[20px]" />
                  <h3 className="text-sm font-bold text-on-surface">Retirer du Cursus</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Retirer définitivement la matière <strong>{deleteTarget.name}</strong> ({deleteTarget.code || "Sans code"}) du <strong>Niveau {deleteTarget.niveau} ({deleteTarget.semester})</strong> ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button onClick={confirmDeleteSubject} className="px-3.5 py-1.5 bg-error text-white font-bold rounded text-xs shadow-xs">
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