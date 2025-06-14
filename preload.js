const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    selectMp3: () => ipcRenderer.invoke('select-mp3'),
    tagMp3: (filePath, tags) => {
      console.log('Preload: Calling tag-mp3 IPC with:', { filePath, tags });
      return ipcRenderer.invoke('tag-mp3', { filePath, tags });
    },
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, status) => callback(status)),
    getSetting: (key) => ipcRenderer.invoke('get-setting', key),
    setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
    closeSettings: () => ipcRenderer.invoke('close-settings')
});