const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    selectMp3: () => ipcRenderer.invoke('select-mp3'),
    tagMp3: (filePath, tags) => ipcRenderer.invoke('tag-mp3', { filePath, tags }),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, status) => callback(status))
  });