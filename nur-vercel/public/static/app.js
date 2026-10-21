"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const R = Math.PI / 180;
const CITIES = {Bamako:[12.6392,-8.0029,"Africa/Bamako"],Dakar:[14.6928,-17.4467,"Africa/Dakar"],Abidjan:[5.36,-4.0083,"Africa/Abidjan"],Ouagadougou:[12.3714,-1.5197,"Africa/Ouagadougou"],Conakry:[9.6412,-13.5784,"Africa/Conakry"],Niamey:[13.5116,2.1254,"Africa/Niamey"],Paris:[48.8566,2.3522,"Europe/Paris"],Bruxelles:[50.8503,4.3517,"Europe/Brussels"],Montréal:[45.5017,-73.5673,"America/Toronto"],Casablanca:[33.5731,-7.5898,"Africa/Casablanca"],Alger:[36.7538,3.0588,"Africa/Algiers"],Tunis:[36.8065,10.1815,"Africa/Tunis"],"Le Caire":[30.0444,31.2357,"Africa/Cairo"],"La Mecque":[21.3891,39.8579,"Asia/Riyadh"],Médine:[24.5247,39.5692,"Asia/Riyadh"]};
const METHODS = {MWL:[18,17],UOIF:[12,12],ISNA:[15,15],Egypt:[19.5,17.5],Karachi:[18,18],UmmAlQura:[18.5,"90"]};
const NAMES = [["fajr","Fajr"],["sunrise","Lever du soleil"],["dhuhr","Dhuhr"],["asr","Asr"],["maghrib","Maghrib"],["isha","Isha"]];
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const anim = () => window.gsap && !calm;
const store = {get:(k,d)=>{try{const v=localStorage.getItem("nur."+k);return v==null?d:JSON.parse(v)}catch{return d}},
  set:(k,v)=>{try{localStorage.setItem("nur."+k,JSON.stringify(v))}catch{}}};
let S = Object.assign({city:"Bamako",method:"MWL",asr:1,theme:"auto",notif:false,geo:null}, store.get("s", {}));
const save = () => store.set("s", S);
const place = () => S.geo ? {lat:S.geo[0],lng:S.geo[1],tz:S.geo[2],name:"Ma position"} : {lat:CITIES[S.city][0],lng:CITIES[S.city][1],tz:CITIES[S.city][2],name:S.city};

/* ---------- Calcul des horaires (algorithme astronomique, hors connexion) ---------- */
function prayerTimes(date, lat, lng) {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  const jd = Date.UTC(y, m, d, 12) / 864e5 + 2440587.5, n = jd - 2451545;
  const fix = (a, b) => ((a % b) + b) % b;
  const g = fix(357.529 + 0.98560028 * n, 360), q = fix(280.459 + 0.98564736 * n, 360);
  const L = fix(q + 1.915 * Math.sin(g * R) + 0.02 * Math.sin(2 * g * R), 360), e = 23.439 - 3.6e-7 * n;
  const RA = fix(Math.atan2(Math.cos(e * R) * Math.sin(L * R), Math.cos(L * R)) / R / 15, 24);
  const decl = Math.asin(Math.sin(e * R) * Math.sin(L * R)) / R;
  let eqt = q / 15 - RA; if (eqt > 12) eqt -= 24; if (eqt < -12) eqt += 24;
  const noon = 12 - lng / 15 - eqt;                       // midi solaire, heures UTC
  const T = a => { const c = (-Math.sin(a * R) - Math.sin(decl * R) * Math.sin(lat * R)) / (Math.cos(decl * R) * Math.cos(lat * R));
    return Math.acos(Math.max(-1, Math.min(1, c))) / R / 15; };
  const [fa, ia] = METHODS[S.method] || METHODS.MWL;
  const asrAlt = Math.atan(1 / (+S.asr + Math.tan(Math.abs(lat - decl) * R))) / R;
  const h = {fajr:noon-T(fa), sunrise:noon-T(0.833), dhuhr:noon, asr:noon+T(-asrAlt), maghrib:noon+T(0.833)};
  h.isha = ia === "90" ? h.maghrib + 1.5 : noon + T(ia);
  const base = Date.UTC(y, m, d), out = {};
  for (const k in h) out[k] = new Date(base + h[k] * 36e5);
  return out;
}
const fmt = (dt, tz) => dt.toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit", timeZone:tz});
function nextPrayer(now, p) {
  for (const [k, n] of NAMES) if (k !== "sunrise" && p.times[k] > now) return {k, n, at:p.times[k]};
  const t = prayerTimes(new Date(now.getTime() + 864e5), p.lat, p.lng);
  return {k:"fajr", n:"Fajr", at:t.fajr};
}

/* ---------- Navigation ---------- */
const PAGES = ["home","prayers","quran","audio","qibla","dhikr","tasbih","ramadan","settings","don","more"];
const NAVMAP = {audio:"more",qibla:"more",dhikr:"more",tasbih:"more",ramadan:"more",settings:"more",don:"more"};
function route() {
  let id = location.hash.slice(1); if (!PAGES.includes(id)) id = "home";
  PAGES.forEach(p => $("#" + p).classList.toggle("on", p === id));
  $$("nav a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + (NAVMAP[id] || id)));
  if (id === "ramadan") renderRamadan();
  window.scrollTo(0, 0);
  if (anim()) gsap.fromTo("#" + id, {opacity:0, y:14}, {opacity:1, y:0, duration:.35, ease:"power2.out", clearProps:"all"});
}
addEventListener("hashchange", route);

/* ---------- Accueil + Prières ---------- */
const hijriFmt = (d, o) => new Intl.DateTimeFormat("fr-u-ca-islamic-umalqura", o).format(d);
let P = null, lastNotif = "";
function compute() {
  const pl = place(), now = new Date();
  P = {...pl, times: prayerTimes(now, pl.lat, pl.lng)};
  $("#where").textContent = `${pl.name} · méthode ${S.method}`;
  $("#hijri").textContent = hijriFmt(now, {weekday:"long", day:"numeric", month:"long", year:"numeric"}) + " (calendrier Umm al-Qura)";
  $("#pMeta").textContent = `${pl.name} · ${now.toLocaleDateString("fr-FR", {weekday:"long", day:"numeric", month:"long"})}`;
  $("#pList").innerHTML = NAMES.map(([k, n]) => `<li data-k="${k}"><span>${n}</span><b>${fmt(P.times[k], pl.tz)}</b></li>`).join("");
  qiblaInit();
}
let sunDone = false; const sunO = {f:0};
function drawSun(f) { const a = Math.PI * (1 - f); $("#sun").setAttribute("cx", 150 + 130 * Math.cos(a)); $("#sun").setAttribute("cy", 120 - 110 * Math.sin(a)); }
function tick() {
  if (!P) return;
  const now = new Date(), nx = nextPrayer(now, P);
  $("#nextName").textContent = nx.n; $("#nextTime").textContent = fmt(nx.at, P.tz);
  const s = Math.max(0, Math.round((nx.at - now) / 1000)), p2 = x => String(x).padStart(2, "0");
  $("#countdown").textContent = `dans ${p2(Math.floor(s / 3600))}:${p2(Math.floor(s % 3600 / 60))}:${p2(s % 60)}`;
  const t = P.times, f = Math.max(0, Math.min(1, (now - t.sunrise) / (t.maghrib - t.sunrise)));
  if (!sunDone && anim()) { sunDone = true; sunO.f = 0; gsap.to(sunO, {f, duration:1.8, ease:"power2.out", onUpdate:() => drawSun(sunO.f)}); }
  else if (!window.gsap || !gsap.isTweening(sunO)) { sunDone = true; drawSun(f); }
  $$("#pList li").forEach(li => li.classList.toggle("now", li.dataset.k === nx.k));
  if (S.notif && !S.push && "Notification" in window && Notification.permission === "granted" && s === 0 && lastNotif !== nx.k + nx.at) {
    lastNotif = nx.k + nx.at; new Notification("NUR", {body:`C'est l'heure de ${nx.n}`, icon:"/static/icon-192.png"});
  }
}
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { compute(); tick(); } });

/* ---------- Coran ---------- */
let QURAN = null;
async function loadJSON(n) { const r = await fetch("/data/" + n + ".json"); if (!r.ok) throw 0; return r.json(); }
function qList(filter = "") {
  const f = filter.trim().toLowerCase();
  $("#qList").innerHTML = QURAN.filter(s => !f || String(s.n) === f || s.fr.toLowerCase().includes(f) || s.ar.includes(f))
    .map(s => `<li class="tap" data-n="${s.n}"><span>${s.n}. ${s.fr}</span><span class="ar" style="font-size:1.3rem;line-height:1.5">${s.ar}</span></li>`).join("");
}
async function initQuran() {
  try { QURAN = await loadJSON("quran"); } catch { $("#qList").innerHTML = "<li>Contenu indisponible hors connexion pour l'instant.</li>"; return; }
  const full = QURAN.length === 114;
  $("#qHead").innerHTML = full ? "" : `<p class="card">Version d'essai : ${QURAN.length} sourate(s). Lancez <code>python tools/import_quran.py</code> pour charger les 114 sourates.</p>`;
  qList();
}
$("#qSearch").addEventListener("input", e => QURAN && qList(e.target.value));
$("#qList").addEventListener("click", e => {
  const li = e.target.closest("li[data-n]"); if (!li) return;
  const s = QURAN.find(x => x.n == li.dataset.n), last = store.get("qlast", {});
  $("#qList").hidden = $("#qSearch").hidden = true; const r = $("#qRead"); r.hidden = false;
  r.innerHTML = `<button class="ghost" id="qBack">‹ Sourates</button><h3>${s.n}. ${s.fr}</h3>` + (s.note ? `<p class="muted small">${s.note}</p>` : "") +
    s.verses.map((v, i) => `<div class="v"><p class="ar">${v.ar} ﴿${i + 1}﴾</p><p>${v.fr}</p></div>`).join("");
  store.set("qlast", {n:s.n}); window.scrollTo(0, 0);
  if (anim()) gsap.from("#qRead .v:nth-of-type(-n+12)", {opacity:0, y:12, duration:.3, stagger:.05, clearProps:"all"});
  $("#qBack").onclick = () => { r.hidden = true; $("#qList").hidden = $("#qSearch").hidden = false; };
});

/* ---------- Audio ---------- */
let AUD = [], aCur = null, aRec = 0, aURL = null, HAVE = new Set();
const IDB = () => new Promise((ok, ko) => { const r = indexedDB.open("nur", 1); r.onupgradeneeded = () => r.result.createObjectStore("audio"); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
const idb = async (mode, fn) => { const d = await IDB(); return new Promise((ok, ko) => { const t = d.transaction("audio", mode), q = fn(t.objectStore("audio")); t.oncomplete = () => ok(q && q.result); t.onerror = () => ko(t.error); }); };
const idbGet = k => idb("readonly", s => s.get(k)), idbPut = (k, v) => idb("readwrite", s => s.put(v, k)), idbDel = k => idb("readwrite", s => s.delete(k)), idbKeys = () => idb("readonly", s => s.getAllKeys());
const refreshHave = async () => { try { HAVE = new Set(await idbKeys()); } catch { HAVE = new Set(); } };
const persist = () => navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {});
async function initAudio() { try { AUD = await loadJSON("audio"); } catch {} await refreshHave(); }
const LOCAL = {id:"local", name:"Mes fichiers (sur cet appareil)", local:true};
const reciters = () => [...AUD.filter(r => r.available && r.available.length), LOCAL];
const sName = n => { const s = QURAN && QURAN.find(x => x.n === n); return s ? `${n}. ${s.fr}` : `Sourate ${n}`; };
const nums = r => r.local ? [...HAVE].filter(k => k.startsWith("local:")).map(k => +k.slice(6)).sort((a, b) => a - b) : r.available;
const url3 = (r, n) => `${r.base}${r.pad === false ? n : String(n).padStart(3, "0")}.mp3`;
function rows(r) {
  const ns = nums(r); if (!ns.length) return "";
  return `<ul class="rows">${ns.map(n => { const off = HAVE.has(`${r.id}:${n}`);
    return `<li data-n="${n}" data-r="${r.id}"><span class="tap">${sName(n)}${off && !r.local ? " ✓" : ""}</span><span>` +
      (r.local || off ? `<button class="star" data-act="del" aria-label="Supprimer de cet appareil">✕</button>` : `<button class="star" data-act="dl" aria-label="Télécharger pour écouter hors connexion">⬇</button>`) +
      `<button class="star" data-act="play" aria-label="Lire">▶</button></span></li>`; }).join("")}</ul>`;
}
function renderAudio() {
  const RS = reciters(); aRec = Math.min(aRec, RS.length - 1); const r = RS[aRec];
  $("#aList").innerHTML = `<label>Récitateur<select id="aSel">${RS.map((x, i) => `<option value="${i}">${x.name}</option>`).join("")}</select></label>` +
    (r.local ? `<p class="muted small">Ajoutez vos propres fichiers audio, nommés 001.mp3 (Al-Fâtiha) à 114.mp3. Ils restent sur cet appareil, marchent sans connexion et ne sont envoyés nulle part.</p>
      <label class="filebtn">Ajouter des fichiers<input id="aFiles" type="file" accept="audio/*" multiple hidden></label>`
      : `<p class="muted small">Source : <a href="${r.source}" rel="noopener">${r.source}</a> · ${r.licence}. Touchez ⬇ pour écouter sans connexion.</p>`) +
    `<p class="muted small" id="aMsg"></p>` + rows(r);
  $("#aSel").value = aRec; $("#aSel").onchange = e => { aRec = +e.target.value; renderAudio(); };
  const f = $("#aFiles"); if (f) f.onchange = async e => {
    let k = 0; try { for (const file of e.target.files) { const n = +((file.name.replace(/\.[^.]*$/, "").match(/\d+/) || [])[0]); if (n >= 1 && n <= 114) { await idbPut(`local:${n}`, file); k++; } } persist(); }
    catch { $("#aMsg").textContent = "Stockage indisponible sur cet appareil (navigation privée ?)."; return; }
    await refreshHave(); renderAudio(); $("#aMsg").textContent = k ? `${k} fichier(s) ajouté(s).` : "Nom de fichier non reconnu : utilisez 001.mp3 à 114.mp3.";
  };
}
async function download(r, n) {
  $("#aMsg").textContent = `Téléchargement : ${sName(n)}…`;
  try { const res = await fetch(url3(r, n)); if (!res.ok) throw 0; await idbPut(`${r.id}:${n}`, await res.blob()); persist(); await refreshHave(); renderAudio(); $("#aMsg").textContent = `${sName(n)} est disponible hors connexion.`; }
  catch { $("#aMsg").textContent = "Téléchargement impossible (connexion ou serveur audio). L'écoute en ligne reste possible."; }
}
async function playSurah(id, n) {
  const r = reciters().find(x => x.id === id), el = $("#aEl"); aCur = {id, n}; $("#aPlayer").hidden = false;
  let src = null; try { const b = await idbGet(`${id}:${n}`); if (b) { if (aURL) URL.revokeObjectURL(aURL); src = aURL = URL.createObjectURL(b); } } catch {}
  el.src = src || url3(r, n); $("#aNow").textContent = `${sName(n)} · ${r.name}`;
  el.play().catch(() => { $("#aNow").textContent = "Lecture impossible : touchez ▶ ou vérifiez le fichier."; });
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({title:sName(n), artist:r.name, album:"NUR"});
}
$("#aList").addEventListener("click", async e => {
  const li = e.target.closest("li[data-n]"); if (!li) return;
  const n = +li.dataset.n, id = li.dataset.r, r = reciters().find(x => x.id === id), act = e.target.dataset.act || "play";
  if (act === "play") playSurah(id, n);
  else if (act === "dl") download(r, n);
  else { try { await idbDel(`${id}:${n}`); } catch {} await refreshHave(); renderAudio(); }
});
$("#aEl").addEventListener("error", () => { $("#aNow").textContent = navigator.onLine === false ? "Pas de connexion : touchez ⬇ sur une sourate quand vous avez du réseau, ou ajoutez vos fichiers." : "Fichier introuvable pour cette sourate."; });
$("#aEl").addEventListener("ended", () => { if (!aCur) return; const r = reciters().find(x => x.id === aCur.id), ns = nums(r), i = ns.indexOf(aCur.n); if (i >= 0 && i < ns.length - 1) playSurah(aCur.id, ns[i + 1]); });

/* ---------- Dons ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function initDon() {
  let d = {}; try { d = await loadJSON("don"); } catch {}
  const m = d.methods || [];
  $("#donList").innerHTML = m.length ? m.map(x => `<li><span>${esc(x.label)}<br><span class="muted small">${esc(x.value || "")}</span></span>` +
    (x.url && /^https:\/\//.test(x.url) ? `<a class="btnlink" href="${esc(x.url)}" rel="noopener">Donner</a>` : `<button class="ghost" data-copy="${esc(x.value || "")}">Copier</button>`) + `</li>`).join("")
    : "";
  $("#donNote").textContent = m.length ? "" : "Les moyens de don seront annoncés très bientôt.";
  $("#donTr").textContent = d.transparence || "";
}
$("#donList").addEventListener("click", async e => { const v = e.target.dataset.copy; if (v == null) return;
  try { await navigator.clipboard.writeText(v); e.target.textContent = "Copié ✓"; } catch { e.target.textContent = "Copiez à la main"; } });

/* ---------- Installation (nécessaire aux rappels sur iPhone) ---------- */
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let deferred = null;
function installUI() {
  const box = $("#install"); box.hidden = true;
  if (standalone() || store.get("noInstall", false)) return;
  if (isIOS) { box.hidden = false; $("#instBtn").hidden = true; $("#instTxt").textContent = "Pour installer NUR et recevoir les rappels : touchez Partager (le carré avec une flèche), puis « Sur l'écran d'accueil »."; }
  else if (deferred) { box.hidden = false; $("#instBtn").hidden = false; $("#instTxt").textContent = "Installez NUR pour l'ouvrir comme une application et l'utiliser hors connexion."; }
}
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; installUI(); });
addEventListener("appinstalled", () => { deferred = null; installUI(); });
$("#instBtn").onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; installUI(); };
$("#instNo").onclick = () => { store.set("noInstall", true); installUI(); };

/* ---------- Qibla ---------- */
let qBearing = 0, heading = null;
function qiblaInit() {
  const p = place(), la = p.lat * R, lo = (39.8262 - p.lng) * R, k = 21.4225 * R;
  qBearing = (Math.atan2(Math.sin(lo), Math.cos(la) * Math.tan(k) - Math.sin(la) * Math.cos(lo)) / R + 360) % 360;
  $("#qDeg").textContent = Math.round(qBearing) + "° depuis le nord"; drawNeedle();
}
const drawNeedle = () => $("#needle").style.transform = `rotate(${heading == null ? qBearing : qBearing - heading}deg)`;
function onOrient(e) {
  const h = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute || e.type === "deviceorientationabsolute") && e.alpha != null ? 360 - e.alpha : null;
  if (h != null) { heading = h; drawNeedle(); $("#qHint").textContent = "Tournez-vous jusqu'à ce que la flèche pointe vers le haut."; }
}
$("#qBtn").onclick = async () => {
  try {
    if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission && await DeviceOrientationEvent.requestPermission() !== "granted") throw 0;
    addEventListener("deviceorientationabsolute", onOrient, true); addEventListener("deviceorientation", onOrient, true);
    setTimeout(() => { if (heading == null) $("#qHint").textContent = "Pas de capteur disponible : la flèche indique la direction depuis le nord."; }, 1500);
  } catch { $("#qHint").textContent = "Accès à la boussole refusé. Autorisez-le dans les réglages du navigateur."; }
};

/* ---------- Invocations ---------- */
let DH = [], dCat = "matin";
async function initDhikr() { try { DH = await loadJSON("invocations"); } catch {} renderDhikr(); }
function renderDhikr() {
  const favs = store.get("fav", []), cats = ["matin", "soir", "prière", "favoris"];
  $("#dTabs").innerHTML = cats.map(c => `<button class="${c === dCat ? "on" : ""}" data-c="${c}">${c[0].toUpperCase() + c.slice(1)}</button>`).join("");
  const l = DH.filter(x => dCat === "favoris" ? favs.includes(x.id) : x.cat === dCat);
  $("#dList").innerHTML = l.length ? l.map(x => `<div class="card"><button class="star" data-id="${x.id}" aria-label="Favori">${favs.includes(x.id) ? "★" : "☆"}</button><p class="ar">${x.ar}</p><p>${x.fr}</p><p class="muted small">${x.src}</p></div>`).join("") : `<p class="muted">Aucune invocation ici pour l'instant.</p>`;
}
$("#dTabs").onclick = e => { const c = e.target.dataset.c; if (c) { dCat = c; renderDhikr(); } };
$("#dList").onclick = e => { const id = e.target.dataset.id; if (!id) return; let f = store.get("fav", []); f = f.includes(id) ? f.filter(x => x !== id) : [...f, id]; store.set("fav", f); renderDhikr(); };

/* ---------- Tasbih ---------- */
let TC = store.get("tc", {c:0, t:0, g:33});
function drawT() { $("#tCount").textContent = TC.c; $("#tTotal").textContent = TC.t; $("#tGoal").value = String(TC.g); store.set("tc", TC); }
$("#tapBtn").onclick = () => { TC.c++; TC.t++; if (anim()) gsap.fromTo("#tCount", {scale:1.3}, {scale:1, duration:.25, ease:"back.out(3)"});
  if (TC.g && TC.c >= TC.g) { navigator.vibrate && navigator.vibrate(200); if (anim()) gsap.fromTo("#tapBtn", {boxShadow:"0 0 0 0 rgba(224,176,74,.8)"}, {boxShadow:"0 0 0 36px rgba(224,176,74,0)", duration:.7, clearProps:"boxShadow"}); TC.c = 0; } else navigator.vibrate && navigator.vibrate(15); drawT(); };
$("#tReset").onclick = () => { TC.c = 0; drawT(); };
$("#tGoal").onchange = e => { TC.g = +e.target.value; drawT(); };

/* ---------- Ramadan ---------- */
function renderRamadan() {
  if (!P) return;
  const hp = d => { const o = {}; new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {day:"numeric", month:"numeric", year:"numeric"}).formatToParts(d).forEach(x => o[x.type] = +x.value); return o; };
  const today = new Date(), days = []; let started = false;
  for (let i = -29; i < 420; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, 12), h = hp(d);
    if (h.month === 9) { started = true; days.push({d, h}); } else if (started) break;
  }
  if (!days.length) return;
  $("#rMeta").textContent = `Ramadan ${days[0].h.year} (Umm al-Qura) · début ${days[0].d.toLocaleDateString("fr-FR", {weekday:"long", day:"numeric", month:"long"})}. La date réelle dépend de l'observation de la lune dans votre pays.`;
  $("#rList").innerHTML = days.map(({d, h}) => { const t = prayerTimes(d, P.lat, P.lng);
    return `<li><span>${h.day} · ${d.toLocaleDateString("fr-FR", {weekday:"short", day:"numeric", month:"short"})}</span><span>Imsak ${fmt(t.fajr, P.tz)} · Iftar ${fmt(t.maghrib, P.tz)}</span></li>`; }).join("");
}

/* ---------- Push serveur ---------- */
const b64u = s => Uint8Array.from(atob((s + "=".repeat((4 - s.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const JH = {"Content-Type": "application/json"};
async function pushSync(on) {
  if (!("serviceWorker" in navigator && "PushManager" in window)) return false;
  const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
  if (!on) { if (sub) { await fetch("/api/push/unsubscribe", {method:"POST", headers:JH, body:JSON.stringify({endpoint:sub.endpoint})}); await sub.unsubscribe(); } return false; }
  if (!sub) { const k = (await (await fetch("/api/push/key")).json()).key; if (!k) return false;
    sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64u(k)}); }
  const p = place();
  const r = await fetch("/api/push/subscribe", {method:"POST", headers:JH, body:JSON.stringify({sub:sub.toJSON(), lat:p.lat, lng:p.lng, tz:p.tz, method:S.method, asr:S.asr})});
  return r.ok;
}
/* ---------- Paramètres ---------- */
function applyTheme() { document.documentElement.dataset.theme = S.theme; }
function initSettings() {
  $("#sCity").innerHTML = Object.keys(CITIES).map(c => `<option>${c}</option>`).join("");
  $("#sCity").value = S.city; $("#sMethod").value = S.method; $("#sAsr").value = S.asr; $("#sTheme").value = S.theme; $("#sNotif").checked = S.notif;
  const upd = () => { save(); compute(); tick(); renderRamadan(); if (S.notif && S.push) pushSync(true).catch(() => {}); };
  $("#sCity").onchange = e => { S.city = e.target.value; S.geo = null; upd(); };
  $("#sMethod").onchange = e => { S.method = e.target.value; upd(); };
  $("#sAsr").onchange = e => { S.asr = +e.target.value; upd(); };
  $("#sTheme").onchange = e => { S.theme = e.target.value; applyTheme(); save(); };
  $("#sNotif").onchange = async e => {
    if (e.target.checked && isIOS && !standalone()) { e.target.checked = false; S.notif = false; S.push = false; save();
      $("#nHint").textContent = "Sur iPhone, installez d'abord NUR sur l'écran d'accueil (Partager, puis « Sur l'écran d'accueil »), puis activez les rappels."; return; }
    S.notif = e.target.checked; S.push = false;
    if (S.notif && "Notification" in window && Notification.permission !== "granted") S.notif = (await Notification.requestPermission()) === "granted";
    try { S.push = await pushSync(S.notif); } catch { S.push = false; }
    e.target.checked = S.notif; save();
    $("#nHint").textContent = !S.notif ? "" : S.push ? "Rappels actifs, même application fermée." : "Rappels actifs seulement application ouverte (push indisponible).";
  };
  $("#sGeo").onclick = () => navigator.geolocation ? navigator.geolocation.getCurrentPosition(
    p => { S.geo = [p.coords.latitude, p.coords.longitude, Intl.DateTimeFormat().resolvedOptions().timeZone]; upd(); $("#sGeo").textContent = "Position utilisée ✓"; },
    () => { $("#sGeo").textContent = "Position refusée : choisissez une ville"; }) : 0;
}

/* ---------- Démarrage ---------- */
applyTheme(); initSettings(); compute(); tick(); drawT(); route();
initDon(); installUI(); Promise.all([initQuran(), initAudio()]).then(renderAudio); initDhikr();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", {scope:"/"}).catch(() => {});
