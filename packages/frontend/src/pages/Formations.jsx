import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

const inputCls = "h-10 rounded-md bg-surface px-3.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full";

export default function Formations() {
  const [tab, setTab] = useState("filieres"); // filieres | classes | annees | salles
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [programTypes, setProgramTypes] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [salles, setSalles] = useState([]);
  const [classes, setClasses] = useState([]);

  // Modales d'action
  const [modalType, setModalType] = useState(null); // 'programType' | 'filiere' | 'year' | 'salle' | 'classe'
  const [formPayload, setFormPayload] = useState({});
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [ptData, fData, yData, sData, cData] = await Promise.all([
        apiFetch("/program-types"),
        apiFetch("/filieres"),
        apiFetch("/academic-years"),
        apiFetch("/salles"),
        apiFetch("/classes"),
      ]);
      setProgramTypes(ptData || []);
      setFilieres(fData || []);
      setAcademicYears(yData || []);
      setSalles(sData || []);
      setClasses(cData || []);
    } catch (err) {
      setError(err.message || "Erreur de chargement de la structure académique.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function openCreate(type) {
    setModalError(null);
    setModalType(type);
    if (type === "programType") setFormPayload({ code: "", label: "" });
    if (type === "filiere") setFormPayload({ name: "", programTypeId: programTypes[0]?.id || "", durationInYears: 1 });
    if (type === "year") setFormPayload({ label: "", startDate: "", endDate: "", isCurrent: true });
    if (type === "salle") setFormPayload({ name: "", capacity: "" });
    if (type === "classe") {
      const f = filieres[0];
      setFormPayload({
        filiereId: f?.id || "",
        niveauId: f?.niveaux?.[0]?.id || "",
        academicYearId: academicYears.find((y) => y.isCurrent)?.id || academicYears[0]?.id || "",
        salleId: "",
        label: "",
      });
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      if (modalType === "programType") {
        await apiFetch("/program-types", { method: "POST", body: JSON.stringify(formPayload) });
      } else if (modalType === "filiere") {
        await apiFetch("/filieres", { method: "POST", body: JSON.stringify(formPayload) });
      } else if (modalType === "year") {
        await apiFetch("/academic-years", { method: "POST", body: JSON.stringify(formPayload) });
      } else if (modalType === "salle") {
        await apiFetch("/salles", { method: "POST", body: JSON.stringify(formPayload) });
      } else if (modalType === "classe") {
        await apiFetch("/classes", { method: "POST", body: JSON.stringify(formPayload) });
      }
      setModalType(null);
      await loadAll();
    } catch (err) {
      setModalError(err.message || "Erreur d'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetCurrentYear(yearId) {
    try {
      await apiFetch(`/academic-years/${yearId}/set-current`, { method: "PUT" });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/${deleteTarget.endpoint}/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    }
  }

  const currentAcademicYear = academicYears.find((y) => y.isCurrent);

  if (loading) return <p className="text-sm text-on-surface-variant font-medium">Chargement des données académiques...</p>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-md max-w-5xl mx-auto"
    >
      {/* En-tête du module Formations */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-on-surface">Structure Académique &amp; Formations</h1>
            <span className="rounded-md bg-primary-light text-primary font-bold text-[11px] px-2 py-0.5">
              Session active : {currentAcademicYear?.label || "Aucune"}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Organisation des cycles, filières, niveaux du parcours, années académiques, salles et classes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tab === "filieres" && (
            <div className="flex gap-2">
              <button onClick={() => openCreate("programType")} className="rounded-md border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors shadow-xs">
                + Nouveau Cycle
              </button>
              <button onClick={() => openCreate("filiere")} className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark transition-colors shadow-xs">
                + Nouvelle Filière
              </button>
            </div>
          )}
          {tab === "classes" && (
            <button onClick={() => openCreate("classe")} className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark transition-colors shadow-xs">
              + Créer une Classe
            </button>
          )}
          {tab === "annees" && (
            <button onClick={() => openCreate("year")} className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark transition-colors shadow-xs">
              + Nouvelle Année
            </button>
          )}
          {tab === "salles" && (
            <button onClick={() => openCreate("salle")} className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark transition-colors shadow-xs">
              + Nouvelle Salle
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-error-container p-md text-sm text-error border border-error/20 flex items-center justify-between">
          <p className="text-xs font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-bold underline">Fermer</button>
        </div>
      )}

      {/* Barre d'onglets segmentée */}
      <div className="flex gap-1.5 p-1 bg-surface-container-lowest rounded-md border border-outline-variant/30 shadow-xs overflow-x-auto">
        <button
          onClick={() => setTab("filieres")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "filieres" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="menu_book" className="text-[16px]" />
          <span>Filières &amp; Cycles ({filieres.length})</span>
        </button>

        <button
          onClick={() => setTab("classes")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "classes" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="groups" className="text-[16px]" />
          <span>Classes Promotionnelles ({classes.length})</span>
        </button>

        <button
          onClick={() => setTab("annees")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "annees" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="calendar_month" className="text-[16px]" />
          <span>Années Académiques ({academicYears.length})</span>
        </button>

        <button
          onClick={() => setTab("salles")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "salles" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="meeting_room" className="text-[16px]" />
          <span>Salles de cours ({salles.length})</span>
        </button>
      </div>

      {/* =====================================================================
          ONGLET 1 : FILIÈRES & CYCLES
          ===================================================================== */}
      {tab === "filieres" && (
        <div className="space-y-md">
          {/* Liste des Cycles */}
          <div className="rounded-md bg-surface-container-lowest p-md border border-outline-variant/30 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Types de programmes / Cycles reconnus</span>
              <button onClick={() => openCreate("programType")} className="text-xs text-primary font-bold hover:underline">+ Nouveau cycle</button>
            </div>
            {programTypes.length === 0 ? (
              <p className="text-xs text-on-surface-variant">Aucun cycle enregistré. Créez un cycle (ex: DQP, CQP) pour commencer.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {programTypes.map((pt) => (
                  <div key={pt.id} className="flex items-center justify-between p-2.5 rounded-md bg-surface border border-outline-variant/20">
                    <div>
                      <span className="font-bold text-xs text-primary font-mono">{pt.code}</span>
                      <p className="text-xs text-on-surface font-medium">{pt.label}</p>
                      <span className="text-[10px] text-on-surface-variant">{pt._count?.filieres || 0} filière(s)</span>
                    </div>
                    <button
                      onClick={() => setDeleteTarget({ endpoint: "program-types", id: pt.id, name: pt.code })}
                      className="text-error hover:bg-error-container/20 p-1.5 rounded-md transition-colors"
                      title="Supprimer ce cycle"
                    >
                      <Icon name="delete" className="text-[16px]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tableau des Filières */}
          <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <div className="p-md border-b border-outline-variant/20 flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface">Référentiel des Filières &amp; Niveaux</h2>
              <span className="text-xs text-on-surface-variant font-mono">{filieres.length} filière(s)</span>
            </div>

            {filieres.length === 0 ? (
              <p className="p-lg text-xs text-on-surface-variant text-center">Aucune filière enregistrée pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-outline-variant/30 font-semibold uppercase text-on-surface-variant bg-surface">
                      <th className="px-md py-3">Filière</th>
                      <th className="px-md py-3">Cycle / Diplôme</th>
                      <th className="px-md py-3">Durée du cycle</th>
                      <th className="px-md py-3">Niveaux du parcours</th>
                      <th className="px-md py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/15">
                    {filieres.map((f) => (
                      <tr key={f.id} className="hover:bg-surface-container/20 transition-colors">
                        <td className="px-md py-3 font-bold text-on-surface">{f.name}</td>
                        <td className="px-md py-3">
                          <span className="rounded-md bg-primary-light text-primary font-bold px-2 py-0.5 text-[10px]">
                            {f.programType?.code}
                          </span>
                        </td>
                        <td className="px-md py-3 text-on-surface-variant font-medium">{f.durationInYears} An(s)</td>
                        <td className="px-md py-3">
                          <div className="flex gap-1.5">
                            {f.niveaux?.map((n) => (
                              <span key={n.id} className="rounded-md bg-surface px-2 py-0.5 border border-outline-variant/30 font-bold">
                                Niveau {n.order}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-md py-3 text-right">
                          <button
                            onClick={() => setDeleteTarget({ endpoint: "filieres", id: f.id, name: f.name })}
                            className="text-error hover:bg-error-container/20 p-1.5 rounded-md transition-colors"
                          >
                            <Icon name="delete" className="text-[16px]" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ONGLET 2 : CLASSES PROMOTIONNELLES
          ===================================================================== */}
      {tab === "classes" && (
        <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
          <div className="p-md border-b border-outline-variant/20 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-on-surface">Classes Promotionnelles</h2>
              <p className="text-xs text-on-surface-variant">Les classes de Niveau 1 sont créées automatiquement à chaque nouvelle session.</p>
            </div>
            <span className="text-xs font-mono text-on-surface-variant">{classes.length} classe(s)</span>
          </div>

          {classes.length === 0 ? (
            <p className="p-lg text-xs text-on-surface-variant text-center">Aucune classe créée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-outline-variant/30 font-semibold uppercase text-on-surface-variant bg-surface">
                    <th className="px-md py-3">Libellé de la classe</th>
                    <th className="px-md py-3">Session Académique</th>
                    <th className="px-md py-3">Niveau de parcours</th>
                    <th className="px-md py-3">Salle assignée</th>
                    <th className="px-md py-3">Effectif</th>
                    <th className="px-md py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/15">
                  {classes.map((c) => {
                    const isClosed = !c.academicYear?.isCurrent;
                    return (
                      <tr key={c.id} className={`hover:bg-surface-container/20 ${isClosed ? "opacity-60 bg-surface/50" : ""}`}>
                        <td className="px-md py-3 font-bold text-on-surface text-xs">
                          {c.label}
                          {c.niveau?.order === 1 && (
                            <span className="ml-2 rounded-md bg-primary-light text-primary text-[10px] px-1.5 py-0.2 font-semibold">
                              Auto Niv 1
                            </span>
                          )}
                        </td>
                        <td className="px-md py-3 font-mono font-semibold">
                          {c.academicYear?.label} {isClosed ? "(Clôturée)" : ""}
                        </td>
                        <td className="px-md py-3">
                          <span className="rounded-md bg-surface border border-outline-variant/30 text-on-surface font-bold px-2 py-0.5">
                            Niveau {c.niveau?.order}
                          </span>
                        </td>
                        <td className="px-md py-3">
                          {c.salle ? (
                            <span className="rounded-md bg-surface px-2 py-0.5 font-medium border border-outline-variant/30">
                              {c.salle.name}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/50">Non attribuée</span>
                          )}
                        </td>
                        <td className="px-md py-3 font-bold text-primary font-mono">
                          {c._count?.inscriptions || 0} apprenant(s)
                        </td>
                        <td className="px-md py-3 text-right">
                          {!isClosed && (
                            <button
                              onClick={() => setDeleteTarget({ endpoint: "classes", id: c.id, name: c.label })}
                              className="text-error hover:bg-error-container/20 p-1.5 rounded-md transition-colors"
                            >
                              <Icon name="delete" className="text-[16px]" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ONGLET 3 : ANNÉES ACADÉMIQUES
          ===================================================================== */}
      {tab === "annees" && (
        <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
          <div className="p-md border-b border-outline-variant/20 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-on-surface">Sessions Académiques</h2>
              <p className="text-xs text-on-surface-variant">Les sessions non-courantes sont clôturées et verrouillées en lecture seule.</p>
            </div>
            <span className="text-xs font-mono text-on-surface-variant">{academicYears.length} session(s)</span>
          </div>

          {academicYears.length === 0 ? (
            <p className="p-lg text-xs text-on-surface-variant text-center">Aucune année académique créée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-outline-variant/30 font-semibold uppercase text-on-surface-variant bg-surface">
                    <th className="px-md py-3">Session</th>
                    <th className="px-md py-3">Période d'activité</th>
                    <th className="px-md py-3">Classes</th>
                    <th className="px-md py-3">Inscrits</th>
                    <th className="px-md py-3">État actuel</th>
                    <th className="px-md py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/15">
                  {academicYears.map((y) => (
                    <tr key={y.id} className="hover:bg-surface-container/20">
                      <td className="px-md py-3 font-bold text-on-surface text-sm">{y.label}</td>
                      <td className="px-md py-3 text-on-surface-variant">
                        Du {new Date(y.startDate).toLocaleDateString("fr-FR")} au {new Date(y.endDate).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-md py-3 font-mono">{y._count?.classes || 0}</td>
                      <td className="px-md py-3 font-mono font-bold text-primary">{y._count?.inscriptions || 0}</td>
                      <td className="px-md py-3">
                        {y.isCurrent ? (
                          <span className="rounded-md bg-success-light text-success font-bold px-2 py-0.5 text-[10px] border border-success/20">
                            Active (En cours)
                          </span>
                        ) : (
                          <span className="rounded-md bg-surface text-on-surface-variant px-2 py-0.5 text-[10px] border border-outline-variant/30">
                            Clôturée
                          </span>
                        )}
                      </td>
                      <td className="px-md py-3 text-right">
                        {!y.isCurrent && (
                          <button
                            onClick={() => handleSetCurrentYear(y.id)}
                            className="rounded-md border border-primary/30 px-2.5 py-1 text-primary font-bold hover:bg-primary-light transition-colors"
                          >
                            Activer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ONGLET 4 : SALLES DE COURS
          ===================================================================== */}
      {tab === "salles" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
          {salles.map((s) => (
            <div key={s.id} className="p-md rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-on-surface">{s.name}</h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Capacité : {s.capacity ? `${s.capacity} places` : "Non définie"}</p>
                <span className="text-[10px] text-on-surface-variant/70">{s._count?.classes || 0} classe(s) assignée(s)</span>
              </div>
              <button
                onClick={() => setDeleteTarget({ endpoint: "salles", id: s.id, name: s.name })}
                className="text-error hover:bg-error-container/20 p-1.5 rounded-md transition-colors"
              >
                <Icon name="delete" className="text-[16px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* =====================================================================
          PORTAIL DES MODALES (RENDU SUR DOCUMENT.BODY AVEC BORDURES ROUNDED-MD)
          ===================================================================== */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {modalType && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleFormSubmit}
                className="w-full max-w-md rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <h3 className="text-sm font-bold text-on-surface">
                    {modalType === "programType" && "Nouveau Cycle de formation"}
                    {modalType === "filiere" && "Nouvelle Filière de formation"}
                    {modalType === "year" && "Nouvelle Année Académique"}
                    {modalType === "salle" && "Nouvelle Salle de cours"}
                    {modalType === "classe" && "Créer une Classe Promotionnelle"}
                  </h3>
                  <button type="button" onClick={() => setModalType(null)} className="text-on-surface-variant hover:text-on-surface">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>

                {/* Formulaire Cycle */}
                {modalType === "programType" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Code du cycle / diplôme</label>
                      <input required placeholder="Ex: DQP, CQP, BTS..." value={formPayload.code} onChange={(e) => setFormPayload({ ...formPayload, code: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Intitulé complet</label>
                      <input required placeholder="Ex: Diplôme de Qualification Professionnelle" value={formPayload.label} onChange={(e) => setFormPayload({ ...formPayload, label: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                )}

                {/* Formulaire Filière */}
                {modalType === "filiere" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Cycle de rattachement</label>
                      <select required value={formPayload.programTypeId} onChange={(e) => setFormPayload({ ...formPayload, programTypeId: e.target.value })} className={inputCls}>
                        {programTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.code} — {pt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Nom de la filière</label>
                      <input required placeholder="Ex: Froid et Climatisation, Secrétariat..." value={formPayload.name} onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Durée du cycle</label>
                      <select value={formPayload.durationInYears} onChange={(e) => setFormPayload({ ...formPayload, durationInYears: parseInt(e.target.value) })} className={inputCls}>
                        <option value={1}>1 an (Niveau 1)</option>
                        <option value={2}>2 ans (Niveau 1 &amp; Niveau 2)</option>
                        <option value={3}>3 ans (Niveau 1, Niveau 2 &amp; Niveau 3)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Formulaire Année Académique */}
                {modalType === "year" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Intitulé de la session</label>
                      <input required placeholder="Ex: 2026-2027" value={formPayload.label} onChange={(e) => setFormPayload({ ...formPayload, label: e.target.value })} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Date de début</label>
                        <input required type="date" value={formPayload.startDate} onChange={(e) => setFormPayload({ ...formPayload, startDate: e.target.value })} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Date de fin</label>
                        <input required type="date" value={formPayload.endDate} onChange={(e) => setFormPayload({ ...formPayload, endDate: e.target.value })} className={inputCls} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer pt-1">
                      <input type="checkbox" checked={formPayload.isCurrent} onChange={(e) => setFormPayload({ ...formPayload, isCurrent: e.target.checked })} className="rounded-md accent-primary h-4 w-4" />
                      <span>Définir comme session active (En cours)</span>
                    </label>
                  </div>
                )}

                {/* Formulaire Salle */}
                {modalType === "salle" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Nom / Numéro de la salle</label>
                      <input required placeholder="Ex: Salle B12, Atelier Mécanique..." value={formPayload.name} onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Capacité maximale (places)</label>
                      <input type="number" min={1} placeholder="Ex: 35" value={formPayload.capacity} onChange={(e) => setFormPayload({ ...formPayload, capacity: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                )}

                {/* Formulaire Classe */}
                {modalType === "classe" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Filière</label>
                      <select
                        required
                        value={formPayload.filiereId}
                        onChange={(e) => {
                          const fil = filieres.find((f) => f.id === e.target.value);
                          setFormPayload({
                            ...formPayload,
                            filiereId: e.target.value,
                            niveauId: fil?.niveaux?.[0]?.id || "",
                          });
                        }}
                        className={inputCls}
                      >
                        {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Niveau d'études</label>
                      <select
                        required
                        value={formPayload.niveauId}
                        onChange={(e) => setFormPayload({ ...formPayload, niveauId: e.target.value })}
                        className={inputCls}
                      >
                        {filieres.find((f) => f.id === formPayload.filiereId)?.niveaux?.map((n) => (
                          <option key={n.id} value={n.id}>Niveau {n.order}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Année Académique</label>
                      <select required value={formPayload.academicYearId} onChange={(e) => setFormPayload({ ...formPayload, academicYearId: e.target.value })} className={inputCls}>
                        {academicYears.filter(y => y.isCurrent).map((y) => (
                          <option key={y.id} value={y.id}>{y.label} (Session active)</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Salle assignée</label>
                      <select value={formPayload.salleId} onChange={(e) => setFormPayload({ ...formPayload, salleId: e.target.value })} className={inputCls}>
                        <option value="">Aucune salle assignée</option>
                        {salles.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.capacity || "?"} places)</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">Libellé personnalisé (Optionnel)</label>
                      <input placeholder="Laisser vide pour auto-génération" value={formPayload.label} onChange={(e) => setFormPayload({ ...formPayload, label: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                )}

                {modalError && <p className="rounded-md bg-error-container px-3 py-2 text-xs text-error font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button type="button" onClick={() => setModalType(null)} className="rounded-md px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">
                    Annuler
                  </button>
                  <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark disabled:opacity-60">
                    {saving ? "Enregistrement..." : "Créer"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* Modale de confirmation de suppression */}
          {deleteTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-md bg-white p-md sm:p-lg shadow-xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center gap-2 text-error">
                  <Icon name="warning" className="text-[20px]" />
                  <h3 className="text-sm font-bold text-on-surface">Confirmer la suppression</h3>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Supprimer définitivement <strong>{deleteTarget.name}</strong> ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button onClick={() => setDeleteTarget(null)} className="rounded-md px-3.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">
                    Annuler
                  </button>
                  <button onClick={confirmDelete} className="rounded-md bg-error px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-90">
                    Supprimer
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}