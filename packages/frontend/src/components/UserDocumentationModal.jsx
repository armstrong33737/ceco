// packages/frontend/src/components/UserDocumentationModal.jsx
import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../design-system/primitives/Button";
import Input from "../design-system/primitives/Input";
import Badge from "../design-system/primitives/Badge";
import Icon from "./Icon";

const MANUAL_CHAPTERS = [
  {
    id: "chapitre-1",
    number: "01",
    title: "Architecture Réseau & Démarrage",
    icon: "dns",
    summary: "Mode Serveur local, Mode Client réseau LAN, détection automatique et souveraineté.",
    sections: [
      {
        title: "1.1 Mode Serveur vs Mode Client Réseau (Architecture Hybride On-Premise)",
        content:
          "CECO Suite ERP fonctionne selon une architecture réseau hybride ultra-robuste :\n" +
          "• Mode Serveur : Un ordinateur principal au sein de l'établissement héberge la base de données PostgreSQL 17 embarquée, le stockage local scopé et l'API Express sur le port 4000.\n" +
          "• Mode Client Réseau : Les autres postes de travail (Secrétariat, Direction des Études, Salles des profs) se connectent au serveur principal via le réseau local (Wi-Fi ou câble Ethernet).\n" +
          "Aucun serveur Cloud externe n'est requis : l'ensemble de vos données reste à 100% sur le matériel physique de votre établissement.",
      },
      {
        title: "1.2 Découverte Automatique des Serveurs sur le Réseau Local (LAN)",
        content:
          "En Mode Client, au lancement de l'application, CECO effectue un balayage réseau asynchrone sur le sous-réseau local (port 4000/health). Les serveurs actifs sont automatiquement répertoriés. Il suffit de cliquer sur le nom de votre centre pour vous connecter sans aucune configuration technique complexe.",
      },
      {
        title: "1.3 Sécurité, Stockage & Indépendance Internet",
        content:
          "L'application est conçue pour fonctionner à 100% Hors-Ligne (Offline First). Toutes les photographies d'apprenants, les signatures numérisées, les logos et les archives de sauvegardes sont stockés localement dans le répertoire sécurisé userData/storage.",
      },
    ],
  },
  {
    id: "chapitre-2",
    number: "02",
    title: "Sécurité, Rôles RBAC & Licences",
    icon: "security",
    summary: "Comptes utilisateurs, matrice des permissions, clés Ed25519 et sauvegardes .zip.",
    sections: [
      {
        title: "2.1 Contrôle d'Accès Basé sur les Rôles (RBAC Granulaire)",
        content:
          "L'accès aux modules est strictement cloisonné par le système RBAC :\n" +
          "• Admin (Super-Admin) : Accès universel (*) à l'ensemble de l'ERP.\n" +
          "• Rôles d'Usine Protégés (isSystem: true) : Directeur des Études, Secrétaire, Formateur possèdent un socle de permissions garanti par le système. L'administrateur peut leur accorder des privilèges supplémentaires mais ne peut pas supprimer leurs droits vitaux.\n" +
          "• Rôles Personnalisés : Vous pouvez créer des rôles sur-mesure (ex: Surveillant Général, Comptable) et cocher exactement leurs autorisations de consultation, création, modification, suppression, validation ou émission PDF.",
      },
      {
        title: "2.2 Licence Cryptographique Inviolable (Ed25519) & Cycle d'Échéance",
        content:
          "La validité de la licence locale est scellée par une signature asymétrique Ed25519. À l'échéance de la licence :\n" +
          "1. Période de Grâce (7 jours) : L'application continue de fonctionner à 100% sans restriction avec un bandeau d'avertissement orange.\n" +
          "2. Mode Consultation / Lecture Seule : À l'issue des 7 jours de grâce, les modifications et nouvelles saisies sont verrouillées. Toutes les données historiques, la consultation et l'impression des actes restent disponibles à vie sans risque de perte.",
      },
      {
        title: "2.3 Rechargement Hors-Ligne & Mobile Money",
        content:
          "• Activation Hors-Ligne : Transmettez votre Center ID à l'éditeur pour recevoir un certificat de licence signé de 24+ caractères à coller dans le menu Administration > Licence.\n" +
          "• Rechargement Mobile Money : En présence d'une connexion Internet, vous pouvez recharger directement via MTN MoMo ou Orange Money Cameroun.",
      },
    ],
  },
  {
    id: "chapitre-3",
    number: "03",
    title: "Structure Académique & Sessions",
    icon: "account_tree",
    summary: "Cycles ministériels, filières pluriannuelles, cohortes et cycle de vie des sessions.",
    sections: [
      {
        title: "3.1 Cycles (DQP, CQP) & Filières d'Études",
        content:
          "Configurez les cycles de formation reconnus par le MINEFOP (DQP, CQP) et créez vos filières d'études (durée de 1 à 3 ans). Lors de la création d'une filière, le logiciel génère automatiquement les niveaux d'études correspondants (Niveau 1, Niveau 2, Niveau 3).",
      },
      {
        title: "3.2 Promotions & Cohortes d'Entrée",
        content:
          "Une promotion regroupe une cohorte d'apprenants depuis leur entrée initiale en Niveau 1 jusqu'à leur année de diplomation prévue (ex: Promotion 2026-2028).",
      },
      {
        title: "3.3 Machine d'États des Sessions Académiques & Règle des 8 Mois",
        content:
          "Chaque session respecte la nomenclature officielle YYYY-YYYY (ex: 2026-2027) et possède un état strict :\n" +
          "• UPCOMING (Préparatoire) : Session en cours de préparation pour la rentrée prochaine.\n" +
          "• CURRENT (Active) : La session officielle en cours d'exécution dans l'établissement.\n" +
          "• CLOSED (Clôturée) : Session passée archivée et scellée irréversiblement en lecture seule.\n" +
          "Règle de durée : Une session académique valide doit obligatoirement s'étendre sur un minimum de 8 mois (240 jours).",
      },
      {
        title: "3.4 Moteur de Transition Annuelle Automatique",
        content:
          "En fin d'année, l'exécuteur de transition analyse les décisions du jury : les apprenants déclarés ADMIS sont promus au Niveau supérieur dans la nouvelle session, les REDOUBLANTS sont réinscrits au même Niveau, et les LAURÉATS reçoivent le statut DIPLÔMÉ.",
      },
    ],
  },
  {
    id: "chapitre-4",
    number: "04",
    title: "Gestion des Apprenants & Badges",
    icon: "group",
    summary: "Inscriptions, matricules scellés, capture webcam 4:4, import CSV et planches A4.",
    sections: [
      {
        title: "4.1 Matricule Officiel Auto-Généré Scellé",
        content:
          "Lors de chaque inscription, le serveur génère automatiquement un matricule officiel immuable respectant le format national STU{YY}-{XXXX} (ex: STU26-0042). Ce matricule ne peut pas être altéré pour garantir l'intégrité juridique du registre.",
      },
      {
        title: "4.2 Studio Photo & Capture Webcam 4:4 Directe",
        content:
          "Vous pouvez téléverser un fichier image ou activer directement la webcam de l'ordinateur. Le viseur interactif recadre automatiquement la photo au format carré portrait 4:4 haute netteté.",
      },
      {
        title: "4.3 Importation en Masse par Fichier CSV",
        content:
          "Importez des promotions entières d'apprenants à partir d'un fichier CSV (délimiteur point-virgule). Le système valide automatiquement les lignes et auto-génère les matricules manquants tout en produisant un rapport d'anomalies visuel.",
      },
      {
        title: "4.4 Tirage de Planches A4 de Badges Duplex (CR80)",
        content:
          "Depuis le menu Scolarité ou l'en-tête de classe, imprimez en 1 clic une planche A4 contenant jusqu'à 8 cartes d'étudiant recto/verso au format standard CR80 avec repères de coupe d'imprimerie et QR Code de certification.",
      },
    ],
  },
  {
    id: "chapitre-5",
    number: "05",
    title: "Pédagogie & Saisie des Notes",
    icon: "edit_note",
    summary: "Grille matricielle rapide, codes 5 caractères, absences et verrouillage officiel.",
    sections: [
      {
        title: "5.1 Catalogue Universel des Matières (Codes à 5 Caractères)",
        content:
          "Chaque discipline possède un code normalisé unique à 5 caractères majuscules (ex: THM01, INF02) et est rattachée aux catégories d'enseignement de votre établissement (Spécialité, Général, Pratique).",
      },
      {
        title: "5.2 Accès Direct Enseignant & Grille Matricielle Excel-Like",
        content:
          "Les enseignants disposent d'un accès direct à leurs cours via le bouton [Saisir] du tableau de bord. La grille matricielle permet une saisie ultra-rapide au clavier (navigation par flèches directionnelles, Entrée et Tabulation) avec clamping automatique des notes de 0.00 à 20.00.",
      },
      {
        title: "5.3 Qualification des Absences (Bouton ABS)",
        content:
          "Le bouton ABS qualifie les absences aux évaluations :\n" +
          "• Absence Justifiée (Certificat médical) : Non pénalisée dans la moyenne continue.\n" +
          "• Absence Injustifiée : Comptabilisée comme note 0.00 / 20.",
      },
      {
        title: "5.4 Formule de Calcul & Verrouillage de Sécurité",
        content:
          "Par défaut, la note finale est calculée selon la formule : (30% CC1+CC2) + (70% Examen de session normale). Si la note de Rattrapage est supérieure, elle remplace la note d'examen. La direction peut verrouiller officiellement un bordereau pour figer les notes avant les jurys.",
      },
    ],
  },
  {
    id: "chapitre-6",
    number: "06",
    title: "Délibérations du Jury & Jurys",
    icon: "gavel",
    summary: "Arbitrage souverain, calcul des rangs, seuil éliminatoire et délibération globale.",
    sections: [
      {
        title: "6.1 Délibération Semestrielle vs Annuelle (S1 + S2)",
        content:
          "La délibération semestrielle valide les modules du semestre. La délibération annuelle cumule l'intégralité des semestres 1 et 2 pour arrêter la décision définitive : Admis au Niveau supérieur, Redouble ou Diplômé.",
      },
      {
        title: "6.2 Seuil Éliminatoire de Spécialité (< 08.00/20)",
        content:
          "Le moteur détecte automatiquement les notes inférieures à 08.00/20 dans les matières de spécialité (1er Groupe) et alerte le jury sur les cas éliminatoires nécessitant un passage au rattrapage.",
      },
      {
        title: "6.3 Délibération Globale de Tout l'Établissement en 1 Clic",
        content:
          "Un bouton souverain permet de calculer et sceller automatiquement les décisions, moyennes et rangs de toutes les classes de la session active en une seule opération transactionnelle.",
      },
    ],
  },
  {
    id: "chapitre-7",
    number: "07",
    title: "Bulletins, Diplômes & Studio PDF",
    icon: "workspace_premium",
    summary: "Certification QR Code autonome hors-ligne, livrets A4 et diplômes d'État paysage.",
    sections: [
      {
        title: "7.1 Certification par QR Code Autonome Hors-Ligne (Offline)",
        content:
          "Le QR code apposé sur les actes encode un certificat textuel complet lisible par tout smartphone sans connexion Internet (nom, matricule, filière, moyenne, rang, décision, sceau cryptographique).",
      },
      {
        title: "7.2 Bulletin Semestriel Bilingue (A4 Portrait)",
        content:
          "Affiche l'en-tête bilingue FR/EN, la photo, le tableau ventilé par groupes d'enseignement avec sous-totaux, et la double grille récapitulative (profil élève, rang, moyenne classe, max, min, taux de réussite réel et observation graduée).",
      },
      {
        title: "7.3 Diplôme de Fin de Formation Professionnelle (A4 Paysage)",
        content:
          "Parchemin officiel ornemental avec triple filet or/bleu nuit, fleurons d'angle, mentions de l'arrêté ministériel d'agrément, mention obtenue (Passable, Assez Bien, Bien, Très Bien) et signatures officielles.",
      },
      {
        title: "7.4 Studio de Personnalisation des Gabarits en Écran Scindé",
        content:
          "Dans Administration > Studio Gabarits, configurez vos en-têtes bilingues, la couleur primaire, le filigrane translucide (Logo ou Sceau de la République) et visualisez le rendu vectoriel en direct.",
      },
    ],
  },
  {
    id: "chapitre-8",
    number: "08",
    title: "Sauvegardes, Restauration & Audit",
    icon: "archive",
    summary: "Archives hybrides .zip, procédure de restauration et journal d'audit immuable.",
    sections: [
      {
        title: "8.1 Sauvegardes Hybrides (.zip) & Externalisation",
        content:
          "Chaque archive générée rassemble le dump relationnel PostgreSQL complet et l'arborescence des fichiers médias (/storage). Vous pouvez télécharger ces archives pour les externaliser sur clé USB.",
      },
      {
        title: "8.2 Procédure de Restauration Transactionnelle d'Urgence",
        content:
          "En cas d'incident matériel, ré-injectez une archive .zip depuis le menu Sauvegardes. Le système exécute une purge sécurisée (TRUNCATE CASCADE) puis restaure la base et les médias.",
      },
      {
        title: "8.3 Journal d'Audit Système Immuable (AuditLog)",
        content:
          "Toutes les opérations sensibles (déverrouillages de notes, délibérations, clôtures de session, suppressions) sont consignées de manière immuable avec l'horodatage, l'auteur et la charge utile JSON brute.",
      },
    ],
  },
];

export default function UserDocumentationModal({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("chapitre-1");

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "F1") {
        e.preventDefault();
        if (isOpen) onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return MANUAL_CHAPTERS;
    const q = searchQuery.toLowerCase();

    return MANUAL_CHAPTERS.map((ch) => {
      const matchTitle = ch.title.toLowerCase().includes(q) || ch.summary.toLowerCase().includes(q);
      const matchingSections = ch.sections.filter(
        (sec) => sec.title.toLowerCase().includes(q) || sec.content.toLowerCase().includes(q)
      );

      if (matchTitle || matchingSections.length > 0) {
        return {
          ...ch,
          sections: matchingSections.length > 0 ? matchingSections : ch.sections,
        };
      }
      return null;
    }).filter(Boolean);
  }, [searchQuery]);

  useEffect(() => {
    if (filteredChapters.length > 0 && !filteredChapters.some((c) => c.id === selectedChapterId)) {
      setSelectedChapterId(filteredChapters[0].id);
    }
  }, [filteredChapters, selectedChapterId]);

  if (!isOpen || typeof document === "undefined") return null;

  const activeChapter = MANUAL_CHAPTERS.find((c) => c.id === selectedChapterId) || filteredChapters[0] || MANUAL_CHAPTERS[0];

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.1 }}
          className="w-full max-w-5xl rounded bg-surface border border-border shadow-modal h-[92vh] flex flex-col justify-between overflow-hidden dark:bg-surface-dark dark:border-border-dark"
        >
          {/* HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border px-6 py-4 flex-shrink-0 dark:border-border-dark">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[2px] bg-brand-900/10 text-brand-900 dark:bg-brand-500/20 dark:text-brand-500">
                <Icon name="menu_book" className="text-[22px]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-body-md font-semibold text-ink-primary font-sans dark:text-white">
                    Documentation Officielle &amp; Manuel d'Utilisation
                  </h3>
                  <Badge variant="brand">Touche [F1]</Badge>
                </div>
                <p className="text-caption text-ink-muted">Guide opérationnel complet pour l'administration et la pédagogie.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-full sm:w-72">
                <Input
                  placeholder="Rechercher (notes, délibérations, diplômes...)"
                  leftIcon="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink-primary p-1 rounded dark:hover:text-white">
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
          </div>

          {/* CORPS SCINDÉ : SOMMAIRE GAUCHE (4 cols) | CONTENU DROITE (8 cols) */}
          <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
            {/* Sommaire */}
            <div className="md:col-span-4 border-r border-border p-3 space-y-1.5 overflow-y-auto bg-[#F5F7FA] dark:bg-[#07111D] dark:border-border-dark">
              <span className="text-overline text-ink-secondary uppercase tracking-wider font-semibold px-2 block mb-1">
                Sommaire des Chapitres ({filteredChapters.length})
              </span>

              {filteredChapters.map((ch) => {
                const isSelected = ch.id === activeChapter.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChapterId(ch.id)}
                    className={`w-full p-2.5 rounded text-left transition-colors flex items-start gap-2.5 border ${
                      isSelected
                        ? "bg-brand-900 text-white border-brand-900 shadow-xs font-semibold dark:bg-brand-500"
                        : "bg-surface text-ink-primary border-border hover:bg-white dark:bg-surface-dark dark:border-border-dark dark:text-ink-primary-dark"
                    }`}
                  >
                    <span className={`font-mono text-[11px] px-1.5 py-0.2 rounded font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-brand-900/10 text-brand-900 dark:bg-brand-500/20 dark:text-brand-500"
                    }`}>
                      {ch.number}
                    </span>
                    <div className="truncate flex-1">
                      <div className="text-body-sm font-semibold truncate leading-tight">{ch.title}</div>
                      <div className={`text-[11px] truncate mt-0.5 ${isSelected ? "text-white/80" : "text-ink-muted"}`}>
                        {ch.summary}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Contenu Détaillé */}
            <div className="md:col-span-8 p-6 space-y-4 overflow-y-auto text-body-sm leading-relaxed">
              <div className="border-b border-border pb-3 flex items-center gap-3 dark:border-border-dark">
                <span className="w-8 h-8 rounded-[2px] bg-brand-900 text-white font-heading font-bold flex items-center justify-center dark:bg-brand-500">
                  {activeChapter.number}
                </span>
                <div>
                  <h4 className="text-body-md font-heading font-semibold text-ink-primary dark:text-white">{activeChapter.title}</h4>
                  <p className="text-caption text-ink-muted">{activeChapter.summary}</p>
                </div>
              </div>

              <div className="space-y-3">
                {activeChapter.sections.map((sec, sidx) => (
                  <div key={sidx} className="p-4 rounded bg-surface border border-border space-y-1.5 dark:bg-surface-dark dark:border-border-dark">
                    <h5 className="font-semibold text-body-sm text-brand-900 flex items-center gap-1.5 dark:text-brand-500">
                      <Icon name="bookmark" className="text-[16px]" />
                      <span>{sec.title}</span>
                    </h5>
                    <p className="text-ink-secondary leading-relaxed whitespace-pre-line dark:text-ink-secondary-dark">{sec.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="border-t border-border bg-[#FAFBFD] px-6 py-3 flex items-center justify-between text-caption text-ink-muted flex-shrink-0 dark:border-border-dark dark:bg-[#07111D]/40">
            <span className="font-mono">CECO Suite ERP • Manuel de Référence Officiel</span>
            <Button variant="primary" size="sm" onClick={onClose}>
              Fermer la Documentation
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}