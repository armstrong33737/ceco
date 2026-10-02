// packages/frontend/src/components/OnboardingWizardModal.jsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Button from "../design-system/primitives/Button";
import Badge from "../design-system/primitives/Badge";
import Checkbox from "../design-system/primitives/Checkbox";
import Icon from "./Icon";

const WIZARD_STEPS = [
  {
    step: 1,
    title: "1. Identité Légale, Sceau & Signatures",
    icon: "storefront",
    badge: "Administration",
    link: "/administration/centre",
    buttonLabel: "Configurer l'Établissement",
    description:
      "Renseignez la dénomination officielle du centre, l'arrêté d'agrément ministériel (MINEFOP), téléversez le logo, le Sceau de la République et les signatures scannées officielles de la direction.",
    keyPoints: [
      "Le N° d'agrément sera imprimé automatiquement sur toutes les cartes, attestations et diplômes.",
      "Le Sceau et le Logo sont utilisés en filigrane translucide vectoriel haute définition.",
      "Les signatures scannées sont protégées et apposées automatiquement en pied de page des actes.",
    ],
  },
  {
    step: 2,
    title: "2. Structure Académique & Filières",
    icon: "account_tree",
    badge: "Structure",
    link: "/academie/filieres",
    buttonLabel: "Gérer l'Offre de Formation",
    description:
      "Configurez vos cycles (DQP, CQP), vos filières d'apprentissage (durée de 1 à 3 ans), générez les promotions (cohortes) et ouvrez votre session académique active au format standard YYYY-YYYY.",
    keyPoints: [
      "Chaque filière génère automatiquement ses niveaux correspondants (Niveau 1, 2, 3).",
      "Une session active garantit l'étanchéité et la régularité des inscriptions.",
      "Le moteur de transition annuelle permet de promouvoir les admis d'un simple clic.",
    ],
  },
  {
    step: 3,
    title: "3. Inscription des Apprenants & Badges",
    icon: "group",
    badge: "Scolarité",
    link: "/apprenants",
    buttonLabel: "Ouvrir le Registre Apprenants",
    description:
      "Inscrivez vos apprenants avec génération scellée du matricule officiel (ex: STU26-0001), capture de photo par webcam carrée 4:4 en direct ou importation en masse via fichier CSV.",
    keyPoints: [
      "Tirage instantané des planches A4 de badges duplex avec repères de coupe d'imprimerie.",
      "Certificats de scolarité et fiches individuelles d'inscription émis en 1 clic.",
      "Chaque document externe intègre un QR Code de certification autonome hors-ligne.",
    ],
  },
  {
    step: 4,
    title: "4. Pédagogie, Formateurs & Saisie des Notes",
    icon: "edit_note",
    badge: "Évaluations",
    link: "/pedagogie/saisie",
    buttonLabel: "Accéder à la Saisie des Notes",
    description:
      "Instanciez les maquettes de cours pour chaque classe, affectez vos enseignants et saisissez les notes (CC1, CC2, Examen, Rattrapage) dans une grille matricielle rapide type tableur.",
    keyPoints: [
      "Création de comptes enseignants en 1 clic pour qu'ils saisissent leurs notes depuis leur poste.",
      "Calcul instantané des moyennes continues et des notes finales avec qualification des absences.",
      "Verrouillage officiel des bordereaux pour sceller les résultats avant délibération.",
    ],
  },
  {
    step: 5,
    title: "5. Jurys de Délibération & Diplômes (V4)",
    icon: "workspace_premium",
    badge: "Diplomation",
    link: "/pedagogie/bulletins",
    buttonLabel: "Éditer les Bulletins & Diplômes",
    description:
      "Exécutez la délibération semestrielle ou annuelle, attribuez les rangs et décisions souveraines du jury, puis imprimez les livrets complets de bulletins et diplômes de fin de formation.",
    keyPoints: [
      "Bulletins semestriels bilingues avec sous-totaux par groupes et double grille synoptique.",
      "Relevés de notes annuels synthétisant les semestres S1 et S2 avec mentions.",
      "Diplômes de fin de formation au format Paysage ornemental certifié.",
    ],
  },
];

export default function OnboardingWizardModal({ isOpen, onClose }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) setCurrentStepIndex(0);
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const currentStep = WIZARD_STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === WIZARD_STEPS.length - 1;

  function handleCloseModal() {
    if (dontShowAgain) {
      localStorage.setItem("ceco_onboarding_dismissed", "true");
    }
    onClose();
  }

  function handleGoToModule(path) {
    handleCloseModal();
    navigate(path);
  }

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.1 }}
          className="w-full max-w-2xl rounded bg-surface border border-border shadow-modal flex flex-col justify-between max-h-[92vh] overflow-hidden dark:bg-surface-dark dark:border-border-dark"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0 dark:border-border-dark">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[2px] bg-brand-900/10 text-brand-900 dark:bg-brand-500/20 dark:text-brand-500">
                <Icon name="explore" className="text-[22px]" />
              </div>
              <div>
                <h3 className="text-body-md font-semibold text-ink-primary font-sans dark:text-white">
                  Guide de Prise en Main CECO Suite ERP
                </h3>
                <p className="text-caption text-ink-muted">Les 5 étapes fondamentales pour piloter votre établissement.</p>
              </div>
            </div>
            <button type="button" onClick={handleCloseModal} className="text-ink-muted hover:text-ink-primary p-1 rounded dark:hover:text-white">
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>

          {/* STEPPER HORIZONTAL */}
          <div className="flex items-center justify-between gap-1 p-2 bg-[#F5F7FA] border-b border-border flex-shrink-0 dark:bg-[#07111D] dark:border-border-dark">
            {WIZARD_STEPS.map((s, idx) => {
              const isPassed = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`flex-1 py-1.5 px-2 rounded-[2px] text-caption font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    isCurrent
                      ? "bg-brand-900 text-white shadow-xs dark:bg-brand-500"
                      : isPassed
                      ? "bg-success-subtle text-success border border-success/30 dark:bg-success-subtle-dark"
                      : "text-ink-secondary hover:bg-surface dark:hover:bg-surface-dark"
                  }`}
                >
                  <Icon name={isPassed ? "check_circle" : s.icon} className="text-[14px]" />
                  <span className="hidden sm:inline">Étape {s.step}</span>
                </button>
              );
            })}
          </div>

          {/* CORPS DE L'ÉTAPE ACTIVE */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1 text-body-sm">
            <div className="flex items-center justify-between">
              <Badge variant="brand">{currentStep.badge}</Badge>
              <span className="text-caption font-mono font-bold text-ink-secondary dark:text-ink-secondary-dark">
                {currentStepIndex + 1} / {WIZARD_STEPS.length}
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="text-body-md font-heading font-semibold text-ink-primary flex items-center gap-2 dark:text-white">
                <Icon name={currentStep.icon} className="text-brand-900 dark:text-brand-500 text-[20px]" />
                <span>{currentStep.title}</span>
              </h4>
              <p className="text-ink-secondary leading-relaxed dark:text-ink-secondary-dark">{currentStep.description}</p>
            </div>

            {/* Points Clés */}
            <div className="p-4 rounded bg-[#F5F7FA] border border-border space-y-2 dark:bg-[#07111D] dark:border-border-dark">
              <span className="text-overline font-semibold text-ink-secondary uppercase tracking-wider block">
                Points Clés &amp; Bonnes Pratiques :
              </span>
              <ul className="space-y-2">
                {currentStep.keyPoints.map((kp, kidx) => (
                  <li key={kidx} className="flex items-start gap-2.5 text-ink-primary dark:text-ink-primary-dark">
                    <Icon name="check" className="text-success text-[16px] flex-shrink-0 mt-0.5" />
                    <span>{kp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bouton d'accès direct */}
            <div className="pt-2 flex justify-center">
              <Button
                variant="primary"
                icon="launch"
                onClick={() => handleGoToModule(currentStep.link)}
              >
                {currentStep.buttonLabel}
              </Button>
            </div>
          </div>

          {/* FOOTER */}
          <div className="border-t border-border bg-[#FAFBFD] px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0 dark:border-border-dark dark:bg-[#07111D]/40">
            <Checkbox
              label="Ne plus afficher automatiquement au démarrage"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />

            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button variant="secondary" size="sm" onClick={() => setCurrentStepIndex((prev) => prev - 1)}>
                  Précédent
                </Button>
              )}

              {!isLast ? (
                <Button variant="primary" size="sm" icon="chevron_right" iconPosition="right" onClick={() => setCurrentStepIndex((prev) => prev + 1)}>
                  Suivant
                </Button>
              ) : (
                <Button variant="primary" size="sm" icon="done_all" onClick={handleCloseModal}>
                  J'ai compris, terminer
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}