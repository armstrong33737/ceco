# CECO — Squelette V0

Ce dépôt est le point de départ concret du projet CECO, tel que défini dans le
document technique consolidé. Toutes les décisions de fondation y sont déjà
câblées : multi-tenant (`centerId`), stockage scopé par centre, modélisation
académique non-destructive, moteur de documents générique, et gestion de
services PostgreSQL embarqué.

## Structure

```
ceco/
  packages/
    backend/     Express + Prisma — API métier, tenant resolver, repositories scopés
    frontend/    React + Vite + Tailwind — interface, charte graphique déjà câblée
    desktop/     Electron — Service Manager (PostgreSQL embarqué, cycle de vie)
```

## Démarrer en développement

### 1. Installer les dépendances

```bash
pnpm install
```

### 2. Backend — base de données et migrations

⚠️ **Avant tout** : ce squelette suppose un PostgreSQL déjà accessible en local
pour le développement (le PostgreSQL *embarqué* piloté par Electron est pour la
version packagée finale — voir `packages/desktop/src/serviceManager`).

```bash
cd packages/backend
cp .env.example .env      # ajustez DATABASE_URL si besoin
pnpm prisma:generate
pnpm prisma:migrate       # crée les tables à partir de prisma/schema.prisma
pnpm prisma:seed          # crée le centre local par défaut + compte admin
pnpm dev                  # démarre l'API sur http://localhost:4000
```

Identifiants créés par le seed : `admin@local.ceco` / `admin123` — à changer
immédiatement dans une vraie installation.

### 3. Frontend

```bash
cd packages/frontend
pnpm dev                  # démarre sur http://localhost:5173
```

### 4. Desktop (Electron) — optionnel en développement web pur

```bash
cd packages/desktop
pnpm dev
```

## Prochaines étapes (voir feuille de route V0 → V11)

1. Valider le spike PostgreSQL embarqué (install/start/stop/restart, Windows
   et macOS, y compris un arrêt brutal suivi d'un redémarrage).
2. Construire l'authentification JWT + RBAC sur ce squelette avant toute
   route métier.
3. Brancher les premières routes CRUD (apprenants, filières, classes) via
   `scopedRepository` — jamais un accès Prisma direct dans un controller.
4. Implémenter le moteur `DocumentTemplate` / `Document` pour le premier
   type de document (fiche d'inscription ou carte étudiant).

Toute décision d'architecture détaillée (pourquoi `centerId` partout, pourquoi
`SubjectOffering` plutôt qu'un champ `active` sur `Subject`, stratégie
PostgreSQL, charte graphique) est documentée dans le document technique
consolidé fourni séparément.
