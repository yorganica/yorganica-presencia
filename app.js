
"use strict";
const $=id=>document.getElementById(id);
const translations=window.PRESENCIA_TRANSLATIONS||{};
let language=localStorage.getItem("presencia-language")||((navigator.language||"es").toLowerCase().split("-")[0]);
if(!translations[language])language="en";
function t(key){return translations[language]?.[key]||translations.es?.[key]||key}
function applyLanguage(){document.documentElement.lang=language;$("language").value=language;document.querySelectorAll("[data-i18n]").forEach(el=>{el.textContent=t(el.dataset.i18n)});document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>el.placeholder=t(el.dataset.i18nPlaceholder));document.querySelectorAll("[data-i18n-aria-label]").forEach(el=>el.setAttribute("aria-label",t(el.dataset.i18nAriaLabel)));updateButtons();}
$("language").addEventListener("change",e=>{language=e.target.value;localStorage.setItem("presencia-language",language);applyLanguage();renderEntries();renderStats()});
const KEY="yorganica-presencia-entries-v1";
let entries=[];
try { const raw=JSON.parse(localStorage.getItem(KEY)||"[]"); entries=Array.isArray(raw)?raw.filter(valid):[]; } catch { entries=[]; }
function valid(e){return e&&typeof e.id==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&Number.isFinite(e.minutes)&&e.minutes>0&&e.minutes<=1440&&typeof e.type==="string"&&typeof e.note==="string"&&typeof e.mood==="string";}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(entries));return true}catch{toast(t("saveFailed"));return false}}
function toast(s){const t=$("toast");t.textContent=s;t.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("show"),3000)}
function dateKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`}
function fmt(seconds){const s=Math.max(0,Math.ceil(seconds));const hrs=Math.floor(s/3600);return (hrs?`${String(hrs).padStart(2,"0")}:`:"")+`${String(Math.floor(s%3600/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function changeTab(name){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===name));document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("selected",b.dataset.tab===name));if(name==="diario")renderEntries();if(name==="avance")renderStats();window.scrollTo(0,0)}
document.querySelectorAll("nav button").forEach(b=>b.addEventListener("click",()=>changeTab(b.dataset.tab)));
let selected=15,active=false,paused=false,elapsed=0,startedAt=0,tick=null,free=false;
const SESSION_KEY="presencia-active-session-v3";
function saveSession(){try{if(active)localStorage.setItem(SESSION_KEY,JSON.stringify({selected,active,paused,elapsed,startedAt,free}));else localStorage.removeItem(SESSION_KEY)}catch{}}
const durations=[1,3,5,10,15,20,30,45,60,90,120];
function renderDurations(){ $("durations").replaceChildren(...durations.map(n=>{const b=document.createElement("button");b.textContent=n+" min";b.className=selected===n?"active":"";b.disabled=active;b.onclick=()=>{selected=n;$("custom-minutes").value=n;renderDurations();updateClock()};return b}))}
$("custom-minutes").addEventListener("change",()=>{const n=Number($("custom-minutes").value);if(!Number.isInteger(n)||n<1||n>1440){toast(t("invalidDuration"));$("custom-minutes").value=selected;return}selected=n;renderDurations();updateClock()});
function currentElapsed(){return elapsed+(active&&!paused?(Date.now()-startedAt)/1000:0)}
function updateClock(){const seconds=active?(free?currentElapsed():selected*60-currentElapsed()):free?0:selected*60;$("clock").textContent=fmt(seconds);$("timer-label").textContent=active?(paused?t("paused"):free?t("elapsed"):t("here")):t("forPractice")}
function updateButtons(){$("start").disabled=active;$("pause").disabled=!active;$("finish").disabled=!active;$("pause").textContent=paused?t("resume"):t("pause");$("countup").disabled=active;$("custom-minutes").disabled=active;renderDurations();updateClock()}
// v3.5: HTMLMediaElement playback (WAV) for iOS media audio routing.
// Audio is started synchronously from the user's tap, not after await.
const soundFiles={bell:'./bell.wav',bowl:'./bowl.wav',gong:'./gong.wav',chime:'./chime.wav'};
const soundPlayers={};
let audioUnlocked=false;
function player(kind){
 const key=soundFiles[kind]?kind:'bell';
 if(!soundPlayers[key]){
  const a=new Audio(soundFiles[key]);a.preload='auto';a.volume=1;
  soundPlayers[key]=a;
 }
 return soundPlayers[key];
}
function playSound(kind,report=false){
 try{
  const a=player(kind);
  a.pause();a.currentTime=0;
  const promise=a.play();
  if(promise&&typeof promise.then==='function')promise.then(()=>{audioUnlocked=true}).catch(err=>{
   console.warn('Media playback rejected',err);
   if(report)toast(t('audioUnavailable')==='audioUnavailable'?'No se pudo reproducir el audio. Revisa el volumen y el modo silencio.':t('audioUnavailable'));
  });
  return true;
 }catch(err){console.warn('Media playback error',err);if(report)toast(t('audioUnavailable')==='audioUnavailable'?'No se pudo reproducir el audio.':t('audioUnavailable'));return false}
}
function chime(){if($('bell').checked)playSound($('sound').value)}
$('preview-sound').addEventListener('click',()=>playSound($('sound').value,true));
$('sound').value=localStorage.getItem('presencia-sound')||'bell';
$('sound').onchange=e=>localStorage.setItem('presencia-sound',e.target.value);
// Prime playback from the direct start gesture; no asynchronous AudioContext.
function unlockSound(){
 if(!$('bell').checked)return;
 playSound($('sound').value);
}
function begin(){if(active)return;free=$("countup").checked;active=true;paused=false;elapsed=0;startedAt=Date.now();chime();tick=setInterval(()=>{if(!active||paused)return;if(!free&&currentElapsed()>=selected*60){elapsed=selected*60;end(true)}else updateClock()},250);updateButtons();saveSession()}
function pause(){if(!active)return;if(paused){startedAt=Date.now();paused=false}else{elapsed=currentElapsed();paused=true}updateButtons();saveSession()}
function end(completed=false){if(!active)return;const sec=completed?selected*60:currentElapsed();clearInterval(tick);active=false;paused=false;saveSession();updateButtons();if(completed)chime();const minutes=Math.max(1,Math.round(sec/60));$("entry-date").value=dateKey();$("entry-minutes").value=minutes;$("entry-type").value=$("practice").value;changeTab("diario");toast(t("finishedToast"));}
$("start").onclick=begin;$("pause").onclick=pause;$("finish").onclick=()=>end(false);
$("countup").onchange=()=>{free=$("countup").checked;updateClock()};
document.addEventListener("visibilitychange",()=>{if(active&&!paused)updateClock()});
$("save-entry").onclick=()=>{const date=$("entry-date").value,minutes=Number($("entry-minutes").value),type=$("entry-type").value,mood=$("entry-mood").value,note=$("entry-note").value.trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(minutes)||minutes<1||minutes>1440){toast(t("invalidEntry"));return}const entry={id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),date,minutes,type,mood,note};if(editingId){const index=entries.findIndex(e=>e.id===editingId);if(index>=0){entry.id=editingId;entries[index]=entry;}editingId=null;$("cancel-edit").hidden=true;}else entries.unshift(entry);if(!persist())return;$("entry-note").value="";$("entry-mood").value="";renderEntries();toast(t("savedToast"))};
function localType(v){const map={"Silencio":"silence","Vipassana":"vipassana","Mindfulness":"mindfulness","Mantra":"mantra","Respiración":"breathing","Caminando":"walking","Otra":"other"};return map[v]?t(map[v]):v}
function localMood(v){const map={"Prefiero no indicar":"moodNone","En calma":"moodCalm","Con inquietud":"moodRestless","Con claridad":"moodClear","Con cansancio":"moodTired","Otro":"moodOther"};return map[v]?t(map[v]):v}
function renderEntries(){const parent=$("entries");parent.replaceChildren();if(!entries.length){const p=document.createElement("p");p.className="muted";p.textContent=t("emptyJournal");parent.append(p);return}entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).forEach(e=>{const div=document.createElement("div");div.className="entry";const del=document.createElement("button");del.textContent=t("deleteOne");del.setAttribute("aria-label",t("deletePractice"));del.onclick=()=>{if(confirm(t("confirmDelete"))){entries=entries.filter(x=>x.id!==e.id);persist();renderEntries()}};const strong=document.createElement("strong");strong.textContent=`${e.date} · ${e.minutes} ${t("minuteAbbr")} · ${localType(e.type)}`;const small=document.createElement("small");small.textContent=localMood(e.mood);const edit=document.createElement("button");edit.textContent=t("editOne");edit.onclick=()=>editEntry(e);div.append(del,edit,strong,document.createElement("br"),small);if(e.note){const p=document.createElement("p");p.textContent=e.note;div.append(p)}parent.append(div)})}
let calendarOffset=0;
let editingId=null;
function editEntry(e){editingId=e.id;$("entry-date").value=e.date;$("entry-minutes").value=e.minutes;$("entry-type").value=e.type;$("entry-mood").value=e.mood;$("entry-note").value=e.note;$("cancel-edit").hidden=false;changeTab("diario");window.scrollTo(0,0)}
$("cancel-edit").onclick=()=>{editingId=null;$("cancel-edit").hidden=true;$("entry-note").value=""};
function renderStats(){const total=entries.reduce((a,e)=>a+e.minutes,0),unique=new Set(entries.map(e=>e.date));$("stat-total").textContent=total;$("stat-sessions").textContent=entries.length;$("stat-days").textContent=unique.size;$("stat-month").textContent=entries.filter(e=>e.date.slice(0,7)===dateKey().slice(0,7)).reduce((a,e)=>a+e.minutes,0);const week=$("week");week.replaceChildren();const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);const key=dateKey(d);days.push({date:key,label:[t("weekdaySun"),t("weekdayMon"),t("weekdayTue"),t("weekdayWed"),t("weekdayThu"),t("weekdayFri"),t("weekdaySat")][d.getDay()],minutes:entries.filter(e=>e.date===key).reduce((a,e)=>a+e.minutes,0)})}const max=Math.max(1,...days.map(d=>d.minutes));days.forEach(d=>{const box=document.createElement("div");box.className="day";const num=document.createElement("span");num.textContent=d.minutes+" "+t("minuteAbbr");const bar=document.createElement("div");bar.className="bar";bar.style.height=Math.max(3,d.minutes/max*85)+"px";const label=document.createElement("span");label.textContent=d.label;box.append(num,bar,label);week.append(box)});renderCalendar()}
function renderCalendar(){const base=new Date();base.setDate(1);base.setMonth(base.getMonth()+calendarOffset);const year=base.getFullYear(),month=base.getMonth();$("month-label").textContent=base.toLocaleDateString(language,{month:"long",year:"numeric"});const cal=$("calendar");cal.replaceChildren();["weekdayMon","weekdayTue","weekdayWed","weekdayThu","weekdayFri","weekdaySat","weekdaySun"].map(t).forEach(x=>{const a=document.createElement("strong");a.className="cal-day blank";a.textContent=x;cal.append(a)});const start=(new Date(year,month,1).getDay()+6)%7;for(let i=0;i<start;i++){const a=document.createElement("span");a.className="cal-day blank";cal.append(a)}const count=new Date(year,month+1,0).getDate();const prefix=`${year}-${String(month+1).padStart(2,"0")}-`;for(let day=1;day<=count;day++){const a=document.createElement("span");a.className="cal-day";a.textContent=day;const key=prefix+String(day).padStart(2,"0");if(entries.some(e=>e.date===key))a.classList.add("done");cal.append(a)}}
$("prev-month").onclick=()=>{calendarOffset--;renderCalendar()};$("next-month").onclick=()=>{calendarOffset++;renderCalendar()};
function download(name,text,mime){const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
$("export-json").onclick=()=>download("presencia-respaldo-"+dateKey()+".json",JSON.stringify({version:1,entries},null,2),"application/json");
function csvCell(v){const s=String(v??"");return '"'+s.replace(/"/g,'""')+'"'}
$("export-csv").onclick=()=>{const rows=[["fecha","minutos","tipo","estado","notas"],...entries.map(e=>[e.date,e.minutes,e.type,e.mood,e.note])];download("presencia-practicas-"+dateKey()+".csv","\ufeff"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n"),"text/csv;charset=utf-8")};
$("import-json").onchange=async ev=>{const file=ev.target.files[0];if(!file)return;if(file.size>5_000_000){toast(t("tooLarge"));return}try{const obj=JSON.parse(await file.text());if(obj.version!==1||!Array.isArray(obj.entries)||!obj.entries.every(valid))throw Error(t("badFormat"));const existing=new Set(entries.map(e=>e.id));const incoming=obj.entries.filter(e=>!existing.has(e.id));entries=[...entries,...incoming];if(!persist())throw Error(t("saveError"));toast(`${incoming.length} ${t("imported")}`);renderEntries()}catch(err){toast(t("importError")+" "+err.message)}ev.target.value=""};
$("delete-all").onclick=()=>{if(confirm(t("confirmDeleteAll"))&&confirm(t("confirmDeleteAgain"))){entries=[];persist();renderEntries();toast(t("deletedAll"))}};
let installPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("install").hidden=false});$("install").onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install").hidden=true};
$("theme").value=localStorage.getItem("presencia-theme")||"auto";
function setTheme(v){document.documentElement.dataset.theme=v;localStorage.setItem("presencia-theme",v)}
$("theme").onchange=e=>setTheme(e.target.value);setTheme($("theme").value);
$("print-diary").onclick=()=>{const win=window.open("","_blank");if(!win){toast(t("popupPrint"));return}const doc=win.document;doc.title="Yorgánica Presencia · "+t("printJournal");const style=doc.createElement("style");style.textContent="body{font:15px system-ui;max-width:720px;margin:40px auto;padding:20px;color:#34473e}h1{font-family:Georgia,serif}article{border-bottom:1px solid #ddd;padding:16px 0}p{white-space:pre-wrap;overflow-wrap:anywhere}";doc.head.append(style);const title=doc.createElement("h1");title.textContent="Yorgánica Presencia · "+t("printJournal");doc.body.append(title);entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).forEach(e=>{const art=doc.createElement("article");const head=doc.createElement("h3");head.textContent=`${e.date} · ${e.minutes} ${t("minuteAbbr")} · ${localType(e.type)}`;const mood=doc.createElement("small");mood.textContent=localMood(e.mood);const para=doc.createElement("p");para.textContent=e.note;art.append(head,mood,para);doc.body.append(art)});win.focus();setTimeout(()=>win.print(),400)};
try{const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||"null");if(saved&&saved.active&&Number.isFinite(saved.elapsed)&&Number.isFinite(saved.startedAt)&&saved.startedAt<=Date.now()&&saved.startedAt>Date.now()-7*86400000){selected=saved.selected;free=saved.free;paused=saved.paused;elapsed=saved.elapsed;startedAt=saved.startedAt;active=true;$("countup").checked=free;$("custom-minutes").value=selected;tick=setInterval(()=>{if(active&&!paused){if(!free&&currentElapsed()>=selected*60){elapsed=selected*60;end(true)}else updateClock()}},250);if(!free&&currentElapsed()>=selected*60){elapsed=selected*60;end(true)}}}catch{}
$("entry-date").value=dateKey();renderDurations();updateClock();renderEntries();renderStats();applyLanguage();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));

// Accesos rápidos del manifiesto: solo preparan el temporizador; nunca comienzan una sesión automáticamente.
try { const choice = new URLSearchParams(location.search).get('timer'); if (choice === 'free') { document.getElementById('countup').checked = true; free = true; updateClock(); } else if (['5','10','20'].includes(choice)) { selected = Number(choice); document.getElementById('countup').checked = false; free = false; document.getElementById('custom-minutes').value = selected; renderDurations(); updateClock(); } } catch {}
