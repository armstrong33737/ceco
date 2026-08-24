// packages/frontend/src/components/OnboardingWizardModal.jsx
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";

const WIZARD_STEPS = [
  {
    step: 1,
    title: "1. Identité & Agrément du Centre",
    icon: "storefront",
    badge: "Configuration Initiale",
    link: "/parametres/centre",
    buttonLabel: "Configurer l'Établissement",
    description:
      "Renseignez la dénomination officielle de votre centre, le numéro d'agrément ministériel (MINEFOP), téléversez votre logo, le Sceau de la République et la signature scannée de la direction.",
    keyPoints: [
      "Le N° d'agrément sera imprimé automatiquement sur toutes les cartes et attestations.",
      "Le Sceau et le Logo sont utilisés en filigrane vectoriel haute définition.",
      "Les signatures scannées sont protégées et apposées automatiquement en pied de page.",
    ],
  },
  {
    step: 2,
    title: "2. Structure Académique & Filières",
    icon: "account_tree",
    badge: "Offre de Formation",
    link: "/formations",
    buttonLabel: "Gérer les Formations",
    description:
      "Configurez vos cycles (DQP, CQP), créez vos filières d'études (avec durée de 1 à 3 ans), générez les promotions (cohortes) et ouvrez votre session académique active au format standard YYYY-YYYY.",
    keyPoints: [
      "Chaque filière génère automatiquement ses niveaux (Niveau 1, 2, 3).",
      "Une session académique active verrouille l'étanchéité des inscriptions.",
      "Le système de transition annuelle permet de promouvoir les admis d'un clic.",
    ],
  },
  {
    step: 3,
    title: "3. Inscription des Apprenants & Badges",
    icon: "group",
    badge: "Scolarité",
    link: "/etudiants",
    buttonLabel: "Ouvrir le Registre Apprenants",
    description:
      "Inscrivez vos apprenants avec génération scellée du matricule officiel (ex: STU26-0001), prise de photo par webcam en direct ou importation en masse via fichier CSV.",
    keyPoints: [
      "Impression des cartes d'étudiant découpables en planche A4 recto/verso.",
      "Certificats de scolarité et fiches d'inscription générés en 1 clic.",
      "Chaque document externe intègre un QR Code d'authenticité hors-ligne.",
    ],
  },
  {
    step: 4,
    title: "4. Pédagogie, Formateurs & Notes",
    icon: "edit_note",
    badge: "Évaluations",
    link: "/pedagogie/saisie",
    buttonLabel: "Accéder à la Saisie des Notes",
    description:
      "Instanciez les maquettes de cours pour chaque classe, affectez vos enseignants et saisissez les notes (CC1, CC2, Examen, Rattrapage) dans une grille matricielle fluide type tableur.",
    keyPoints: [
      "Création de comptes enseignants en 1 clic pour qu'ils saisissent leurs notes.",
      "Calcul instantané des moyennes de contrôle continu et des moyennes finales.",
      "Verrouillage officiel des bordereaux pour sceller les résultats avant délibération.",
    ],
  },
  {
    step: 5,
    title: "5. Délibérations du Jury & Diplômes (V4)",
    icon: "workspace_premium",
    badge: "Diplomation & Actes",
    link: "/pedagogie/bulletins",
    buttonLabel: "Éditer les Bulletins & Diplômes",
    description:
      "Exécutez la délibération semestrielle ou annuelle, attribuez les rangs et décisions souveraines du jury, puis imprimez les livrets complets de bulletins et diplômes de fin de formation.",
    keyPoints: [
      "Bulletins semestriels bilingues avec sous-totaux par groupes et rangs de classe.",
      "Relevés de notes annuels synthétisant les semestres S1 et S2.",
      "Diplômes de fin de formation au format Paysage ornemental certifié.",
    ],
  },
];

export default function OnboardingWizardModal({ isOpen, onClose }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
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
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl rounded-md bg-white p-md sm:p-lg shadow-2xl border border-outline-variant/30 space-y-md flex flex-col justify-between max-h-[92vh] overflow-hidden"
        >
          {/* En-tête du Guide */}
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-light text-primary flex-shrink-0">
                <Icon name="explore" className="text-[22px]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Guide de Démarrage &amp; Prise en Main CECO</h3>
                <p className="text-xs text-on-surface-variant">Les 5 étapes fondamentales pour piloter votre établissement.</p>
              </div>
            </div>
            <button type="button" onClick={handleCloseModal} className="text-on-surface-variant hover:text-on-surface p-1">
              <Icon name="close" className="text-[20px]" />
            </button>
          </div>

          {/* Stepper horizontal (1 à 5) */}
          <div className="flex items-center justify-between gap-1 p-2 bg-surface rounded-md border border-outline-variant/20 flex-shrink-0">
            {WIZARD_STEPS.map((s, idx) => {
              const isPassed = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isCurrent
                      ? "bg-primary text-white shadow-xs"
                      : isPassed
                      ? "bg-success-light text-success border border-success/20"
                      : "text-on-surface-variant hover:bg-surface-container/60"
                  }`}
                >
                  <Icon name={isPassed ? "check_circle" : s.icon} className="text-[14px]" />
                  <span className="hidden sm:inline">Étape {s.step}</span>
                </button>
              );
            })}
          </div>

          {/* Corps de l'étape active */}
          <div className="space-y-md py-2 overflow-y-auto flex-1 text-xs leading-relaxed">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded bg-primary-light text-primary font-bold uppercase text-[10px] tracking-wider border border-primary/20">
                {currentStep.badge}
              </span>
              <span className="text-on-surface-variant font-mono font-bold">
                {currentStepIndex + 1} / {WIZARD_STEPS.length}
              </span>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Icon name={currentStep.icon} className="text-primary text-[20px]" />
                <span>{currentStep.title}</span>
              </h4>
              <p className="text-on-surface-variant text-xs">{currentStep.description}</p>
            </div>

            {/* Points clés de l'étape */}
            <div className="p-3 bg-surface rounded-md border border-outline-variant/30 space-y-2">
              <span className="font-bold text-on-surface uppercase text-[10px] tracking-wider block">
                Points clés &amp; Bonnes pratiques :
              </span>
              <ul className="space-y-1.5">
                {currentStep.keyPoints.map((kp, kidx) => (
                  <li key={kidx} className="flex items-start gap-2 text-on-surface">
                    <Icon name="check" className="text-success text-[16px] flex-shrink-0 mt-0.5" />
                    <span>{kp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bouton d'accès direct au module concerné */}
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={() => handleGoToModule(currentStep.link)}
                className="px-4 py-2 rounded-md bg-primary-light border border-primary/30 text-primary font-bold text-xs hover:bg-primary hover:text-white transition-all shadow-xs flex items-center gap-1.5"
              >
                <Icon name="launch" className="text-[16px]" />
                <span>{currentStep.buttonLabel}</span>
              </button>
            </div>
          </div>

          {/* Pied de la modale avec navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-outline-variant/20 pt-3 flex-shrink-0 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none text-on-surface-variant">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded accent-primary h-4 w-4"
              />
              <span>Ne plus afficher automatiquement au démarrage</span>
            </label>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={() => setCurrentStepIndex((prev) => prev - 1)}
                  className="px-3.5 py-1.5 rounded-md border border-outline-variant text-on-surface font-semibold hover:bg-surface-container transition-colors"
                >
                  Précédent
                </button>
              )}

              {!isLast ? (
                <button
                  type="button"
                  onClick={() => setCurrentStepIndex((prev) => prev + 1)}
                  className="px-4 py-1.5 rounded-md bg-primary text-white font-bold hover:bg-primary-dark shadow-xs flex items-center gap-1"
                >
                  <span>Suivant</span>
                  <Icon name="chevron_right" className="text-[16px]" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-1.5 rounded-md bg-success text-white font-bold hover:opacity-90 shadow-xs flex items-center gap-1"
                >
                  <Icon name="done_all" className="text-[16px]" />
                  <span>J'ai compris, terminer</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}