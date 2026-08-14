const childProcess = require("child_process");
const fs = require("fs");

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

const { app, BrowserWindow, Tray, Menu, dialog, ipcMain } = require("electron");
const path = require("path");
const url = require("url");
const http = require("http");
const os = require("os");
const ServiceManager = require("./serviceManager");
const { readConfig, writeConfig, clearConfig } = require("./setup/config");

app.setName("CECO");
app.setPath("userData", path.join(app.getPath("appData"), "CECO"));

app.disableHardwareAcceleration();

// DÉSACTIVATION GLOBALE DU MENU PAR DÉFAUT (File, Edit, View, Window...)
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
    }
  });
}

let mainWindow;
let setupWindow;
let tray;
const serviceManager = new ServiceManager();

const APP_ICON_PATH = path.join(__dirname, "../assets/icon.png");

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
                name: json.centerId ? `Serveur CECO (${ip})` : `Serveur local (${ip})`
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

function testConnection(address, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${address}/health`, { timeout: timeoutMs }, (res) => {
      res.resume();
      if (res.statusCode === 200) return resolve();
      reject(new Error(`Le serveur a répondu avec le code ${res.statusCode}.`));
    });
    req.on("timeout", () => req.destroy(new Error("Délai de connexion dépassé.")));
    req.on("error", (err) => reject(new Error(`Impossible de joindre ce serveur : ${err.message}`)));
  });
}

function createWindow(clientAddress) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "CECO",
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
  const trayIconPath = path.join(__dirname, "../assets/tray-icon.png");

  if (!fs.existsSync(trayIconPath)) {
    console.warn("[Tray] Icône introuvable :", trayIconPath);
    return;
  }

  tray = new Tray(trayIconPath);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Ouvrir CECO", click: () => mainWindow && mainWindow.show() },
      { type: "separator" },
      {
        label: "Changer de mode (Serveur/Client)",
        click: async () => {
          try {
            await serviceManager.stopServer();
          } catch (err) {
            console.error("Erreur pendant l'arrêt des services :", err);
          } finally {
            clearConfig();
            app.relaunch();
            app.isQuitting = true;
            app.quit();
          }
        },
      },
      {
        label: "Arrêter les services et quitter",
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
  tray.setToolTip("CECO — services actifs en arrière-plan");
}

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 500,
    height: 620,
    resizable: false,
    title: "CECO — Configuration",
    icon: fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "setup/preload.js"),
    },
  });
  setupWindow.setMenuBarVisibility(false);
  setupWindow.loadFile(path.join(__dirname, "setup/setup.html"));
}

ipcMain.handle("setup:choose-server", async () => {
  try {
    await serviceManager.startServer();
    writeConfig({ mode: "server" });
    if (setupWindow) setupWindow.close();
    createWindow();
    createTray();
    return { ok: true };
  } catch (err) {
    console.error("Échec du démarrage en mode Serveur :", err);
    return { ok: false, error: err?.message || "Erreur inconnue." };
  }
});

ipcMain.handle("setup:choose-client", async (event, address) => {
  try {
    await testConnection(address);
    writeConfig({ mode: "client", serverAddress: address });
    if (setupWindow) setupWindow.close();
    createWindow(address);
    createTray();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "Erreur inconnue." };
  }
});

ipcMain.handle("setup:discover-servers", async () => {
  return await discoverServers();
});

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;

  const config = readConfig();

  if (!config) {
    createSetupWindow();
    return;
  }

  try {
    if (config.mode === "server") {
      await serviceManager.startServer();
      createWindow();
    } else {
      await testConnection(config.serverAddress);
      createWindow(config.serverAddress);
    }
    createTray();
  } catch (err) {
    console.error("Échec du démarrage des services CECO :", err);
    dialog.showErrorBox(
      "Erreur au démarrage",
      `CECO n'a pas pu démarrer.\n\n${err?.message || "Erreur inconnue."}\n\nUtilisez "Changer de mode" depuis la barre système pour reconfigurer.`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {});

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