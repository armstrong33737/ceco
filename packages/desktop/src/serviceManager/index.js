const PostgresManager = require("./postgresManager");

// ------------------------------------------------------------------
// Electron joue le rôle de gestionnaire de services (section 06 du
// document technique). Bascule individuelle prévue pour :
// API, DATABASE, BACKUP, DOCUMENTS, LICENSE.
// Séquence d'arrêt : Backup -> API -> PostgreSQL -> fermeture Electron.
// ------------------------------------------------------------------

class ServiceManager {
  constructor() {
    this.postgres = new PostgresManager();
    this.apiProcess = null; // child_process de l'API Express, démarré séparément
    this.status = {
      database: "stopped",
      api: "stopped",
      backup: "stopped",
    };
  }

  async startServer() {
    this.status.database = "starting";
    const { port } = await this.postgres.start();
    this.status.database = "running";

    // TODO V0 : démarrer l'API Express en child_process avec
    // DATABASE_URL = this.postgres.getConnectionUrl()
    this.status.api = "running";

    console.log(`Mode Serveur actif — PostgreSQL sur le port ${port}.`);
    return this.status;
  }

  async stopServer() {
    // Séquence contrôlée, jamais un arrêt brutal simultané.
    this.status.backup = "stopping";
    // TODO : déclencher une sauvegarde pg_dump avant extinction si configuré
    this.status.backup = "stopped";

    this.status.api = "stopping";
    if (this.apiProcess) this.apiProcess.kill("SIGTERM");
    this.status.api = "stopped";

    this.status.database = "stopping";
    await this.postgres.stop();
    this.status.database = "stopped";
  }

  getStatus() {
    return this.status;
  }
}

module.exports = ServiceManager;
