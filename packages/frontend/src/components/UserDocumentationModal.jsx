// packages/frontend/src/components/UserDocumentationModal.jsx
import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
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
          "CECO fonctionne selon une architecture hybride On-Premise : un ordinateur principal héberge la base PostgreSQL embarquée et l'API locale (Mode Serveur), tandis que les autres ordinateurs de l'établissement s'y connectent via le réseau local Wi-Fi ou câble Ethernet (Mode Client).",
      },
      {
        title: "1.2 Découverte automatique des serveurs sur le réseau (LAN)",
        content:
          "En Mode Client, l'application effectue un balayage automatique du sous-réseau local sur le port 4000 (/health) pour détecter instantanément l'adresse IP de la machine serveur sans nécessiter de configuration manuelle complexe.",
      },
      {
        title: "1.3 Sécurité et sauvegarde des données",
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
    summary: "Gestion des comptes utilisateurs, matrice des permissions, clés Ed25519 et sauvegardes.",
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
        title: "2.3 Activation Hors-Ligne & Rechargement Mobile Money",
        content:
          "Pour recharger sans Internet : transmettez votre Center ID à l'éditeur pour recevoir une clé signée de 24 caractères à coller dans l'application. En ligne : utilisez le module Mobile Money direct (MTN MoMo / Orange Money).",
      },
      {
        title: "2.4 Sauvegardes Hybrides (.zip) et Restauration",
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
    summary: "Inscriptions, matricules scellés, capture photo webcam, import CSV et cartes d'étudiant.",
    sections: [
      {
        title: "4.1 Matricule Officiel Auto-Généré",
        content:
          "Chaque apprenant reçoit un matricule officiel immuable respectant la nomenclature nationale STU{YY}-{XXXX} (ex: STU26-0042) garantissant l'unicité stricte au sein de l'établissement.",
      },
      {
        title: "4.2 Prise de Photo en Direct par Webcam",
        content:
          "Lors de l'inscription, vous pouvez téléverser un fichier image ou activer directement la webcam de l'ordinateur pour capturer la photo d'identité au format portrait 3:4 centré.",
      },
      {
        title: "4.3 Importation en Masse par CSV",
        content:
          "Importez des promotions entières à partir d'un fichier Excel exporté en CSV. Le système valide automatiquement les lignes et auto-génère les matricules manquants.",
      },
      {
        title: "4.4 Planche de Badges Duplex Découpable (Format A4)",
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
    summary: "Cursus filières, formateurs, bordereaux de saisie matricielle et politiques de pondération.",
    sections: [
      {
        title: "5.1 Catalogue Universel des Matières (Codes à 5 Caractères)",
        content:
          "Chaque discipline dispose d'un code normalisé à 5 caractères (ex: THM01, INF02) et est rattachée aux groupes d'enseignement définis par votre établissement (Spécialité, Général, Pratique).",
      },
      {
        title: "5.2 Annuaire des Formateurs & Compte Accès 1 Clic",
        content:
          "Générez instantanément des comptes utilisateurs pour vos formateurs afin qu'ils puissent saisir leurs notes depuis leur propre ordinateur ou smartphone sur le réseau local.",
      },
      {
        title: "5.3 Grille de Saisie Matricielle Rapide (Excel-Like)",
        content:
          "Saisissez les notes de CC1, CC2, Examen Final et Rattrapage avec navigation fluide au clavier (flèches directionnelles, Entrée). Le calcul des moyennes de contrôle continu et des moyennes finales est instantané.",
      },
      {
        title: "5.4 Gestion des Absences Justifiées vs Injustifiées",
        content:
          "Un bouton ABS dédié permet de qualifier les absences : une absence justifiée (certificat médical) n'est pas pénalisée, tandis qu'une absence injustifiée est comptabilisée comme 0.00/20.",
      },
      {
        title: "5.5 Verrouillage Officiel & Déverrouillage d'Urgence",
        content:
          "La direction peut verrouiller un bordereau pour figer les notes avant délibération. Tout déverrouillage exceptionnel est tracé de manière indélébile dans le Journal d'Audit.",
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
        title: "6.2 Application des Règles & Alertes Éliminatoires",
        content:
          "Le moteur détecte automatiquement les notes inférieures à 08.00/20 dans les matières de spécialité (1er Groupe) et alerte le jury sur les cas éliminatoires.",
      },
      {
        title: "6.3 Délibération Globale de Tout l'Établissement en 1 Clic",
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
    summary: "Certification QR Code autonome hors-ligne, livrets de classe et diplômes paysage.",
    sections: [
      {
        title: "7.1 Certification par QR Code Autonome (Offline)",
        content:
          "Le QR code apposé sur les documents externes encode directement un certificat textuel complet lisible par tout smartphone sans connexion Internet (nom, matricule, filière, moyenne, rang, décision, sceau cryptographique).",
      },
      {
        title: "7.2 Bulletin Semestriel Bilingue (A4 Portrait)",
        content:
          "Affiche l'en-tête bilingue FR/EN, la photo, le tableau ventilé par groupes d'enseignement avec sous-totaux, et le profil complet de la classe (moyenne élève, rang, moyenne classe, max et min).",
      },
      {
        title: "7.3 Relevé de Notes Annuel (Academic Transcript)",
        content:
          "Synthétise l'ensemble du cursus annuel de l'apprenant en agrégeant les résultats des semestres 1 et 2 avec la mention de la décision souveraine du jury.",
      },
      {
        title: "7.4 Diplôme de Fin de Formation (A4 Paysage Ornemental)",
        content:
          "Document officiel ornemental avec double bordure classique, mentions légales complètes de l'arrêté d'agrément ministériel, mention obtenue (Passable, Assez Bien, Bien, Très Bien) et signatures officielles.",
      },
      {
        title: "7.5 Impression des Livrets de Classe en 1 Clic",
        content:
          "Depuis le menu Pédagogie > Bulletins & Diplômes, imprimez d'un seul clic l'ensemble des bulletins ou diplômes de toute une classe compilés dans un unique fichier PDF prêt pour le tirage.",
      },
    ],
  },
];

export default function UserDocumentationModal({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("chapitre-1");

  // Écouteur global pour la touche F1
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

  // Filtrage plein texte par mots-clés
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
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 px-4 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-5xl rounded-md bg-white p-md sm:p-lg shadow-2xl border border-outline-variant/30 space-y-md flex flex-col justify-between h-[92vh] overflow-hidden"
        >
          {/* En-tête avec Recherche et Raccourci F1 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-outline-variant/20 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-light text-primary flex-shrink-0">
                <Icon name="menu_book" className="text-[24px]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-on-surface">Manuel d'Utilisation &amp; Documentation CECO</h3>
                  <span className="px-2 py-0.5 rounded bg-surface border border-outline-variant/40 font-mono text-[10px] font-bold text-primary">
                    Touche [F1]
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">Guide opérationnel complet pour l'administration et la pédagogie.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Moteur de recherche plein texte */}
              <div className="relative w-full sm:w-72">
                <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/60" />
                <input
                  type="text"
                  placeholder="Rechercher par mot-clé (notes, diplômes...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 rounded-md bg-surface pl-8 pr-7 text-xs text-on-surface outline-none border border-outline-variant/40 focus:border-primary"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface">
                    <Icon name="close" className="text-[14px]" />
                  </button>
                )}
              </div>

              <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1">
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
          </div>

          {/* Corps : Navigation Chapitres (Gauche) + Contenu Détaillé (Droite) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-md flex-1 overflow-hidden">
            {/* Sommaire des chapitres */}
            <div className="md:col-span-4 border-r border-outline-variant/20 pr-2 space-y-1 overflow-y-auto max-h-full">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block px-2 pb-1">
                Sommaire des Chapitres ({filteredChapters.length})
              </span>

              {filteredChapters.length === 0 ? (
                <p className="text-xs text-on-surface-variant p-3 italic">Aucun chapitre ne correspond à votre recherche.</p>
              ) : (
                filteredChapters.map((ch) => {
                  const isSelected = ch.id === activeChapter.id;

                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChapterId(ch.id)}
                      className={`w-full p-2.5 rounded-md text-left text-xs transition-all flex items-start gap-2.5 border ${
                        isSelected
                          ? "bg-primary text-white border-primary shadow-xs font-bold"
                          : "bg-surface text-on-surface border-outline-variant/20 hover:bg-surface-container/60"
                      }`}
                    >
                      <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded font-bold ${
                        isSelected ? "bg-white/20 text-white" : "bg-primary-light text-primary"
                      }`}>
                        {ch.number}
                      </span>
                      <div className="truncate flex-1">
                        <div className="truncate font-semibold">{ch.title}</div>
                        <div className={`text-[10px] truncate ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                          {ch.summary}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Contenu Détaillé du Chapitre Actif */}
            <div className="md:col-span-8 pl-1 space-y-md overflow-y-auto max-h-full pr-2 text-xs leading-relaxed">
              <div className="border-b border-outline-variant/20 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-primary-light text-primary font-bold flex items-center justify-center font-mono">
                    {activeChapter.number}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-on-surface">{activeChapter.title}</h4>
                    <p className="text-[11px] text-on-surface-variant">{activeChapter.summary}</p>
                  </div>
                </div>
              </div>

              {/* Sections du chapitre */}
              <div className="space-y-3">
                {activeChapter.sections.map((sec, sidx) => (
                  <div key={sidx} className="p-3 bg-surface rounded-md border border-outline-variant/30 space-y-1.5">
                    <h5 className="font-bold text-xs text-primary flex items-center gap-1.5">
                      <Icon name="bookmark" className="text-[14px]" />
                      <span>{sec.title}</span>
                    </h5>
                    <p className="text-on-surface text-xs leading-relaxed whitespace-pre-line">
                      {sec.content}
                    </p>
                  </div>
                ))}
              </div>

              {/* Encadré d'aide contextuelle */}
              <div className="p-3 bg-primary-light/40 border border-primary/20 rounded-md text-xs text-on-surface space-y-1">
                <strong className="text-primary flex items-center gap-1">
                  <Icon name="help_outline" className="text-[16px]" />
                  <span>Besoin d'une assistance personnalisée ?</span>
                </strong>
                <p className="text-[11px] text-on-surface-variant">
                  Pour toute question technique relative aux délibérations, au déploiement en réseau local ou aux licences : contactez le support à <strong>armstrongngaleu3@gmail.com</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Pied de visionneuse */}
          <div className="flex items-center justify-between border-t border-outline-variant/20 pt-3 flex-shrink-0 text-xs text-on-surface-variant">
            <span className="font-mono text-[11px]">CECO Suite ERP • Manuel de Référence Officiel</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-md bg-primary text-white font-bold hover:bg-primary-dark shadow-xs"
            >
              Fermer la documentation
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}