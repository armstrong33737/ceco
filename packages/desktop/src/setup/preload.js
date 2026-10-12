// packages/desktop/src/setup/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cecoSetup", {
  getInitialState: () => ipcRenderer.invoke("setup:get-initial-state"),
  chooseServer: () => ipcRenderer.invoke("setup:choose-server"),
  chooseClient: (address) => ipcRenderer.invoke("setup:choose-client", address),
  discoverServers: () => ipcRenderer.invoke("setup:discover-servers"),
  clearConfig: () => ipcRenderer.invoke("setup:clear-config"),
  retryConnection: (address) => ipcRenderer.invoke("setup:retry-connection", address),
});