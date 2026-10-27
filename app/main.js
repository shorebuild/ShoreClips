const { app, BrowserWindow, ipcMain, desktopCapturer, globalShortcut, shell, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');

let win;
let clipDir;
let settingsPath;
let settings = { hotkey: 'F7', duration: 60, launchBufferAutomatically: true, microphoneEnabled: false };

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
  // Source selection does not need thumbnails or window icons; keep the
  // macOS capture request as small and reliable as possible.
  let sources;
  let firstError;
  try {
    sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false
    });
  } catch (error) {
    firstError = error;
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false
      });
    } catch (fallbackError) {
      throw new Error(
        'macOS could not enumerate capture sources. Confirm Screen Recording permission, quit ShoreClips completely, and reopen the installed copy from Applications. ' +
        'Initial error: ' + (firstError?.message || String(firstError)) +
        '; screen-only retry: ' + (fallbackError?.message || String(fallbackError))
      );
    }
  }
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    type: s.id.startsWith('screen:') ? 'Screen' : 'Window',
    thumbnail: ''
  }));
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
  if (buffer.length > 240 * 1024 * 1024) throw new Error('Replay is too large to export. Choose a shorter duration or lower recording resolution.');
  await fs.mkdir(clipDir,{recursive:true});
  const safe = (payload.name || 'ShoreClips-Replay').replace(/[^a-z0-9-_]/gi,'-').slice(0,60) || 'ShoreClips-Replay';
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const temp = path.join(app.getPath('temp'), safe + '-' + stamp + '.webm');
  const dest = path.join(clipDir, safe + '-' + stamp + '.mp4');
  await fs.writeFile(temp,buffer);
  const ffmpegPath = ffmpegStatic ? ffmpegStatic.replace('app.asar', 'app.asar.unpacked') : '';
  if (!ffmpegPath) throw new Error('FFmpeg encoder is unavailable in this build.');
  try {
    await fs.access(ffmpegPath);
  } catch {
    throw new Error('Bundled FFmpeg executable is missing: ' + ffmpegPath);
  }
  await new Promise((resolve,reject) => {
    const args = ['-hide_banner','-loglevel','error','-xerror','-fflags','+genpts','-y','-i',temp,'-map','0:v:0','-map','0:a?','-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-tag:v','avc1','-c:a','aac','-b:a','128k','-movflags','+faststart',dest];
    const proc=spawn(ffmpegPath,args);
    let errorText='';
    proc.stderr.on('data',d=>errorText+=d.toString());
    proc.on('error',reject);
    proc.on('close',code=>code===0?resolve():reject(new Error(errorText||('FFmpeg exited with code '+code))));
  }).finally(()=>fs.rm(temp,{force:true}).catch(()=>{}));
  const st=await fs.stat(dest);
  return { path:dest, name:path.basename(dest), size:st.size };
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
  if (!base || base !== name || !/\\.(mp4|webm|mov)$/i.test(base)) throw new Error('Invalid clip name.');
  const filePath = path.join(clipDir, base);
  await fs.access(filePath);
  const player = new BrowserWindow({
    width: 1100, height: 720, minWidth: 640, minHeight: 420,
    title: base,
    backgroundColor: '#0b0f12',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  await player.loadFile(path.join(__dirname, 'clip-viewer.html'), {
    query: { src: require('url').pathToFileURL(filePath).href, title: base }
  });
  return true;
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
