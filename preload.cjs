const { contextBridge, ipcRenderer } = require('electron');

const sendStorageRequest = (channel, ...args) => {
  const result = ipcRenderer.sendSync(channel, ...args);
  if (!result?.ok) {
    throw new Error(result?.error || 'SQLite storage request failed.');
  }
  return result.value;
};

contextBridge.exposeInMainWorld('gymTownStorage', {
  getItem: (key) => sendStorageRequest('gym-town-storage:get', key),
  setItem: (key, value) => sendStorageRequest('gym-town-storage:set', key, value),
  removeItem: (key) => sendStorageRequest('gym-town-storage:remove', key),
  print: () => ipcRenderer.invoke('gym-town:print'),
});
