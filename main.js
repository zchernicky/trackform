const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Get the path to the bundled ffmpeg
function getFfmpegPath() {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    return '/opt/homebrew/bin/ffmpeg';
  }
  return path.join(process.resourcesPath, 'ffmpeg');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');
  
  // Check for updates when the window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    // Check for updates every hour
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 3600000);
    
    // Initial check
    autoUpdater.checkForUpdates();
  });
}

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('update-status', 'Checking for updates...');
  });
  
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-status', `Update available: ${info.version}`);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available. Would you like to download it now?`,
      buttons: ['Yes', 'No']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });
  
  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-status', 'No updates available');
  });
  
  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('update-status', 
      `Downloading: ${Math.round(progressObj.percent)}%`
    );
  });
  
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-status', 'Update downloaded');
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart the application to apply the updates.',
      buttons: ['Restart', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
  
  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update-status', `Error: ${err.message}`);
    dialog.showErrorBox('Update Error', err.message);
  });

app.whenReady().then(() => {
  createWindow();
});

ipcMain.handle('select-mp3', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'MP3 Files', extensions: ['mp3'] }],
  });
  return result.filePaths[0];
});

ipcMain.handle('tag-mp3', async (_, { filePath, tags }) => {
  const { title, artist, year, genre } = tags;
  const ffmpegPath = getFfmpegPath();

  const cmd = `"${ffmpegPath}" -i "${filePath}" -metadata title="${title}" -metadata artist="${artist}" -metadata date="${year}" -metadata genre="${genre}" -codec copy "${filePath}"`;

  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(stderr);
      else resolve(filePath);
    });
  });
});