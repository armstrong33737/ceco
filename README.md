# CECO — ERP de Gestion des Centres de Formation Professionnelle

**Version :** 1.0.0-v1 (Mode On-Premise & Socle Multi-Tenant)  
**Plateformes supportées :** Windows (NSIS `.exe`), macOS (DMG `.dmg`), Linux (`AppImage`)

---

## 1. Présentation du projet

**CECO** est un progiciel de gestion intégré (ERP) développé pour structurer et automatiser l'administration, le suivi pédagogique, les évaluations et la gestion financière des centres de formation professionnelle.

L'application est conçue pour fonctionner selon deux modes complémentaires :
- **Mode Local (On-Premise) :** L'établissement héberge sa propre base de données PostgreSQL embarquée sur une machine locale, sans dépendance obligatoire à Internet.
- **Mode Client / Réseau :** Les postes du personnel se connectent automatiquement au serveur local via détection automatique sur le réseau local (LAN).
- **Socle SaaS-Ready :** L'ensemble du schéma et des contrôleurs intègre l'isolation stricte par `centerId` pour permettre une migration directe vers le Cloud sans réécriture.

---

## 2. Structure du Monorepo

Le projet est structuré sous forme de monorepo `pnpm workspace` :

```text
ceco/
  ├── backups/         # Répertoire physique des archives de sauvegarde (.zip)
  ├── packages/
  │   ├── backend/     # API REST Express + Prisma ORM (RBAC, licence, sauvegardes)
  │   ├── desktop/     # Application Electron (PostgreSQL 17 embarqué, Service Manager)
  │   └── frontend/    # Interface React 18 + Tailwind CSS + Zustand (HashRouter)
  ├── storage/         # Stockage scopé des médias (logos, photos, documents)
  ├── .npmrc           # Configuration node-linker=hoisted pour packaging stable
  └── pnpm-workspace.yaml
```

---

## 3. Prérequis système

- **Node.js :** Version `>= 20.x`
- **Gestionnaire de paquets :** `pnpm` version `>= 9.x`
- **Système d'exploitation :** Windows 10/11, macOS 12+ ou Linux (Ubuntu 20.04+, Debian, Fedora...)

---

## 4. Démarrer en développement

### 4.1. Installation des dépendances
À la racine du dépôt :
```bash
pnpm install
```

### 4.2. Initialisation de la base de données et de l'API
```bash
cd packages/backend
cp .env.example .env

# Génération du client Prisma et application des migrations
pnpm prisma:generate
pnpm prisma:migrate

# Peuplement initial (création du centre local, des rôles et du compte admin)
pnpm prisma:seed

# Démarrage de l'API Express sur http://localhost:4000
pnpm dev
```

**Identifiants créés par défaut par le seed :**
- **Email :** `admin@local.ceco`
- **Mot de passe :** `admin123`

### 4.3. Démarrage de l'interface Frontend
Dans un autre terminal :
```bash
cd packages/frontend
pnpm dev # Démarre sur http://localhost:5173
```

### 4.4. Démarrage du client Desktop Electron
Dans un autre terminal :
```bash
cd packages/desktop
pnpm dev
```

---

## 5. Fonctionnalités V1 Opérationnelles

- **Sélecteur de mode au démarrage (`setup.html`) :**
  - *Mode Serveur :* Démarrage autonome de PostgreSQL 17 embarqué, application automatique des migrations Prisma, initialisation du seed et lancement de l'API Express locale.
  - *Mode Client :* Découverte réseau automatique par balayage asynchrone des adresses IP locales sur le port 4000 (`/health`), avec saisie manuelle en repli.
- **Sécurité & Contrôle d'accès (RBAC) :**
  - Matrice granulaire d'habilitations (Lire, Créer, Modifier, Supprimer, Générer) par module.
  - Rôle Admin protégé avec droits universels (`*`), profils Secrétaire et Formateur librement modifiables.
- **Gestion de la Licence locale :**
  - Attribution automatique de 2 mois d'évaluation gratuite (60 jours) lors de l'initialisation du centre.
  - Module de rechargement par simulation de paiement Mobile Money (MTN MoMo et Orange Money Cameroun).
  - Écran de verrouillage global interactif en cas d'expiration de la licence.
- **Moteur de Sauvegarde & Restauration :**
  - Génération d'archives autonomes compressées `.zip` (dump structuré PostgreSQL + fichiers médias `/storage`).
  - Restauration transactionnelle sécurisée (`TRUNCATE CASCADE`) avec ré-injection ordonnée des données relationnelles.

---

## 6. Compilation et Publication des Installateurs

### 6.1. Compilation locale
Pour générer les installateurs de production :
```bash
pnpm --filter @ceco/desktop run build:installer
```

Les fichiers exécutables sont générés dans `packages/desktop/dist/` :
- **Windows :** `CECO Setup 1.0.0.exe` (Installateur NSIS avec choix du répertoire)
- **macOS :** `CECO-1.0.0.dmg`
- **Linux :** `CECO-1.0.0.AppImage`

### 6.2. Pipeline d'intégration continue (GitHub Actions)
La création et l'envoi d'un tag Git déclenchent automatiquement la compilation multi-OS et la publication d'une Release GitHub complète :
```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 7. Feuille de Route Produit (V0 → V11)

| Version | Module / Objectif | Description |
| :--- | :--- | :--- |
| **V0** | Fondation technique | Multi-tenant (`centerId`), stockage scopé, modélisation académique. |
| **V1** | Installation & Paramètres | **(Actuel)** Mode Serveur/Client, licence 60j, sauvegardes .zip, RBAC. |
| **V2** | Formations & Apprenants | Filières, promotions, inscriptions annuelles, fiches et cartes étudiants. |
| **V3** | Gestion Pédagogique | Matières par semestre, saisie des CC/examens, politiques de pondération. |
| **V4** | Bulletins & Diplômes | PV de délibération, relevés semestriels/annuels, diplômes et QR codes. |
| **V5** | Gestion des Stages | Entreprises partenaires, encadreurs, conventions et attestations. |
| **V6** | Gestion Financière | Échéanciers de scolarité, encaissements, reçus et comptabilité légère. |
| **V7** | Administration Avancée | Journaux d'audit, notifications SMS/Email, tableaux de bord statistiques. |
| **V8-V9** | CECO Cloud (SaaS) | Multi-tenant par sous-domaine, passerelles de paiement, portail d'inscription. |
| **V10-V11**| Marketplace & Mobile | Plugins d'extension, APIs publiques et applications mobiles dédiées. |

---

## 8. Mentions légales

© 2026 CECO Africa. Tous droits réservés.  
Pour toute assistance technique ou documentation complémentaire, consultez [ceco.africa](https://ceco.africa).
