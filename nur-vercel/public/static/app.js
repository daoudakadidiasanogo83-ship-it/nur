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
S.adj = Object.assign({fajr:0, dhuhr:0, asr:0, maghrib:0, isha:0}, S.adj || {});
S.fixed = Object.assign({fajr:"", dhuhr:"", asr:"", maghrib:"", isha:""}, S.fixed || {});
const LOCAL_DEFAULTS = {Bamako:{dhuhr:"14:00", asr:"16:00"}};   // heures de prière usuelles de la mosquée (modifiables dans Paramètres)
if (!S.fixedInit) { S.fixedInit = true; if (LOCAL_DEFAULTS[S.city] && !S.geo) Object.assign(S.fixed, LOCAL_DEFAULTS[S.city]); store.set("s", S); }
const save = () => store.set("s", S);
const place = () => S.geo ? {lat:S.geo[0],lng:S.geo[1],tz:S.geo[2],name:"Ma position"} : {lat:CITIES[S.city][0],lng:CITIES[S.city][1],tz:CITIES[S.city][2],name:S.city};

/* ---------- Calcul des horaires (algorithme astronomique, hors connexion) ---------- */
function tzOff(tz, d) {   // décalage du fuseau en minutes
  const o = {}; new Intl.DateTimeFormat("en-US", {timeZone:tz, hourCycle:"h23", year:"numeric", month:"numeric", day:"numeric", hour:"numeric", minute:"numeric"}).formatToParts(d).forEach(x => o[x.type] = +x.value);
  return (Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes())) / 6e4;
}
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
  for (const k in h) out[k] = new Date(base + h[k] * 36e5 + (S.adj[k] || 0) * 6e4);   // ajustement manuel en minutes
  const tz = place().tz, off = tzOff(tz, new Date(Date.UTC(y, m, d, 12)));
  for (const k in S.fixed) if (/^\d\d:\d\d$/.test(S.fixed[k])) { const [hh, mm] = S.fixed[k].split(":").map(Number); out[k] = new Date(Date.UTC(y, m, d, hh, mm) - off * 6e4); }   // heure de la mosquée
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
  if (anim() && id === "home") gsap.from(".chip, .t", {y:16, opacity:0, stagger:.05, duration:.4, clearProps:"all"});
  if (anim()) gsap.fromTo("#" + id, {opacity:0, y:14}, {opacity:1, y:0, duration:.35, ease:"power2.out", clearProps:"all"});
}
addEventListener("hashchange", route);

/* ---------- Accueil + Prières ---------- */
const hijriFmt = (d, o) => new Intl.DateTimeFormat("fr-u-ca-islamic-umalqura", o).format(d);
let P = null, lastNotif = "";
function compute() {
  const pl = place(), now = new Date();
  P = {...pl, times: prayerTimes(now, pl.lat, pl.lng)};
  $("#where").textContent = "📍 " + pl.name;
  $("#strip").innerHTML = NAMES.filter(([k]) => k !== "sunrise").map(([k, n]) => `<div class="chip" data-k="${k}">${n}<b>${fmt(P.times[k], pl.tz)}</b></div>`).join("");
  $("#hijri").textContent = hijriFmt(now, {day:"numeric", month:"long", year:"numeric"});
  $("#pMeta").textContent = `${pl.name} · méthode ${S.method} · ${now.toLocaleDateString("fr-FR", {weekday:"long", day:"numeric", month:"long"})}`;
  $("#pList").innerHTML = NAMES.map(([k, n]) => `<li data-k="${k}"><span>${n}${S.fixed[k] ? ' <span class="muted small">· heure de la mosquée</span>' : ""}</span><b>${fmt(P.times[k], pl.tz)}</b></li>`).join("");
  qiblaInit();
}
function tick() {
  if (!P) return;
  const now = new Date(), nx = nextPrayer(now, P);
  $("#nextName").textContent = nx.n; $("#nextTime").textContent = fmt(nx.at, P.tz);
  const s = Math.max(0, Math.round((nx.at - now) / 1000)), p2 = x => String(x).padStart(2, "0");
  $("#countdown").textContent = `dans ${p2(Math.floor(s / 3600))}:${p2(Math.floor(s % 3600 / 60))}:${p2(s % 60)}`;
  $("#hero").dataset.p = nx.k; $$("#strip .chip").forEach(c => c.classList.toggle("now", c.dataset.k === nx.k));
  $$("#pList li").forEach(li => li.classList.toggle("now", li.dataset.k === nx.k));
  if (S.notif && !S.push && "Notification" in window && Notification.permission === "granted" && s === 0 && lastNotif !== nx.k + nx.at) {
    lastNotif = nx.k + nx.at; new Notification("NUR", {body:`C'est l'heure de ${nx.n}`, icon:"/static/icon-192.png"});
  }
}
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { compute(); tick(); } });

/* ---------- Coran ---------- */
const SURAHS = [["الفاتحة", "Al-Fâtiha"], ["البقرة", "Al-Baqara"], ["آل عمران", "Âl ʿImrân"], ["النساء", "An-Nisâ’"], ["المائدة", "Al-Mâ’ida"], ["الأنعام", "Al-An’âm"], ["الأعراف", "Al-A’râf"], ["الأنفال", "Al-Anfâl"], ["التوبة", "At-Tawba"], ["يونس", "Yûnus"], ["هود", "Hûd"], ["يوسف", "Yûsuf"], ["الرعد", "Ar-Ra’d"], ["إبراهيم", "Ibrâhîm"], ["الحجر", "Al-Hijr"], ["النحل", "An-Nahl"], ["الإسراء", "Al-Isrâ’"], ["الكهف", "Al-Kahf"], ["مريم", "Maryam"], ["طه", "Tâ-Hâ"], ["الأنبياء", "Al-Anbiyâ’"], ["الحج", "Al-Hajj"], ["المؤمنون", "Al-Mu’minûn"], ["النور", "An-Nûr"], ["الفرقان", "Al-Furqân"], ["الشعراء", "Ash-Shu’arâ’"], ["النمل", "An-Naml"], ["القصص", "Al-Qasas"], ["العنكبوت", "Al-’Ankabût"], ["الروم", "Ar-Rûm"], ["لقمان", "Luqmân"], ["السجدة", "As-Sajda"], ["الأحزاب", "Al-Ahzâb"], ["سبأ", "Saba’"], ["فاطر", "Fâtir"], ["يس", "Yâ-Sîn"], ["الصافات", "As-Sâffât"], ["ص", "Sâd"], ["الزمر", "Az-Zumar"], ["غافر", "Ghâfir"], ["فصلت", "Fussilat"], ["الشورى", "Ash-Shûrâ"], ["الزخرف", "Az-Zukhruf"], ["الدخان", "Ad-Dukhân"], ["الجاثية", "Al-Jâthiya"], ["الأحقاف", "Al-Ahqâf"], ["محمد", "Muhammad"], ["الفتح", "Al-Fath"], ["الحجرات", "Al-Hujurât"], ["ق", "Qâf"], ["الذاريات", "Adh-Dhâriyât"], ["الطور", "At-Tûr"], ["النجم", "An-Najm"], ["القمر", "Al-Qamar"], ["الرحمن", "Ar-Rahmân"], ["الواقعة", "Al-Wâqi’a"], ["الحديد", "Al-Hadîd"], ["المجادلة", "Al-Mujâdala"], ["الحشر", "Al-Hashr"], ["الممتحنة", "Al-Mumtahana"], ["الصف", "As-Saff"], ["الجمعة", "Al-Jumu’a"], ["المنافقون", "Al-Munâfiqûn"], ["التغابن", "At-Taghâbun"], ["الطلاق", "At-Talâq"], ["التحريم", "At-Tahrîm"], ["الملك", "Al-Mulk"], ["القلم", "Al-Qalam"], ["الحاقة", "Al-Hâqqa"], ["المعارج", "Al-Ma’ârij"], ["نوح", "Nûh"], ["الجن", "Al-Jinn"], ["المزمل", "Al-Muzzammil"], ["المدثر", "Al-Muddaththir"], ["القيامة", "Al-Qiyâma"], ["الإنسان", "Al-Insân"], ["المرسلات", "Al-Mursalât"], ["النبأ", "An-Naba’"], ["النازعات", "An-Nâzi’ât"], ["عبس", "’Abasa"], ["التكوير", "At-Takwîr"], ["الانفطار", "Al-Infitâr"], ["المطففين", "Al-Mutaffifîn"], ["الانشقاق", "Al-Inshiqâq"], ["البروج", "Al-Burûj"], ["الطارق", "At-Târiq"], ["الأعلى", "Al-A’lâ"], ["الغاشية", "Al-Ghâshiya"], ["الفجر", "Al-Fajr"], ["البلد", "Al-Balad"], ["الشمس", "Ash-Shams"], ["الليل", "Al-Layl"], ["الضحى", "Ad-Duhâ"], ["الشرح", "Ash-Sharh"], ["التين", "At-Tîn"], ["العلق", "Al-’Alaq"], ["القدر", "Al-Qadr"], ["البينة", "Al-Bayyina"], ["الزلزلة", "Az-Zalzala"], ["العاديات", "Al-’Âdiyât"], ["القارعة", "Al-Qâri’a"], ["التكاثر", "At-Takâthur"], ["العصر", "Al-’Asr"], ["الهمزة", "Al-Humaza"], ["الفيل", "Al-Fîl"], ["قريش", "Quraysh"], ["الماعون", "Al-Mâ’ûn"], ["الكوثر", "Al-Kawthar"], ["الكافرون", "Al-Kâfirûn"], ["النصر", "An-Nasr"], ["المسد", "Al-Masad"], ["الإخلاص", "Al-Ikhlâs"], ["الفلق", "Al-Falaq"], ["الناس", "An-Nâs"]];
const nm = n => SURAHS[n - 1] ? SURAHS[n - 1][1] : "Sourate " + n;
let QURAN = null;
async function loadJSON(n) { const r = await fetch("/data/" + n + ".json"); if (!r.ok) throw 0; return r.json(); }
function qList(filter = "") {
  const f = filter.trim().toLowerCase();
  $("#qList").innerHTML = SURAHS.map(([ar, fr], i) => ({n:i + 1, ar, fr})).filter(s => !f || String(s.n) === f || s.fr.toLowerCase().includes(f) || s.ar.includes(f))
    .map(s => `<li class="tap" data-n="${s.n}"><span>${s.n}. ${s.fr}</span><span class="ar" style="font-size:1.3rem;line-height:1.5">${s.ar}</span></li>`).join("");
}
async function initQuran() { try { QURAN = await loadJSON("quran"); } catch { QURAN = []; } qList(); }
async function getSurah(n) {
  const loc = QURAN && QURAN.find(x => x.n === n); if (loc) return loc;                 // texte importé (tools/import_quran.py)
  try { const c = await idbGet("q:" + n); if (c) return JSON.parse(c); } catch {}        // déjà chargé : lisible hors connexion
  const res = await fetch(`https://api.alquran.cloud/v1/surah/${n}/editions/quran-uthmani,fr.hamidullah`); if (!res.ok) throw 0;
  const d = (await res.json()).data, ar = d[0].ayahs.map(a => a.text), fr = d[1].ayahs.map(a => a.text);
  if (n !== 1 && n !== 9 && ar[0].startsWith("بِسْمِ")) ar[0] = ar[0].split(" ").slice(4).join(" ");   // la basmala n'est pas un verset
  const s = {n, verses:ar.map((t, i) => ({ar:t, fr:fr[i]})), note:"Source : Al Quran Cloud (texte uthmani, traduction Hamidullah)"};
  try { await idbPut("q:" + n, JSON.stringify(s)); } catch {}
  return s;
}
$("#qSearch").addEventListener("input", e => qList(e.target.value));
$("#qList").addEventListener("click", async e => {
  const li = e.target.closest("li[data-n]"); if (!li) return;
  const n = +li.dataset.n, r = $("#qRead"); $("#qList").hidden = $("#qSearch").hidden = true; r.hidden = false; window.scrollTo(0, 0);
  const back = '<button class="ghost" id="qBack">‹ Sourates</button>';
  r.innerHTML = back + `<h3>${n}. ${nm(n)}</h3><p class="muted">Chargement…</p>`;
  const wire = () => { $("#qBack").onclick = () => { r.hidden = true; $("#qList").hidden = $("#qSearch").hidden = false; }; }; wire();
  try {
    const s = await getSurah(n); store.set("qlast", {n});
    r.innerHTML = back + `<h3>${n}. ${nm(n)} <span class="ar" style="font-size:1.5rem">${SURAHS[n - 1][0]}</span></h3>` + (s.note ? `<p class="muted small">${s.note}</p>` : "") +
      s.verses.map((v, i) => `<div class="v"><p class="ar">${v.ar} ﴿${i + 1}﴾</p><p>${v.fr}</p></div>`).join(""); wire();
    if (anim()) gsap.from("#qRead .v:nth-of-type(-n+12)", {opacity:0, y:12, duration:.3, stagger:.05, clearProps:"all"});
  } catch { r.innerHTML = back + `<h3>${n}. ${nm(n)}</h3><p class="card">Une connexion est nécessaire pour charger cette sourate la première fois. Elle sera ensuite disponible sans connexion.</p>`; wire(); }
});

/* ---------- Audio ---------- */
let AUD = [], aCur = null, aRec = 0, aURL = null, HAVE = new Set(), unlocked = false;
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
const IDB = () => new Promise((ok, ko) => { const r = indexedDB.open("nur", 1); r.onupgradeneeded = () => r.result.createObjectStore("audio"); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
const idb = async (mode, fn) => { const d = await IDB(); return new Promise((ok, ko) => { const t = d.transaction("audio", mode), q = fn(t.objectStore("audio")); t.oncomplete = () => ok(q && q.result); t.onerror = () => ko(t.error); }); };
const idbGet = k => idb("readonly", s => s.get(k)), idbPut = (k, v) => idb("readwrite", s => s.put(v, k)), idbDel = k => idb("readwrite", s => s.delete(k)), idbKeys = () => idb("readonly", s => s.getAllKeys());
const refreshHave = async () => { try { HAVE = new Set(await idbKeys()); } catch { HAVE = new Set(); } };
const persist = () => navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {});
async function initAudio() { try { AUD = await loadJSON("audio"); } catch {} await refreshHave(); }
const LOCAL = {id:"local", name:"Mes fichiers (sur cet appareil)", local:true};
const reciters = () => [...AUD.filter(r => r.available && r.available.length), LOCAL];
const sName = n => `${n}. ${nm(n)}`;
const nums = r => r.local ? [...HAVE].filter(k => k.startsWith("local:")).map(k => +k.slice(6)).sort((a, b) => a - b) : r.available;
const url3 = (r, n) => `${r.base}${r.pad === false ? n : String(n).padStart(3, "0")}.mp3`;
const msg = h => { const m = $("#aMsg"); if (m) m.innerHTML = h; };
function rows(r) {
  const ns = nums(r); if (!ns.length) return "";
  return `<ul class="rows">${ns.map(n => { const off = HAVE.has(`${r.id}:${n}`);
    return `<li data-n="${n}" data-r="${r.id}"><span class="tap"><b>${sName(n)}</b> <span class="ar" style="font-size:1.15rem;line-height:1.6">${SURAHS[n - 1][0]}</span>${off && !r.local ? ' <span class="muted small">✓ sur l\'appareil</span>' : ""}</span><span class="acts">` +
      `<button class="star" data-act="play" aria-label="Lecture ou pause">▶</button>` +
      (r.local ? `<button class="star" data-act="del" aria-label="Supprimer">✕</button>` : `<button class="star" data-act="dl" aria-label="Télécharger">⬇</button>` + (off ? `<button class="star" data-act="del" aria-label="Retirer la copie de l'appareil">✕</button>` : "")) +
      `</span></li>`; }).join("")}</ul>`;
}
function renderAudio() {
  const RS = reciters(); aRec = Math.min(aRec, RS.length - 1); const r = RS[aRec];
  const prev = typeof PREVIEW !== "undefined" ? `<p class="card">Aperçu : l'hébergeur de cet aperçu bloque l'écoute en ligne et le téléchargement. Ils fonctionnent dans l'application déployée.</p>` : "";
  $("#aList").innerHTML = prev + `<label>Récitateur<select id="aSel">${RS.map((x, i) => `<option value="${i}">${x.name}</option>`).join("")}</select></label>
    <label class="row"><input type="checkbox" id="aAuto" ${store.get("autonext", true) ? "checked" : ""}> Lecture automatique de la sourate suivante</label>` +
    (r.local ? `<p class="muted small">Ajoutez vos propres fichiers audio, nommés 001.mp3 (Al-Fâtiha) à 114.mp3. Ils restent sur cet appareil, marchent sans connexion et ne sont envoyés nulle part.</p>
      <label class="filebtn">Ajouter des fichiers<input id="aFiles" type="file" accept="audio/*" multiple hidden></label>`
      : `<p class="muted small">Source : <a href="${r.source}" rel="noopener">${r.source}</a> · ${r.licence}. ⬇ enregistre la sourate sur votre téléphone et la garde disponible sans connexion.</p>`) +
    `<p class="muted small" id="aMsg"></p>` + rows(r);
  $("#aSel").value = aRec; $("#aSel").onchange = e => { aRec = +e.target.value; renderAudio(); };
  $("#aAuto").onchange = e => store.set("autonext", e.target.checked);
  const f = $("#aFiles"); if (f) f.onchange = async e => {
    let k = 0; try { for (const file of e.target.files) { const n = +((file.name.replace(/\.[^.]*$/, "").match(/\d+/) || [])[0]); if (n >= 1 && n <= 114) { await idbPut(`local:${n}`, file); k++; } } persist(); }
    catch { msg("Stockage indisponible sur cet appareil (navigation privée ?)."); return; }
    await refreshHave(); renderAudio(); msg(k ? `${k} fichier(s) ajouté(s).` : "Nom de fichier non reconnu : utilisez 001.mp3 à 114.mp3.");
  };
  markPlaying();
}
function markPlaying() {
  const el = $("#aEl");
  $$("#aList li[data-n]").forEach(li => { const on = aCur && aCur.id === li.dataset.r && aCur.n === +li.dataset.n; li.classList.toggle("now", !!on);
    const b = li.querySelector("[data-act=play]"); if (b) b.textContent = on && !el.paused ? "⏸" : "▶"; });
}
function unlockAudio() { if (unlocked) return; unlocked = true; const el = $("#aEl"); el.src = SILENT; el.play().catch(() => {}); }   // iPhone : autorise la lecture ensuite
function saveBlob(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
async function download(r, n) {
  msg(`Téléchargement : ${sName(n)}…`);
  try {
    const res = await fetch(url3(r, n)); if (!res.ok) throw new Error("HTTP " + res.status);
    const blob = await res.blob();
    try { await idbPut(`${r.id}:${n}`, blob); persist(); await refreshHave(); } catch {}
    saveBlob(blob, `${String(n).padStart(3, "0")}-${nm(n).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9-]/g, "")}.mp3`); renderAudio(); msg(`${sName(n)} : enregistrée sur votre appareil.`);
  } catch {
    msg(`Téléchargement bloqué par le navigateur. <a href="${esc(url3(r, n))}" target="_blank" rel="noopener" download>Ouvrir le fichier</a>, puis menu ⋮ ou Partager &gt; Enregistrer.`);
  }
}
async function playSurah(id, n) {
  const r = reciters().find(x => x.id === id), el = $("#aEl");
  if (aCur && aCur.id === id && aCur.n === n && el.src && el.src !== SILENT) { el.paused ? el.play().catch(() => {}) : el.pause(); return; }   // même sourate : lecture/pause
  aCur = {id, n}; $("#aPlayer").hidden = false; $("#aNow").textContent = `${sName(n)} · ${r.name}`;
  let src = r.local ? null : url3(r, n);
  if (HAVE.has(`${id}:${n}`)) { try { const b = await idbGet(`${id}:${n}`); if (b) { if (aURL) URL.revokeObjectURL(aURL); src = aURL = URL.createObjectURL(b); } } catch {} }
  if (!aCur || aCur.id !== id || aCur.n !== n || !src) return;
  el.src = src; el.play().catch(() => { $("#aNow").textContent = "Lecture bloquée : touchez ▶ dans le lecteur."; });
  if ("mediaSession" in navigator) {
    const ns = nums(r), i = ns.indexOf(n), ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({title:sName(n), artist:r.name, album:"NUR"});
    ms.setActionHandler("play", () => el.play()); ms.setActionHandler("pause", () => el.pause());
    ms.setActionHandler("nexttrack", i >= 0 && i < ns.length - 1 ? () => playSurah(id, ns[i + 1]) : null);
    ms.setActionHandler("previoustrack", i > 0 ? () => playSurah(id, ns[i - 1]) : null);
  }
  markPlaying();
}
$("#aList").addEventListener("click", async e => {
  const li = e.target.closest("li[data-n]"); if (!li) return;
  const n = +li.dataset.n, id = li.dataset.r, r = reciters().find(x => x.id === id), act = e.target.dataset.act || "play";
  if (act === "play") { unlockAudio(); playSurah(id, n); }
  else if (act === "dl") download(r, n);
  else { try { await idbDel(`${id}:${n}`); } catch {} await refreshHave(); renderAudio(); }
});
for (const ev of ["play", "pause", "ended"]) $("#aEl").addEventListener(ev, markPlaying);
$("#aEl").addEventListener("error", () => { if ($("#aEl").src === SILENT) return; $("#aNow").textContent = navigator.onLine === false ? "Pas de connexion : touchez ⬇ sur une sourate quand vous avez du réseau, ou ajoutez vos fichiers." : "Fichier introuvable pour cette sourate."; });
$("#aEl").addEventListener("ended", () => {
  if (!aCur || !store.get("autonext", true)) return;
  const r = reciters().find(x => x.id === aCur.id), ns = nums(r), i = ns.indexOf(aCur.n); if (i >= 0 && i < ns.length - 1) playSurah(aCur.id, ns[i + 1]);
});

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
const KAABA = [21.4225, 39.8262];
let qBearing = 0, heading = null, dialAngle = 0, qOK = false;
(function ticks() {
  let s = ""; for (let i = 0; i < 36; i++) { const L = i % 3 === 0; s += `<line class="${L ? "l" : ""}" x1="150" y1="${L ? 14 : 14}" x2="150" y2="${L ? 28 : 22}" transform="rotate(${i * 10} 150 150)"/>`; }
  [["N", 0], ["E", 90], ["S", 180], ["O", 270]].forEach(([t, a]) => s += `<text class="${t === "N" ? "n" : ""}" x="150" y="52" transform="rotate(${a} 150 150)">${t}</text>`);
  $("#ticks").innerHTML = s;
})();
function qiblaInit() {
  const p = place(), la = p.lat * R, lo = (KAABA[1] - p.lng) * R, k = KAABA[0] * R;
  qBearing = (Math.atan2(Math.sin(lo), Math.cos(la) * Math.tan(k) - Math.sin(la) * Math.cos(lo)) / R + 360) % 360;
  const dl = (KAABA[0] - p.lat) * R, dg = (KAABA[1] - p.lng) * R, h = Math.sin(dl / 2) ** 2 + Math.cos(la) * Math.cos(k) * Math.sin(dg / 2) ** 2;
  $("#qDeg").textContent = Math.round(qBearing) + "°"; $("#qKm").textContent = Math.round(12742 * Math.asin(Math.sqrt(h))).toLocaleString("fr-FR") + " km";
  $("#qMark").setAttribute("transform", `rotate(${qBearing} 150 150)`); drawDial();
}
function drawDial() {
  if (heading == null) { $("#dial").style.transform = "rotate(0deg)"; return; }
  dialAngle += ((((-heading - dialAngle) % 360) + 540) % 360) - 180;          // chemin le plus court
  $("#dial").style.transform = `rotate(${dialAngle}deg)`;
  const ok = Math.abs((((qBearing - heading) % 360) + 540) % 360 - 180) <= 4;
  $("#qibla").classList.toggle("ok", ok);
  $("#qHint").textContent = ok ? "Vous faites face à la Qibla ✓" : "Tournez-vous jusqu'à ce que la Kaaba soit en haut.";
  if (ok && !qOK && navigator.vibrate) navigator.vibrate(40); qOK = ok;
}
function onOrient(e) {
  const h = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute || e.type === "deviceorientationabsolute") && e.alpha != null ? 360 - e.alpha : null;
  if (h != null) { heading = h; drawDial(); }
}
$("#qBtn").onclick = async () => {
  try {
    if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission && await DeviceOrientationEvent.requestPermission() !== "granted") throw 0;
    addEventListener("deviceorientationabsolute", onOrient, true); addEventListener("deviceorientation", onOrient, true);
    $("#qBtn").hidden = true;
    setTimeout(() => { if (heading == null) { $("#qBtn").hidden = false; $("#qHint").textContent = "Pas de capteur disponible : la Kaaba est placée dans sa direction depuis le nord."; } }, 1800);
  } catch { $("#qHint").textContent = "Accès à la boussole refusé. Autorisez-le dans les réglages du navigateur."; }
};

/* ---------- Invocations ---------- */
let DH = [], dCat = "matin", dShow = Object.assign({ar:true, ph:true, fr:true}, store.get("dshow", {}));
async function initDhikr() { try { DH = await loadJSON("invocations"); } catch {} renderDhikr(); }
function renderDhikr() {
  const favs = store.get("fav", []), cats = ["matin", "soir", "sommeil", "repas", "sorties", "prière", "quotidien", "favoris"];
  $("#dTabs").innerHTML = cats.map(c => `<button class="${c === dCat ? "on" : ""}" data-c="${c}">${c[0].toUpperCase() + c.slice(1)}</button>`).join("");
  $("#dShow").innerHTML = [["ar", "Arabe"], ["ph", "Phonétique"], ["fr", "Traduction"]].map(([k, l]) => `<button class="${dShow[k] ? "on" : ""}" data-s="${k}">${l}</button>`).join("");
  const l = DH.filter(x => dCat === "favoris" ? favs.includes(x.id) : x.cat === dCat);
  $("#dList").innerHTML = l.length ? l.map(x => `<div class="card" data-x="${x.id}"><div class="cardtop"><button class="star" data-say="${x.id}" aria-label="Écouter la lecture">🔊</button><button class="star" data-id="${x.id}" aria-label="Favori">${favs.includes(x.id) ? "★" : "☆"}</button></div>` +
    (x.t ? `<p class="dt">${x.t}</p>` : "") + (dShow.ar ? `<p class="ar">${x.ar}</p>` : "") + (dShow.ph && x.ph ? `<p class="ph">${x.ph}</p>` : "") + (dShow.fr ? `<p>${x.fr}</p>` : "") +
    `<p class="muted small">${x.src}</p><p class="muted small" data-m></p></div>`).join("") : `<p class="muted">Aucune invocation ici pour l'instant.</p>`;
}
function speak(id, card) {
  const x = DH.find(d => d.id === id), m = card.querySelector("[data-m]");
  if (!("speechSynthesis" in window)) { m.textContent = "La lecture à voix haute n'est pas disponible sur ce navigateur."; return; }
  speechSynthesis.cancel(); const voice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith("ar"));
  if (!voice) { m.textContent = "Aucune voix arabe installée sur cet appareil : ajoutez-la dans les réglages de voix du téléphone."; return; }
  const u = new SpeechSynthesisUtterance(x.ar); u.lang = voice.lang; u.voice = voice; u.rate = .75; m.textContent = "Lecture par la voix de synthèse de l'appareil."; speechSynthesis.speak(u);
}
$("#dTabs").onclick = e => { const c = e.target.dataset.c; if (c) { dCat = c; renderDhikr(); } };
$("#dShow").onclick = e => { const s = e.target.dataset.s; if (s) { dShow[s] = !dShow[s]; store.set("dshow", dShow); renderDhikr(); } };
$("#dList").onclick = e => {
  const id = e.target.dataset.id, say = e.target.dataset.say;
  if (say) return speak(say, e.target.closest(".card"));
  if (!id) return; let f = store.get("fav", []); f = f.includes(id) ? f.filter(x => x !== id) : [...f, id]; store.set("fav", f); renderDhikr();
};

/* ---------- Tasbih ---------- */
const DZ = [
  {k:"subhan", ar:"سُبْحَانَ اللَّهِ", fr:"Gloire à Allah", n:"Subhan’Allah", c:["#6c5ce7", "#ff6b9d"]},
  {k:"hamd", ar:"الْحَمْدُ لِلَّهِ", fr:"Louange à Allah", n:"Alhamdulillah", c:["#0ea5e9", "#14c8a0"]},
  {k:"akbar", ar:"اللَّهُ أَكْبَرُ", fr:"Allah est le plus grand", n:"Allahu akbar", c:["#ff9f1c", "#ff5d73"]},
  {k:"tahlil", ar:"لَا إِلَٰهَ إِلَّا اللَّهُ", fr:"Il n’y a de divinité qu’Allah", n:"La ilaha illallah", c:["#4338ca", "#38bdf8"]},
  {k:"istighfar", ar:"أَسْتَغْفِرُ اللَّهَ", fr:"Je demande pardon à Allah", n:"Astaghfirullah", c:["#059669", "#84cc16"]}];
const ymd = d => d.toLocaleDateString("sv-SE");
let TC = Object.assign({k:"subhan", g:33, cnt:{}, day:"", today:0, cycles:0, streak:0, last:"", total:0, vib:true, snd:false}, store.get("tc", {}));
TC.cnt = TC.cnt && typeof TC.cnt === "object" ? TC.cnt : {};
const rollDay = () => { const t = ymd(new Date()); if (TC.day !== t) { TC.day = t; TC.today = 0; TC.cycles = 0; } };
function drawT() {
  rollDay(); const d = DZ.find(x => x.k === TC.k) || DZ[0], c = TC.cnt[d.k] || 0, g = TC.g, C = 326.73;
  const T = $("#tasbih"); T.style.setProperty("--c1", d.c[0]); T.style.setProperty("--c2", d.c[1]);
  $("#tzAr").textContent = d.ar; $("#tzFr").textContent = `${d.n} · ${d.fr}`;
  $("#tCount").textContent = c; $("#tGoalTxt").textContent = g ? `sur ${g}` : "libre";
  $("#tzRing").style.strokeDashoffset = g ? C * (1 - Math.min(1, c / g)) : C * (1 - ((c % 100) / 100));
  const t = ymd(new Date()), y = ymd(new Date(Date.now() - 864e5));
  $("#tToday").textContent = TC.today; $("#tCycles").textContent = TC.cycles; $("#tStreak").textContent = TC.last === t || TC.last === y ? TC.streak : 0; $("#tTotal").textContent = TC.total;
  $("#tGoal").value = String(g); $("#tVib").checked = TC.vib; $("#tSnd").checked = TC.snd;
  $("#tzTabs").innerHTML = DZ.map(x => `<button class="${x.k === TC.k ? "on" : ""}" data-k="${x.k}">${x.n}</button>`).join("");
  store.set("tc", TC);
}
let ac = null;
function blip(f = 660, dur = .06, at = 0) {
  if (!TC.snd) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + at;
    o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(.06, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur); } catch {}
}
function say(txt) { const m = $("#tMsg"); m.textContent = txt; m.classList.remove("pop"); void m.offsetWidth; m.classList.add("pop"); }
function burst() { const r = $(".ring"); for (let i = 0; i < 18; i++) { const p = document.createElement("span"), a = Math.random() * 6.28, d = 90 + Math.random() * 70;
  p.className = "pt"; p.style.setProperty("--dx", Math.cos(a) * d + "px"); p.style.setProperty("--dy", Math.sin(a) * d + "px"); r.appendChild(p); setTimeout(() => p.remove(), 900); } }
$("#tapBtn").onclick = e => {
  const t = ymd(new Date()), y = ymd(new Date(Date.now() - 864e5)); rollDay();
  if (TC.last !== t) { TC.streak = TC.last === y ? TC.streak + 1 : 1; TC.last = t; }
  const g = TC.g; let c = TC.cnt[TC.k] || 0; if (g && c >= g) c = 0; c++; TC.cnt[TC.k] = c; TC.today++; TC.total++;
  if (!calm) { const b = $("#tapBtn"), r = b.getBoundingClientRect(), s = document.createElement("span"); s.className = "rip";
    s.style.left = (e.clientX ? e.clientX - r.left : r.width / 2) + "px"; s.style.top = (e.clientY ? e.clientY - r.top : r.height / 2) + "px"; b.appendChild(s); setTimeout(() => s.remove(), 650);
    if (anim()) gsap.fromTo("#tCount", {scale:1.25}, {scale:1, duration:.25, ease:"back.out(3)"}); }
  if (g && c >= g) {
    TC.cycles++; if (TC.vib && navigator.vibrate) navigator.vibrate([60, 40, 140]); blip(880, .12); blip(1175, .2, .12);
    say(["Masha Allah ! Cycle terminé ✨", "Qu’Allah accepte 🤲", "Quelle belle régularité 🌟"][TC.cycles % 3]); if (!calm) burst();
  } else {
    if (TC.vib && navigator.vibrate) navigator.vibrate(12); blip(520 + (c % 10) * 18, .04);
    if (g && c === Math.round(g / 2)) say("À mi-chemin, continue 💪"); else if (g && c === g - 3) say("Plus que 3 !"); else if (g && c === 1 && TC.cycles) say("C’est reparti 🔥");
    else if (!g && c % 100 === 0) say(`${c} déjà, continue !`);
  }
  drawT();
};
$("#tzTabs").onclick = e => { const k = e.target.dataset.k; if (k) { TC.k = k; say("Prêt ? Touchez le cercle"); drawT(); } };
$("#tReset").onclick = () => { TC.cnt[TC.k] = 0; say("Compteur remis à zéro"); drawT(); };
$("#tGoal").onchange = e => { TC.g = +e.target.value; drawT(); };
$("#tVib").onchange = e => { TC.vib = e.target.checked; drawT(); };
$("#tSnd").onchange = e => { TC.snd = e.target.checked; drawT(); blip(660, .08); };

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
  const r = await fetch("/api/push/subscribe", {method:"POST", headers:JH, body:JSON.stringify({sub:sub.toJSON(), lat:p.lat, lng:p.lng, tz:p.tz, method:S.method, asr:S.asr, adj:["fajr", "dhuhr", "asr", "maghrib", "isha"].map(k => S.adj[k]), fixed:["fajr", "dhuhr", "asr", "maghrib", "isha"].map(k => S.fixed[k])})});
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
  for (const k of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) { const f = $("#fx_" + k); f.value = S.fixed[k]; f.onchange = () => { S.fixed[k] = f.value; upd(); }; }
  $("#fxPreset").onclick = () => { Object.assign(S.fixed, {dhuhr:"14:00", asr:"16:00"}); for (const k in S.fixed) $("#fx_" + k).value = S.fixed[k]; upd(); };
  $("#fxClear").onclick = () => { for (const k in S.fixed) { S.fixed[k] = ""; $("#fx_" + k).value = ""; } upd(); };
  for (const k of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) { const i = $("#adj_" + k); i.value = S.adj[k];
    i.onchange = () => { S.adj[k] = Math.max(-120, Math.min(120, Math.round(+i.value || 0))); i.value = S.adj[k]; upd(); }; }
  $("#sGeo").onclick = () => navigator.geolocation ? navigator.geolocation.getCurrentPosition(
    p => { S.geo = [p.coords.latitude, p.coords.longitude, Intl.DateTimeFormat().resolvedOptions().timeZone]; upd(); $("#sGeo").textContent = "Position utilisée ✓"; },
    () => { $("#sGeo").textContent = "Position refusée : choisissez une ville"; }) : 0;
}

/* ---------- Démarrage ---------- */
applyTheme(); initSettings(); compute(); tick(); drawT(); route();
initDon(); installUI(); Promise.all([initQuran(), initAudio()]).then(renderAudio); initDhikr();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", {scope:"/"}).catch(() => {});
