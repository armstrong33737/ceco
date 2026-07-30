const path = require("path");
const { app } = require("electron");

// ------------------------------------------------------------------
// STRATÉGIE RETENUE (voir document technique consolidé, section 6) :
// - Version majeure de PostgreSQL FIGÉE pour toute la durée V0 -> V8.
//   Ne pas monter de version majeure sans plan de migration explicite.
// - Port dédié (5433) pour éviter tout conflit avec un Postgres
//   déjà installé sur la machine de l'utilisateur.
// - Arrêt TOUJOURS propre : jamais de kill brutal du processus.
// - Sauvegarde = pg_dump uniquement, jamais une copie du data dir.
//
// ⚠️ AVANT DE CONSTRUIRE DESSUS : valider ce module par le spike
// technique recommandé (install/start/stop/restart sur Windows et
// macOS, incluant un test d'arrêt brutal) — voir roadmap V0.
// ------------------------------------------------------------------

class PostgresManager {
  constructor({ port = 5433 } = {}) {
    this.port = port;
    this.dataDir = path.join(app.getPath("userData"), "pgdata");
    this.pg = null; // instance embedded-postgres, initialisée dans start()
  }

  async start() {
    // eslint-disable-next-line global-require
    const EmbeddedPostgres = require("embedded-postgres");
    const isFirstRun = !require("fs").existsSync(this.dataDir);

    this.pg = new EmbeddedPostgres({
      databaseDir: this.dataDir,
      port: this.port,
      user: "ceco",
      password: process.env.CECO_DB_PASSWORD || "ceco_local_dev",
      persistent: true,
    });

    await this.pg.initialise(); // no-op si déjà initialisé
    await this.pg.start();

    if (isFirstRun) {
      console.log("Premier démarrage PostgreSQL — exécuter les migrations Prisma ici.");
    }

    return { port: this.port, firstRun: isFirstRun };
  }

  async stop() {
    if (!this.pg) return;
    await this.pg.stop(); // arrêt propre obligatoire — jamais de kill direct
  }

  getConnectionUrl() {
    return `postgresql://ceco:${process.env.CECO_DB_PASSWORD || "ceco_local_dev"}@127.0.0.1:${this.port}/postgres`;
  }
}

module.exports = PostgresManager;
