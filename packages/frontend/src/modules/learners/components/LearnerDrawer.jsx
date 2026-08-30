// packages/frontend/src/modules/learners/components/LearnerDrawer.jsx
import React from "react";
import Drawer from "../../../design-system/overlays/Drawer";
import Button from "../../../design-system/primitives/Button";
import Badge from "../../../design-system/primitives/Badge";
import Icon from "../../../components/Icon";
import { API_BASE, getToken } from "../../../lib/apiClient";

export default function LearnerDrawer({
  isOpen,
  onClose,
  student,
  onEdit,
  onGenerateDoc,
}) {
  if (!student) return null;

  const token = getToken();
  const photoUrl = student.photoPath ? `${API_BASE}/students/${student.id}/photo?token=${token}` : null;
  const currentInsc = student.inscriptions?.[0];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`${student.lastName} ${student.firstName}`}
      subtitle={`Matricule officiel : ${student.matricule}`}
      icon="person"
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
          <Button
            variant="primary"
            icon="edit"
            onClick={() => {
              onClose();
              onEdit(student);
            }}
          >
            Éditer le Dossier
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* En-tête du profil avec photo carrée 4:4 */}
        <div className="flex items-center gap-4 p-4 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark">
          <div className="w-20 h-20 rounded-[2px] overflow-hidden bg-surface border border-border flex items-center justify-center flex-shrink-0 shadow-inner dark:bg-surface-dark dark:border-border-dark">
            {photoUrl ? (
              <img src={photoUrl} alt={student.firstName} className="w-full h-full object-cover" />
            ) : (
              <span className="font-heading font-bold text-h4 text-brand-900 dark:text-brand-500">
                {student.lastName?.charAt(0)}{student.firstName?.charAt(0)}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-h4 font-heading font-semibold text-ink-primary dark:text-white">
                {student.lastName} {student.firstName}
              </h3>
            </div>
            <span className="font-mono text-caption text-brand-900 font-bold block dark:text-brand-500">
              {student.matricule}
            </span>
            <p className="text-caption text-ink-muted">
              {student.gender === "F" ? "Féminin" : "Masculin"} • Né(e) le {safeFormatDate(student.birthDate)}{student.birthPlace ? ` à ${student.birthPlace}` : ""}
            </p>
          </div>
        </div>

        {/* Coordonnées & Contact d'urgence (Tuteur légal) */}
        <div className="space-y-2">
          <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold block">
            Contacts &amp; Personne à Contacter en Cas d'Urgence
          </span>
          <div className="grid grid-cols-2 gap-3 p-4 rounded bg-surface border border-border text-body-sm dark:bg-surface-dark dark:border-border-dark">
            <div>
              <span className="text-caption text-ink-muted block">Téléphone Apprenant</span>
              <span className="font-mono font-medium text-ink-primary dark:text-white">{student.phone || "Non renseigné"}</span>
            </div>
            <div>
              <span className="text-caption text-ink-muted block">Diplôme d'entrée</span>
              <span className="font-medium text-ink-primary dark:text-white">{student.entryDiploma || "Aucun"}</span>
            </div>
            <div>
              <span className="text-caption text-ink-muted block">Parent / Tuteur Légal</span>
              <span className="font-semibold text-ink-primary dark:text-white">{student.guardianName || "Non renseigné"}</span>
            </div>
            <div>
              <span className="text-caption text-ink-muted block">Téléphone d'urgence</span>
              <span className="font-mono font-semibold text-brand-900 dark:text-brand-500">{student.guardianPhone || "—"}</span>
            </div>
          </div>
        </div>

        {/* Parcours Académique & Promotions (Cohortes) */}
        <div className="space-y-2">
          <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold block">
            Historique Académique &amp; Inscriptions
          </span>
          <div className="divide-y divide-border border border-border rounded overflow-hidden dark:divide-border-dark dark:border-border-dark">
            {student.inscriptions?.map((insc) => (
              <div key={insc.id} className="p-3.5 bg-surface flex items-center justify-between text-body-sm dark:bg-surface-dark">
                <div>
                  <span className="font-semibold text-ink-primary dark:text-white">{insc.classe?.label}</span>
                  <div className="text-caption text-ink-muted font-mono mt-0.5">
                    Cohorte : <strong className="text-brand-900 dark:text-brand-500">{insc.promotion?.label || "—"}</strong> • Session : {insc.academicYear?.label}
                  </div>
                </div>
                <Badge variant={insc.status === "admis" || insc.status === "diplome" ? "success" : "info"}>
                  {insc.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Émission Rapide des Actes & Documents Certifiés */}
        <div className="space-y-2 pt-2 border-t border-border dark:border-border-dark">
          <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold block">
            Actes Officiels &amp; Documents Certifiés
          </span>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon="badge"
              onClick={() => onGenerateDoc(student, "CARTE_ETUDIANT")}
            >
              Carte Badge
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="verified"
              onClick={() => onGenerateDoc(student, "ATTESTATION_INSCRIPTION")}
            >
              Certificat
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="description"
              onClick={() => onGenerateDoc(student, "FICHE_INSCRIPTION")}
            >
              Fiche Inscription
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}