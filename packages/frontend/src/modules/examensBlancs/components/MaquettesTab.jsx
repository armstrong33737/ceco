// packages/frontend/src/modules/examensBlancs/components/MaquettesTab.jsx
import React from "react";
import { StructuredPanel } from "../../../design-system/layout/Card";
import Button from "../../../design-system/primitives/Button";
import Select from "../../../design-system/primitives/Select";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "../../../design-system/data-grid/Table";

export default function MaquettesTab({
  filieres = [],
  selectedFiliereId,
  onFiliereChange,
  filiereMaquette = [],
  onOpenAddModal,
  onRemoveSubject,
}) {
  return (
    <StructuredPanel
      title="Attribution des Épreuves par Filière"
      subtitle="Définissez les épreuves types et coefficients officiels d'examen blanc pour chaque filière"
      icon="account_tree"
      headerAction={
        <Button variant="primary" size="sm" icon="add" onClick={onOpenAddModal} disabled={!selectedFiliereId}>
          Ajouter une Épreuve
        </Button>
      }
    >
      <div className="mb-4 w-72">
        <Select label="Filière d'Études" value={selectedFiliereId} onChange={(e) => onFiliereChange(e.target.value)}>
          {filieres.map((f) => (
            <option key={f.id} value={f.id}>{f.name} ({f.programType?.code})</option>
          ))}
        </Select>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell className="w-16 text-center">Ordre</TableHeaderCell>
            <TableHeaderCell className="w-28">Code Épreuve</TableHeaderCell>
            <TableHeaderCell>Intitulé de l'Épreuve</TableHeaderCell>
            <TableHeaderCell className="w-32 text-center">Coefficient</TableHeaderCell>
            <TableHeaderCell align="right">Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filiereMaquette.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-ink-muted py-6">
                Aucune épreuve configurée pour cette filière. Cliquez sur « Ajouter une Épreuve ».
              </TableCell>
            </TableRow>
          ) : (
            filiereMaquette.map((m) => (
              <TableRow key={m.id}>
                <TableCell align="center" className="font-mono text-caption text-ink-muted">{m.order}</TableCell>
                <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">{m.mockSubject.code}</TableCell>
                <TableCell className="font-semibold text-ink-primary dark:text-white">{m.mockSubject.name}</TableCell>
                <TableCell align="center" className="font-mono font-bold">{m.coefficient}</TableCell>
                <TableCell align="right">
                  <Button variant="tertiary" size="sm" icon="delete" className="text-error" onClick={() => onRemoveSubject(m.id)} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </StructuredPanel>
  );
}