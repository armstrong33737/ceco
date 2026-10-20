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
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
          <Button
            variant="primary"
            icon="edit"
            onClick={() => {
              onClose();
              onEdit(student);
            }}
          >
            Modifier le Dossier
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* En-tête profil */}
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
            <h3 className="text-h4 font-heading font-semibold text-ink-primary dark:text-white leading-tight">
              {student.lastName} {student.firstName}
            </h3>
            <span className="font-mono text-caption text-brand-900 font-bold block dark:text-brand-500">
              {student.matricule}
            </span>
            <p className="text-caption text-ink-muted">
              {student.gender === "F" ? "Féminin" : "Masculin"} • Né(e) le {student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—"}{student.birthPlace ? ` à ${student.birthPlace}` : ""}
            </p>
          </div>
        </div>

        {/* Émission d'actes scolaires */}
        <div className="space-y-2">
          <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold block">
            Émission d'Actes &amp; Documents Officiels
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon="badge"
              className="w-full"
              onClick={() => onGenerateDoc(student, "CARTE_ETUDIANT")}
            >
              Carte Badge
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="verified"
              className="w-full"
              onClick={() => onGenerateDoc(student, "ATTESTATION_INSCRIPTION")}
            >
              Certificat
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="description"
              className="w-full"
              onClick={() => onGenerateDoc(student, "FICHE_INSCRIPTION")}
            >
              Fiche Inscription
            </Button>
          </div>
        </div>

        {/* Coordonnées & Urgence */}
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
              <span className="text-caption text-ink-muted block">Diplôme d'Entrée</span>
              <span className="font-medium text-ink-primary dark:text-white">{student.entryDiploma || "Aucun"}</span>
            </div>
            <div>
              <span className="text-caption text-ink-muted block">Parent / Tuteur Légal</span>
              <span className="font-semibold text-ink-primary dark:text-white">{student.guardianName || "Non renseigné"}</span>
            </div>
            <div>
              <span className="text-caption text-ink-muted block">Téléphone d'Urgence</span>
              <span className="font-mono font-semibold text-brand-900 dark:text-brand-500">{student.guardianPhone || "—"}</span>
            </div>
          </div>
        </div>

        {/* Inscriptions & Cohortes */}
        <div className="space-y-2">
          <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold block">
            Historique des Inscriptions &amp; Cohortes
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
      </div>
    </Drawer>
  );
} 