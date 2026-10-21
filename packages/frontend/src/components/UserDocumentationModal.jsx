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
    title: "Démarrage, Architecture Réseau & Première Connexion",
    icon: "dns",
    badge: "Mise en Route",
    link: "/administration/apropos",
    linkText: "Fiche Technique",
    summary: "Mode Serveur vs Mode Client LAN, connexion des postes du centre et résolution des ports.",
    sections: [
      {
        title: "1.1 Premier Lancement : Choisir le Mode de ce Poste",
        content: [
          "Lors du tout premier lancement après installation, un écran de configuration s'affiche :",
          "• Mode Serveur Principal : À choisir UNIQUEMENT sur l'ordinateur principal du centre. Ce poste démarre la base de données PostgreSQL 17 embarquée (port 5433) et l'API centrale (port 4000). Il doit rester allumé pendant les heures de travail.",
          "• Mode Client Réseau (LAN) : À choisir sur tous les autres postes de travail (Secrétariat, Direction des Études, Salle des Formateurs). Ces postes ne lancent pas de base locale : ils se connectent via le réseau Wi-Fi ou câble Ethernet au poste serveur.",
        ],
        callout: {
          type: "tip",
          title: "Bonne Pratique Réseau Local",
          text: "Attribuez une adresse IP fixe au poste serveur sur votre routeur (ex: 192.168.1.50). Ainsi, les postes clients n'auront jamais à chercher l'adresse du serveur en cas de redémarrage de la box internet.",
        },
      },
      {
        title: "1.2 Connecter les Postes Clients au Serveur",
        content: [
          "1. Vérifiez que le poste serveur principal est allumé et que CECO y est ouvert.",
          "2. Sur le poste secondaire, lancez CECO : il effectue un balayage réseau automatique et affiche le nom de votre serveur.",
          "3. Cliquez sur « Choisir » pour vous connecter immédiatement.",
          "4. Si le pare-feu bloque la détection automatique : tapez manuellement l'adresse IP affichée sur le serveur suivie du port (ex: 192.168.1.50:4000) et cliquez sur « Se connecter ».",
        ],
      },
      {
        title: "1.3 Que faire si un message indique « Port 5433 occupé » ou « Échec de démarrage » ?",
        content: [
          "CECO applique une sécurité d'arrêt d'urgence 'Tout ou Rien'. Si un démarrage précédent a été brutalement interrompu :",
          "• Regardez en bas à droite de votre écran Windows (près de l'horloge) : faites un clic droit sur l'icône CECO dans la barre des tâches et choisissez « Quitter l'application ».",
          "• Relancez CECO : le système nettoie automatiquement les ports et relance les services proprement.",
        ],
      },
    ],
  },
  {
    id: "chapitre-02",
    number: "02",
    title: "Identité Légale, Agrément MINEFOP, Direction & Signatures",
    icon: "storefront",
    badge: "Administration",
    link: "/administration/centre",
    linkText: "Ouvrir Paramètres Centre",
    summary: "Dénomination officielle, Arrêté ministériel, formule du Directeur et signatures numérisées.",
    sections: [
      {
        title: "2.1 Dénomination & Arrêté d'Agrément Ministériel",
        content: [
          "Allez dans Administration > Configuration de l'Établissement :",
          "• Dénomination : Nom officiel exact du centre tel qu'enregistré auprès de la tutelle (ex: CEFOPIA).",
          "• N° d'Arrêté d'Agrément MINEFOP : Renseignez le numéro exact de votre arrêté d'ouverture ou d'agrément (ex: N° 0042/MINEFOP/SG/DFOP). Ce numéro est obligatoire et est imprimé automatiquement sur toutes les cartes, attestations et diplômes.",
          "• Ville : Ville d'émission des actes administratifs (ex: Bafoussam, Yaoundé, Douala).",
        ],
        callout: {
          type: "rule",
          title: "Règle de Contrôle MINEFOP",
          text: "Les inspecteurs régionaux comparent l'arrêté imprimé sur les diplômes et cartes avec l'original ministériel. Ne laissez jamais ce champ vide ou avec la mention 'Autorisé / En cours' une fois l'agrément obtenu.",
        },
      },
      {
        title: "2.2 Direction de l'Établissement & Signataire Légal",
        content: [
          "Complétez obligatoirement le bloc Direction de l'Établissement :",
          "• Nom et Prénom du Directeur : ex: NGALEU Armstrong Euclador.",
          "• Titre officiel : ex: Le Directeur Général.",
          "Ce nom et cette fonction alimentent automatiquement la formule solennelle « Je soussigné, Monsieur... en qualité de... certifie que » sur l'ensemble des certificats de scolarité délivrés aux élèves.",
        ],
      },
      {
        title: "2.3 Numérisation et Téléversement des Signatures (.png)",
        content: [
          "Pour que les signatures soient apposées automatiquement en bas des bulletins, relevés et diplômes :",
          "1. Faites signer le Directeur Général et le Promoteur sur une feuille blanche immaculée.",
          "2. Scannez ou photographiez nettement la signature, puis détourer-la pour obtenir un fond transparent au format PNG.",
          "3. Dans la section Signatures, cliquez sur « Téléverser » en face du rôle correspondant (Directeur Général, Promoteur, Directeur des Études).",
          "Dès l'enregistrement, tous les actes générés intègrent la signature scannée dans leur cartouche officiel.",
        ],
      },
      {
        title: "2.4 Personnalisation du Patron de Matricule Officiel",
        content: [
          "Le logiciel génère automatiquement des matricules uniques sans risque de doublon selon le patron de votre choix.",
          "Format conseillé : {CTR}-{FIL}{YY}-{NUM4} (qui produit par exemple CEFOPIA-GP26-0001).",
          "• {CTR} : Sigle de votre centre • {FIL} : Code filière (ex: GP) • {YY} : Millésime (ex: 26 pour 2026) • {NUM4} : Numéro chronologique 0001.",
        ],
      },
    ],
  },
  {
    id: "chapitre-03",
    number: "03",
    title: "Offre de Formation, Filières & Sessions Académiques",
    icon: "account_tree",
    badge: "Structure",
    link: "/academie/filieres",
    linkText: "Gérer Filières & Sessions",
    summary: "Cycles DQP/CQP, durées d'études, gestion des salles et règle ministérielle des 8 mois.",
    sections: [
      {
        title: "3.1 Cycles & Filières de Formation",
        content: [
          "• Cycles MINEFOP : Déclarez les qualifications reconnues (DQP : Diplôme de Qualification Professionnelle, CQP : Certificat de Qualification Professionnelle, etc.).",
          "• Création d'une Filière : Indiquez son nom et sa durée d'études (1 an, 2 ans ou 3 ans).",
          "• Niveaux Automatiques : Dès qu'une filière de 2 ans est créée, le système engendre immédiatement Niveau 1 et Niveau 2 sans configuration manuelle.",
        ],
      },
      {
        title: "3.2 Salles de Cours & Ateliers Pratiques",
        content: [
          "Déclarez vos salles avec leur capacité maximale.",
          "Si une classe n'a pas de salle attitrée fixe (ex: cours en atelier de mécanique ou salles tournantes), laissez le champ salle vide : la classe sera marquée « Non assignée » sans bloquer les cours ni les évaluations.",
        ],
      },
      {
        title: "3.3 Ouverture d'une Session & Règle Légale des 8 Mois (240 Jours)",
        content: [
          "Pour créer une année scolaire dans Structure Académique > Sessions :",
          "• L'intitulé doit respecter le format standard YYYY-YYYY (ex: 2026-2027).",
          "• Durée légale obligatoire : La date de fin doit être postérieure d'au moins 240 jours (8 mois minimum) à la date de début. Toute session plus courte est refusée par respect des normes MINEFOP.",
          "• Une seule session peut être « Active » (CURRENT). Les sessions passées doivent être clôturées (CLOSED) pour figer leurs archives historiques.",
        ],
        callout: {
          type: "rule",
          title: "Contrôle de Conformité des Heures de Formation",
          text: "Une année d'études en formation professionnelle ne peut légalement être validée en moins de 8 mois. Le progiciel bloque techniquement toute création d'année scolaire tronquée pour protéger l'agrément de votre établissement.",
        },
      },
    ],
  },
  {
    id: "chapitre-04",
    number: "04",
    title: "Inscriptions, Photos Webcam & Gestion des Apprenants",
    icon: "group",
    badge: "Scolarité",
    link: "/apprenants",
    linkText: "Ouvrir Registre Apprenants",
    summary: "Inscriptions individuelles, webcam 4:4, imports CSV et suppression d'erreur vs archivage légal.",
    sections: [
      {
        title: "4.1 Inscription Individuelle d'un Élève",
        content: [
          "Dans Scolarité > Apprenants, cliquez sur « Nouvel Apprenant » :",
          "1. Prenez la photo par Webcam ou téléversez un fichier image.",
          "2. Saisissez l'état civil (Nom, Prénom, Sexe, Date et Lieu de naissance, Téléphone).",
          "3. Renseignez obligatoirement le nom et téléphone du tuteur légal (personne à contacter en cas d'urgence) et le diplôme d'entrée (CEP, BEPC, BAC...).",
          "4. Choisissez la session active et la classe d'affectation : le matricule est généré et scellé immédiatement.",
        ],
      },
      {
        title: "4.2 Utilisation de la Webcam (Format Carré 4:4)",
        content: [
          "Cliquez sur « Webcam » dans le formulaire d'inscription :",
          "• Autorisez l'accès à la caméra de votre ordinateur.",
          "• Cadrez le visage de l'apprenant dans le viseur central.",
          "• Cliquez sur « Capturer la Photo » : l'image est automatiquement découpée en carré 4:4 haute netteté, optimisée et stockée sans déformation.",
        ],
      },
      {
        title: "4.3 Comment Corriger une Erreur de Saisie vs Archiver un Élève ?",
        content: [
          "Le progiciel fait la différence automatique entre une fausse manipulation et un départ réel :",
          "• Cas 1 : J'ai fait une faute de frappe ou créé un élève par erreur : Cliquez sur la corbeille. Comme l'élève n'a AUCUNE note, ni PV, ni diplôme, le système le supprime DÉFINITIVEMENT et LIBÈRE son matricule immédiatement.",
          "• Cas 2 : L'élève a suivi des cours, a des notes ou a reçu un bulletin, puis a abandonné : Cliquez sur la corbeille. Le système refuse de détruire ses notes et l'ARCHIVE en toute sécurité dans l'onglet « Archives historiques ».",
          "• Cas 3 : Nettoyer les archives : Dans « Archives historiques », vous pouvez purger définitivement un dossier uniquement s'il n'avait aucune note.",
        ],
        callout: {
          type: "tip",
          title: "Sérénité pour les Secrétaires",
          text: "Vous ne risquez plus de bloquer un matricule ou de polluer la base de données après une fausse manipulation : tant qu'aucune note n'a été saisie sur un apprenant, sa suppression est intégrale et immédiate.",
        },
      },
      {
        title: "4.4 Importation Massive par Fichier Excel / CSV",
        content: [
          "Pour inscrire 50 élèves en 10 secondes lors de la rentrée :",
          "1. Ouvrez « Import CSV » et choisissez la classe d'accueil.",
          "2. Préparez un fichier avec les colonnes séparées par des points-virgules (;) :",
          "Matricule;Nom;Prenom;Genre;DateNaissance;LieuNaissance;Telephone;Tuteur;TelUrgence;DiplomeEntree",
          "3. Laissez la première colonne Matricule vide si vous voulez que CECO génère les matricules automatiquement !",
          "4. Validez : un bilan affiche le nombre de dossiers créés et signale les éventuelles anomalies.",
        ],
      },
    ],
  },
  {
    id: "chapitre-05",
    number: "05",
    title: "Pédagogie, Matières à 5 Caractères & Accès Formateurs",
    icon: "library_books",
    badge: "Pédagogie",
    link: "/pedagogie/matieres",
    linkText: "Gérer les Matières",
    summary: "Codes matières normalisés, matières éliminatoires (<08/20) et comptes d'accès enseignants.",
    sections: [
      {
        title: "5.1 Règle des Codes Matières à 5 Caractères",
        content: [
          "Chaque matière enregistrée au catalogue possède un code officiel à exactement 5 caractères majuscules (ex: THM01 pour Thermodynamique 1, GRA02 pour Mise en page 2, ANG01 pour Anglais).",
          "Ces codes courts sont indispensables pour afficher des tableaux de délibération lisibles et compacts.",
        ],
      },
      {
        title: "5.2 Activer la Règle Éliminatoire sur les Matières Pratiques",
        content: [
          "Dans Pédagogie > Catégories & Groupes :",
          "• Créez vos groupes d'enseignement (ex: Matières Professionnelles de Spécialité, Enseignement Général).",
          "• Cochez « Marquer comme groupe éliminatoire » sur les matières de spécialité : tout apprenant obtenant moins de 08.00 / 20 dans ce groupe sera automatiquement AJOURNÉ au jury, même si sa moyenne générale dépasse 12 / 20 !",
        ],
      },
      {
        title: "5.3 Créer les Comptes des Enseignants en 1 Clic",
        content: [
          "Pour que vos formateurs saisissent eux-mêmes leurs notes sans avoir accès aux fonctions de direction :",
          "1. Allez dans Pédagogie > Formateurs.",
          "2. Cliquez sur « + Créer Accès » en face de l'enseignant : son compte est créé immédiatement.",
          "3. Donnez-lui son identifiant (ex: paul.kamdem@ceco.local) et son mot de passe temporaire (prof1234).",
          "4. Lorsqu'il se connecte, l'enseignant n'a accès qu'à ses propres matières assignées et ne peut modifier aucune autre classe.",
        ],
      },
    ],
  },
  {
    id: "chapitre-06",
    number: "06",
    title: "Saisie des Notes, Absences « M », Rattrapages & Délibérations",
    icon: "edit_note",
    badge: "Évaluations",
    link: "/pedagogie/saisie",
    linkText: "Saisir les Notes",
    summary: "Navigation rapide au clavier, qualification absence M, seuil d'admission et mention Médiocre à 8.",
    sections: [
      {
        title: "6.1 Saisie Rapide dans la Grille (Touches Clavier)",
        content: [
          "La grille de notes fonctionne comme un tableur rapide :",
          "• Tapez la note (ex: 14.5) : elle est bornée automatiquement entre 0 et 20.",
          "• Appuyez sur Entrée ou Flèche Bas : le curseur descend immédiatement à l'élève suivant.",
          "• Flèche Droite / Gauche : navigue entre CC1, CC2, Examen et Rattrapage.",
          "• Cliquez sur « Enregistrer les Notes » pour enregistrer le bordereau.",
        ],
      },
      {
        title: "6.2 Gestion des Absences : Touche « M » ou Bouton ABS",
        content: [
          "Si un élève est absent lors d'un devoir ou examen :",
          "• Tapez la lettre « M » (Manqué) ou cliquez sur le bouton « ABS » :",
          "- Absence Justifiée (Maladie / Motif valable avec certificat) : La matière n'est pas pénalisée et ne compte pas comme un zéro.",
          "- Absence Injustifiée (Élève ayant séché) : L'absence est enregistrée et compte comme la note 0.00 / 20 dans le calcul.",
        ],
      },
      {
        title: "6.3 Rattrapages & Remplacement Automatique",
        content: [
          "Saisissez la note de rattrapage dans la colonne « Rattrapage » :",
          "Si la note de rattrapage est supérieure à la note d'examen initial, le système remplace automatiquement l'ancienne note pour calculer la note définitive du module.",
        ],
      },
      {
        title: "6.4 Délibérations : Choisir la Barre d'Admission (ex: 8.00 ou 10.00)",
        content: [
          "Dans Pédagogie > Délibérations :",
          "1. Sélectionnez la classe et le semestre ou l'année complète (Cumul S1 + S2).",
          "2. Par défaut, la barre d'admission est fixée à 10.00 / 20.",
          "3. Le Jury décide souverainement de repêcher les élèves assidus à 8.00 ou 8.50 ? Modifiez simplement le champ « Barre d'Admission (/20) » à 8.00 et cliquez sur « Appliquer » : tous les élèves ayant >= 8.00 basculent automatiquement en Admis !",
          "4. Nouvelle Échelle Officielle des Mentions :",
          "   • >= 16.00 : Très Bien",
          "   • >= 14.00 : Bien",
          "   • >= 12.00 : Assez Bien",
          "   • >= 10.00 : Passable",
          "   • >= 08.00 : Médiocre (un élève admis à 8.50 reçoit la mention Médiocre, et non Passable)",
          "   • < 08.00  : Faible",
          "5. Cliquez sur « Valider & Sceller » : la délibération officielle est enregistrée et scellée en base.",
        ],
        callout: {
          type: "tip",
          title: "Délibérer tout le centre en 1 Clic",
          text: "Pour les fins d'année, cliquez sur « Délibérer Tout le Centre ». Vous pouvez aussi y régler la barre de grâce (ex: 8.00 ou 10.00) : l'ERP calcule et scelle toutes les classes de l'école en une seule opération.",
        },
      },
    ],
  },
  {
    id: "chapitre-07",
    number: "07",
    title: "Examens Blancs Régionaux (Normes MINEFOP)",
    icon: "school",
    badge: "Examens Blancs",
    link: "/examens-blancs/bordereau",
    linkText: "Ouvrir Examens Blancs",
    summary: "Classes terminales uniquement, bordereaux sans QR code, disqualification et recueil compilé.",
    sections: [
      {
        title: "7.1 Enrôlement Automatique Strict des Classes Sortantes",
        content: [
          "Dans Examens Blancs > Sessions, cliquez sur « Nouvelle Session d'Examen Blanc » :",
          "• Choisissez la session active et donnez un titre (ex: EXAMEN REGIONAL DU DQP BLANC, SESSION DE 2026).",
          "• Choisissez la portée (Tous cycles, DQP uniquement, CQP uniquement...).",
          "• Sécurité Garantie : Seules les classes terminales sortantes (ex: 2ème année sur un cycle de 2 ans) sont enrôlées. Les classes de 1ère année sont automatiquement écartées.",
        ],
      },
      {
        title: "7.2 Saisie des Notes & Disqualification d'un Candidat",
        content: [
          "• Saisie : Remplissez les notes d'épreuves (EPP, MSP, EPT, LÉG, EPS). La grille calcule en temps réel Note * Coef et la moyenne / 20.",
          "• Commutateur Disqualifié / Retenu : Si un candidat ne se présente pas à l'examen blanc ou abandonne, cliquez sur « Disqualifié ». Il est retiré du bordereau officiel envoyé à la délégation, sans toucher à sa scolarité normale au centre.",
        ],
      },
      {
        title: "7.3 Documents Réglementaires MINEFOP & Recueil Compilé",
        content: [
          "Le module génère les documents conformes aux exigences de l'Inspection Régionale :",
          "1. Bordereau Officiel des Notes (MINEFOP) : Bordereau fermé sans code QR (exigence MINEFOP), avec cartouche métier et signature du Délégué Départemental.",
          "2. Feuilles d'Émargement : Pour faire émarger les candidats et noter les épreuves en salle.",
          "3. Recueil Compilé de Session : Dans l'onglet Sessions, cliquez sur « Recueil Compilé » : l'ERP génère un seul document PDF contenant tous les bordereaux de toutes les filières candidates prêt à déposer à la Délégation.",
          "4. Clôture de Session : Cliquez sur « Clôturer » pour sceller la session une fois les notes remises à la tutelle.",
        ],
        callout: {
          type: "rule",
          title: "Absence de QR Code sur les Examens Blancs MINEFOP",
          text: "Contrairement aux bulletins internes, les bordereaux d'examen blanc destinés aux Délégations Départementales ne doivent comporter aucun code QR. Le format s'ajuste en A4 Portrait (jusqu'à 4 épreuves) ou A4 Paysage (dès 5 épreuves).",
        },
      },
    ],
  },
  {
    id: "chapitre-08",
    number: "08",
    title: "Bulletins, Relevés, Diplômes, Procès-Verbaux & Impression",
    icon: "workspace_premium",
    badge: "Actes Scolaires",
    link: "/pedagogie/bulletins",
    linkText: "Émettre Bulletins & Diplômes",
    summary: "Impression sans bug, pérennité à vie (snapshot), fonds officiels et légende des matières.",
    sections: [
      {
        title: "8.1 Comment Imprimer vos Documents sans Erreur ?",
        content: [
          "Lorsque vous cliquez sur « Consulter l'Acte » ou « Imprimer le PV » :",
          "1. Le document s'affiche dans la visionneuse sécurisée.",
          "2. Cliquez sur « Télécharger le PDF » : le fichier officiel scellé se télécharge immédiatement.",
          "3. Ouvrez le fichier téléchargé et imprimez-le directement avec votre imprimante habituelle.",
          "Cette méthode garantit une netteté vectorielle parfaite et évite tout blocage d'impression dans le logiciel.",
        ],
      },
      {
        title: "8.2 Règle de Pérennité Absolue : Vos Documents Identiques dans 10 Ans",
        content: [
          "CECO applique une technologie de Snapshot immuable :",
          "Dès qu'un bulletin, un relevé de notes ou un diplôme est émis, une copie exacte des données (notes, nom du directeur, logo, agrément de l'époque) est scellée en base.",
          "Même si vous changez de Directeur Général ou de logo dans 6 ans, ré-ouvrir le diplôme d'un ancien élève réaffichera EXACTEMENT le diplôme tel qu'il a été émis à l'époque !",
          "Si vous avez modifié des notes et souhaitez régénérer le document avec les nouvelles données, cliquez sur « Ré-émettre l'Acte ».",
        ],
      },
      {
        title: "8.3 Diplôme de Fin de Formation & Fonds Décoratifs Officiels",
        content: [
          "• Diplôme / Attestation de Réussite (A4 Paysage) : Fond doré officiel chargé automatiquement depuis les assets d'origine. Il s'affiche toujours avec une netteté de 100% (aucune atténuation).",
          "• Cartes d'Étudiant & Relevés Annuels : L'image de fond par défaut est chargée automatiquement à 100% d'opacité. Vous pouvez moduler l'opacité de 0% à 100% dans le Studio de Gabarits.",
        ],
      },
      {
        title: "8.4 Procès-Verbaux de Classe (PV de Semestre, PV Annuel, PV CC)",
        content: [
          "Les procès-verbaux de classe sont des documents collectifs au format A4 Paysage :",
          "• En-tête Interne Centré : Le logo du centre trône à gauche des textes et le bloc est parfaitement centré au milieu de la feuille sans retour à la ligne disgracieux.",
          "• Code Couleur de Décision : Les admis et validés s'affichent en VERT ÉMERAUDE (ADMIS, VALIDÉ, DIPLÔMÉ). Les ajournés et redoublants s'affichent en ROUGE.",
          "• Légende des Matières en Bas : Un cartouche au pied du PV détaille chaque code matière (ex: [GRA01] : Infographie 2D - Coef 4).",
        ],
      },
    ],
  },
  {
    id: "chapitre-09",
    number: "09",
    title: "Clôture de Session & Transition Annuelle Automatique",
    icon: "swap_horiz",
    badge: "Fin d'Année",
    link: "/academie/sessions",
    linkText: "Sessions & Transition",
    summary: "Clôture de session et promotion automatique des admis en niveau supérieur.",
    sections: [
      {
        title: "9.1 Procédure de Fin d'Année Scolaire",
        content: [
          "En fin d'année académique, après délibération de toutes les classes :",
          "1. Allez dans Structure Académique > Sessions & Transition.",
          "2. Créez d'abord la nouvelle session préparatoire (statut UPCOMING, ex: 2027-2028).",
          "3. Cliquez sur « Transition Annuelle » en sélectionnant la session sortante et la nouvelle session cible.",
          "4. Cliquez sur « Exécuter la Transition » :",
          "   - Les élèves ADMIS sont automatiquement promus au Niveau supérieur (ex: Niveau 1 ➔ Niveau 2).",
          "   - Les élèves REDOUBLANTS sont réinscrits au même niveau.",
          "   - Les élèves DIPLÔMÉS de fin de cursus sont scellés avec succès.",
          "   - L'ancienne session passe automatiquement au statut CLOSED (archivée et protégée en lecture seule).",
        ],
        callout: {
          type: "tip",
          title: "Zéro Ressaisie Manuelle",
          text: "Le moteur de transition vous évite de réinscrire manuellement les élèves qui passent en classe supérieure. En 3 secondes, toute votre rentrée scolaire est structurée.",
        },
      },
    ],
  },
  {
    id: "chapitre-10",
    number: "10",
    title: "Sauvegardes Quotidiennes (.zip) & Remplacement du Serveur en Panne",
    icon: "archive",
    badge: "Souveraineté & PRA",
    link: "/administration/sauvegardes",
    linkText: "Gérer les Sauvegardes",
    summary: "Sauvegardes quotidiennes sur clé USB et procédure de restauration sur une nouvelle machine.",
    sections: [
      {
        title: "10.1 La Règle d'Or Quotidienne : Exporter sur Clé USB",
        content: [
          "Chaque jour avant de fermer le centre de formation :",
          "1. Allez dans Administration > Sauvegardes & Continuité.",
          "2. Cliquez sur « Créer une Sauvegarde » : le système génère une archive compressée (.zip) contenant TOUTES les données de la base et TOUTES les photos des élèves.",
          "3. Cliquez sur « Exporter .zip » et copiez impérativement ce fichier sur une CLÉ USB externe ou un disque dur externe amovible.",
          "Ne laissez jamais la seule copie de secours sur l'ordinateur lui-même !",
        ],
      },
      {
        title: "10.2 Comment Faire si le PC Serveur est en Panne ou Cassé ?",
        content: [
          "Si votre ordinateur serveur grille, est volé ou tombe en panne définitive :",
          "1. Prenez n'importe quel nouvel ordinateur Windows, Mac ou Linux.",
          "2. Installez CECO Suite ERP et démarrez en Mode Serveur.",
          "3. Activez la licence pour ce nouvel ordinateur dans Administration > Licence.",
          "4. Allez dans Administration > Sauvegardes, cliquez sur « Importer Sauvegarde (.zip) » et sélectionnez votre archive de la clé USB.",
          "5. Cliquez sur « Restaurer » :",
          "   Moteur de Transplantation Souverain : CECO restaure l'ensemble de vos élèves, cours, notes, photos et historiques sur la nouvelle machine TOUT EN CONSERVANT LA LICENCE DU NOUVEAU POSTE sans aucun blocage !",
        ],
        callout: {
          type: "rule",
          title: "Garantie Anti-Sinistre",
          text: "Tant que vous possédez votre fichier de sauvegarde .zip sur votre clé USB, votre centre de formation est indestructible et peut redémarrer sur un nouveau PC en moins de 5 minutes.",
        },
      },
    ],
  },
  {
    id: "chapitre-11",
    number: "11",
    title: "Guide de Dépannage Rapide & Questions Fréquentes (FAQ)",
    icon: "help",
    badge: "Assistance",
    link: "/administration/licence",
    linkText: "Vérifier la Licence",
    summary: "Solutions immédiates aux 5 incidents les plus fréquents en exploitation.",
    sections: [
      {
        title: "11.1 Problème : « Le poste client ne trouve pas le serveur sur le réseau »",
        content: [
          "• Solution 1 : Vérifiez que l'ordinateur serveur est allumé et que le logiciel CECO y est ouvert.",
          "• Solution 2 : Assurez-vous que les deux ordinateurs sont bien connectés au même réseau Wi-Fi ou au même routeur.",
          "• Solution 3 : Sur le poste client, tapez directement l'adresse IP affichée sur le serveur (ex: 192.168.1.50:4000) et cliquez sur « Se connecter ».",
        ],
      },
      {
        title: "11.2 Problème : « La moyenne de délibération n'admet pas mon élève qui a 14/20 »",
        content: [
          "• Vérification 1 : Regardez la colonne « Alertes & Éliminatoires ». Si l'élève a une note inférieure à 08.00 / 20 dans une matière de spécialité éliminatoire, le système le bloque obligatoirement en ajourné (règle MINEFOP).",
          "• Vérification 2 : Vérifiez s'il ne manque pas des notes dans d'autres matières obligatoires. La moyenne divise par l'ensemble des matières prescrites de la classe.",
        ],
      },
      {
        title: "11.3 Problème : « L'application est en Mode Lecture Seule »",
        content: [
          "Votre période de licence est arrivée à échéance et le délai de grâce de 7 jours est dépassé.",
          "Vos données ne sont pas perdues : vous pouvez continuer à consulter et imprimer tous vos documents à vie.",
          "Pour réactiver les saisies : allez dans Administration > Licence, copiez votre Center ID et transmettez-le pour recevoir votre clé d'activation hors-ligne.",
        ],
      },
      {
        title: "11.4 Problème : « Ce matricule est déjà attribué »",
        content: [
          "Chaque matricule est unique. Si vous avez créé un élève avec ce matricule par erreur, retrouvez-le dans Scolarité > Apprenants et supprimez-le : comme il n'a aucune note, le matricule sera immédiatement libéré pour être réutilisé.",
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
          {/* HEADER DE RECHERCHE ET NAVIGATION RESPONSIVE */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border px-5 sm:px-6 py-3.5 flex-shrink-0 dark:border-border-dark bg-[#FAFBFD] dark:bg-[#07111D]">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-900 text-white shadow-xs dark:bg-brand-500 flex-shrink-0">
                <Icon name="menu_book" className="text-[22px]" />
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-body-md font-heading font-semibold text-ink-primary dark:text-white leading-tight truncate">
                    Manuel Opérationnel d'Exploitation CECO Suite ERP
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="brand" className="whitespace-nowrap">Aide [F1]</Badge>
                    <span className="hidden sm:inline-flex">
                      <Badge variant="neutral" className="whitespace-nowrap">v4.0.0</Badge>
                    </span>
                    <span className="hidden md:inline-flex">
                      <Badge variant="neutral" className="whitespace-nowrap">100% Hors-Ligne</Badge>
                    </span>
                  </div>
                </div>
                <p className="text-caption text-ink-muted truncate">
                  Manuel de procédures pour la Direction, le Secrétariat et les Formateurs (Normes MINEFOP).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0 w-full sm:w-auto justify-end">
              <div className="w-full sm:w-72">
                <Input
                  placeholder="Rechercher (ex: délibération, 8/20, webcam, PRA...)"
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
                <span>Sommaire des Procédures ({filteredChapters.length})</span>
                <span className="font-mono text-[10px]">11 Chapitres</span>
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

          {/* FOOTER : RACCOURCIS & CRÉDITS */}
          <div className="border-t border-border bg-[#FAFBFD] px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-caption text-ink-muted flex-shrink-0 dark:border-border-dark dark:bg-[#07111D]">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-mono font-semibold text-ink-primary dark:text-white">Raccourcis Système :</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-surface border font-mono text-[10px] font-bold">F1</kbd> Ouvrir/Fermer l'Aide</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-surface border font-mono text-[10px] font-bold">Ctrl+K</kbd> Recherche Rapide</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-surface border font-mono text-[10px] font-bold">Échap</kbd> Fermer</span>
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