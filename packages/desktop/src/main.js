const { app, BrowserWindow, Tray, Menu, dialog, ipcMain } = require("electron");
const path = require("path");
const url = require("url");
const http = require("http");
const fs = require("fs");
const ServiceManager = require("./serviceManager");
const { readConfig, writeConfig, clearConfig } = require("./setup/config");

// Fixe explicitement le dossier userData. app.setName() seul peut ne pas
// suffire selon le moment où Electron résout ce chemin en interne — on le
// force donc directement pour garantir un emplacement stable et prévisible.
app.setName("CECO");
app.setPath("userData", path.join(app.getPath("appData"), "CECO"));

// Évite le bruit gbm_wrapper/GTK sur certaines configs Linux (VM, pilotes
// graphiques limités) — sans impact sur le fonctionnement de l'app.
app.disableHardwareAcceleration();

// Empêche deux instances de CECO de tourner en même temps : sans ça, une
// seconde fenêtre lancée par erreur tenterait de démarrer son propre
// PostgreSQL/API sur les mêmes ports, provoquant des conflits en cascade
// (EADDRINUSE) au lieu d'un message clair.
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

// Test de connexion ponctuel (pas une boucle de polling comme au démarrage
// du mode Serveur) : l'utilisateur vient de saisir une adresse, on vérifie
// une fois avec un délai raisonnable avant de lui répondre.
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
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // En dev : pointe vers le serveur Vite. En prod : charge le build statique.
  const devUrl = process.env.CECO_FRONTEND_URL || "http://localhost:5173";
  const baseUrl = app.isPackaged
    ? url.pathToFileURL(path.join(process.resourcesPath, "frontend", "index.html")).toString()
    : devUrl;
  const finalUrl = clientAddress
    ? `${baseUrl}?apiAddress=${encodeURIComponent(clientAddress)}`
    : baseUrl;
  mainWindow.loadURL(finalUrl);

  // À la fermeture : proposer Minimiser (services actifs) ou Arrêter (séquence propre).
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

// ------------------------------------------------------------------
// Écran de choix Serveur/Client — affiché uniquement au premier lancement
// (tant qu'aucune configuration n'est encore enregistrée).
// ------------------------------------------------------------------
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 480,
    height: 420,
    resizable: false,
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

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return; // app.quit() déjà appelé plus haut

  const config = readConfig();

  if (!config) {
    // Premier lancement : l'utilisateur doit choisir.
    createSetupWindow();
    return;
  }

  // Lancements suivants : le choix est déjà connu, on saute directement
  // à l'étape correspondante sans redemander.
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

app.on("window-all-closed", () => {
  // Ne quitte jamais silencieusement sur macOS/Windows tant que les
  // services tournent — la décision passe par le dialogue de fermeture.
});

// Ctrl+C dans le terminal (ou un arrêt système) envoie SIGINT/SIGTERM
// directement au processus, en contournant le dialogue de fermeture de
// la fenêtre. Sans ceci, PostgreSQL est tué brutalement et son dossier
// de données peut se retrouver dans un état bloqué au redémarrage suivant.
async function gracefulShutdown() {
  console.log("Arrêt demandé (signal système) — arrêt propre des services...");
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