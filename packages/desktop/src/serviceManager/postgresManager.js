const path = require("path");
const { app } = require("electron");
const fs = require("fs");

// ------------------------------------------------------------------
// STRATÉGIE RETENUE (voir document technique consolidé, section 6) :
// - Version majeure de PostgreSQL FIGÉE pour toute la durée V0 -> V8.
//   Ne pas monter de version majeure sans plan de migration explicite.
// - Port dédié (5433) pour éviter tout conflit avec un Postgres
//   déjà installé sur la machine de l'utilisateur.
// - Arrêt TOUJOURS propre : jamais de kill brutal du processus.
// - Sauvegarde = pg_dump uniquement, jamais une copie du data dir.
//
// NOTE IMPORTANTE (retenue après debug) : embedded-postgres ne détecte pas
// tout seul, à partir d'une nouvelle instance JS, qu'un cluster existe déjà
// sur disque. Il faut explicitement lui dire de sauter initdb via
// `isInitialised = true` quand PG_VERSION est déjà présent — sinon il
// relance initdb à CHAQUE démarrage, y compris sur un dossier valide, ce
// qui échoue avec "directory exists but is not empty".
// ------------------------------------------------------------------

class PostgresManager {
  constructor({ port = 5433 } = {}) {
    this.port = port;
    this.dataDir = path.join(app.getPath("userData"), "pgdata");
    this.pg = null; // instance embedded-postgres, initialisée dans start()
  }

  async start() {
    // embedded-postgres est un module ESM pur — require() est impossible
    // depuis un fichier CommonJS, il faut un import() dynamique.
    const { default: EmbeddedPostgres } = await import("embedded-postgres");

    // PG_VERSION est créé par Postgres uniquement quand initdb se termine
    // avec succès. Un dossier présent MAIS sans ce fichier signifie qu'un
    // précédent démarrage a été interrompu (crash, coupure, kill brutal).
    const hasCompletedInit = fs.existsSync(path.join(this.dataDir, "PG_VERSION"));

    if (fs.existsSync(this.dataDir) && !hasCompletedInit) {
      console.warn(
        `Dossier de données Postgres incomplet ou corrompu détecté (${this.dataDir}) — ` +
        "nettoyage automatique avant réinitialisation."
      );
      fs.rmSync(this.dataDir, { recursive: true, force: true });
    }

    const isFirstRun = !fs.existsSync(this.dataDir);

    this.pg = new EmbeddedPostgres({
      databaseDir: this.dataDir,
      port: this.port,
      user: "ceco",
      password: process.env.CECO_DB_PASSWORD || "ceco_local_dev",
      persistent: true,
    });

    // Cluster déjà initialisé sur disque -> on saute initdb explicitement.
    // Sinon -> première initialisation réelle.
    if (hasCompletedInit) {
      this.pg.isInitialised = true;
    } else {
      await this.pg.initialise();
    }

    await this.pg.start();

    if (isFirstRun) {
      console.log("Premier démarrage PostgreSQL — exécuter les migrations Prisma ici.");
    }

    return { port: this.port, firstRun: isFirstRun };
  }

  async stop() {
    if (!this.pg) return;
    try {
      await this.pg.stop(); // arrêt propre obligatoire — jamais de kill direct
    } catch (err) {
      console.error(
        "PostgresManager.stop() a échoué — vérifiez que 'pnpm approve-builds' " +
        "a bien été exécuté pour embedded-postgres. Erreur :",
        err
      );
      throw err;
    }
  }

  getConnectionUrl() {
    return `postgresql://ceco:${process.env.CECO_DB_PASSWORD || "ceco_local_dev"}@127.0.0.1:${this.port}/postgres`;
  }
}

module.exports = PostgresManager;