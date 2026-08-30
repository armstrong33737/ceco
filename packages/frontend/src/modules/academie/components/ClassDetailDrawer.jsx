// packages/frontend/src/modules/academie/components/ClassDetailDrawer.jsx
import React from "react";
import Drawer from "../../../design-system/overlays/Drawer";
import Button from "../../../design-system/primitives/Button";
import Badge from "../../../design-system/primitives/Badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "../../../design-system/data-grid/Table";

export default function ClassDetailDrawer({
  isOpen,
  onClose,
  classDetail,
}) {
  if (!classDetail) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={classDetail.label}
      subtitle={`Filière : ${classDetail.filiere?.name || ""} • Session : ${classDetail.academicYear?.label || ""}`}
      icon="groups"
      width="max-w-2xl"
      footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
    >
      <div className="space-y-4">
        <div className="p-4 rounded bg-[#F5F7FA] border border-border flex items-center justify-between text-body-sm dark:bg-[#07111D] dark:border-border-dark">
          <div>
            <span className="text-caption text-ink-muted block">Salle assignée</span>
            <strong className="text-ink-primary dark:text-white">{classDetail.salle?.name || "Non assignée"}</strong>
          </div>
          <Badge variant="brand">{classDetail.inscriptions?.length || 0} apprenant(s) inscrit(s)</Badge>
        </div>

        {classDetail.inscriptions?.length === 0 ? (
          <p className="text-body-sm text-ink-muted text-center py-8">Aucun apprenant inscrit dans cette classe.</p>
        ) : (
          <div className="border border-border rounded overflow-hidden dark:border-border-dark">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell className="w-28">Matricule</TableHeaderCell>
                  <TableHeaderCell>Nom &amp; Prénom</TableHeaderCell>
                  <TableHeaderCell>Cohorte</TableHeaderCell>
                  <TableHeaderCell className="w-28">Statut</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {classDetail.inscriptions?.map((insc) => (
                  <TableRow key={insc.id}>
                    <TableCell className="font-mono font-bold text-brand-900 dark:text-brand-500">
                      {insc.student?.matricule}
                    </TableCell>
                    <TableCell className="font-semibold text-ink-primary dark:text-white">
                      {insc.student?.lastName} {insc.student?.firstName}
                    </TableCell>
                    <TableCell className="font-mono text-caption text-ink-muted">
                      {insc.promotion?.label || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={insc.status === "admis" || insc.status === "diplome" ? "success" : "info"}>
                        {insc.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Drawer>
  );
}