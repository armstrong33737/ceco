// packages/frontend/src/modules/academie/SessionsPage.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import Button from "../../design-system/primitives/Button";
import Input from "../../design-system/primitives/Input";
import Badge from "../../design-system/primitives/Badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "../../design-system/data-grid/Table";
import Modal from "../../design-system/overlays/Modal";
import TransitionModal from "./components/TransitionModal";

export default function SessionsPage() {
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ label: "", startDate: "", endDate: "", isCurrent: false });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Transition Annuelle
  const [showTransition, setShowTransition] = useState(false);
  const [transitionData, setTransitionData] = useState({ previousYearId: "", newYearId: "" });
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState(null);

  const currentAcademicYear = academicYears.find((y) => y.isCurrent);
  const upcomingYear = academicYears.find((y) => y.status === "UPCOMING");

  async function loadData() {
    setLoading(true);
    try {
      const yData = await apiFetch("/academic-years");
      setAcademicYears(yData || []);
    } catch (err) {
      showToast(err.message || "Erreur de chargement des sessions.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      if (editingItem) {
        await apiFetch(`/academic-years/${editingItem.id}`, { method: "PUT", body: JSON.stringify(form) });
        showToast("Session mise à jour.", "success");
      } else {
        await apiFetch("/academic-years", { method: "POST", body: JSON.stringify(form) });
        showToast("Nouvelle session académique créée avec succès.", "success");
      }
      setModal(false);
      setEditingItem(null);
      await loadData();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSetCurrentYear(yearId) {
    try {
      await apiFetch(`/academic-years/${yearId}/set-current`, { method: "PUT" });
      showToast("Session académique activée avec succès.", "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleExecuteTransition(e) {
    e.preventDefault();
    if (!transitionData.previousYearId || !transitionData.newYearId) {
      setTransitionError("Veuillez sélectionner la session sortante et la session cible.");
      return;
    }
    setTransitioning(true);
    setTransitionError(null);
    try {
      const res = await apiFetch(`/academic-years/${transitionData.newYearId}/transition`, {
        method: "POST",
        body: JSON.stringify({ previousYearId: transitionData.previousYearId }),
      });
      setShowTransition(false);
      showToast(res.message, "success", 5000);
      await loadData();
    } catch (err) {
      setTransitionError(err.message);
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Structure Académique • Cycle de Vie</Badge>}
        title="Sessions Académiques &amp; Transitions"
        subtitle="Gestion des années scolaires (UPCOMING, CURRENT, CLOSED) et promotion automatique des admis"
        actions={
          <>
            <Button
              variant="secondary"
              icon="swap_horiz"
              disabled={!upcomingYear}
              onClick={() => {
                setTransitionError(null);
                setTransitionData({ previousYearId: currentAcademicYear?.id || "", newYearId: upcomingYear?.id || "" });
                setShowTransition(true);
              }}
              title={!upcomingYear ? "Créez une session préparatoire pour débloquer la transition" : ""}
            >
              Transition Annuelle
            </Button>
            <Button
              variant="primary"
              icon="add"
              onClick={() => {
                setEditingItem(null);
                setModalError(null);
                setForm({ label: "", startDate: "", endDate: "", isCurrent: false });
                setModal(true);
              }}
            >
              Nouvelle Session
            </Button>
          </>
        }
      />

      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Session</TableHeaderCell>
              <TableHeaderCell>Période Officielle</TableHeaderCell>
              <TableHeaderCell className="w-24">Classes</TableHeaderCell>
              <TableHeaderCell className="w-28">Promotions</TableHeaderCell>
              <TableHeaderCell className="w-28">Inscrits</TableHeaderCell>
              <TableHeaderCell className="w-48">État du Cycle de Vie</TableHeaderCell>
              <TableHeaderCell align="right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {academicYears.map((y) => {
              const isCurrent = y.isCurrent || y.status === "CURRENT";
              const isUpcoming罕 = y.status === "UPCOMING" && !y.isCurrent;
              const isClosed = y.status === "CLOSED" || (!y.isCurrent && y.status !== "UPCOMING");

              return (
                <TableRow key={y.id}>
                  <TableCell className="font-heading font-semibold text-body-md text-ink-primary dark:text-white">{y.label}</TableCell>
                  <TableCell className="text-caption text-ink-secondary dark:text-ink-secondary-dark">
                    Du {new Date(y.startDate).toLocaleDateString("fr-FR")} au {new Date(y.endDate).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="font-mono">{y._count?.classes || 0}</TableCell>
                  <TableCell className="font-mono">{y._count?.promotions || 0}</TableCell>
                  <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{y._count?.inscriptions || 0}</TableCell>
                  <TableCell>
                    {isCurrent && <Badge variant="success" withDot>Session Active</Badge>}
                    {isUpcoming罕 && <Badge variant="info" withDot>Préparatoire</Badge>}
                    {isClosed && <Badge variant="neutral">🔒 Clôturée (Scellée)</Badge>}
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      {!isClosed ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingItem(y);
                              setModalError(null);
                              setForm({ label: y.label, startDate: new Date(y.startDate).toISOString().split("T")[0], endDate: new Date(y.endDate).toISOString().split("T")[0] });
                              setModal(true);
                            }}
                          >
                            Modifier
                          </Button>
                          {isUpcoming罕 && (
                            <Button variant="primary" size="sm" onClick={() => handleSetCurrentYear(y.id)}>
                              Activer
                            </Button>
                          )}
                        </>
                      ) : (
                        <span className="text-caption text-ink-muted italic px-2">Lecture seule</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modale Session */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editingItem ? "Modifier la Session" : "Nouvelle Session Académique"}
        icon="calendar_month"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={saving}>Enregistrer</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input required label="Intitulé officiel (Format YYYY-YYYY)" placeholder="Ex: 2026-2027" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input required type="date" label="Date de Début" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input required type="date" label="Date de Fin" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>

          <div className="p-3 rounded bg-info-subtle border border-info/30 text-info text-caption font-medium dark:bg-info-subtle-dark dark:text-info-dark">
            Une session académique valide doit couvrir au minimum 8 mois (240 jours).
          </div>

          {modalError && (
            <p className="rounded bg-error-subtle p-3 text-error border border-error/30 text-caption font-medium">{modalError}</p>
          )}
        </form>
      </Modal>

      {/* Modale Transition */}
      <TransitionModal
        isOpen={showTransition}
        onClose={() => setShowTransition(false)}
        transitionData={transitionData}
        setTransitionData={setTransitionData}
        academicYears={academicYears}
        onSubmit={handleExecuteTransition}
        isLoading={transitioning}
        error={transitionError}
      />
    </motion.div>
  );
}