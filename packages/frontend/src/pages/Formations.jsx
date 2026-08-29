// packages/frontend/src/pages/Formations.jsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/apiClient";
import { showToast } from "../store/toastStore";
import Icon from "../components/Icon";

export default function Formations() {
  const [tab, setTab] = useState("filieres");
  const [loading, setLoading] = useState(true);

  const [programTypes, setProgramTypes] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [salles, setSalles] = useState([]);
  const [classes, setClasses] = useState([]);

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
      showToast(err.message || "Erreur de chargement de la structure académique.", "error");
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
        showToast("Élément mis à jour avec succès.", "success");
      } else {
        await apiFetch(`/${endpoint}`, { method: "POST", body: JSON.stringify(formPayload) });
        showToast("Nouvel élément créé avec succès.", "success");
      }

      setModalType(null);
      setEditingId(null);
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
      showToast("Session académique activée avec succès.", "success");
      await loadAll();
    } catch (err) {
      showToast(err.message || "Erreur d'activation.", "error");
    }
  }

  async function handleDuplicateClasses(targetYearId) {
    const prevYear = academicYears.find((y) => y.status === "CLOSED" || (!y.isCurrent && y.id !== targetYearId));
    if (!prevYear) {
      showToast("Aucune session précédente trouvée pour dupliquer les classes.", "warning");
      return;
    }
    setDuplicating(true);
    try {
      const res = await apiFetch(`/academic-years/${targetYearId}/duplicate-classes`, {
        method: "POST",
        body: JSON.stringify({ sourceYearId: prevYear.id }),
      });
      showToast(res.message, "success");
      await loadAll();
    } catch (err) {
      showToast(err.message || "Erreur lors de la duplication.", "error");
    } finally {
      setDuplicating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/${deleteTarget.endpoint}/${deleteTarget.id}`, { method: "DELETE" });
      showToast("Élément supprimé avec succès.", "warning");
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      showToast(err.message || "Impossible de supprimer cet élément.", "error");
      setDeleteTarget(null);
    }
  }

  async function handleOpenClassDetail(classeId) {
    try {
      const detail = await apiFetch(`/classes/${classeId}/students`);
      setSelectedClassDetail(detail);
    } catch (err) {
      showToast(err.message || "Impossible de charger la fiche de classe.", "error");
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
      showToast(res.message, "success");
      await loadAll();
    } catch (err) {
      setModalError(err.message || "Échec de la transition.");
    } finally {
      setTransitioning(false);
    }
  }

  const currentAcademicYear = academicYears.find((y) => y.isCurrent);
  const upcomingYear = academicYears.find((y) => y.status === "UPCOMING");

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

  if (loading) return <p className="text-xs text-slate-500 font-medium p-6">Chargement de la structure académique...</p>;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-7xl mx-auto">
      {/* 1. En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">Structure Académique &amp; Formations</h1>
            <span className="badge-blue font-mono font-bold">
              Session Active : {currentAcademicYear?.label || "Aucune"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cycles ministériels, filières pluriannuelles, promotions d'entrée et gestion des salles.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {tab === "filieres" && (
            <div className="flex gap-2">
              <button onClick={() => openCreate("programType")} className="btn-secondary">
                + Nouveau Cycle
              </button>
              <button onClick={() => openCreate("filiere")} className="btn-primary">
                + Nouvelle Filière
              </button>
            </div>
          )}
          {tab === "promotions" && (
            <button onClick={() => openCreate("promotion")} className="btn-primary">
              + Nouvelle Promotion
            </button>
          )}
          {tab === "classes" && (
            <div className="flex gap-2">
              {currentAcademicYear && (
                <button
                  onClick={() => handleDuplicateClasses(currentAcademicYear.id)}
                  disabled={duplicating}
                  className="btn-secondary"
                >
                  <Icon name="content_copy" className="text-[16px] text-blue-700" />
                  <span>{duplicating ? "Duplication..." : "Dupliquer classes"}</span>
                </button>
              )}
              <button onClick={() => openCreate("classe")} className="btn-primary">
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
                className="btn-secondary"
              >
                <Icon name="swap_horiz" className="text-[16px] text-blue-700" />
                <span>Transition Annuelle</span>
              </button>
              <button onClick={() => openCreate("year")} className="btn-primary">
                + Nouvelle Session
              </button>
            </div>
          )}
          {tab === "salles" && (
            <button onClick={() => openCreate("salle")} className="btn-primary">
              + Nouvelle Salle
            </button>
          )}
        </div>
      </div>

      {/* 2. Onglets */}
      <div className="flex gap-1 p-1 bg-white rounded-lg border border-slate-200 shadow-2xs overflow-x-auto select-none">
        <button
          onClick={() => { setTab("filieres"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "filieres" ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Icon name="menu_book" className="text-[16px]" />
          <span>Filières &amp; Cycles ({filieres.length})</span>
        </button>

        <button
          onClick={() => { setTab("promotions"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "promotions" ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Icon name="school" className="text-[16px]" />
          <span>Promotions &amp; Cohortes ({promotions.length})</span>
        </button>

        <button
          onClick={() => { setTab("classes"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "classes" ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Icon name="groups" className="text-[16px]" />
          <span>Classes Promotionnelles ({classes.length})</span>
        </button>

        <button
          onClick={() => { setTab("annees"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "annees" ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Icon name="calendar_month" className="text-[16px]" />
          <span>Sessions Académiques ({academicYears.length})</span>
        </button>

        <button
          onClick={() => { setTab("salles"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
            tab === "salles" ? "bg-blue-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Icon name="meeting_room" className="text-[16px]" />
          <span>Salles &amp; Ateliers ({salles.length})</span>
        </button>
      </div>

      {/* 3. Contenu Onglet 1 : Filières & Cycles */}
      {tab === "filieres" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Cycles d'État reconnus (DQP, CQP...)</span>
              <button onClick={() => openCreate("programType")} className="text-xs text-blue-700 font-bold hover:underline">+ Nouveau cycle</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {programTypes.map((pt) => (
                <div key={pt.id} className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
                  <div>
                    <span className="font-bold text-xs text-blue-700 font-mono">{pt.code}</span>
                    <p className="text-xs text-slate-800 font-medium">{pt.label}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit("programType", pt)} className="text-slate-500 hover:text-blue-700 p-1">
                      <Icon name="edit" className="text-[16px]" />
                    </button>
                    <button onClick={() => setDeleteTarget({ endpoint: "program-types", id: pt.id, name: pt.code })} className="text-rose-600 hover:bg-rose-50 p-1 rounded">
                      <Icon name="delete" className="text-[16px]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="table-container">
            <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">Référentiel des Filières &amp; Niveaux</h2>
              <input
                type="text"
                placeholder="Rechercher filière..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field w-56 bg-white"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="table-header-cell">Filière</th>
                    <th className="table-header-cell">Cycle</th>
                    <th className="table-header-cell">Durée</th>
                    <th className="table-header-cell">Niveaux générés</th>
                    <th className="table-header-cell text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFilieres.map((f) => (
                    <tr key={f.id} className="table-body-row">
                      <td className="table-body-cell font-bold text-slate-900">{f.name}</td>
                      <td className="table-body-cell font-bold text-blue-700 font-mono">{f.programType?.code}</td>
                      <td className="table-body-cell font-medium text-slate-700">{f.durationInYears} An(s)</td>
                      <td className="table-body-cell">
                        <div className="flex gap-1.5">
                          {f.niveaux?.map((n) => (
                            <span key={n.id} className="badge-slate font-bold">
                              Niveau {n.order}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="table-body-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit("filiere", f)} className="btn-secondary text-[11px] px-2 py-1">
                            Modifier
                          </button>
                          <button onClick={() => setDeleteTarget({ endpoint: "filieres", id: f.id, name: f.name })} className="p-1 text-rose-600 hover:bg-rose-50 rounded">
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

      {/* 4. Contenu Onglet 2 : Promotions & Cohortes */}
      {tab === "promotions" && (
        <div className="table-container">
          <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Promotions &amp; Cohortes d'Entrée</h2>
              <p className="text-xs text-slate-500">Regroupement des apprenants depuis leur entrée jusqu'à la diplomation.</p>
            </div>
            <input
              type="text"
              placeholder="Rechercher promotion..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-56 bg-white"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell">Promotion (Cohorte)</th>
                  <th className="table-header-cell">Filière &amp; Cycle</th>
                  <th className="table-header-cell">Session d'Entrée</th>
                  <th className="table-header-cell">Sortie Prévue</th>
                  <th className="table-header-cell text-center">Effectif</th>
                  <th className="table-header-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPromotions.map((p) => (
                  <tr key={p.id} className="table-body-row">
                    <td className="table-body-cell font-bold text-slate-900">{p.label}</td>
                    <td className="table-body-cell">
                      <span className="font-semibold text-slate-800">{p.filiere?.name}</span>
                      <span className="ml-1.5 font-mono text-blue-700 font-bold">({p.filiere?.programType?.code})</span>
                    </td>
                    <td className="table-body-cell font-mono">{p.academicYear?.label}</td>
                    <td className="table-body-cell font-mono font-bold text-blue-700">{p.expectedEndYear || "—"}</td>
                    <td className="table-body-cell text-center font-bold text-blue-700 font-mono">{p._count?.inscriptions || 0}</td>
                    <td className="table-body-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit("promotion", p)} className="btn-secondary text-[11px] px-2 py-1">
                          Renommer
                        </button>
                        <button onClick={() => setDeleteTarget({ endpoint: "promotions", id: p.id, name: p.label })} className="p-1 text-rose-600 hover:bg-rose-50 rounded">
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

      {/* 5. Contenu Onglet 3 : Classes Promotionnelles */}
      {tab === "classes" && (
        <div className="table-container">
          <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Classes Promotionnelles</h2>
              <p className="text-xs text-slate-500">Contenants rattachés à une session, une filière et un niveau précis.</p>
            </div>
            <input
              type="text"
              placeholder="Rechercher classe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-56 bg-white"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell">Classe</th>
                  <th className="table-header-cell">Session</th>
                  <th className="table-header-cell">Niveau &amp; Filière</th>
                  <th className="table-header-cell">Salle</th>
                  <th className="table-header-cell text-center">Effectif</th>
                  <th className="table-header-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((c) => {
                  const isClosed = c.academicYear?.status === "CLOSED" || (!c.academicYear?.isCurrent && c.academicYear?.status !== "UPCOMING");

                  return (
                    <tr key={c.id} className={`table-body-row ${isClosed ? "opacity-60 bg-slate-50/50" : ""}`}>
                      <td className="table-body-cell font-bold text-slate-900">
                        {c.label}
                      </td>
                      <td className="table-body-cell font-mono font-semibold">
                        {c.academicYear?.label} {isClosed ? "(Clôturée)" : ""}
                      </td>
                      <td className="table-body-cell">
                        <span className="badge-slate font-bold mr-2">
                          Niveau {c.niveau?.order}
                        </span>
                        <span className="text-slate-600 font-medium">{c.filiere?.name}</span>
                      </td>
                      <td className="table-body-cell font-medium text-slate-700">{c.salle?.name || "Non assignée"}</td>
                      <td className="table-body-cell text-center font-bold text-blue-700 font-mono">{c._count?.inscriptions || 0}</td>
                      <td className="table-body-cell text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenClassDetail(c.id)}
                            className="btn-secondary text-[11px] px-2 py-1 text-blue-700 border-blue-200 hover:bg-blue-50"
                            title="Voir l'effectif complet"
                          >
                            <Icon name="badge" className="text-[14px]" />
                            <span>Effectif</span>
                          </button>

                          {!isClosed ? (
                            <>
                              <button onClick={() => openEdit("classe", c)} className="btn-secondary text-[11px] px-2 py-1">
                                Modifier
                              </button>
                              <button onClick={() => setDeleteTarget({ endpoint: "classes", id: c.id, name: c.label })} className="p-1 text-rose-600 hover:bg-rose-50 rounded">
                                <Icon name="delete" className="text-[16px]" />
                              </button>
                            </>
                          ) : (
                            <span className="badge-slate text-[10px]">
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

      {/* 6. Contenu Onglet 4 : Sessions Académiques */}
      {tab === "annees" && (
        <div className="table-container">
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Sessions Académiques (Cycle de Vie)</h2>
              <p className="text-xs text-slate-500">
                Une session clôturée devient définitivement immuable (lecture seule).
              </p>
            </div>
            <span className="badge-slate font-mono">{academicYears.length} session(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className="table-header-cell">Session</th>
                  <th className="table-header-cell">Période</th>
                  <th className="table-header-cell text-center">Classes</th>
                  <th className="table-header-cell text-center">Promotions</th>
                  <th className="table-header-cell text-center">Inscrits</th>
                  <th className="table-header-cell">État du Cycle</th>
                  <th className="table-header-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {academicYears.map((y) => {
                  const isCurrent = y.isCurrent || y.status === "CURRENT";
                  const isUpcoming = y.status === "UPCOMING" && !y.isCurrent;
                  const isClosed = y.status === "CLOSED" || (!y.isCurrent && y.status !== "UPCOMING");

                  return (
                    <tr key={y.id} className="table-body-row">
                      <td className="table-body-cell font-bold text-slate-900 text-sm">{y.label}</td>
                      <td className="table-body-cell text-slate-600 font-medium">
                        Du {new Date(y.startDate).toLocaleDateString("fr-FR")} au {new Date(y.endDate).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="table-body-cell text-center font-mono">{y._count?.classes || 0}</td>
                      <td className="table-body-cell text-center font-mono">{y._count?.promotions || 0}</td>
                      <td className="table-body-cell text-center font-mono font-bold text-blue-700">{y._count?.inscriptions || 0}</td>
                      <td className="table-body-cell">
                        {isCurrent && (
                          <span className="badge-emerald">
                            ● Session Active (En cours)
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="badge-blue">
                            ★ Préparatoire (Rentrée)
                          </span>
                        )}
                        {isClosed && (
                          <span className="badge-slate">
                            🔒 Clôturée (Scellée)
                          </span>
                        )}
                      </td>
                      <td className="table-body-cell text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isClosed ? (
                            <>
                              <button onClick={() => openEdit("year", y)} className="btn-secondary text-[11px] px-2 py-1">
                                Modifier
                              </button>
                              {isUpcoming && (
                                <button onClick={() => handleSetCurrentYear(y.id)} className="btn-primary text-[11px] px-2.5 py-1">
                                  Activer la Session
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-400 font-semibold px-2 py-1">
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

      {/* 7. Contenu Onglet 5 : Salles */}
      {tab === "salles" && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-card flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Salles &amp; Ateliers de Formation</h3>
              <p className="text-xs text-slate-500">Gestion de la capacité d'accueil et des affectations.</p>
            </div>
            <input
              type="text"
              placeholder="Rechercher salle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-56"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSalles.map((s) => (
              <div key={s.id} className="p-4 rounded-lg bg-white border border-slate-200 shadow-card flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-slate-900">{s.name}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Capacité : {s.capacity || "?"} places</p>
                  <p className="text-[10px] font-mono text-blue-700 mt-1 font-bold">{s._count?.classes || 0} classe(s) assignée(s)</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit("salle", s)} className="text-slate-500 hover:text-blue-700 p-1.5 rounded">
                    <Icon name="edit" className="text-[16px]" />
                  </button>
                  <button onClick={() => setDeleteTarget({ endpoint: "salles", id: s.id, name: s.name })} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded">
                    <Icon name="delete" className="text-[16px]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. PORTAIL DES MODALES AVEC TRAITEMENT DE FORMULAIRE INTÉGRAL */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {/* MODALE TRANSITION ANNUELLE */}
          {showTransitionModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleExecuteTransition}
                className="w-full max-w-lg rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="swap_horiz" className="text-blue-700 text-[22px]" />
                    <h3 className="text-sm font-bold text-slate-900">Moteur de Transition Annuelle</h3>
                  </div>
                  <button type="button" onClick={() => setShowTransitionModal(false)} className="text-slate-400 hover:text-slate-700"><Icon name="close" className="text-[18px]" /></button>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="text-slate-600 leading-relaxed">
                    Cette action va promouvoir les apprenants admis vers la nouvelle session et clore définitivement la session sortante.
                  </p>
                  <div>
                    <label className="font-bold text-slate-700 uppercase block mb-1">Session sortante (à clôturer)</label>
                    <select required value={transitionData.previousYearId} onChange={(e) => setTransitionData({ ...transitionData, previousYearId: e.target.value })} className="input-field w-full">
                      <option value="">Sélectionner la session</option>
                      {academicYears.filter((y) => y.status !== "CLOSED").map((y) => (
                        <option key={y.id} value={y.id}>{y.label} ({y._count?.inscriptions || 0} inscrits)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 uppercase block mb-1">Nouvelle session (destination)</label>
                    <select required value={transitionData.newYearId} onChange={(e) => setTransitionData({ ...transitionData, newYearId: e.target.value })} className="input-field w-full">
                      <option value="">Sélectionner la session cible</option>
                      {academicYears.filter((y) => y.status === "UPCOMING" || y.isCurrent).map((y) => (
                        <option key={y.id} value={y.id}>{y.label} ({y.status === "UPCOMING" ? "Préparatoire" : "Active"})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {modalError && <p className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setShowTransitionModal(false)} className="btn-secondary">Annuler</button>
                  <button type="submit" disabled={transitioning} className="btn-primary">
                    {transitioning ? "Transition en cours..." : "Exécuter la Transition"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* MODALE FICHE DE CLASSE */}
          {selectedClassDetail && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4 max-h-[90vh] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selectedClassDetail.label}</h3>
                    <p className="text-xs text-slate-500">
                      Filière : {selectedClassDetail.filiere?.name} • Session : {selectedClassDetail.academicYear?.label} • Salle : {selectedClassDetail.salle?.name || "Non assignée"}
                    </p>
                  </div>
                  <button onClick={() => setSelectedClassDetail(null)} className="text-slate-400 hover:text-slate-700 p-1"><Icon name="close" className="text-[18px]" /></button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs font-bold text-slate-800">
                    Effectif total : {selectedClassDetail.inscriptions?.length || 0} apprenant(s)
                  </div>
                  {selectedClassDetail.inscriptions?.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">Aucun apprenant inscrit dans cette classe.</p>
                  ) : (
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr>
                          <th className="table-header-cell">Matricule</th>
                          <th className="table-header-cell">Nom &amp; Prénom</th>
                          <th className="table-header-cell">Cohorte</th>
                          <th className="table-header-cell text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClassDetail.inscriptions?.map((insc) => (
                          <tr key={insc.id} className="table-body-row">
                            <td className="table-body-cell font-mono font-bold text-blue-700">{insc.student?.matricule}</td>
                            <td className="table-body-cell font-semibold text-slate-900">{insc.student?.lastName} {insc.student?.firstName}</td>
                            <td className="table-body-cell font-mono text-slate-500">{insc.promotion?.label || "—"}</td>
                            <td className="table-body-cell text-center">
                              <span className="badge-slate uppercase font-bold text-[10px]">
                                {insc.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-200">
                  <button onClick={() => setSelectedClassDetail(null)} className="btn-secondary">Fermer</button>
                </div>
              </motion.div>
            </div>
          )}

          {/* MODALES CRUD STANDARD AVEC TOUS LES CHAMPS ET CALCULATEUR DE DURÉE */}
          {modalType && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-xs">
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleFormSubmit}
                className="w-full max-w-md rounded-xl bg-white p-5 shadow-modal border border-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingId ? "Modifier" : "Ajouter"} {modalType === "programType" ? "un Cycle" : modalType === "filiere" ? "une Filière" : modalType === "promotion" ? "une Promotion" : modalType === "year" ? "une Session" : modalType === "salle" ? "une Salle" : "une Classe"}
                  </h3>
                  <button type="button" onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-700"><Icon name="close" className="text-[18px]" /></button>
                </div>

                {modalType === "programType" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Code *</label>
                      <input required placeholder="Ex: DQP" value={formPayload.code} onChange={(e) => setFormPayload({ ...formPayload, code: e.target.value })} className="input-field w-full font-mono uppercase" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Intitulé *</label>
                      <input required placeholder="Diplôme de Qualification Professionnelle" value={formPayload.label} onChange={(e) => setFormPayload({ ...formPayload, label: e.target.value })} className="input-field w-full" />
                    </div>
                  </div>
                )}

                {modalType === "filiere" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Cycle *</label>
                      <select required value={formPayload.programTypeId} onChange={(e) => setFormPayload({ ...formPayload, programTypeId: e.target.value })} className="input-field w-full">
                        {programTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.code} — {pt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Nom de la filière *</label>
                      <input required placeholder="Ex: Froid et Climatisation" value={formPayload.name} onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Durée du cycle (Années)</label>
                      <select value={formPayload.durationInYears} onChange={(e) => setFormPayload({ ...formPayload, durationInYears: parseInt(e.target.value, 10) })} className="input-field w-full">
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
                          <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Filière *</label>
                          <select required value={formPayload.filiereId} onChange={(e) => setFormPayload({ ...formPayload, filiereId: e.target.value })} className="input-field w-full">
                            {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Session d'entrée *</label>
                          <select required value={formPayload.academicYearId} onChange={(e) => setFormPayload({ ...formPayload, academicYearId: e.target.value })} className="input-field w-full">
                            {academicYears.map((ay) => <option key={ay.id} value={ay.id}>{ay.label}</option>)}
                          </select>
                        </div>
                      </>
                    )}
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Libellé de la cohorte *</label>
                      <input required placeholder="Ex: Promotion 2026-2028" value={formPayload.label} onChange={(e) => setFormPayload({ ...formPayload, label: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Année de sortie prévue</label>
                      <input placeholder="Ex: 2028" value={formPayload.expectedEndYear} onChange={(e) => setFormPayload({ ...formPayload, expectedEndYear: e.target.value })} className="input-field w-full font-mono" />
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

                  return (
                    <div className="space-y-3 text-xs">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="font-bold uppercase text-slate-700">Intitulé de la session *</label>
                          <span className={`font-mono text-[10px] font-bold ${isLabelFormatValid && isMathConsistent ? "text-emerald-700" : "text-rose-700"}`}>
                            {isLabelFormatValid && isMathConsistent ? "✓ Format YYYY-YYYY Valide" : "(Format : 2026-2027)"}
                          </span>
                        </div>
                        <input
                          required
                          placeholder="Ex: 2026-2027"
                          value={formPayload.label}
                          onChange={(e) => setFormPayload({ ...formPayload, label: e.target.value })}
                          className={`input-field w-full font-mono ${!isLabelFormatValid && formPayload.label ? "border-rose-500 focus:border-rose-500" : ""}`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-bold uppercase block mb-1 text-slate-700">Date Début *</label>
                          <input
                            required
                            type="date"
                            value={formPayload.startDate}
                            onChange={(e) => setFormPayload({ ...formPayload, startDate: e.target.value })}
                            className="input-field w-full"
                          />
                        </div>
                        <div>
                          <label className="font-bold uppercase block mb-1 text-slate-700">Date Fin *</label>
                          <input
                            required
                            type="date"
                            value={formPayload.endDate}
                            onChange={(e) => setFormPayload({ ...formPayload, endDate: e.target.value })}
                            className="input-field w-full"
                          />
                        </div>
                      </div>

                      <div className={`p-2.5 rounded border text-[11px] font-mono flex items-center justify-between ${
                        isDurationValid ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}>
                        <span>Durée calculée :</span>
                        <strong className="font-bold">
                          {monthsCalc > 0 ? `${monthsCalc} mois (${Math.round(diffDays)} jours)` : "—"}
                          {isDurationValid ? " ✓ Valide (≥ 8 mois)" : " (Min. 8 mois)"}
                        </strong>
                      </div>
                    </div>
                  );
                })()}

                {modalType === "salle" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Nom de la salle *</label>
                      <input required placeholder="Ex: Salle B04" value={formPayload.name} onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Capacité</label>
                      <input type="number" min={1} placeholder="30" value={formPayload.capacity} onChange={(e) => setFormPayload({ ...formPayload, capacity: e.target.value })} className="input-field w-full" />
                    </div>
                  </div>
                )}

                {modalType === "classe" && (
                  <div className="space-y-3">
                    {!editingId && (
                      <>
                        <div>
                          <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Filière *</label>
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
                            className="input-field w-full"
                          >
                            {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Niveau *</label>
                          <select required value={formPayload.niveauId} onChange={(e) => setFormPayload({ ...formPayload, niveauId: e.target.value })} className="input-field w-full">
                            {filieres.find((f) => f.id === formPayload.filiereId)?.niveaux?.map((n) => (
                              <option key={n.id} value={n.id}>Niveau {n.order}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Session *</label>
                          <select required value={formPayload.academicYearId} onChange={(e) => setFormPayload({ ...formPayload, academicYearId: e.target.value })} className="input-field w-full">
                            {academicYears.filter((y) => y.status !== "CLOSED").map((y) => (
                              <option key={y.id} value={y.id}>{y.label} ({y.isCurrent ? "Active" : "Préparatoire"})</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Salle assignée</label>
                      <select value={formPayload.salleId} onChange={(e) => setFormPayload({ ...formPayload, salleId: e.target.value })} className="input-field w-full">
                        <option value="">Aucune salle assignée</option>
                        {salles.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.capacity || "?"} places)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Libellé personnalisé</label>
                      <input placeholder="Laisser vide pour auto-génération" value={formPayload.label} onChange={(e) => setFormPayload({ ...formPayload, label: e.target.value })} className="input-field w-full" />
                    </div>
                  </div>
                )}

                {modalError && <p className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded font-semibold">{modalError}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" onClick={() => setModalType(null)} className="btn-secondary">Annuler</button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Créer"}
                  </button>
                </div>
              </motion.form>
            </div>
          )}

          {/* MODALE SUPPRESSION */}
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
                  <h3 className="text-sm font-bold text-slate-900">Confirmer la suppression</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Supprimer définitivement <strong>{deleteTarget.name}</strong> ?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Annuler</button>
                  <button onClick={confirmDelete} className="btn-primary bg-rose-600 hover:bg-rose-700">Supprimer</button>
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