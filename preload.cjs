const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gymTownPrint', () => ipcRenderer.invoke('gym-town:print'));
