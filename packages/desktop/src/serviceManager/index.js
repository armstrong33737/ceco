const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const { execFile, spawn } = require("child_process");
const { app } = require("electron");
const PostgresManager = require("./postgresManager");

// ------------------------------------------------------------------
// Electron joue le rôle de gestionnaire de services (section 06 du
// document technique). Bascule individuelle prévue pour :
// API, DATABASE, BACKUP, DOCUMENTS, LICENSE.
// Séquence d'arrêt : Backup -> API -> PostgreSQL -> fermeture Electron.
// ------------------------------------------------------------------

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

// `migrate deploy` (jamais `migrate dev`) : applique uniquement les
// migrations déjà commitées, sans poser de question, sans en générer de
// nouvelles. Sûr à exécuter à CHAQUE démarrage — no-op si déjà à jour.
function runMigrations(databaseUrl) {
  return new Promise((resolve, reject) => {
    let prismaCliPath;
    try {
      prismaCliPath = require.resolve("prisma/build/index.js");
    } catch {
      prismaCliPath = null;
    }

    if (prismaCliPath) {
      execFile(
        process.execPath,
        [prismaCliPath, "migrate", "deploy", "--schema", PRISMA_SCHEMA_PATH],
        {
          env: {
            ...process.env,
            DATABASE_URL: databaseUrl,
            ELECTRON_RUN_AS_NODE: "1",
          },
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
    } else {
      const isWin = process.platform === "win32";
      execFile(
        isWin ? "npx.cmd" : "npx",
        ["prisma", "migrate", "deploy", "--schema", PRISMA_SCHEMA_PATH],
        {
          env: { ...process.env, DATABASE_URL: databaseUrl },
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

// Idempotent (seed.js vérifie déjà si un centre existe) — sûr à exécuter
// à CHAQUE démarrage, comme les migrations. C'est ce qui crée le centre
// local par défaut, ses rôles système et son arborescence de stockage
// au tout premier lancement.
function runSeed(databaseUrl, storageRoot) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [SEED_ENTRY],
      {
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

// Le secret JWT ne doit JAMAIS être une valeur fixe en dur : généré une
// seule fois par installation, persisté dans userData, réutilisé ensuite.
function getOrCreateJwtSecret() {
  const secretDir = path.join(app.getPath("userData"), "secrets");
  const secretPath = path.join(secretDir, "jwt.key");
  if (!fs.existsSync(secretDir)) fs.mkdirSync(secretDir, { recursive: true });
  if (!fs.existsSync(secretPath)) {
    fs.writeFileSync(secretPath, crypto.randomBytes(64).toString("hex"), { mode: 0o600 });
  }
  return fs.readFileSync(secretPath, "utf-8").trim();
}

// Attend que l'API réponde réellement sur /health avant de considérer le
// service comme prêt — plutôt que de supposer un démarrage instantané.
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
        return reject(new Error("L'API n'a pas répondu à temps au démarrage."));
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
      ELECTRON_RUN_AS_NODE: "1", // exécute ce script comme du Node pur, pas comme Electron
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (d) => console.log(`[API] ${d.toString().trim()}`));
  child.stderr.on("data", (d) => console.error(`[API] ${d.toString().trim()}`));
  child.once("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`L'API s'est arrêtée de façon inattendue (code ${code}).`);
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

  async startServer() {
    this.status.database = "starting";
    const { port: pgPort } = await this.postgres.start();
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

    console.log(`Mode Serveur actif — PostgreSQL:${pgPort}, API:${API_PORT}.`);
    return { ...this.status, pgPort, apiPort: API_PORT };
  }

  async stopServer() {
    this.status.backup = "stopping";
    this.status.backup = "stopped";

    this.status.api = "stopping";
    if (this.apiProcess) {
      await new Promise((resolve) => {
        this.apiProcess.once("exit", resolve);
        this.apiProcess.kill("SIGTERM");
        setTimeout(resolve, 5000);
      });
      this.apiProcess = null;
    }
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