// packages/desktop/src/serviceManager/index.js
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const { execFile, spawn } = require("child_process");
const { app } = require("electron");
const PostgresManager = require("./postgresManager");

const PRISMA_SCHEMA_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "backend/prisma/schema.prisma")
  : path.join(__dirname, "../../../backend/prisma/schema.prisma");

const BACKEND_ENTRY = app.isPackaged
  ? path.join(process.resourcesPath, "backend/server.bundle.js")
  : path.join(__dirname, "../../../backend/src/index.js");

const SEED_ENTRY = app.isPackaged
  ? path.join(process.resourcesPath, "backend/seed.bundle.js")
  : path.join(__dirname, "../../../backend/prisma/seed.js");

const API_PORT = Number(process.env.CECO_API_PORT) || 4000;

function getUnpackedPrismaPaths() {
  if (!app.isPackaged) {
    let cliPath = null;
    try {
      cliPath = require.resolve("prisma/build/index.js");
    } catch {
      cliPath = null;
    }
    return { cliPath, engineBinary: undefined };
  }

  const baseUnpacked = path.join(process.resourcesPath, "app.asar.unpacked", "node_modules");
  const cliPath = path.join(baseUnpacked, "prisma", "build", "index.js");
  const enginesDir = path.join(baseUnpacked, "@prisma", "engines");

  let engineBinary = undefined;
  if (fs.existsSync(enginesDir)) {
    const files = fs.readdirSync(enginesDir);
    const file = files.find(
      (f) => f.startsWith("schema-engine") || f.startsWith("migration-engine")
    );
    if (file) {
      engineBinary = path.join(enginesDir, file);
    }
  }

  return { cliPath, engineBinary };
}

function runMigrations(databaseUrl) {
  return new Promise((resolve, reject) => {
    const { cliPath, engineBinary } = getUnpackedPrismaPaths();

    const env = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      ELECTRON_RUN_AS_NODE: "1",
      ...(engineBinary && { PRISMA_SCHEMA_ENGINE_BINARY: engineBinary }),
    };

    if (cliPath && fs.existsSync(cliPath)) {
      execFile(
        process.execPath,
        [cliPath, "migrate", "deploy", "--schema", PRISMA_SCHEMA_PATH],
        { env },
        (error, stdout, stderr) => {
          if (error) {
            console.error("Échec des migrations Prisma :", stderr || error.message);
            return reject(new Error(`Migrations Prisma échouées : ${stderr || error.message}`));
          }
          console.log("Migrations Prisma appliquées avec succès :\n", stdout);
          resolve();
        }
      );
    } else {
      const isWin = process.platform === "win32";
      execFile(
        isWin ? "npx.cmd" : "npx",
        ["prisma", "migrate", "deploy", "--schema", PRISMA_SCHEMA_PATH],
        {
          env,
          shell: isWin,
        },
        (error, stdout, stderr) => {
          if (error) {
            console.error("Échec des migrations Prisma :", stderr || error.message);
            return reject(new Error(`Migrations Prisma échouées : ${stderr || error.message}`));
          }
          console.log("Migrations Prisma appliquées avec succès :\n", stdout);
          resolve();
        }
      );
    }
  });
}

function runSeed(databaseUrl, storageRoot) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [SEED_ENTRY],
      {
        cwd: path.dirname(SEED_ENTRY), // Résout toujours depuis packages/backend/prisma
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          CECO_STORAGE_ROOT: storageRoot,
          ELECTRON_RUN_AS_NODE: "1",
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("Échec du seed d'installation :", stderr || error.message);
          return reject(new Error(`Seed d'installation échoué : ${stderr || error.message}`));
        }
        console.log("Seed d'installation vérifié :\n", stdout);
        resolve();
      }
    );
  });
}

function getOrCreateJwtSecret() {
  const secretDir = path.join(app.getPath("userData"), "secrets");
  const secretPath = path.join(secretDir, "jwt.key");
  if (!fs.existsSync(secretDir)) fs.mkdirSync(secretDir, { recursive: true });
  if (!fs.existsSync(secretPath)) {
    fs.writeFileSync(secretPath, crypto.randomBytes(64).toString("hex"), { mode: 0o600 });
  }
  return fs.readFileSync(secretPath, "utf-8").trim();
}

function waitForApiReady(port, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on("error", retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("L'API Express locale n'a pas répondu dans le délai imparti (15s)."));
      }
      setTimeout(check, 300);
    };
    check();
  });
}

function startApiProcess({ databaseUrl, storageRoot, jwtSecret }) {
  const child = spawn(process.execPath, [BACKEND_ENTRY], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      CECO_MODE: "local",
      CECO_API_PORT: String(API_PORT),
      CECO_STORAGE_ROOT: storageRoot,
      JWT_SECRET: jwtSecret,
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (d) => console.log(`[API] ${d.toString().trim()}`));
  child.stderr.on("data", (d) => console.error(`[API] ${d.toString().trim()}`));
  child.once("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`L'API Express s'est arrêtée avec le code ${code}.`);
    }
  });

  return child;
}

class ServiceManager {
  constructor() {
    this.postgres = new PostgresManager();
    this.apiProcess = null;
    this.status = {
      database: "stopped",
      migrations: "stopped",
      seed: "stopped",
      api: "stopped",
      backup: "stopped",
    };
  }

  /**
   * Séquence atomique de démarrage "Tout ou Rien".
   * En cas d'échec sur une seule sous-étape, arrêt d'urgence immédiat de tous les composants
   * pour éviter tout processus orphelin ou verrouillage de port.
   */
  async startServer() {
    let pgPort = 5433;
    try {
      this.status.database = "starting";
      const pgRes = await this.postgres.start();
      pgPort = pgRes.port;
      this.status.database = "running";

      const storageRoot = path.join(app.getPath("userData"), "storage");

      this.status.migrations = "running";
      await runMigrations(this.postgres.getConnectionUrl());
      this.status.migrations = "done";

      this.status.seed = "running";
      await runSeed(this.postgres.getConnectionUrl(), storageRoot);
      this.status.seed = "done";

      this.status.api = "starting";
      const jwtSecret = getOrCreateJwtSecret();

      this.apiProcess = startApiProcess({
        databaseUrl: this.postgres.getConnectionUrl(),
        storageRoot,
        jwtSecret,
      });

      await waitForApiReady(API_PORT);
      this.status.api = "running";

      console.log(`✓ Mode Serveur initialisé avec succès — PostgreSQL:${pgPort}, API:${API_PORT}.`);
      return { ...this.status, pgPort, apiPort: API_PORT };
    } catch (err) {
      console.error("❌ Échec critique lors du démarrage des services. Déclenchement de l'arrêt d'urgence 'Tout ou Rien' :", err.message);
      await this.stopServer().catch((cleanupErr) => {
        console.warn("Avertissement lors du nettoyage d'urgence des services :", cleanupErr.message);
      });
      throw err;
    }
  }

  async stopServer() {
    this.status.backup = "stopping";
    this.status.backup = "stopped";

    this.status.api = "stopping";
    if (this.apiProcess) {
      await new Promise((resolve) => {
        const proc = this.apiProcess;
        let isResolved = false;

        const onExit = () => {
          if (!isResolved) {
            isResolved = true;
            resolve();
          }
        };

        proc.once("exit", onExit);
        try {
          proc.kill("SIGTERM");
        } catch {}

        // Forçage SIGKILL si le processus ne s'arrête pas sous 2.5s
        setTimeout(() => {
          if (!isResolved) {
            try {
              proc.kill("SIGKILL");
            } catch {}
            onExit();
          }
        }, 2500);
      });
      this.apiProcess = null;
    }
    this.status.api = "stopped";

    this.status.database = "stopping";
    try {
      await this.postgres.stop();
    } catch (e) {
      console.warn("Avertissement arrêt PostgreSQL :", e.message);
    }
    this.status.database = "stopped";
    this.status.migrations = "stopped";
    this.status.seed = "stopped";
  }

  getStatus() {
    return this.status;
  }
}

module.exports = ServiceManager;