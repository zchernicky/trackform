const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const { log, getFfmpegPath } = require('./scripts/dev-utils');
const Store = require('electron-store').default;

// Initialize store for preferences
const store = new Store();

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;
let settingsWindow;

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    parent: mainWindow,
    modal: true,
    resizable: false
  });

  settingsWindow.loadFile('settings.html');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Create the application menu
  const template = [
    {
      label: 'Trackform',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { 
          label: 'Settings',
          click: () => createSettingsWindow()
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

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
  log('IPC handler called with:', { filePath, tags });
  
  const { title, artist, year, genre } = tags;
  const ffmpegPath = getFfmpegPath();
  
  log('FFmpeg path:', ffmpegPath);
  log('File exists:', fs.existsSync(ffmpegPath));
  log('Input file exists:', fs.existsSync(filePath));
  log('Input file permissions:', fs.statSync(filePath).mode);

  // Check if user has set "always allow"
  const alwaysAllow = store.get('alwaysAllowOverwrite');
  
  if (!alwaysAllow) {
    // Show confirmation dialog before proceeding
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: 'Confirm File Overwrite',
      message: 'This will overwrite the original MP3 file. Do you want to continue?',
      buttons: ['Yes', 'Always Allow', 'No'],
      defaultId: 2,
      cancelId: 2
    });

    if (response === 2) { // No
      throw new Error('Operation cancelled by user');
    } else if (response === 1) { // Always Allow
      store.set('alwaysAllowOverwrite', true);
    }
  }

  // Create a temporary file path
  const tempFilePath = `${filePath}.temp`;
  
  const args = [
    '-loglevel', app.isPackaged ? 'error' : 'debug',
    '-y',  // Automatically overwrite output files
    '-i', filePath,
    '-metadata', `title=${title}`,
    '-metadata', `artist=${artist}`,
    '-metadata', `date=${year}`,
    '-metadata', `genre=${genre}`,
    '-f', 'mp3',  // Specify output format as MP3
    '-codec', 'copy',
    tempFilePath
  ];
  
  log('Executing ffmpeg with args:', args);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args);
    let stdout = '';
    let stderr = '';

    ffmpeg.stdout.on('data', (data) => {
      stdout += data.toString();
      log('FFmpeg stdout:', data.toString());
    });

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      log('FFmpeg stderr:', data.toString());
    });

    ffmpeg.on('close', async (code) => {
      log('FFmpeg process exited with code:', code);
      if (code === 0) {
        try {
          // Move the temporary file back to the original location
          await fs.promises.rename(tempFilePath, filePath);
          resolve(filePath);
        } catch (err) {
          console.error('Error moving file:', err);
          reject(err);
        }
      } else {
        // Clean up temp file if it exists
        try {
          await fs.promises.unlink(tempFilePath);
        } catch (err) {
          console.error('Error cleaning up temp file:', err);
        }
        reject(`FFmpeg process exited with code ${code}\n${stderr}`);
      }
    });

    ffmpeg.on('error', (err) => {
      console.error('FFmpeg process error:', err);
      reject(err);
    });
  });
});

ipcMain.handle('get-setting', async (_, key) => {
  return store.get(key);
});

ipcMain.handle('set-setting', async (_, key, value) => {
  store.set(key, value);
});

ipcMain.handle('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});