const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('shoreclips', {
  listSources: () => ipcRenderer.invoke('list-sources'),
  listClips: () => ipcRenderer.invoke('list-clips'),
  saveClip: payload => ipcRenderer.invoke('save-clip', payload),
  deleteClip: name => ipcRenderer.invoke('delete-clip', name),
  openClip: name => ipcRenderer.invoke('open-clip', name),
  openClipsFolder: () => ipcRenderer.invoke('open-clips-folder'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: settings => ipcRenderer.invoke('save-settings', settings),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  showError: message => ipcRenderer.invoke('show-error', message),
  onReplayHotkey: callback => ipcRenderer.on('hotkey-replay', callback),
  onHotkeyFailed: callback => ipcRenderer.on('hotkey-registration-failed', (_event,key)=>callback(key))
});
