// packages/frontend/src/pages/Formations.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import Icon from "../components/Icon";

const inputCls = "h-10 rounded-md bg-surface px-3.5 text-xs text-on-surface outline-none border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full";

export default function Formations() {
  const [tab, setTab] = useState("filieres");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  const [programTypes, setProgramTypes] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [salles, setSalles] = useState([]);
  const [classes, setClasses] = useState([]);

  // Recherche textuelle standardisée
  const [searchQuery, setSearchQuery] = useState("");

  // Modales
  const [modalType, setModalType] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formPayload, setFormPayload] = useState({});
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Fiche de classe
  const [selectedClassDetail, setSelectedClassDetail] = useState(null);

  // Transition Annuelle
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionData, setTransitionData] = useState({ previousYearId: "", newYearId: "" });
  const [transitioning, setTransitioning] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [ptData, fData, promoData, yData, sData, cData] = await Promise.all([
        apiFetch("/program-types"),
        apiFetch("/filieres"),
        apiFetch("/promotions"),
        apiFetch("/academic-years"),
        apiFetch("/salles"),
        apiFetch("/classes"),
      ]);
      setProgramTypes(ptData || []);
      setFilieres(fData || []);
      setPromotions(promoData || []);
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
    setEditingId(null);
    setModalType(type);
    if (type === "programType") setFormPayload({ code: "", label: "" });
    if (type === "filiere") setFormPayload({ name: "", programTypeId: programTypes[0]?.id || "", durationInYears: 2 });
    if (type === "promotion") {
      const f = filieres[0];
      const y = academicYears.find((ay) => ay.isCurrent) || academicYears[0];
      setFormPayload({
        filiereId: f?.id || "",
        academicYearId: y?.id || "",
        label: `Promotion ${y?.label || "2026-2027"}`,
        expectedEndYear: "2028",
      });
    }
    if (type === "year") setFormPayload({ label: "", startDate: "", endDate: "", isCurrent: false });
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

  function openEdit(type, item) {
    setModalError(null);
    setEditingId(item.id);
    setModalType(type);
    if (type === "programType") setFormPayload({ code: item.code, label: item.label });
    if (type === "filiere") setFormPayload({ name: item.name, programTypeId: item.programTypeId, durationInYears: item.durationInYears });
    if (type === "promotion") setFormPayload({ label: item.label, expectedEndYear: item.expectedEndYear || "" });
    if (type === "year") setFormPayload({ label: item.label, startDate: new Date(item.startDate).toISOString().split("T")[0], endDate: new Date(item.endDate).toISOString().split("T")[0] });
    if (type === "salle") setFormPayload({ name: item.name, capacity: item.capacity || "" });
    if (type === "classe") setFormPayload({ salleId: item.salleId || "", label: item.label });
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      const endpoint = modalType === "programType" ? "program-types"
        : modalType === "filiere" ? "filieres"
        : modalType === "promotion" ? "promotions"
        : modalType === "year" ? "academic-years"
        : modalType === "salle" ? "salles"
        : "classes";

      if (editingId) {
        await apiFetch(`/${endpoint}/${editingId}`, { method: "PUT", body: JSON.stringify(formPayload) });
      } else {
        await apiFetch(`/${endpoint}`, { method: "POST", body: JSON.stringify(formPayload) });
      }

      setModalType(null);
      setEditingId(null);
      setSuccessMsg("Enregistrement validé avec succès.");
      setTimeout(() => setSuccessMsg(""), 3000);
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
      setSuccessMsg("Session académique activée avec succès.");
      setTimeout(() => setSuccessMsg(""), 3000);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDuplicateClasses(targetYearId) {
    const prevYear = academicYears.find((y) => y.status === "CLOSED" || (!y.isCurrent && y.id !== targetYearId));
    if (!prevYear) {
      setError("Aucune session précédente trouvée pour dupliquer les classes.");
      return;
    }
    setDuplicating(true);
    try {
      const res = await apiFetch(`/academic-years/${targetYearId}/duplicate-classes`, {
        method: "POST",
        body: JSON.stringify({ sourceYearId: prevYear.id }),
      });
      setSuccessMsg(res.message);
      setTimeout(() => setSuccessMsg(""), 4000);
      await loadAll();
    } catch (err) {
      setError(err.message || "Erreur lors de la duplication.");
    } finally {
      setDuplicating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/${deleteTarget.endpoint}/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSuccessMsg("Élément supprimé.");
      setTimeout(() => setSuccessMsg(""), 3000);
      await loadAll();
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    }
  }

  async function handleOpenClassDetail(classeId) {
    try {
      const detail = await apiFetch(`/classes/${classeId}/students`);
      setSelectedClassDetail(detail);
    } catch (err) {
      setError(err.message || "Impossible de charger la fiche de classe.");
    }
  }

  async function handleExecuteTransition(e) {
    e.preventDefault();
    if (!transitionData.previousYearId || !transitionData.newYearId) {
      setModalError("Veuillez sélectionner la session sortante et la session de destination.");
      return;
    }
    setTransitioning(true);
    setModalError(null);
    try {
      const res = await apiFetch(`/academic-years/${transitionData.newYearId}/transition`, {
        method: "POST",
        body: JSON.stringify({ previousYearId: transitionData.previousYearId }),
      });
      setShowTransitionModal(false);
      setSuccessMsg(res.message);
      await loadAll();
    } catch (err) {
      setModalError(err.message || "Échec de la transition.");
    } finally {
      setTransitioning(false);
    }
  }

  const currentAcademicYear = academicYears.find((y) => y.isCurrent);
  const upcomingYear = academicYears.find((y) => y.status === "UPCOMING");

  // Filtres de recherche textuelle réactifs
  const filteredFilieres = useMemo(() => {
    if (!searchQuery.trim()) return filieres;
    const q = searchQuery.toLowerCase();
    return filieres.filter((f) => f.name.toLowerCase().includes(q) || f.programType?.code?.toLowerCase().includes(q));
  }, [filieres, searchQuery]);

  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return classes;
    const q = searchQuery.toLowerCase();
    return classes.filter((c) => c.label.toLowerCase().includes(q) || c.filiere?.name.toLowerCase().includes(q));
  }, [classes, searchQuery]);

  const filteredPromotions = useMemo(() => {
    if (!searchQuery.trim()) return promotions;
    const q = searchQuery.toLowerCase();
    return promotions.filter((p) => p.label.toLowerCase().includes(q) || p.filiere?.name.toLowerCase().includes(q));
  }, [promotions, searchQuery]);

  const filteredSalles = useMemo(() => {
    if (!searchQuery.trim()) return salles;
    const q = searchQuery.toLowerCase();
    return salles.filter((s) => s.name.toLowerCase().includes(q));
  }, [salles, searchQuery]);

  if (loading) return <p className="text-sm text-on-surface-variant font-medium">Chargement du référentiel académique...</p>;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-md max-w-7xl mx-auto">
      {/* En-tête avec actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-on-surface">Structure Académique &amp; Formations</h1>
            <span className="rounded-md bg-primary-light text-primary font-bold text-[11px] px-2 py-0.5">
              Session active : {currentAcademicYear?.label || "Aucune"}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Cycles, filières, promotions (cohortes), classes promotionnelles et gestion des espaces.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
          {tab === "promotions" && (
            <button onClick={() => openCreate("promotion")} className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark transition-colors shadow-xs">
              + Nouvelle Promotion
            </button>
          )}
          {tab === "classes" && (
            <div className="flex gap-2">
              {currentAcademicYear && (
                <button
                  onClick={() => handleDuplicateClasses(currentAcademicYear.id)}
                  disabled={duplicating}
                  className="rounded-md border border-primary/30 px-3 py-2 text-xs font-bold text-primary hover:bg-primary-light transition-all shadow-xs flex items-center gap-1"
                >
                  <Icon name="content_copy" className="text-[16px]" />
                  <span>{duplicating ? "Duplication..." : "Dupliquer les classes"}</span>
                </button>
              )}
              <button onClick={() => openCreate("classe")} className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark transition-colors shadow-xs">
                + Créer une Classe
              </button>
            </div>
          )}
          {tab === "annees" && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalError(null);
                  setTransitionData({
                    previousYearId: currentAcademicYear?.id || "",
                    newYearId: upcomingYear?.id || "",
                  });
                  setShowTransitionModal(true);
                }}
                disabled={!upcomingYear}
                className="rounded-md bg-primary-light border border-primary/20 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all shadow-xs flex items-center gap-1 disabled:opacity-40"
              >
                <Icon name="swap_horiz" className="text-[16px]" />
                <span>Transition Annuelle</span>
              </button>
              <button onClick={() => openCreate("year")} className="rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark transition-colors shadow-xs">
                + Nouvelle Session
              </button>
            </div>
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

      {successMsg && (
        <div className="rounded-md bg-success-light p-md text-sm text-success border border-success/20 flex items-center justify-between">
          <p className="text-xs font-semibold">{successMsg}</p>
          <button onClick={() => setSuccessMsg("")} className="text-xs font-bold underline">Fermer</button>
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1.5 p-1 bg-surface-container-lowest rounded-md border border-outline-variant/30 shadow-xs overflow-x-auto">
        <button
          onClick={() => { setTab("filieres"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "filieres" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="menu_book" className="text-[16px]" />
          <span>Filières &amp; Cycles ({filieres.length})</span>
        </button>

        <button
          onClick={() => { setTab("promotions"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "promotions" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="school" className="text-[16px]" />
          <span>Promotions &amp; Cohortes ({promotions.length})</span>
        </button>

        <button
          onClick={() => { setTab("classes"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "classes" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="groups" className="text-[16px]" />
          <span>Classes Promotionnelles ({classes.length})</span>
        </button>

        <button
          onClick={() => { setTab("annees"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "annees" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="calendar_month" className="text-[16px]" />
          <span>Sessions Académiques ({academicYears.length})</span>
        </button>

        <button
          onClick={() => { setTab("salles"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "salles" ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container/60"
          }`}
        >
          <Icon name="meeting_room" className="text-[16px]" />
          <span>Salles &amp; Ateliers ({salles.length})</span>
        </button>
      </div>

      {/* Onglet 1 : Filières & Cycles */}
      {tab === "filieres" && (
        <div className="space-y-md">
          <div className="rounded-md bg-surface-container-lowest p-md border border-outline-variant/30 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Cycles reconnus (DQP, CQP...)</span>
              <button onClick={() => openCreate("programType")} className="text-xs text-primary font-bold hover:underline">+ Nouveau cycle</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {programTypes.map((pt) => (
                <div key={pt.id} className="flex items-center justify-between p-2.5 rounded-md bg-surface border border-outline-variant/20">
                  <div>
                    <span className="font-bold text-xs text-primary font-mono">{pt.code}</span>
                    <p className="text-xs text-on-surface font-medium">{pt.label}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit("programType", pt)} className="text-on-surface-variant hover:text-primary p-1.5 rounded-md">
                      <Icon name="edit" className="text-[16px]" />
                    </button>
                    <button onClick={() => setDeleteTarget({ endpoint: "program-types", id: pt.id, name: pt.code })} className="text-error hover:bg-error-container/20 p-1.5 rounded-md">
                      <Icon name="delete" className="text-[16px]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <div className="p-md border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-sm font-bold text-on-surface">Référentiel des Filières &amp; Niveaux</h2>
              <input
                type="text"
                placeholder="Rechercher filière..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-md border border-outline-variant/40 outline-none w-56 bg-surface"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-outline-variant/30 font-semibold uppercase text-on-surface-variant bg-surface">
                    <th className="px-md py-3">Filière</th>
                    <th className="px-md py-3">Cycle</th>
                    <th className="px-md py-3">Durée</th>
                    <th className="px-md py-3">Niveaux générés</th>
                    <th className="px-md py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/15">
                  {filteredFilieres.map((f) => (
                    <tr key={f.id} className="hover:bg-surface-container/20">
                      <td className="px-md py-3 font-bold text-on-surface">{f.name}</td>
                      <td className="px-md py-3 font-bold text-primary font-mono">{f.programType?.code}</td>
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
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit("filiere", f)} className="rounded-md border border-outline-variant px-2 py-1 text-on-surface font-semibold hover:bg-surface-container hover:text-primary">
                            Modifier
                          </button>
                          <button onClick={() => setDeleteTarget({ endpoint: "filieres", id: f.id, name: f.name })} className="text-error hover:bg-error-container/20 p-1.5 rounded-md">
                            <Icon name="delete" className="text-[16px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Onglet 2 : Promotions & Cohortes */}
      {tab === "promotions" && (
        <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
          <div className="p-md border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-on-surface">Promotions &amp; Cohortes d'Entrée</h2>
              <p className="text-xs text-on-surface-variant">Les promotions regroupent les apprenants entrés ensemble en Niveau 1 jusqu'à leur diplomation.</p>
            </div>
            <input
              type="text"
              placeholder="Rechercher promotion..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-md border border-outline-variant/40 outline-none w-56 bg-surface"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-outline-variant/30 font-semibold uppercase text-on-surface-variant bg-surface">
                  <th className="px-md py-3">Promotion (Cohorte)</th>
                  <th className="px-md py-3">Filière &amp; Cycle</th>
                  <th className="px-md py-3">Session d'Entrée</th>
                  <th className="px-md py-3">Sortie Prévue</th>
                  <th className="px-md py-3">Effectif Rattaché</th>
                  <th className="px-md py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {filteredPromotions.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container/20">
                    <td className="px-md py-3 font-bold text-on-surface">{p.label}</td>
                    <td className="px-md py-3">
                      <span className="font-semibold">{p.filiere?.name}</span>
                      <span className="ml-1.5 font-mono text-primary font-bold">({p.filiere?.programType?.code})</span>
                    </td>
                    <td className="px-md py-3 font-mono">{p.academicYear?.label}</td>
                    <td className="px-md py-3 font-mono font-bold text-primary">{p.expectedEndYear || "—"}</td>
                    <td className="px-md py-3 font-bold text-primary font-mono">{p._count?.inscriptions || 0}</td>
                    <td className="px-md py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit("promotion", p)} className="rounded-md border border-outline-variant px-2 py-1 text-on-surface font-semibold hover:bg-surface-container">
                          Renommer
                        </button>
                        <button onClick={() => setDeleteTarget({ endpoint: "promotions", id: p.id, name: p.label })} className="text-error hover:bg-error-container/20 p-1.5 rounded-md">
                          <Icon name="delete" className="text-[16px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onglet 3 : Classes Promotionnelles */}
      {tab === "classes" && (
        <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
          <div className="p-md border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-on-surface">Classes Promotionnelles</h2>
              <p className="text-xs text-on-surface-variant">Les classes sont des contenants rattachés à une session, une filière et un niveau précis.</p>
            </div>
            <input
              type="text"
              placeholder="Rechercher classe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-md border border-outline-variant/40 outline-none w-56 bg-surface"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-outline-variant/30 font-semibold uppercase text-on-surface-variant bg-surface">
                  <th className="px-md py-3">Classe</th>
                  <th className="px-md py-3">Session</th>
                  <th className="px-md py-3">Niveau &amp; Filière</th>
                  <th className="px-md py-3">Salle</th>
                  <th className="px-md py-3">Effectif</th>
                  <th className="px-md py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {filteredClasses.map((c) => {
                  const isClosed = c.academicYear?.status === "CLOSED" || (!c.academicYear?.isCurrent && c.academicYear?.status !== "UPCOMING");

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
                        <span className="ml-2 text-on-surface-variant">{c.filiere?.name}</span>
                      </td>
                      <td className="px-md py-3">{c.salle?.name || "Non assignée"}</td>
                      <td className="px-md py-3 font-bold text-primary font-mono">{c._count?.inscriptions || 0}</td>
                      <td className="px-md py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenClassDetail(c.id)}
                            className="rounded-md bg-primary-light border border-primary/20 px-2 py-1 text-primary font-bold hover:bg-primary hover:text-white transition-all text-[11px] flex items-center gap-1"
                            title="Voir la liste des élèves"
                          >
                            <Icon name="badge" className="text-[14px]" />
                            <span>Effectif</span>
                          </button>

                          {!isClosed ? (
                            <>
                              <button onClick={() => openEdit("classe", c)} className="rounded-md border border-outline-variant px-2 py-1 text-on-surface font-semibold hover:bg-surface-container">
                                Modifier
                              </button>
                              <button onClick={() => setDeleteTarget({ endpoint: "classes", id: c.id, name: c.label })} className="text-error hover:bg-error-container/20 p-1.5 rounded-md">
                                <Icon name="delete" className="text-[16px]" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-mono text-on-surface-variant/60 font-semibold px-2 py-1">
                              Archive scellée
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onglet 4 : Sessions Académiques (Machine d'États) */}
      {tab === "annees" && (
        <div className="overflow-hidden rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
          <div className="p-md border-b border-outline-variant/20 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-on-surface">Sessions Académiques (Cycle de Vie)</h2>
              <p className="text-xs text-on-surface-variant">
                Une session clôturée devient définitivement immuable (lecture seule). Une seule session préparatoire peut exister en avance.
              </p>
            </div>
            <span className="text-xs font-mono text-on-surface-variant">{academicYears.length} session(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-outline-variant/30 font-semibold uppercase text-on-surface-variant bg-surface">
                  <th className="px-md py-3">Session</th>
                  <th className="px-md py-3">Période</th>
                  <th className="px-md py-3">Classes</th>
                  <th className="px-md py-3">Promotions</th>
                  <th className="px-md py-3">Inscrits</th>
                  <th className="px-md py-3">État du Cycle de Vie</th>
                  <th className="px-md py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {academicYears.map((y) => {
                  const isCurrent = y.isCurrent || y.status === "CURRENT";
                  const isUpcoming = y.status === "UPCOMING" && !y.isCurrent;
                  const isClosed = y.status === "CLOSED" || (!y.isCurrent && y.status !== "UPCOMING");

                  return (
                    <tr key={y.id} className="hover:bg-surface-container/20">
                      <td className="px-md py-3 font-bold text-on-surface text-sm">{y.label}</td>
                      <td className="px-md py-3 text-on-surface-variant">
                        Du {new Date(y.startDate).toLocaleDateString("fr-FR")} au {new Date(y.endDate).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-md py-3 font-mono">{y._count?.classes || 0}</td>
                      <td className="px-md py-3 font-mono">{y._count?.promotions || 0}</td>
                      <td className="px-md py-3 font-mono font-bold text-primary">{y._count?.inscriptions || 0}</td>
                      <td className="px-md py-3">
                        {isCurrent && (
                          <span className="rounded-md bg-success-light text-success font-bold px-2.5 py-1 text-[10px] border border-success/20">
                            ● Session Active (En cours)
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="rounded-md bg-primary-light text-primary font-bold px-2.5 py-1 text-[10px] border border-primary/20">
                            ★ Préparatoire (Rentrée Prochaine)
                          </span>
                        )}
                        {isClosed && (
                          <span className="rounded-md bg-surface text-on-surface-variant font-bold px-2.5 py-1 text-[10px] border border-outline-variant/40">
                            🔒 Clôturée (Archive scellée)
                          </span>
                        )}
                      </td>
                      <td className="px-md py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isClosed ? (
                            <>
                              <button onClick={() => openEdit("year", y)} className="rounded-md border border-outline-variant px-2 py-1 text-on-surface font-semibold hover:bg-surface-container">
                                Modifier
                              </button>
                              {isUpcoming && (
                                <button onClick={() => handleSetCurrentYear(y.id)} className="rounded-md bg-primary text-white font-bold px-2.5 py-1 shadow-xs hover:bg-primary-dark">
                                  Activer la Session
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] font-mono text-on-surface-variant/60 font-semibold px-2 py-1">
                              Lecture seule
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onglet 5 : Salles */}
      {tab === "salles" && (
        <div className="space-y-md">
          <div className="flex justify-between items-center bg-surface-container-lowest p-md rounded-md border border-outline-variant/30 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-on-surface">Salles &amp; Ateliers de Formation</h3>
              <p className="text-xs text-on-surface-variant">Gestion de la capacité d'accueil et des affectations.</p>
            </div>
            <input
              type="text"
              placeholder="Rechercher salle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-md border border-outline-variant/40 outline-none w-56 bg-surface"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
            {filteredSalles.map((s) => (
              <div key={s.id} className="p-md rounded-md bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-on-surface">{s.name}</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Capacité : {s.capacity || "?"} places</p>
                  <p className="text-[10px] font-mono text-primary mt-1">{s._count?.classes || 0} classe(s) hébergée(s)</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit("salle", s)} className="text-on-surface-variant hover:text-primary p-1.5 rounded-md">
                    <Icon name="edit" className="text-[16px]" />
                  </button>
                  <button onClick={() => setDeleteTarget({ endpoint: "salles", id: s.id, name: s.name })} className="text-error hover:bg-error-container/20 p-1.5 rounded-md">
                    <Icon name="delete" className="text-[16px]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PORTAIL DES MODALES */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* MODALE TRANSITION ANNUELLE */}
          {showTransitionModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleExecuteTransition}
                className="w-full max-w-lg rounded-md bg-white p-md sm:p-lg shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="swap_horiz" className="text-primary text-[22px]" />
                    <h3 className="text-sm font-bold text-on-surface">Moteur de Transition Annuelle</h3>
                  </div>
                  <button type="button" onClick={() => setShowTransitionModal(false)} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="text-on-surface-variant leading-relaxed">
                    Cette action va promouvoir les apprenants admis vers la nouvelle session et clore définitivement la session sortante.
                  </p>
                  <div>
                    <label className="font-semibold text-on-surface-variant uppercase block mb-1">Session sortante (à clôturer)</label>
                    <select required value={transitionData.previousYearId} onChange={(e) => setTransitionData({ ...transitionData, previousYearId: e.target.value })} className={inputCls}>
                      <option value="">Sélectionner la session</option>
                      {academicYears.filter((y) => y.status !== "CLOSED").map((y) => (
                        <option key={y.id} value={y.id}>{y.label} ({y._count?.inscriptions || 0} inscrits)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-on-surface-variant uppercase block mb-1">Nouvelle session (destination)</label>
                    <select required value={transitionData.newYearId} onChange={(e) => setTransitionData({ ...transitionData, newYearId: e.target.value })} className={inputCls}>
                      <option value="">Sélectionner la session cible</option>
                      {academicYears.filter((y) => y.status === "UPCOMING" || y.isCurrent).map((y) => (
                        <option key={y.id} value={y.id}>{y.label} ({y.status === "UPCOMING" ? "Préparatoire" : "Active"})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {modalError && <p className="p-2 bg-error-container text-error text-xs rounded font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setShowTransitionModal(false)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" disabled={transitioning} className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">
                    {transitioning ? "Transition en cours..." : "Exécuter la Transition"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* MODALE FICHE DE CLASSE */}
          {selectedClassDetail && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-4xl rounded-md bg-white p-md sm:p-lg shadow-2xl border border-outline-variant/30 space-y-md max-h-[92vh] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between border-b pb-2 flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">{selectedClassDetail.label}</h3>
                    <p className="text-xs text-on-surface-variant">
                      Filière : {selectedClassDetail.filiere?.name} • Session : {selectedClassDetail.academicYear?.label} • Salle : {selectedClassDetail.salle?.name || "Non assignée"}
                    </p>
                  </div>
                  <button onClick={() => setSelectedClassDetail(null)} className="text-on-surface-variant p-1"><Icon name="close" className="text-[18px]" /></button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
                  <div className="p-2.5 bg-surface rounded border text-xs font-bold text-on-surface">
                    Effectif total : {selectedClassDetail.inscriptions?.length || 0} apprenant(s)
                  </div>
                  {selectedClassDetail.inscriptions?.length === 0 ? (
                    <p className="text-xs text-on-surface-variant text-center py-6">Aucun apprenant inscrit dans cette classe.</p>
                  ) : (
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b font-bold uppercase text-on-surface-variant bg-surface">
                          <th className="px-3 py-2">Matricule</th>
                          <th className="px-3 py-2">Nom &amp; Prénom</th>
                          <th className="px-3 py-2">Cohorte</th>
                          <th className="px-3 py-2">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/15">
                        {selectedClassDetail.inscriptions?.map((insc) => (
                          <tr key={insc.id} className="hover:bg-surface-container/20">
                            <td className="px-3 py-2 font-mono font-bold text-primary">{insc.student?.matricule}</td>
                            <td className="px-3 py-2 font-semibold text-on-surface">{insc.student?.lastName} {insc.student?.firstName}</td>
                            <td className="px-3 py-2 font-mono text-on-surface-variant">{insc.promotion?.label || "—"}</td>
                            <td className="px-3 py-2">
                              <span className="rounded bg-primary-light text-primary border border-primary/20 px-2 py-0.5 font-bold text-[10px] uppercase">
                                {insc.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t flex-shrink-0">
                  <button onClick={() => setSelectedClassDetail(null)} className="px-4 py-1.5 border rounded text-xs font-semibold">Fermer</button>
                </div>
              </motion.div>
            </div>
          )}

          {/* MODALES CRUD STANDARD */}
          {modalType && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleFormSubmit}
                className="w-full max-w-md rounded-md bg-white p-md sm:p-lg shadow-2xl border border-outline-variant/30 space-y-md"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold text-on-surface">
                    {editingId ? "Modifier" : "Ajouter"} {modalType === "programType" ? "un Cycle" : modalType === "filiere" ? "une Filière" : modalType === "promotion" ? "une Promotion" : modalType === "year" ? "une Session" : modalType === "salle" ? "une Salle" : "une Classe"}
                  </h3>
                  <button type="button" onClick={() => setModalType(null)} className="text-on-surface-variant"><Icon name="close" className="text-[18px]" /></button>
                </div>

                {modalType === "programType" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold uppercase block mb-1">Code *</label>
                      <input required placeholder="Ex: DQP" value={formPayload.code} onChange={(e) => setFormPayload({ ...formPayload, code: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase block mb-1">Intitulé *</label>
                      <input required placeholder="Diplôme de Qualification Professionnelle" value={formPayload.label} onChange={(e) => setFormPayload({ ...formPayload, label: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                )}

                {modalType === "filiere" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold uppercase block mb-1">Cycle *</label>
                      <select required value={formPayload.programTypeId} onChange={(e) => setFormPayload({ ...formPayload, programTypeId: e.target.value })} className={inputCls}>
                        {programTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.code} — {pt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase block mb-1">Nom de la filière *</label>
                      <input required placeholder="Ex: Froid et Climatisation" value={formPayload.name} onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase block mb-1">Durée du cycle (Années)</label>
                      <select value={formPayload.durationInYears} onChange={(e) => setFormPayload({ ...formPayload, durationInYears: parseInt(e.target.value) })} className={inputCls}>
                        <option value={1}>1 an (Niveau 1)</option>
                        <option value={2}>2 ans (Niveau 1 &amp; 2)</option>
                        <option value={3}>3 ans (Niveau 1, 2 &amp; 3)</option>
                      </select>
                    </div>
                  </div>
                )}

                {modalType === "promotion" && (
                  <div className="space-y-3">
                    {!editingId && (
                      <>
                        <div>
                          <label className="text-xs font-semibold uppercase block mb-1">Filière *</label>
                          <select required value={formPayload.filiereId} onChange={(e) => setFormPayload({ ...formPayload, filiereId: e.target.value })} className={inputCls}>
                            {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase block mb-1">Session d'entrée *</label>
                          <select required value={formPayload.academicYearId} onChange={(e) => setFormPayload({ ...formPayload, academicYearId: e.target.value })} className={inputCls}>
                            {academicYears.map((ay) => <option key={ay.id} value={ay.id}>{ay.label}</option>)}
                          </select>
                        </div>
                      </>
                    )}
                    <div>
                      <label className="text-xs font-semibold uppercase block mb-1">Libellé de la cohorte *</label>
                      <input required placeholder="Ex: Promotion 2026-2028" value={formPayload.label} onChange={(e) => setFormPayload({ ...formPayload, label: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase block mb-1">Année de diplomation prévue</label>
                      <input placeholder="Ex: 2028" value={formPayload.expectedEndYear} onChange={(e) => setFormPayload({ ...formPayload, expectedEndYear: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                )}

                {modalType === "year" && (() => {
                  const labelRegex = /^\d{4}-\d{4}$/;
                  const isLabelFormatValid = labelRegex.test((formPayload.label || "").trim());
                  let isMathConsistent = false;
                  if (isLabelFormatValid) {
                    const [sY, eY] = formPayload.label.trim().split("-").map(Number);
                    isMathConsistent = eY === sY + 1;
                  }

                  let diffDays = 0;
                  let isDateOrderValid = false;
                  let isDurationValid = false;
                  let monthsCalc = 0;

                  if (formPayload.startDate && formPayload.endDate) {
                    const sDate = new Date(formPayload.startDate);
                    const eDate = new Date(formPayload.endDate);
                    if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
                      diffDays = (eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24);
                      isDateOrderValid = diffDays > 0;
                      isDurationValid = diffDays >= 240 && diffDays <= 430;
                      monthsCalc = (diffDays / 30.44).toFixed(1);
                    }
                  }

                  const isFormValid = isLabelFormatValid && isMathConsistent && isDateOrderValid && isDurationValid;

                  return (
                    <div className="space-y-3 text-xs">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="font-semibold uppercase text-on-surface-variant">Intitulé de la session *</label>
                          <span className={`font-mono text-[10px] font-bold ${isLabelFormatValid && isMathConsistent ? "text-success" : "text-error"}`}>
                            {isLabelFormatValid && isMathConsistent ? "✓ Format YYYY-YYYY Conforme" : "(Format obligatoire : 2026-2027)"}
                          </span>
                        </div>
                        <input
                          required
                          placeholder="Ex: 2026-2027"
                          value={formPayload.label}
                          onChange={(e) => setFormPayload({ ...formPayload, label: e.target.value })}
                          className={`${inputCls} font-mono ${!isLabelFormatValid && formPayload.label ? "border-error focus:border-error" : ""}`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-semibold uppercase block mb-1 text-on-surface-variant">Date de Début *</label>
                          <input
                            required
                            type="date"
                            value={formPayload.startDate}
                            onChange={(e) => setFormPayload({ ...formPayload, startDate: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="font-semibold uppercase block mb-1 text-on-surface-variant">Date de Fin *</label>
                          <input
                            required
                            type="date"
                            value={formPayload.endDate}
                            onChange={(e) => setFormPayload({ ...formPayload, endDate: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                      </div>

                      {/* Indicateur de durée calculée en direct */}
                      <div className={`p-2.5 rounded border text-[11px] font-mono flex items-center justify-between ${
                        isDurationValid ? "bg-success-light/50 border-success/30 text-success" : "bg-surface border-outline-variant/40 text-on-surface-variant"
                      }`}>
                        <span>Durée académique calculée :</span>
                        <strong className="font-bold">
                          {monthsCalc > 0 ? `${monthsCalc} mois (${Math.round(diffDays)} jours)` : "—"}
                          {isDurationValid ? " ✓ Valide (≥ 8 mois)" : " (Min. 8 mois / 240 j)"}
                        </strong>
                      </div>
                    </div>
                  );
                })()}

                {modalType === "salle" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold uppercase block mb-1">Nom de la salle / atelier *</label>
                      <input required placeholder="Ex: Salle B04" value={formPayload.name} onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase block mb-1">Capacité</label>
                      <input type="number" min={1} placeholder="30" value={formPayload.capacity} onChange={(e) => setFormPayload({ ...formPayload, capacity: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                )}

                {modalType === "classe" && (
                  <div className="space-y-3">
                    {!editingId && (
                      <>
                        <div>
                          <label className="text-xs font-semibold uppercase block mb-1">Filière *</label>
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
                          <label className="text-xs font-semibold uppercase block mb-1">Niveau *</label>
                          <select required value={formPayload.niveauId} onChange={(e) => setFormPayload({ ...formPayload, niveauId: e.target.value })} className={inputCls}>
                            {filieres.find((f) => f.id === formPayload.filiereId)?.niveaux?.map((n) => (
                              <option key={n.id} value={n.id}>Niveau {n.order}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase block mb-1">Session active *</label>
                          <select required value={formPayload.academicYearId} onChange={(e) => setFormPayload({ ...formPayload, academicYearId: e.target.value })} className={inputCls}>
                            {academicYears.filter((y) => y.status !== "CLOSED").map((y) => (
                              <option key={y.id} value={y.id}>{y.label} ({y.isCurrent ? "Active" : "Préparatoire"})</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    <div>
                      <label className="text-xs font-semibold uppercase block mb-1">Salle assignée</label>
                      <select value={formPayload.salleId} onChange={(e) => setFormPayload({ ...formPayload, salleId: e.target.value })} className={inputCls}>
                        <option value="">Aucune salle assignée</option>
                        {salles.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.capacity || "?"} places)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase block mb-1">Libellé personnalisé</label>
                      <input placeholder="Laisser vide pour auto-génération" value={formPayload.label} onChange={(e) => setFormPayload({ ...formPayload, label: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                )}

                {modalError && <p className="p-2 bg-error-container text-error text-xs rounded font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setModalType(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button type="submit" disabled={saving} className="px-4 py-1.5 bg-primary text-white font-bold rounded text-xs shadow-xs">
                    {saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Créer"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* MODALE SUPPRESSION */}
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
                  <h3 className="text-sm font-bold text-on-surface">Confirmer la suppression</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Supprimer définitivement <strong>{deleteTarget.name}</strong> ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 border rounded text-xs font-semibold">Annuler</button>
                  <button onClick={confirmDelete} className="px-3.5 py-1.5 bg-error text-white font-bold rounded text-xs shadow-xs">Supprimer</button>
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