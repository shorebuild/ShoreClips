const $ = id => document.getElementById(id);
let chosenDuration = 60;
let activeStream = null;
let micStream = null;
let recording = false;
let recorder = null;
let chunks = [];
let history = [];
let historyBytes = 0;
let timer = null;
let toastTimer = null;
let selectedSource = '';

function toast(message) {
  const el = $('toast'); el.textContent=message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}
function setCaptureStatus(active) {
  $('status').textContent = active ? '● CAPTURING REPLAY BUFFER' : '● NOT CAPTURING';
  $('status').classList.toggle('capturing', active);
  $('startBuffer').disabled = active;
  $('stopBuffer').disabled = !active;
  $('captureMessage').textContent = active ? 'Replay buffer is running. Press your shortcut to save a replay.' : 'Select a source below before starting.';
}
function showPage(page) {
  for(const name of ['home','clips','settings']) $(name+'Page').classList.toggle('hidden',name!==page);
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('pageTitle').textContent=page.charAt(0).toUpperCase()+page.slice(1);
  if(page==='clips') refreshClips();
}
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
async function refreshSources() {
  const select=$('sourceSelect'), old=select.value;
  select.innerHTML='';
  try {
    const list=await window.shoreclips.listSources();
    for(const source of list) {
      const option=document.createElement('option'); option.value=source.id;
      option.textContent=(source.type==='Screen'?'Display: ':'Window: ')+source.name; select.append(option);
    }
    if(old && list.some(s=>s.id===old)) select.value=old;
    else if(list.length) select.selectedIndex=0;
    selectedSource=select.value;
    $('sourceSummary').textContent=select.selectedOptions[0]?.textContent||'Not selected';
    if(!list.length) { select.innerHTML='<option value="">No screens/windows found</option>'; $('sourceSummary').textContent='Not selected'; }
  } catch(e) { select.innerHTML='<option value="">Source list unavailable</option>'; await window.shoreclips.showError('Could not list capture sources: '+e.message); }
}
$('sourceSelect').addEventListener('change',()=>{selectedSource=$('sourceSelect').value;$('sourceSummary').textContent=$('sourceSelect').selectedOptions[0]?.textContent||'Not selected';});
$('refreshSources').addEventListener('click',refreshSources);
$('openFolder').addEventListener('click',()=>window.shoreclips.openClipsFolder());
$('openFolderSettings').addEventListener('click',()=>window.shoreclips.openClipsFolder());
$('refreshClips').addEventListener('click',refreshClips);
$('startBuffer').addEventListener('click',startBuffer);
$('stopBuffer').addEventListener('click',stopBuffer);
for(const b of document.querySelectorAll('[data-duration]')) b.addEventListener('click',async()=>{
  if(recording){toast('Stop the buffer before changing clip length.');return;}
  chosenDuration=Number(b.dataset.duration);
  document.querySelectorAll('[data-duration]').forEach(x=>x.classList.toggle('chosen',x===b));
  $('bufferLength').innerHTML=chosenDuration+' <span>sec</span>';
  await persist({duration:chosenDuration});
});
async function persist(patch) {
  try {
    const s=await window.shoreclips.saveSettings(patch);
    if($('heroHotkey')) $('heroHotkey').textContent=s.hotkey||'F7';
    if($('setupHotkey')) $('setupHotkey').textContent=s.hotkey||'F7';
    toast('Settings saved.');
    return s;
  } catch(e) { await window.shoreclips.showError(e.message||String(e)); throw e; }
}
async function startBuffer() {
  if(recording)return;
  const sourceId=$('sourceSelect').value;
  if(!sourceId){toast('Choose a screen or window first.');return;}
  try {
    const prefs=await window.shoreclips.getSettings();
    const [kind,id]=sourceId.split(':');
    if(kind==='screen') {
      activeStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:sourceId,maxFrameRate:30}}});
    } else {
      activeStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:sourceId,maxFrameRate:30}}});
    }
    if(prefs.microphoneEnabled) {
      micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      for(const track of micStream.getAudioTracks()) activeStream.addTrack(track);
    }
    const mimeType=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
    recorder=new MediaRecorder(activeStream,mimeType?{mimeType,videoBitsPerSecond:6000000}:undefined);
    chunks=[];history=[];historyBytes=0;
    recorder.ondataavailable=e=>{
      if(!e.data||!e.data.size)return;
      history.push({blob:e.data,time:Date.now()});historyBytes+=e.data.size;
      const cutoff=Date.now()-chosenDuration*1000;
      while(history.length>1 && history[0].time<cutoff){historyBytes-=history[0].blob.size;history.shift();}
      // Guard runaway memory if the user records very long at high resolutions.
      while(historyBytes>900*1024*1024&&history.length>1){historyBytes-=history[0].blob.size;history.shift();}
    };
    recorder.onerror=e=>{toast('Capture recorder error.');console.error(e);};
    recorder.start(1000);
    recording=true;setCaptureStatus(true);
    timer=setInterval(()=>{const seconds=history.reduce((n,x)=>n+1,0);$('captureMessage').textContent='Replay buffer running · '+seconds+' second chunks ready';},1000);
    toast('Replay buffer started.');
  } catch(e) {
    if(activeStream)activeStream.getTracks().forEach(t=>t.stop());
    if(micStream)micStream.getTracks().forEach(t=>t.stop());
    activeStream=null;micStream=null;recording=false;setCaptureStatus(false);
    await window.shoreclips.showError('Could not start capture. Check Screen Recording and Microphone permissions in macOS Privacy & Security.\n\n'+e.message);
  }
}
function stopBuffer() {
  if(!recording)return;
  recording=false;clearInterval(timer);timer=null;
  try { if(recorder&&recorder.state!=='inactive')recorder.stop(); } catch {}
  if(activeStream)activeStream.getTracks().forEach(t=>t.stop());
  if(micStream)micStream.getTracks().forEach(t=>t.stop());
  activeStream=null;micStream=null;recorder=null;
  setCaptureStatus(false);toast('Replay buffer stopped.');
}
async function saveReplay() {
  if(!recording){toast('Start the replay buffer first.');return;}
  if(history.length<2){toast('Wait a few seconds for footage to buffer.');return;}
  const blobs=history.map(x=>x.blob);
  const mime=blobs[0].type||'video/webm';
  const dataBlob=new Blob(blobs,{type:mime});
  const reader=new FileReader();
  reader.onerror=()=>toast('Could not prepare replay file.');
  reader.onload=async()=>{
    try {
      const result=await window.shoreclips.saveClip({data:reader.result,mimeType:mime,name:'ShoreClips-Replay'});
      toast('Replay saved: '+result.name); await refreshClips(); $('clipCount').textContent=(await window.shoreclips.listClips()).length;
    } catch(e) { await window.shoreclips.showError('Could not save replay: '+e.message); }
  };
  reader.readAsDataURL(dataBlob);
}
async function refreshClips() {
  try {
    const clips=await window.shoreclips.listClips();
    $('clipCount').textContent=clips.length;
    const root=$('clipsList');root.replaceChildren();
    if(!clips.length){const p=document.createElement('p');p.className='muted';p.textContent='No clips yet. Start the buffer and press your replay shortcut to save one.';root.append(p);return;}
    for(const clip of clips){
      const row=document.createElement('div');row.className='cliprow';
      const left=document.createElement('div');
      const title=document.createElement('strong');title.textContent=clip.name;
      const meta=document.createElement('p');meta.textContent=(clip.size/1024/1024).toFixed(1)+' MB · '+new Date(clip.modified).toLocaleString();
      left.append(title,meta);
      const actions=document.createElement('div');actions.className='clipactions';
      const play=document.createElement('button');play.className='secondary';play.textContent='Open';play.onclick=()=>window.shoreclips.openClip(clip.name);
      const del=document.createElement('button');del.className='secondary';del.textContent='Delete';del.onclick=async()=>{if(confirm('Delete '+clip.name+'?')){await window.shoreclips.deleteClip(clip.name);refreshClips();}};
      actions.append(play,del);row.append(left,actions);root.append(row);
    }
  }catch(e){console.error(e);toast('Could not load clips.');}
}
if($('hotkeySelect')) $('hotkeySelect').addEventListener('change',e=>persist({hotkey:e.target.value}));
if($('autoBuffer')) $('autoBuffer').addEventListener('change',e=>persist({launchBufferAutomatically:e.target.checked}));
if($('microphoneEnabled')) $('microphoneEnabled').addEventListener('change',e=>{
 if(recording){e.target.checked=!e.target.checked;toast('Stop the buffer before changing microphone settings.');return;}
 persist({microphoneEnabled:e.target.checked});
});
window.shoreclips.onReplayHotkey(()=>saveReplay());
window.shoreclips.onHotkeyFailed(key=>toast('Could not register '+key+'. Choose another shortcut.'));
async function loadPreferences(){
 try {
  const s=await window.shoreclips.getSettings();
  chosenDuration=Number(s.duration||60);
  document.querySelectorAll('[data-duration]').forEach(b=>b.classList.toggle('chosen',Number(b.dataset.duration)===chosenDuration));
  $('bufferLength').innerHTML=chosenDuration+' <span>sec</span>';
  $('hotkeySelect').value=s.hotkey||'F7';
  $('autoBuffer').checked=!!s.launchBufferAutomatically;
  $('microphoneEnabled').checked=!!s.microphoneEnabled;
  $('heroHotkey').textContent=s.hotkey||'F7';$('setupHotkey').textContent=s.hotkey||'F7';
 } catch(e){console.error(e);}
}
window.addEventListener('beforeunload',()=>{if(recording)stopBuffer();});
(async()=>{await loadPreferences();await refreshSources();await refreshClips();const s=await window.shoreclips.getSettings();if(s.launchBufferAutomatically&&$('sourceSelect').value)startBuffer();})();
