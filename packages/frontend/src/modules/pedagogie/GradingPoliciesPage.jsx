// packages/frontend/src/modules/pedagogie/GradingPoliciesPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/apiClient";
import { showToast } from "../../store/toastStore";
import PageHeader from "../../design-system/layout/PageHeader";
import Button from "../../design-system/primitives/Button";
import Select from "../../design-system/primitives/Select";
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

export default function GradingPoliciesPage() {
  const [policies, setPolicies] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [modal, setModal] = useState(false);
  const [selectedFiliereId, setSelectedFiliereId] = useState("");
  const [ccPercent, setCcPercent] = useState(30);
  const [saving, setSaving] = useState(false);

  function load() {
    Promise.all([apiFetch("/grading-policies"), apiFetch("/filieres")])
      .then(([pols, fils]) => {
        setPolicies(Array.isArray(pols) ? pols : []);
        setFilieres(Array.isArray(fils) ? fils : []);
      })
      .catch((e) => {
        showToast(e.message, "error");
        setPolicies([]);
        setFilieres([]);
      });
  }

  useEffect(() => { load(); }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const ccWeight = Number((ccPercent / 100).toFixed(2));
      const normalWeight = Number(((100 - ccPercent) / 100).toFixed(2));

      await apiFetch("/grading-policies", {
        method: "POST",
        body: JSON.stringify({
          filiereId: selectedFiliereId || null,
          ccWeight,
          normalWeight,
        }),
      });

      showToast("Pondération enregistrée et appliquée avec succès.", "success");
      setModal(false);
      load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Pédagogie • Formule de Calcul</Badge>}
        title="Politiques de Pondération d'Évaluation"
        subtitle="Réglez la part du Contrôle Continu / Travaux Pratiques et de l'Examen de Session Normale"
        actions={
          <Button variant="primary" icon="tune" onClick={() => { setSelectedFiliereId(""); setCcPercent(30); setModal(true); }}>
            Nouvelle Pondération
          </Button>
        }
      />

      <div className="rounded bg-surface border border-border shadow-xs overflow-hidden dark:bg-surface-dark dark:border-border-dark">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Portée de la Règle</TableHeaderCell>
              <TableHeaderCell className="w-48 text-center">Part Contrôle Continu / TP</TableHeaderCell>
              <TableHeaderCell className="w-48 text-center">Part Examen Session Normale</TableHeaderCell>
              <TableHeaderCell className="w-36 text-center">Date d'Effet</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {policies.map((pol) => {
              const cc = typeof pol.ccWeight === "number" ? (pol.ccWeight * 100).toFixed(0) : "30";
              const norm = typeof pol.normalWeight === "number" ? (pol.normalWeight * 100).toFixed(0) : "70";
              const dateStr = pol.effectiveFrom ? new Date(pol.effectiveFrom).toLocaleDateString("fr-FR") : "—";

              return (
                <TableRow key={pol.id || Math.random()}>
                  <TableCell>
                    {pol.filiere ? (
                      <div>
                        <span className="font-semibold text-ink-primary dark:text-white">{pol.filiere.name}</span>
                        <span className="text-caption font-mono text-brand-900 ml-1.5 dark:text-brand-500">({pol.filiere.durationInYears} ans)</span>
                      </div>
                    ) : (
                      <span className="font-semibold font-mono text-brand-900 dark:text-brand-500">● Règle Globale Établissement (Toutes filières)</span>
                    )}
                  </TableCell>
                  <TableCell align="center" className="font-mono font-bold text-brand-900 dark:text-brand-500">{cc} %</TableCell>
                  <TableCell align="center" className="font-mono font-bold text-ink-primary dark:text-white">{norm} %</TableCell>
                  <TableCell align="center" className="font-mono text-caption text-ink-muted">{dateStr}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title="Définir une Règle de Pondération"
        icon="tune"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleSave} isLoading={saving}>Appliquer</Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Select
            label="Portée de la règle"
            value={selectedFiliereId}
            onChange={(e) => setSelectedFiliereId(e.target.value)}
          >
            <option value="">Règle Globale (Toutes les filières)</option>
            {filieres.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>)}
          </Select>

          <div className="p-4 rounded bg-[#F5F7FA] border border-border space-y-3 dark:bg-[#07111D] dark:border-border-dark">
            <div className="flex justify-between items-center text-body-md font-semibold">
              <span className="text-brand-900 dark:text-brand-500">Contrôle Continu : {ccPercent}%</span>
              <span className="text-ink-primary dark:text-white">Examen : {100 - ccPercent}%</span>
            </div>

            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={ccPercent}
              onChange={(e) => setCcPercent(parseInt(e.target.value, 10))}
              className="w-full accent-brand-900 cursor-pointer"
            />

            <div className="flex justify-between text-caption text-ink-muted font-mono">
              <span>10% / 90%</span>
              <span className="font-bold">Standard 30% / 70%</span>
              <span>Pratique 50% / 50%</span>
            </div>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}