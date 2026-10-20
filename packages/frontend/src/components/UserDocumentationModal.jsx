// packages/frontend/src/components/UserDocumentationModal.jsx
import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Button from "../design-system/primitives/Button";
import Input from "../design-system/primitives/Input";
import Badge from "../design-system/primitives/Badge";
import Icon from "./Icon";

const DOCUMENTATION_CHAPTERS = [
  {
    id: "chapitre-01",
    number: "01",
    title: "Architecture, Installation & Démarrage Réseau",
    icon: "dns",
    badge: "Infrastructure",
    link: "/administration/apropos",
    linkText: "Voir Fiche Technique",
    summary: "Mode Serveur On-Premise, Postes Clients LAN, PostgreSQL 17 embarqué et démarrage atomique.",
    sections: [
      {
        title: "1.1 Architecture Hybride On-Premise & Souveraineté Locale",
        content: [
          "CECO Suite ERP fonctionne selon une architecture 100% autonome hors-ligne (Offline-First). Aucune connexion Internet n'est requise pour le fonctionnement quotidien du centre.",
          "• Mode Serveur Principal : L'ordinateur central de l'établissement héberge le moteur PostgreSQL 17 embarqué (port isolé TCP 5433), le système de fichiers physiques sécurisé (/userData/storage) et l'API Express sur le port 4000.",
          "• Mode Client Réseau (LAN) : Les autres ordinateurs de l'établissement (Secrétariat, Direction des Études, Salle des Formateurs) se connectent directement au serveur via le réseau local (Wi-Fi ou câble Ethernet RJ45).",
        ],
        callout: {
          type: "info",
          title: "Recommandation d'Ingénierie Réseau",
          text: "Attribuez une adresse IP fixe (statique) à l'ordinateur serveur sur le routeur de votre établissement (ex: 192.168.1.50). Cela évite d'avoir à resélectionner le serveur sur les postes clients en cas de redémarrage de la box Wi-Fi.",
        },
      },
      {
        title: "1.2 Découverte Automatique des Postes Clients",
        content: [
          "Lorsqu'un poste secondaire est démarré en Mode Client, l'application exécute un balayage réseau automatique sur le sous-réseau local (port 4000 /health).",
          "Dès que le serveur est détecté, son adresse apparaît dans la liste : il suffit de cliquer sur « Choisir » pour ouvrir immédiatement votre session de travail.",
          "En cas d'isolation du réseau ou de pare-feu strict, vous pouvez renseigner manuellement l'adresse IP et le port du serveur dans le champ dédié (ex: 192.168.1.50:4000).",
        ],
      },
      {
        title: "1.3 Protocole de Démarrage Atomique « Tout ou Rien »",
        content: [
          "Pour prévenir toute corruption ou conflit de port, le gestionnaire de services ServiceManager applique une séquence stricte au démarrage :",
          "1. Vérification de la disponibilité du port 5433 et démarrage de PostgreSQL embarqué.",
          "2. Application automatique des migrations Prisma commitées (prisma migrate deploy).",
          "3. Vérification de l'idempotence du seed d'installation (centre, rôles d'usine, admin).",
          "4. Lancement de l'API Express sur le port 4000 et attente de la réponse 200 OK sur /health.",
          "Si une seule de ces étapes échoue, le système déclenche un arrêt d'urgence intégral de tous les sous-processus pour ne laisser aucune instance fantôme en mémoire.",
        ],
        callout: {
          type: "warning",
          title: "Dépannage Incident de Port Déjà Occupé",
          text: "Si un message indique que le port 5433 ou 4000 est occupé, fermez l'application dans la zone de notification (systray), puis relancez-la. Le gestionnaire atomique nettoiera automatiquement l'environnement.",
        },
      },
    ],
  },
  {
    id: "chapitre-02",
    number: "02",
    title: "Configuration Initiale & Identité Légale du Centre",
    icon: "storefront",
    badge: "Administration",
    link: "/administration/centre",
    linkText: "Ouvrir Configuration Centre",
    summary: "Dénomination légale, Arrêté MINEFOP, signatures de direction et patron du matricule.",
    sections: [
      {
        title: "2.1 Dénomination, Agrément Ministériel & Localisation",
        content: [
          "Accédez au menu Administration > Configuration de l'Établissement pour consigner l'identité juridique de votre structure :",
          "• Dénomination Officielle : Le nom exact déclaré au MINEFOP (ex: CEFOPIA).",
          "• Arrêté d'Agrément MINEFOP : Le numéro d'autorisation d'ouverture ou d'agrément ministériel (ex: N° 0042/MINEFOP/SG/DFOP). Cette mention est obligatoire et figure sur toutes les cartes, attestations et diplômes.",
          "• Ville & Contacts : Ville de délivrance des actes (ex: Bafoussam), téléphones officiels, boîte postale et adresse physique.",
        ],
        callout: {
          type: "rule",
          title: "Conformité Réglementaire MINEFOP",
          text: "L'intitulé de l'arrêté ministériel doit être rigoureusement exact. En cas de contrôle de l'Inspection Régionale, toute divergence entre l'acte papier délivré et l'arrêté officiel engage la responsabilité du chef d'établissement.",
        },
      },
      {
        title: "2.2 Direction de l'Établissement & Signatures Numérisées",
        content: [
          "• Signataire Légal : Renseignez le Nom, Prénom et Titre du Chef de Centre (ex: Le Directeur Général). Ces informations alimentent automatiquement la formule d'attestation « Je soussigné, Monsieur... » sur les certificats officiels.",
          "• Visas & Signatures : Numérisez les signatures officielles sur fond transparent (.png haute résolution, 3 Mo max) pour chaque fonction : Directeur Général, Promoteur / Fondateur, Directeur des Études.",
          "Une fois téléversée, la signature est scellée localement et apposée automatiquement au bas des bulletins, relevés et diplômes.",
        ],
      },
      {
        title: "2.3 Logo de l'Établissement & Sceau de la République",
        content: [
          "• Logo du Centre : Téléversez votre blason officiel. Il est automatiquement redimensionné et appliqué en en-tête ainsi qu'en filigrane translucide au centre des actes.",
          "• Sceau de la République : CECO intègre nativement le Sceau officiel de la République du Cameroun. Vous pouvez choisir dans le Studio d'afficher le logo seul, le sceau seul, ou les deux armoiries côte à côte.",
        ],
        callout: {
          type: "tip",
          title: "Règle de Filigrane Épuré",
          text: "Conformément aux normes graphiques du progiciel, le filigrane d'arrière-plan sur les procès-verbaux et relevés internes utilise exclusivement le logo du centre, évitant toute surcharge visuelle sur les grilles de notes.",
        },
      },
      {
        title: "2.4 Patron Paramétrable du Matricule Apprenant",
        content: [
          "Le logiciel génère automatiquement des matricules uniques conformes au modèle défini dans vos paramètres.",
          "Variables disponibles :",
          "• {CTR} : Sigle du centre (ex: CEFOPIA)",
          "• {FIL} : Code abrégé de la filière (ex: GP pour Graphisme de Production)",
          "• {CYCLE} : Code ministériel du cycle (ex: DQP, CQP)",
          "• {YY} : Millésime sur 2 chiffres (ex: 26 pour 2026)",
          "• {YYYY} : Année complète (ex: 2026)",
          "• {NUM4} / {NUM5} : Séquence numérique auto-incrémentée (ex: 0001 ou 00001)",
          "Exemple standard : {CTR}-{FIL}{YY}-{NUM4} produira CEFOPIA-GP26-0001. Le moteur intègre une vérification transactionnelle garantissant l'absence totale de doublon.",
        ],
      },
    ],
  },
  {
    id: "chapitre-03",
    number: "03",
    title: "Structure Académique, Filières & Cycle de Vie des Sessions",
    icon: "account_tree",
    badge: "Structure",
    link: "/academie/filieres",
    linkText: "Gérer l'Offre Académique",
    summary: "Cycles DQP/CQP, filières pluriannuelles, gestion des salles et machine d'états des sessions.",
    sections: [
      {
        title: "3.1 Cycles Ministériels & Filières de Formation",
        content: [
          "• Cycles : Enregistrez vos types de programmes habilités par la tutelle (DQP : Diplôme de Qualification Professionnelle, CQP : Certificat de Qualification Professionnelle, etc.).",
          "• Filières : Créez vos spécialités d'apprentissage en spécifiant leur durée officielle (1 an, 2 ans ou 3 ans).",
          "• Niveaux Automatiques : Dès qu'une filière de durée N est créée, le système génère immédiatement les Niveaux correspondants (Niveau 1, Niveau 2, Niveau 3) sans manipulation manuelle supplémentaire.",
        ],
      },
      {
        title: "3.2 Salles & Espaces de Formation",
        content: [
          "Déclarez vos salles de cours théoriques, ateliers pratiques et laboratoires informatiques en indiquant leur capacité maximale de places assises.",
          "Une classe peut être assignée à une salle fixe ou laissée sans salle assignée (salle volante / alternance d'ateliers) sans bloquer la gestion pédagogique.",
          "Le tableau de bord calcule en temps réel le taux d'occupation physique des espaces du centre.",
        ],
      },
      {
        title: "3.3 Cycle de Vie des Sessions Académiques & Règle des 8 Mois",
        content: [
          "Chaque session académique est identifiée sous la nomenclature obligatoire YYYY-YYYY (ex: 2026-2027) et obéit à une machine d'états stricte :",
          "• UPCOMING (Préparatoire) : Année scolaire en cours de préparation pour la rentrée suivante. Vous pouvez y pré-créer les classes et inscrire les nouveaux apprenants.",
          "• CURRENT (Active) : La session officielle en cours au sein de l'établissement. Une seule session peut être active simultanément par centre.",
          "• CLOSED (Clôturée / Scellée) : Année passée archivée irréversiblement. Toutes ses classes, notes, délibérations et inscriptions sont figées en lecture seule.",
        ],
        callout: {
          type: "rule",
          title: "Durée Minimale Légale d'une Année Académique (MINEFOP)",
          text: "Pour être acceptée par le système, une session académique doit obligatoirement s'étendre sur un minimum de 8 mois (240 jours) et un maximum de 14 mois. Toute saisie en deçà de 240 jours est rejetée pour garantir la validité des heures de formation certifiées.",
        },
      },
      {
        title: "3.4 Promotions (Cohortes d'Entrée)",
        content: [
          "Une promotion regroupe longitudinalement une cohorte d'apprenants depuis leur rentrée initiale en Niveau 1 jusqu'à leur année prévisionnelle de diplomation de fin de cursus (ex: Promotion 2026-2028).",
          "Les promotions permettent de suivre les statistiques de rétention et d'assurer la traçabilité des étudiants tout au long de leur scolarité pluriannuelle.",
        ],
      },
    ],
  },
  {
    id: "chapitre-04",
    number: "04",
    title: "Scolarité, Inscriptions & Dossiers Apprenants",
    icon: "group",
    badge: "Scolarité",
    link: "/apprenants",
    linkText: "Ouvrir Registre Apprenants",
    summary: "Inscriptions individuelles, capture photo webcam 4:4, imports CSV et badges CR80.",
    sections: [
      {
        title: "4.1 Inscription Individuelle d'un Apprenant",
        content: [
          "Depuis le registre des apprenants, cliquez sur « Nouvel Apprenant » et complétez les 4 volets du dossier :",
          "1. Photographie officielle : téléversement direct ou capture webcam en direct.",
          "2. État civil complet : Nom, Prénom, Genre (M/F), Date et Lieu de naissance, Téléphone personnel.",
          "3. Urgence & Scolarité : Nom du parent/tuteur légal, téléphone d'urgence et diplôme d'entrée présenté (CEP, BEPC, BAC...).",
          "4. Affectation Pédagogique : Sélection de la session académique active et de la classe d'accueil.",
          "Dès l'enregistrement, le matricule officiel est généré, scellé en base et la fiche individuelle d'inscription est disponible.",
        ],
      },
      {
        title: "4.2 Studio Photo Intégré & Viseur Webcam Carré 4:4",
        content: [
          "Pour garantir une présentation impeccable sur les badges CR80 et les bulletins sans déformation :",
          "• Cliquez sur « Webcam » : autorisez la caméra de votre ordinateur.",
          "• Le viseur interactif recadre automatiquement le visage au format carré portrait 4:4 haute définition.",
          "• Cliquez sur « Capturer la Photo » : l'image est optimisée et enregistrée localement dans le stockage sécurisé du centre.",
        ],
      },
      {
        title: "4.3 Importation Massive par Fichier CSV",
        content: [
          "Pour importer rapidement des promotions entières lors de la rentrée scolaire :",
          "1. Ouvrez le module « Import CSV » et sélectionnez la session active et la classe cible.",
          "2. Préparez votre fichier tableur avec l'ordre strict des colonnes suivantes :",
          "Matricule;Nom;Prenom;Genre;DateNaissance;LieuNaissance;Telephone;Tuteur;TelUrgence;DiplomeEntree",
          "3. Si la colonne Matricule est laissée vide, CECO génère automatiquement les matricules officiels séquentiels sans interruption.",
          "4. À la fin du traitement, un rapport complet affiche le nombre de dossiers créés et la liste détaillée des éventuelles anomalies (lignes incomplètes ou doublons).",
        ],
        callout: {
          type: "tip",
          title: "Modèle de Ligne CSV Valide",
          text: ";NGALEU;Armstrong;M;2004-11-12;Bafoussam;670000111;NGALEU Pierre;699000222;BEPC",
        },
      },
      {
        title: "4.4 Tiroir d'Inspection (LearnerDrawer) & Tirage de Badges",
        content: [
          "Cliquez sur n'importe quel apprenant dans le tableau pour ouvrir son dossier latéral complet :",
          "• Visualisez sa photo, ses coordonnées d'urgence et l'historique complet de ses inscriptions annuelles.",
          "• Émettez en un clic : sa Carte d'Étudiant CR80, son Certificat de Scolarité officiel ou sa Fiche d'Inscription.",
          "• Cliquez sur « Planches A4 » dans le bandeau supérieur pour imprimer d'un coup toute la classe en planches de 8 badges duplex avec repères de coupe d'imprimerie.",
        ],
      },
      {
        title: "4.5 Archivage & Restauration de Dossier",
        content: [
          "En cas d'abandon ou de départ d'un élève, cliquez sur l'icône de suppression : le dossier est archivé (soft-delete) pour préserver l'intégrité des notes passées et procès-verbaux.",
          "L'onglet « Archives historiques » permet de consulter l'ensemble des anciens dossiers et de réintégrer à tout moment un apprenant dans le registre actif d'un simple clic sur « Restaurer ».",
        ],
      },
    ],
  },
  {
    id: "chapitre-05",
    number: "05",
    title: "Organisation Pédagogique, Cursus & Corps Professoral",
    icon: "menu_book",
    badge: "Pédagogie",
    link: "/pedagogie/maquettes",
    linkText: "Configurer les Maquettes",
    summary: "Codes matières à 5 caractères, groupes éliminatoires, cursus de filière et comptes formateurs.",
    sections: [
      {
        title: "5.1 Référentiel Universel des Matières (Codes à 5 Caractères)",
        content: [
          "Toutes les disciplines enseignées sont centralisées dans le catalogue des matières.",
          "Chaque matière possède un intitulé complet et un code normalisé à exactement 5 caractères majuscules (ex: THM01 pour Thermodynamique 1, INF02 pour Informatique 2, GRA01 pour Infographie 1).",
          "Ce code court est utilisé dans les bordereaux compacts et procès-verbaux pour maximiser la lisibilité des grilles de notes.",
        ],
      },
      {
        title: "5.2 Catégories d'Enseignement & Seuil Éliminatoire",
        content: [
          "Les modules sont classés par groupes d'enseignement (ex: Compétences de Spécialité, Enseignement Général, Travaux Pratiques).",
          "Chaque catégorie définit son ordre d'affichage sur les bulletins scolaires.",
          "Option Éliminatoire : En cochant « Marquer comme groupe éliminatoire », toute note annuelle inférieure à 08.00 / 20 dans cette catégorie déclenche automatiquement un ajournement au jury, même si la moyenne générale de l'élève dépasse 10.00 / 20.",
        ],
        callout: {
          type: "rule",
          title: "Norme Académique MINEFOP sur les Matières Professionnelles",
          text: "Pour les qualifications professionnelles (DQP/CQP), la note éliminatoire de spécialité est fixée à 08.00/20. Tout apprenant ayant moins de 08/20 en spécialité pratique doit obligatoirement subir le rattrapage.",
        },
      },
      {
        title: "5.3 Cursus Type de Filière & Instanciation de Classe",
        content: [
          "• Cursus Filière : Dans Pédagogie > Cursus, définissez la maquette type par niveau et par semestre (matières, coefficients et volumes horaires standards).",
          "• Instanciation de Classe : Lorsque la session académique commence, ouvrez Pédagogie > Maquettes et cliquez sur « Instancier Maquettes » :",
          "- Option A (Cursus Filière Standard) : injecte automatiquement les cours officiels de chaque filière dans toutes les classes de l'année.",
          "- Option B (Reconduire la session précédente) : duplique les matières et réaffecte automatiquement les mêmes enseignants de l'an dernier.",
        ],
      },
      {
        title: "5.4 Annuaire des Formateurs & Comptes d'Accès en 1 Clic",
        content: [
          "Enregistrez les enseignants de votre établissement dans l'annuaire des formateurs (Nom, Prénom, Spécialité, Téléphone, Email).",
          "Pour leur donner accès à la saisie de leurs notes depuis leur propre ordinateur ou smartphone :",
          "• Cliquez sur « + Créer Accès » : le compte utilisateur est instantanément généré avec le rôle protégé « Formateur ».",
          "• L'enseignant se connecte avec son identifiant : il accède exclusivement à ses propres cours assignés sur la session active, sans voir les matières de ses collègues.",
        ],
      },
      {
        title: "5.5 Politiques de Pondération d'Évaluation (CC / Examen)",
        content: [
          "Dans Pédagogie > Pondérations, réglez la part relative du Contrôle Continu et de l'Examen de fin de semestre :",
          "• Standard Général : 30% Contrôle Continu + 70% Examen de Session Normale.",
          "• Spécialités Pratiques : Vous pouvez définir une pondération spécifique par filière (ex: 50% CC / TP + 50% Examen Pratique).",
          "Le système calcule automatiquement la note finale selon cette règle officielle.",
        ],
      },
    ],
  },
  {
    id: "chapitre-06",
    number: "06",
    title: "Évaluations, Saisie Matricielle & Délibérations Ordinaires",
    icon: "edit_note",
    badge: "Évaluations",
    link: "/pedagogie/saisie",
    linkText: "Accéder à la Saisie des Notes",
    summary: "Grille matricielle rapide, gestion des absences (M), rattrapages et jurys de délibération.",
    sections: [
      {
        title: "6.1 Saisie Matricielle Rapide (Navigation Type Tableur)",
        content: [
          "La grille d'évaluation permet une saisie ultra-fluide sans quitter les mains du clavier :",
          "• Saisissez la note : elle est automatiquement validée et bornée strictement entre 0.00 et 20.00.",
          "• Touche Entrée ou Flèche Bas : passe immédiatement à l'apprenant suivant.",
          "• Flèche Haut / Gauche / Droite : circule librement entre les colonnes CC1, CC2, Examen et Rattrapage.",
          "• Les moyennes de contrôle continu et les notes finales s'actualisent instantanément en direct lors de la frappe.",
        ],
      },
      {
        title: "6.2 Qualification des Absences (Touche « M » ou Bouton ABS)",
        content: [
          "Lorsqu'un apprenant est absent à une épreuve, tapez directement la lettre « M » (Manqué) ou cliquez sur le bouton « ABS » pour qualifier son statut :",
          "• Absence Justifiée (Certificat médical / Force majeure) : L'évaluation est neutralisée. L'élève n'est pas pénalisé et sa moyenne continue est calculée sur ses autres devoirs valides.",
          "• Absence Injustifiée (Non excusée) : L'absence est sanctionnée par la note 0.00 / 20 intégrée dans la moyenne.",
        ],
      },
      {
        title: "6.3 Session de Rattrapage & Remplacement Automatique",
        content: [
          "Si un apprenant obtient une note insuffisante à l'examen de session normale, sa note de rattrapage est saisie dans la colonne dédiée.",
          "Règle d'arbitrage : Si la note de rattrapage est supérieure à la note d'examen initiale, elle la remplace automatiquement dans le calcul de la note finale du module.",
        ],
      },
      {
        title: "6.4 Verrouillage Officiel du Bordereau de Cours",
        content: [
          "Une fois toutes les notes saisies et validées par l'enseignant, la Direction clique sur « Verrouiller » :",
          "Le bordereau est scellé. Les enseignants ne peuvent plus modifier aucune note.",
          "En cas d'erreur matérielle constatée a posteriori, un administrateur peut déverrouiller le bordereau en renseignant un motif obligatoire, consigné de manière immuable dans le Journal d'Audit.",
        ],
      },
      {
        title: "6.5 Délibérations du Jury & Décisions d'Admission",
        content: [
          "Dans Pédagogie > Délibérations, sélectionnez la classe et la portée (Semestrielle ou Annuelle Cumulée) :",
          "• Le système calcule les totaux de points pondérés, les moyennes générales et classe automatiquement les apprenants par rang.",
          "• Seuil d'Admission : Tout élève ayant une moyenne générale &ge; 10.00 / 20 sans note éliminatoire est déclaré ADMIS (ou DIPLÔMÉ s'il est en classe terminale).",
          "• Arbitrage Souverain du Jury : Le jury peut ajuster manuellement la décision d'un élève (ex: Accorder l'admission par grâce présidentielle ou repêchage).",
          "• Cliquez sur « Valider & Sceller » : les statuts scolaires des apprenants sont officiellement mis à jour dans leur dossier.",
        ],
        callout: {
          type: "tip",
          title: "Délibération de tout l'Établissement en 1 Clic",
          text: "En fin de session, cliquez sur « Délibérer Tout le Centre » pour calculer automatiquement les résultats, moyennes et rangs de toutes les classes de l'année scolaire en un seul traitement global sécurisé.",
        },
      },
    ],
  },
  {
    id: "chapitre-07",
    number: "07",
    title: "Module Régional des Examens Blancs (MINEFOP)",
    icon: "school",
    badge: "Examens Blancs",
    link: "/examens-blancs/bordereau",
    linkText: "Ouvrir Examens Blancs",
    summary: "Enrôlement des terminales, bordereaux MINEFOP sans QR code, clôture et recueil de session.",
    sections: [
      {
        title: "7.1 Référentiel des Épreuves d'Examen Blanc & Maquettes",
        content: [
          "Le module d'examen blanc dispose d'une architecture miroir indépendante conforme aux exigences des Délégations Régionales du MINEFOP :",
          "• Catalogue des Épreuves : Déclarez les épreuves officielles (ex: EPP : Épreuve Professionnelle Pratique, MSP : Matière Spécialité Pratique, EPT : Épreuve Professionnelle Théorique, LÉG : Législation, EPS : Éducation Physique).",
          "• Maquettes par Filière : Affectez à chaque filière ses épreuves d'examen d'État avec leurs coefficients ministériels officiels.",
        ],
      },
      {
        title: "7.2 Création de Session & Enrôlement Strict des Classes Sortantes",
        content: [
          "Cliquez sur « Nouvelle Session d'Examen Blanc » :",
          "• Titre officiel de session : ex: EXAMEN REGIONAL DU DQP BLANC, SESSION DE 2026.",
          "• Période d'évaluation : Dates de début et de fin des épreuves écrites et pratiques.",
          "• Portée Dynamique : Choisissez d'enrôler toutes les filières ou filtrez sur un cycle spécifique réel de votre centre (DQP, CQP, BQP...).",
          "Règle d'Éligibilité Stricte : Seules les classes terminales sortantes (Niveau &ge; Durée de la filière) sont enrôlées. Les classes de 1ère année sur des cursus pluriannuels sont automatiquement écartées.",
        ],
      },
      {
        title: "7.3 Grille de Saisie Matricielle & Commutateur d'Éligibilité",
        content: [
          "• Saisie des Notes : La grille calcule pour chaque épreuve les points (Note &times; Coef) et la moyenne finale sur 20.",
          "• Absence « M » : Les candidats absents sont notés « M » en noir.",
          "• Commutateur Retenu / Disqualifié : Si un candidat abandonne ou est exclu de l'examen blanc, cliquez sur « Disqualifié ». Il est retiré du bordereau officiel transmis à la délégation sans que son inscription annuelle normale ne soit compromise.",
          "• Import CSV par Épreuve : Vous pouvez injecter directement les notes d'une épreuve depuis un fichier CSV (Matricule;Note).",
        ],
      },
      {
        title: "7.4 Clôture Formelle de Session d'Examen Blanc",
        content: [
          "Dans l'onglet « Sessions d'Examens », cliquez sur « Clôturer » :",
          "La session et l'intégralité de ses classes passent à l'état scellé (🔒 Clôturée). Toute modification ultérieure de note, d'épreuve ou d'éligibilité est formellement bloquée.",
          "Si nécessaire, un utilisateur habilité peut déverrouiller la session pour apporter une rectification avant réimpression.",
        ],
      },
      {
        title: "7.5 Actes Réglementaires MINEFOP & Recueil Compilé de Session",
        content: [
          "Le module génère 4 documents officiels aux normes des délégations départementales :",
          "1. Bordereau Officiel des Notes (MINEFOP) : Cadre fermé, cartouche de spécialité, tableau matriciel paginé (bascule A4 Paysage dès 5 épreuves) et signature du Délégué. Sans code QR, conformément aux exigences ministérielles.",
          "2. Bordereau Vierge de Délibération : Pour les jurys pléniers manuscrits.",
          "3. Feuilles d'Émargement par Épreuve : Fiches d'émargement et de notation destinées aux examinateurs en salle d'examen.",
          "4. Recueil Unique Compilé de Session : Compile l'ensemble des bordereaux de toutes les classes candidates de la session en un seul fichier PDF A4 multipages prêt pour le dépôt officiel à la délégation.",
        ],
        callout: {
          type: "rule",
          title: "Norme Régionale MINEFOP sur les Examens Blancs",
          text: "Les bordereaux d'examen blanc régional ne comportent aucun code QR. Le format papier s'ajuste dynamiquement en Portrait (jusqu'à 4 épreuves) et en Paysage (5 épreuves et plus).",
        },
      },
    ],
  },
  {
    id: "chapitre-08",
    number: "08",
    title: "Diplomation, Relevés, Cartes Badges & Studio PDF",
    icon: "workspace_premium",
    badge: "Documents",
    link: "/pedagogie/bulletins",
    linkText: "Émettre des Documents",
    summary: "Pérennité par snapshot, QR code compact (<150 car.), parchemins dorés et Studio vectoriel.",
    sections: [
      {
        title: "8.1 Ségrégation Documentaire & Règle de Pérennité Absolue",
        content: [
          "CECO applique une distinction stricte entre les documents :",
          "• Actes Légaux Pérennes (Bulletins Semestriels, Relevés Annuels Transcripts, Diplômes de Fin de Formation, Certificats de Scolarité, Cartes d'Étudiant) : conservés dans le registre d'archives sécurisé.",
          "• Documents de Travail Temporaires (Fiches d'émargement, bordereaux vierges, procès-verbaux de classe) : générés à la volée dans le dossier temporaire.",
          "Règle de Pérennité par Snapshot : Dès qu'un acte légal est émis, l'état exact des données (notes, logo, agrément, nom du directeur) est scellé dans la base. Même si le logo ou le directeur du centre change 6 ans plus tard, ouvrir le document reproduira fidèlement l'acte d'origine sans altération rétrospective.",
          "Si vous souhaitez intégrer les nouvelles données après modification des notes, cliquez sur « Ré-émettre l'Acte (Forcer) ».",
        ],
      },
      {
        title: "8.2 Certification Cryptographique par QR Code Compact (< 150 Caractères)",
        content: [
          "Tous les actes extérieurs scellés comportent un QR code haute lisibilité encodant une signature HMAC SHA-256 compacte :",
          "Exemple : CECO:V1|CTR:CEFOPIA|MAT:CEF-GP26-0001|DOC:BULLET|NOM:NGALEU A|MOY:15.50|RNG:1e|DEC:ADMIS|SIG:8f2a1b9c",
          "Avantage opérationnel : Le certificat est lisible instantanément par n'importe quel smartphone avec appareil photo standard, même en zone rurale sans réseau Internet.",
        ],
      },
      {
        title: "8.3 Diplôme & Attestation de Fin de Formation Professionnelle",
        content: [
          "• Format noble A4 Paysage : triple filet de bordure dorée/bleu nuit, fleurons d'angle ornementaux, chapeau académique et médaille d'excellence.",
          "• Fond Décoratif Officiel : Le fichier attestation_bg.jpg est automatiquement chargé depuis les assets et s'affiche toujours avec une netteté absolue à 100% d'opacité.",
          "• Calligraphie Cursive : Le nom du lauréat est composé avec la police script cursive Pinyon Script pour conférer au diplôme son authenticité solennelle.",
        ],
      },
      {
        title: "8.4 Cartes d'Apprenant CR80 & Planches A4 Duplex",
        content: [
          "• Carte individuelle : Format international carte bancaire CR80 (85.6 &times; 53.98 mm) avec photo 4:4, ID officiel, filigrane et code QR au recto, règles d'utilisation au verso.",
          "• Opacité de texture réglable : De 0% à 100% (par défaut 100%) dans le Studio.",
          "• Tirage Planche A4 Duplex : Génère une planche prête à imprimer de 8 cartes recto/verso avec repères de coupe massicot d'imprimerie.",
        ],
      },
      {
        title: "8.5 Procès-Verbaux de Classe & Légende des Matières",
        content: [
          "Les procès-verbaux collectifs de classe (PV de Semestre, PV Annuel, PV de Contrôle Continu) adoptent une mise en page certifiée :",
          "• En-tête Interne Centré : Le logo de l'établissement trône à gauche, aligné avec la dénomination, l'agrément et les contacts empilés à droite, et l'ensemble du bloc est centré au milieu de la feuille.",
          "• Filigrane Exclusif : Seul le logo officiel du centre est affiché en filigrane (le sceau d'État est banni des documents internes).",
          "• Légende Exhaustive des Matières : Au bas du document, un cartouche de correspondance explicite chaque code matière (ex: [GRA01] : Infographie Vectorielle 2D (Coef 4) • [ENG01] : Anglais Technique (Coef 2)).",
        ],
      },
      {
        title: "8.6 Studio de Personnalisation des Gabarits",
        content: [
          "Dans Administration > Gabarits d'actes, personnalisez l'ensemble des 16 modèles du progiciel :",
          "• Modifiez les couleurs thématiques, les mentions légales de bas de page et les formules solennelles.",
          "• Visualisez immédiatement les modifications grâce au moteur d'aperçu vectoriel en temps réel.",
        ],
      },
    ],
  },
  {
    id: "chapitre-09",
    number: "09",
    title: "Transition Annuelle Automatique & Clôture de Session",
    icon: "calendar_month",
    badge: "Cycle de Vie",
    link: "/academie/sessions",
    linkText: "Ouvrir Sessions & Transition",
    summary: "Clôture irréversible de l'année scolaire, moteur de transition et scellement d'archives.",
    sections: [
      {
        title: "9.1 Protocole de Clôture d'une Session Académique",
        content: [
          "À l'issue de l'année scolaire et après la délibération annuelle définitive de toutes les classes :",
          "• Ouvrez Structure Académique > Sessions & Transition.",
          "• Cliquez sur « Clôturer la Session » : l'année passe au statut CLOSED.",
          "• Tous les résultats, notes de cours et inscriptions sont définitivement verrouillés. Aucune altération des archives historiques n'est plus permise.",
        ],
      },
      {
        title: "9.2 Moteur de Transition Annuelle Automatique",
        content: [
          "Pour préparer la rentrée suivante sans ressaisir manuellement les dossiers :",
          "1. Créez la nouvelle session préparatoire (statut UPCOMING, ex: 2027-2028).",
          "2. Cliquez sur « Transition Annuelle » en sélectionnant la session sortante et la session cible.",
          "3. L'exécuteur de transition analyse les décisions officielles des délibérations :",
          "- Les apprenants déclarés ADMIS sont promus au Niveau supérieur (ex: Niveau 1 ➔ Niveau 2).",
          "- Les apprenants REDOUBLANTS sont automatiquement réinscrits dans la même filière au même niveau.",
          "- Les apprenants de dernière année déclarés DIPLÔMÉS reçoivent leur mention finale et leur scolarité est scellée.",
          "4. Un rapport récapitulatif affiche le nombre d'admis promus, de redoublants et de lauréats certifiés.",
        ],
      },
    ],
  },
  {
    id: "chapitre-10",
    number: "10",
    title: "Plan de Reprise d'Activité (PRA), Sauvegardes & Multi-Instances",
    icon: "archive",
    badge: "Souveraineté",
    link: "/administration/sauvegardes",
    linkText: "Gérer les Sauvegardes",
    summary: "Archives hybrides .zip, externalisation physique et restauration d'urgence sur machine neuve.",
    sections: [
      {
        title: "10.1 Format d'Archive Hybride Universelle (.zip)",
        content: [
          "Les sauvegardes CECO sont des archives compressées autonomes (.zip avec compression zlib niveau 9) encapsulant :",
          "• db_dump.json : Le dump relationnel structuré intégral de toutes les tables PostgreSQL (étudiants, notes, délibérations, examens blancs, utilisateurs, rôles).",
          "• /media : L'arborescence physique complète des photographies d'apprenants, des signatures numérisées, des logos, des fonds personnalisés et des actes scellés.",
        ],
      },
      {
        title: "10.2 Protocole d'Externalisation Physique Quotidienne",
        content: [
          "Règle de Sécurité Fondamentale : Chaque jour après la clôture des saisies, cliquez sur « Créer une Sauvegarde », puis cliquez sur « Exporter .zip ».",
          "Copiez impérativement ce fichier .zip sur un support physique amovible externe (clé USB ou disque dur externe sécurisé).",
          "Ne laissez jamais l'unique copie de sauvegarde sur le disque dur de la machine serveur.",
        ],
        callout: {
          type: "warning",
          title: "Garantie Anti-Sinistre",
          text: "En cas de vol, d'incendie, de surtension électrique ou de défaillance mécanique du disque dur du serveur, votre archive externe .zip contient 100% de la vie de votre établissement.",
        },
      },
      {
        title: "10.3 Restauration d'Urgence sur une Nouvelle Machine (Transplantation Relationnelle)",
        content: [
          "Si votre ordinateur serveur est définitivement hors-service, appliquez la procédure de reprise d'activité sur n'importe quel nouvel ordinateur :",
          "1. Installez CECO Suite ERP sur la nouvelle machine et démarrez en Mode Serveur.",
          "2. Activez votre licence locale pour la nouvelle machine hôte (qui possède son propre Center ID).",
          "3. Allez dans Sauvegardes et cliquez sur « Importer Sauvegarde (.zip) » en sélectionnant votre archive externe.",
          "4. Cliquez sur « Restaurer » :",
          "Moteur de Transplantation Souverain : Le système détecte la nouvelle machine hôte, conserve intacte sa licence cryptographique Ed25519, remmappe automatiquement toutes les données de l'ancien centre vers la nouvelle identité, réinjecte les fichiers médias et réinitialise le cache du serveur sans aucun conflit de clé étrangère.",
        ],
      },
    ],
  },
  {
    id: "chapitre-11",
    number: "11",
    title: "Sécurité, Rôles RBAC, Audit & Guide de Dépannage",
    icon: "security",
    badge: "Sécurité",
    link: "/administration/roles",
    linkText: "Gérer Habilitations & Rôles",
    summary: "Contrôle d'accès RBAC, traçabilité d'audit, horloge anti-fraude et dépannage rapide.",
    sections: [
      {
        title: "11.1 Matrice RBAC & Règle d'Augmentation des Droits",
        content: [
          "Le contrôle d'accès repose sur une matrice granulaire (Consulter, Créer, Modifier, Supprimer, Valider, Émettre PDF) par module.",
          "• Rôle Admin : Accès universel (*).",
          "• Rôles Système Protégés (Directeur des Études, Secrétaire, Formateur) : Possèdent un socle minimal inaliénable garantissant qu'aucune fausse manipulation ne puisse priver le personnel de ses outils vitaux.",
          "• Règle d'Augmentation : L'administrateur peut accorder des privilèges supplémentaires à un rôle système (ex: permettre au Secrétaire d'éditer les relevés), mais les droits de base restent protégés.",
        ],
      },
      {
        title: "11.2 Journal d'Audit Immuable (Traçabilité)",
        content: [
          "Toutes les opérations sensibles sont consignées en temps réel dans le journal d'audit :",
          "• Déverrouillages d'urgence de bordereaux de notes avec motif obligatoire.",
          "• Exécution des jurys de délibération de classe et délibérations globales.",
          "• Clôtures officielles de sessions académiques.",
          "Chaque entrée consigne l'auteur, l'horodatage exact et la charge utile JSON brute des modifications.",
        ],
      },
      {
        title: "11.3 Horloge Système Anti-Fraude (Clock Tampering Guard)",
        content: [
          "Pour empêcher toute tentative de contournement de la durée de licence par modification de l'horloge du système d'exploitation :",
          "CECO enregistre des balises temporelles cryptées (heartbeat ticks). Si l'heure du PC est reculée de plus de 2 heures par rapport au dernier enregistrement, l'application bloque immédiatement les écritures et lève une alerte de falsification d'horloge.",
        ],
      },
      {
        title: "11.4 Guide Rapide de Résolution des Incidents",
        content: [
          "• Incident : « Impossible de contacter le serveur distant » sur un poste client : Vérifiez que l'ordinateur serveur est allumé, connecté au même réseau Wi-Fi/câble, et que le pare-feu Windows du serveur autorise le port 4000.",
          "• Incident : « Port 5433 occupé » au démarrage : Quittez CECO depuis l'icône de la barre des tâches système (systray) et relancez. Le démarrage atomique nettoyera les processus résiduels.",
          "• Incident : « Application en mode Lecture Seule » : La période de grâce de 7 jours de votre licence a expiré. Transmettez votre Center ID affiché dans Administration > Licence à l'autorité éditrice pour obtenir une clé de rechargement hors-ligne.",
        ],
      },
    ],
  },
];

export default function UserDocumentationModal({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("chapitre-01");
  const navigate = useNavigate();

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
    if (!searchQuery.trim()) return DOCUMENTATION_CHAPTERS;
    const q = searchQuery.toLowerCase();

    return DOCUMENTATION_CHAPTERS.map((ch) => {
      const matchTitle = ch.title.toLowerCase().includes(q) || ch.summary.toLowerCase().includes(q);
      const matchingSections = ch.sections.filter((sec) => {
        const titleMatch = sec.title.toLowerCase().includes(q);
        const contentMatch = sec.content.some((line) => line.toLowerCase().includes(q));
        const calloutMatch = sec.callout && (sec.callout.title.toLowerCase().includes(q) || sec.callout.text.toLowerCase().includes(q));
        return titleMatch || contentMatch || calloutMatch;
      });

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

  const activeChapter = DOCUMENTATION_CHAPTERS.find((c) => c.id === selectedChapterId) || filteredChapters[0] || DOCUMENTATION_CHAPTERS[0];

  function handleNavigateToModule(path) {
    onClose();
    navigate(path);
  }

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.12 }}
          className="w-full max-w-6xl rounded bg-surface border border-border shadow-modal h-[94vh] flex flex-col justify-between overflow-hidden dark:bg-surface-dark dark:border-border-dark"
        >
          {/* HEADER DE RECHERCHE ET NAVIGATION RESPONSIVE (SANS BOUTON IMPRIMER) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border px-5 sm:px-6 py-3.5 flex-shrink-0 dark:border-border-dark bg-[#FAFBFD] dark:bg-[#07111D]">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-900 text-white shadow-xs dark:bg-brand-500 flex-shrink-0">
                <Icon name="menu_book" className="text-[22px]" />
              </div>

              <div className="space-y-1 min-w-0">
                {/* Conteneur fluide avec flex-wrap pour garantir que les badges ne débordent jamais */}
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-body-md font-heading font-semibold text-ink-primary dark:text-white leading-tight truncate">
                    Manuel Opérationnel d'Exploitation CECO Suite ERP
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="brand" className="whitespace-nowrap">Touche [F1]</Badge>
                    <span className="hidden sm:inline-flex">
                      <Badge variant="neutral" className="whitespace-nowrap">v4.0.0</Badge>
                    </span>
                    <span className="hidden md:inline-flex">
                      <Badge variant="neutral" className="whitespace-nowrap">Offline-First</Badge>
                    </span>
                  </div>
                </div>
                <p className="text-caption text-ink-muted truncate">
                  Guide d'exploitation standard pour la direction, le secrétariat et les formateurs (MINEFOP).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0 w-full sm:w-auto justify-end">
              <div className="w-full sm:w-72">
                <Input
                  placeholder="Rechercher (ex: notes, MINEFOP, PRA...)"
                  leftIcon="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  rightIcon={searchQuery ? "close" : undefined}
                  onRightIconClick={() => setSearchQuery("")}
                />
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-ink-muted hover:text-ink-primary p-1.5 rounded transition-colors dark:text-ink-muted-dark dark:hover:text-white"
                title="Fermer l'aide (Échap)"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
          </div>

          {/* CORPS PRINCIPAL : SOMMAIRE GAUCHE | CONTENU EXHAUSTIF DROITE */}
          <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
            {/* SOMMAIRE DES 11 CHAPITRES */}
            <div className="md:col-span-4 border-r border-border p-3 space-y-1.5 overflow-y-auto bg-[#F5F7FA] dark:bg-[#07111D] dark:border-border-dark">
              <div className="px-2 py-1 flex items-center justify-between text-overline text-ink-secondary uppercase tracking-wider font-semibold border-b border-border pb-2 dark:border-border-dark">
                <span>Sommaire Général ({filteredChapters.length})</span>
                <span className="font-mono text-[10px]">11 Procédures</span>
              </div>

              {filteredChapters.length === 0 ? (
                <div className="p-6 text-center text-caption text-ink-muted">
                  Aucun résultat pour « {searchQuery} »
                </div>
              ) : (
                filteredChapters.map((ch) => {
                  const isSelected = ch.id === activeChapter.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChapterId(ch.id)}
                      className={`w-full p-2.5 rounded text-left transition-colors flex items-start gap-2.5 border ${
                        isSelected
                          ? "bg-brand-900 text-white border-brand-900 shadow-xs font-semibold dark:bg-brand-500 dark:border-brand-500"
                          : "bg-surface text-ink-primary border-border hover:bg-white dark:bg-surface-dark dark:border-border-dark dark:text-ink-primary-dark dark:hover:bg-[#13263A]"
                      }`}
                    >
                      <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-brand-900/10 text-brand-900 dark:bg-brand-500/20 dark:text-brand-500"
                      }`}>
                        {ch.number}
                      </span>

                      <div className="truncate flex-1">
                        <div className="text-body-sm font-semibold truncate leading-tight">
                          {ch.title}
                        </div>
                        <div className={`text-[11px] truncate mt-0.5 ${isSelected ? "text-white/80" : "text-ink-muted"}`}>
                          {ch.summary}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* CONTENU DÉTAILLÉ DU CHAPITRE SÉLECTIONNÉ */}
            <div className="md:col-span-8 p-6 space-y-6 overflow-y-auto text-body-sm leading-relaxed bg-surface dark:bg-surface-dark">
              {/* Entête du chapitre */}
              <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-border-dark">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-brand-900 text-white font-heading font-bold flex items-center justify-center flex-shrink-0 dark:bg-brand-500 text-h4">
                    {activeChapter.number}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="brand">{activeChapter.badge}</Badge>
                      <span className="text-[11px] font-mono text-ink-muted uppercase">Version 4.0.0</span>
                    </div>
                    <h2 className="text-h4 font-heading font-semibold text-ink-primary dark:text-white mt-0.5">
                      {activeChapter.title}
                    </h2>
                  </div>
                </div>

                {activeChapter.link && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="launch"
                    onClick={() => handleNavigateToModule(activeChapter.link)}
                    className="flex-shrink-0"
                  >
                    {activeChapter.linkText || "Accéder au Module"}
                  </Button>
                )}
              </div>

              {/* Sections rédigées */}
              <div className="space-y-6">
                {activeChapter.sections.map((sec, sidx) => (
                  <div key={sidx} className="p-5 rounded bg-[#FAFBFD] border border-border space-y-3 dark:bg-[#07111D] dark:border-border-dark">
                    <h3 className="font-heading font-semibold text-body-md text-brand-900 dark:text-brand-500 flex items-center gap-2 border-b border-border pb-2 dark:border-border-dark">
                      <Icon name="bookmark" className="text-[18px]" />
                      <span>{sec.title}</span>
                    </h3>

                    <div className="space-y-2 text-ink-secondary dark:text-ink-secondary-dark">
                      {sec.content.map((paragraph, pidx) => (
                        <p key={pidx} className="whitespace-pre-line leading-relaxed text-[13px]">
                          {paragraph}
                        </p>
                      ))}
                    </div>

                    {/* Bloc d'encadré sémantique */}
                    {sec.callout && (
                      <div className={`p-3.5 rounded border text-[12.5px] space-y-1 flex items-start gap-2.5 ${
                        sec.callout.type === "rule"
                          ? "bg-warning-subtle text-warning-dark border-warning/40 dark:bg-warning-subtle-dark dark:text-warning"
                          : sec.callout.type === "warning"
                          ? "bg-error-subtle text-error border-error/40 dark:bg-error-subtle-dark dark:text-error-dark"
                          : sec.callout.type === "tip"
                          ? "bg-success-subtle text-success border-success/40 dark:bg-success-subtle-dark dark:text-success-dark"
                          : "bg-info-subtle text-info border-info/40 dark:bg-info-subtle-dark dark:text-info-dark"
                      }`}>
                        <Icon
                          name={
                            sec.callout.type === "rule" ? "verified" :
                            sec.callout.type === "warning" ? "warning" :
                            sec.callout.type === "tip" ? "lightbulb" : "info"
                          }
                          className="text-[20px] flex-shrink-0 mt-0.5"
                        />
                        <div className="flex-1">
                          <strong className="block font-bold uppercase tracking-wider text-[11px]">
                            {sec.callout.title}
                          </strong>
                          <span className="leading-relaxed block mt-0.5 font-sans">
                            {sec.callout.text}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FOOTER : RACCOURCIS & CRÉDITS (VERSION 4.0.0) */}
          <div className="border-t border-border bg-[#FAFBFD] px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-caption text-ink-muted flex-shrink-0 dark:border-border-dark dark:bg-[#07111D]">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-mono font-semibold text-ink-primary dark:text-white">Raccourcis Système :</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-surface border font-mono text-[10px] font-bold">F1</kbd> Ouvrir/Fermer l'Aide</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-surface border font-mono text-[10px] font-bold">Ctrl+K</kbd> Recherche Rapide</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-surface border font-mono text-[10px] font-bold">Échap</kbd> Fermer la fenêtre</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono">CECO Suite ERP • Manuel d'Exploitation v4.0.0</span>
              <Button variant="primary" size="sm" onClick={onClose}>
                Fermer l'Aide
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}