// packages/desktop/src/setup/config.js
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

// Persiste le choix Serveur/Client fait au premier lancement, pour ne plus
// jamais redemander tant que l'utilisateur ne réinitialise pas explicitement.
const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const content = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.warn("[Config] Impossible de lire config.json :", err.message);
    return null;
  }
}

function writeConfig(config) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("[Config] Erreur lors de l'écriture de config.json :", err.message);
    throw err;
  }
}

function clearConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
      console.log("[Config] Fichier config.json réinitialisé.");
    }
  } catch (err) {
    console.warn("[Config] Erreur lors de la suppression de config.json :", err.message);
  }
}

module.exports = { readConfig, writeConfig, clearConfig };