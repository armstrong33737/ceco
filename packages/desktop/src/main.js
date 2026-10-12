// packages/desktop/src/main.js
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const url = require("url");
const http = require("http");
const os = require("os");
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain } = require("electron");

function rewriteAsarPath(p) {
  if (typeof p === "string" && p.includes("app.asar") && !p.includes("app.asar.unpacked")) {
    return p.replace(/app\.asar([/\\\\])/g, "app.asar.unpacked$1");
  }
  return p;
}

const _spawn = childProcess.spawn.bind(childProcess);
childProcess.spawn = function spawn(cmd, args, opts) {
  return _spawn(rewriteAsarPath(cmd), args, opts);
};

const _chmod = fs.chmod.bind(fs);
fs.chmod = function chmod(path, mode, callback) {
  return _chmod(rewriteAsarPath(path), mode, callback);
};

const _chmodSync = fs.chmodSync.bind(fs);
fs.chmodSync = function chmodSync(path, mode) {
  return _chmodSync(rewriteAsarPath(path), mode);
};

if (fs.promises) {
  const _promisesChmod = fs.promises.chmod.bind(fs.promises);
  fs.promises.chmod = function chmod(path, mode) {
    return _promisesChmod(rewriteAsarPath(path), mode);
  };
}

const ServiceManager = require("./serviceManager");
const { readConfig, writeConfig, clearConfig } = require("./setup/config");

app.setName("CECO");
app.setPath("userData", path.join(app.getPath("appData"), "CECO"));

app.disableHardwareAcceleration();

// Désactivation globale du menu contextuel Chromium par défaut
Menu.setApplicationMenu(null);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else if (setupWindow) {
      if (setupWindow.isMinimized()) setupWindow.restore();
      setupWindow.show();
      setupWindow.focus();
    }
  });
}

let mainWindow;
let setupWindow;
let tray;
let setupInitialState = null;
const serviceManager = new ServiceManager();

const APP_ICON_PATH = path.join(__dirname, "../assets/icon.png");

// Synchronisation automatique de l'asset seal.png si nécessaire
function ensureDesktopSealAsset() {
  try {
    const desktopAssetDir = path.join(__dirname, "../assets");
    const desktopSealPath = path.join(desktopAssetDir, "seal.png");
    if (!fs.existsSync(desktopSealPath)) {
      const backendSealPath = path.join(__dirname, "../../backend/assets/seal.png");
      if (fs.existsSync(backendSealPath)) {
        if (!fs.existsSync(desktopAssetDir)) fs.mkdirSync(desktopAssetDir, { recursive: true });
        fs.copyFileSync(backendSealPath, desktopSealPath);
      }
    }
  } catch (e) {
    // Non bloquant
  }
}

function getLocalSubnets() {
  const interfaces = os.networkInterfaces();
  const subnets = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        const parts = iface.address.split(".");
        if (parts.length === 4) {
          const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
          if (!subnets.includes(prefix)) {
            subnets.push(prefix);
          }
        }
      }
    }
  }
  return subnets;
}

function probeServer(ip, port = 4000, timeout = 500) {
  return new Promise((resolve) => {
    const req = http.get(`http://${ip}:${port}/health`, { timeout }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.status === "ok") {
              return resolve({
                ip,
                port,
                address: `${ip}:${port}`,
                name: json.centerId ? `Serveur CECO (${ip})` : `Serveur local (${ip})`,
              });
            }
          } catch {
            return resolve(null);
          }
        }
        resolve(null);
      });
    });
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
  });
}

async function discoverServers() {
  const subnets = getLocalSubnets();
  const candidateIps = ["127.0.0.1", "localhost"];

  for (const prefix of subnets) {
    for (let i = 1; i <= 254; i++) {
      candidateIps.push(`${prefix}.${i}`);
    }
  }

  const results = [];
  const batchSize = 35;
  for (let i = 0; i < candidateIps.length; i += batchSize) {
    const batch = candidateIps.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((ip) => probeServer(ip, 4000)));
    results.push(...batchResults.filter(Boolean));
  }

  return results;
}

function testConnection(address, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${address}/health`, { timeout: timeoutMs }, (res) => {
      res.resume();
      if (res.statusCode === 200) return resolve();
      reject(new Error(`Le serveur distant a répondu avec le statut HTTP ${res.statusCode}.`));
    });
    req.on("timeout", () => req.destroy(new Error("Délai de connexion dépassé (timeout 4s).")));
    req.on("error", (err) => reject(new Error(`Hôte inaccessible : ${err.message}`)));
  });
}

function createWindow(clientAddress) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "CECO Suite ERP",
    icon: fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  mainWindow.setMenuBarVisibility(false);

  const devUrl = process.env.CECO_FRONTEND_URL || "http://localhost:5173";
  const baseUrl = app.isPackaged
    ? url.pathToFileURL(path.join(process.resourcesPath, "frontend", "index.html")).toString()
    : devUrl;
  const finalUrl = clientAddress
    ? `${baseUrl}?apiAddress=${encodeURIComponent(clientAddress)}`
    : baseUrl;
  mainWindow.loadURL(finalUrl);

  mainWindow.on("close", async (e) => {
    if (app.isQuitting) return;
    e.preventDefault();

    const choice = await dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Minimiser dans la barre système", "Arrêter les services et quitter"],
      defaultId: 0,
      message: "Que souhaitez-vous faire ?",
    });

    if (choice.response === 0) {
      mainWindow.hide();
    } else {
      try {
        await serviceManager.stopServer();
      } catch (err) {
        console.error("Erreur pendant l'arrêt des services :", err);
      } finally {
        app.isQuitting = true;
        app.quit();
      }
    }
  });
}

function createTray() {
  if (tray) return;

  const trayIconPath = path.join(__dirname, "../assets/tray-icon.png");
  if (!fs.existsSync(trayIconPath)) {
    return;
  }

  tray = new Tray(trayIconPath);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Ouvrir CECO", click: () => mainWindow && mainWindow.show() },
      { type: "separator" },
      {
        label: "Changer de configuration (Serveur/Client)",
        click: async () => {
          try {
            await serviceManager.stopServer();
          } catch (err) {
            console.error("Erreur pendant l'arrêt des services :", err);
          } finally {
            clearConfig();
            setupInitialState = null;
            if (mainWindow) {
              mainWindow.destroy();
              mainWindow = null;
            }
            createSetupWindow();
          }
        },
      },
      {
        label: "Quitter l'application",
        click: async () => {
          try {
            await serviceManager.stopServer();
          } catch (err) {
            console.error("Erreur pendant l'arrêt des services :", err);
          } finally {
            app.isQuitting = true;
            app.quit();
          }
        },
      },
    ])
  );
  tray.setToolTip("CECO Suite ERP — Services actifs");
}

function createSetupWindow() {
  if (setupWindow) {
    setupWindow.show();
    setupWindow.focus();
    return;
  }

  setupWindow = new BrowserWindow({
    width: 520,
    height: 640,
    resizable: false,
    title: "CECO — Configuration & Démarrage",
    icon: fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "setup/preload.js"),
    },
  });

  setupWindow.setMenuBarVisibility(false);
  setupWindow.loadFile(path.join(__dirname, "setup/setup.html"));

  setupWindow.on("closed", () => {
    setupWindow = null;
  });
}

// ------------------------------------------------------------------
// CANAUX IPC DE GESTION DU CYCLE DE VIE RÉSEAU
// ------------------------------------------------------------------

ipcMain.handle("setup:get-initial-state", async () => {
  return setupInitialState || { hasError: false };
});

ipcMain.handle("setup:choose-server", async () => {
  try {
    await serviceManager.startServer();
    writeConfig({ mode: "server" });
    setupInitialState = null;
    if (setupWindow) {
      setupWindow.close();
      setupWindow = null;
    }
    createWindow();
    createTray();
    return { ok: true };
  } catch (err) {
    console.error("Échec du démarrage en mode Serveur :", err);
    return { ok: false, error: err?.message || "Erreur interne de démarrage." };
  }
});

ipcMain.handle("setup:choose-client", async (event, address) => {
  try {
    await testConnection(address);
    writeConfig({ mode: "client", serverAddress: address });
    setupInitialState = null;
    if (setupWindow) {
      setupWindow.close();
      setupWindow = null;
    }
    createWindow(address);
    createTray();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "Hôte introuvable sur le réseau local." };
  }
});

ipcMain.handle("setup:retry-connection", async (event, address) => {
  try {
    await testConnection(address);
    writeConfig({ mode: "client", serverAddress: address });
    setupInitialState = null;
    if (setupWindow) {
      setupWindow.close();
      setupWindow = null;
    }
    createWindow(address);
    createTray();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "Serveur toujours indisponible." };
  }
});

ipcMain.handle("setup:discover-servers", async () => {
  return await discoverServers();
});

ipcMain.handle("setup:clear-config", async () => {
  clearConfig();
  setupInitialState = null;
  return { ok: true };
});

// ------------------------------------------------------------------
// POINT D'ENTRÉE DE L'APPLICATION
// ------------------------------------------------------------------

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;

  ensureDesktopSealAsset();

  const config = readConfig();

  if (!config) {
    createSetupWindow();
    return;
  }

  // Si l'ordinateur est configuré en mode Serveur
  if (config.mode === "server") {
    try {
      await serviceManager.startServer();
      createWindow();
      createTray();
    } catch (err) {
      console.error("Échec démarrage Serveur local :", err);
      setupInitialState = {
        hasError: true,
        mode: "server",
        serverAddress: null,
        errorMessage: `Le démarrage du serveur local a rencontré une erreur : ${err.message}. Vous pouvez basculer en mode Client ou relancer la configuration.`,
      };
      createSetupWindow();
      createTray();
    }
    return;
  }

  // Si l'ordinateur est configuré en mode Client
  if (config.mode === "client") {
    try {
      await testConnection(config.serverAddress);
      createWindow(config.serverAddress);
      createTray();
    } catch (err) {
      console.warn(`[Client] Serveur distant injoignable (${config.serverAddress}) : ${err.message}`);
      setupInitialState = {
        hasError: true,
        mode: "client",
        serverAddress: config.serverAddress,
        errorMessage: `Impossible de contacter le serveur CECO sur le réseau local à l'adresse "${config.serverAddress}".`,
      };
      // NE PLUS QUITTER L'APPLICATION : ouverture de l'écran de repli interactif
      createSetupWindow();
      createTray();
    }
  }
});

app.on("window-all-closed", () => {
  // L'application reste active dans le Tray
});

async function gracefulShutdown() {
  console.log("Arrêt demandé — arrêt propre des services...");
  try {
    await serviceManager.stopServer();
  } catch (err) {
    console.error("Erreur pendant l'arrêt propre :", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);