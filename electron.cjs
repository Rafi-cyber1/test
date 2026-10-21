const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
function registerPrintHandler() {
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
  registerPrintHandler();
  createWindow();
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});