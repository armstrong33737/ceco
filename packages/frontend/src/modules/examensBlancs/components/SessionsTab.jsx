// packages/frontend/src/modules/examensBlancs/components/SessionsTab.jsx
import React from "react";
import { StructuredPanel } from "../../../design-system/layout/Card";
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

export default function SessionsTab({
  sessions = [],
  onPrintSessionBundle,
  onToggleSessionLock,
  onDeleteSession,
}) {
  return (
    <StructuredPanel
      title="Sessions d'Examen Blanc Organisées"
      subtitle="Chaque session enrôle les classes sortantes terminales et peut être officiellement clôturée"
      icon="calendar_month"
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Intitulé Officiel</TableHeaderCell>
            <TableHeaderCell className="w-32">Session</TableHeaderCell>
            <TableHeaderCell className="w-48">Période</TableHeaderCell>
            <TableHeaderCell className="w-32 text-center">Classes Inscrites</TableHeaderCell>
            <TableHeaderCell className="w-32 text-center">Statut</TableHeaderCell>
            <TableHeaderCell align="right">Actes MINEFOP</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sessions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-ink-muted py-8">
                Aucune session d'examen blanc organisée pour le moment.
              </TableCell>
            </TableRow>
          ) : (
            sessions.map((sess) => (
              <TableRow key={sess.id}>
                <TableCell className="font-bold text-ink-primary dark:text-white">{sess.title}</TableCell>
                <TableCell className="font-mono text-caption">{sess.academicYear?.label}</TableCell>
                <TableCell className="text-caption text-ink-secondary dark:text-ink-secondary-dark">
                  Du {new Date(sess.startDate).toLocaleDateString("fr-FR")} au {new Date(sess.endDate).toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell align="center" className="font-mono font-bold text-brand-900 dark:text-brand-500">
                  {sess.classeMockExams?.length || 0}
                </TableCell>
                <TableCell align="center">
                  <Badge variant={sess.isLocked ? "warning" : "success"} withDot>
                    {sess.isLocked ? "🔒 Clôturée" : "🟢 Ouverte"}
                  </Badge>
                </TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon="auto_stories"
                      onClick={() => onPrintSessionBundle(sess.id, sess.title)}
                      title="Compiler tous les bordereaux de toutes les classes en un seul PDF multipages"
                    >
                      Recueil Compilé
                    </Button>

                    <Button
                      variant={sess.isLocked ? "secondary" : "warning"}
                      size="sm"
                      icon={sess.isLocked ? "lock_open" : "lock"}
                      onClick={() => onToggleSessionLock(sess.id, !sess.isLocked)}
                      title={sess.isLocked ? "Réouvrir la session" : "Clôturer et sceller la session"}
                    >
                      {sess.isLocked ? "Déverrouiller" : "Clôturer"}
                    </Button>

                    {!sess.isLocked && (
                      <Button
                        variant="tertiary"
                        size="sm"
                        icon="delete"
                        className="text-error"
                        onClick={() => onDeleteSession(sess.id)}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </StructuredPanel>
  );
}