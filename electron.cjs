const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { SQLiteStorage } = require('./sqlite-storage.cjs');

let sqliteStorage;

function registerStorageHandlers() {
  const handleStorageRequest = (event, operation) => {
    try {
      event.returnValue = { ok: true, value: operation() };
    } catch (error) {
      console.error('SQLite storage request failed', error);
      event.returnValue = {
        ok: false,
        error: error instanceof Error ? error.message : 'SQLite storage request failed.',
      };
    }
  };

  ipcMain.on('gym-town-storage:get', (event, key) => {
    handleStorageRequest(event, () => sqliteStorage.get(key));
  });
  ipcMain.on('gym-town-storage:set', (event, key, value) => {
    handleStorageRequest(event, () => sqliteStorage.set(key, value));
  });
  ipcMain.on('gym-town-storage:remove', (event, key) => {
    handleStorageRequest(event, () => sqliteStorage.remove(key));
  });
  ipcMain.handle('gym-town:print', (event) => new Promise((resolve, reject) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      reject(new Error('The application window is unavailable for printing.'));
      return;
    }

    window.webContents.print(
      { silent: false, printBackground: true },
      (success, failureReason) => {
        if (success || failureReason === 'Print job cancelled') {
          resolve();
          return;
        }
        reject(new Error(failureReason || 'The print job could not be completed.'));
      }
    );
  }));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "The Gym Town Enterprise",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  sqliteStorage = new SQLiteStorage(path.join(app.getPath('userData'), 'gym-town.sqlite'));
  registerStorageHandlers();
  createWindow();
});

app.on('before-quit', () => {
  sqliteStorage?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});