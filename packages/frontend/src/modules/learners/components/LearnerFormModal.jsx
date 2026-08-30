// packages/frontend/src/modules/learners/components/LearnerFormModal.jsx
import React from "react";
import Modal from "../../../design-system/overlays/Modal";
import Button from "../../../design-system/primitives/Button";
import Input from "../../../design-system/primitives/Input";
import Select from "../../../design-system/primitives/Select";
import Icon from "../../../components/Icon";

export default function LearnerFormModal({
  isOpen,
  onClose,
  isEdit = false,
  form,
  setForm,
  onSubmit,
  isLoading = false,
  error = null,
  classes = [],
  academicYears = [],
  photoPreview = null,
  onPhotoSelect,
  onOpenWebcam,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Modifier le Dossier Apprenant" : "Inscription d'un Nouvel Apprenant"}
      subtitle={isEdit ? `Matricule scellé : ${form.matricule}` : "Renseignez l'état civil, les contacts d'urgence et l'affectation académique"}
      icon={isEdit ? "edit" : "person_add"}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Annuler</Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isLoading}>
            {isEdit ? "Enregistrer les Modifications" : "Inscrire au Registre"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Section 1 : Photo & Capture Webcam */}
        <div className="flex items-center gap-4 p-4 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark">
          <div className="w-20 h-20 rounded-[2px] bg-surface border border-border overflow-hidden flex items-center justify-center shadow-inner flex-shrink-0 dark:bg-surface-dark dark:border-border-dark">
            {photoPreview ? (
              <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
            ) : (
              <Icon name="account_circle" className="text-ink-muted text-[42px]" />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <label className="cursor-pointer h-[32px] px-3 rounded border border-border bg-surface text-caption font-semibold text-brand-900 hover:bg-[#FAFBFD] transition-colors flex items-center justify-center shadow-xs dark:bg-surface-dark dark:border-border-dark dark:text-brand-500">
                {photoPreview ? "Changer la Photo" : "Téléverser Photo"}
                <input type="file" accept="image/*" onChange={(e) => onPhotoSelect(e, isEdit)} className="hidden" />
              </label>
              <Button variant="secondary" size="sm" icon="photo_camera" onClick={onOpenWebcam}>
                Webcam
              </Button>
            </div>
            <p className="text-caption text-ink-muted">Format carré 4:4 centré (PNG ou JPG 3 Mo max)</p>
          </div>
        </div>

        {/* Section 2 : État Civil */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input required label="Nom de famille" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Ex: NGALEU" />
          <Input required label="Prénom(s)" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Ex: Armstrong" />
          <Select label="Genre" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input type="date" label="Date de naissance" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          <Input label="Lieu de naissance" value={form.birthPlace} onChange={(e) => setForm({ ...form, birthPlace: e.target.value })} placeholder="Ex: Bafoussam" />
          <Input label="Contact apprenant" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XXXXXXXX" />
        </div>

        {/* Section 3 : Urgence & Scolarité */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark">
          <Input label="Parent / Tuteur légal" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} placeholder="Nom du tuteur" />
          <Input label="Téléphone d'urgence" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} placeholder="N° du tuteur" />
          <Select label="Diplôme d'entrée" value={form.entryDiploma} onChange={(e) => setForm({ ...form, entryDiploma: e.target.value })}>
            <option value="Aucun">Sans diplôme</option>
            <option value="CEP">CEP / Primary</option>
            <option value="BEPC">BEPC / O-Level</option>
            <option value="CAP">CAP Professionnel</option>
            <option value="Probatoire">Probatoire</option>
            <option value="BAC">Baccalauréat / A-Level</option>
            <option value="Superieur">BTS / Licence</option>
          </Select>
        </div>

        {/* Section 4 : Affectation Académique (uniquement lors de la création) */}
        {!isEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border dark:border-border-dark">
            <Select
              required
              label="Session Académique Active"
              value={form.academicYearId}
              onChange={(e) => {
                const yId = e.target.value;
                const mClasses = classes.filter((c) => c.academicYearId === yId || c.academicYear?.isCurrent);
                setForm({ ...form, academicYearId: yId, classeId: mClasses[0]?.id || "" });
              }}
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.label} {y.isCurrent ? "(Session Active)" : ""}</option>
              ))}
            </Select>

            <Select
              required
              label="Classe d'affectation"
              value={form.classeId}
              onChange={(e) => setForm({ ...form, classeId: e.target.value })}
            >
              <option value="">Sélectionner une classe</option>
              {classes.filter((c) => c.academicYearId === form.academicYearId || c.academicYear?.isCurrent).map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </Select>
          </div>
        )}

        {!isEdit && (
          <div className="p-3 rounded bg-info-subtle border border-info/30 text-info text-caption font-medium flex items-center gap-2 dark:bg-info-subtle-dark dark:text-info-dark">
            <Icon name="verified" className="text-[18px]" />
            <span>Le matricule officiel immuable (ex: STU26-0042) sera auto-généré et scellé par le serveur.</span>
          </div>
        )}

        {error && (
          <p className="rounded bg-error-subtle p-3 text-error border border-error/30 text-caption font-medium">{error}</p>
        )}
      </form>
    </Modal>
  );
}