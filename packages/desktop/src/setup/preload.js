const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cecoSetup", {
  chooseServer: () => ipcRenderer.invoke("setup:choose-server"),
  chooseClient: (address) => ipcRenderer.invoke("setup:choose-client", address),
  discoverServers: () => ipcRenderer.invoke("setup:discover-servers"),
});