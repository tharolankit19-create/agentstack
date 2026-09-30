import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("kryx", {
  getState: () => ipcRenderer.invoke("kryx:get-state"),
  login: () => ipcRenderer.invoke("kryx:login"),
  refresh: () => ipcRenderer.invoke("kryx:refresh"),
  logout: () => ipcRenderer.invoke("kryx:logout"),
  openWeb: () => ipcRenderer.invoke("kryx:open-web"),
  showBrowserExtension: () => ipcRenderer.invoke("kryx:show-browser-extension"),
  setObserver: (enabled) => ipcRenderer.invoke("kryx:set-observer", enabled),
  startMission: (instruction) => ipcRenderer.invoke("kryx:start-mission", instruction),
  onState: (listener) => {
    const wrapped = (_event, state) => listener(state);
    ipcRenderer.on("kryx:state", wrapped);
    return () => ipcRenderer.removeListener("kryx:state", wrapped);
  },
});
