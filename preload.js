const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkOllama:       ()       => ipcRenderer.invoke('check-ollama'),
  generateChords:    (params) => ipcRenderer.invoke('generate-chords', params),
  fetchLyricsSynced: (params) => ipcRenderer.invoke('fetch-lyrics-synced', params),
});
