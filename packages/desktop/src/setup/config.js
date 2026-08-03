const fs = require("fs");
const path = require("path");
const { app } = require("electron");

// Persiste le choix Serveur/Client fait au premier lancement, pour ne plus
// jamais redemander tant que l'utilisateur ne réinitialise pas explicitement.
const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null; // aucune configuration encore choisie
  }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function clearConfig() {
  try {
    fs.unlinkSync(CONFIG_PATH);
  } catch {
    // rien à supprimer, ce n'est pas une erreur
  }
}

module.exports = { readConfig, writeConfig, clearConfig };