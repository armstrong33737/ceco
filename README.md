# CECO Suite ERP — Gestion des Centres de Formation Professionnelle

**Version :** 4.0.0 Stable (Mode On-Premise, Réseau Local LAN & Socle Cloud-Ready)  
**Conformité Institutionnelle :** Ministère de l'Emploi et de la Formation Professionnelle (MINEFOP - République du Cameroun) & Acte Uniforme OHADA  
**Plateformes Cibles :** Windows (NSIS `.exe`), macOS (DMG `.dmg`), Linux (`AppImage`)

---

## 1. Présentation & Vision Métier

**CECO Suite ERP** est un progiciel de gestion intégré de niveau industriel développé pour répondre aux exigences administratives, pédagogiques, juridiques et financières des centres de formation professionnelle au Cameroun et en Afrique subsaharienne.

Conçu selon le paradigme **Souveraineté & Offline-First**, il garantit une continuité opérationnelle absolue sans dépendance obligatoire à Internet :
- **Mode Serveur Principal (On-Premise) :** L'établissement héberge sa propre base relationnelle PostgreSQL 17 embarquée sur un poste centralisé (port TCP isolé 5433), avec gestionnaire de processus atomique (*Tout ou Rien*).
- **Mode Client Réseau (Poste Secondaire) :** Découverte réseau automatique par balayage asynchrone sur le sous-réseau local (port TCP 4000) pour connecter le secrétariat, la direction des études et les salles de professeurs.
- **Sceau Cryptographique & Anti-Fraude :** Licences locales asymétriques Ed25519, détection de falsification temporelle de l'horloge système et certification des actes par QR Code compact sécurisé par signature HMAC SHA-256 (< 150 caractères).
- **Pérennité Documentaire Absolue :** Conservation des snapshots d'actes scellés permettant de rééditer un diplôme, un bulletin ou un relevé à l'identique même 6 ans après, indépendamment des modifications ultérieures de l'établissement.

---

## 2. Architecture Technique & Piles Logicielles

| Couche | Technologie retenue | Justification d'Ingénierie |
| :--- | :--- | :--- |
| **Moteur de Données** | PostgreSQL 17.10 Embarqué | Port dédié 5433 (zéro conflit avec un Postgres système hôte). Persistance ACID complète. |
| **Couche d'Accès Données** | Prisma ORM 5.20 | Typage strict, migrations versionnées (`prisma migrate deploy`) et isolation multi-tenant par `centerId`. |
| **API Backend** | Node.js 20 LTS & Express 4 | Contrôleurs découplés, validation Zod, limitation des uploads et streaming binaire. |
| **Conteneur Bureau** | Electron 31 (Multi-processus) | Wrapper applicatif avec pont IPC sécurisé (`contextBridge`), menu Tray et Service Manager résilient. |
| **Interface Utilisateur** | React 18, Vite 5, Tailwind CSS | Design System *Border-First*, Framer Motion (100ms instant enterprise), mode sombre/clair natif. |
| **Moteur PDF Vectoriel** | PDFKit Natif | Zéro dépendance Chromium/Puppeteer. Rendu vectoriel ultra-léger et déterministe. |
| **Contrôle Cryptographique** | Node.js Crypto (Ed25519 & HMAC) | Signatures asymétriques de licence et condensés compacts pour QR codes scellés. |

---

## 3. Structure du Monorepo

Le projet est organisé sous forme de workspace `pnpm` monorepo avec liaison à plat (`node-linker=hoisted`) pour garantir la stabilité du packaging Electron :

```text
ceco/
  ├── .github/
  │   └── workflows/
  │       └── build-desktop.yml      # Pipeline CI/CD multi-OS (Windows, macOS, Linux)
  ├── packages/
  │   ├── backend/                   # Serveur Express, ORM Prisma, Services PDF, Cryptographie
  │   │   ├── assets/                # Polices cursives (.ttf), sceaux et fonds officiels
  │   │   ├── prisma/                # Schéma relationnel, migrations et seed d'usine
  │   │   ├── scripts/               # Générateur de licences asymétriques Ed25519
  │   │   └── src/
  │   │       ├── middleware/        # TenantResolver, LicenceGuard, Auth, RBAC, AcademicYearGuard
  │   │       ├── routes/            # 12 contrôleurs REST modulaires
  │   │       ├── services/pdf/      # Moteur PDF (communs vectoriels et 7 générateurs d'actes)
  │   │       └── storage/           # Gestionnaire d'arborescence physique scopée
  │   ├── desktop/                   # Conteneur Electron, Service Manager & Setup réseau
  │   │   ├── assets/                # Icônes système, tray et licence CLUF
  │   │   └── src/
  │   │       ├── serviceManager/    # Gestionnaire PostgreSQL & processus Express (Tout ou Rien)
  │   │       ├── setup/             # Interface de sélection Serveur/Client & découverte LAN
  │   │       └── main.js            # Processus principal Electron et cycle de vie
  │   └── frontend/                  # Application React 18 SPA (Vite)
  │       └── src/
  │           ├── app/               # Coquille d'application (Topbar, Sidebar, Omnibar Ctrl+K)
  │           ├── components/        # Manuel F1 (11 chapitres), visionneuse PDF, modals
  │           ├── design-system/     # Primitives UI, Data-Grid, formulaires, tiroirs et alertes
  │           └── modules/           # Modules métier (Académie, Scolarité, Pédagogie, Examens Blancs, Admin)
  ├── .npmrc                         # Configuration node-linker=hoisted
  ├── package.json                   # Scripts racine du workspace
  └── pnpm-workspace.yaml            # Déclaration des paquets du monorepo
```

---

## 4. Prérequis & Installation Développeur

### 4.1 Prérequis Système
- **Node.js :** Version `>= 20.x LTS`
- **pnpm :** Version `>= 9.x`
- **Système d'Exploitation :** Windows 10/11 (x64), macOS 12+ (x64/Apple Silicon) ou Linux Ubuntu 20.04+ (x64)

### 4.2 Initialisation du Projet
À la racine du projet :

```bash
# 1. Installation des dépendances du monorepo
pnpm install

# 2. Compilation obligatoire du client Prisma (Typage et génération binaire)
pnpm prisma:generate

# 3. Configuration de l'environnement local
cd packages/backend
cp .env.example .env
```

### 4.3 Commandes de Démarrage en Développement

Pour lancer les modules individuellement ou conjointement :

```bash
# Lancement de l'API Backend Express (Port 4000)
pnpm dev:backend

# Lancement de l'interface Frontend Vite (Port 5173)
pnpm dev:frontend

# Lancement du conteneur Bureau Desktop Electron (PostgreSQL embarqué + Application)
pnpm dev:desktop
```

**Identifiants administrateur initialisés par défaut :**
- **Email :** `admin@local.ceco`
- **Mot de passe :** `admin123`

---

## 5. Modules Fonctionnels Réalisés (v4.0.0)

### 5.1 Infrastructure & Démarrage Atomique « Tout ou Rien »
- **Gestionnaire `ServiceManager` résilient :** Séquence de démarrage ordonnée : `PostgresManager (5433)` -> `Prisma Migrations` -> `Idempotent Seed` -> `Express API (4000)` -> `Wait for /health`.
- **Arrêt d'urgence systématique :** Si une seule sous-étape échoue (port déjà occupé, migration corrompue), tous les processus sont immédiatement et proprement arrêtés pour éviter les processus PostgreSQL zombies.

### 5.2 Sécurité, Rôles RBAC & Licence Asymétrique Ed25519
- **Contrôle d'accès granulaire :** Permissions modulaires (`read`, `create`, `update`, `delete`, `validate`, `generate`).
- **Rôles système protégés (`isSystem: true`) :** *Admin*, *Directeur des Études*, *Secrétaire*, *Formateur* possèdent un socle d'habilitations garanti inaliénable (règle d'augmentation des droits).
- **Protection cryptographique :** Licences hors-ligne inviolables signées par clé asymétrique Ed25519 (256 bits). Période de grâce de 7 jours à l'échéance, suivie d'un basculement en mode consultation et impression (*Lecture Seule*).
- **Garde temporelle (Clock Tampering Guard) :** Détection automatique des manipulations rétroactives de l'horloge du système d'exploitation.

### 5.3 Structure Académique & Cycle de Vie des Sessions (MINEFOP)
- **Cycles professionnels :** DQP (Qualification), CQP (Spécialisation), BQP, ou cycles sur-mesure.
- **Filières pluriannuelles :** Durées officielles de 1 à 3 ans avec auto-génération immédiate des Niveaux d'études (Niveau 1, 2, 3).
- **Règle ministérielle de durée de session :** Obligation stricte de couvrir au minimum **8 mois (240 jours)** et au maximum 14 mois.
- **Machine d'états d'une session :** `UPCOMING` (Préparatoire) -> `CURRENT` (Active) -> `CLOSED` (Clôturée/Scellée en lecture seule).

### 5.4 Registre des Apprenants, Inscriptions & Badges CR80
- **Patron de matricule paramétrable :** Format personnalisable (`{CTR}-{FIL}{YY}-{NUM4}`) avec résolution transactionnelle anti-collision en base.
- **Studio Photo intégré :** Recadrage carré portrait 4:4 haute netteté et capture directe par Webcam.
- **Importation massive CSV :** Détection des anomalies de lignes et génération automatique des matricules manquants.
- **Tirage de planches A4 :** Impression de planches de 8 badges recto/verso au format standard CR80 (85.6 x 53.98 mm) avec repères de coupe massicot et opacité réglable de 0% à 100%.

### 5.5 Organisation Pédagogique & Saisie Matricielle des Notes
- **Catalogue normalisé :** Codes matières stricts à 5 caractères majuscules (ex: `THM01`, `GRA02`).
- **Groupes éliminatoires :** Seuil éliminatoire automatique sur note annuelle < 08.00 / 20 en compétences de spécialité.
- **Espace Formateur dédié :** Accès direct en un clic aux cours assignés sans exposition aux réglages administratifs.
- **Grille de saisie type tableur :** Navigation fluide au clavier (Flèches, Entrée), bornage strict [0.00 – 20.00], qualification des absences via la touche **« M »** (Justifiée = exemptée, Injustifiée = 0.00 / 20).
- **Session de rattrapage :** Remplacement automatique de la note d'examen si la note de rattrapage est supérieure.

### 5.6 Jurys de Délibération & Transition Annuelle Automatique
- **Délibérations semestrielles et annuelles :** Calcul automatique des points pondérés, moyennes, rangs et seuils d'admission (>= 10.00 / 20).
- **Délibération globale en 1 clic :** Calcul et scellement des décisions de toutes les classes de la session active en une seule opération.
- **Moteur de transition de fin d'année :** Promotion automatique des admis au Niveau supérieur (N+1), réinscription des redoublants au Niveau N, et scellement avec mention des diplômés de dernière année.

### 5.7 Module Régional des Examens Blancs (MINEFOP)
- **Architecture miroir indépendante :** Référentiel des épreuves d'examen blanc (EPP, MSP, EPT, EPS, LÉG...) et maquettes par filière.
- **Enrôlement strict des classes terminales :** Seules les classes sortantes (`niveau.order >= durationInYears`) sont candidates.
- **Portée d'enrôlement dynamique :** Sélection automatique basée sur n'importe quel cycle réel de l'établissement (DQP, CQP, etc.).
- **Commutateur d'éligibilité :** Possibilité de disqualifier un candidat de l'examen blanc sans altérer sa scolarité normale.
- **Clôture formelle de session :** Verrouillage en cascade de toute la session et de ses bordereaux.
- **Actes régionaux de délégation :** Bordereaux fermés sans QR code (conforme tutelle MINEFOP), feuilles d'émargement examinateur, bordereau vierge de jury et **Recueil Unique Compilé de Session** (toutes classes en un seul PDF multipages).

### 5.8 Édition Documentaire, Pérennité par Snapshot & QR Code Compact
- **Ségrégation stricte du stockage :**
  - *Actes Légaux Pérennes* (`/archive`) : Bulletins Semestriels, Relevés Annuels (Transcripts), Attestations de Fin de Formation, Certificats de Scolarité, Cartes d'Apprenant.
  - *Documents de Travail Temporaires* (`/temp`) : Bordereaux vierges, feuilles d'émargement, procès-verbaux de classe.
- **Pérennité par Snapshot :** Recréation physique à l'identique même après des années à partir du snapshot stocké en base, sans altération par les modifications futures du centre (logo, directeur, agrément).
- **Procès-Verbaux de classe :** En-tête interne d'établissement centré (disposition côte à côte), filigrane logo uniquement, et **Légende exhaustive des codes matières au pied du document**.
- **Attestation de Fin de Formation (Diplôme) :** Format A4 Paysage noble, dorures et ruban officiels, netteté garantie à 100% (sans affaiblissement d'opacité) et calligraphie cursive.
- **Certification QR Code compact :** Condensé textuel < 150 caractères lisible instantanément par tout smartphone hors-ligne.

### 5.9 Plan de Reprise d'Activité (PRA) & Restauration Multi-Instance
- **Format d'Archive Hybride (.zip zlib 9) :** Dump JSON structuré complet + arborescence physique des médias (`/storage`).
- **Moteur de Transplantation Relationnelle :** Restauration sécurisée sur une machine neuve avec réassignation automatique de l'ancien `centerId` vers le nouvel identifiant hôte, préservation intacte de la licence Ed25519 de la nouvelle machine et réinitialisation à chaud du cache tenant.

### 5.10 Manuel Opérationnel d'Exploitation Intégré (Touche F1)
- Accessible depuis n'importe quel écran via la touche **F1** ou le bouton Topbar.
- 11 chapitres opérationnels détaillés (SOP), moteur de recherche plein texte, encadrés sémantiques réglementaires MINEFOP, modèles CSV et boutons de bascule directe vers les modules applicatifs.

---

## 6. Compilation & Publication des Installateurs Desktop

La compilation d'un installateur exécutable complet s'opère via `electron-builder` en intégrant les ressources empaquetées (`extraResources`) :

```bash
# Compilation complète de production (Prisma Client + Bundles Backend + Build Frontend + Installateur OS)
pnpm --filter @ceco/desktop run build:installer
```

Les exécutables générés se trouvent dans `packages/desktop/dist/` :
- **Windows :** `CECO Suite ERP Setup 4.0.0.exe` (Installateur NSIS avec choix de répertoire et raccourcis)
- **macOS :** `CECO Suite ERP-4.0.0.dmg`
- **Linux :** `CECO Suite ERP-4.0.0.AppImage`

---

## 7. Feuille de Route Évolutive du Progiciel

| Version | Statut | Jalons Réalisés & Objectifs |
| :---: | :---: | :--- |
| **v1.0.0** | Validé | Socle local PostgreSQL 17 embarqué, setup réseau Serveur/Client, licence d'évaluation 60j, RBAC basique. |
| **v2.0.0** | Validé | Structure académique, filières pluriannuelles, gestion des apprenants, studio photo webcam, badges CR80. |
| **v3.0.0** | Validé | Pédagogie, référentiel matières (codes 5 car.), saisie matricielle, gestion des absences (M), pondérations CC/Exam. |
| **v4.0.0** | **Actuel** | **Examens Blancs MINEFOP complets, délibérations souveraines, transition annuelle, archivage PRA multi-machines, moteur PDF pérenne par snapshot, PVs avec légende et manuel F1.** |
| **v5.0.0** | Prévu | Gestion des stages professionnels (entreprises partenaires, conventions types MINEFOP, carnets de stage). |
| **v6.0.0** | Prévu | Gestion financière intégrée (échéanciers de scolarité, encaissements, reçus de caisse thermiques et balance comptable). |
| **v7.0.0+**| Prévu | Déploiement Cloud Hybride (synchronisation chiffrée centre local -> serveur distant centralisateur ministériel). |

---

## 8. Mentions Légales & Propriété Intellectuelle

**CECO Suite ERP** est une œuvre protégée par les conventions internationales de propriété intellectuelle et les dispositions de l'Organisation Africaine de la Propriété Intellectuelle (OAPI).

- **Auteur-Concepteur :** Armstrong Euclador NGALEU  
- **Contact & Support :** `armstrongngaleu3@gmail.com`  
- **Portfolio & Référence :** [https://armstrongngaleu.netlify.app](https://armstrongngaleu.netlify.app)  
- **Copyright :** © 2026 Armstrong Euclador NGALEU. Tous droits réservés. Version 4.0.0.