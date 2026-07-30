const { app, BrowserWindow, Tray, Menu, dialog } = require("electron");
const path = require("path");
const ServiceManager = require("./serviceManager");

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
      await serviceManager.stopServer();
      app.isQuitting = true;
      app.quit();
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
          await serviceManager.stopServer();
          app.isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.setToolTip("CECO — services actifs en arrière-plan");
}

app.whenReady().then(async () => {
  await serviceManager.startServer(); // Mode Serveur par défaut pour ce squelette
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  // Ne quitte jamais silencieusement sur macOS/Windows tant que les
  // services tournent — la décision passe par le dialogue de fermeture.
});
