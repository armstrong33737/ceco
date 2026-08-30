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
    title: "Architecture Réseau & Premier Démarrage",
    icon: "dns",
    summary: "Fonctionnement du mode Serveur, du mode Client réseau et détection automatique LAN.",
    sections: [
      {
        title: "1.1 Mode Serveur vs Mode Client",
        content:
          "CECO fonctionne selon une architecture hybride On-Premise : un ordinateur principal héberge la base PostgreSQL 17 embarquée et l'API locale (Mode Serveur), tandis que les autres ordinateurs de l'établissement s'y connectent via le réseau local Wi-Fi ou câble Ethernet (Mode Client).",
      },
      {
        title: "1.2 Découverte automatique des serveurs sur le réseau (LAN)",
        content:
          "En Mode Client, l'application effectue un balayage automatique du sous-réseau local sur le port 4000 (/health) pour détecter instantanément l'adresse IP de la machine serveur sans nécessiter de configuration manuelle complexe.",
      },
      {
        title: "1.3 Sécurité et souveraineté des données",
        content:
          "Toutes les données sont stockées localement sur la machine serveur dans les dossiers sécurisés pgdata et storage. Aucune dépendance Internet n'est requise pour le fonctionnement quotidien.",
      },
    ],
  },
  {
    id: "chapitre-2",
    number: "02",
    title: "Administration, Sécurité RBAC & Licences",
    icon: "security",
    summary: "Comptes utilisateurs, matrice des permissions, clés Ed25519 et sauvegardes .zip.",
    sections: [
      {
        title: "2.1 Contrôle d'accès basé sur les rôles (RBAC)",
        content:
          "Le profil Administrateur détient les droits universels (*). Vous pouvez créer des profils personnalisés (Directeur des Études, Secrétaire, Formateur) et configurer finement les autorisations de lecture, création, modification, suppression et validation par module.",
      },
      {
        title: "2.2 Système de Licence Cryptographique Inviolable (Ed25519)",
        content:
          "La validité de la licence locale est scellée par une signature asymétrique Ed25519. À l'échéance, une période de grâce de 7 jours est accordée avant le passage en mode Consultation / Lecture seule (zéro arrêt brutal des opérations en cours).",
      },
      {
        title: "2.3 Sauvegardes Hybrides (.zip) et Restauration",
        content:
          "Chaque archive générée rassemble le dump relationnel PostgreSQL complet et les pièces jointes (photos, logos, documents). Vous pouvez exporter les sauvegardes sur clé USB et les réinjecter en 1 clic.",
      },
    ],
  },
  {
    id: "chapitre-3",
    number: "03",
    title: "Structure Académique & Formations",
    icon: "account_tree",
    summary: "Cycles ministériels, filières pluriannuelles, cohortes et cycle de vie des sessions.",
    sections: [
      {
        title: "3.1 Cycles (DQP, CQP) et Filières d'Études",
        content:
          "Définissez vos cycles de formation et créez vos filières (durée de 1 à 3 ans). Le logiciel génère automatiquement les niveaux correspondants (Niveau 1, Niveau 2, Niveau 3).",
      },
      {
        title: "3.2 Promotions & Cohortes d'Entrée",
        content:
          "Une promotion regroupe une cohorte d'apprenants depuis leur inscription initiale en Niveau 1 jusqu'à l'année de diplomation finale prévue.",
      },
      {
        title: "3.3 Cycle de Vie des Sessions Académiques (Machine d'États)",
        content:
          "Une session respecte le format standard YYYY-YYYY (durée minimale de 8 mois). Une session peut être Préparatoire (UPCOMING), Active (CURRENT) ou Clôturée (CLOSED). Une session clôturée devient définitivement scellée et immuable en lecture seule.",
      },
      {
        title: "3.4 Moteur de Transition Annuelle",
        content:
          "En fin d'année, la transition automatique promeut les apprenants admis au niveau supérieur dans la nouvelle session et archive la session sortante.",
      },
    ],
  },
  {
    id: "chapitre-4",
    number: "04",
    title: "Gestion des Apprenants & Badges ID",
    icon: "group",
    summary: "Inscriptions, matricules scellés, capture webcam 4:4, import CSV et cartes d'étudiant.",
    sections: [
      {
        title: "4.1 Matricule Officiel Auto-Généré",
        content:
          "Chaque apprenant reçoit un matricule officiel immuable respectant la nomenclature nationale STU{YY}-{XXXX} (ex: STU26-0042) garantissant l'unicité stricte au sein de l'établissement.",
      },
      {
        title: "4.2 Prise de Photo en Direct par Webcam",
        content:
          "Lors de l'inscription, vous pouvez téléverser un fichier image ou activer directement la webcam pour capturer la photo d'identité au format carré 4:4 centré.",
      },
      {
        title: "4.3 Planche de Badges Duplex Découpable (Format A4)",
        content:
          "Générez et imprimez en 1 clic la planche A4 contenant jusqu'à 8 cartes d'étudiants recto/verso au format standard CR80 avec repères de découpe d'imprimerie et QR Code de certification.",
      },
    ],
  },
  {
    id: "chapitre-5",
    number: "05",
    title: "Gestion Pédagogique & Saisie des Notes",
    icon: "edit_note",
    summary: "Grille matricielle rapide type tableur, qualifications des absences et verrouillage.",
    sections: [
      {
        title: "5.1 Catalogue des Matières (Codes 5 Caractères)",
        content:
          "Chaque discipline dispose d'un code normalisé à 5 caractères (ex: THM01, INF02) et est rattachée aux groupes d'enseignement définis par votre établissement (Spécialité, Général, Pratique).",
      },
      {
        title: "5.2 Grille de Saisie Matricielle Rapide (Excel-Like)",
        content:
          "Saisissez les notes de CC1, CC2, Examen Final et Rattrapage avec navigation fluide au clavier (flèches directionnelles, Entrée). Le calcul des moyennes de contrôle continu et des moyennes finales est instantané.",
      },
      {
        title: "5.3 Absences Justifiées vs Injustifiées",
        content:
          "Un bouton ABS dédié permet de qualifier les absences : une absence justifiée (certificat médical) n'est pas pénalisée, tandis qu'une absence injustifiée est comptabilisée comme 0.00/20.",
      },
    ],
  },
  {
    id: "chapitre-6",
    number: "06",
    title: "Délibérations du Jury & Décisions",
    icon: "gavel",
    summary: "Souveraineté du jury, calcul des rangs, gestion des éliminatoires et agrégation S1+S2.",
    sections: [
      {
        title: "6.1 Délibération Semestrielle vs Annuelle",
        content:
          "La délibération semestrielle valide le semestre en cours. La délibération annuelle cumule les semestres 1 et 2 pour arrêter la décision définitive : Admis au niveau supérieur, Redouble ou Diplômé.",
      },
      {
        title: "6.2 Seuil Éliminatoire Spécialité (<08.00/20)",
        content:
          "Le moteur détecte automatiquement les notes inférieures à 08.00/20 dans les matières de spécialité (1er Groupe) et alerte le jury sur les cas éliminatoires.",
      },
      {
        title: "6.3 Délibération Globale de Tout l'Établissement",
        content:
          "Un bouton souverain permet de calculer et sceller automatiquement les décisions et rangs de toutes les classes de la session active en une seule opération.",
      },
    ],
  },
  {
    id: "chapitre-7",
    number: "07",
    title: "Bulletins, Relevés & Diplômes d'État (V4)",
    icon: "workspace_premium",
    summary: "Certification par QR Code autonome hors-ligne, livrets de classe et diplômes paysage.",
    sections: [
      {
        title: "7.1 Certification par QR Code Autonome (Offline)",
        content:
          "Le QR code apposé sur les documents externes encode directement un certificat textuel complet lisible par tout smartphone sans connexion Internet (nom, matricule, filière, moyenne, rang, décision, sceau cryptographique).",
      },
      {
        title: "7.2 Bulletin Semestriel Bilingue (A4 Portrait)",
        content:
          "Affiche l'en-tête bilingue FR/EN, la photo, le tableau ventilé par groupes d'enseignement avec sous-totaux, et la double grille récapitulative (profil élève, rang, moyenne classe, max et min).",
      },
      {
        title: "7.3 Diplôme de Fin de Formation (A4 Paysage Ornemental)",
        content:
          "Document officiel ornemental avec double bordure classique, mentions légales de l'arrêté ministériel, mention obtenue (Passable, Assez Bien, Bien, Très Bien) et signatures officielles.",
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
                    <p className="text-ink-secondary leading-relaxed dark:text-ink-secondary-dark">{sec.content}</p>
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