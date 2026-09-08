const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  retryConnection: () => ipcRenderer.invoke('retry-connection'),
});
