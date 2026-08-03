const { app, BrowserWindow, Tray, Menu, dialog } = require("electron");
const path = require("path");
const ServiceManager = require("./serviceManager");

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
    // Une seconde tentative de lancement : on ramène la fenêtre existante
    // au premier plan plutôt que de laisser une nouvelle instance démarrer.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

let mainWindow;
let tray;
const serviceManager = new ServiceManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // En dev : pointe vers le serveur Vite. En prod : charge le build statique.
  mainWindow.loadURL(process.env.CECO_FRONTEND_URL || "http://localhost:5173");

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
        // Ne jamais bloquer la fermeture de l'app à cause d'une erreur
        // d'arrêt de service — on log et on quitte quand même.
        console.error("Erreur pendant l'arrêt des services :", err);
      } finally {
        app.isQuitting = true;
        app.quit();
      }
    }
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, "../assets/tray-icon.png"));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Ouvrir CECO", click: () => mainWindow.show() },
      { type: "separator" },
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

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return; // app.quit() déjà appelé plus haut

  try {
    await serviceManager.startServer(); // Mode Serveur par défaut pour ce squelette
    createWindow();
    createTray();
  } catch (err) {
    console.error("Échec du démarrage des services CECO :", err);
    dialog.showErrorBox(
      "Erreur au démarrage",
      `CECO n'a pas pu démarrer ses services.\n\n${err.message}`
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