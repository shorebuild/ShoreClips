const { app, BrowserWindow, ipcMain, desktopCapturer, globalShortcut, shell, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

let win;
let clipDir;
let settingsPath;
let settings = { hotkey: 'F7', duration: 60, launchBufferAutomatically: false, microphoneEnabled: false };

async function readSettings() {
  try { return { ...settings, ...JSON.parse(await fs.readFile(settingsPath, 'utf8')) }; }
  catch { return { ...settings, outputDirectory: clipDir }; }
}
function registerHotkey(key) {
  globalShortcut.unregisterAll();
  const ok = globalShortcut.register(key, () => win?.webContents.send('hotkey-replay'));
  if (!ok) win?.webContents.send('hotkey-registration-failed', key);
  return ok;
}
function createWindow() {
  win = new BrowserWindow({
    width: 1240, height: 820, minWidth: 880, minHeight: 620,
    title: 'ShoreClips',
    backgroundColor: '#0b0f12',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('closed', () => { win = null; });
}
app.whenReady().then(async () => {
  clipDir = path.join(app.getPath('videos'), 'ShoreClips');
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  await fs.mkdir(clipDir, { recursive: true });
  settings = await readSettings();
  createWindow();
  registerHotkey(settings.hotkey || 'F7');
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('list-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 360, height: 220 }, fetchWindowIcons: true });
  return sources.map(s => ({ id:s.id, name:s.name, type:s.id.startsWith('screen:') ? 'Screen' : 'Window', thumbnail:s.thumbnail.toDataURL() }));
});
ipcMain.handle('list-clips', async () => {
  await fs.mkdir(clipDir, { recursive: true });
  const items = await fs.readdir(clipDir);
  const result = [];
  for (const name of items) {
    if (!/\.(mp4|webm|mov)$/i.test(name)) continue;
    const p = path.join(clipDir,name);
    const st = await fs.stat(p);
    result.push({ name, path:p, size:st.size, modified:st.mtime.toISOString(), url: require('url').pathToFileURL(p).href });
  }
  return result.sort((a,b)=>b.modified.localeCompare(a.modified));
});
ipcMain.handle('save-clip', async (_e, payload) => {
  if (!payload || typeof payload.data !== 'string' || !payload.data.startsWith('data:')) throw new Error('Invalid clip data.');
  const buffer = Buffer.from(payload.data.split(',')[1], 'base64');
  if (!buffer.length) throw new Error('The replay buffer was empty.');
  await fs.mkdir(clipDir,{recursive:true});
  const safe = (payload.name || 'ShoreClips-Replay').replace(/[^a-z0-9-_]/gi,'-').slice(0,60) || 'ShoreClips-Replay';
  const dest = path.join(clipDir, safe + '-' + new Date().toISOString().replace(/[:.]/g,'-') + (payload.mimeType?.includes('mp4')?'.mp4':'.webm'));
  await fs.writeFile(dest,buffer);
  return { path:dest, name:path.basename(dest), size:buffer.length };
});
ipcMain.handle('delete-clip', async (_e, name) => {
  const base = path.basename(String(name || ''));
  if (!base || base !== name) throw new Error('Invalid clip name.');
  await fs.unlink(path.join(clipDir,base));
  return true;
});
ipcMain.handle('open-clips-folder', () => shell.openPath(clipDir));
ipcMain.handle('open-clip', async (_e, name) => {
  const base = path.basename(String(name || ''));
  return shell.openPath(path.join(clipDir,base));
});
ipcMain.handle('get-settings', async () => readSettings());
ipcMain.handle('get-app-info', async () => ({version:app.getVersion(),platform:process.platform,clipsDirectory:clipDir}));
ipcMain.handle('save-settings', async (_e, patch) => {
  const old = await readSettings();
  const next = {...old};
  if (Number.isFinite(Number(patch?.duration))) next.duration = Math.max(15,Math.min(300,Number(patch.duration)));
  if (typeof patch?.launchBufferAutomatically === 'boolean') next.launchBufferAutomatically=patch.launchBufferAutomatically;
  if (typeof patch?.microphoneEnabled === 'boolean') next.microphoneEnabled=patch.microphoneEnabled;
  if (typeof patch?.hotkey === 'string' && /^F([1-9]|1[0-2])$/.test(patch.hotkey)) next.hotkey=patch.hotkey;
  await fs.writeFile(settingsPath,JSON.stringify(next,null,2));
  if (next.hotkey !== old.hotkey && !registerHotkey(next.hotkey)) {
    next.hotkey=old.hotkey; await fs.writeFile(settingsPath,JSON.stringify(next,null,2)); registerHotkey(next.hotkey);
    throw new Error('Hotkey unavailable; restored previous hotkey.');
  }
  settings=next; return next;
});
ipcMain.handle('show-error', (_e, message) => dialog.showMessageBox(win,{type:'error',title:'ShoreClips',message:String(message)}));
