/* Gherwin Fitness — personal fitness tracker. Works offline; syncs laptop <-> phone through Firebase when signed in. */
(() => {
'use strict';

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const KEY = 'gherwin_fitness_v1', META_KEY = 'gherwin_fitness_sync';
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = n => Math.round(n * 10) / 10;
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const pad = n => String(n).padStart(2, '0');
const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ds(new Date());
const addD = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ds(d); };
const dow = s => pd(s).getDay();
const diffD = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DNL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MNL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtD = s => { const d = pd(s); return `${DN[d.getDay()]} ${d.getDate()} ${MN[d.getMonth()]}`; };
const fmtDY = s => { const d = pd(s); return `${d.getDate()} ${MN[d.getMonth()]} ${d.getFullYear()}`; };
const monOf = s => addD(s, -((dow(s) + 6) % 7));
const sunOf = s => addD(s, -dow(s));
const kg = w => (w > 0 ? `${r1(w)} kg` : 'bodyweight');
const fmtTime = sec => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`; };
const parseTime = t => { const p = String(t).trim().split(':').map(Number); if (!String(t).trim() || p.some(isNaN)) return null; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60; };
const pace = (sec, km) => (km > 0 ? fmtTime(sec / km) + ' /km' : '–');
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0) + ':' + s.length; };
const MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Other'];
const mealNow = () => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 18 ? 'Snack' : 'Dinner'; };

// ---------- state ----------
function defaults() {
  const t = today();
  return {
    v: 2, created: t,
    profile: { name: 'Gherwin', age: 24, heightCm: 165, baseWeight: 73, activity: 1.55, goal: 'recomp', kcalOffset: 0, onboarded: false, programStart: monOf(t) },
    overrides: { kcal: null, protein: null, fat: null },
    program: clone(window.DEFAULT_PROGRAM),
    foods: clone(window.DEFAULT_FOODS),
    templates: clone(window.DEFAULT_TEMPLATES),
    sessions: {}, runs: [], days: {}, weights: {}, checkins: [], deloads: {}, moves: {}, skips: {}, savedPrograms: [],
    customEx: [], myQuotes: [], exNotes: {},
    stock: { nitrotech: { size: 40, start: t, adj: 0, tubG: 1810, scoopG: 45 }, creatine: { size: 60, start: t, adj: 0, tubG: 300, scoopG: 5 } },
    grocery: {},
    settings: { waterTarget: 4, bottleOz: 30, stepsTarget: 8000, restC: 150, restI: 75, sound: true, theme: 'light', waterGoalL: null, checkinDays: 28, autoFlow: true, handsFree: false, setSec: 40, notify: true, bgAudio: false, waterRemind: true, waterEvery: 90, waterFrom: 8, waterTo: 22 },
    lastBackup: null
  };
}
let S;
function load() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  normalize();
}
function normalize() {
  const d = defaults();
  if (!S) { S = d; return; }
  for (const k of Object.keys(d)) if (S[k] === undefined) S[k] = d[k];
  for (const k of Object.keys(d.profile)) if (S.profile[k] === undefined) S.profile[k] = d.profile[k];
  for (const k of Object.keys(d.settings)) if (S.settings[k] === undefined) S.settings[k] = d.settings[k];
  for (const [id, f] of Object.entries(d.foods)) if (S.foods[id] && S.foods[id].gPer === undefined) S.foods[id].gPer = f.gPer;
  for (const k of Object.keys(d.stock)) { S.stock[k] = S.stock[k] || d.stock[k]; if (S.stock[k].tubG === undefined) { S.stock[k].tubG = d.stock[k].tubG; S.stock[k].scoopG = d.stock[k].scoopG; } }
}
function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Phone storage is full — make a backup and delete old photos.'); }
}
function save() { saveLocal(); Sync.markChanges(); }

// ---------- theme ----------
function applyTheme(t) {
  t = t || (S && S.settings && S.settings.theme) || localStorage.getItem('gf_theme') || 'light';
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0F1216' : '#FFFFFF';
  try { localStorage.setItem('gf_theme', t); } catch (e) {}
}
applyTheme();

// ---------- exercises (curated + full library + custom) ----------
const IMGBASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const EX = {};
function buildEx() {
  for (const k of Object.keys(EX)) delete EX[k];
  const curatedSrc = new Set();
  for (const e of window.EXERCISES) { EX[e.id] = { ...e, demo: 'local' }; curatedSrc.add(e.src); }
  for (const [id, name, muscle, kind, equip, inc, steps] of (window.EXDB || [])) {
    if (curatedSrc.has(id)) continue;
    EX['x_' + id] = { id: 'x_' + id, src: id, name, muscle, kind, equip, inc, steps, prog: [], demo: 'remote' };
  }
  for (const c of S.customEx || []) EX[c.id] = { ...c, prog: [], demo: 'none', steps: c.notes ? [c.notes] : [], custom: true };
}
const ex = id => EX[id] || { id, name: '(removed exercise)', muscle: 'other', kind: 'i', equip: '', inc: 2.5, steps: [], prog: [], demo: 'none' };
function demoSrc(id, f = 0) { const e = EX[id]; if (!e) return ''; if (e.demo === 'local') return (window.DEMOS && window.DEMOS[`${id}_${f}`]) || `demos/${id}_${f}.jpg`; if (e.demo === 'remote') return `${IMGBASE}${e.src}/${f}.jpg`; return ''; }
function thumb(id, size = 64, extra = '') {
  const src = demoSrc(id), e = ex(id);
  const ph = `<div class="thumb ph" style="width:${size}px;height:${size}px" ${extra}>${esc((e.name || '?').slice(0, 1))}</div>`;
  return src ? `<img class="thumb" style="width:${size}px;height:${size}px" src="${src}" loading="lazy" alt="" ${extra} onerror="this.outerHTML='<div class=&quot;thumb ph&quot; style=&quot;width:${size}px;height:${size}px&quot;>${esc((e.name || '?').slice(0, 1))}</div>'">` : ph;
}
function usedExIds() { const s = new Set(); for (const se of Object.values(S.sessions)) for (const e of se.entries) s.add(e.ex); return [...s]; }

// ---------- photos (IndexedDB, phone only) ----------
const idb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => { const r = indexedDB.open('gherwin_fitness_photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('photos'); r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => rej(r.error); });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction('photos', mode), out = fn(t.objectStore('photos')); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); });
  },
  put(id, v) { return this.tx('readwrite', s => s.put(v, id)); },
  get(id) { return this.tx('readonly', s => s.get(id)); },
  del(id) { return this.tx('readwrite', s => s.delete(id)); },
  clear() { return this.tx('readwrite', s => s.clear()); },
  async all() {
    const db = await this.open();
    return new Promise((res, rej) => { const out = {}, t = db.transaction('photos', 'readonly'), c = t.objectStore('photos').openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); });
  }
};
function resizeImage(file, max = 720) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const sc = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.75)); };
    img.onerror = rej; img.src = url;
  });
}

// ---------- body & targets ----------
function weightSeries() { const m = { ...S.weights }; for (const c of S.checkins) if (c.weight) m[c.date] = c.weight; return Object.keys(m).sort().map(d => ({ d, y: m[d] })); }
function curWeight() { const s = weightSeries(); return s.length ? s[s.length - 1].y : S.profile.baseWeight; }
const latestCheckin = () => (S.checkins.length ? S.checkins[S.checkins.length - 1] : null);
function navyBF(waist, neck, h) { if (!waist || !neck || waist <= neck) return null; return r1(495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450); }
const GOALS = { recomp: 'Recomp (lose fat + build muscle)', leanbulk: 'Lean bulk', cut: 'Cut (fat loss)', maintain: 'Maintain' };
const PROT_K = { recomp: 2.0, leanbulk: 1.8, cut: 2.2, maintain: 1.8 };
function targets() {
  const p = S.profile, w = curWeight(), lc = [...S.checkins].reverse().find(c => c.bf), bf = lc ? lc.bf : null;
  const bmr = bf ? 370 + 21.6 * w * (1 - bf / 100) : 10 * w + 6.25 * p.heightCm - 5 * p.age + 5;
  const tdee = bmr * p.activity, gf = { recomp: 0.95, leanbulk: 1.08, cut: 0.8, maintain: 1 }[p.goal] || 1;
  let kcal = Math.round((tdee * gf + (p.kcalOffset || 0)) / 10) * 10, protein = Math.round(w * (PROT_K[p.goal] || 2)), fat = Math.round(w * 0.9);
  const o = S.overrides; if (o.kcal) kcal = o.kcal; if (o.protein) protein = o.protein; if (o.fat) fat = o.fat;
  return { w, bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carbs: Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)), bf, formula: bf ? 'Katch-McArdle (uses your body fat %)' : 'Mifflin-St Jeor' };
}

// ---------- nutrition ----------
const tplKey = date => ([0, 6].includes(dow(date)) ? 'weekend' : 'weekday');
const food = id => S.foods[id] || { name: '(deleted food)', unit: '', kcal: 0, p: 0, c: 0, f: 0 };
const stepFor = id => (/cup/.test(food(id).unit) ? 0.5 : 1);
function dayRec(date, create) { if (!S.days[date] && create) S.days[date] = { items: {}, extras: [], water: 0, steps: null }; return S.days[date]; }
function dayItems(date) {
  const rec = S.days[date] || { items: {} }, out = [];
  (S.templates[tplKey(date)] || []).forEach((s, si) => s.items.forEach((it, ii) => {
    const k = `${tplKey(date)}:${si}:${ii}`, st = rec.items[k] || {};
    out.push({ key: k, slot: s.slot, food: st.food || it.food, qty: st.qty ?? it.qty, done: !!st.done, alts: it.alts });
  }));
  return out;
}
function extraVals(e) { if (e.food) { const f = food(e.food); return { name: f.name, kcal: f.kcal * e.qty, p: f.p * e.qty, c: f.c * e.qty, f: f.f * e.qty, amt: `${e.qty} × ${f.unit}` }; } return { name: e.name, kcal: e.kcal, p: e.p, c: e.c, f: e.f, amt: e.amt || '' }; }
function dayTotals(date) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 }, rec = S.days[date]; if (!rec) return t;
  const add = v => { t.kcal += v.kcal; t.p += v.p; t.c += v.c; t.f += v.f; };
  for (const v of Object.values(rec.items)) if (v.done) add(extraVals({ food: v.food, qty: v.qty }));
  for (const e of rec.extras || []) add(extraVals(e));
  return t;
}
function plannedTotals(key) { const t = { kcal: 0, p: 0, c: 0, f: 0 }; for (const s of S.templates[key]) for (const it of s.items) { const f = food(it.food); t.kcal += f.kcal * it.qty; t.p += f.p * it.qty; t.c += f.c * it.qty; t.f += f.f * it.qty; } return t; }
function proteinGap(date) { let still = 0; for (const i of dayItems(date)) if (!i.done) still += food(i.food).p * i.qty; return Math.round(targets().protein - dayTotals(date).p - still); }
function closeGap(remP) {
  if (remP <= 3) return null;
  const cands = Object.entries(S.foods).filter(([, f]) => !f.stock && f.p >= 3 && f.p / Math.max(f.kcal, 1) > 0.03).map(([id, f]) => ({ id, ...f }));
  let best = null;
  for (let i = 0; i < cands.length; i++) for (let j = i; j < cands.length; j++) {
    const a = cands[i], b = cands[j];
    for (let qa = 0; qa <= 4; qa++) for (let qb = 0; qb <= 3; qb++) {
      if ((!qa && !qb) || (i === j && qb)) continue;
      const p = a.p * qa + b.p * qb; if (p < remP - 2) continue;
      const score = a.kcal * qa + b.kcal * qb + (p - remP) * 6 + (qa && qb ? 25 : 0);
      if (!best || score < best.score) best = { score, parts: [[a, qa], [b, qb]].filter(x => x[1]), p };
    }
  }
  return best ? best.parts.map(([f, q]) => `${q} × ${f.name.toLowerCase()}`).join(' + ') + ` (~${Math.round(best.p)} g)` : null;
}

// ---------- supplements ----------
function stockUsed(key) {
  const st = S.stock[key]; let used = 0;
  for (const [d, rec] of Object.entries(S.days)) {
    if (d < st.start) continue;
    for (const v of Object.values(rec.items)) if (v.done && food(v.food).stock === key) used += v.qty;
    for (const e of rec.extras || []) if (e.food && food(e.food).stock === key) used += e.qty;
  }
  return used;
}
function plannedStock(key, date) { let n = 0; for (const s of S.templates[tplKey(date)]) for (const it of s.items) if (food(it.food).stock === key) n += it.qty; return n; }
function stockInfo(key) {
  const st = S.stock[key], left = st.size - stockUsed(key) + (st.adj || 0); let rem = left, runout = null;
  const t = today(), rec = S.days[t]; let doneToday = 0;
  if (rec) for (const v of Object.values(rec.items)) if (v.done && food(v.food).stock === key) doneToday += v.qty;
  rem -= Math.max(0, plannedStock(key, t) - doneToday); if (rem <= 0) runout = t;
  for (let i = 1; i < 400 && !runout; i++) { const d = addD(t, i); rem -= plannedStock(key, d); if (rem <= 0) runout = d; }
  return { left: Math.max(0, r1(left)), runout };
}

// ---------- grocery ----------
function groceryWeek() {
  const start = sunOf(today()), agg = {};
  for (let i = 0; i < 7; i++) { const d = addD(start, i); for (const s of S.templates[tplKey(d)]) for (const it of s.items) agg[it.food] = (agg[it.food] || 0) + it.qty; }
  const items = [];
  for (const [id, q] of Object.entries(agg)) {
    const f = food(id), b = f.buy; if (!b) continue; let amt;
    if (b.g) { const g = q * b.g; amt = g >= 1000 ? `${r1(g / 1000)} kg` : `${Math.round(g)} g`; if (b.per) amt += ` (~${Math.max(1, Math.ceil(g / b.per))} ${b.perLabel})`; if (b.note) amt += ` ${b.note}`; amt += ` · ${r1(q)} × ${f.unit.replace(/\s*\(.*\)/, '')}`; }
    else if (b.ml) { const ml = q * b.ml; amt = ml >= 1000 ? `${r1(ml / 1000)} L` : `${Math.round(ml)} ml`; }
    else { const n = Math.ceil(q * (b.pcs || 1)); amt = `${n} ${b.label || 'pcs'}`; if (b.per) amt += ` (~${Math.max(1, Math.ceil(n / b.per))} ${b.perLabel})`; }
    items.push({ id, name: f.name, cat: f.cat || 'Other', amt });
  }
  const nextShop = addD(start, 7);
  for (const key of Object.keys(S.stock)) {
    const si = stockInfo(key), fid = Object.keys(S.foods).find(k => S.foods[k].stock === key); if (!fid) continue;
    if (si.runout && si.runout < nextShop) items.push({ id: 'stock_' + key, name: food(fid).name.replace(/\s*\(.*\)/, ''), cat: 'Supplements', amt: `1 tub — ${si.left} servings left, runs out ${fmtD(si.runout)}` });
  }
  return { start, items };
}

// ---------- training ----------
const e1rm = (w, r) => (w > 0 ? w * (1 + r / 30) : r);
function exHistory(exId, before) {
  const out = [];
  for (const d of Object.keys(S.sessions).sort()) {
    if (before && d >= before) continue;
    if (S.sessions[d].deload) continue; // deload days never count as strength data
    for (const e of S.sessions[d].entries) if (e.ex === exId) {
      const sets = e.sets.filter(x => x.done && num(x.r) > 0).map(x => ({ w: num(x.w) || 0, r: num(x.r) }));
      if (sets.length) out.push({ date: d, sets, best: Math.max(...sets.map(s => e1rm(s.w, s.r))) });
    }
  }
  return out;
}
function suggest(item, date) {
  const e = ex(item.ex), h = exHistory(item.ex, date);
  if (!h.length) return { w: null, kind: 'ok', text: `First time: choose a weight you can do for about ${item.max} reps with 1–2 reps left. Log it and the app takes over next time.` };
  const last = h[h.length - 1], topW = Math.max(...last.sets.map(s => s.w)), atTop = last.sets.filter(s => s.w === topW);
  const hitAll = atTop.length >= item.sets && atTop.every(s => s.r >= item.max);
  const lastStr = last.sets.map(s => (s.w ? `${r1(s.w)}×` : 'BW×') + s.r).join(', ');
  const bw = e.kind === 'b', nxt = e.prog[0] ? ex(e.prog[0].to) : null;
  let w = topW, text, kind = 'ok', prog = null;
  if (hitAll) {
    if (bw && (e.inc === 0 || topW === 0) && nxt) { prog = e.prog[0]; text = e.inc > 0 ? `All sets hit ${item.max}+ reps. Add ${e.inc} kg (belt or dumbbell between the feet), or move up to ${nxt.name}.` : `All sets hit ${item.max}+ reps — time for the harder version: ${nxt.name}.`; }
    else if (bw && e.inc === 0) text = `All sets hit ${item.max}+ reps. Slow the lowering to 3 seconds or add a set to keep progressing.`;
    else { w = r1(topW + (e.inc || 2.5)); text = `You hit ${item.max} reps on every set. Go up to ${kg(w)} and aim for ${item.min}+ reps.`; }
  } else {
    const goal = Math.min(item.max, Math.min(...atTop.map(s => s.r)) + 1);
    text = `Stay at ${kg(topW)} and beat last time: aim for ${goal}+ reps per set. ${item.max} reps on all ${item.sets} sets = add weight.`;
  }
  if (h.length >= 4) {
    const prior = Math.max(...h.slice(0, -3).map(x => x.best));
    if (Math.max(...h.slice(-3).map(x => x.best)) <= prior) { kind = 'warn'; prog = e.prog[0] || null; text = `No progress for 3 sessions. Drop the weight ~10% and build back up, check sleep and protein this week, or switch variation${nxt ? ` (${nxt.name})` : ''}.`; }
  }
  if (kind === 'ok' && /Dumbbell/i.test(e.equip) && w >= 40 && nxt) text += ` Heavy dumbbells get awkward — consider ${nxt.name}.`;
  return { w: w || (bw ? 0 : null), text, kind, prog, last, lastStr };
}
const weekIdx = date => Math.floor(diffD(S.profile.programStart, monOf(date)) / 7);
function isDeloadWeek(date) { const i = weekIdx(date), n = S.program.deloadEvery || 0; return n > 0 && i >= 0 && (i + 1) % n === 0; }
const deloadW = (id, w) => { const inc = ex(id).inc || 2.5; return w > 0 ? Math.max(inc, Math.round(w * 0.6 / inc) * inc) : w; };
function newEntry(it, date, deload) {
  const n = deload ? Math.ceil(it.sets / 2) : it.sets, sg = suggest(it, date);
  const base = sg.last ? Math.max(...sg.last.sets.map(s => s.w)) : sg.w;
  const w = sg.w == null ? '' : (deload ? deloadW(it.ex, base) : sg.w);
  return { ex: it.ex, ss: !!it.ss, t: { sets: it.sets, min: it.min, max: it.max }, sets: Array.from({ length: n }, () => ({ w, r: '', done: false })) };
}
function createSession(date, dayKey, opt = {}) {
  let k = dayKey ?? effKey(date); if (k === 'rest' || !S.program.days[k] || S.program.days[k].type !== 'gym') k = [1, 2, 3, 4, 5, 6, 0].find(x => S.program.days[x].type === 'gym');
  const d = S.program.days[k], deload = !!opt.deload;
  S.sessions[date] = { dow: k, name: d.name, deload, done: false, entries: d.items.map(it => ({ ...newEntry(it, date, deload), ss: !!it.ss })) };
  save(); return S.sessions[date];
}
function sessionPRs(date) {
  const s = S.sessions[date], prs = []; if (!s) return prs;
  for (const e of s.entries) { const h = exHistory(e.ex), i = h.findIndex(x => x.date === date); if (i > 0 && h[i].best > Math.max(...h.slice(0, i).map(x => x.best)) + 0.01) prs.push(e.ex); }
  return [...new Set(prs)];
}
function prCountBetween(a, b) {
  let n = 0;
  for (const id of usedExIds()) { let best = -1; exHistory(id).forEach((x, i) => { if (i > 0 && x.best > best + 0.01 && x.date > a && x.date <= b) n++; best = Math.max(best, x.best); }); }
  return n;
}
const planned = date => S.program.days[dow(date)];
const dayPick = {};
// S.moves[date] = { rest: true, to } (rest day taken, workout moved to "to") or { k, from } (workout moved in from "from")
function effKey(date) { if (dayPick[date] != null) return dayPick[date]; const m = (S.moves || {})[date]; if (m && m.rest) return 'rest'; if (m && m.k != null) return m.k; return dow(date); }
const plannedFor = date => {
  const s = S.sessions[date]; if (s) return { ...S.program.days[s.dow], name: s.name };
  const k = effKey(date), m = (S.moves || {})[date];
  if (k === 'rest') return { type: 'rest', name: 'Rest day (you chose to rest)', items: [], moved: m };
  return { ...S.program.days[k], moved: dayPick[date] == null ? m : null };
};
function dayStatus(date) {
  const p = plannedFor(date), s = S.sessions[date];
  if (s && s.done) return 'done';
  if (S.runs.some(r => r.date === date) && p.type === 'run') return 'done';
  if (date < S.created) return 'pre';
  if (p.type === 'rest') return 'rest';
  return date < today() ? 'miss' : 'plan';
}
function streak() {
  let n = 0, d = dayStatus(today()) === 'done' ? today() : addD(today(), -1);
  for (let i = 0; i < 400; i++) { const st = dayStatus(d); if (st === 'done') n++; else if (st !== 'rest') break; d = addD(d, -1); }
  return n;
}
function weeklyVolume(date) {
  const mon = monOf(date), plan = {}, done = {};
  for (let i = 0; i < 7; i++) {
    const d = addD(mon, i), p = S.program.days[dow(d)];
    for (const it of p.items) { const m = ex(it.ex).muscle; plan[m] = (plan[m] || 0) + it.sets; }
    const s = S.sessions[d]; if (s) for (const e of s.entries) { const m = ex(e.ex).muscle; done[m] = (done[m] || 0) + e.sets.filter(x => x.done).length; }
  }
  return { plan, done };
}
function nextLongRun() {
  const recent = S.runs.filter(r => diffD(r.date, today()) <= 21);
  const longest = recent.length ? Math.max(...recent.map(r => r.km)) : (S.runs.length ? Math.max(...S.runs.map(r => r.km)) : 8);
  return Math.min(10, r1(Math.max(longest, 5) + 0.5));
}

// ---------- growth analysis ----------
function growth() {
  const t = today(), daysData = diffD(S.created, t), T = targets(), res = { tiles: [], tips: [] };
  // strength
  const win = Math.min(28, Math.floor(daysData / 2)); let strength = null;
  if (win >= 7) {
    const aS = addD(t, -win), bS = addD(t, -2 * win), ch = [];
    for (const id of usedExIds()) { const h = exHistory(id), rec = h.filter(x => x.date > aS), prv = h.filter(x => x.date > bS && x.date <= aS); if (rec.length && prv.length) { const p = Math.max(...prv.map(x => x.best)); ch.push((Math.max(...rec.map(x => x.best)) - p) / p * 100); } }
    if (ch.length) strength = { pct: r1(avg(ch)), n: ch.length, win };
  }
  if (!strength) { const ch = []; for (const id of usedExIds()) { const h = exHistory(id); if (h.length >= 2) ch.push((h[h.length - 1].best - h[0].best) / h[0].best * 100); } if (ch.length) strength = { pct: r1(avg(ch)), n: ch.length, sinceStart: true }; }
  // consistency (last 28 days)
  let plannedN = 0, doneN = 0;
  for (let i = 27; i >= 0; i--) { const d = addD(t, -i); if (d < S.created) continue; const st = dayStatus(d); if (st === 'rest' || st === 'pre') continue; if (d === t && st !== 'done') continue; plannedN++; if (st === 'done') doneN++; }
  // weight trend
  const ws = weightSeries(); let wTrend = null;
  if (ws.length >= 2) { const f = ws[0], l = ws[ws.length - 1], days = Math.max(1, diffD(f.d, l.d)); if (days >= 7) wTrend = { perWeek: Math.round((l.y - f.y) / days * 7 * 100) / 100, total: r1(l.y - f.y), days }; }
  // waist
  const cw = S.checkins.filter(c => c.waist); const waist = cw.length >= 2 ? { delta: r1(cw[cw.length - 1].waist - cw[cw.length - 2].waist), since: cw[cw.length - 2].date } : null;
  // shoulder : waist (triangle shape)
  const cr = S.checkins.filter(c => c.shoulders && c.waist); const ratio = cr.length ? { now: Math.round(cr[cr.length - 1].shoulders / cr[cr.length - 1].waist * 100) / 100, prev: cr.length > 1 ? Math.round(cr[cr.length - 2].shoulders / cr[cr.length - 2].waist * 100) / 100 : null } : null;
  // sleep (last 7 nights)
  const sl = []; for (let i = 0; i < 7; i++) { const v = (S.days[addD(t, -i)] || {}).sleep; if (v) sl.push(v); } const sleep = sl.length >= 3 ? r1(avg(sl)) : null;
  // protein (last 7 full days with logs)
  let pDays = 0, pHit = 0;
  for (let i = 1; i <= 7; i++) { const d = addD(t, -i), rec = S.days[d]; if (!rec || (!Object.values(rec.items).some(v => v.done) && !(rec.extras || []).length)) continue; pDays++; if (dayTotals(d).p >= T.protein * 0.9) pHit++; }
  res.tiles.push({ label: 'Strength', val: strength ? `${strength.pct > 0 ? '+' : ''}${strength.pct}%` : '–', sub: strength ? (strength.sinceStart ? `since first log · ${strength.n} lifts` : `last ${strength.win} days · ${strength.n} lifts`) : 'needs 2 sessions', cls: strength ? (strength.pct > 1 ? 'good' : strength.pct < -1 ? 'bad' : '') : '' });
  res.tiles.push({ label: 'Waist', val: waist ? `${waist.delta > 0 ? '+' : ''}${waist.delta} cm` : '–', sub: waist ? `since ${fmtD(waist.since)}` : 'needs 2 check-ins', cls: waist ? (waist.delta <= -0.3 ? 'good' : waist.delta > 0.5 ? 'bad' : '') : '' });
  res.tiles.push({ label: 'Workouts', val: plannedN ? `${doneN}/${plannedN}` : '–', sub: 'done vs planned, 4 weeks', cls: plannedN ? (doneN / plannedN >= 0.8 ? 'good' : doneN / plannedN < 0.6 ? 'bad' : '') : '' });
  res.tiles.push({ label: 'Protein', val: pDays ? `${pHit}/${pDays}` : '–', sub: 'days on target, last week', cls: pDays ? (pHit / pDays >= 0.7 ? 'good' : 'bad') : '' });
  if (ratio) res.tiles.push({ label: 'Shoulder : waist', val: ratio.now.toFixed(2), sub: ratio.prev != null ? `was ${ratio.prev.toFixed(2)} · aim 1.6` : 'aim for 1.6 (V-taper)', cls: ratio.prev != null ? (ratio.now > ratio.prev ? 'good' : ratio.now < ratio.prev ? 'bad' : '') : '' });
  if (sleep) res.tiles.push({ label: 'Sleep', val: `${sleep} h`, sub: 'average, last 7 nights', cls: sleep >= 7 ? 'good' : 'bad' });
  if (wTrend) res.tiles.push({ label: 'Weight', val: `${wTrend.perWeek > 0 ? '+' : ''}${wTrend.perWeek} kg/wk`, sub: `${wTrend.total > 0 ? '+' : ''}${wTrend.total} kg in ${wTrend.days} days`, cls: '' });
  const goal = S.profile.goal, sUp = strength && strength.pct > 1, sDown = strength && strength.pct < -1;
  const consOK = !plannedN || doneN / plannedN >= 0.8, protOK = !pDays || pHit / pDays >= 0.7, waistUp = waist && waist.delta > 0.5, waistDown = waist && waist.delta <= -0.3;
  if (!strength && !waist) { res.head = 'Building your baseline'; res.cls = ''; res.line = 'Log two weeks of workouts and do a monthly check-in — then this tells you whether you are growing.'; }
  else if (sUp && (goal !== 'recomp' || !waistUp)) { res.head = 'Growing'; res.cls = 'good'; res.line = goal === 'recomp' && waistDown ? 'Lifts going up while your waist goes down — a textbook recomp.' : 'Your lifts are going up. Keep the plan exactly as it is.'; }
  else if (sUp && waistUp) { res.head = 'Stronger, but waist is up'; res.cls = 'acc'; res.line = 'Strength is up but some fat may be coming with it.'; }
  else if (sDown) { res.head = 'Going backwards'; res.cls = 'bad'; res.line = 'Your lifts dropped compared with the previous weeks.'; }
  else { res.head = 'Holding steady'; res.cls = 'acc'; res.line = 'Strength is flat — not losing, not gaining yet.'; }
  if (!consOK) res.tips.push(`You did ${doneN} of ${plannedN} planned sessions. Consistency comes first — use "Change today's workout" when the gym is crowded instead of skipping.`);
  if (!protOK) res.tips.push(`Protein target hit on only ${pHit} of ${pDays} days. Use the + button to log everything and the close-the-gap tips.`);
  if (sDown || (strength && !sUp && consOK && protOK && !strength.sinceStart)) res.tips.push('Check sleep (7+ hours) and calories. If you feel run down, take a deload day (💤 on the workout card).');
  if (sleep && sleep < 7) res.tips.push(`You're averaging ${sleep} h of sleep. Under 7 h slows muscle growth and fat loss — it's the cheapest gain available.`);
  if (waistUp && goal === 'recomp') res.tips.push('Waist went up — trim about 150 kcal a day (the check-in screen can apply it).');
  if (wTrend && goal === 'recomp' && wTrend.perWeek < -0.5) res.tips.push('Weight is dropping fast for a recomp — eat closer to your calorie target to protect muscle.');
  return res;
}

// ---------- adaptive calories ----------
function adaptive(prev, cur) {
  const days = diffD(prev.date, cur.date); if (days < 14 || !prev.weight || !cur.weight) return null;
  const wPct = (cur.weight - prev.weight) / prev.weight * 100 * 30 / days, waistD = cur.waist && prev.waist ? (cur.waist - prev.waist) * 30 / days : null, prs = prCountBetween(prev.date, cur.date), g = S.profile.goal;
  let delta = 0, why;
  if (g === 'recomp') { if (waistD != null && waistD > 0.5) { delta = -150; why = 'Your waist is growing — trim calories a little.'; } else if (wPct < -1.5 && prs < 2) { delta = 150; why = 'You are losing weight fast and strength is flat — eat a bit more to keep building muscle.'; } else why = (waistD != null && waistD <= 0 && prs >= 2) ? 'Waist down or steady while lifts go up — textbook recomp. Keep calories the same.' : 'Changes are in the normal range. Keep calories the same.'; }
  else if (g === 'leanbulk') { if (wPct < 0.25) { delta = 150; why = 'Weight is not moving up — add a little food.'; } else if (wPct > 0.75 || (waistD != null && waistD > 1)) { delta = -150; why = 'Gaining faster than needed — slow it down.'; } else why = 'Gaining at a lean rate. Keep calories the same.'; }
  else if (g === 'cut') { if (wPct > -1) { delta = -150; why = 'Fat loss has slowed — trim calories a little.'; } else if (wPct < -4) { delta = 150; why = 'Losing too fast — risk of losing muscle.'; } else why = 'Losing at a good rate. Keep calories the same.'; }
  else { if (wPct > 1) { delta = -100; why = 'Weight drifting up.'; } else if (wPct < -1) { delta = 100; why = 'Weight drifting down.'; } else why = 'Weight is stable.'; }
  const note = diffD(S.stock.creatine.start, cur.date) <= 35 && wPct > 0 ? 'You started creatine recently — part of any weight gain is water in the muscles, not fat.' : '';
  return { delta, why, summary: `Weight ${wPct >= 0 ? '+' : ''}${r1(wPct)}%/month, ${waistD == null ? 'no waist data' : `waist ${waistD >= 0 ? '+' : ''}${r1(waistD)} cm/month`}, ${prs} lift PR${prs === 1 ? '' : 's'}`, note };
}

// ---------- quotes & coach notes ----------
function quoteOfDay() {
  const pool = window.QUOTES.concat((S.myQuotes || []).map(x => ({ q: x.q, a: x.a || 'Saved by you' })));
  const d = pd(today()), doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
  return pool[(doy * 7 + d.getFullYear()) % pool.length];
}
function coachNotes() {
  const n = [], t = today(), hr = new Date().getHours(), mon = monOf(t);
  const st = streak(); if (st >= 2) n.push(`${st}-day training streak.`);
  const prs = prCountBetween(addD(mon, -1), t); if (prs) n.push(`${prs} PR${prs > 1 ? 's' : ''} this week.`);
  const pg = proteinGap(t); if (pg > 10) { const g = closeGap(pg); n.push(`Today's plan is ${pg} g protein short${g ? ` — add ${g}` : ''}.`); }
  if (hr >= 14 && waterMl(t) < waterGoal(t) / 2) n.push(`Only ${fmtL(waterMl(t))} of your ${fmtL(waterGoal(t))} water goal so far — drink up.`);
  const nt = stockInfo('nitrotech'); if (nt.runout && diffD(t, nt.runout) <= 7) n.push(`Nitro-Tech runs out ${fmtD(nt.runout)} (${nt.left} scoops left) — it's on the grocery list.`);
  const cd = diffD(S.stock.creatine.start, t); if (cd >= 0 && cd <= 21) n.push(`Week ${Math.floor(cd / 7) + 1} on creatine: a 1–2 kg jump on the scale is water in the muscle, not fat.`);
  if (planned(t).type === 'run') n.push(`Run day: long-run target ${nextLongRun()} km at an easy pace.`);

  return n.slice(0, 4);
}

// ---------- cloud sync (Firebase Auth + Firestore, via Google's REST API — no SDK download needed) ----------
const SESS_KEY = 'gherwin_fitness_session';
const Sync = {
  cfg: window.FIREBASE_CONFIG || null, inflight: {}, err: null,
  sess: (() => { try { return JSON.parse(localStorage.getItem(SESS_KEY)); } catch (e) { return null; } })(),
  get user() { return this.sess ? { uid: this.sess.uid, email: this.sess.email } : null; },
  meta: (() => { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; } })(),
  saveMeta() { localStorage.setItem(META_KEY, JSON.stringify(this.meta)); },
  saveSess() { if (this.sess) localStorage.setItem(SESS_KEY, JSON.stringify(this.sess)); else localStorage.removeItem(SESS_KEY); },
  parts(st = S) {
    const core = {}; for (const k of ['v', 'created', 'profile', 'overrides', 'program', 'foods', 'templates', 'stock', 'settings', 'deloads', 'lastBackup', 'customEx', 'myQuotes', 'grocery', 'exNotes', 'moves', 'skips', 'savedPrograms']) core[k] = st[k];
    const out = { core, body: { weights: st.weights, checkins: st.checkins, runs: st.runs } };
    for (const [d, v] of Object.entries(st.sessions)) (out['sessions_' + d.slice(0, 7)] ||= {})[d] = v;
    for (const [d, v] of Object.entries(st.days)) (out['days_' + d.slice(0, 7)] ||= {})[d] = v;
    return out;
  },
  apply(key, val) {
    if (key === 'core' || key === 'body') Object.assign(S, val);
    else if (/^(sessions|days)_\d{4}-\d{2}$/.test(key)) { const [kind, month] = key.split('_'), tgt = kind === 'sessions' ? S.sessions : S.days; for (const d of Object.keys(tgt)) if (d.startsWith(month)) delete tgt[d]; Object.assign(tgt, val || {}); }
  },
  markChanges() {
    const m = this.meta; m.hash ||= {}; m.time ||= {}; m.dirty ||= {};
    const parts = this.parts(), now = Date.now();
    for (const [k, v] of Object.entries(parts)) { const h = hashStr(JSON.stringify(v)); if (m.hash[k] !== h) { m.hash[k] = h; m.time[k] = now; m.dirty[k] = true; } }
    for (const k of Object.keys(m.hash)) if (!parts[k] && m.hash[k] !== 'empty') { m.hash[k] = 'empty'; m.time[k] = now; m.dirty[k] = true; }
    this.saveMeta(); this.schedule();
  },
  schedule() { clearTimeout(this._t); this._t = setTimeout(() => this.push(), 1200); this.setStatus(); },
  // --- auth ---
  async authCall(path, body) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${this.cfg.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((j.error && j.error.message) || 'HTTP ' + r.status); e.code = (j.error && j.error.message || '').split(' ')[0]; throw e; }
    return j;
  },
  async signIn(email, password) {
    const j = await this.authCall('accounts:signInWithPassword', { email, password, returnSecureToken: true });
    this.sess = { uid: j.localId, email: j.email, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (+j.expiresIn || 3600) * 1000 };
    this.saveSess(); localStorage.setItem('gf_last_email', email);
  },
  async resetPassword(email) { await this.authCall('accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email }); },
  signOut() { this.sess = null; this.saveSess(); clearInterval(this._poll); showLock('login'); },
  async token() {
    if (!this.sess) throw new Error('signed out');
    if (Date.now() < this.sess.exp - 120000) return this.sess.idToken;
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${this.cfg.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(this.sess.refreshToken) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const msg = (j.error && j.error.message) || ''; if (/TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND|INVALID_REFRESH_TOKEN/.test(msg)) { this.signOut(); toast('Please sign in again.'); } throw new Error(msg || 'HTTP ' + r.status); }
    this.sess.idToken = j.id_token; this.sess.refreshToken = j.refresh_token; this.sess.exp = Date.now() + (+j.expires_in || 3600) * 1000; this.saveSess();
    return this.sess.idToken;
  },
  base() { return `https://firestore.googleapis.com/v1/projects/${this.cfg.projectId}/databases/(default)/documents/users/${this.sess.uid}/state`; },
  async api(method, url, body) {
    const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + await this.token(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((j.error && (j.error.status + ': ' + j.error.message)) || 'HTTP ' + r.status); e.status = r.status; throw e; }
    return j;
  },
  // --- data ---
  async push() {
    if (!this.cfg || !this.sess || !navigator.onLine) return this.setStatus();
    const m = this.meta, parts = this.parts();
    await Promise.all(Object.keys(m.dirty || {}).filter(k => !this.inflight[k]).map(async k => {
      const t = m.time[k]; this.inflight[k] = true;
      try { await this.api('PATCH', `${this.base()}/${k}`, { fields: { json: { stringValue: JSON.stringify(parts[k] || {}) }, t: { integerValue: String(t) } } }); if (m.time[k] === t) delete m.dirty[k]; this.err = null; this.saveMeta(); }
      catch (e) { console.warn('sync push', k, e); this.err = e.message; }
      finally { delete this.inflight[k]; }
    }));
    this.setStatus();
  },
  async pull() {
    if (!this.cfg || !this.sess || !navigator.onLine || this.pulling) return;
    this.pulling = true;
    try {
      const docs = {}; let page = '';
      do {
        const j = await this.api('GET', `${this.base()}?pageSize=300${page ? '&pageToken=' + encodeURIComponent(page) : ''}`);
        for (const d of j.documents || []) { const id = d.name.split('/').pop(), f = d.fields || {}; docs[id] = { json: f.json ? f.json.stringValue : '{}', t: f.t ? +f.t.integerValue : 0 }; }
        page = j.nextPageToken || '';
      } while (page);
      this.onDocs(docs); this.err = null; this.lastPull = Date.now();
    } catch (e) { console.warn('sync pull', e); this.err = e.message; }
    finally { this.pulling = false; this.setStatus(); }
  },
  onDocs(docs) {
    const m = this.meta; m.time ||= {}; m.hash ||= {}; m.dirty ||= {};
    if (m.uid !== this.sess.uid) {
      // first sign-in on this device
      const hasRemote = Object.keys(docs).length > 0, localUsed = S.profile.onboarded || Object.keys(S.sessions).length || S.checkins.length;
      let useCloud = hasRemote;
      if (hasRemote && localUsed) useCloud = confirm('Your account already has data in the cloud.\n\nOK = load the cloud data onto this device (recommended).\nCancel = keep this device\'s data and upload it to the cloud.');
      m.uid = this.sess.uid;
      if (useCloud) { S = defaults(); for (const [k, v] of Object.entries(docs)) { try { this.apply(k, JSON.parse(v.json)); } catch (e) {} m.time[k] = v.t; } normalize(); S.profile.onboarded = true; m.dirty = {}; m.hash = {}; for (const [k, v] of Object.entries(this.parts())) m.hash[k] = hashStr(JSON.stringify(v)); saveLocal(); this.saveMeta(); buildEx(); closeModal(); render(); }
      else { m.hash = {}; m.dirty = {}; m.time = {}; saveLocal(); this.markChanges(); }
      return;
    }
    let changed = false;
    for (const [k, v] of Object.entries(docs)) {
      if (m.dirty[k] && (m.time[k] || 0) >= v.t) continue;
      if (v.t > (m.time[k] || 0)) { try { this.apply(k, JSON.parse(v.json)); m.time[k] = v.t; delete m.dirty[k]; changed = true; } catch (e) { console.warn(e); } }
    }
    if (changed) { normalize(); const parts = this.parts(); for (const k of Object.keys(docs)) m.hash[k] = parts[k] ? hashStr(JSON.stringify(parts[k])) : 'empty'; saveLocal(); this.saveMeta(); buildEx(); const ae = document.activeElement; if (!P && $('#modal').classList.contains('hidden') && (!ae || !/INPUT|SELECT|TEXTAREA/.test(ae.tagName))) render(true); }
  },
  setStatus() {
    const el = $('#syncState'); if (!el) return;
    if (!this.cfg || !this.sess) { el.textContent = ''; return; }
    const dirty = Object.keys(this.meta.dirty || {}).length;
    el.textContent = !navigator.onLine ? 'Offline · saved on phone' : this.err ? 'Sync problem — see Me › Account' : dirty ? 'Syncing…' : 'Synced ✓';
    el.className = 'sync ' + (!navigator.onLine ? 'off' : this.err ? 'err' : dirty ? 'busy' : 'ok');
  },
  async afterLogin() {
    hideLock(); startApp();
    await this.pull(); await this.push();
    clearInterval(this._poll); this._poll = setInterval(() => { if (document.visibilityState === 'visible') { this.pull().then(() => this.push()); } }, 20000);
  },
  init() {
    if (!this.cfg) return startApp();
    if (this.sess) this.afterLogin(); else showLock('login');
  }
};
window.addEventListener('online', () => { Sync.pull().then(() => Sync.push()); Sync.setStatus(); });
window.addEventListener('offline', () => Sync.setStatus());
function showLock(mode) {
  const el = $('#lock'); el.classList.remove('hidden');
  const logo = `<img src="icons/icon-192.png" alt="" style="width:84px;border-radius:20px"><h2 style="margin-top:14px">Gherwin Fitness</h2>`;
  if (mode === 'loading') el.innerHTML = `<div class="lock-box">${logo}<div class="muted small">Loading…</div></div>`;
  else if (mode === 'offline') el.innerHTML = `<div class="lock-box">${logo}<div class="muted small">Connect to the internet once to sign in on this device. After that the app works offline.</div><button class="btn primary block" style="margin-top:14px" onclick="location.reload()">Try again</button></div>`;
  else el.innerHTML = `<div class="lock-box">${logo}<div class="muted small" style="margin-bottom:12px">Sign in to unlock and sync between your phone and laptop.</div>
    <label class="f">Email</label><input type="email" id="lgEmail" autocomplete="username" value="${esc(localStorage.getItem('gf_last_email') || 'gherwinlanceponteres@gmail.com')}">
    <label class="f">Password</label><input type="password" id="lgPw" autocomplete="current-password">
    <div id="lgErr" class="small bad" style="min-height:18px;margin-top:6px"></div>
    <button class="btn primary block" data-a="login">Sign in</button><button class="btn ghost block" style="margin-top:8px" data-a="forgot">Forgot password</button></div>`;
}
function hideLock() { $('#lock').classList.add('hidden'); }

// ---------- UI framework ----------
let route = { tab: 'today', sub: {} };
const ctx = { date: today(), eatDate: today(), month: today().slice(0, 7), tpl: 'weekday', liftEx: null, adapt: null };
const SUBS = {
  train: [['session', 'Workout'], ['check', 'Program check'], ['month', 'Month plan'], ['runs', 'Runs'], ['volume', 'Weekly sets'], ['program', 'Edit split']],
  eat: [['log', 'Meals'], ['calc', 'Calculator'], ['grocery', 'Grocery'], ['plan', 'Meal plan'], ['foods', 'My foods']],
  me: [['analysis', 'Progress'], ['week', 'Weekly report'], ['lifts', 'Lifts'], ['body', 'Body'], ['photos', 'Photos'], ['checkin', 'Check-in'], ['profile', 'Profile'], ['supps', 'Supplements'], ['quotes', 'Quotes'], ['account', 'Account & backup']]
};
const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  train: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12"/></svg>',
  eat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="13" r="7"/><path d="M12 6V3M9 13h6"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19l5-6 4 3 7-9"/><path d="M15 7h5v5"/></svg>'
};
const TABNAMES = { today: 'Today', train: 'Train', eat: 'Eat', me: 'Me' };
const curSub = () => route.sub[route.tab] || (SUBS[route.tab] ? SUBS[route.tab][0][0] : null);
let lastView = '';
const afterRender = [];
function render(keepScroll) {
  if (!Sync.started) return;
  const y = window.scrollY;
  $('#topDate').textContent = fmtD(today());
  const tb = t => `<button data-a="tab" data-t="${t}" class="${route.tab === t ? 'on' : ''}">${ICONS[t]}${TABNAMES[t]}</button>`;
  $('#tabbar').innerHTML = tb('today') + tb('train') + `<button class="fab" data-a="logFood" aria-label="Log food"><span>+</span></button>` + tb('eat') + tb('me');
  const subs = SUBS[route.tab];
  $('#subnav').innerHTML = subs ? subs.map(([k, l]) => `<button data-a="sub" data-s="${k}" class="${curSub() === k ? 'on' : ''}">${l}</button>`).join('') : '';
  const key = route.tab + ':' + curSub();
  $('#view').innerHTML = VIEWS[route.tab === 'today' ? 'today' : curSub()]();
  if (keepScroll && key === lastView) window.scrollTo(0, y); else window.scrollTo(0, 0);
  if (key !== lastView) { const on = $('#subnav .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }
  lastView = key;
  afterRender.splice(0).forEach(f => f());
  Sync.setStatus();
}
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms); }
let demoTimer = null;
function openModal(html) { $('#sheet').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { stopScan(); $('#modal').classList.add('hidden'); $('#sheet').innerHTML = ''; clearInterval(demoTimer); }
const saveBtn = (label = 'Save') => `<button class="btn primary block savebtn" data-a="saveNow">${label}</button>`;

function bar(label, val, target, color, unit = 'g') {
  const pct = target ? Math.min(100, val / target * 100) : 0, over = val - target > target * 0.05;
  return `<div class="macro"><div class="row between"><span>${label}</span><span class="${over && label !== 'Protein' ? 'bad' : 'muted'}">${Math.round(val)} / ${target} ${unit}</span></div><div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
}
function macroCard(date, T) { const t = dayTotals(date); return bar('Calories', t.kcal, T.kcal, 'var(--accent)', 'kcal') + bar('Protein', t.p, T.protein, 'var(--p)') + bar('Carbs', t.c, T.carbs, 'var(--c)') + bar('Fat', t.f, T.fat, 'var(--f)'); }
const bottleMl = () => Math.round(S.settings.bottleOz * 29.5735);
const fmtL = ml => `${r1(ml / 1000)} L`;
function waterMl(date) { const r = S.days[date]; if (!r) return 0; return r.waterMl ?? Math.round((r.water || 0) * bottleMl()); }
function waterGoal(date) {
  if (S.settings.waterGoalL) return Math.round(S.settings.waterGoalL * 1000);
  const p = plannedFor(date); return Math.round((35 * curWeight() + (p.type !== 'rest' ? 500 : 0)) / 100) * 100;
}
function waterCard(date) {
  const ml = waterMl(date), goal = waterGoal(date), bm = bottleMl(), pct = Math.min(100, ml / goal * 100), p = plannedFor(date);
  let pace = '', mark = '';
  if (date === today()) {
    const now = new Date(), h = now.getHours() + now.getMinutes() / 60, frac = Math.min(1, Math.max(0, (h - 7) / 15)), should = Math.round(goal * frac / 100) * 100;
    mark = `<span class="mark" style="left:${Math.min(100, should / goal * 100)}%"></span>`;
    pace = ml >= goal ? '<span class="good">Goal reached ✓</span>' : ml >= should ? `<span class="good">On track</span> · aim for ${fmtL(should)} by now` : `<span class="bad">Behind</span> · aim for ${fmtL(should)} by now`;
  }
  const left = Math.max(0, goal - ml), nB = Math.max(1, Math.ceil(goal / bm)); let b = '';
  for (let i = 0; i < nB; i++) { const fill = Math.max(0, Math.min(1, (ml - i * bm) / bm)); b += `<div class="bottle" title="Bottle ${i + 1}"><i style="height:${fill * 100}%"></i></div>`; }
  return `<div class="card"><div class="row between"><div><div class="label">Water</div><div class="wnum" style="margin-top:4px">${fmtL(ml)} <small>/ ${fmtL(goal)} goal</small></div></div><div style="text-align:right" class="small muted">${left ? `${fmtL(left)} to go<br>≈ ${r1(left / bm)} bottle${r1(left / bm) === 1 ? '' : 's'}` : '<b class="good">Done for today</b>'}</div></div>
  <div class="bar lg water-bar rel" style="margin-top:12px"><i style="width:${pct}%"></i>${mark}</div>${pace ? `<div class="tiny muted" style="margin-top:6px">${pace}</div>` : ''}
  <div class="water">${b}</div>
  <div class="wbtns"><button class="btn" data-a="waterAdd" data-d="${date}" data-ml="${bm}">+ Bottle <span class="tiny">${S.settings.bottleOz} oz</span></button><button class="btn" data-a="waterAdd" data-d="${date}" data-ml="250">+ Glass <span class="tiny">250 ml</span></button><button class="btn ghost" data-a="waterUndo" data-d="${date}" aria-label="Undo">↶</button></div>
  ${date === today() ? `<div class="row between" style="margin-top:10px"><span class="small muted">${S.settings.waterRemind ? `🔔 Reminder every ${S.settings.waterEvery} min · next ≈ ${nextWaterText()}` : '🔕 Water reminders off'}</span><button class="btn sm" data-a="waterSet">Reminders</button></div>` : ''}
  <div class="tiny faint" style="margin-top:8px">${S.settings.waterGoalL ? 'Your own goal (change in Me › Profile).' : `Goal = 35 ml × ${r1(curWeight())} kg${p.type !== 'rest' ? ' + 0.5 L for training' : ''}. Hot weather or a long run? Drink extra.`}</div></div>`;
}
function sleepCard(date) {
  const v = (S.days[date] || {}).sleep;
  return `<div class="card"><div class="row between"><div><div class="label">Sleep last night</div><div class="wnum" style="margin-top:4px">${v ? v + ' h' : '–'}</div></div><div class="small muted" style="text-align:right">${v ? (v >= 7 ? '<b class="good">Good recovery</b>' : '<b class="bad">Under 7 h</b><br>expect weaker lifts') : 'Tap your hours'}</div></div>
  <div class="qamts">${[5, 6, 6.5, 7, 7.5, 8, 9].map(h => `<button class="${v === h ? 'on' : ''}" data-a="sleep" data-d="${date}" data-v="${h}">${h}</button>`).join('')}</div></div>`;
}
function weekReport(mon) {
  const sun = addD(mon, 6), end = sun < today() ? sun : today(), T = targets(), r = { mon, sun, planned: 0, done: 0, sets: 0, vol: 0, days: 0, kcal: 0, p: 0, pDays: 0, pHit: 0, water: [], waterHit: 0, steps: [], stepHit: 0, sleep: [] };
  for (let d = mon; d <= end; d = addD(d, 1)) {
    const st = dayStatus(d); if (st !== 'rest' && st !== 'pre' && !(d === today() && st !== 'done')) { r.planned++; if (st === 'done') r.done++; }
    const se = S.sessions[d]; if (se) for (const e of se.entries) for (const z of e.sets) if (z.done) { r.sets++; r.vol += (num(z.w) || 0) * (num(z.r) || 0); }
    const rec = S.days[d]; if (!rec) continue;
    if (Object.values(rec.items || {}).some(v => v.done) || (rec.extras || []).length) { const t = dayTotals(d); r.pDays++; r.kcal += t.kcal; r.p += t.p; if (t.p >= T.protein * 0.9) r.pHit++; }
    const w = waterMl(d); if (w) { r.water.push(w); if (w >= waterGoal(d)) r.waterHit++; }
    if (rec.steps) { r.steps.push(rec.steps); if (rec.steps >= S.settings.stepsTarget) r.stepHit++; }
    if (rec.sleep) r.sleep.push(rec.sleep);
  }
  r.prs = prCountBetween(addD(mon, -1), sun);
  r.skips = Object.entries(S.skips || {}).filter(([d]) => d >= mon && d <= sun).sort();
  const ws = weightSeries().filter(x => x.d >= mon && x.d <= sun); r.wChange = ws.length >= 2 ? r1(ws[ws.length - 1].y - ws[0].y) : null;
  const sl = r.sleep.length ? r1(avg(r.sleep)) : null, wa = r.water.length ? avg(r.water) : null, stp = r.steps.length ? Math.round(avg(r.steps)) : null;
  r.sleepAvg = sl; r.waterAvg = wa; r.stepsAvg = stp;
  r.focus = r.planned && r.done / r.planned < 0.8 ? `hit every planned session — ${r.planned - r.done} missed. Use "Switch workout" instead of skipping.`
    : r.pDays && r.pHit / r.pDays < 0.7 ? `protein — only ${r.pHit} of ${r.pDays} days on target. Log with + and use the close-the-gap tips.`
    : sl && sl < 7 ? `sleep — ${sl} h average. Aim for 7–8 h.`
    : wa && wa < 0.8 * waterGoal(end) ? `water — ${fmtL(wa)} a day vs ${fmtL(waterGoal(end))} goal.`
    : stp && stp < S.settings.stepsTarget * 0.8 ? `steps — ${stp.toLocaleString()} a day vs ${S.settings.stepsTarget.toLocaleString()} goal.`
    : 'keep everything the same and add weight wherever the app suggests.';
  return r;
}
// ---------- water reminders ----------
const hm = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };
function waterLastEvent() { const rec = S.days[today()] || {}; let last = 0; try { last = +localStorage.getItem('gf_water_last') || 0; } catch (e) {} return Math.max(rec.waterAt || 0, last, hm(S.settings.waterFrom)); }
function nextWaterAt() {
  const st = S.settings; if (!st.waterRemind) return null; if (waterMl(today()) >= waterGoal(today())) return null;
  let t = Math.max(waterLastEvent() + st.waterEvery * 60000, hm(st.waterFrom)); if (t >= hm(st.waterTo)) return null; return t;
}
function nextWaterText() { const t = nextWaterAt(); if (!t) return waterMl(today()) >= waterGoal(today()) ? 'goal reached 🎉' : 'tomorrow'; return t <= Date.now() + 30000 ? 'now' : new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function waterReminder() {
  const t = today(), ml = waterMl(t), goal = waterGoal(t), left = Math.max(0, goal - ml), bm = bottleMl();
  try { localStorage.setItem('gf_water_last', String(Date.now())); } catch (e) {}
  const title = '💧 Time to drink water', body = `${fmtL(ml)} of ${fmtL(goal)} so far · ${fmtL(left)} to go. Have a glass now.`;
  if (document.visibilityState === 'visible') { beep(); toast(`${title} — ${fmtL(left)} to go`, 6000); if (!P && route.tab === 'today') render(true); }
  else note('gf-water', title, body, { vibrate: [400, 150, 400], renotify: true, silent: false, requireInteraction: true, actions: [{ action: 'water250', title: '+ Glass 250 ml' }, { action: 'waterBottle', title: `+ Bottle ${S.settings.bottleOz} oz` }] });
}
function waterTick() { const t = nextWaterAt(); if (t && Date.now() >= t) waterReminder(); }
setInterval(waterTick, 30000);
function addWater(ml) { const d = today(), rec = dayRec(d, true); rec.waterMl = waterMl(d) + ml; rec.waterAt = Date.now(); delete rec.water; (rec.waterLog ||= []).push(ml); save(); clearNotes(['gf-water']); if (!P) render(true); toast(`+${ml} ml water · ${fmtL(waterMl(d))} of ${fmtL(waterGoal(d))}`); }
function waterIcs() {
  const st = S.settings, pad2 = n => String(n).padStart(2, '0'), d0 = new Date(), ymd = `${d0.getFullYear()}${pad2(d0.getMonth() + 1)}${pad2(d0.getDate())}`;
  let ev = '', n = 0;
  for (let m = st.waterFrom * 60 + st.waterEvery; m < st.waterTo * 60; m += st.waterEvery) {
    const hh = pad2(Math.floor(m / 60)), mm = pad2(m % 60); n++;
    ev += `BEGIN:VEVENT\r\nUID:gf-water-${hh}${mm}@gherwin-fitness\r\nDTSTAMP:${ymd}T000000Z\r\nDTSTART:${ymd}T${hh}${mm}00\r\nDURATION:PT5M\r\nRRULE:FREQ=DAILY\r\nSUMMARY:💧 Drink water (250 ml)\r\nDESCRIPTION:Gherwin Fitness water reminder. Log it in the app.\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Drink water\r\nTRIGGER:PT0M\r\nEND:VALARM\r\nEND:VEVENT\r\n`;
  }
  return { n, text: `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Gherwin Fitness//Water//EN\r\nCALSCALE:GREGORIAN\r\n${ev}END:VCALENDAR\r\n` };
}
// ---------- "what should I eat?" suggestions ----------
const VEG = ['Pinakbet', 'Laing', 'Chopsuey', 'Tortang talong', 'Ginisang monggo', 'Lumpiang sariwa', 'Lumpiang togue (fried)'];
function remaining(date) { const T = targets(), t = dayTotals(date); return { kcal: Math.max(0, T.kcal - t.kcal), p: Math.max(0, T.protein - t.p), c: Math.max(0, T.carbs - t.c), f: Math.max(0, T.fat - t.f), T, t }; }
function suggestFoods(date, n = 8) {
  const rem = remaining(date); if (rem.kcal < 80 && rem.p < 8) return [];
  const mineNames = new Set(Object.values(S.foods).map(f => f.name.toLowerCase()));
  const pool = [...Object.entries(S.foods).filter(([, f]) => f.kcal > 20).map(([id, f]) => ({ src: 'my', id, name: f.name, label: f.unit, kcal: f.kcal, p: f.p, c: f.c, f: f.f, cat: f.cat })),
    ...window.FOODDB.filter(r => !VEG.includes(r[0]) && !['Drinks', 'Snacks'].includes(r[7]) && !mineNames.has(r[0].toLowerCase()) && r[3] > 20).map(r => ({ src: 'db', name: r[0], label: r[1], g: r[2], kcal: r[3], p: r[4], c: r[5], f: r[6], cat: r[7] }))];
  const half = x => Math.round(x * 2) / 2, out = [], T = rem.T;
  const pGoal = Math.min(rem.p, Math.max(25, T.protein / 4)), kCap = Math.min(rem.kcal + 120, Math.max(350, T.kcal / 3));
  for (const it of pool) {
    let q = rem.p >= 10 && it.p >= 4 ? pGoal / it.p : (rem.kcal >= 120 ? Math.min(rem.kcal, 550) / it.kcal : 1);
    q = Math.min(it.kcal > 400 ? 1.5 : 3, Math.max(0.5, rem.p >= 10 ? Math.ceil(q * 2) / 2 : half(q)));
    while (q > 0.5 && it.kcal * q > kCap) q -= 0.5;
    if (it.kcal * q > kCap + 100) continue;
    const v = { kcal: it.kcal * q, p: it.p * q, c: it.c * q, f: it.f * q };
    if (v.kcal > rem.kcal + 200) continue;
    const proteinMode = rem.p >= 10, kBudget = proteinMode ? Math.max(pGoal * 4 / 0.35, 250) : kCap;
    const benefit = proteinMode ? Math.min(v.p, pGoal) * 6 + Math.min(v.c, rem.c) * 0.6 + Math.min(v.f, rem.f) * 0.6 : Math.min(v.kcal, kCap) * 0.5 + Math.min(v.p, rem.p) * 2;
    const cost = Math.max(0, v.kcal - kBudget) * 0.4 + Math.max(0, v.kcal - rem.kcal) * 1.5 + Math.max(0, v.f - rem.f) * 5;
    out.push({ ...it, q, v, score: benefit - cost + (it.src === 'my' ? 25 : 0) + (it.cat === 'Filipino' ? 6 : 0) });
  }
  out.sort((a, b) => b.score - a.score);
  const seen = new Set(), res = []; for (const o of out) { const k = o.name.split(/[ ,(]/)[0].toLowerCase() + (o.src === 'my' ? 'm' : ''); if (seen.has(k)) continue; seen.add(k); res.push(o); if (res.length >= n) break; }
  return res;
}
function nutriSheet() {
  const d = today(), rem = remaining(d), plan = dayItems(d).filter(i => !i.done && !food(i.food).stock), sug = suggestFoods(d); nutriSheet.list = sug;
  const tile = (v, tgt, l, cls) => `<div class="${cls}"><b>${Math.round(v)}</b><span>${l} left</span></div>`;
  openModal(`<div class="row between"><h2 style="margin:0">Hit today's targets</h2><button class="iconbtn" data-a="close">✕</button></div>
  <div class="small muted" style="margin-top:2px">Eaten so far: ${Math.round(rem.t.kcal)} kcal · ${Math.round(rem.t.p)} g protein</div>
  <div class="mtiles">${tile(rem.kcal, rem.T.kcal, 'kcal', 'k')}${tile(rem.p, rem.T.protein, 'protein g', 'pp')}${tile(rem.c, rem.T.carbs, 'carbs g', 'cc')}${tile(rem.f, rem.T.fat, 'fat g', 'ff')}</div>
  ${plan.length ? `<div class="sect">Still in today's plan — tap to mark eaten</div><div class="chips">${plan.map(i => `<button class="chip" data-a="nutriPlan" data-k="${i.key}">✓ <span class="faint">${esc(i.slot.replace(/\s*\(.*\)/, ''))}:</span> ${esc(food(i.food).name.replace(/\s*\(.*\)/, ''))} × ${i.qty}</button>`).join('')}</div>` : ''}
  ${sug.length ? `<div class="sect">${rem.p >= 10 ? `To close your ${Math.round(rem.p)} g protein gap` : 'To fill the rest of your calories'} — tap to add</div>${sug.map((o, i) => `<div class="fres" data-a="nutriAdd" data-i="${i}"><div class="ic">${CAT_ICON[o.cat] || '🍽️'}</div><div class="grow"><b>${esc(o.name)}</b><div class="tiny muted">${o.q} × ${esc(o.label)}${o.src === 'my' ? ' · my food' : ''}</div></div><div class="kc"><b>+${Math.round(o.v.kcal)}</b><div class="tiny muted">kcal</div><span>+${r1(o.v.p)} g protein</span></div></div>`).join('')}` : `<div class="card accent" style="margin-top:12px;text-align:center"><b class="good">Targets hit for today 🎉</b><div class="small muted">Anything more is extra — keep it light.</div></div>`}
  <div class="tiny faint" style="margin-top:10px">Suggestions skip vegetables and favour high-protein foods you already eat. Adding logs it to ${esc(mealNow())}.</div>`);
}
function stepsCard(date) {
  const rec = S.days[date] || {}, steps = rec.steps || 0, goal = S.settings.stepsTarget, pct = Math.min(100, steps / goal * 100);
  const days = []; for (let i = 6; i >= 0; i--) { const d = addD(date, -i); days.push({ d, v: (S.days[d] || {}).steps || 0 }); }
  const mx = Math.max(goal, ...days.map(x => x.v));
  return `<div class="card"><div class="row between"><div><div class="label">Steps</div><div class="wnum" style="margin-top:4px">${steps.toLocaleString()} <small>/ ${goal.toLocaleString()}</small></div></div><div style="text-align:right" class="small muted">${steps >= goal ? '<b class="good">Goal reached ✓</b>' : `${(goal - steps).toLocaleString()} to go`}${rec.stepsAt ? `<br><span class="tiny">auto-synced ${rec.stepsAt}</span>` : ''}</div></div>
  <div class="bar lg" style="margin-top:12px"><i style="width:${pct}%;background:var(--good)"></i></div>
  <div class="mini-bars">${days.map(x => `<div><i class="${x.v >= goal ? 'hit' : ''} ${x.d === today() ? 'today' : ''}" style="height:${Math.max(4, x.v / mx * 52)}px"></i><span>${DN[dow(x.d)].slice(0, 2)}</span></div>`).join('')}</div>
  <div class="row" style="margin-top:12px"><input type="number" inputmode="numeric" data-c="steps" data-d="${date}" value="${rec.steps ?? ''}" placeholder="Type steps"><button class="btn sm" data-a="saveNow">Save</button></div>
  <button class="linkbtn" data-a="stepsHelp">⚡ Make steps automatic</button></div>`;
}
const suppName = id => food(id).name.replace(/\s*\(.*\)/, '');
function suppCard(date) {
  const items = dayItems(date).filter(i => food(i.food).stock); let h = '';
  for (const key of Object.keys(S.stock)) {
    const fid = Object.keys(S.foods).find(k => S.foods[k].stock === key); if (!fid) continue;
    const mine = items.filter(i => food(i.food).stock === key), st = S.stock[key], si = stockInfo(key), unit = key === 'nitrotech' ? 'scoops' : 'servings';
    const planned = mine.reduce((a, i) => a + i.qty, 0), done = mine.filter(i => i.done).reduce((a, i) => a + i.qty, 0);
    h += `<div class="supp"><div class="row between"><div class="grow"><b>${esc(suppName(fid))}</b><div class="tiny muted">${planned ? `${planned} ${unit} today · ${done} taken` : 'Not planned today'}</div></div><div class="tiny muted" style="text-align:right">${si.left} of ${st.size} left${si.runout ? `<br>runs out ${fmtD(si.runout)}` : ''}</div></div>
    <div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, si.left / st.size * 100)}%;background:${si.runout && diffD(today(), si.runout) <= 7 ? 'var(--bad)' : 'var(--good)'}"></i></div>
    ${mine.length ? `<div class="doses">${mine.map(i => `<button class="dose ${i.done ? 'on' : ''}" data-a="tickFood" data-d="${date}" data-k="${i.key}">${i.done ? '✓' : '○'} ${esc(i.slot.replace(/\s*\(.*\)/, ''))}${i.qty !== 1 ? ` ×${i.qty}` : ''}</button>`).join('')}</div>` : ''}</div>`;
  }
  return `<div class="card"><div class="row between"><div class="label">Supplements</div><button class="btn sm ghost" data-a="go" data-t="me" data-s="supps">Tubs</button></div>${h}</div>`;
}
function lineChart(pts, opt = {}) {
  if (pts.length < 2) return `<div class="small faint">${opt.empty || 'Log at least two entries to see a chart.'}</div>`;
  const W = 320, H = 140, L = 34, R = 8, Tp = 10, B = 22, ys = pts.map(p => p.y);
  let mn = Math.min(...ys), mx = Math.max(...ys); if (mx - mn < 1e-6) { mn -= 1; mx += 1; } const py = (mx - mn) * 0.12; mn -= py; mx += py;
  const x = i => L + (W - L - R) * i / (pts.length - 1), y = v => Tp + (H - Tp - B) * (1 - (v - mn) / (mx - mn)), col = opt.color || '#F5B301';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><line x1="${L}" x2="${W - R}" y1="${y(mx - py)}" y2="${y(mx - py)}" style="stroke:var(--line)"/><line x1="${L}" x2="${W - R}" y1="${y(mn + py)}" y2="${y(mn + py)}" style="stroke:var(--line)"/><text x="2" y="${y(mx - py) + 3}">${r1(mx - py)}</text><text x="2" y="${y(mn + py) + 3}">${r1(mn + py)}</text><path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join('')}" fill="none" stroke="${col}" stroke-width="2"/>${pts.length <= 40 ? pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="2.6" fill="${col}"/>`).join('') : ''}<text x="${L}" y="${H - 6}">${fmtD(pts[0].d).slice(4)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${fmtD(pts[pts.length - 1].d).slice(4)}</text></svg>`;
}
function growthCard(full) {
  const g = growth();
  return `<div class="card ${g.cls === 'good' ? 'accent' : ''}"><div class="row between"><div><div class="tiny muted" style="letter-spacing:.6px">AM I GROWING?</div><div class="big ${g.cls}" style="font-size:22px;margin-top:2px">${esc(g.head)}</div></div>${full ? '' : `<button class="btn sm" data-a="go" data-t="me" data-s="analysis">Details</button>`}</div><div class="small muted" style="margin:6px 0 10px">${esc(g.line)}</div>
  <div class="kpis two">${g.tiles.slice(0, full ? 9 : 4).map(t => `<div class="kpi"><b class="${t.cls}">${esc(t.val)}</b><span>${esc(t.label)} · ${esc(t.sub)}</span></div>`).join('')}</div>
  ${g.tips.length ? `<ul class="notes small" style="margin-top:10px">${g.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
}
function workoutPicker(date, cur) {
  const isGym = S.program.days[cur] && S.program.days[cur].type === 'gym';
  return `<select data-c="pickDay" data-d="${date}">${isGym ? '' : '<option value="" selected>Choose a gym workout…</option>'}${[1, 2, 3, 4, 5, 6, 0].filter(k => S.program.days[k].type === 'gym').map(k => `<option value="${k}" ${+cur === k ? 'selected' : ''}>${DN[k]} — ${esc(S.program.days[k].name)}</option>`).join('')}</select>`;
}

// ---------- views ----------
const VIEWS = {};
VIEWS.today = () => {
  const t = today(), T = targets(), p = plannedFor(t), s = S.sessions[t], q = quoteOfDay(), notes = coachNotes();
  let h = `<div class="card hl"><div class="quote">“${esc(q.q)}”</div><div class="small muted" style="margin-top:6px">— ${esc(q.a)}</div>${notes.length ? `<hr><ul class="notes small">${notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  const md = missedDays();
  if (md.length) { const d0 = md[0]; h += `<div class="card"><div class="row between"><div class="grow"><div class="label">Missed workout</div><div style="font-weight:700;margin-top:2px">${fmtD(d0)} · ${esc(plannedFor(d0).name)}</div><div class="small muted">What happened?${md.length > 1 ? ` (${md.length} missed days to note)` : ''}</div></div><button class="btn sm primary" data-a="missedWhy" data-d="${d0}">Add reason</button></div></div>`; }
  const lc = latestCheckin();
  if (!lc || diffD(lc.date, t) >= (S.settings.checkinDays || 28)) h += `<div class="card"><div class="row between"><div><h3>Check-in ${lc ? 'due' : ''}</h3><div class="small muted">${lc ? `Last one: ${fmtD(lc.date)}` : 'Record your starting weight, waist and neck.'}</div></div><button class="btn primary sm" data-a="go" data-t="me" data-s="checkin">Check in</button></div></div>`;
  let w = `<div class="card"><div class="label">${DNL[dow(t)]} · workout</div>`;
  if (p.type === 'gym') {
    const doneSets = s ? s.entries.reduce((a, e) => a + e.sets.filter(x => x.done).length, 0) : 0, totSets = s ? s.entries.reduce((a, e) => a + e.sets.length, 0) : p.items.reduce((a, i) => a + i.sets, 0);
    w += `<div class="row between" style="margin-top:4px"><div class="grow"><h2 style="margin:0">${esc(p.name)}</h2><div class="small muted">${s ? s.entries.length : p.items.length} exercises · ${totSets} sets${s && !s.done ? ` · ${doneSets} done` : ''}</div></div>${s && s.done ? `<span class="pill good">Done ✓</span>` : `<button class="btn primary" data-a="play" data-date="${t}">${s && s.startedAt ? 'Resume' : 'Start'}</button>`}</div>`;
    if (!s) w += `<button class="linkbtn" data-a="switchDay" data-d="${t}">Gym crowded? Switch workout ›</button>`;
    w += workoutButtons(t, p, s);
  } else if (p.type === 'run') {
    const run = S.runs.find(r => r.date === t);
    w += `<div class="row between" style="margin-top:4px"><div class="grow"><h2 style="margin:0">${esc(p.name)}</h2><div class="small muted">${run ? `${run.km} km in ${fmtTime(run.sec)} (${pace(run.sec, run.km)})` : `Target: ${nextLongRun()} km easy`}</div></div>${run ? `<span class="pill good">Done ✓</span>` : `<button class="btn primary sm" data-a="go" data-t="train" data-s="runs">Log run</button>`}</div>`;
    if (!run) w += workoutButtons(t, p, s);
  } else w += `<h2 style="margin:4px 0 0">${esc(p.name)}</h2><div class="small muted">Recover. Walk, stretch, sleep well.</div>${workoutButtons(t, p, s)}`;
  h += w + `</div>` + growthCard(false);
  const pg = proteinGap(t), gap = pg > 10 ? closeGap(pg) : null;
  h += `<div class="card tap" data-a="nutriHelp"><div class="row between"><div class="label">Nutrition · <span class="acc">tap for what to eat ›</span></div><button class="btn sm" data-a="logFood">+ Log food</button></div>${macroCard(t, T)}${gap ? `<div class="sug">Today's plan is ${pg} g protein short. Close the gap: ${esc(gap)}</div>` : ''}</div>`;
  h += sleepCard(t) + waterCard(t) + stepsCard(t) + suppCard(t);
  if ([0, 1].includes(dow(t))) { const r = weekReport(dow(t) === 1 ? addD(monOf(t), -7) : monOf(t)); if (r.planned || r.pDays) h += `<div class="card hl"><div class="row between"><div><div class="label">${dow(t) === 0 ? 'This week' : 'Last week'} in review</div><div style="font-weight:800;font-size:17px;margin-top:4px">${r.done}/${r.planned} workouts · ${r.prs} PRs · protein ${r.pHit}/${r.pDays} days</div>${r.skips.length ? `<div class="small muted">${r.skips.length} skipped/rest/deload day${r.skips.length > 1 ? 's' : ''}</div>` : ''}<div class="small muted" style="margin-top:4px">Focus: ${esc(r.focus)}</div></div></div><button class="btn sm" style="margin-top:10px" data-a="go" data-t="me" data-s="week">Full report</button></div>`; }
  h += `<div class="card"><label class="f" style="margin-top:0">Morning weight (optional)</label><div class="row"><input type="number" inputmode="decimal" step="0.1" data-c="weighin" data-d="${t}" value="${S.weights[t] ?? ''}" placeholder="kg"><button class="btn sm" data-a="saveNow">Save</button></div></div>`;
  return h;
};

function estMinutes(items) { return Math.round(items.reduce((a, it) => a + it.sets * ((ex(it.ex).kind === 'c' ? S.settings.restC : S.settings.restI) + 45), 0) / 60 / 5) * 5; }
function musclesOf(items) { return [...new Set(items.map(it => ex(it.ex).muscle))].slice(0, 5); }
function weekStrip(date) {
  const mon = monOf(date); let h = `<div class="weekstrip"><button class="nav" data-a="week" data-n="-7" aria-label="Previous week">‹</button>`;
  for (let i = 0; i < 7; i++) {
    const d = addD(mon, i), st = dayStatus(d), p = plannedFor(d);
    h += `<button class="wd ${d === date ? 'sel' : ''} ${d === today() ? 'today' : ''}" data-a="pickDate" data-date="${d}"><span class="l">${DN[dow(d)].toUpperCase()}</span><span class="n">${pd(d).getDate()}</span><span class="s">${esc(shortName(p.name))}</span>${st === 'done' ? '<span class="dot done"></span>' : st === 'miss' ? '<span class="dot miss"></span>' : '<span class="dot" style="background:transparent"></span>'}</button>`;
  }
  return h + `<button class="nav" data-a="week" data-n="7" aria-label="Next week">›</button></div>`;
}
VIEWS.session = () => {
  const date = ctx.date, p = plannedFor(date), s = S.sessions[date], isToday = date === today();
  let h = weekStrip(date);
  const dLabel = `${fmtD(date)}${isToday ? ' · Today' : ''}`;
  if (!s) {
    if (p.type !== 'gym') {
      h += `<div class="hero"><div class="label">${dLabel}</div><h2>${esc(p.name)}</h2><div class="small muted">${p.type === 'run' ? `Long-run target ${nextLongRun()} km at an easy pace.` : 'Recovery is when muscle is built. Walk, stretch, sleep.'}</div><div class="row" style="margin-top:14px">${p.type === 'run' ? `<button class="btn primary grow" data-a="sub" data-s="runs">Log run</button>` : ''}<button class="btn grow" data-a="switchDay" data-d="${date}">Train a gym workout instead</button></div>${date >= today() ? workoutButtons(date, p, null) : ''}</div>`;
      return h;
    }
    const items = p.items, sets = items.reduce((a, i) => a + i.sets, 0);
    const dc = dayCheck(dayPick[date] ?? dow(date));
    h += `<div class="hero"><div class="label">${dLabel}</div><h2>${esc(p.name)}</h2><div class="mchips">${musclesOf(items).map(m => `<span class="mchip">${esc(m)}</span>`).join('')}${dc && dc.tracked.length >= 2 ? `<button class="mchip" data-a="sub" data-s="check" style="border:none" >${dc.v.cls === 'good' ? '✓' : dc.v.cls === 'bad' ? '⚠' : '●'} ${esc(dc.v.head)}</button>` : ''}</div>
      <div class="hstats"><div><b>${items.length}</b><span>exercises</span></div><div><b>${sets}</b><span>sets</span></div><div><b>~${estMinutes(items)}</b><span>minutes</span></div></div>
      <button class="btn primary block big-btn" data-a="play" data-date="${date}">▶ Start workout</button><div class="row between"><button class="linkbtn" data-a="switchDay" data-d="${date}">Gym crowded? Switch workout ›</button><button class="linkbtn" data-a="reorderDay" data-date="${date}">⇅ Change order</button></div>${date >= today() ? workoutButtons(date, p, null) : ''}</div>`;
    h += `<div class="sect">Exercises</div>` + items.map((it, i) => { const e = ex(it.ex), sg = suggest(it, date); return `<div class="exrow" data-a="demo" data-ex="${it.ex}"><span class="num">${i + 1}</span>${thumb(it.ex, 54)}<div class="grow"><b>${esc(e.name)}</b><div class="tiny muted">${it.sets} × ${it.min}–${it.max} reps${sg.lastStr ? ` · last ${sg.lastStr}` : ''}</div><span class="tchip">${sg.w ? `Today: ${kg(sg.w)}` : sg.last ? 'Bodyweight' : 'First time — find your weight'}</span>${it.ss ? ' <span class="tchip" style="background:var(--info-soft);color:var(--info)">🔗 superset ↓</span>' : ''}</div><span class="chev">›</span></div>`; }).join('');
    return h;
  }
  const doneSets = s.entries.reduce((a, e) => a + e.sets.filter(z => z.done).length, 0), totSets = s.entries.reduce((a, e) => a + e.sets.length, 0);
  const vol = s.entries.reduce((a, e) => a + e.sets.filter(z => z.done).reduce((b, z) => b + (num(z.w) || 0) * (num(z.r) || 0), 0), 0), prs = s.done ? sessionPRs(date) : [];
  h += `<div class="hero"><div class="label">${dLabel} · ${s.done ? '<span class="good">Completed</span>' : s.startedAt ? '<span class="acc">In progress</span>' : s.deload ? '<span class="acc">💤 Deload day</span>' : '<span class="acc">Ready — order set</span>'}</div><h2>${esc(s.name)}</h2>
    <div class="hstats"><div><b>${doneSets}/${totSets}</b><span>sets done</span></div><div><b>${Math.round(vol).toLocaleString()}</b><span>kg volume</span></div><div><b>${s.startedAt ? Math.max(1, Math.round(((s.endedAt || Date.now()) - s.startedAt) / 60000)) : '–'}</b><span>minutes</span></div></div>
    ${prs.length ? `<div class="sug" style="margin:0 0 12px">New PR${prs.length > 1 ? 's' : ''}: ${esc(prs.map(id => ex(id).name).join(', '))}</div>` : ''}${date >= today() ? workoutButtons(date, p, s) : s.deload ? '<div class="sug" style="margin:0 0 12px">💤 Deload day</div>' : ''}
    ${s.done ? `<button class="btn block" data-a="reopen">Edit / continue workout</button>` : `<button class="btn primary block big-btn" data-a="play" data-date="${date}">▶ ${s.startedAt ? 'Resume' : 'Start'} workout</button><button class="btn danger block" style="margin-top:8px" data-a="cancelSession" data-date="${date}">✕ Cancel workout & start over</button>`}</div>`;
  h += `<div class="row between"><div class="sect">Exercises</div><button class="linkbtn" style="padding:0" data-a="reorderDay" data-date="${date}">⇅ Change order</button></div>` + s.entries.map((e, i) => { const x = ex(e.ex), d = e.sets.filter(z => z.done); return `<div class="exrow ${d.length === e.sets.length ? 'donex' : ''}" data-a="${s.done ? 'demo' : 'playAt'}" data-i="${i}" data-ex="${e.ex}"><span class="num">${d.length === e.sets.length ? '✓' : i + 1}</span>${thumb(e.ex, 54)}<div class="grow"><b>${esc(x.name)}</b><div class="tiny muted">${d.length}/${e.sets.length} sets${d.length ? ' · ' + d.map(z => (z.w ? r1(z.w) + '×' : 'BW×') + z.r).join(', ') : ''}</div></div><span class="chev">›</span></div>`; }).join('');
  h += `<button class="btn block" style="margin-top:6px" data-a="toggleLog">${ctx.showLog ? 'Hide' : 'Edit'} workout log</button>`;
  if (ctx.showLog) {
    h += `<div style="margin-top:12px">`;
    s.entries.forEach((e, i) => {
      const x = ex(e.ex);
      const rows = e.sets.map((z, j) => `<tr class="${z.done ? 'done' : ''}"><td class="faint">${j + 1}</td><td><input type="number" inputmode="decimal" step="0.5" data-c="setW" data-i="${i}" data-j="${j}" value="${z.w}" placeholder="kg"></td><td><input type="number" inputmode="numeric" data-c="setR" data-i="${i}" data-j="${j}" value="${z.r}" placeholder="${e.t.min}–${e.t.max}"></td><td><button class="tick ${z.done ? 'on' : ''}" data-a="tickSet" data-i="${i}" data-j="${j}" aria-label="Set done">${z.done ? '✓' : ''}</button></td></tr>`).join('');
      h += `<div class="ex"><div class="ex-head">${thumb(e.ex, 44, `data-a="demo" data-ex="${e.ex}"`)}<div class="grow"><b>${esc(x.name)}</b><div class="small muted">${e.t.sets} × ${e.t.min}–${e.t.max}</div></div><button class="iconbtn" data-a="exMenu" data-i="${i}" aria-label="Options">•••</button></div><table class="sets"><tr><th>SET</th><th>KG ${x.kind === 'b' ? '(added)' : ''}</th><th>REPS</th><th></th></tr>${rows}</table><div class="row" style="margin-top:6px"><button class="btn sm ghost" data-a="addSet" data-i="${i}">+ Set</button><button class="btn sm ghost" data-a="rmSet" data-i="${i}">− Set</button></div></div>`;
    });
    h += `<div class="row"><button class="btn sm" data-a="addEx">+ Add exercise</button><span class="grow"></span><button class="btn danger sm" data-a="delSession">Discard workout</button></div><br>${saveBtn()}${!s.done ? `<button class="btn block" style="margin-top:8px" data-a="finish">Mark workout finished</button>` : ''}</div>`;
  }
  return h;
};

// ---------- program efficiency: is the split still working? ----------
function exTrend(id) {
  const h = exHistory(id).filter(x => diffD(x.date, today()) <= 56);
  if (h.length < 3) return { id, status: 'new', n: h.length };
  const first = Math.max(...h.slice(0, 2).map(x => x.best)), last = Math.max(...h.slice(-2).map(x => x.best)), pct = r1((last - first) / first * 100);
  const prior = Math.max(...h.slice(0, -3).map(x => x.best), -1), stalled = h.length >= 4 && Math.max(...h.slice(-3).map(x => x.best)) <= prior + 0.01;
  return { id, n: h.length, pct, status: stalled ? 'stalled' : pct > 2 ? 'up' : pct < -2 ? 'down' : 'flat' };
}
function dayCheck(k) {
  const day = S.program.days[k]; if (!day || day.type !== 'gym') return null;
  const rows = day.items.map((it, i) => ({ ...exTrend(it.ex), i, it })), tracked = rows.filter(r => r.status !== 'new'), up = tracked.filter(r => r.status === 'up').length, stalled = tracked.filter(r => r.status === 'stalled' || r.status === 'down');
  const pct = tracked.length ? up / tracked.length : 0, weeks = Math.max(0, weekIdx(today()) + 1);
  let v;
  if (tracked.length < 2) v = { cls: '', head: 'Not enough data yet', line: `Needs about 3 sessions of each exercise (${tracked.length}/${rows.length} tracked so far).` };
  else if (pct >= 0.6) v = { cls: 'good', head: 'Working well ✓', line: `${up} of ${tracked.length} lifts still improving. Keep this day as it is.` };
  else if (pct >= 0.3) v = { cls: 'acc', head: 'Slowing down', line: `${up} of ${tracked.length} lifts improving, ${stalled.length} stuck. Normal after 6–10 weeks — tweak the stuck ones.` };
  else v = { cls: 'bad', head: "You've outgrown this day", line: `Only ${up} of ${tracked.length} lifts improving. Time to change it.` };
  return { k, day, rows, tracked, up, stalled, pct, weeks, v };
}
function checkTips(c) {
  const t = []; if (!c || c.tracked.length < 2 || c.v.cls === 'good') return t;
  for (const r of c.stalled.slice(0, 4)) { const e = ex(r.id), nx = e.prog[0] ? ex(e.prog[0].to) : null; t.push({ i: r.i, text: nx ? `${e.name}: stuck — switch to ${nx.name}` : `${e.name}: stuck — change reps to ${c.day.items[r.i].min <= 8 ? '10–15 lighter' : '6–8 heavier'} for 4 weeks`, to: nx ? nx.id : null, reps: !nx }); }
  if (c.v.cls === 'bad') t.push({ text: 'A deload day (💤 on the workout card) or two often restarts progress.' });
  return t;
}
VIEWS.check = () => {
  const days = [1, 2, 3, 4, 5, 6, 0].map(dayCheck).filter(Boolean), all = days.flatMap(d => d.tracked), up = all.filter(r => r.status === 'up').length, pct = all.length ? up / all.length : 0;
  const head = all.length < 3 ? ['', 'Building data', 'Train 2–3 weeks and this shows whether your program still works.'] : pct >= 0.6 ? ['good', 'Program is working ✓', `${up} of ${all.length} lifts are still getting stronger.`] : pct >= 0.3 ? ['acc', 'Program is slowing down', `${up} of ${all.length} lifts improving. Tweak the stuck exercises below.`] : ['bad', "You've outgrown this program", `Only ${up} of ${all.length} lifts improving. Make the changes below.`];
  const pill = st => ({ up: '<span class="pill good">▲ improving</span>', flat: '<span class="pill acc">● flat</span>', stalled: '<span class="pill bad">■ stuck</span>', down: '<span class="pill bad">▼ dropping</span>', new: '<span class="pill">new</span>' })[st];
  const progCard = head[0] === 'bad' || head[0] === 'acc' ? programSuggestCard(head[0] === 'bad') : `<button class="btn block" style="margin-bottom:12px" data-a="programs">🔄 Browse other programs</button>`;
  let h = `<div class="card ${head[0] === 'good' ? 'accent' : ''}"><div class="label">${esc(S.program.name || 'Your original split')} · week ${Math.max(1, weekIdx(today()) + 1)}</div><div class="big ${head[0]}" style="font-size:22px;margin-top:4px">${head[1]}</div><div class="small muted" style="margin-top:4px">${head[2]}</div>${all.length ? `<div class="bar lg" style="margin-top:12px"><i style="width:${Math.round(pct * 100)}%;background:var(--good)"></i></div><div class="tiny muted" style="margin-top:4px">${Math.round(pct * 100)}% of tracked lifts improving (last 8 weeks)</div>` : ''}</div>${progCard}`;
  for (const c of days) {
    const tips = checkTips(c);
    h += `<div class="card"><div class="row between"><div><div class="label">${DNL[c.k]}</div><h3 style="margin:2px 0">${esc(c.day.name)}</h3></div><span class="pill ${c.v.cls}">${esc(c.v.head)}</span></div><div class="small muted">${esc(c.v.line)}</div>
      <table class="tbl" style="margin-top:8px">${c.rows.map(r => `<tr><td>${esc(ex(r.id).name)}</td><td class="r small">${r.status === 'new' ? `${r.n}/3 sessions` : `${r.pct > 0 ? '+' : ''}${r.pct}%`}</td><td class="r">${pill(r.status)}</td></tr>`).join('')}</table>
      ${tips.length ? `<div class="sect">Suggested changes</div>${tips.map(t => `<div class="check"><div class="grow small">${esc(t.text)}</div>${t.to ? `<button class="btn sm" data-a="checkSwap" data-k="${c.k}" data-i="${t.i}" data-to="${t.to}">Swap in split</button>` : t.reps ? `<button class="btn sm" data-a="checkReps" data-k="${c.k}" data-i="${t.i}">Change reps</button>` : ''}</div>`).join('')}` : ''}</div>`;
  }
  return h + `<div class="tiny faint">"Improving" = estimated 1-rep max up more than 2% over your last sessions. "Stuck" = no new best in the last 3 sessions.</div>`;
};
// ---------- deload days & "rest today" ----------
function deloadNudge(date) {
  if (date !== today()) return null; const why = [];
  const sl = (S.days[addD(date, -0)] || {}).sleep ?? (S.days[addD(date, -1)] || {}).sleep; if (sl && sl < 6) why.push(`only ${sl} h sleep`);
  let run = 0; for (let i = 1; i <= 10; i++) { const d = addD(date, -i), x = S.sessions[d]; if ((x && x.done) || S.runs.some(r => r.date === d)) run++; else break; } if (run >= 6) why.push(`${run} training days in a row`);
  const real = Object.keys(S.sessions).filter(d => d < date && S.sessions[d].done && !S.sessions[d].deload).sort().slice(-2);
  const weaker = d => { const es = S.sessions[d].entries.map(e => { const h = exHistory(e.ex), i = h.findIndex(x => x.date === d); return i > 0 ? h[i].best < Math.max(...h.slice(0, i).map(x => x.best)) * 0.97 : null; }).filter(v => v !== null); return es.length >= 2 && es.filter(Boolean).length / es.length >= 0.5; };
  if (real.length === 2 && real.every(weaker)) why.push('your last 2 workouts were weaker than usual');
  return why.length ? `Rough patch — ${why.join(', ')}. Consider a deload today.` : null;
}
const REASONS = [['tired', '😴 Tired / low energy'], ['sore', '🤕 Sore / injury'], ['sick', '🤒 Sick'], ['work', '💼 Work / busy'], ['sleep', '🛌 Bad sleep'], ['gym', '🏋️ Gym crowded / closed'], ['other', '✏️ Other']];
const reasonLabel = k => (REASONS.find(r => r[0] === k) || [k, k])[1];
const KIND = { rest: 'Rested', deload: 'Deload', missed: 'Missed' };
function askReason(kind, date, cb) {
  ctx.reasonCb = cb; ctx.reasonFor = { kind, date };
  openModal(`<div class="row between"><h2 style="margin:0">${kind === 'missed' ? `Why did you miss ${fmtD(date)}?` : kind === 'rest' ? 'Why rest today?' : 'Why deload today?'}</h2><button class="iconbtn" data-a="close">✕</button></div><div class="small muted" style="margin:4px 0 12px">Shows in your weekly report so you can spot patterns.</div>
  <div class="col" style="gap:6px">${REASONS.map(([k, l]) => `<button class="btn block" style="text-align:left" data-a="reasonPick" data-r="${k}">${l}</button>`).join('')}</div>
  <div id="reasonOther" class="hidden" style="margin-top:10px"><textarea id="reasonNote" rows="2" placeholder="What happened?"></textarea><button class="btn primary block" style="margin-top:8px" data-a="reasonSave">Save</button></div>
  <button class="linkbtn" data-a="reasonSkip">Skip — no reason</button>`);
}
function missedDays() { const out = []; for (let i = 1; i <= 7; i++) { const d = addD(today(), -i); if (d < S.created) break; if (dayStatus(d) === 'miss' && !(S.skips || {})[d]) out.push(d); } return out; }
const deloadsLast7 = date => Object.keys(S.sessions).filter(d => d <= date && diffD(d, date) < 7 && S.sessions[d].deload).length;
function nextRestDay(date) { for (let i = 1; i <= 7; i++) { const d = addD(date, i); if (!S.sessions[d] && !(S.moves || {})[d] && dayPick[d] == null && planned(d).type === 'rest') return d; } return null; }
function workoutButtons(date, p, s) {
  // extra choices under a not-yet-started workout card
  const m = (S.moves || {})[date], b = [];
  if (p.type === 'rest' && m && m.rest) return `<div class="sug">😴 You're resting today — <b>${esc(S.program.days[m.k0] ? S.program.days[m.k0].name : 'your workout')}</b> moved to <b>${fmtD(m.to)}</b>. <button class="btn sm" data-a="undoMove" data-d="${date}">Undo — train today</button></div>`;
  if (s && s.deload && !s.done) return `<div class="sug">💤 Deload day: half the sets at ~60% weight. Doesn't count against your strength progress.${s.entries.some(e => e.sets.some(z => z.done)) ? '' : ` <button class="btn sm" data-a="undoDeload" data-d="${date}">Undo — normal workout</button>`}</div>`;
  if (s && (s.done || s.entries.some(e => e.sets.some(z => z.done)))) return '';
  const nudge = deloadNudge(date), many = deloadsLast7(date) >= 2;
  if (p.type === 'gym') b.push(`<button class="btn sm" data-a="deloadDay" data-d="${date}">💤 Deload today</button>`);
  else b.push(`<button class="btn sm" data-a="switchDay" data-d="${date}" data-deload="1">💤 Light session</button>`);
  if (p.type !== 'rest') b.push(`<button class="btn sm" data-a="restToday" data-d="${date}">😴 Rest today</button>`);
  return `${p.moved && p.moved.from ? `<div class="tiny muted" style="margin-top:6px">↪ Moved here from ${fmtD(p.moved.from)}. <button class="linkbtn" style="padding:0" data-a="undoMove" data-d="${p.moved.from}">Undo</button></div>` : ''}${p.moved && p.moved.swap ? `<div class="tiny muted" style="margin-top:6px">↔ Swapped with ${fmtD(p.moved.swap)}. <button class="linkbtn" style="padding:0" data-a="undoMove" data-d="${date}">Undo</button></div>` : ''}${p.moved && p.moved.once ? `<div class="tiny muted" style="margin-top:6px">Changed for this day only. <button class="linkbtn" style="padding:0" data-a="undoMove" data-d="${date}">Undo</button></div>` : ''}${nudge ? `<div class="sug">${esc(nudge)}</div>` : ''}${many ? `<div class="tiny muted" style="margin-top:6px">That's ${deloadsLast7(date)} deload days this week — if you're often this tired, check sleep and calories.</div>` : ''}<div class="row wrap" style="gap:6px;margin-top:8px">${b.join('')}</div>`;
}
// ---------- ready-made programs ----------
const curPid = () => S.program.tid || 'original';
function progStats(p) {
  const days = Object.values(p.days), gym = days.filter(d => d.type === 'gym'), m = {};
  for (const d of gym) for (const it of d.items) { const mu = ex(it.ex).muscle; m[mu] = (m[mu] || 0) + it.sets; }
  return { gym: gym.length, run: days.filter(d => d.type === 'run').length, min: gym.length ? Math.round(avg(gym.map(d => estMinutes(d.items)))) : 0, back: m.back || 0, delts: (m['side delts'] || 0) + (m['rear delts'] || 0), chest: m.chest || 0, legs: (m.quads || 0) + (m.hamstrings || 0) };
}
function rankedPrograms() { const order = ['ppl5', 'ul4', 'arnold5', 'fb3', 'original']; return order.map(id => window.PROGRAMS.find(p => p.id === id)).filter(p => p && p.id !== curPid()); }
function programSuggestCard(outgrown) {
  const top = rankedPrograms().slice(0, 2);
  return `<div class="card hl"><div class="label">${outgrown ? "You've outgrown this program — try one of these" : 'Progress is slowing — a new program could restart it'}</div>${top.map((p, i) => { const st = progStats(p.program); return `<div class="daycard" style="margin-top:8px" data-a="programPreview" data-id="${p.id}"><div class="dl">${st.gym}×</div><div class="grow"><b>${esc(p.name)}</b>${i === 0 ? ' <span class="pill good">Recommended</span>' : ''}<div class="tiny muted">${esc(p.when)} · ~${st.min} min</div></div><span class="chev">›</span></div>`; }).join('')}<button class="linkbtn" data-a="programs">See all programs ›</button></div>`;
}
function useProgram(prog, tid, name) {
  S.savedPrograms = (S.savedPrograms || []).filter(x => x.tid !== curPid()); S.savedPrograms.unshift({ name: S.program.name || 'Your original split', tid: curPid(), savedAt: today(), program: clone(S.program) }); S.savedPrograms = S.savedPrograms.slice(0, 5);
  S.program = clone(prog); S.program.tid = tid; S.program.name = name; S.profile.programStart = monOf(today());
  const t = today(); for (const d of Object.keys(S.moves || {})) if (d >= t) delete S.moves[d]; for (const d of Object.keys(S.sessions)) if (d >= t && !hasDone(S.sessions[d])) delete S.sessions[d]; for (const d of Object.keys(dayPick)) delete dayPick[d];
  save(); closeModal(); route.tab = 'train'; route.sub.train = 'session'; ctx.date = t; render(); toast(`Now on ${name} — today: ${plannedFor(t).name}`);
}
const shortName = n => n.replace('Cardio — run', 'Run').replace(/\(.*?\)/g, '').split(/[+/]/).map(w => { w = w.trim().split(' ')[0]; return w.length > 7 ? w.slice(0, 5) + '.' : w; }).filter(Boolean).join(' ');
VIEWS.month = () => {
  const [Y, M] = ctx.month.split('-').map(Number), start = monOf(`${Y}-${pad(M)}-01`);
  let h = `<div class="row between" style="margin-bottom:10px"><button class="btn sm" data-a="month" data-n="-1">‹</button><b>${MNL[M - 1]} ${Y}</b><button class="btn sm" data-a="month" data-n="1">›</button></div><div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="h">${d}</div>`).join('')}`;
  let d = start;
  for (let i = 0; i < 42; i++) {
    if (i === 35 && pd(d).getMonth() !== M - 1) break;
    const p = plannedFor(d), st = dayStatus(d), out = pd(d).getMonth() !== M - 1, del = S.sessions[d] && S.sessions[d].deload, swapped = (S.sessions[d] && S.sessions[d].dow !== dow(d)) || !!(S.moves || {})[d];
    h += `<div class="d ${out ? 'out' : ''} ${d === today() ? 'today' : ''}" data-a="openDay" data-date="${d}"><div class="row between"><span class="n">${pd(d).getDate()}</span>${st !== 'rest' && st !== 'pre' ? `<span class="dot ${st}"></span>` : ''}</div><div class="t">${del ? '💤 ' : swapped ? '↔ ' : ''}${esc(p.type === 'rest' && p.moved ? 'Rest' : shortName(p.name))}</div></div>`;
    d = addD(d, 1);
  }
  const doneM = Object.keys(S.sessions).filter(k => k.startsWith(ctx.month) && S.sessions[k].done).length + S.runs.filter(r => r.date.startsWith(ctx.month)).length;
  return h + `</div><div class="row wrap small muted" style="margin-top:10px;gap:14px"><span><span class="dot done"></span> done</span><span><span class="dot miss"></span> missed</span><span><span class="dot plan"></span> planned</span><span>💤 deload day</span><span>↔ switched / moved</span></div>
  <div class="card" style="margin-top:12px"><div class="kpis"><div class="kpi"><b>${doneM}</b><span>sessions this month</span></div><div class="kpi"><b>${streak()}</b><span>day streak</span></div><div class="kpi"><b>Week ${weekIdx(today()) + 1}</b><span>of training block</span></div></div></div>`;
};

VIEWS.runs = () => {
  const runs = [...S.runs].sort((a, b) => b.date.localeCompare(a.date)), longest = runs.length ? Math.max(...runs.map(r => r.km)) : 0;
  const el = runs.filter(r => r.km >= 3), bp = el.length ? el.reduce((a, r) => (r.sec / r.km < a.sec / a.km ? r : a)) : null;
  return `<div class="card accent"><div class="tiny muted">NEXT LONG RUN TARGET</div><div class="big">${nextLongRun()} km</div><div class="small muted">Easy, conversational pace. Goal: 10 km.</div></div>
  <div class="card"><h3>Log a run</h3><div class="grid3"><div><label class="f">Date</label><input type="date" id="runDate" value="${today()}"></div><div><label class="f">Distance (km)</label><input type="number" inputmode="decimal" step="0.1" id="runKm" placeholder="8"></div><div><label class="f">Time (mm:ss)</label><input type="text" inputmode="numeric" id="runTime" placeholder="45:00"></div></div><label class="f">Type</label><select id="runType"><option value="easy">Easy / long run</option><option value="timed">Timed effort</option><option value="intervals">Light + intense mix</option></select><button class="btn primary block" style="margin-top:10px" data-a="addRun">Save run</button></div>
  <div class="card"><div class="kpis"><div class="kpi"><b>${longest ? r1(longest) + ' km' : '–'}</b><span>longest</span></div><div class="kpi"><b>${bp ? fmtTime(bp.sec / bp.km) : '–'}</b><span>best pace /km</span></div><div class="kpi"><b>${runs.length}</b><span>runs logged</span></div></div></div>
  <div class="card"><h3>Distance</h3>${lineChart([...runs].reverse().map(r => ({ d: r.date, y: r.km })), { color: '#5CB8FF' })}</div>
  <div class="card"><h3>History</h3>${runs.length ? `<table class="tbl"><tr><th>Date</th><th class="r">km</th><th class="r">Time</th><th class="r">Pace</th><th></th></tr>${runs.map(r => `<tr><td>${fmtD(r.date)}</td><td class="r">${r.km}</td><td class="r">${fmtTime(r.sec)}</td><td class="r">${fmtTime(r.sec / r.km)}</td><td class="r"><button class="iconbtn" data-a="delRun" data-id="${r.id}" aria-label="Delete">✕</button></td></tr>`).join('')}</table>` : '<div class="small muted">No runs yet. PR to beat: 8 km in 45:00.</div>'}</div>`;
};

VIEWS.program = () => {
  let h = `<div class="card"><div class="row between"><div><div class="label">Current program</div><b>${esc(S.program.name || 'Your original split')}</b></div><button class="btn sm" data-a="programs">🔄 Change program</button></div></div><div class="small muted" style="margin-bottom:10px">Your default week. To swap just one day, use "Switch workout" on the Workout screen.</div>`;
  for (const k of [1, 2, 3, 4, 5, 6, 0]) {
    const d = S.program.days[k];
    h += `<div class="card"><div class="row"><b style="width:38px">${DN[k]}</b><input type="text" data-c="dayName" data-k="${k}" value="${esc(d.name)}"><select data-c="dayType" data-k="${k}" style="width:92px"><option value="gym" ${d.type === 'gym' ? 'selected' : ''}>Gym</option><option value="run" ${d.type === 'run' ? 'selected' : ''}>Run</option><option value="rest" ${d.type === 'rest' ? 'selected' : ''}>Rest</option></select></div>`;
    if (d.type === 'gym') {
      h += d.items.map((it, i) => `<div class="check">${thumb(it.ex, 40, `data-a="demo" data-ex="${it.ex}"`)}<div class="grow small"><b>${esc(ex(it.ex).name)}</b><div class="row" style="gap:4px;margin-top:4px"><input type="number" data-c="pItem" data-f="sets" data-k="${k}" data-i="${i}" value="${it.sets}" style="width:50px"> sets <input type="number" data-c="pItem" data-f="min" data-k="${k}" data-i="${i}" value="${it.min}" style="width:50px">–<input type="number" data-c="pItem" data-f="max" data-k="${k}" data-i="${i}" value="${it.max}" style="width:50px"> reps</div>${i < d.items.length - 1 ? `<label class="tiny muted cb" style="margin-top:6px"><input type="checkbox" data-c="pSS" data-k="${k}" data-i="${i}" ${it.ss ? 'checked' : ''}> 🔗 Superset with the next exercise</label>` : ''}</div><div style="display:flex;flex-direction:column"><button class="iconbtn" data-a="pMove" data-k="${k}" data-i="${i}" aria-label="Move up">▲</button><button class="iconbtn" data-a="pDel" data-k="${k}" data-i="${i}" aria-label="Remove">✕</button></div></div>`).join('');
      h += `<button class="btn sm ghost" style="margin-top:6px" data-a="pAdd" data-k="${k}">+ Add exercise (search)</button>`;
    }
    h += `</div>`;
  }
  return h + `${saveBtn('Save split')}<br><button class="btn danger sm" data-a="resetProgram">Reset split to the original plan</button>`;
};

VIEWS.volume = () => {
  const v = weeklyVolume(today()), ms = [...new Set([...Object.keys(v.plan), ...Object.keys(v.done)])];
  const order = ['back', 'chest', 'side delts', 'shoulders', 'rear delts', 'triceps', 'biceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'lower back'];
  ms.sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
  const verdict = n => (n >= 10 ? '<span class="pill good">Good</span>' : n >= 6 ? '<span class="pill acc">OK</span>' : '<span class="pill bad">Low</span>');
  return `<div class="card"><h3>Sets per muscle — week of ${fmtD(monOf(today()))}</h3><div class="small muted" style="margin-bottom:8px">Direct working sets. 10–20 a week is the growth sweet spot; 6–9 grows slowly. Pressing and pulling also train arms and shoulders indirectly.</div><table class="tbl"><tr><th>Muscle</th><th class="r">Planned</th><th class="r">Done</th><th></th></tr>${ms.map(m => `<tr><td>${esc(m)}</td><td class="r">${v.plan[m] || 0}</td><td class="r">${v.done[m] || 0}</td><td class="r">${verdict(v.plan[m] || 0)}</td></tr>`).join('')}</table></div>`;
};

VIEWS.log = () => {
  const date = ctx.eatDate, T = targets(), items = dayItems(date), rec = S.days[date] || { extras: [] }, tot = dayTotals(date), pg = proteinGap(date), gap = pg > 10 ? closeGap(pg) : null;
  let h = `<div class="row between" style="margin-bottom:10px"><button class="btn sm" data-a="eatDate" data-n="-1">‹</button><div style="text-align:center"><b>${fmtD(date)}</b>${date === today() ? ' <span class="pill acc">Today</span>' : ''}<div class="small muted">${tplKey(date) === 'weekend' ? 'Weekend plan' : 'Weekday plan'}</div></div><button class="btn sm" data-a="eatDate" data-n="1">›</button></div>`;
  h += `<div class="card">${macroCard(date, T)}${gap ? `<div class="sug">Even after the rest of today's plan you'd be ${pg} g protein short. Close the gap: ${esc(gap)}</div>` : `<div class="small ${tot.p >= T.protein ? 'good' : 'muted'}" style="margin-top:6px">${tot.p >= T.protein ? 'Protein target hit ✓' : "Finish today's plan and you hit your protein target."}</div>`}</div>`;
  h += `<button class="btn primary block" data-a="logFood">+ Log something I ate</button><br>`;
  if ((rec.extras || []).length) h += `<div class="card"><h3>Logged food</h3>${rec.extras.map((e, x) => { const v = extraVals(e); return `<div class="check"><div class="grow">${esc(v.name)}<div class="tiny faint">${esc(e.meal || '')}${e.meal ? ' · ' : ''}${esc(v.amt)} · ${Math.round(v.kcal)} kcal · ${r1(v.p)} g protein</div></div><button class="iconbtn" data-a="rmExtra" data-d="${date}" data-x="${x}" aria-label="Remove">✕</button></div>`; }).join('')}</div>`;
  let slot = null; h += `<div class="card"><h3>Meal plan — tick what you ate</h3>`;
  items.forEach(i => {
    const f = food(i.food);
    if (i.slot !== slot) { h += `<div class="tiny muted" style="margin-top:${slot ? 14 : 4}px;letter-spacing:.5px">${esc(i.slot.toUpperCase())}</div>`; slot = i.slot; }
    const alts = i.alts ? `<select data-c="swapFood" data-d="${date}" data-k="${i.key}" class="mini">${i.alts.filter(a => S.foods[a]).map(a => `<option value="${a}" ${a === i.food ? 'selected' : ''}>${esc(S.foods[a].name)}</option>`).join('')}</select>` : '';
    h += `<div class="check"><button class="tick ${i.done ? 'on' : ''}" data-a="tickFood" data-d="${date}" data-k="${i.key}">${i.done ? '✓' : ''}</button><div class="grow"><div>${esc(f.name)}</div><div class="tiny faint">${esc(f.unit)} · ${Math.round(f.kcal * i.qty)} kcal · ${r1(f.p * i.qty)} g protein</div>${alts}</div><div class="qty"><button data-a="qty" data-d="${date}" data-k="${i.key}" data-n="-1">−</button><span>${i.qty}</span><button data-a="qty" data-d="${date}" data-k="${i.key}" data-n="1">+</button></div></div>`;
  });
  return h + `</div>` + waterCard(date);
};

VIEWS.grocery = () => {
  const g = groceryWeek(), st = S.grocery[g.start] || (S.grocery[g.start] = { got: {}, have: {}, extra: [] });
  for (const k of Object.keys(S.grocery)) if (k < addD(g.start, -56)) delete S.grocery[k];
  const ORDER = ['Meat & fish', 'Eggs & dairy', 'Pantry', 'Fruit', 'Supplements'];
  let h = `<!--prep--><div class="card accent"><div class="tiny muted">SHOPPING DAY</div><div class="big" style="font-size:20px">${fmtD(g.start)}</div><div class="small muted">Covers ${fmtD(g.start)} – ${fmtD(addD(g.start, 6))} from your meal plan. Tick when bought, or "Have" if it's already in the kitchen.</div></div>`;
  for (const c of [...new Set(g.items.map(i => i.cat))].sort((a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99)) {
    h += `<div class="card"><h3>${esc(c)}</h3>${g.items.filter(i => i.cat === c).map(i => { const got = st.got[i.id], have = st.have[i.id]; return `<div class="check"><button class="tick ${got ? 'on' : ''}" data-a="gGot" data-id="${i.id}">${got ? '✓' : ''}</button><div class="grow ${got || have ? 'strike' : ''}">${esc(i.name)}<div class="tiny ${i.id.startsWith('stock_') ? 'acc' : 'faint'}">${esc(i.amt)}</div></div><button class="btn sm ${have ? '' : 'ghost'}" data-a="gHave" data-id="${i.id}">${have ? 'Have ✓' : 'Have'}</button></div>`; }).join('')}</div>`;
  }
  h = h.replace('<!--prep-->', mealPrepCard());
  return h + `<div class="card"><h3>Other items</h3>${st.extra.map((e, x) => `<div class="check"><button class="tick ${e.got ? 'on' : ''}" data-a="gxGot" data-x="${x}">${e.got ? '✓' : ''}</button><div class="grow ${e.got ? 'strike' : ''}">${esc(e.name)}</div><button class="iconbtn" data-a="gxDel" data-x="${x}">✕</button></div>`).join('')}<div class="row" style="margin-top:8px"><input type="text" id="gxName" placeholder="e.g. paprika, soy sauce"><button class="btn sm" data-a="gxAdd">Add</button></div></div><button class="btn sm" data-a="gCopy">Copy list as text</button>`;
};

function mealPrepCard() {
  const start = sunOf(today()), agg = {};
  for (let i = 0; i < 7; i++) { const d = addD(start, i); for (const s of S.templates[tplKey(d)]) for (const it of s.items) agg[it.food] = (agg[it.food] || 0) + it.qty; }
  const wd = {}; for (const s of S.templates.weekday) for (const it of s.items) wd[it.food] = (wd[it.food] || 0) + it.qty;
  const lines = [];
  if (agg.chicken) lines.push(`<b>Chicken:</b> cut ${agg.chicken} blocks (~${r1(agg.chicken * (food('chicken').gPer || 143) / 1000)} kg raw), marinate, and pack ${wd.chicken || 2} blocks per daily bag (${Math.ceil(agg.chicken / (wd.chicken || 2))} bags).`);
  if (agg.rice) lines.push(`<b>Rice:</b> ${r1(agg.rice)} cups cooked this week ≈ ${r1(agg.rice * 62 / 1000)} kg uncooked. Cooking every 2 days ≈ ${Math.round(agg.rice / 7 * 2 * 62)} g uncooked per batch.`);
  if (agg.egg) lines.push(`<b>Eggs:</b> ${agg.egg} for the week — boil ${Math.min(agg.egg, 12)} now for quick breakfasts.`);
  if (agg.nitrotech) lines.push(`<b>Nitro-Tech:</b> ${agg.nitrotech} scoops this week.`);
  return lines.length ? `<div class="card"><div class="label">Sunday meal prep</div><ul class="notes small" style="margin-top:8px">${lines.map(l => `<li>${l}</li>`).join('')}</ul></div>` : '';
}
VIEWS.plan = () => {
  const key = ctx.tpl, tpl = S.templates[key], pt = plannedTotals(key), T = targets();
  const opts = sel => Object.entries(S.foods).map(([id, f]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
  let h = `<div class="row" style="margin-bottom:10px"><button class="btn sm ${key === 'weekday' ? 'primary' : ''}" data-a="tpl" data-v="weekday">Weekday (Mon–Fri)</button><button class="btn sm ${key === 'weekend' ? 'primary' : ''}" data-a="tpl" data-v="weekend">Weekend (Sat–Sun)</button></div>
  <div class="card"><div class="small muted">If you eat everything in this plan:</div><div class="kpis" style="margin-top:6px"><div class="kpi"><b>${Math.round(pt.kcal)}</b><span>kcal (target ${T.kcal})</span></div><div class="kpi"><b>${Math.round(pt.p)} g</b><span>protein (target ${T.protein})</span></div><div class="kpi"><b>${Math.round(pt.f)} g</b><span>fat (target ${T.fat})</span></div></div></div>`;
  tpl.forEach((s, si) => {
    h += `<div class="card"><div class="row"><input type="text" data-c="slotName" data-si="${si}" value="${esc(s.slot)}"><button class="iconbtn" data-a="slotDel" data-si="${si}" aria-label="Delete meal">✕</button></div>`;
    s.items.forEach((it, ii) => {
      h += `<div class="row" style="margin-top:8px"><select data-c="tItemFood" data-si="${si}" data-ii="${ii}">${opts(it.food)}</select><button class="iconbtn" data-a="tItemFind" data-si="${si}" data-ii="${ii}" aria-label="Search a different food">🔎</button><input type="number" step="0.5" data-c="tItemQty" data-si="${si}" data-ii="${ii}" value="${it.qty}" style="width:70px"><button class="iconbtn" data-a="tItemDel" data-si="${si}" data-ii="${ii}">✕</button></div>`;
      if (food(it.food).protein) h += `<label class="small muted cb"><input type="checkbox" data-c="tItemAlt" data-si="${si}" data-ii="${ii}" ${it.alts ? 'checked' : ''}> Allow swapping with other meats/fish</label>`;
    });
    h += `<button class="btn sm ghost" style="margin-top:8px" data-a="tItemAdd" data-si="${si}">🔎 + Add food (search)</button></div>`;
  });
  return h + `<button class="btn sm" data-a="slotAdd">+ Add meal</button><br><br>${saveBtn('Save meal plan')}<button class="btn ghost block" style="margin-top:8px" data-a="sub" data-s="foods">🗑 Manage the food list (delete foods)</button>`;
};

// ---------- meal calculator ----------
const CALC_KEY = 'gf_calc';
let CALC = (() => { try { return JSON.parse(localStorage.getItem(CALC_KEY)) || null; } catch (e) { return null; } })() || { name: '', portions: 1, items: [] };
const saveCalc = () => { try { localStorage.setItem(CALC_KEY, JSON.stringify(CALC)); } catch (e) {} };
function calcItemVals(it) { const a = num(it.amt) || 0, m = it.mode === 'g' && it.g ? a / it.g : a; return { kcal: it.kcal * m, p: it.p * m, c: it.c * m, f: it.f * m }; }
function calcTotals() { const t = { kcal: 0, p: 0, c: 0, f: 0 }; for (const it of CALC.items) { const v = calcItemVals(it); t.kcal += v.kcal; t.p += v.p; t.c += v.c; t.f += v.f; } return t; }
VIEWS.calc = () => {
  const T = targets(), tot = calcTotals(), n = Math.max(1, num(CALC.portions) || 1), per = { kcal: tot.kcal / n, p: tot.p / n, c: tot.c / n, f: tot.f / n };
  const meal = { kcal: Math.round(T.kcal / 4), p: Math.round(T.protein / 4), c: Math.round(T.carbs / 4), f: Math.round(T.fat / 4) };
  const left = { kcal: Math.max(0, T.kcal - dayTotals(today()).kcal), p: Math.max(0, T.protein - dayTotals(today()).p) };
  let h = `<div class="card"><div class="label">Meal calculator</div><div class="small muted" style="margin-top:4px">Add every ingredient of a meal or a whole meal-prep batch. You get the totals, the macros per container, and whether it's enough for your goal.</div>
  <label class="f">Name (optional)</label><input type="text" data-c="calcName" value="${esc(CALC.name)}" placeholder="e.g. Chicken rice meal prep"></div>`;
  h += `<div class="card"><div class="row between"><h3 style="margin:0">Ingredients</h3><button class="btn sm primary" data-a="calcAdd">+ Add food</button></div>`;
  if (!CALC.items.length) h += `<div class="small muted" style="margin-top:10px">Nothing yet. Tap <b>+ Add food</b> — e.g. 2 kg chicken breast, 1.5 kg rice, 2 tbsp oil.</div>`;
  CALC.items.forEach((it, i) => {
    const v = calcItemVals(it);
    h += `<div class="check" style="flex-wrap:wrap"><div class="grow" style="min-width:150px"><b>${esc(it.name)}</b><div class="tiny muted">${Math.round(v.kcal)} kcal · P ${r1(v.p)} · C ${r1(v.c)} · F ${r1(v.f)}</div></div>
      <div class="row" style="gap:6px"><input type="number" inputmode="decimal" step="any" data-c="calcAmt" data-i="${i}" value="${it.amt}" style="width:84px;text-align:center"><select data-c="calcMode" data-i="${i}" style="width:auto">${it.g ? `<option value="g" ${it.mode === 'g' ? 'selected' : ''}>g</option>` : ''}<option value="srv" ${it.mode !== 'g' ? 'selected' : ''}>× ${esc(it.label.length > 14 ? 'serving' : it.label)}</option></select><button class="iconbtn" data-a="calcDel" data-i="${i}" aria-label="Remove">✕</button></div></div>`;
  });
  h += `</div>`;
  if (CALC.items.length) {
    const vs = (v, tgt, isP) => { const pc = tgt ? v / tgt * 100 : 0; return `<div class="bar" style="margin-top:4px"><i style="width:${Math.min(100, pc)}%;background:${pc > 115 && !isP ? 'var(--bad)' : pc >= 85 ? 'var(--good)' : 'var(--accent)'}"></i></div>`; };
    const pShort = Math.round(meal.p - per.p), gap = pShort > 5 ? closeGap(pShort) : null;
    const verdict = per.p >= meal.p * 0.85 && per.kcal <= meal.kcal * 1.2 ? ['good', 'Good meal for your goal ✓', `Enough protein, calories within range for a ¼-of-the-day meal.`]
      : per.p < meal.p * 0.85 ? ['bad', `Short on protein by ${pShort} g`, gap ? `Add ${gap} per container.` : 'Add more meat, fish or eggs.']
      : ['bad', `High in calories (+${Math.round(per.kcal - meal.kcal)} kcal)`, 'Cut oil or rice a little, or count it as a bigger meal.'];
    h += `<div class="card"><div class="row between"><h3 style="margin:0">Split into containers</h3><div class="qty"><button data-a="calcPort" data-n="-1">−</button><span>${n}</span><button data-a="calcPort" data-n="1">+</button></div></div>
      <div class="small muted" style="margin-top:6px">Whole batch: <b>${Math.round(tot.kcal)} kcal</b> · ${Math.round(tot.p)} g protein · ${Math.round(tot.c)} g carbs · ${Math.round(tot.f)} g fat</div></div>`;
    h += `<div class="card ${verdict[0] === 'good' ? 'accent' : ''}"><div class="label">${n > 1 ? 'Per container' : 'This meal'}</div>
      <div class="mtiles"><div class="k"><b>${Math.round(per.kcal)}</b><span>kcal</span></div><div class="pp"><b>${r1(per.p)}</b><span>protein g</span></div><div class="cc"><b>${r1(per.c)}</b><span>carbs g</span></div><div class="ff"><b>${r1(per.f)}</b><span>fat g</span></div></div>
      <div class="macro" style="margin-top:12px"><div class="row between small"><span>Calories vs one meal (${meal.kcal})</span><span class="muted">${Math.round(per.kcal / meal.kcal * 100)}%</span></div>${vs(per.kcal, meal.kcal)}</div>
      <div class="macro"><div class="row between small"><span>Protein vs one meal (${meal.p} g)</span><span class="muted">${Math.round(per.p / meal.p * 100)}%</span></div>${vs(per.p, meal.p, true)}</div>
      <div style="margin-top:10px"><b class="${verdict[0]}">${verdict[1]}</b><div class="small muted">${esc(verdict[2])}</div></div>
      <div class="tiny faint" style="margin-top:8px">One meal = ¼ of your day (${T.kcal} kcal, ${T.protein} g protein). Left today: ${Math.round(left.kcal)} kcal, ${Math.round(left.p)} g protein.</div></div>
      <div class="grid2"><button class="btn primary" data-a="calcLog">Log 1 ${n > 1 ? 'container' : 'meal'} today</button><button class="btn" data-a="calcSave">Save to My foods</button></div><button class="btn ghost block" style="margin-top:8px" data-a="calcClear">Clear calculator</button>`;
  }
  return h;
};
function calcPick() {
  openModal(`<div class="row between"><h2 style="margin:0">Add ingredient</h2><button class="iconbtn" data-a="close">✕</button></div><div class="searchbar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" id="cQ" data-in="cQ" placeholder="Search chicken, rice, oil, egg…" autocomplete="off"></div><div id="cRes"></div><button class="btn ghost block" style="margin-top:8px" data-a="calcManual">✏️ Enter an ingredient myself</button>`);
  calcResults('');
}
function calcResults(q) {
  const box = $('#cRes'); if (!box) return; const { mine, db } = foodSearch(q);
  const list = [...mine.slice(0, q ? 15 : 20), ...(q ? db.slice(0, 40) : [])]; calcPick.list = list;
  box.innerHTML = list.map((it, i) => fRow(it, i).replace('data-a="flPick"', 'data-a="calcPicked"')).join('') || '<div class="small muted">No match — enter it yourself below.</div>';
}

VIEWS.foods = () => `<div class="row between" style="margin-bottom:8px"><div class="small muted">Values per 1 unit. Tap to edit. Foods you save from the + button land here.</div><button class="btn sm primary" data-a="foodEdit" data-id="">+ New</button></div><div class="card">${Object.entries(S.foods).map(([id, f]) => `<div class="list-item" data-a="foodEdit" data-id="${id}"><div class="grow"><b>${esc(f.name)}</b><div class="tiny faint">${esc(f.unit)} · ${r1(f.kcal)} kcal · P ${r1(f.p)} · C ${r1(f.c)} · F ${r1(f.f)}</div></div><span class="pill">${esc(f.cat || '')}</span>${f.stock ? '' : `<button class="iconbtn" data-a="foodDel" data-id="${id}" aria-label="Delete ${esc(f.name)}">🗑</button>`}</div>`).join('')}</div>`;

VIEWS.analysis = () => {
  const g = growth(); void g;
  const ws = weightSeries(), T = targets();
  let h = growthCard(true);
  const ids = usedExIds().filter(id => exHistory(id).length >= 2);
  const bestSet = x => x.sets.reduce((a, z) => (e1rm(z.w, z.r) > e1rm(a.w, a.r) ? z : a)), setTxt = z => `${z.w ? r1(z.w) + ' kg' : 'BW'} × ${z.r}`;
  if (ids.length) h += `<div class="card"><h3>Lift by lift</h3><div class="small muted" style="margin-bottom:6px">Your best set the first time you did each exercise → your best set last time.</div>${ids.map(id => { const h0 = exHistory(id), f = h0[0], l = h0[h0.length - 1], pc = r1((l.best - f.best) / f.best * 100); return `<div class="check"><div class="grow"><b>${esc(ex(id).name)}</b><div class="small muted">${setTxt(bestSet(f))} <span class="faint">(${fmtD(f.date).slice(4)})</span> → <b>${setTxt(bestSet(l))}</b> <span class="faint">(${fmtD(l.date).slice(4)})</span></div></div><span class="pill ${pc > 0 ? 'good' : pc < 0 ? 'bad' : ''}">${pc > 0 ? '+' : ''}${pc}% ${pc > 0 ? 'stronger' : pc < 0 ? 'weaker' : 'same'}</span></div>`; }).join('')}<div class="tiny faint" style="margin-top:6px">The % combines weight and reps, so 24 kg × 12 counts as stronger than 24 kg × 10.</div></div>`;
  h += `<div class="card"><h3>Weight trend</h3>${lineChart(ws, { empty: 'Log a morning weight on the Today tab to see your trend.' })}<div class="small muted" style="margin-top:6px">Target ${T.kcal} kcal · ${T.protein} g protein · goal: ${esc(GOALS[S.profile.goal])}</div></div>`;
  return h;
};

VIEWS.week = () => {
  ctx.weekMon = ctx.weekMon || monOf(today()); const r = weekReport(ctx.weekMon), T = targets();
  const tile = (v, l) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
  return `<div class="row between" style="margin-bottom:10px"><button class="btn sm" data-a="weekRep" data-n="-7">‹</button><b>${fmtD(r.mon)} – ${fmtD(r.sun)}</b><button class="btn sm" data-a="weekRep" data-n="7" ${r.sun >= today() ? 'disabled' : ''}>›</button></div>
  <div class="card hl"><div class="label">Focus for next week</div><div style="font-weight:800;font-size:17px;margin-top:4px">${esc(r.focus[0].toUpperCase() + r.focus.slice(1))}</div></div>
  <div class="card"><h3>Training</h3><div class="kpis">${tile(`${r.done}/${r.planned}`, 'workouts done')}${tile(r.sets, 'working sets')}${tile(Math.round(r.vol).toLocaleString() + ' kg', 'volume')}${tile(r.prs, 'new PRs')}${tile(S.runs.filter(x => x.date >= r.mon && x.date <= r.sun).reduce((a, x) => a + x.km, 0) + ' km', 'ran')}</div></div>
  <div class="card"><h3>Nutrition</h3><div class="kpis">${tile(r.pDays ? Math.round(r.kcal / r.pDays) : '–', `avg kcal (target ${T.kcal})`)}${tile(r.pDays ? Math.round(r.p / r.pDays) + ' g' : '–', `avg protein (target ${T.protein})`)}${tile(`${r.pHit}/${r.pDays}`, 'days protein on target')}</div></div>
  <div class="card"><h3>Skipped, rested & deload days</h3>${r.skips.length ? (() => { const c = {}; r.skips.forEach(([, x]) => { if (x.reason !== 'none') c[x.reason] = (c[x.reason] || 0) + 1; }); return `<div class="small" style="margin-bottom:6px">${Object.entries(c).map(([k, n]) => `${reasonLabel(k)} ×${n}`).join(' · ') || 'No reasons given'}</div>` + r.skips.map(([d, x]) => `<div class="check"><div class="grow small"><b>${fmtD(d)}</b> · ${KIND[x.kind] || x.kind}</div><span class="small muted">${x.reason === 'none' ? '—' : esc(reasonLabel(x.reason))}${x.note ? ` · ${esc(x.note)}` : ''}</span></div>`).join(''); })() : '<div class="small muted">None this week 💪</div>'}</div>
  <div class="card"><h3>Recovery & habits</h3><div class="kpis">${tile(r.sleepAvg ? r.sleepAvg + ' h' : '–', 'avg sleep')}${tile(r.waterAvg ? fmtL(r.waterAvg) : '–', `avg water · goal hit ${r.waterHit}×`)}${tile(r.stepsAvg ? r.stepsAvg.toLocaleString() : '–', `avg steps · goal hit ${r.stepHit}×`)}${tile(r.wChange != null ? (r.wChange > 0 ? '+' : '') + r.wChange + ' kg' : '–', 'weight change')}</div></div>`;
};
VIEWS.lifts = () => {
  const ids = usedExIds().filter(id => exHistory(id).length);
  if (!ids.length) return `<div class="card"><h3>No lifts logged yet</h3><div class="small muted">Finish your first workout and your strength charts appear here.</div></div>`;
  if (!ctx.liftEx || !ids.includes(ctx.liftEx)) ctx.liftEx = ids[0];
  const h0 = exHistory(ctx.liftEx), best = h0.reduce((a, x) => (x.best > a.best ? x : a));
  let h = `<div class="card"><select data-c="liftEx">${ids.map(id => `<option value="${id}" ${id === ctx.liftEx ? 'selected' : ''}>${esc(ex(id).name)}</option>`).join('')}</select>
  <div class="kpis" style="margin-top:10px"><div class="kpi"><b>${r1(best.best)}${best.sets.some(s => s.w) ? ' kg' : ' reps'}</b><span>best est. 1-rep max</span></div><div class="kpi"><b>${h0.length}</b><span>sessions</span></div><div class="kpi"><b>${r1(Math.max(...h0[h0.length - 1].sets.map(s => s.w)))} kg</b><span>current top weight</span></div></div>
  <h3 style="margin-top:12px">Estimated 1-rep max</h3>${lineChart(h0.map(x => ({ d: x.date, y: x.best })))}</div>`;
  h += `<div class="card"><h3>History</h3><table class="tbl"><tr><th>Date</th><th>Sets</th><th class="r">e1RM</th></tr>${[...h0].reverse().map(x => `<tr><td>${fmtD(x.date)}</td><td class="small">${x.sets.map(s => (s.w ? r1(s.w) + '×' : 'BW×') + s.r).join(', ')}</td><td class="r">${r1(x.best)}</td></tr>`).join('')}</table></div>`;
  return h + `<div class="card"><h3>All personal records</h3><table class="tbl">${ids.map(id => { const b = exHistory(id).reduce((a, x) => (x.best > a.best ? x : a)), top = b.sets.reduce((a, s) => (e1rm(s.w, s.r) > e1rm(a.w, a.r) ? s : a)); return `<tr><td>${esc(ex(id).name)}</td><td class="r">${top.w ? r1(top.w) + ' kg × ' : ''}${top.r}</td><td class="r faint small">${fmtD(b.date)}</td></tr>`; }).join('')}</table></div>`;
};

VIEWS.body = () => {
  const ws = weightSeries(), cs = S.checkins, T = targets();
  let h = `<div class="card"><div class="kpis"><div class="kpi"><b>${r1(curWeight())} kg</b><span>current weight</span></div><div class="kpi"><b>${T.bf != null ? T.bf + '%' : '–'}</b><span>body fat (Navy)</span></div><div class="kpi"><b>${cs.length && cs[cs.length - 1].waist ? cs[cs.length - 1].waist + ' cm' : '–'}</b><span>waist</span></div></div></div>
  <div class="card"><h3>Weight</h3>${lineChart(ws, { empty: 'Log a morning weight on the Today tab or do a check-in.' })}</div>
  <div class="card"><h3>Waist</h3>${lineChart(cs.filter(c => c.waist).map(c => ({ d: c.date, y: c.waist })), { color: '#FF8A5B', empty: 'Waist comes from your monthly check-ins.' })}</div>
  <div class="card"><h3>Shoulder : waist (V-taper)</h3>${lineChart(cs.filter(c => c.shoulders && c.waist).map(c => ({ d: c.date, y: Math.round(c.shoulders / c.waist * 100) / 100 })), { color: '#11995A', empty: 'Add your shoulder measurement at check-ins. Going up = more triangle shape. Aim ≈ 1.6.' })}</div>
  <div class="card"><h3>Body fat %</h3>${lineChart(cs.filter(c => c.bf).map(c => ({ d: c.date, y: c.bf })), { color: '#C792EA', empty: 'Needs waist + neck in two check-ins.' })}</div>`;
  if (cs.length) h += `<div class="card"><h3>Check-ins</h3><table class="tbl"><tr><th>Date</th><th class="r">kg</th><th class="r">Waist</th><th class="r">BF%</th><th></th></tr>${[...cs].reverse().map(c => `<tr><td>${fmtD(c.date)}</td><td class="r">${c.weight ?? '–'}</td><td class="r">${c.waist ?? '–'}</td><td class="r">${c.bf ?? '–'}</td><td class="r"><button class="iconbtn" data-a="delCheckin" data-d="${c.date}">✕</button></td></tr>`).join('')}</table></div>`;
  return h;
};

VIEWS.photos = () => {
  const withP = S.checkins.filter(c => c.photo);
  if (!withP.length) return `<div class="card"><h3>No progress photos yet</h3><div class="small muted">Add one at each monthly check-in — same spot, same light, relaxed and flexed. Photos stay on the phone they were taken on (and in your PDF backup).</div></div>`;
  afterRender.push(async () => { for (const c of withP) { const el = document.getElementById('ph_' + c.date); if (el) { const u = await idb.get(c.photo); if (u) el.src = u; else el.alt = 'Photo is on your other device'; } } });
  const f = withP[0], l = withP[withP.length - 1];
  return (withP.length > 1 ? `<div class="card"><h3>Then vs now</h3><div class="photos"><div><img class="photo" id="ph_${f.date}" alt=""><div class="small muted">${fmtD(f.date)}</div></div><div><img class="photo" id="ph_${l.date}" alt=""><div class="small muted">${fmtD(l.date)}</div></div></div></div>` : '') +
    `<div class="card"><h3>All photos</h3><div class="photos">${withP.slice(withP.length > 1 ? 1 : 0, withP.length > 1 ? -1 : undefined).map(c => `<div><img class="photo" id="ph_${c.date}" alt=""><div class="small muted">${fmtD(c.date)}</div></div>`).join('') || '<div class="small muted">More photos appear here as you add them.</div>'}</div></div>`;
};

VIEWS.checkin = () => {
  const lc = latestCheckin();
  let h = `<div class="card accent"><h3>Check-in</h3><div class="small muted">Every ${(S.settings.checkinDays || 28) === 14 ? '2' : '4'} weeks, morning, before eating. Waist at the belly button, relaxed; neck just below the Adam's apple.</div>
  <div class="grid2"><div><label class="f">Date</label><input type="date" id="ciDate" value="${today()}"></div><div><label class="f">Weight (kg)</label><input type="number" inputmode="decimal" step="0.1" id="ciW" value="${S.weights[today()] ?? ''}"></div>
  <div><label class="f">Waist (cm)</label><input type="number" inputmode="decimal" step="0.5" id="ciWaist"></div><div><label class="f">Neck (cm)</label><input type="number" inputmode="decimal" step="0.5" id="ciNeck" value="${lc?.neck ?? ''}"></div>
  <div><label class="f">Shoulders (cm) — around the widest point</label><input type="number" inputmode="decimal" step="0.5" id="ciSh" value="${lc?.shoulders ?? ''}"></div><div><label class="f">&nbsp;</label><div class="tiny muted">Shoulders ÷ waist tracks your V-taper. Aim ≈ 1.6.</div></div>
  <div><label class="f">Chest (cm, optional)</label><input type="number" inputmode="decimal" step="0.5" id="ciChest"></div><div><label class="f">Arm, flexed (cm, optional)</label><input type="number" inputmode="decimal" step="0.5" id="ciArm"></div></div>
  <label class="f">Progress photo (optional)</label><input type="file" accept="image/*" id="ciPhoto"><button class="btn primary block" style="margin-top:12px" data-a="saveCheckin">Save check-in</button></div>`;
  if (ctx.adapt) { const a = ctx.adapt; h += `<div class="card"><h3>Calorie review</h3><div class="small muted">${esc(a.summary)}</div><p>${esc(a.why)}</p>${a.note ? `<div class="sug">${esc(a.note)}</div>` : ''}${a.delta ? `<div class="row" style="margin-top:8px"><button class="btn primary sm" data-a="applyAdapt">Apply ${a.delta > 0 ? '+' : ''}${a.delta} kcal</button><button class="btn sm" data-a="skipAdapt">Keep as is</button></div>` : ''}</div>`; }
  return h;
};

VIEWS.profile = () => {
  const p = S.profile, T = targets();
  return `<div class="card accent"><h3>Your daily targets</h3><div class="kpis"><div class="kpi"><b>${T.kcal}</b><span>kcal</span></div><div class="kpi"><b>${T.protein} g</b><span>protein</span></div><div class="kpi"><b>${T.carbs} g</b><span>carbs</span></div><div class="kpi"><b>${T.fat} g</b><span>fat</span></div></div>
  <div class="small muted" style="margin-top:10px">${esc(T.formula)}: BMR ${T.bmr} kcal × activity ${p.activity} = ${T.tdee} kcal maintenance. Goal: ${esc(GOALS[p.goal])}${p.kcalOffset ? ` · check-in adjustment ${p.kcalOffset > 0 ? '+' : ''}${p.kcalOffset} kcal` : ''}. Protein ${PROT_K[p.goal]} g/kg, fat 0.9 g/kg, carbs fill the rest. Using weight ${r1(T.w)} kg.</div></div>
  <div class="card"><h3>Profile</h3><div class="grid2"><div><label class="f">Age</label><input type="number" data-c="prof" data-f="age" value="${p.age}"></div><div><label class="f">Height (cm)</label><input type="number" data-c="prof" data-f="heightCm" value="${p.heightCm}"></div>
  <div><label class="f">Starting weight (kg)</label><input type="number" step="0.1" data-c="prof" data-f="baseWeight" value="${p.baseWeight}"></div><div><label class="f">Goal</label><select data-c="prof" data-f="goal">${Object.entries(GOALS).map(([k, v]) => `<option value="${k}" ${p.goal === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
  <label class="f">Activity level</label><select data-c="prof" data-f="activity"><option value="1.375" ${p.activity == 1.375 ? 'selected' : ''}>Light — 3–4 training days</option><option value="1.55" ${p.activity == 1.55 ? 'selected' : ''}>Moderate — 5–6 training days</option><option value="1.725" ${p.activity == 1.725 ? 'selected' : ''}>Very active — daily training + active job</option></select></div>
  <div class="card"><h3>Manual overrides</h3><div class="small muted">Leave empty to use the automatic numbers.</div><div class="grid3"><div><label class="f">kcal</label><input type="number" data-c="ovr" data-f="kcal" value="${S.overrides.kcal ?? ''}"></div><div><label class="f">Protein g</label><input type="number" data-c="ovr" data-f="protein" value="${S.overrides.protein ?? ''}"></div><div><label class="f">Fat g</label><input type="number" data-c="ovr" data-f="fat" value="${S.overrides.fat ?? ''}"></div></div>${p.kcalOffset ? `<button class="btn sm" style="margin-top:10px" data-a="resetOffset">Reset check-in adjustment (${p.kcalOffset} kcal)</button>` : ''}</div>
  <div class="card"><h3>Appearance</h3><div class="seg">${[['light', 'Light'], ['dark', 'Dark'], ['auto', 'Match phone']].map(([k, l]) => `<button class="${(S.settings.theme || 'light') === k ? 'on' : ''}" data-a="theme" data-v="${k}">${l}</button>`).join('')}</div></div>
  <div class="card"><h3>Daily habits & workout player</h3><div class="grid3"><div><label class="f">Water goal (L)</label><input type="number" step="0.1" data-c="waterGoal" value="${S.settings.waterGoalL ?? ''}" placeholder="auto ${r1(waterGoal(today()) / 1000)}"></div><div><label class="f">Bottle (oz)</label><input type="number" data-c="set" data-f="bottleOz" value="${S.settings.bottleOz}"></div><div><label class="f">Steps target</label><input type="number" data-c="set" data-f="stepsTarget" value="${S.settings.stepsTarget}"></div></div><div class="grid2"><div><label class="f">Rest, big lifts (sec)</label><input type="number" data-c="set" data-f="restC" value="${S.settings.restC}"></div><div><label class="f">Rest, isolation (sec)</label><input type="number" data-c="set" data-f="restI" value="${S.settings.restI}"></div></div><label class="small muted cb"><input type="checkbox" data-c="sound" ${S.settings.sound ? 'checked' : ''}> Beep when rest is over</label><label class="f">Hands-free: seconds per set</label><input type="number" data-c="set" data-f="setSec" value="${S.settings.setSec || 40}"><label class="small muted cb"><input type="checkbox" data-c="tgl" data-f="autoFlow" ${S.settings.autoFlow ? 'checked' : ''}> Auto-continue workout (no taps between exercises)</label><label class="small muted cb"><input type="checkbox" data-c="tgl" data-f="notify" ${S.settings.notify ? 'checked' : ''}> Lock-screen timer & alarm notifications</label><label class="small muted cb"><input type="checkbox" data-c="tgl" data-f="bgAudio" ${S.settings.bgAudio ? 'checked' : ''}> Extra-reliable timer with screen off (plays silent audio — <b>pauses Spotify/YouTube music</b>)</label><label class="f">Check-in reminder</label><div class="seg">${[[14, 'Every 2 weeks'], [28, 'Every 4 weeks']].map(([v, l]) => `<button class="${(S.settings.checkinDays || 28) === v ? 'on' : ''}" data-a="ciEvery" data-v="${v}">${l}</button>`).join('')}</div></div>${saveBtn()}`;
};

VIEWS.supps = () => {
  const card = key => {
    const fid = Object.keys(S.foods).find(k => S.foods[k].stock === key); if (!fid) return '';
    const st = S.stock[key], si = stockInfo(key), unit = key === 'nitrotech' ? 'scoops' : 'servings';
    return `<div class="card"><div class="row between"><h3 style="margin:0">${esc(suppName(fid))}</h3><span class="pill ${si.runout && diffD(today(), si.runout) <= 7 ? 'bad' : 'good'}">${si.left} ${unit} left</span></div>
    <div class="bar lg" style="margin-top:12px"><i style="width:${Math.min(100, si.left / st.size * 100)}%;background:var(--good)"></i></div>
    <div class="small muted" style="margin-top:8px">Tub: ${st.tubG ? `${st.tubG >= 1000 ? r1(st.tubG / 1000) + ' kg' : st.tubG + ' g'} ÷ ${st.scoopG} g per ${unit === 'scoops' ? 'scoop' : 'serving'} = ` : ''}<b>${st.size} ${unit}</b> · opened ${fmtD(st.start)}${si.runout ? ` · runs out <b>${fmtD(si.runout)}</b> at your plan's pace` : ''}</div>
    <div class="row" style="margin-top:12px"><button class="btn primary sm" data-a="newTub" data-k="${key}">Opened a new tub</button><button class="btn sm" data-a="adjStock" data-k="${key}">Correct count</button></div></div>`;
  };
  return `<div class="small muted" style="margin-bottom:10px">Counts go down as you tick your doses. When a tub will run out before your next Sunday shop, it goes on the grocery list automatically.</div>${card('nitrotech')}${card('creatine')}`;
};
VIEWS.quotes = () => `<div class="card"><h3>Add your own quote</h3><div class="small muted">Lines you like from James Clear, Alex Hormozi or anyone else. They rotate with the built-in ones.</div><label class="f">Quote</label><textarea id="qText" rows="3"></textarea><label class="f">Author / book</label><input type="text" id="qAuthor" placeholder="e.g. James Clear, Atomic Habits"><button class="btn primary block" style="margin-top:10px" data-a="addQuote">Save quote</button></div>
  ${(S.myQuotes || []).length ? `<div class="card"><h3>Your quotes</h3>${S.myQuotes.map((x, i) => `<div class="check"><div class="grow">“${esc(x.q)}”<div class="tiny faint">— ${esc(x.a || '')}</div></div><button class="iconbtn" data-a="delQuote" data-i="${i}">✕</button></div>`).join('')}</div>` : ''}
  <div class="card"><h3>Built-in (${window.QUOTES.length})</h3>${window.QUOTES.map(x => `<div class="check"><div class="grow small">“${esc(x.q)}”<div class="tiny faint">— ${esc(x.a)}</div></div></div>`).join('')}</div>`;

VIEWS.account = () => {
  const days = S.lastBackup ? diffD(S.lastBackup, today()) : null;
  let acct;
  if (!Sync.cfg) acct = `<div class="card"><h3>Account & sync</h3><div class="small muted">Cloud sync is not connected yet. Data is saved on this device only.</div></div>`;
  else { const dirty = Object.keys(Sync.meta.dirty || {}).length; acct = `<div class="card accent"><h3>Account & sync</h3><div class="small">Signed in as <b>${esc(Sync.user.email)}</b></div><div class="small muted" style="margin-top:4px">${!navigator.onLine ? 'Offline — changes are saved on this device and sync when you reconnect.' : dirty ? `Syncing ${dirty} change${dirty > 1 ? 's' : ''}…` : 'Everything is synced between your devices ✓'}${Sync.err ? ` · last error: ${esc(Sync.err)}` : ''}</div><div class="small faint" style="margin-top:4px">Progress photos stay on the device they were taken on.</div><div class="row" style="margin-top:10px"><button class="btn sm" data-a="syncNow">Sync now</button><button class="btn sm" data-a="pwReset">Change password</button><button class="btn danger sm" data-a="logout">Sign out</button></div></div>`; }
  return acct + `<div class="card"><h3>Backup to PDF</h3><div class="small muted">A readable report (targets, PRs, check-ins, runs, plan) with all your app data and photos hidden inside. Restore by picking the same PDF below.</div><button class="btn primary block" style="margin-top:12px" data-a="exportPDF">Create backup PDF</button><div class="small ${days == null || days > 30 ? 'bad' : 'muted'}" style="margin-top:8px">${days == null ? 'No backup yet.' : `Last backup: ${fmtD(S.lastBackup)} (${days} day${days === 1 ? '' : 's'} ago).`}</div></div>
  <div class="card"><h3>Restore from backup PDF</h3><div class="small muted">Replaces everything in the app (and in the cloud) with the data inside the backup.</div><input type="file" accept="application/pdf,.pdf" id="restoreFile" style="margin-top:10px"><button class="btn block" style="margin-top:10px" data-a="restore">Restore</button></div>
  <div class="card"><h3>About</h3><div class="small muted">Exercise pictures and instructions: free-exercise-db (public domain). Food values are typical estimates.</div><button class="btn danger sm" style="margin-top:10px" data-a="wipe">Erase all data on this device</button></div>`;
};

// ---------- workout player ----------
let P = null, pTimer = null, wakeLock = null, audioCtx = null;
// ---------- background timer: media-session + notifications (keeps the timer visible outside the app) ----------
const BG = { audio: null, lastNote: 0, lastMeta: '' };
function silentWav(sec = 10, rate = 8000) {
  const n = sec * rate, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, (i % 2 ? 1 : -1), true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function bgStart() {
  try {
    // Silent audio keeps the page alive with the screen off, but on Android it takes audio focus and pauses other music — so it's opt-in.
    if (S.settings.bgAudio) { if (!BG.audio) { BG.audio = new Audio(silentWav()); BG.audio.loop = true; BG.audio.setAttribute('playsinline', ''); } BG.audio.play().catch(() => {}); }
    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession, h = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) {} };
      h('nexttrack', () => { if (!P) return; if (P.phase === 'rest') A.pRestSkip(); else if (P.phase === 'work') A.pDone(); else if (P.phase === 'warm') A.pWarmDone(); });
      h('previoustrack', () => { if (P) A.pUndo(); });
      h('play', () => { BG.audio && BG.audio.play(); if (P && P.paused) setPaused(false); }); h('pause', () => { if (P && !P.paused) setPaused(true); });
    }
  } catch (e) {}
  if (S.settings.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
}
function bgStop() { try { BG.audio && BG.audio.pause(); if ('mediaSession' in navigator) navigator.mediaSession.metadata = null; } catch (e) {} clearNotes(); }
async function note(tag, title, body, opt = {}) {
  if (!S.settings.notify || !('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
  try { const reg = await navigator.serviceWorker.ready; await reg.showNotification(title, { tag, body, icon: 'icons/icon-192.png', badge: 'icons/favicon-64.png', data: { url: './' }, ...opt }); } catch (e) {}
}
async function clearNotes(tags = ['gf-timer']) { try { const reg = await navigator.serviceWorker.ready; for (const n of await reg.getNotifications()) if (tags.includes(n.tag)) n.close(); } catch (e) {} }
const clock = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
function bgUpdate(force) {
  if (!P) return; const s = S.sessions[P.date]; if (!s) return; const e = s.entries[P.ei]; if (!e) return;
  const name = ex(e.ex).name, now = P.paused ? P.pausedAt : Date.now(); let title, artist, body, ends = null, acts;
  const pauseAct = P.paused ? { action: 'resume', title: '▶ Resume' } : { action: 'pause', title: '⏸ Pause' }, stopAct = { action: 'stop', title: '⏹ Stop' };
  if (P.paused) { title = '⏸ Workout paused'; artist = `${s.name} · ${fmtTime((now - s.startedAt) / 1000)}`; body = `${s.name} · ${name}. Tap Resume when you're ready.`; acts = [pauseAct, stopAct]; }
  else if (P.phase === 'rest' && P.restEnd) { const left = Math.max(0, Math.ceil((P.restEnd - now) / 1000)); ends = P.restEnd; title = `⏱ Rest ${fmtTime(left)} left`; artist = `Next: ${name} · set ${P.si + 1}/${e.sets.length}`; body = `Rest ends at ${clock(P.restEnd)} · next: ${name}, set ${P.si + 1} of ${e.sets.length}`; acts = [pauseAct, { action: 'skip', title: '⏭ Skip rest' }, stopAct]; }
  else if (P.phase === 'work') { ends = P.setEnd || null; title = P.setEnd ? `💪 Set ${P.si + 1}/${e.sets.length} · ${fmtTime(Math.max(0, Math.ceil((P.setEnd - now) / 1000)))} left` : `💪 Set ${P.si + 1} of ${e.sets.length} — go`; artist = `${name} · ${e.sets[P.si].w ? kg(e.sets[P.si].w) + ' × ' : ''}${e.sets[P.si].r || e.t.max} reps`; body = `${artist} · workout time ${fmtTime((now - s.startedAt) / 1000)}`; acts = [{ action: 'done', title: '✓ Done set' }, pauseAct, stopAct]; }
  else if (P.phase === 'choice' && P.autoFinishAt) { ends = P.autoFinishAt; title = `Finishing in ${fmtTime(Math.max(0, Math.ceil((P.autoFinishAt - now) / 1000)))}`; artist = s.name; body = `Last exercise done · ${s.name}`; acts = [pauseAct, stopAct]; }
  else { title = s.name; artist = `Workout · ${fmtTime((now - s.startedAt) / 1000)}`; body = artist; acts = [pauseAct, stopAct]; }
  const key = title + artist;
  if ('mediaSession' in navigator && key !== BG.lastMeta) { BG.lastMeta = key; try { navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: 'Gherwin Fitness', artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] }); } catch (e) {} }
  const stateKey = (P.paused ? 'p' : P.phase) + P.ei + ':' + P.si;
  if (document.visibilityState === 'hidden' && (force || Date.now() - BG.lastNote > 5000 || BG.noteKey !== stateKey)) {
    BG.lastNote = Date.now(); BG.noteKey = stateKey;
    note('gf-timer', title, body, { silent: true, renotify: false, actions: acts.slice(0, Math.max(2, (window.Notification && Notification.maxActions) || 2)), timestamp: ends || Date.now(), requireInteraction: true });
  }
}
function alarm(title, body) {
  if (document.visibilityState === 'visible') beep();
  if (document.visibilityState === 'hidden') { clearNotes(); note('gf-alarm', title, body, { vibrate: [600, 200, 600, 200, 600], requireInteraction: true, renotify: true, silent: false, actions: P && P.phase !== 'summary' ? [{ action: 'done', title: '✓ Done set' }, { action: 'pause', title: '⏸ Pause' }, { action: 'stop', title: '⏹ Stop' }] : [] }); BG.noteKey = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') clearNotes(['gf-timer', 'gf-alarm']); else if (P) { BG.lastNote = 0; bgUpdate(true); } });

function beep() {
  try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (e) {}
  if (!S.settings.sound) return;
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); [0, 0.25, 0.5].forEach(t => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = t === 0.5 ? 1175 : 880; g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.2); o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.22); }); } catch (e) {}
}
async function keepAwake() { try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (P && document.visibilityState === 'visible') { keepAwake(); renderPlayer(); } if (document.visibilityState === 'visible') Sync.pull().then(() => Sync.push()); });
function firstOpen(s) { for (let i = 0; i < s.entries.length; i++) for (let j = 0; j < s.entries[i].sets.length; j++) if (!s.entries[i].sets[j].done) return { ei: i, si: j }; return null; }
function openPlayer(date) {
  ctx.date = date;
  let s = S.sessions[date]; if (!s) s = createSession(date, dayPick[date]);
  if (!s.entries.length) return toast('This workout has no exercises yet.');
  s.startedAt = s.startedAt || Date.now(); s.done = false; save();
  const f = firstOpen(s); P = f ? { date, ...f, phase: 'work' } : { date, ei: s.entries.length - 1, si: s.entries[s.entries.length - 1].sets.length - 1, phase: 'choice' };
  if (f && !s.warm && f.si === 0 && warmBase(s.entries[f.ei]) > 0) { P.phase = 'warm'; P.wi = 0; }
  $('#player').classList.remove('hidden'); document.body.classList.add('playing'); keepAwake(); bgStart();
  clearInterval(pTimer); pTimer = setInterval(playerTick, 250); renderPlayer();
}
function closePlayer() { bgStop(); P = null; clearInterval(pTimer); $('#player').classList.add('hidden'); document.body.classList.remove('playing'); try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; render(true); }
function warmBase(e) { const x = ex(e.ex); if (x.kind !== 'c') return 0; const w = num(e.sets[0].w); return w > 0 ? w : 0; }
function warmSets(e) { const x = ex(e.ex), w = warmBase(e), inc = x.inc || 2.5, rd = v => Math.max(inc, Math.round(v / inc) * inc); return [{ w: rd(w * 0.5), r: 10, pct: 50 }, { w: rd(w * 0.75), r: 5, pct: 75 }]; }
function restFor(e) { return ex(e.ex).kind === 'c' ? S.settings.restC : S.settings.restI; }
function playerTick() {
  if (!P) return; const s = S.sessions[P.date]; if (!s) return closePlayer();
  if (P.paused) { bgUpdate(); return; }
  const el = $('#pElapsed'); if (el) el.textContent = fmtTime((Date.now() - s.startedAt) / 1000);
  if (P.restEnd) {
    const left = (P.restEnd - Date.now()) / 1000, r = $('#pRest'), b = $('#pRestBar');
    if (r) r.textContent = fmtTime(Math.ceil(left)); if (b) b.style.width = Math.max(0, Math.min(100, (1 - left / P.restTotal) * 100)) + '%';
    if (left <= 0 && !P.beeped) { P.beeped = true; const ne = s.entries[P.ei]; alarm('Rest over — go! 💪', ne ? `${ex(ne.ex).name} · set ${P.si + 1} of ${ne.sets.length}` : 'Next set'); if (P.phase === 'rest') { P.phase = 'work'; P.restEnd = null; renderPlayer(); } else renderPlayer(); }
  }
  if (P.phase === 'work' && S.settings.handsFree && !P.hfPause) {
    const key = P.ei + ':' + P.si; if (P.setFor !== key) { P.setFor = key; P.setEnd = Date.now() + (S.settings.setSec || 40) * 1000; }
    const left = (P.setEnd - Date.now()) / 1000, el2 = $('#pSetT'); if (el2) el2.textContent = fmtTime(Math.max(0, Math.ceil(left)));
    if (left <= 0) { const key0 = P.ei + ':' + P.si + ':' + P.phase; P.setEnd = null; A.pDone(); if (P && P.ei + ':' + P.si + ':' + P.phase === key0) { P.hfPause = true; renderPlayer(); toast('Hands-free paused — enter the kg first.'); } else if (P) P.setFor = null; }
  } else if (P.phase !== 'work') { P.setFor = null; P.setEnd = null; }
  if (P && P.phase === 'choice' && P.autoFinishAt) { const left = (P.autoFinishAt - Date.now()) / 1000, el3 = $('#pFinT'); if (el3) el3.textContent = fmtTime(Math.max(0, Math.ceil(left))); if (left <= 0) { P.autoFinishAt = null; A.pFinish(); } }
  if (P) bgUpdate();
  if (P && (P.phase === 'work' || P.phase === 'rest' || P.phase === 'warm')) { P.f = (P.f || 0) + 1; if (P.f % 4 === 0) { const im = $('#pDemo'); if (im && im.dataset.ex) { P.frame = 1 - (P.frame || 0); const src = demoSrc(im.dataset.ex, P.frame); if (src) im.src = src; } } }
}
function renderPlayer() {
  if (!P) return; const s = S.sessions[P.date], e = s.entries[P.ei], x = ex(e.ex), set = e.sets[P.si];
  const head = `<div class="p-top"><button class="iconbtn" data-a="pMenu" aria-label="Stop or cancel workout">✕</button><div class="grow" style="text-align:center"><div class="tiny muted">${s.deload ? '💤 ' : ''}${esc(s.name)} · ${P.ei + 1}/${s.entries.length}</div><div class="p-elapsed" id="pElapsed">${fmtTime(((P.paused ? P.pausedAt : Date.now()) - s.startedAt) / 1000)}</div></div><button class="btn sm" data-a="pPause" style="width:auto">${P.paused ? '▶ Resume' : '⏸ Pause'}</button></div>${P.paused ? `<div class="card hl" style="margin:10px 0 0;text-align:center"><b style="font-size:18px">⏸ Workout paused</b><div class="small muted">Timers are frozen. Nothing is lost.</div><div class="row" style="margin-top:10px"><button class="btn primary grow" data-a="pPause">▶ Resume</button><button class="btn danger grow" data-a="pCancel">Cancel workout</button></div></div>` : ''}<div class="row" style="justify-content:center;gap:6px;margin-top:6px"><button class="sdot ${S.settings.autoFlow ? 'cur' : ''}" data-a="tglAuto">${S.settings.autoFlow ? '✓ ' : ''}Auto-continue</button><button class="sdot ${S.settings.handsFree ? 'cur' : ''}" data-a="tglHF">${S.settings.handsFree ? '✓ ' : ''}Hands-free</button><button class="sdot ${notifOn() ? 'cur' : ''}" data-a="tglNotif">${notifOn() ? '🔔' : '🔕'} Lock-screen</button></div><div class="p-prog"><i style="width:${(s.entries.reduce((a, q) => a + q.sets.filter(z => z.done).length, 0) / Math.max(1, s.entries.reduce((a, q) => a + q.sets.length, 0))) * 100}%"></i></div>`;
  const demo = id => demoSrc(id) ? `<img class="p-demo" id="pDemo" data-ex="${id}" src="${demoSrc(id)}" alt="" data-a="demo" data-ex2="${id}" onerror="this.style.display='none'">` : `<div class="p-demo ph">${esc(ex(id).name.slice(0, 1))}</div>`;
  const restBlock = P.restEnd ? `<div class="p-restline"><span>Rest</span><b id="pRest">${fmtTime(Math.ceil((P.restEnd - Date.now()) / 1000))}</b><div class="bar grow"><i id="pRestBar" style="width:0%"></i></div><button class="btn sm" data-a="pRestAdd">+30s</button></div>` : '';
  let body = '';
  if (P.phase === 'work') {
    const sg = suggest({ ex: e.ex, ...e.t }, P.date), w = set.w === '' ? '' : set.w, step = x.inc || 1, lastTop = sg.last ? sg.last.sets.filter(z => z.w === Math.max(...sg.last.sets.map(q => q.w))) : [], goalR = lastTop.length ? Math.min(e.t.max, Math.min(...lastTop.map(z => z.r)) + 1) : e.t.max, r = set.r === '' ? goalR : set.r;
    const prevE = s.entries[P.ei - 1], ssTag = e.ss ? `🔗 Superset with ${esc(ex(s.entries[P.ei + 1]?.ex).name)} — no rest between` : prevE && prevE.ss ? `🔗 Superset with ${esc(ex(prevE.ex).name)} — rest after this` : '';
    const note = (S.exNotes || {})[e.ex];
    body = `${demo(e.ex)}<div class="p-name">${esc(x.name)}</div><div class="p-set">Set ${P.si + 1} of ${e.sets.length} · target ${e.t.min}–${e.t.max} reps</div>${setStrip(e, P.si)}${ssTag ? `<div class="tiny acc" style="text-align:center;font-weight:700">${ssTag}</div>` : ''}${note ? `<div class="sug" style="margin-top:8px">📝 ${esc(note)}</div>` : ''}${sg.lastStr ? `<div class="tiny muted" style="text-align:center">Last time: ${sg.lastStr}</div>` : ''}${sg.text ? `<div class="sug ${sg.kind === 'warn' ? 'warn' : ''}" style="margin-top:8px">${esc(sg.text)}</div>` : ''}
    <div class="p-inputs"><div><div class="tiny muted">KG${x.kind === 'b' ? ' (added)' : ''}</div><div class="stepper"><button data-a="pStep" data-f="w" data-n="${-step}">−</button><input type="number" inputmode="decimal" step="0.5" id="pW" value="${w}" placeholder="kg"><button data-a="pStep" data-f="w" data-n="${step}">+</button></div></div><div><div class="tiny muted">REPS</div><div class="stepper"><button data-a="pStep" data-f="r" data-n="-1">−</button><input type="number" inputmode="numeric" id="pR" value="${r}" placeholder="${e.t.max}"><button data-a="pStep" data-f="r" data-n="1">+</button></div></div></div>
    ${S.settings.handsFree ? `<div class="p-restline" style="background:var(--acc-soft);border-color:transparent"><span>Hands-free · set ends in</span><b id="pSetT">${fmtTime(S.settings.setSec || 40)}</b><span class="grow"></span><button class="btn sm" data-a="hfPause">${P.hfPause ? '▶ Resume' : '⏸ Pause'}</button></div>` : ''}${restBlock}<button class="btn primary block p-main" data-a="pDone">Done set ✓</button>${lastDone() ? `<button class="btn block" style="margin-top:8px" data-a="pUndo">↶ Redo my last set</button>` : ''}<div class="row wrap" style="justify-content:center;gap:6px;margin-top:10px">${P.si === 0 && !e.sets.some(z => z.done) && x.kind === 'c' ? `<button class="btn sm ghost" data-a="pWarm">🔥 Warm-up</button>` : ''}<button class="btn sm ghost" data-a="exNote" data-ex="${e.ex}">📝 Note</button><button class="btn sm ghost" data-a="pOrder">⇅ Order</button><button class="btn sm ghost" data-a="exMenu" data-i="${P.ei}">Swap</button><button class="btn sm ghost" data-a="demo" data-ex="${e.ex}">How to</button><button class="btn sm ghost" data-a="pSkipEx">Skip</button></div>`;
  } else if (P.phase === 'warm') {
    const ws = warmSets(e), wsx = ws[P.wi];
    body = `${demo(e.ex)}<div class="p-name">${esc(x.name)}</div><div class="p-set">Warm-up ${P.wi + 1} of 2 — not counted</div>
    <div class="card" style="margin-top:12px;text-align:center"><div class="label">${wsx.pct}% of your working weight</div><div class="p-count" style="font-size:48px;margin-top:6px">${kg(wsx.w)} × ${wsx.r}</div><div class="small muted">Easy, smooth reps — get blood in the muscle, don't tire it.</div></div>
    <button class="btn primary block p-main" data-a="pWarmDone">Done warm-up ${P.wi + 1} ✓</button><button class="btn block" style="margin-top:8px" data-a="pWarmSkip">Skip warm-up</button>`;
  } else if (P.phase === 'rest') {
    const nx = s.entries[P.ei], ns = nx.sets[P.si];
    body = `<div class="p-restbig"><div class="tiny muted">REST</div><div class="p-count" id="pRest">${fmtTime(Math.ceil((P.restEnd - Date.now()) / 1000))}</div><div class="bar" style="margin:10px 0 16px"><i id="pRestBar" style="width:0%"></i></div><div class="row" style="justify-content:center;gap:8px"><button class="btn" data-a="pRestAdd" data-n="-15">−15s</button><button class="btn" data-a="pRestAdd">+30s</button><button class="btn primary" data-a="pRestSkip">Skip rest</button></div><div class="row" style="justify-content:center;gap:8px;margin-top:10px"><button class="btn sm" data-a="pUndo">↶ Redo last set</button><button class="btn sm" data-a="pExtra">+ Extra set</button></div><div class="qamts" style="justify-content:center">${[60, 90, 120, 180].map(v => `<button class="${P.restTotal === v ? 'on' : ''}" data-a="pRestSet" data-v="${v}">${v < 120 ? v + 's' : v / 60 + ' min'}</button>`).join('')}</div></div>
    <div class="card" style="margin-top:16px"><div class="row between"><div class="tiny muted">UP NEXT</div><button class="btn sm" data-a="pOrder">⇅ Change</button></div><div class="row" style="margin-top:6px">${thumb(nx.ex, 56)}<div class="grow"><b>${esc(ex(nx.ex).name)}</b><div class="small muted">Set ${P.si + 1} of ${nx.sets.length} · ${ns.w !== '' && ns.w > 0 ? kg(ns.w) + ' × ' : ''}${nx.t.min}–${nx.t.max} reps</div></div></div></div>`;
  } else if (P.phase === 'choice') {
    const last = P.ei >= s.entries.length - 1, nxIdx = s.entries.findIndex((q, i) => i > P.ei && q.sets.some(z => !z.done)), nx = nxIdx >= 0 ? s.entries[nxIdx] : null;
    body = `${P.autoFinishAt ? `<div class="p-restline" style="background:var(--acc-soft);border-color:transparent"><span>Last exercise done · finishing in</span><b id="pFinT">0:15</b><span class="grow"></span><button class="btn sm" data-a="cancelFin">Wait</button></div>` : ''}<div class="p-restbig"><div class="big good">✓</div><div class="p-name">${esc(x.name)} done</div></div>${setStrip(e, -1)}${restBlock}
    <div class="col" style="margin-top:16px;gap:10px">${nx ? `<button class="btn primary block p-main" data-a="pNext" data-i="${nxIdx}">Next: ${esc(ex(nx.ex).name)} →</button>` : `<button class="btn primary block p-main" data-a="pFinish">Finish workout</button>`}<button class="btn block" data-a="pOrder">⇅ Choose a different exercise</button><button class="btn block" data-a="pRepeat">+ Repeat — one more set</button><button class="btn block" data-a="pUndo">↶ Redo my last set</button>${!nx && !last ? '' : ''}</div>
    ${nx ? `<div class="card" style="margin-top:16px"><div class="tiny muted">UP NEXT</div><div class="row" style="margin-top:6px">${thumb(nx.ex, 56)}<div class="grow"><b>${esc(ex(nx.ex).name)}</b><div class="small muted">${nx.sets.length} sets · ${nx.t.min}–${nx.t.max} reps</div></div></div></div>` : ''}`;
  } else if (P.phase === 'summary') {
    const sets = s.entries.reduce((a, q) => a + q.sets.filter(z => z.done).length, 0), vol = s.entries.reduce((a, q) => a + q.sets.filter(z => z.done).reduce((b, z) => b + (num(z.w) || 0) * (num(z.r) || 0), 0), 0), prs = sessionPRs(P.date);
    body = `<div class="p-restbig"><div class="tiny acc">WORKOUT COMPLETE</div><div class="p-count">${fmtTime(((s.endedAt || Date.now()) - s.startedAt) / 1000)}</div></div><div class="kpis"><div class="kpi"><b>${sets}</b><span>sets</span></div><div class="kpi"><b>${Math.round(vol).toLocaleString()} kg</b><span>total volume</span></div><div class="kpi"><b>${prs.length}</b><span>PRs</span></div></div>${prs.length ? `<div class="card" style="margin-top:12px"><h3>New records</h3>${prs.map(id => `<div class="small">• ${esc(ex(id).name)}</div>`).join('')}</div>` : ''}<button class="btn primary block p-main" style="margin-top:16px" data-a="pClose">Close</button>`;
  }
  $('#player').innerHTML = `<div class="p-wrap">${head}<div class="p-body">${body}</div></div>`;
}
// ---------- exercise order: choose next / drag to reorder ----------
function orderSheet(date) {
  const s = S.sessions[date]; if (!s) return; ctx.orderDate = date;
  const cur = P && P.date === date ? P.ei : -1;
  const row = (e, i) => { const x = ex(e.ex), d = e.sets.filter(z => z.done).length, all = d === e.sets.length;
    return `<div class="ord ${i === cur ? 'cur' : ''} ${all ? 'donex' : ''}" data-i="${i}"><span class="handle" data-drag="${i}" aria-label="Drag to reorder">⠿</span>${thumb(e.ex, 44)}<div class="grow"><b>${esc(x.name)}</b><div class="tiny muted">${all ? '✓ done' : `${d}/${e.sets.length} sets`}${i === cur ? ' · now' : ''}${e.ss ? ' · 🔗 superset' : ''}</div></div>${!all && i !== cur ? `<button class="btn sm primary" data-a="ordNow" data-i="${i}">Do now</button>` : ''}<div class="col"><button class="iconbtn" data-a="ordMove" data-i="${i}" data-n="-1" aria-label="Move up">▲</button><button class="iconbtn" data-a="ordMove" data-i="${i}" data-n="1" aria-label="Move down">▼</button></div></div>`; };
  openModal(`<div class="row between"><h2 style="margin:0">Exercise order</h2><button class="iconbtn" data-a="close">✕</button></div><div class="small muted" style="margin:4px 0 10px">Equipment busy? Tap <b>Do now</b> on any exercise, or drag <b>⠿</b> to change the order. Skipped exercises come back later — nothing is lost.</div><div id="ordList">${s.entries.map(row).join('')}</div><button class="btn primary block" style="margin-top:12px" data-a="close">Done</button>`);
  initDrag();
}
function applyOrder(date, newIdx) {
  const s = S.sessions[date], old = s.entries, curObj = P && P.date === date ? old[P.ei] : null;
  const nextOf = new Map(old.map((e, i) => [e, old[i + 1]]));
  s.entries = newIdx.map(i => old[i]);
  s.entries.forEach((e, i) => { if (e.ss && nextOf.get(e) !== s.entries[i + 1]) e.ss = false; });
  if (curObj) { P.ei = s.entries.indexOf(curObj); }
  save();
}
function initDrag() {
  const list = $('#ordList'); if (!list) return; let drag = null;
  list.addEventListener('pointerdown', ev => {
    const h = ev.target.closest('[data-drag]'); if (!h) return; ev.preventDefault();
    const item = h.closest('.ord'); drag = { item, startY: ev.clientY, id: ev.pointerId }; item.classList.add('dragging'); h.setPointerCapture(ev.pointerId);
  });
  list.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.id) return; ev.preventDefault();
    const items = [...list.querySelectorAll('.ord')], y = ev.clientY;
    for (const it of items) { if (it === drag.item) continue; const r = it.getBoundingClientRect(); if (y > r.top && y < r.bottom) { if (y < r.top + r.height / 2) list.insertBefore(drag.item, it); else list.insertBefore(drag.item, it.nextSibling); break; } }
  });
  const end = ev => {
    if (!drag || ev.pointerId !== drag.id) return; drag.item.classList.remove('dragging'); drag = null;
    const order = [...list.querySelectorAll('.ord')].map(x => +x.dataset.i);
    if (order.some((v, i) => v !== i)) { applyOrder(ctx.orderDate, order); afterOrder(); }
  };
  list.addEventListener('pointerup', end); list.addEventListener('pointercancel', end);
}
function afterOrder() { if (P) { const e = S.sessions[P.date].entries[P.ei]; if (P.phase === 'work' || P.phase === 'choice') { const j = e.sets.findIndex(z => !z.done); if (j >= 0) { P.si = j; if (P.phase === 'choice') P.phase = 'work'; } } renderPlayer(); } else render(true); orderSheet(ctx.orderDate); }
function setStrip(e, cur) {
  return `<div class="setstrip">${e.sets.map((z, j) => `<button class="sdot ${z.done ? 'done' : ''} ${j === cur ? 'cur' : ''}" data-a="pRedo" data-j="${j}" aria-label="Set ${j + 1}">${z.done ? `✓ ${(z.w ? r1(z.w) : 'BW')}×${z.r}` : `Set ${j + 1}`}</button>`).join('')}<button class="sdot add" data-a="pExtra" aria-label="Add a set">+ set</button></div>`;
}
function lastDone() { const s = S.sessions[P.date]; if (P.lastSet && s.entries[P.lastSet.i] && s.entries[P.lastSet.i].sets[P.lastSet.j] && s.entries[P.lastSet.i].sets[P.lastSet.j].done) return P.lastSet; for (let i = P.ei; i >= 0; i--) { const e = s.entries[i]; for (let j = e.sets.length - 1; j >= 0; j--) if (e.sets[j].done) return { i, j }; } return null; }
function readPlayerInputs() { const s = S.sessions[P.date], set = s.entries[P.ei].sets[P.si], w = $('#pW'), r = $('#pR'); if (w) set.w = num(w.value) ?? ''; if (r) set.r = num(r.value) ?? ''; }
function startRestTimer(sec) { P.restStart = Date.now(); P.restEnd = P.restStart + sec * 1000; P.restTotal = sec; P.beeped = false; }

// ---------- food logger (+ button) ----------
let FL = null;
const FCATS = [['mine', 'My foods'], ['recent', 'Recent'], ['Filipino', '🇵🇭 Filipino'], ['Meat & fish', 'Meat & fish'], ['Pantry', 'Rice & bread'], ['Dishes', 'Dishes'], ['Eggs & dairy', 'Eggs & dairy'], ['Fast food', 'Fast food'], ['Fruit', 'Fruit'], ['Drinks', 'Drinks'], ['Snacks', 'Snacks']];
const CAT_ICON = { Filipino: '🍛', 'Meat & fish': '🍗', 'Eggs & dairy': '🥚', Pantry: '🍚', Dishes: '🍛', 'Fast food': '🍔', Fruit: '🍌', Drinks: '🥤', Snacks: '🍫', Supplements: '🥛', Other: '🍽️' };
const foodG = f => f.gPer || (f.buy && f.buy.g && !f.buy.note ? f.buy.g : null);
function recentFoods() {
  const out = [], seen = new Set();
  for (const d of Object.keys(S.days).sort().reverse().slice(0, 21)) for (const e of [...(S.days[d].extras || [])].reverse()) {
    const v = extraVals(e), key = v.name.toLowerCase(); if (seen.has(key)) continue; seen.add(key);
    out.push(e.food ? { src: 'my', id: e.food, name: food(e.food).name, label: food(e.food).unit, g: foodG(food(e.food)), kcal: food(e.food).kcal, p: food(e.food).p, c: food(e.food).c, f: food(e.food).f, cat: food(e.food).cat, defQty: e.qty } : { src: 'recent', name: v.name, label: v.amt || '1 serving', g: null, kcal: v.kcal, p: v.p, c: v.c, f: v.f, cat: 'Other' });
    if (out.length >= 10) return out;
  }
  return out;
}
// Search: English/Tagalog synonyms, plurals, and a typo-tolerant fallback.
const SYN = [['milkfish', 'bangus'], ['pork belly', 'liempo', 'lechon kawali'], ['fried', 'prito', 'crispy'], ['grilled', 'inihaw', 'bbq', 'barbecue'], ['chicken', 'manok'], ['pork', 'baboy'], ['beef', 'baka'], ['fish', 'isda'], ['shrimp', 'hipon', 'prawn'], ['squid', 'pusit', 'calamares'], ['egg', 'itlog'], ['rice', 'kanin'], ['soup', 'sabaw'], ['noodles', 'pancit'], ['banana', 'saging'], ['coffee', 'kape'], ['milk', 'gatas'], ['porridge', 'lugaw', 'congee'], ['sausage', 'longganisa'], ['bread', 'tinapay'], ['dried fish', 'tuyo']];
// one-way: a general word also finds the specific dishes (but "bangus" does not find tuna)
const BROAD = { fish: ['tilapia', 'bangus', 'tuna', 'salmon', 'sardines', 'tanigue', 'danggit', 'tuyo'], isda: ['tilapia', 'bangus', 'tuna', 'salmon', 'sardines', 'tanigue', 'danggit', 'tuyo'], soup: ['sinigang', 'tinola', 'nilaga', 'bulalo', 'batchoy', 'mami', 'lomi'], noodles: ['pancit', 'mami', 'lomi', 'bihon', 'canton', 'palabok', 'spaghetti'], stew: ['caldereta', 'kaldereta', 'mechado', 'afritada', 'menudo'], porridge: ['lugaw', 'goto', 'arroz caldo', 'champorado'], pork: ['liempo', 'lechon', 'sisig', 'crispy pata', 'tocino', 'longganisa', 'menudo', 'bicol express', 'dinuguan'], grilled: ['inasal', 'isaw'] };
const SYNMAP = (() => { const m = {}; for (const g of SYN) for (const w of g) { m[w] = m[w] || new Set(); g.forEach(x => m[w].add(x)); } for (const [k, v] of Object.entries(BROAD)) { m[k] = m[k] || new Set([k]); v.forEach(x => m[k].add(x)); } return m; })();
const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ');
function queryTerms(q) {
  const t = norm(q).trim(); if (!t) return [];
  const used = new Set(), terms = [];
  for (const phrase of Object.keys(SYNMAP).filter(k => k.includes(' ')).sort((a, b) => b.length - a.length)) if ((' ' + t + ' ').includes(' ' + phrase + ' ')) { terms.push([...SYNMAP[phrase]]); phrase.split(' ').forEach(w => used.add(w)); }
  for (let w of t.split(/\s+/)) { if (used.has(w)) continue; const base = w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w; terms.push([w, base, ...(SYNMAP[w] || SYNMAP[base] || [])]); }
  return terms;
}
function hayOf(name, cat) { const AL = window.FOOD_ALIASES || {}; return ' ' + norm(name + ' ' + (AL[name] || '') + (cat === 'Filipino' ? ' filipino pinoy' : '')) + ' '; }
const termHit = (hay, alts) => alts.some(a => hay.includes(a.length <= 3 ? ' ' + a : a));
function lev1(a, b) { if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, e = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++e > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return e + (a.length - i) + (b.length - j) <= 1; }
function fuzzyScore(hay, terms) { const words = hay.trim().split(/\s+/); let sc = 0; for (const alts of terms) if (termHit(hay, alts)) sc += 2; else if (alts.some(a => a.length >= 4 && words.some(w => lev1(a, w) || (w.length >= 4 && (w.startsWith(a.slice(0, 4)) )))) ) sc += 1; return sc; }
function foodSearch(q, cat) {
  const terms = queryTerms(q || '');
  const allMine = Object.entries(S.foods).map(([id, f]) => ({ src: 'my', id, name: f.name, label: f.unit, g: foodG(f), kcal: f.kcal, p: f.p, c: f.c, f: f.f, cat: f.cat }));
  const allDb = window.FOODDB.map(r => ({ src: 'db', name: r[0], label: r[1], g: r[2], kcal: r[3], p: r[4], c: r[5], f: r[6], cat: r[7] }));
  if (!terms.length) return { mine: allMine, db: cat ? allDb.filter(x => x.cat === cat) : [], fuzzy: false };
  const ok = x => terms.every(alts => termHit(hayOf(x.name, x.cat), alts));
  let mine = allMine.filter(ok), db = allDb.filter(ok), fuzzy = false;
  if (!mine.length && !db.length) {
    fuzzy = true; const need = Math.max(1, terms.length);
    const rank = arr => arr.map(x => ({ x, sc: fuzzyScore(hayOf(x.name, x.cat), terms) })).filter(o => o.sc >= need).sort((a, b) => b.sc - a.sc).map(o => o.x);
    mine = rank(allMine); db = rank(allDb).slice(0, 25);
  }
  return { mine, db, fuzzy };
}
function fRow(it, i) {
  return `<div class="fres" data-a="flPick" data-i="${i}"><div class="ic">${CAT_ICON[it.cat] || '🍽️'}</div><div class="grow"><b>${esc(it.name)}</b><div class="tiny muted">${esc(it.label)}${it.g ? ` · ${it.g} g` : ''}${it.src === 'my' ? ' · mine' : it.src === 'off' ? ' · online' : ''}</div></div><div class="kc"><b>${Math.round(it.kcal)}</b><div class="tiny muted">kcal</div><span>${r1(it.p)} g protein</span></div></div>`;
}
function flResults() {
  const box = $('#flRes'); if (!box || !FL) return;
  const q = FL.q.trim(); let list = [], h = '';
  if (q) {
    const { mine, db, fuzzy } = foodSearch(q);
    const add = (title, arr) => { if (!arr.length) return; h += `<div class="sect">${title}</div>`; arr.forEach(it => { h += fRow(it, list.length); list.push(it); }); };
    if (fuzzy && (mine.length || db.length)) h += `<div class="small muted" style="margin:8px 0">No exact match — closest foods:</div>`;
    add('My foods', mine.slice(0, 15)); add('Food list', db.slice(0, 40));
    add('Online — whole foods (USDA)', FL.usda || []); add('Online — packaged foods (Open Food Facts)', FL.off || []);
    if (FL.onlineMsg) h += `<div class="small muted" style="margin:8px 0">${esc(FL.onlineMsg)}</div>`;
    if (!list.length && !FL.offLoading) h += `<div class="small muted" style="margin:10px 0">Not in the app's list. Search online below, or enter it yourself.</div>`;
    h += `<button class="btn ${list.length ? '' : 'primary'} block" style="margin-top:6px" data-a="flOnline" ${FL.offLoading ? 'disabled' : ''}>${FL.offLoading ? 'Searching online…' : `🔎 Search online for “${esc(q)}”`}</button>`;
  } else {
    const cat = FL.cat;
    let arr = cat === 'mine' ? foodSearch('').mine : cat === 'recent' ? recentFoods() : foodSearch('', cat).db;
    if (cat === 'recent' && !arr.length) h += `<div class="small muted" style="margin:10px 0">Foods you log appear here for one-tap logging.</div>`;
    arr.forEach(it => { h += fRow(it, list.length); list.push(it); });
  }
  h += `<button class="btn ghost block" style="margin-top:8px" data-a="flManual">✏️ Enter calories & macros myself</button><button class="btn ghost block" style="margin-top:6px" data-a="go" data-t="eat" data-s="calc" onclick="document.getElementById('modal').classList.add('hidden')">🧮 Meal calculator (several ingredients)</button>`;
  FL.list = list; box.innerHTML = h;
}
function flCalc() { const it = FL.sel, a = num(FL.amt) || 0, mult = FL.mode === 'g' && it.g ? a / it.g : a; return { mult, kcal: it.kcal * mult, p: it.p * mult, c: it.c * mult, f: it.f * mult }; }
function flTiles() { const v = flCalc(); return `<div class="k"><b>${Math.round(v.kcal)}</b><span>kcal</span></div><div class="pp"><b>${r1(v.p)}</b><span>protein g</span></div><div class="cc"><b>${r1(v.c)}</b><span>carbs g</span></div><div class="ff"><b>${r1(v.f)}</b><span>fat g</span></div>`; }
function flDetail() {
  const it = FL.sel, box = $('#flSel'); if (!box) return;
  $('#flBrowse').classList.add('hidden');
  const quick = FL.mode === 'g' ? [50, 100, 150, 200, 250] : [0.5, 1, 1.5, 2, 3];
  box.innerHTML = `<div class="fdetail"><div class="row between"><div class="grow"><div class="label">${esc(FL.meal)} · ${fmtD(FL.date)}</div><h2 style="margin:4px 0 2px">${esc(it.name)}</h2><div class="small muted">1 serving = ${esc(it.label)}${it.g ? ` (${it.g} g)` : ''}</div></div><button class="iconbtn" data-a="flBack" aria-label="Back">✕</button></div>
  ${it.g ? `<div class="seg" style="margin-top:12px"><button class="${FL.mode === 'srv' ? 'on' : ''}" data-a="flMode" data-v="srv">Servings</button><button class="${FL.mode === 'g' ? 'on' : ''}" data-a="flMode" data-v="g">Grams</button></div>` : ''}
  <div class="qamts">${quick.map(v => `<button class="${num(FL.amt) === v ? 'on' : ''}" data-a="flQuick" data-v="${v}">${FL.mode === 'g' ? v + ' g' : (v === 0.5 ? '½' : v === 1.5 ? '1½' : v)}</button>`).join('')}</div>
  <div class="stepper" style="margin-top:10px"><button data-a="flStep" data-n="-1">−</button><input type="number" inputmode="decimal" step="any" id="flAmt" data-in="flAmt" value="${FL.amt}"><button data-a="flStep" data-n="1">+</button></div><div class="tiny muted" style="text-align:center;margin-top:4px">${FL.mode === 'g' ? 'grams' : 'servings'}</div>
  <div class="mtiles" id="flTiles">${flTiles()}</div>
  ${it.src !== 'my' ? `<label class="small muted cb"><input type="checkbox" id="flSave"> Save to My foods for next time</label>` : ''}
  <button class="btn primary block big-btn" style="margin-top:14px" data-a="flLog">Log to ${esc(FL.meal)}</button></div>`;
}
function openFoodLogger(date) {
  FL = { date: date || (route.tab === 'eat' ? ctx.eatDate : today()), meal: mealNow(), q: '', mode: 'srv', amt: 1, sel: null, off: [], cat: recentFoods().length ? 'recent' : 'mine' };
  const plan = dayItems(FL.date).filter(i => !i.done && !food(i.food).stock);
  openModal(`<div class="row between"><h2 style="margin:0">Log food</h2><button class="iconbtn" data-a="close" aria-label="Close">✕</button></div>
  <div class="small muted" style="margin:2px 0 10px">${fmtD(FL.date)} · totals so far ${Math.round(dayTotals(FL.date).kcal)} kcal, ${Math.round(dayTotals(FL.date).p)} g protein</div>
  <div class="seg" id="flMeals">${MEALS.map(m => `<button class="${m === FL.meal ? 'on' : ''}" data-a="flMeal" data-v="${m}">${m}</button>`).join('')}</div>
  <div class="searchbar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" id="flQ" data-in="flQ" placeholder="Search adobo, sinigang, kanin, shawarma…" autocomplete="off" style="padding-right:56px"><button class="btn sm" data-a="flScan" aria-label="Scan barcode" style="position:absolute;right:6px;top:50%;transform:translateY(-50%)">📷</button></div>
  <div id="flSel"></div>
  <div id="flBrowse">
  ${plan.length ? `<div class="sect">From today's plan — tap to tick</div><div class="chips">${plan.slice(0, 8).map(i => `<button class="chip" data-a="flTickPlan" data-k="${i.key}">✓ <span class="faint">${esc(i.slot.replace(/\s*\(.*\)/, ''))}:</span> ${esc(food(i.food).name.replace(/\s*\(.*\)/, ''))} × ${i.qty}</button>`).join('')}</div>` : ''}
  <div class="hscroll" id="flCats" style="margin-top:14px">${FCATS.map(([k, l]) => `<button class="chip ${FL.cat === k ? 'on' : ''}" data-a="flCat" data-v="${k}">${l}</button>`).join('')}</div>
  <div id="flRes" style="margin-top:10px"></div></div>`);
  flResults();
}

// ---------- exercise picker ----------
function pickExercise(cb) {
  pickExercise.cb = cb; pickExercise.q = '';
  openModal(`<div class="row between"><h2>Add exercise</h2><button class="iconbtn" data-a="close">✕</button></div><input type="search" id="xQ" data-in="xQ" placeholder="Search ${Object.keys(EX).length} exercises: lateral raise, hip thrust…" autocomplete="off"><button class="btn sm ghost block" style="margin-top:8px" data-a="customEx">+ Create my own exercise</button><div id="xRes"></div>`);
  pickResults();
}
function pickResults() {
  const box = $('#xRes'); if (!box) return;
  const words = (pickExercise.q || '').toLowerCase().split(/\s+/).filter(Boolean);
  let list = Object.values(EX).filter(e => words.every(w => (e.name + ' ' + e.muscle + ' ' + e.equip).toLowerCase().includes(w)));
  const rank = e => (e.custom ? 0 : e.demo === 'local' ? 1 : 2);
  list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const total = list.length; list = list.slice(0, 60);
  box.innerHTML = list.map(e => `<div class="list-item" data-a="pickedEx" data-id="${e.id}">${thumb(e.id, 44)}<div class="grow"><b>${esc(e.name)}</b><div class="small muted">${esc(e.muscle)} · ${esc(e.equip)}${e.custom ? ' · custom' : ''}</div></div></div>`).join('') + (total > 60 ? `<div class="small faint" style="margin-top:8px">${total - 60} more — type to narrow down.</div>` : '') + (!total ? '<div class="small muted" style="margin-top:10px">No match. Create your own exercise above.</div>' : '');
}

// ---------- actions ----------
const A = {}, C = {}, I = {};
A.tab = el => { route.tab = el.dataset.t; if (route.tab === 'train') ctx.date = today(); render(); };
A.sub = el => { route.sub[route.tab] = el.dataset.s; render(); };
A.go = el => { route.tab = el.dataset.t; route.sub[route.tab] = el.dataset.s; if (el.dataset.date) ctx.date = el.dataset.date; render(); };
A.date = el => { ctx.date = addD(ctx.date, +el.dataset.n); render(); };
A.eatDate = el => { ctx.eatDate = addD(ctx.eatDate, +el.dataset.n); render(); };
A.month = el => { let [y, m] = ctx.month.split('-').map(Number); m += +el.dataset.n; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } ctx.month = `${y}-${pad(m)}`; render(); };
A.openDay = el => { ctx.date = el.dataset.date; route.sub.train = planned(ctx.date).type === 'run' && !S.sessions[ctx.date] ? 'runs' : 'session'; render(); };
A.deload = el => { S.deloads[monOf(ctx.date)] = el.dataset.v; save(); render(true); };
A.saveNow = () => { save(); Sync.push(); toast(Sync.user ? 'Saved ✓ — syncing to your other devices' : 'Saved ✓'); const b = document.activeElement; if (b && b.blur) b.blur(); };
A.play = el => openPlayer(el.dataset.date || ctx.date);
A.playAt = el => { openPlayer(ctx.date); if (!P) return; const s = S.sessions[ctx.date], i = +el.dataset.i, e = s.entries[i]; if (!e) return; const j = e.sets.findIndex(z => !z.done); P.ei = i; P.si = j >= 0 ? j : e.sets.length - 1; P.phase = j >= 0 ? 'work' : 'choice'; renderPlayer(); };
A.pickDate = el => { ctx.date = el.dataset.date; ctx.showLog = false; render(true); };
A.week = el => { ctx.date = addD(ctx.date, +el.dataset.n); ctx.showLog = false; render(true); };
A.sleep = el => { const r = dayRec(el.dataset.d, true), v = +el.dataset.v; r.sleep = r.sleep === v ? null : v; save(); render(true); };
A.weekRep = el => { ctx.weekMon = addD(ctx.weekMon || monOf(today()), +el.dataset.n); render(true); };
A.cancelSession = el => { const d = el.dataset.date, s = S.sessions[d], done = s ? s.entries.reduce((a, e) => a + e.sets.filter(z => z.done).length, 0) : 0; if (done && !confirm(`Cancel this workout? The ${done} logged set${done === 1 ? '' : 's'} will be deleted.`)) return; delete S.sessions[d]; save(); clearNotes(['gf-timer', 'gf-alarm']); render(true); toast('Workout cancelled — tap Start workout to begin again.'); };
A.pOrder = () => orderSheet(P.date);
A.reorderDay = el => { const d = el.dataset.date; if (!S.sessions[d]) createSession(d, dayPick[d]); orderSheet(d); };
A.ordMove = el => { const s = S.sessions[ctx.orderDate], i = +el.dataset.i, j = i + +el.dataset.n; if (j < 0 || j >= s.entries.length) return; const idx = s.entries.map((_, k) => k); [idx[i], idx[j]] = [idx[j], idx[i]]; applyOrder(ctx.orderDate, idx); afterOrder(); };
A.ordNow = el => {
  const d = ctx.orderDate, s = S.sessions[d], i = +el.dataset.i, idx = s.entries.map((_, k) => k);
  let at = P && P.date === d ? P.ei : s.entries.findIndex(e => e.sets.some(z => !z.done)); if (at < 0) at = 0;
  idx.splice(i, 1); idx.splice(i < at ? at - 1 : at, 0, i);
  const chosen = s.entries[i]; applyOrder(d, idx);
  if (P && P.date === d) { P.ei = s.entries.indexOf(chosen); P.si = Math.max(0, chosen.sets.findIndex(z => !z.done)); if (P.phase !== 'rest') { P.phase = 'work'; P.restEnd = P.restEnd && P.restEnd > Date.now() ? P.restEnd : null; } closeModal(); renderPlayer(); toast(`${ex(chosen.ex).name} now — the others wait their turn`); }
  else { closeModal(); render(true); toast(`${ex(chosen.ex).name} moved first`); }
};
A.nutriHelp = () => nutriSheet();
A.nutriAdd = el => {
  const o = nutriSheet.list[+el.dataset.i], rec = dayRec(today(), true);
  if (o.src === 'my') rec.extras.push({ food: o.id, qty: o.q, meal: mealNow() }); else rec.extras.push({ name: o.name, kcal: o.v.kcal, p: o.v.p, c: o.v.c, f: o.v.f, amt: `${o.q} × ${o.label}`, meal: mealNow() });
  save(); render(true); toast(`Added ${o.name} — +${Math.round(o.v.p)} g protein`); nutriSheet();
};
A.nutriPlan = el => { const d = today(), rec = dayRec(d, true), it = dayItems(d).find(i => i.key === el.dataset.k); rec.items[el.dataset.k] = { food: it.food, qty: it.qty, done: true }; save(); render(true); toast(`Ticked ${food(it.food).name}`); nutriSheet(); };
A.checkSwap = el => { const it = S.program.days[el.dataset.k].items[+el.dataset.i], from = ex(it.ex).name; it.ex = el.dataset.to; save(); render(true); toast(`${from} → ${ex(it.ex).name} in your split`); };
A.checkReps = el => { const it = S.program.days[el.dataset.k].items[+el.dataset.i]; if (it.min <= 8) { it.min = 10; it.max = 15; } else { it.min = 6; it.max = 8; } save(); render(true); toast(`${ex(it.ex).name}: now ${it.min}–${it.max} reps`); };
const hasDone = s => s && s.entries.some(e => e.sets.some(z => z.done));
A.deloadDay = el => { const d = el.dataset.d; askReason('deload', d, () => doDeloadDay(d)); };
function doDeloadDay(d) {
  const s = S.sessions[d];
  if (hasDone(s)) { applyDeload(s); save(); render(true); return toast('Rest of this workout switched to deload'); }
  const k = s ? s.dow : effKey(d); delete S.sessions[d]; createSession(d, k, { deload: true }); render(true);
  toast('💤 Deload day — half the sets at ~60% weight');
}
A.undoDeload = el => { const d = el.dataset.d, s = S.sessions[d]; if (hasDone(s)) return; if (S.skips[d] && S.skips[d].kind === 'deload') delete S.skips[d]; const k = s.dow; delete S.sessions[d]; if (k !== dow(d) && (S.moves || {})[d] == null) dayPick[d] = k; save(); render(true); toast('Back to your normal workout'); };
function applyDeload(s) {
  s.deload = true;
  s.entries = s.entries.map(e => {
    const dn = e.sets.filter(z => z.done).length;
    if (!dn) return { ...newEntry({ ex: e.ex, ...e.t }, today(), true), ss: e.ss };
    const keep = Math.max(0, Math.ceil(e.t.sets / 2) - dn); let left = keep;
    e.sets = e.sets.filter(z => z.done || left-- > 0).map(z => (z.done ? z : { ...z, w: deloadW(e.ex, num(z.w) || 0) || z.w }));
    return e;
  });
}
A.restToday = el => { const d = el.dataset.d; if (hasDone(S.sessions[d])) return toast('You already logged sets today — use ✕ › Finish now instead.'); askReason('rest', d, () => doRestToday(d)); };
function doRestToday(d) {
  const s = S.sessions[d];
  const k = s ? s.dow : effKey(d), name = S.program.days[k].name, to = nextRestDay(d);
  if (!to) {
    ctx.moveFrom = { d, k };
    return openModal(`<div class="row between"><h2 style="margin:0">Rest today</h2><button class="iconbtn" data-a="close">✕</button></div><div class="small muted" style="margin:4px 0 12px">No free rest day in the next 7 days. Pick a day to do <b>${esc(name)}</b> instead — that day's own plan is replaced.</div>` +
      [1, 2, 3, 4, 5, 6, 7].map(i => addD(d, i)).filter(x => !S.sessions[x] && !(S.moves || {})[x]).map(x => `<div class="daycard" data-a="moveTo" data-to="${x}"><div class="dl">${DN[dow(x)]}</div><div class="grow"><b>${fmtD(x)}</b><div class="tiny muted">now: ${esc(plannedFor(x).name)}</div></div></div>`).join(''));
  }
  doMove(d, k, to);
}
function doMove(d, k, to) {
  S.moves = S.moves || {}; delete S.sessions[d]; delete dayPick[d];
  S.moves[d] = { rest: true, to, k0: k }; S.moves[to] = { k, from: d };
  save(); closeModal(); render(true); toast(`😴 Rest today ✓ — ${S.program.days[k].name} moved to ${fmtD(to)}`);
}
A.moveTo = el => doMove(ctx.moveFrom.d, ctx.moveFrom.k, el.dataset.to);
A.undoMove = el => {
  const d = el.dataset.d, m = (S.moves || {})[d]; if (!m) return; const p2 = m.to || m.from || m.swap;
  if (p2 && hasDone(S.sessions[p2])) return toast(`You already trained on ${fmtD(p2)} — can't undo.`);
  if (hasDone(S.sessions[d])) return toast(`You already trained on ${fmtD(d)} — can't undo.`);
  delete S.sessions[d]; clearPair(d); for (const x of [d, p2]) if (x && S.skips[x] && S.skips[x].kind === 'rest') delete S.skips[x];
  save(); render(true); toast('Undone — back to your normal plan');
};
A.pDeload = () => askReason('deload', P.date, doPDeload);
const doPDeload = () => { const s = S.sessions[P.date]; applyDeload(s); save(); closeModal(); const e = s.entries[P.ei], j = e.sets.findIndex(z => !z.done); if (j >= 0) { P.si = j; if (P.phase !== 'rest') P.phase = 'work'; } else { const ni = s.entries.findIndex(q => q.sets.some(z => !z.done)); if (ni >= 0) { P.ei = ni; P.si = s.entries[ni].sets.findIndex(z => !z.done); P.phase = 'work'; } else P.phase = 'choice'; } renderPlayer(); toast('💤 Switched to deload — fewer, lighter sets'); };
function setReason(r, note) { const { kind, date } = ctx.reasonFor; S.skips = S.skips || {}; if (r) S.skips[date] = { kind, reason: r, note: note || '', at: today() }; else S.skips[date] = { kind, reason: 'none', at: today() }; save(); const cb = ctx.reasonCb; ctx.reasonCb = null; closeModal(); if (cb) cb(); else render(true); }
A.reasonPick = el => { if (el.dataset.r === 'other') { $('#reasonOther').classList.remove('hidden'); $('#reasonNote').focus(); return; } setReason(el.dataset.r); };
A.reasonSave = () => setReason('other', $('#reasonNote').value.trim());
A.reasonSkip = () => setReason(null);
A.missedWhy = el => askReason('missed', el.dataset.d, null);
A.toggleLog = () => { ctx.showLog = !ctx.showLog; render(true); };
A.switchDay = el => {
  const d = el.dataset.d, light = el.dataset.deload === '1', cur = light ? -1 : (S.sessions[d] ? S.sessions[d].dow : effKey(d));
  const keys = [1, 2, 3, 4, 5, 6, 0].filter(k => S.program.days[k].type === 'gym' || (!light && S.program.days[k].type === 'run'));
  openModal(`<div class="row between"><h2 style="margin:0">${light ? '💤 Light session' : 'Switch workout'}</h2><button class="iconbtn" data-a="close">✕</button></div><div class="small muted" style="margin:4px 0 12px">${light ? `Pick a workout to do as a deload — half the sets at ~60% weight. Doesn't affect your strength progress.` : `Pick what to do on ${fmtD(d)}. The two days <b>swap</b> — the workout you skip moves to the day you took it from, so nothing is missed.`}</div>` +
    keys.map(k => { const day = S.program.days[k], sw = light ? null : swapTarget(d, k); return `<div class="daycard ${+cur === k ? 'on' : ''}" data-a="pickDayCard" data-d="${d}" data-k="${k}" ${light ? 'data-deload="1"' : ''}><div class="dl">${day.type === 'run' ? '🏃' : DN[k]}</div><div class="grow"><b>${esc(day.name)}</b><div class="tiny muted">${day.type === 'run' ? `Easy run · target ${nextLongRun()} km` : `${day.items.length} exercises · ~${estMinutes(day.items)} min · ${esc(musclesOf(day.items).join(', '))}`}${sw ? `<br>↔ swaps with ${fmtD(sw)}` : !light && +cur !== k ? '<br>this day only (already done or passed this week)' : ''}</div></div>${+cur === k ? '<span class="pill acc">Current</span>' : ''}</div>`; }).join(''));
};
function swapTarget(d, k) { const sun = addD(monOf(d), 6); for (let i = 1; i <= 6; i++) { const x = addD(d, i); if (x > sun) break; if (!S.sessions[x] && !(S.moves || {})[x] && effKey(x) === k) return x; } return null; }
function clearPair(d) { const m = (S.moves || {})[d]; if (!m) return; const p2 = m.to || m.from || m.swap; if (p2 && S.moves[p2]) { if (!hasDone(S.sessions[p2])) delete S.sessions[p2]; delete S.moves[p2]; } delete S.moves[d]; }
A.pickDayCard = el => {
  const d = el.dataset.d, k = +el.dataset.k;
  if (hasDone(S.sessions[d])) { closeModal(); return toast('This workout already has sets logged — discard it first in "Edit workout log".'); }
  if (el.dataset.deload === '1') { delete S.sessions[d]; dayPick[d] = k; createSession(d, k, { deload: true }); save(); closeModal(); render(true); return toast(`${fmtD(d)}: ${S.program.days[k].name} (deload)`); }
  clearPair(d); delete S.sessions[d]; delete dayPick[d]; S.moves = S.moves || {};
  const orig = effKey(d); if (orig === k) { save(); closeModal(); render(true); return toast('Back to the normal plan'); }
  const to = swapTarget(d, k), nm = S.program.days[k].name, on = S.program.days[orig] ? S.program.days[orig].name : 'Rest';
  if (to) { S.moves[d] = { k, swap: to }; S.moves[to] = { k: orig, swap: d }; toast(`↔ ${nm} today · ${on} moved to ${fmtD(to)}`); }
  else { S.moves[d] = { k, once: true }; toast(`${fmtD(d)}: ${nm} (no later ${nm} this week to swap with)`); }
  save(); closeModal(); render(true);
};
A.pMenu = () => {
  const s = S.sessions[P.date], done = s.entries.reduce((a, e) => a + e.sets.filter(z => z.done).length, 0);
  openModal(`<div class="row between"><h2 style="margin:0">Stop workout?</h2><button class="iconbtn" data-a="close">✕</button></div><div class="small muted" style="margin:4px 0 12px">${done} set${done === 1 ? '' : 's'} logged so far.</div>
  <div class="col" style="gap:8px">${s.deload ? '' : `<button class="btn block" data-a="pDeload">💤 Feeling low — switch the rest to deload</button>`}<button class="btn block" data-a="pStop">⏸ Pause & close — continue later</button>${done ? `<button class="btn block" data-a="pFinishNow">✓ Finish now — save ${done} set${done === 1 ? '' : 's'}</button>` : ''}<button class="btn danger block" data-a="pCancel">✕ Cancel workout — delete it & start over</button><button class="btn primary block" data-a="close">Keep training</button></div>`);
};
function setPaused(on) {
  if (!P || !!P.paused === on) return; const s = S.sessions[P.date];
  if (on) { P.paused = true; P.pausedAt = Date.now(); }
  else { const d = Date.now() - P.pausedAt; P.paused = false; s.startedAt += d; for (const k of ['restEnd', 'restStart', 'setEnd', 'autoFinishAt']) if (P[k]) P[k] += d; save(); }
  BG.noteKey = null; renderPlayer(); bgUpdate(true);
}
A.pPause = () => { setPaused(!P.paused); toast(P.paused ? 'Paused — timers frozen' : 'Resumed'); };
A.pStop = () => { if (!P) return; closeModal(); if (P.paused) { const d = Date.now() - P.pausedAt; S.sessions[P.date].startedAt += d; } save(); const nm = S.sessions[P.date].name; closePlayer(); clearNotes(['gf-timer', 'gf-alarm']).then(() => { if (document.visibilityState === 'hidden') note('gf-timer', '⏹ Workout stopped', `${nm} — your sets are saved. Tap Resume to continue.`, { silent: true, actions: [{ action: 'resume', title: '▶ Resume' }] }); }); toast('Workout stopped — tap Resume on the Train tab to continue.'); };
A.pFinishNow = () => { closeModal(); if (P.paused) setPaused(false); A.pFinish(); };
A.pCancel = () => {
  if (!P) return; const date = P.date, s = S.sessions[date], done = s ? s.entries.reduce((a, e) => a + e.sets.filter(z => z.done).length, 0) : 0;
  if (done && !confirm(`Cancel this workout? The ${done} logged set${done === 1 ? '' : 's'} will be deleted.`)) return;
  closeModal(); delete S.sessions[date]; save(); closePlayer(); clearNotes(['gf-timer', 'gf-alarm']); ctx.date = date; toast('Workout cancelled — start again whenever you are ready.');
};
// buttons pressed in the phone notification (relayed by the service worker)
function noteAction(a) {
  if (a === 'water250') return addWater(250);
  if (a === 'waterBottle') return addWater(bottleMl());
  if (a === 'resume' || a === 'start') { if (P) setPaused(false); else { const d = today(); if (S.sessions[d] && !S.sessions[d].done) openPlayer(d); } return; }
  if (!P) return;
  if (a === 'pause') setPaused(true);
  else if (a === 'stop') A.pStop();
  else if (a === 'skip' && P.phase === 'rest') A.pRestSkip();
  else if (a === 'done') { if (P.paused) setPaused(false); if (P.phase === 'rest') A.pRestSkip(); if (P.phase === 'work') A.pDone(); else if (P.phase === 'warm') A.pWarmDone(); }
  BG.noteKey = null; bgUpdate(true);
}
if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', ev => { if (ev.data && ev.data.type === 'gf-action') noteAction(ev.data.action); });
A.pClose = () => { if (P && P.phase !== 'summary') { save(); toast('Workout paused — tap Resume to continue.'); } closePlayer(); };
A.pStep = el => { const inp = el.dataset.f === 'w' ? $('#pW') : $('#pR'); const v = (num(inp.value) || 0) + num(el.dataset.n); inp.value = Math.max(0, r1(v)); };
A.pDone = () => {
  if (P && P.paused) setPaused(false);
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) {}
  readPlayerInputs(); const s = S.sessions[P.date], ent = s.entries, e = ent[P.ei], set = e.sets[P.si];
  if (!(num(set.r) > 0)) return toast('Enter your reps.');
  if (set.w === '' && ex(e.ex).kind !== 'b') return toast('Enter the weight (kg).');
  set.done = true; P.lastSet = { i: P.ei, j: P.si };
  for (let j = P.si + 1; j < e.sets.length; j++) if (!e.sets[j].done && (e.sets[j].w === '' || e.sets[j].w == null)) e.sets[j].w = set.w;
  save();
  const undone = q => (q ? q.sets.findIndex(z => !z.done) : -1);
  if (e.ss && undone(ent[P.ei + 1]) >= 0) { P.ei++; P.si = undone(ent[P.ei]); P.phase = 'work'; P.restEnd = null; renderPlayer(); toast('Superset — straight to ' + ex(ent[P.ei].ex).name); return; }
  startRestTimer(restFor(e));
  const prev = ent[P.ei - 1];
  if (prev && prev.ss && undone(prev) >= 0) { P.ei--; P.si = undone(prev); P.phase = 'rest'; renderPlayer(); return; }
  const nextSet = undone(e); P.restFrom = P.ei;
  if (nextSet >= 0) { P.si = nextSet; P.phase = 'rest'; }
  else if (S.settings.autoFlow) {
    const ni = ent.findIndex((q, i) => i > P.ei && undone(q) >= 0), any = ni >= 0 ? ni : ent.findIndex(q => undone(q) >= 0);
    if (any >= 0) { P.ei = any; P.si = undone(ent[any]); P.phase = 'rest'; toast(`${ex(e.ex).name} done — next: ${ex(ent[any].ex).name}`); }
    else { P.phase = 'choice'; P.restEnd = null; P.autoFinishAt = Date.now() + 15000; }
  } else P.phase = 'choice';
  renderPlayer();
};
A.pWarm = () => { readPlayerInputs(); if (!(warmBase(S.sessions[P.date].entries[P.ei]) > 0)) return toast('Enter your working weight (kg) first — warm-ups are based on it.'); save(); P.phase = 'warm'; P.wi = 0; renderPlayer(); };
A.pWarmDone = () => { P.wi++; if (P.wi >= 2) { S.sessions[P.date].warm = true; save(); P.phase = 'work'; } renderPlayer(); };
A.pWarmSkip = () => { S.sessions[P.date].warm = true; save(); P.phase = 'work'; renderPlayer(); };
A.pRestSet = el => { if (!P || !P.restEnd) return; const v = +el.dataset.v; P.restEnd = (P.restStart || Date.now()) + v * 1000; P.restTotal = v; P.beeped = false; renderPlayer(); };
A.exNote = el => { const id = el.dataset.ex; openModal(`<div class="row between"><h2 style="margin:0">Note — ${esc(ex(id).name)}</h2><button class="iconbtn" data-a="close">✕</button></div><div class="small muted" style="margin:4px 0 10px">Machine settings, grip, cues, pain to watch. Shows every time you do this exercise.</div><textarea id="noteTxt" rows="4" placeholder="e.g. Seat 4, bench at 30°, elbows tucked">${esc((S.exNotes || {})[id] || '')}</textarea><button class="btn primary block" style="margin-top:10px" data-a="saveNote" data-ex="${id}">Save note</button>`); };
A.saveNote = el => { const v = $('#noteTxt').value.trim(); S.exNotes = S.exNotes || {}; if (v) S.exNotes[el.dataset.ex] = v; else delete S.exNotes[el.dataset.ex]; save(); closeModal(); if (P) renderPlayer(); else render(true); toast('Note saved ✓'); };
A.pRestAdd = el => { if (P && P.restEnd) { P.restEnd += (num(el.dataset.n) || 30) * 1000; P.restTotal += (num(el.dataset.n) || 30); P.beeped = false; playerTick(); } };
A.pRedo = el => {
  const j = +el.dataset.j, s = S.sessions[P.date], e = s.entries[P.ei], z = e.sets[j];
  if (z.done) { z.done = false; save(); toast(`Set ${j + 1} reopened — change kg/reps and tap Done again`); }
  P.si = j; P.phase = 'work'; renderPlayer();
};
A.pUndo = () => {
  const ld = lastDone(); if (!ld) return toast('No completed set to redo yet.');
  const z = S.sessions[P.date].entries[ld.i].sets[ld.j]; z.done = false; save();
  P.ei = ld.i; P.si = ld.j; P.phase = 'work'; P.restEnd = null; renderPlayer(); toast(`Set ${ld.j + 1} reopened — fix it and tap Done`);
};
A.pExtra = () => { if (P.phase === 'rest' && P.restFrom != null && P.restFrom !== P.ei) { P.ei = P.restFrom; } P.autoFinishAt = null; const e = S.sessions[P.date].entries[P.ei], l = e.sets[e.sets.length - 1] || { w: '' }; e.sets.push({ w: l.w, r: '', done: false }); save(); const resting = P.phase === 'rest' && P.restEnd && P.restEnd > Date.now(); P.si = e.sets.length - 1; P.phase = resting ? 'rest' : 'work'; renderPlayer(); toast(`Set ${e.sets.length} added`); };
A.pRestSkip = () => { P.restEnd = null; P.phase = 'work'; renderPlayer(); };
A.pRepeat = () => { const e = S.sessions[P.date].entries[P.ei], l = e.sets[e.sets.length - 1]; e.sets.push({ w: l.w, r: '', done: false }); save(); P.si = e.sets.length - 1; P.phase = P.restEnd && P.restEnd > Date.now() ? 'rest' : 'work'; renderPlayer(); };
A.pNext = el => { const i = +el.dataset.i, e = S.sessions[P.date].entries[i]; P.ei = i; P.si = Math.max(0, e.sets.findIndex(z => !z.done)); P.phase = P.restEnd && P.restEnd > Date.now() ? 'rest' : 'work'; renderPlayer(); };
A.pSkipEx = () => { const s = S.sessions[P.date], ni = s.entries.findIndex((q, i) => i > P.ei && q.sets.some(z => !z.done)); if (ni >= 0) { P.ei = ni; P.si = s.entries[ni].sets.findIndex(z => !z.done); P.phase = 'work'; P.restEnd = null; renderPlayer(); } else { P.phase = 'choice'; renderPlayer(); } };
A.pFinish = () => { const s = S.sessions[P.date]; s.done = true; s.endedAt = Date.now(); save(); P.phase = 'summary'; P.restEnd = null; P.autoFinishAt = null; renderPlayer(); const prs = sessionPRs(P.date), sets = s.entries.reduce((a, q) => a + q.sets.filter(z => z.done).length, 0); alarm('Workout complete 🏆', `${s.name} · ${Math.round((s.endedAt - s.startedAt) / 60000)} min · ${sets} sets${prs.length ? ` · ${prs.length} PR${prs.length > 1 ? 's' : ''}` : ''}`); };
A.cancelFin = () => { P.autoFinishAt = null; renderPlayer(); };
A.hfPause = () => { P.hfPause = !P.hfPause; if (!P.hfPause) { P.setFor = null; } renderPlayer(); };
A.tglAuto = () => { S.settings.autoFlow = !S.settings.autoFlow; save(); renderPlayer(); toast(S.settings.autoFlow ? 'Auto-continue on: rest → next set → next exercise, by itself' : 'Auto-continue off'); };
A.tglHF = () => { S.settings.handsFree = !S.settings.handsFree; P.setFor = null; save(); renderPlayer(); toast(S.settings.handsFree ? `Hands-free on: each set completes itself after ${S.settings.setSec || 40}s with the kg/reps shown` : 'Hands-free off'); };
function notifOn() { return S.settings.notify && 'Notification' in window && Notification.permission === 'granted'; }
A.tglNotif = async () => {
  if (!('Notification' in window)) return toast('This browser does not support notifications.');
  if (notifOn()) { S.settings.notify = false; save(); renderPlayer(); return toast('Lock-screen timer off'); }
  S.settings.notify = true; save();
  const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (p !== 'granted') toast('Notifications are blocked — allow them in phone Settings › Apps › Chrome › Notifications.');
  else { note('gf-test', 'Lock-screen timer on ✓', 'Rest countdown and alarms will show here when the app is in the background.', { silent: true }); toast('Lock-screen timer on'); }
  renderPlayer();
};
A.tickSet = el => {
  const s = S.sessions[ctx.date], e = s.entries[+el.dataset.i], x = e.sets[+el.dataset.j];
  if (!x.done && !(num(x.r) > 0)) return toast('Enter your reps first.');
  if (!x.done && x.w === '' && ex(e.ex).kind !== 'b') return toast('Enter the weight (kg) first.');
  x.done = !x.done; save(); render(true);
};
A.addSet = el => { const e = S.sessions[ctx.date].entries[+el.dataset.i], l = e.sets[e.sets.length - 1] || { w: '' }; e.sets.push({ w: l.w, r: '', done: false }); save(); render(true); };
A.rmSet = el => { const e = S.sessions[ctx.date].entries[+el.dataset.i]; if (e.sets.length > 1) e.sets.pop(); save(); render(true); };
A.finish = () => { const s = S.sessions[ctx.date]; s.done = true; s.endedAt = s.endedAt || Date.now(); save(); const prs = sessionPRs(ctx.date); toast(prs.length ? `Workout saved — ${prs.length} PR${prs.length > 1 ? 's' : ''}!` : 'Workout saved.'); render(true); };
A.reopen = () => { S.sessions[ctx.date].done = false; save(); render(true); };
A.delSession = () => { if (confirm('Discard this workout log?')) { delete S.sessions[ctx.date]; save(); render(); } };
A.demo = el => {
  const id = el.dataset.ex2 || el.dataset.ex, e = ex(id); let f = 0;
  openModal(`<div class="row between"><h2>${esc(e.name)}</h2><button class="iconbtn" data-a="close">✕</button></div>${demoSrc(id) ? `<img class="demo" id="demoImg" src="${demoSrc(id)}" alt="${esc(e.name)} demo" onerror="this.outerHTML='<div class=&quot;small muted&quot;>Picture needs internet the first time.</div>'">` : '<div class="small muted">No picture for this exercise.</div>'}${e.video ? `<a class="btn block" style="margin-top:10px;text-align:center" href="${esc(e.video)}" target="_blank" rel="noopener">Watch video</a>` : ''}<div class="small muted" style="margin-top:8px">${esc(e.muscle)} · ${esc(e.equip)}</div>${(S.exNotes || {})[id] ? `<div class="sug">📝 ${esc(S.exNotes[id])}</div>` : ''}<button class="btn sm" style="margin-top:8px" data-a="exNote" data-ex="${id}">📝 ${(S.exNotes || {})[id] ? 'Edit' : 'Add'} my note</button><ol class="steps">${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>${e.prog.length ? `<h3>When you outgrow it</h3>${e.prog.map(p => `<div class="small" style="margin-bottom:6px"><b>${esc(ex(p.to).name)}</b> — <span class="muted">${esc(p.why)}</span></div>`).join('')}` : ''}`);
  clearInterval(demoTimer); if (demoSrc(id)) demoTimer = setInterval(() => { const im = $('#demoImg'); if (!im) return clearInterval(demoTimer); f = 1 - f; im.src = demoSrc(id, f); }, 900);
};
A.close = closeModal;
A.exMenu = el => {
  const i = +el.dataset.i, e = S.sessions[ctx.date].entries[i], x = ex(e.ex), progIds = x.prog.map(p => p.to);
  const alts = Object.values(EX).filter(a => a.muscle === x.muscle && a.id !== x.id && !progIds.includes(a.id)).sort((a, b) => (a.demo === 'local' ? 0 : 1) - (b.demo === 'local' ? 0 : 1)).slice(0, 25);
  const item = to => `<div class="list-item" data-a="swapEx" data-i="${i}" data-to="${to.id}">${thumb(to.id, 44)}<div class="grow"><b>${esc(to.name)}</b><div class="small muted">${esc(to.why || to.equip)}</div></div></div>`;
  openModal(`<div class="row between"><h2>${esc(x.name)}</h2><button class="iconbtn" data-a="close">✕</button></div>
  ${x.prog.length ? `<h3>Next-level variations</h3>${x.prog.map(p => item({ ...ex(p.to), why: p.why })).join('')}<hr>` : ''}<h3>Swap for today (same muscle)</h3>${alts.map(a => item(a)).join('')}<button class="btn sm block" style="margin-top:8px" data-a="swapSearch" data-i="${i}">Search all exercises…</button>
  <label class="small muted cb" style="margin-top:12px"><input type="checkbox" id="swapPerm"> Also replace it in my weekly split</label><hr><button class="btn danger sm" data-a="rmEx" data-i="${i}">Remove from today's workout</button>`);
};
function doSwap(i, to, perm) {
  const s = S.sessions[ctx.date], old = s.entries[i].ex;
  s.entries[i] = newEntry({ ex: to, ...s.entries[i].t }, ctx.date, s.deload);
  if (perm) for (const d of Object.values(S.program.days)) for (const it of d.items) if (it.ex === old) it.ex = to;
  save(); closeModal(); if (P) { P.ei = i; P.si = 0; P.phase = 'work'; renderPlayer(); } else render(true); toast(`Swapped to ${ex(to).name}${perm ? ' (split updated)' : ''}`);
}
A.swapEx = el => doSwap(+el.dataset.i, el.dataset.to, $('#swapPerm')?.checked);
A.swapSearch = el => { const i = +el.dataset.i; pickExercise(id => doSwap(i, id, false)); };
A.rmEx = el => { const s = S.sessions[ctx.date]; s.entries.splice(+el.dataset.i, 1); save(); closeModal(); if (P) { if (!s.entries.length) closePlayer(); else { P.ei = Math.min(P.ei, s.entries.length - 1); P.si = Math.max(0, s.entries[P.ei].sets.findIndex(z => !z.done)); P.phase = 'work'; renderPlayer(); } } else render(true); };
A.addEx = () => pickExercise(id => { const s = S.sessions[ctx.date], e = ex(id); s.entries.push(newEntry({ ex: id, sets: 3, min: e.kind === 'c' ? 8 : 10, max: e.kind === 'c' ? 12 : 15 }, ctx.date, s.deload)); save(); render(true); });
A.pickedEx = el => { const cb = pickExercise.cb; closeModal(); cb && cb(el.dataset.id); };
A.customEx = () => {
  const ms = ['chest', 'back', 'shoulders', 'side delts', 'rear delts', 'biceps', 'triceps', 'forearms', 'abs', 'quads', 'hamstrings', 'glutes', 'calves', 'lower back', 'traps', 'cardio', 'other'];
  openModal(`<div class="row between"><h2>My own exercise</h2><button class="iconbtn" data-a="close">✕</button></div><label class="f">Name</label><input type="text" id="ceName" placeholder="e.g. Machine chest press (Hammer Strength)">
  <div class="grid2"><div><label class="f">Main muscle</label><select id="ceMus">${ms.map(m => `<option>${m}</option>`).join('')}</select></div><div><label class="f">Type</label><select id="ceKind"><option value="c">Compound (big lift)</option><option value="i">Isolation</option><option value="b">Bodyweight</option></select></div>
  <div><label class="f">Equipment</label><input type="text" id="ceEq" placeholder="Machine"></div><div><label class="f">Weight step (kg)</label><input type="number" step="0.5" id="ceInc" value="2.5"></div></div>
  <label class="f">Video link (optional, e.g. YouTube)</label><input type="url" id="ceVid" placeholder="https://"><label class="f">Notes / cues (optional)</label><textarea id="ceNotes" rows="2"></textarea>
  <button class="btn primary block" style="margin-top:12px" data-a="saveCustomEx">Save exercise</button>`);
};
A.saveCustomEx = () => {
  const name = $('#ceName').value.trim(); if (!name) return toast('Give it a name.');
  const c = { id: 'c_' + Date.now().toString(36), name, muscle: $('#ceMus').value, kind: $('#ceKind').value, equip: $('#ceEq').value.trim() || 'Other', inc: num($('#ceInc').value) ?? 2.5, video: $('#ceVid').value.trim(), notes: $('#ceNotes').value.trim() };
  S.customEx.push(c); buildEx(); save(); const cb = pickExercise.cb; closeModal(); toast('Exercise saved.'); cb && cb(c.id);
};
A.addRun = () => {
  const km = num($('#runKm').value), sec = parseTime($('#runTime').value), date = $('#runDate').value || today();
  if (!km || !sec) return toast('Enter distance and time (mm:ss).');
  const prev = S.runs.filter(r => r.km >= 3), isPace = km >= 3 && prev.length > 0 && prev.every(r => sec / km < r.sec / r.km);
  S.runs.push({ id: Date.now().toString(36), date, km, sec, type: $('#runType').value }); save();
  toast(isPace ? `Saved — new best pace ${fmtTime(sec / km)} /km!` : `Saved: ${km} km at ${fmtTime(sec / km)} /km`); render(true);
};
A.delRun = el => { if (confirm('Delete this run?')) { S.runs = S.runs.filter(r => r.id !== el.dataset.id); save(); render(true); } };
A.pMove = el => { const it = S.program.days[el.dataset.k].items, i = +el.dataset.i; if (i > 0) { [it[i - 1], it[i]] = [it[i], it[i - 1]]; save(); render(true); } };
A.pDel = el => { S.program.days[el.dataset.k].items.splice(+el.dataset.i, 1); save(); render(true); };
A.pAdd = el => { const k = el.dataset.k; pickExercise(id => { const e = ex(id); S.program.days[k].items.push({ ex: id, sets: 3, min: e.kind === 'c' ? 8 : 10, max: e.kind === 'c' ? 12 : 15 }); save(); render(true); }); };
A.resetProgram = () => { if (confirm('Reset your split to the original plan?')) { S.program = clone(window.DEFAULT_PROGRAM); save(); render(); } };
A.tickFood = el => { const d = el.dataset.d, k = el.dataset.k, rec = dayRec(d, true), it = dayItems(d).find(i => i.key === k); rec.items[k] = { food: it.food, qty: it.qty, done: !it.done }; save(); render(true); };
A.qty = el => { const d = el.dataset.d, k = el.dataset.k, rec = dayRec(d, true), it = dayItems(d).find(i => i.key === k); rec.items[k] = { food: it.food, qty: Math.max(0, r1(it.qty + stepFor(it.food) * +el.dataset.n)), done: it.done }; save(); render(true); };
A.waterAdd = el => { const d = el.dataset.d, ml = +el.dataset.ml, rec = dayRec(d, true); rec.waterMl = waterMl(d) + ml; if (d === today()) rec.waterAt = Date.now(); delete rec.water; (rec.waterLog ||= []).push(ml); save(); render(true); if (waterMl(d) >= waterGoal(d) && waterMl(d) - ml < waterGoal(d)) toast('Water goal reached 💧'); };
A.waterUndo = el => { const d = el.dataset.d, rec = dayRec(d, true), last = (rec.waterLog || []).pop() || bottleMl(); rec.waterMl = Math.max(0, waterMl(d) - last); delete rec.water; save(); render(true); };
A.waterSet = () => {
  const st = S.settings, hours = Array.from({ length: 24 }, (_, h) => h);
  openModal(`<div class="row between"><h2 style="margin:0">Water reminders</h2><button class="iconbtn" data-a="close">✕</button></div>
  <label class="small cb" style="margin-top:8px"><input type="checkbox" data-c="tgl" data-f="waterRemind" ${st.waterRemind ? 'checked' : ''}> Remind me to drink water</label>
  <label class="f">Every</label><div class="seg">${[45, 60, 90, 120].map(v => `<button class="${st.waterEvery === v ? 'on' : ''}" data-a="waterEvery" data-v="${v}">${v < 60 ? v + ' min' : v / 60 + ' h'}</button>`).join('')}</div>
  <div class="grid2"><div><label class="f">From</label><select data-c="waterHr" data-f="waterFrom">${hours.map(h => `<option value="${h}" ${st.waterFrom === h ? 'selected' : ''}>${h}:00</option>`).join('')}</select></div><div><label class="f">Until</label><select data-c="waterHr" data-f="waterTo">${hours.map(h => h + 1).map(h => `<option value="${h}" ${st.waterTo === h ? 'selected' : ''}>${h === 24 ? 'midnight' : h + ':00'}</option>`).join('')}</select></div></div>
  <div class="small muted" style="margin-top:10px">It skips a reminder if you logged water recently, and stops once you hit your goal. The notification has <b>+ Glass</b> and <b>+ Bottle</b> buttons so you can log without opening the app.</div>
  <div class="sug" style="margin-top:10px">Phone reminders work while the app is open or recently used. For a reminder that rings <b>even when the app is closed</b>, also add them to your phone calendar (one time):</div>
  <div class="row" style="margin-top:10px"><button class="btn grow" data-a="waterTest">🔔 Test now</button><button class="btn primary grow" data-a="waterCal">📅 Add to calendar</button></div>`);
};
A.waterEvery = el => { S.settings.waterEvery = +el.dataset.v; save(); A.waterSet(); render(true); };
A.waterTest = async () => { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); S.settings.notify = true; save(); note('gf-water', '💧 Time to drink water', `Test reminder · ${fmtL(waterMl(today()))} of ${fmtL(waterGoal(today()))} so far.`, { vibrate: [400, 150, 400], renotify: true, silent: false, actions: [{ action: 'water250', title: '+ Glass 250 ml' }, { action: 'waterBottle', title: `+ Bottle ${S.settings.bottleOz} oz` }] }); beep(); toast(Notification.permission === 'granted' ? 'Test sent — check your notifications' : 'Allow notifications in phone Settings › Apps › Chrome'); };
A.waterCal = () => {
  const { n, text } = waterIcs(); if (!n) return toast('Pick a wider time range first.');
  const blob = new Blob([text], { type: 'text/calendar' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Gherwin-water-reminders.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  openModal(`<div class="row between"><h2 style="margin:0">Add to calendar</h2><button class="iconbtn" data-a="close">✕</button></div><div class="small" style="margin-top:8px">Downloaded <b>Gherwin-water-reminders.ics</b> — ${n} daily reminders from ${S.settings.waterFrom}:00 to ${S.settings.waterTo}:00.</div>
  <ol class="steps"><li>Open your phone's <b>Files › Downloads</b> and tap the file.</li><li>Choose <b>Calendar</b> to open it and tap <b>Import / Save</b>.</li><li>If the phone can't open it: on your laptop go to <b>calendar.google.com › ⚙️ Settings › Import & export › Import</b>, pick the file — it syncs to your phone.</li></ol>
  <div class="tiny muted">Calendar reminders ring even when the app is closed. Log the water in the app (or tap + Glass on the app's own reminder).</div><button class="btn primary block" data-a="close">OK</button>`);
};
A.stepsHelp = () => openModal(`<div class="row between"><h2 style="margin:0">Automatic steps</h2><button class="iconbtn" data-a="close">✕</button></div>
  <div class="small muted" style="margin:6px 0 12px">A website app can't read your phone's step counter directly, so a free automation on your phone sends today's steps to the app every evening. It is set up once, then runs by itself. Steps arrive through your login, so laptop and phone both show them.</div>
  <div class="card"><h3>iPhone — Shortcuts app (free, built in)</h3><ol class="steps">
  <li>Open <b>Shortcuts</b> › <b>Automation</b> › <b>+</b> › <b>Time of Day</b> › e.g. <b>9:30 PM</b>, <b>Daily</b> › <b>Run Immediately</b> › Next › <b>New Blank Automation</b>.</li>
  <li>Add action <b>Find Health Samples</b>: Type <b>Steps</b>, filter <b>Start Date is Today</b>.</li>
  <li>Add action <b>Calculate Statistics</b>: <b>Sum</b> of the Health Samples.</li>
  <li>Add action <b>URL</b>: <code>${esc(location.origin + location.pathname)}?steps=</code> then tap to insert the <b>Statistics</b> result at the end.</li>
  <li>Add action <b>Open URLs</b>. Done — tap the automation once to test it and allow Health access.</li></ol><div class="tiny muted">The link opens in Safari, so sign in to the app in Safari once too. The steps then sync to your home-screen app and laptop.</div></div>
  <div class="card"><h3>Android</h3><div class="small muted">Tell Claude which step app you use (Google Fit, Samsung Health, or the phone's own) and you'll get the exact setup. The app already accepts steps sent as <code>?steps=NUMBER</code>.</div></div>
  <div class="small muted">Until then, type the number from your phone's health app into the Steps box.</div>`);
A.rmExtra = el => { S.days[el.dataset.d].extras.splice(+el.dataset.x, 1); save(); render(true); };
A.logFood = () => openFoodLogger();
async function lookupBarcode(code) {
  const msg = $('#scanMsg'), say = t => { if (msg) msg.textContent = t; };
  code = String(code || '').replace(/\D/g, ''); if (code.length < 6) return say('Type the full number under the barcode (8–13 digits).');
  if (!navigator.onLine) return say('Barcode lookup needs internet. Search the food list instead.');
  stopScan(); say('Found ' + code + ' — looking it up…'); const sc = $('#scanCode'); if (sc) sc.value = code;
  let p = null;
  for (const url of [`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_quantity,serving_size`, `https://world.openfoodfacts.org/api/v0/product/${code}.json`]) {
    try { const r = await fetchT(url, 9000), j = await r.json(); if (j && j.product && j.product.product_name) { p = j.product; break; } } catch (e) {}
  }
  if (!p) return say(`Barcode ${code} isn't in the free food database yet. Use "Enter calories & macros myself" with the label values.`);
  const n = p.nutriments || {}; if (n['energy-kcal_100g'] == null && n.energy_100g == null && n['energy-kcal_serving'] == null) return say(`Found "${p.product_name}" but it has no nutrition info. Enter it yourself from the label.`);
  const sg = num(p.serving_quantity) || 100, m = sg / 100, k100 = n['energy-kcal_100g'] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : n['energy-kcal_serving'] / m);
  FL.sel = { src: 'off', name: p.product_name + (p.brands ? ` (${String(p.brands).split(',')[0]})` : ''), label: p.serving_size || '100 g', g: sg, kcal: k100 * m, p: (n.proteins_100g || 0) * m, c: (n.carbohydrates_100g || 0) * m, f: (n.fat_100g || 0) * m, cat: 'Other' };
  FL.mode = 'srv'; FL.amt = 1; flDetail();
}
const ZXING_URLS = ['https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js', 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js'];
async function loadZXing() { if (window.ZXing) return window.ZXing; for (const u of ZXING_URLS) { try { await loadScript(u); if (window.ZXing) return window.ZXing; } catch (e) {} } throw new Error('reader'); }
async function nativeDetector() { try { if (!('BarcodeDetector' in window)) return null; const f = await BarcodeDetector.getSupportedFormats(); if (!f.includes('ean_13') && !f.includes('upc_a')) return null; return new BarcodeDetector({ formats: f }); } catch (e) { return null; } }
function stopScan() { if (FL && FL.stream) { FL.stream.getTracks().forEach(t => t.stop()); FL.stream = null; } if (FL && FL.zx) { try { FL.zx.reset(); } catch (e) {} FL.zx = null; } }
A.flScan = async () => {
  stopScan(); $('#flBrowse').classList.add('hidden');
  $('#flSel').innerHTML = `<div class="fdetail"><div class="row between"><h2 style="margin:0">Scan barcode</h2><button class="iconbtn" data-a="flBack">✕</button></div><video id="scanV" playsinline muted style="width:100%;border-radius:14px;background:#000;margin-top:10px;max-height:40vh;object-fit:cover"></video><div class="small muted" id="scanMsg" style="margin-top:8px">Starting camera…</div>
  <label class="btn block" style="margin-top:10px;text-align:center">📸 Take a photo of the barcode instead<input type="file" accept="image/*" capture="environment" id="scanPhoto" data-c="scanPhoto" style="display:none"></label>
  <div class="row" style="margin-top:10px"><input type="text" inputmode="numeric" id="scanCode" placeholder="…or type the barcode number"><button class="btn sm" data-a="flLookup">Look up</button></div></div>`;
  const say = t => { const m = $('#scanMsg'); if (m) m.textContent = t; };
  if (!navigator.onLine) say('No internet — barcode lookup needs internet. You can still type the food name in search.');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('#scanV').style.display = 'none'; return say('Camera not available here — take a photo or type the number.'); }
  try {
    const det = await nativeDetector();
    if (det) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); FL.stream = stream;
      const v = $('#scanV'); v.srcObject = stream; await v.play(); say('Point the back camera at the barcode — hold it 10–20 cm away.');
      const loop = async () => { if (!FL || !FL.stream || !$('#scanV')) return; try { const c = await det.detect(v); if (c.length) return lookupBarcode(c[0].rawValue); } catch (e) {} setTimeout(loop, 250); }; loop();
    } else {
      say('Loading the barcode reader…'); const ZX = await loadZXing(); const reader = new ZX.BrowserMultiFormatReader(); FL.zx = reader;
      say('Point the back camera at the barcode — hold it 10–20 cm away.');
      await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, $('#scanV'), (res) => { if (res && FL && FL.zx) { const t = res.getText ? res.getText() : res.text; lookupBarcode(t); } });
    }
  } catch (e) {
    const v = $('#scanV'); if (v) v.style.display = 'none';
    say(e && e.name === 'NotAllowedError' ? 'Camera permission is blocked — allow it in Chrome › ⋮ › Settings › Site settings › Camera, or take a photo / type the number.' : e && e.message === 'reader' ? "Couldn't load the barcode reader (needs internet). Take a photo or type the number." : 'Camera could not start — take a photo or type the number.');
  }
};
C.scanPhoto = async el => {
  const f = el.files[0]; if (!f) return; const say = t => { const m = $('#scanMsg'); if (m) m.textContent = t; }; say('Reading the barcode from the photo…');
  try {
    const det = await nativeDetector();
    if (det) { const bmp = await createImageBitmap(f), c = await det.detect(bmp); if (c.length) return lookupBarcode(c[0].rawValue); }
    const ZX = await loadZXing(), url = URL.createObjectURL(f), res = await new ZX.BrowserMultiFormatReader().decodeFromImageUrl(url); URL.revokeObjectURL(url);
    return lookupBarcode(res.getText ? res.getText() : res.text);
  } catch (e) { say("Couldn't read the barcode in that photo — try closer, in good light, barcode filling the frame. Or type the number."); }
};
A.flLookup = () => lookupBarcode($('#scanCode').value);
A.flPick = el => { FL.sel = FL.list[+el.dataset.i]; FL.mode = 'srv'; FL.amt = FL.sel.defQty || 1; flDetail(); };
A.flBack = () => { stopScan(); FL.sel = null; $('#flSel').innerHTML = ''; $('#flBrowse').classList.remove('hidden'); flResults(); };
A.flMode = el => { if (el.dataset.v === FL.mode) return; FL.mode = el.dataset.v; FL.amt = FL.mode === 'g' ? FL.sel.g : 1; flDetail(); };
A.flStep = el => { const step = FL.mode === 'g' ? 10 : 0.5; FL.amt = Math.max(0, r1((num(FL.amt) || 0) + step * +el.dataset.n)); flDetail(); };
A.flQuick = el => { FL.amt = num(el.dataset.v); flDetail(); };
A.flMeal = el => { FL.meal = el.dataset.v; document.querySelectorAll('#flMeals button').forEach(b => b.classList.toggle('on', b.dataset.v === FL.meal)); if (FL.sel) flDetail(); };
A.flCat = el => { FL.cat = el.dataset.v; document.querySelectorAll('#flCats .chip').forEach(b => b.classList.toggle('on', b.dataset.v === FL.cat)); flResults(); };
A.flManual = () => { FL.sel = null; $('#flBrowse').classList.add('hidden'); $('#flSel').innerHTML = `<div class="fdetail"><div class="row between"><h2 style="margin:0">Enter it yourself</h2><button class="iconbtn" data-a="flBack">✕</button></div><label class="f">Name</label><input type="text" id="mfName" value="${esc(FL.q.trim() || '')}" placeholder="e.g. Mom's chicken curry"><div class="grid2"><div><label class="f">Calories</label><input type="number" inputmode="decimal" id="mfK"></div><div><label class="f">Protein g</label><input type="number" inputmode="decimal" id="mfP"></div><div><label class="f">Carbs g</label><input type="number" inputmode="decimal" id="mfC"></div><div><label class="f">Fat g</label><input type="number" inputmode="decimal" id="mfF"></div></div><label class="small muted cb"><input type="checkbox" id="flSave"> Save to My foods for next time</label><button class="btn primary block big-btn" style="margin-top:12px" data-a="flLogManual">Log to ${esc(FL.meal)}</button></div>`; };
A.flTickPlan = el => { const d = FL.date, k = el.dataset.k, rec = dayRec(d, true), it = dayItems(d).find(i => i.key === k); rec.items[k] = { food: it.food, qty: it.qty, done: true }; save(); el.remove(); toast(`Ticked ${food(it.food).name}`); render(true); };
function flCommit(it, mult, label) {
  const rec = dayRec(FL.date, true); const save2 = $('#flSave')?.checked;
  if (it.src === 'my' && FL.mode === 'srv') rec.extras.push({ food: it.id, qty: mult, meal: FL.meal });
  else if (save2) {
    let id = it.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24) || 'food'; while (S.foods[id]) id += '_';
    S.foods[id] = { name: it.name, unit: it.g ? `${it.label} (${it.g} g)` : it.label, kcal: r1(it.kcal), p: r1(it.p), c: r1(it.c), f: r1(it.f), cat: it.cat || 'Other', buy: it.g ? { g: it.g } : null, gPer: it.g || undefined };
    rec.extras.push({ food: id, qty: r1(mult), meal: FL.meal });
  } else rec.extras.push({ name: it.name, kcal: it.kcal * mult, p: it.p * mult, c: it.c * mult, f: it.f * mult, amt: label, meal: FL.meal });
  save(); closeModal(); toast(`Logged ${it.name} — ${Math.round(it.kcal * mult)} kcal, ${r1(it.p * mult)} g protein`); render(true);
}
A.flLog = () => { const it = FL.sel; FL.amt = $('#flAmt').value; const a = num(FL.amt) || 0; if (a <= 0) return toast('Enter an amount.'); flCommit(it, flCalc().mult, FL.mode === 'g' ? `${a} g` : `${a} × ${it.label}`); };
A.flLogManual = () => { const it = { src: 'manual', name: $('#mfName').value.trim() || 'My food', label: '1 serving', g: null, kcal: num($('#mfK').value) || 0, p: num($('#mfP').value) || 0, c: num($('#mfC').value) || 0, f: num($('#mfF').value) || 0, cat: 'Other' }; if (!it.kcal && !it.p) return toast('Enter at least calories or protein.'); flCommit(it, 1, '1 serving'); };
function fetchT(url, ms = 9000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t)); }
const titleCase = t => t.toLowerCase().replace(/(^|[ ,(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
async function usdaSearch(q) {
  const r = await fetchT(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&pageSize=20&dataType=${encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS)')}&query=${encodeURIComponent(q)}`);
  if (r.status === 429) throw new Error('busy'); if (!r.ok) throw new Error('http ' + r.status);
  const j = await r.json(), val = (f, nums, names) => { const n = (f.foodNutrients || []).find(x => nums.includes(String(x.nutrientNumber)) || names.some(nm => (x.nutrientName || '').startsWith(nm) && (nm !== 'Energy' || /kcal/i.test(x.unitName || '')))); return n ? +n.value || 0 : null; };
  return (j.foods || []).map(f => { const k = val(f, ['208', '957', '958'], ['Energy']); if (k == null) return null; return { src: 'usda', name: titleCase(f.description || 'Food'), label: '100 g', g: 100, kcal: k, p: val(f, ['203'], ['Protein']) || 0, c: val(f, ['205'], ['Carbohydrate']) || 0, f: val(f, ['204'], ['Total lipid']) || 0, cat: 'Other' }; }).filter(Boolean).slice(0, 15);
}
async function offSearch(q) {
  const r = await fetchT(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,nutriments,serving_quantity,serving_size`);
  if (!r.ok) throw new Error('http ' + r.status); const j = await r.json();
  return (j.products || []).filter(p => p.product_name && p.nutriments && (p.nutriments['energy-kcal_100g'] != null || p.nutriments.energy_100g != null)).slice(0, 12).map(p => {
    const n = p.nutriments, sg = num(p.serving_quantity) || 100, k100 = n['energy-kcal_100g'] ?? (n.energy_100g / 4.184), m = sg / 100;
    return { src: 'off', name: p.product_name + (p.brands ? ` (${p.brands.split(',')[0]})` : ''), label: p.serving_size || '100 g', g: sg, kcal: k100 * m, p: (n.proteins_100g || 0) * m, c: (n.carbohydrates_100g || 0) * m, f: (n.fat_100g || 0) * m, cat: 'Other' };
  });
}
A.flOnline = async () => {
  const q = FL.q.trim(); if (!q) return; if (!navigator.onLine) { FL.onlineMsg = 'No internet right now — the built-in foods still work.'; return flResults(); }
  FL.offLoading = true; FL.onlineMsg = ''; flResults();
  const en = queryTerms(q).map(a => a.find(w => /^[a-z ]+$/.test(w) && !['bangus', 'liempo', 'manok', 'baboy', 'isda', 'prito', 'inihaw'].includes(w)) || a[0]).join(' ');
  const [u, o] = await Promise.allSettled([usdaSearch(en || q), offSearch(q)]);
  FL.usda = u.status === 'fulfilled' ? u.value : []; FL.off = o.status === 'fulfilled' ? o.value : [];
  const fails = [u.status === 'rejected' ? (u.reason && u.reason.message === 'busy' ? 'USDA is busy (try again in a minute)' : 'USDA did not answer') : '', o.status === 'rejected' ? 'Open Food Facts did not answer' : ''].filter(Boolean);
  FL.onlineMsg = !FL.usda.length && !FL.off.length ? (fails.length ? fails.join(' · ') + '.' : `Nothing found online for “${q}”.`) + ' You can enter it yourself below.' : fails.length ? fails.join(' · ') : '';
  FL.offLoading = false; flResults();
};
A.gGot = el => { const g = S.grocery[sunOf(today())]; g.got[el.dataset.id] = !g.got[el.dataset.id]; save(); render(true); };
A.gHave = el => { const g = S.grocery[sunOf(today())]; g.have[el.dataset.id] = !g.have[el.dataset.id]; save(); render(true); };
A.gxAdd = () => { const n = $('#gxName').value.trim(); if (!n) return; S.grocery[sunOf(today())].extra.push({ name: n, got: false }); save(); render(true); };
A.gxGot = el => { const e = S.grocery[sunOf(today())].extra[+el.dataset.x]; e.got = !e.got; save(); render(true); };
A.gxDel = el => { S.grocery[sunOf(today())].extra.splice(+el.dataset.x, 1); save(); render(true); };
A.gCopy = async () => {
  const g = groceryWeek(), st = S.grocery[g.start];
  const txt = `Groceries — week of ${fmtD(g.start)}\n` + g.items.filter(i => !st.have[i.id]).map(i => `${st.got[i.id] ? '[x]' : '[ ]'} ${i.name}: ${i.amt}`).join('\n') + st.extra.map(e => `\n${e.got ? '[x]' : '[ ]'} ${e.name}`).join('');
  try { await navigator.clipboard.writeText(txt); toast('Copied. Paste it into WhatsApp or Notes.'); } catch (e) { openModal(`<div class="row between"><h2>Grocery list</h2><button class="iconbtn" data-a="close">✕</button></div><textarea rows="14">${esc(txt)}</textarea>`); }
};
A.tpl = el => { ctx.tpl = el.dataset.v; render(); };
A.slotDel = el => { if (confirm('Delete this meal from the plan?')) { S.templates[ctx.tpl].splice(+el.dataset.si, 1); save(); render(true); } };
A.slotAdd = () => { S.templates[ctx.tpl].push({ slot: 'New meal', items: [] }); save(); render(true); };
A.tItemDel = el => { S.templates[ctx.tpl][+el.dataset.si].items.splice(+el.dataset.ii, 1); save(); render(true); };
A.tItemAdd = el => { const si = +el.dataset.si; pickFood(`Add to ${S.templates[ctx.tpl][si].slot}`, id => { const it = { food: id, qty: 1 }; if (food(id).protein) it.alts = Object.keys(S.foods).filter(k => S.foods[k].protein); S.templates[ctx.tpl][si].items.push(it); save(); render(true); toast(`Added ${food(id).name}`); }); };
A.tItemFind = el => { const si = +el.dataset.si, ii = +el.dataset.ii; pickFood('Replace with…', id => { const it = S.templates[ctx.tpl][si].items[ii]; it.food = id; if (!food(id).protein) delete it.alts; save(); render(true); toast(`Changed to ${food(id).name}`); }); };
// shared food search (meal plan): built-in + my foods + online; picked food is saved to My foods
function pickFood(title, cb) {
  PF = { cb, q: '', online: [] };
  openModal(`<div class="row between"><h2 style="margin:0">${esc(title)}</h2><button class="iconbtn" data-a="close">✕</button></div><div class="searchbar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" id="pfQ" data-in="pfQ" placeholder="Search tilapia, adobo, oats, milk…" autocomplete="off"></div><div id="pfRes"></div>`);
  pfResults();
}
let PF = null;
function pfResults() {
  const box = $('#pfRes'); if (!box || !PF) return; const q = PF.q.trim(), { mine, db, fuzzy } = foodSearch(q); let list = [], h = '';
  const add = (t, arr) => { if (!arr.length) return; h += `<div class="sect">${t}</div>`; arr.forEach(it => { h += fRow(it, list.length).replace('data-a="flPick"', 'data-a="pfPick"'); list.push(it); }); };
  if (fuzzy && (mine.length || db.length)) h += `<div class="small muted" style="margin:8px 0">No exact match — closest foods:</div>`;
  add('My foods', mine.slice(0, q ? 15 : 60)); if (q) add('Food list', db.slice(0, 40)); add('Online', PF.online);
  if (q) h += `<button class="btn block" style="margin-top:6px" data-a="pfOnline" ${PF.loading ? 'disabled' : ''}>${PF.loading ? 'Searching online…' : `🔎 Search online for “${esc(q)}”`}</button>${PF.msg ? `<div class="small muted" style="margin-top:6px">${esc(PF.msg)}</div>` : ''}`;
  PF.list = list; box.innerHTML = h;
}
function toFoodId(it) {
  if (it.src === 'my') return it.id;
  const ex0 = Object.entries(S.foods).find(([, f]) => f.name.toLowerCase() === it.name.toLowerCase()); if (ex0) return ex0[0];
  let id = it.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24) || 'food'; while (S.foods[id]) id += '_';
  const prot = it.cat === 'Meat & fish' || (it.p >= 15 && it.p * 4 / Math.max(it.kcal, 1) > 0.3);
  S.foods[id] = { name: it.name, unit: it.g ? `${it.label} (${it.g} g)` : it.label, kcal: r1(it.kcal), p: r1(it.p), c: r1(it.c), f: r1(it.f), cat: it.cat === 'Other' ? 'Other' : it.cat || 'Other', buy: it.g ? { g: it.g } : { pcs: 1, label: 'pcs' }, gPer: it.g || undefined, protein: prot };
  return id;
}
A.pfPick = el => { const it = PF.list[+el.dataset.i], id = toFoodId(it), cb = PF.cb; save(); closeModal(); cb && cb(id); };
A.pfOnline = async () => {
  const q = PF.q.trim(); if (!q) return; if (!navigator.onLine) { PF.msg = 'No internet right now.'; return pfResults(); }
  PF.loading = true; PF.msg = ''; pfResults();
  const en = queryTerms(q).map(a => a.find(w => /^[a-z ]+$/.test(w) && !['bangus', 'liempo', 'manok', 'baboy', 'isda', 'prito', 'inihaw'].includes(w)) || a[0]).join(' ');
  const [u, o] = await Promise.allSettled([usdaSearch(en || q), offSearch(q)]);
  PF.online = [...(u.status === 'fulfilled' ? u.value : []), ...(o.status === 'fulfilled' ? o.value : [])];
  PF.msg = PF.online.length ? '' : 'Nothing found online. Add it yourself in Eat › My foods › + New.'; PF.loading = false; pfResults();
};
A.foodEdit = el => {
  const id = el.dataset.id, f = id ? S.foods[id] : { name: '', unit: '', kcal: 0, p: 0, c: 0, f: 0, cat: 'Other', buy: { pcs: 1, label: 'pcs' } };
  const bt = f.buy ? (f.buy.g ? 'g' : f.buy.ml ? 'ml' : 'pcs') : 'none', bv = f.buy ? (f.buy.g || f.buy.ml || f.buy.pcs || 1) : '';
  openModal(`<div class="row between"><h2>${id ? 'Edit food' : 'New food'}</h2><button class="iconbtn" data-a="close">✕</button></div>
  <label class="f">Name</label><input type="text" id="fName" value="${esc(f.name)}"><label class="f">Unit (what "1" means)</label><input type="text" id="fUnit" value="${esc(f.unit)}" placeholder="e.g. cup, piece, 100 g">
  <div class="grid2"><div><label class="f">Calories</label><input type="number" step="any" id="fK" value="${f.kcal}"></div><div><label class="f">Protein g</label><input type="number" step="any" id="fP" value="${f.p}"></div><div><label class="f">Carbs g</label><input type="number" step="any" id="fC" value="${f.c}"></div><div><label class="f">Fat g</label><input type="number" step="any" id="fF" value="${f.f}"></div></div>
  <label class="f">Grams in 1 unit (lets you log by grams — leave empty if unknown)</label><input type="number" step="any" id="fG" value="${f.gPer ?? ''}"><label class="f">Grocery category</label><input type="text" id="fCat" value="${esc(f.cat || '')}">
  <div class="grid2"><div><label class="f">Grocery list counts it in</label><select id="fBt"><option value="g" ${bt === 'g' ? 'selected' : ''}>grams</option><option value="ml" ${bt === 'ml' ? 'selected' : ''}>ml</option><option value="pcs" ${bt === 'pcs' ? 'selected' : ''}>pieces</option><option value="none" ${bt === 'none' ? 'selected' : ''}>don't list</option></select></div><div><label class="f">…per unit</label><input type="number" step="any" id="fBv" value="${bv}"></div></div>
  <label class="small muted cb"><input type="checkbox" id="fProt" ${f.protein ? 'checked' : ''}> Main protein (meat/fish) — can swap with chicken</label>
  <div class="row" style="margin-top:14px"><button class="btn primary" data-a="foodSave" data-id="${id}">Save</button>${id && !f.stock ? `<button class="btn danger" data-a="foodDel" data-id="${id}">Delete</button>` : ''}</div>`);
};
A.foodSave = el => {
  let id = el.dataset.id; const name = $('#fName').value.trim(); if (!name) return toast('Give it a name.');
  if (!id) { id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24) || 'food'; while (S.foods[id]) id += '_'; }
  const old = S.foods[id] || {}, bt = $('#fBt').value, bv = num($('#fBv').value) || 1;
  let buy = null; if (bt !== 'none') { buy = { [bt]: bv }; if (bt === 'pcs') buy.label = (old.buy && old.buy.label) || 'pcs'; if (old.buy && old.buy.per) { buy.per = old.buy.per; buy.perLabel = old.buy.perLabel; } if (old.buy && old.buy.note) buy.note = old.buy.note; }
  S.foods[id] = { ...old, name, unit: $('#fUnit').value.trim(), kcal: num($('#fK').value) || 0, p: num($('#fP').value) || 0, c: num($('#fC').value) || 0, f: num($('#fF').value) || 0, cat: $('#fCat').value.trim() || 'Other', buy, protein: $('#fProt').checked, gPer: num($('#fG').value) || undefined };
  if (S.foods[id].protein) for (const t of Object.values(S.templates)) for (const s of t) for (const it of s.items) if (it.alts && !it.alts.includes(id)) it.alts.push(id);
  save(); closeModal(); toast('Saved ✓'); render(true);
};
A.foodDel = el => {
  const id = el.dataset.id, used = Object.values(S.templates).some(t => t.some(s => s.items.some(i => i.food === id)));
  if (S.foods[id] && S.foods[id].stock) return toast('Supplements with a tub tracker can’t be deleted.');
  if (confirm(used ? `Delete "${food(id).name}"? It's in your meal plan — it will be removed from the plan too.` : `Delete "${food(id).name}" from your food list?`)) {
    for (const t of Object.values(S.templates)) for (const sl of t) sl.items = sl.items.filter(i => i.food !== id); delete S.foods[id]; for (const t of Object.values(S.templates)) for (const s of t) for (const it of s.items) if (it.alts) it.alts = it.alts.filter(a => a !== id); save(); closeModal(); render(true); }
};
A.saveCheckin = async () => {
  const date = $('#ciDate').value || today(), w = num($('#ciW').value), waist = num($('#ciWaist').value), neck = num($('#ciNeck').value);
  if (!w && !waist) return toast('Enter at least your weight or waist.');
  const c = { date, weight: w, waist, neck, shoulders: num($('#ciSh').value), chest: num($('#ciChest').value), arm: num($('#ciArm').value), bf: navyBF(waist, neck, S.profile.heightCm), photo: null };
  const file = $('#ciPhoto').files[0];
  if (file) { try { const data = await resizeImage(file); c.photo = 'p_' + date; await idb.put(c.photo, data); } catch (e) { toast('Could not read that photo.'); } }
  const prev = [...S.checkins].filter(x => x.date < date).pop();
  S.checkins = S.checkins.filter(x => x.date !== date).concat(c).sort((a, b) => a.date.localeCompare(b.date)); if (w) S.weights[date] = w;
  save(); ctx.adapt = prev ? adaptive(prev, c) : null; toast([c.bf ? `Body fat ≈ ${c.bf}%` : '', c.shoulders && waist ? `Shoulder:waist ${(c.shoulders / waist).toFixed(2)}` : ''].filter(Boolean).join(' · ') || 'Check-in saved ✓'); render(true);
};
A.applyAdapt = () => { S.profile.kcalOffset = (S.profile.kcalOffset || 0) + ctx.adapt.delta; ctx.adapt = null; save(); toast(`New target: ${targets().kcal} kcal`); render(true); };
A.skipAdapt = () => { ctx.adapt = null; render(true); };
A.delCheckin = async el => { if (!confirm('Delete this check-in?')) return; const c = S.checkins.find(x => x.date === el.dataset.d); if (c?.photo) await idb.del(c.photo); S.checkins = S.checkins.filter(x => x.date !== el.dataset.d); save(); render(true); };
A.resetOffset = () => { S.profile.kcalOffset = 0; save(); render(true); };
A.newTub = el => {
  const k = el.dataset.k, st = S.stock[k], unit = k === 'nitrotech' ? 'scoop' : 'serving';
  openModal(`<div class="row between"><h2 style="margin:0">New tub opened</h2><button class="iconbtn" data-a="close">✕</button></div><div class="small muted" style="margin:4px 0 8px">Enter what's printed on the tub — the app counts the ${unit}s for you.</div>
  <div class="grid2"><div><label class="f">Tub size</label><input type="number" inputmode="decimal" step="any" id="tubW" data-in="tub" value="${st.tubG >= 1000 ? r1(st.tubG / 1000) : st.tubG}"></div><div><label class="f">Unit</label><select id="tubU" data-c="tubU"><option value="kg" ${st.tubG >= 1000 ? 'selected' : ''}>kg</option><option value="g" ${st.tubG < 1000 ? 'selected' : ''}>g</option><option value="lb">lb</option></select></div>
  <div><label class="f">One ${unit} (g) — see label</label><input type="number" inputmode="decimal" step="any" id="tubS" data-in="tub" value="${st.scoopG}"></div><div><label class="f">Already used from it</label><input type="number" inputmode="numeric" id="tubUsed" data-in="tub" value="0"></div></div>
  <div class="calc" id="tubCalc"></div><button class="btn primary block big-btn" style="margin-top:12px" data-a="saveTub" data-k="${k}">Start new tub</button>`);
  I.tub();
};
function tubVals() { const w = num($('#tubW').value) || 0, u = $('#tubU').value, sg = num($('#tubS').value) || 0, used = num($('#tubUsed').value) || 0; const g = u === 'kg' ? w * 1000 : u === 'lb' ? w * 453.592 : w; return { g: Math.round(g), sg, used, n: sg > 0 ? Math.floor(g / sg) : 0 }; }
A.saveTub = el => { const v = tubVals(); if (!v.n) return toast('Enter the tub size and serving size.'); const k = el.dataset.k, st = S.stock[k], rec = S.days[today()]; let doneToday = 0; if (rec) { for (const x of Object.values(rec.items)) if (x.done && food(x.food).stock === k) doneToday += x.qty; for (const e of rec.extras || []) if (e.food && food(e.food).stock === k) doneToday += e.qty; } Object.assign(st, { tubG: v.g, scoopG: v.sg, size: v.n, start: today(), adj: doneToday - v.used }); save(); closeModal(); toast(`New tub: ${v.n - v.used} servings left`); render(true); };
A.adjStock = el => { const k = el.dataset.k, si = stockInfo(k), n = num(prompt('How many servings are actually left in the tub?', si.left)); if (n == null) return; S.stock[k].adj = (S.stock[k].adj || 0) + (n - si.left); save(); render(true); };
A.addQuote = () => { const q = $('#qText').value.trim(); if (!q) return toast('Type the quote first.'); S.myQuotes.push({ q, a: $('#qAuthor').value.trim() }); save(); toast('Quote saved ✓'); render(true); };
A.delQuote = el => { S.myQuotes.splice(+el.dataset.i, 1); save(); render(true); };
A.exportPDF = () => exportPDF().catch(e => { console.error(e); toast('Backup failed: ' + e.message); });
A.restore = () => restorePDF().catch(e => { console.error(e); toast('Restore failed: ' + e.message); });
A.wipe = async () => { if (!confirm('Erase all data on THIS device? (Cloud data stays if you are signed in.)')) return; localStorage.removeItem(KEY); localStorage.removeItem(META_KEY); await idb.clear(); location.reload(); };
A.syncNow = async () => { toast('Syncing…'); Sync.markChanges(); await Sync.pull(); await Sync.push(); toast(Sync.err ? 'Sync problem: ' + Sync.err : 'Synced ✓'); render(true); };
A.logout = () => { if (!confirm('Sign out? You will need your password to open the app again.')) return; Sync.signOut(); };
A.pwReset = async () => { try { await Sync.resetPassword(Sync.user.email); toast('Password reset email sent — check your inbox.'); } catch (e) { toast('Could not send email: ' + (e.code || e.message)); } };
A.login = async () => {
  const email = $('#lgEmail').value.trim(), pw = $('#lgPw').value, err = $('#lgErr'); if (!email || !pw) { err.textContent = 'Enter your email and password.'; return; }
  if (!navigator.onLine) { err.textContent = 'No internet connection — connect once to sign in.'; return; }
  err.textContent = 'Signing in…';
  try { await Sync.signIn(email, pw); err.textContent = ''; Sync.afterLogin(); }
  catch (e) { const m = { INVALID_LOGIN_CREDENTIALS: 'Wrong email or password.', INVALID_PASSWORD: 'Wrong password.', EMAIL_NOT_FOUND: 'No account with this email — add it in Firebase › Authentication › Users.', USER_DISABLED: 'This account is disabled.', TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many tries — wait a few minutes.', OPERATION_NOT_ALLOWED: 'Email/Password sign-in is not enabled in Firebase › Authentication.', CONFIGURATION_NOT_FOUND: 'Authentication is not set up in Firebase yet (Authentication › Get started).' }; err.textContent = m[e.code] || ('Could not sign in: ' + e.message); }
};
A.forgot = async () => { const email = $('#lgEmail').value.trim(); if (!email) return; try { await Sync.resetPassword(email); $('#lgErr').textContent = 'Reset email sent — check your inbox.'; } catch (e) { $('#lgErr').textContent = e.message; } };
A.onboardSave = () => { const w = num($('#obW').value), age = num($('#obAge').value), h = num($('#obH').value); if (age) S.profile.age = age; if (h) S.profile.heightCm = h; if (w) S.weights[today()] = w; S.profile.onboarded = true; save(); closeModal(); render(); };

C.setW = el => { S.sessions[ctx.date].entries[+el.dataset.i].sets[+el.dataset.j].w = num(el.value) ?? ''; save(); };
C.setR = el => { S.sessions[ctx.date].entries[+el.dataset.i].sets[+el.dataset.j].r = num(el.value) ?? ''; save(); };
C.steps = el => { const r = dayRec(el.dataset.d, true); r.steps = num(el.value); r.stepsAt = null; save(); render(true); };
C.weighin = el => { const v = num(el.value); if (v) S.weights[el.dataset.d] = v; else delete S.weights[el.dataset.d]; save(); };
C.swapFood = el => { const rec = dayRec(el.dataset.d, true), it = dayItems(el.dataset.d).find(i => i.key === el.dataset.k); rec.items[el.dataset.k] = { food: el.value, qty: it.qty, done: it.done }; save(); render(true); };
C.pickDay = el => { if (el.value === '') return; const d = el.dataset.d, k = +el.value; dayPick[d] = k; if (S.sessions[d] && !S.sessions[d].entries.some(e => e.sets.some(z => z.done))) delete S.sessions[d]; render(true); toast(`${fmtD(d)}: ${S.program.days[k].name}`); };
C.dayName = el => { S.program.days[el.dataset.k].name = el.value; save(); };
C.dayType = el => { S.program.days[el.dataset.k].type = el.value; save(); render(true); };
C.pItem = el => { const v = num(el.value); if (v) S.program.days[el.dataset.k].items[+el.dataset.i][el.dataset.f] = Math.round(v); save(); };
C.pSS = el => { S.program.days[el.dataset.k].items[+el.dataset.i].ss = el.checked; save(); render(true); };
C.deloadEvery = el => { S.program.deloadEvery = Math.max(0, Math.round(num(el.value) || 0)); save(); };
C.slotName = el => { S.templates[ctx.tpl][+el.dataset.si].slot = el.value; save(); };
C.tItemFood = el => { const it = S.templates[ctx.tpl][+el.dataset.si].items[+el.dataset.ii]; it.food = el.value; if (!food(el.value).protein) delete it.alts; save(); render(true); };
C.tItemQty = el => { S.templates[ctx.tpl][+el.dataset.si].items[+el.dataset.ii].qty = num(el.value) || 0; save(); render(true); };
C.tItemAlt = el => { const it = S.templates[ctx.tpl][+el.dataset.si].items[+el.dataset.ii]; if (el.checked) it.alts = Object.keys(S.foods).filter(k => S.foods[k].protein); else delete it.alts; save(); };
C.liftEx = el => { ctx.liftEx = el.value; render(true); };
C.prof = el => { const f = el.dataset.f; S.profile[f] = f === 'goal' ? el.value : num(el.value); save(); render(true); };
C.ovr = el => { S.overrides[el.dataset.f] = num(el.value); save(); render(true); };
C.set = el => { const v = num(el.value); if (v) S.settings[el.dataset.f] = v; save(); };
A.ciEvery = el => { S.settings.checkinDays = +el.dataset.v; save(); render(true); };
A.theme = el => { S.settings.theme = el.dataset.v; applyTheme(); save(); render(true); };
C.waterGoal = el => { S.settings.waterGoalL = num(el.value) || null; save(); render(true); };
C.waterHr = el => { const st = S.settings; st[el.dataset.f] = +el.value; if (st.waterTo <= st.waterFrom) { if (el.dataset.f === 'waterFrom') st.waterTo = Math.min(24, st.waterFrom + 1); else st.waterFrom = Math.max(0, st.waterTo - 1); toast('"Until" must be after "From" — adjusted.'); A.waterSet(); } save(); render(true); };
C.tgl = el => { S.settings[el.dataset.f] = el.checked; save(); if (el.dataset.f === 'notify' && el.checked && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); };
C.sound = el => { S.settings.sound = el.checked; save(); };
I.tub = () => { const v = tubVals(), c = $('#tubCalc'); if (c) c.innerHTML = v.n ? `<b>${v.n - v.used}</b><span class="small">${v.n} servings in the tub${v.used ? ` − ${v.used} used` : ''} (${v.g} g ÷ ${v.sg} g)</span>` : '<span class="small muted">Enter tub size and serving size</span>'; };
C.tubU = () => I.tub();
C.stock = el => { const st = S.stock[el.dataset.k]; st[el.dataset.f] = el.dataset.f === 'start' ? el.value : (num(el.value) || st.size); save(); render(true); };
C.flMeal = el => { FL.meal = el.value; };
I.flQ = el => { FL.q = el.value; FL.off = []; FL.usda = []; FL.onlineMsg = ''; if ($('#flSel').innerHTML) { FL.sel = null; $('#flSel').innerHTML = ''; $('#flBrowse').classList.remove('hidden'); } clearTimeout(I._t); I._t = setTimeout(flResults, 120); };
I.flAmt = el => { FL.amt = el.value; const t = $('#flTiles'); if (t) t.innerHTML = flTiles(); };
I.pfQ = el => { if (!PF) return; PF.q = el.value; PF.online = []; PF.msg = ''; clearTimeout(I._pf); I._pf = setTimeout(pfResults, 120); };
I.xQ = el => { pickExercise.q = el.value; clearTimeout(I._x); I._x = setTimeout(pickResults, 120); };

// program actions
A.programs = () => {
  const list = window.PROGRAMS, cur = curPid(), rec = rankedPrograms()[0];
  openModal(`<div class="row between"><h2 style="margin:0">Programs</h2><button class="iconbtn" data-a="close">✕</button></div><div class="small muted" style="margin:4px 0 10px">All fit your gym (dumbbells, Smith machine, lat pulldown, leg machines) and your V-taper goal. Your history and progress carry over.</div>` +
    list.map(p => { const st = progStats(p.program); return `<div class="daycard ${p.id === cur ? 'on' : ''}" data-a="programPreview" data-id="${p.id}"><div class="dl">${st.gym}×</div><div class="grow"><b>${esc(p.name)}</b>${p.id === cur ? ' <span class="pill acc">Current</span>' : rec && p.id === rec.id ? ' <span class="pill good">Recommended</span>' : ''}<div class="tiny muted">${esc(p.when)} · ~${st.min} min · back ${st.back} · shoulders ${st.delts} sets/wk</div></div><span class="chev">›</span></div>`; }).join('') +
    ((S.savedPrograms || []).length ? `<div class="sect">Your previous programs</div>` + S.savedPrograms.map((sp, i) => `<div class="daycard" data-a="programRestore" data-i="${i}"><div class="dl">↶</div><div class="grow"><b>${esc(sp.name)}</b><div class="tiny muted">used until ${fmtD(sp.savedAt)}</div></div><span class="btn sm">Restore</span></div>`).join('') : ''));
};
A.programPreview = el => {
  const p = window.PROGRAMS.find(x => x.id === el.dataset.id), st = progStats(p.program), cur = progStats(S.program);
  openModal(`<div class="row between"><h2 style="margin:0">${esc(p.name)}</h2><button class="iconbtn" data-a="programs" aria-label="Back">‹</button></div><div class="small muted" style="margin:4px 0 10px">${esc(p.blurb)}</div>
  <div class="kpis"><div class="kpi"><b>${st.gym}</b><span>gym days (now ${cur.gym})</span></div><div class="kpi"><b>~${st.min}</b><span>min per session</span></div><div class="kpi"><b>${st.back}</b><span>back sets/wk (now ${cur.back})</span></div><div class="kpi"><b>${st.delts}</b><span>shoulder sets/wk (now ${cur.delts})</span></div></div>` +
    [1, 2, 3, 4, 5, 6, 0].map(k => { const d = p.program.days[k]; return `<div class="check"><b style="width:40px">${DN[k]}</b><div class="grow"><b>${esc(d.name)}</b>${d.items.length ? `<div class="tiny muted">${d.items.map(i => `${esc(ex(i.ex).name)} ${i.sets}×${i.min}–${i.max}`).join(' · ')}</div>` : ''}</div></div>`; }).join('') +
    (p.id === curPid() ? '<div class="sug">This is your current program.</div>' : `<button class="btn primary block big-btn" style="margin-top:12px" data-a="programUse" data-id="${p.id}">Switch to this program</button><div class="tiny faint" style="margin-top:6px">Starts this week. Today's workout updates if you haven't started it. You can switch back any time.</div>`));
};
A.programUse = el => { const p = window.PROGRAMS.find(x => x.id === el.dataset.id); if (!confirm(`Switch to ${p.name}? Your current split is saved so you can switch back.`)) return; useProgram(p.program, p.id, p.name); };
A.programRestore = el => { const sp = S.savedPrograms[+el.dataset.i]; if (!confirm(`Switch back to ${sp.name}?`)) return; useProgram(sp.program, sp.tid, sp.name); };

// meal calculator actions
I.cQ = el => { clearTimeout(I._c); I._c = setTimeout(() => calcResults(el.value), 120); };
A.calcAdd = () => calcPick();
A.calcPicked = el => { const it = calcPick.list[+el.dataset.i]; CALC.items.push({ name: it.name, label: it.label, g: it.g || null, kcal: it.kcal, p: it.p, c: it.c, f: it.f, mode: it.g ? 'g' : 'srv', amt: it.g || 1 }); saveCalc(); closeModal(); render(true); toast('Added — now set the amount'); };
A.calcManual = () => { $('#cRes').innerHTML = `<div class="fdetail"><label class="f">Name</label><input type="text" id="cmN"><div class="tiny muted" style="margin-top:6px">Values for the whole amount you are adding:</div><div class="grid2"><div><label class="f">Calories</label><input type="number" id="cmK"></div><div><label class="f">Protein g</label><input type="number" id="cmP"></div><div><label class="f">Carbs g</label><input type="number" id="cmC"></div><div><label class="f">Fat g</label><input type="number" id="cmF"></div></div><button class="btn primary block" style="margin-top:10px" data-a="calcManualSave">Add</button></div>`; };
A.calcManualSave = () => { const it = { name: $('#cmN').value.trim() || 'Ingredient', label: 'amount', g: null, kcal: num($('#cmK').value) || 0, p: num($('#cmP').value) || 0, c: num($('#cmC').value) || 0, f: num($('#cmF').value) || 0, mode: 'srv', amt: 1 }; CALC.items.push(it); saveCalc(); closeModal(); render(true); };
A.calcDel = el => { CALC.items.splice(+el.dataset.i, 1); saveCalc(); render(true); };
A.calcPort = el => { CALC.portions = Math.max(1, (num(CALC.portions) || 1) + +el.dataset.n); saveCalc(); render(true); };
A.calcClear = () => { if (!confirm('Clear the calculator?')) return; CALC = { name: '', portions: 1, items: [] }; saveCalc(); render(); };
A.calcLog = () => { const t = calcTotals(), n = Math.max(1, num(CALC.portions) || 1); dayRec(today(), true).extras.push({ name: CALC.name || 'Calculated meal', kcal: t.kcal / n, p: t.p / n, c: t.c / n, f: t.f / n, amt: n > 1 ? `1 of ${n} containers` : '1 meal', meal: mealNow() }); save(); toast(`Logged ${Math.round(t.kcal / n)} kcal, ${Math.round(t.p / n)} g protein`); };
A.calcSave = () => {
  const t = calcTotals(), n = Math.max(1, num(CALC.portions) || 1), name = (CALC.name || '').trim() || prompt('Name for this meal?', 'Meal prep'); if (!name) return;
  let id = 'meal_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20); while (S.foods[id]) id += '_';
  S.foods[id] = { name, unit: n > 1 ? '1 container' : '1 meal', kcal: r1(t.kcal / n), p: r1(t.p / n), c: r1(t.c / n), f: r1(t.f / n), cat: 'Meals', buy: null };
  save(); toast(`Saved "${name}" to My foods — log it any time with +`);
};
C.calcName = el => { CALC.name = el.value; saveCalc(); };
C.calcAmt = el => { CALC.items[+el.dataset.i].amt = num(el.value) || 0; saveCalc(); render(true); };
C.calcMode = el => { const it = CALC.items[+el.dataset.i]; if (it.mode === el.value) return; it.mode = el.value; it.amt = el.value === 'g' ? it.g : 1; saveCalc(); render(true); };

document.addEventListener('click', ev => { const el = ev.target.closest('[data-a]'); if (!el) { if (ev.target.id === 'modal') closeModal(); return; } const fn = A[el.dataset.a]; if (fn) { ev.preventDefault(); fn(el, ev); } });
document.addEventListener('change', ev => { const el = ev.target.closest('[data-c]'); if (el && C[el.dataset.c]) C[el.dataset.c](el); });
document.addEventListener('input', ev => { const el = ev.target.closest('[data-in]'); if (el && I[el.dataset.in]) I[el.dataset.in](el); });
document.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.id === 'lgPw') A.login(); if (ev.key === 'Enter' && ev.target.id === 'gxName') A.gxAdd(); });

// ---------- PDF backup ----------
function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { s.remove(); rej(new Error('could not load ' + src)); }; document.head.appendChild(s); }); }
const bytesToB64 = b => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const b64ToBytes = b64 => { const s = atob(b64), o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; };
const MARK_A = '%GHERWIN-FITNESS-DATA-BEGIN', MARK_B = '%GHERWIN-FITNESS-DATA-END';
async function exportPDF() {
  toast('Building backup…', 8000); await loadScript('lib/pdf-lib.min.js');
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib, doc = await PDFDocument.create();
  doc.setTitle('Gherwin Fitness backup ' + today()); doc.setAuthor('Gherwin Fitness'); doc.setCreator('Gherwin Fitness');
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold), W = 595, H = 842, M = 46; let page, y;
  const clean = t => String(t).replace(/≈/g, '~').replace(/→/g, '->').replace(/[✓✔]/g, 'ok').replace(/[−]/g, '-').replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, '');
  const newPage = () => { page = doc.addPage([W, H]); y = H - M; }, ensure = h => { if (y - h < M) newPage(); };
  const text = (t, o = {}) => { const size = o.size || 10, f = o.bold ? bold : font, maxW = W - 2 * M - (o.x || 0); let line = ''; const flush = () => { ensure(size + 4); page.drawText(line, { x: M + (o.x || 0), y: y - size, size, font: f, color: o.color || rgb(0.12, 0.13, 0.15) }); y -= size + (o.gap ?? 4); line = ''; }; for (const w of clean(t).split(' ')) { const t2 = line ? line + ' ' + w : w; if (f.widthOfTextAtSize(t2, size) > maxW && line) { flush(); line = w; } else line = t2; } if (line) flush(); };
  const head = t => { y -= 8; ensure(30); page.drawRectangle({ x: M, y: y - 20, width: W - 2 * M, height: 22, color: rgb(0.96, 0.70, 0.004) }); page.drawText(clean(t), { x: M + 8, y: y - 15, size: 12, font: bold, color: rgb(0.07, 0.09, 0.11) }); y -= 30; };
  const table = (cols, rows, widths) => { const draw = (cells, b) => { ensure(16); let x = M; cells.forEach((c, i) => { page.drawText(clean(c).slice(0, 60), { x: x + 2, y: y - 11, size: 9, font: b ? bold : font, color: rgb(0.12, 0.13, 0.15) }); x += widths[i]; }); y -= 15; }; draw(cols, true); rows.forEach(r => draw(r)); };
  newPage();
  try { const img = await doc.embedPng(await (await fetch('icons/icon-192.png')).arrayBuffer()); page.drawImage(img, { x: M, y: H - M - 48, width: 48, height: 48 }); } catch (e) {}
  page.drawText('Gherwin Fitness - backup', { x: M + 60, y: H - M - 22, size: 18, font: bold }); page.drawText(clean(`Created ${fmtDY(today())}. Restore: open the app > Me > Account & backup > pick this PDF.`), { x: M + 60, y: H - M - 40, size: 9, font, color: rgb(0.4, 0.42, 0.45) });
  y = H - M - 64; const T = targets(), p = S.profile, g = growth();
  head('Profile & daily targets'); text(`Age ${p.age} · Height ${p.heightCm} cm · Current weight ${r1(T.w)} kg · Goal: ${GOALS[p.goal]}`); text(`Targets: ${T.kcal} kcal · Protein ${T.protein} g · Carbs ${T.carbs} g · Fat ${T.fat} g (${T.formula}, maintenance ${T.tdee} kcal)`);
  head('Am I growing?'); text(`${g.head}: ${g.line}`, { bold: true }); text(g.tiles.map(t => `${t.label} ${t.val} (${t.sub})`).join(' · ')); g.tips.forEach(t => text('• ' + t, { x: 8, size: 9 }));
  head('Check-ins'); if (S.checkins.length) table(['Date', 'Weight', 'Waist', 'Neck', 'Chest', 'Arm', 'Body fat'], S.checkins.map(c => [fmtDY(c.date), c.weight ?? '-', c.waist ?? '-', c.neck ?? '-', c.chest ?? '-', c.arm ?? '-', c.bf != null ? c.bf + '%' : '-']), [90, 70, 70, 60, 60, 60, 80]); else text('No check-ins yet.');
  head('Personal records (best estimated 1-rep max)');
  const prRows = usedExIds().map(id => ({ id, h: exHistory(id) })).filter(x => x.h.length).map(({ id, h }) => { const b = h.reduce((a, x) => (x.best > a.best ? x : a)), top = b.sets.reduce((a, s) => (e1rm(s.w, s.r) > e1rm(a.w, a.r) ? s : a)); return [ex(id).name, top.w ? `${r1(top.w)} kg x ${top.r}` : `BW x ${top.r}`, r1(b.best), fmtDY(b.date), h.length]; });
  if (prRows.length) table(['Exercise', 'Best set', 'e1RM', 'Date', 'Sessions'], prRows, [190, 90, 60, 90, 60]); else text('No lifts logged yet.');
  head('Runs'); if (S.runs.length) table(['Date', 'Distance', 'Time', 'Pace /km', 'Type'], [...S.runs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40).map(r => [fmtDY(r.date), r.km + ' km', fmtTime(r.sec), fmtTime(r.sec / r.km), r.type]), [100, 80, 80, 80, 100]); else text('No runs yet.');
  head('Weekly split'); for (const k of [1, 2, 3, 4, 5, 6, 0]) { const d = S.program.days[k]; text(`${DNL[k]} - ${d.name}`, { bold: true, gap: 2 }); if (d.items.length) text(d.items.map(i => `${ex(i.ex).name} ${i.sets}x${i.min}-${i.max}`).join('; '), { x: 10, size: 9 }); }
  head('Meal plan'); for (const key of ['weekday', 'weekend']) { text(key === 'weekday' ? 'Weekday (Mon-Fri)' : 'Weekend (Sat-Sun)', { bold: true, gap: 2 }); for (const s of S.templates[key]) text(`${s.slot}: ${s.items.map(i => `${i.qty} x ${food(i.food).name}`).join(', ')}`, { x: 10, size: 9 }); }
  head('Recent workouts'); const recent = Object.keys(S.sessions).sort().reverse().slice(0, 12);
  if (recent.length) for (const d of recent) { const s = S.sessions[d]; text(`${fmtDY(d)} - ${s.name}${s.done ? '' : ' (not finished)'}`, { bold: true, gap: 2 }); text(s.entries.map(e => `${ex(e.ex).name}: ${e.sets.filter(x => x.done).map(x => (x.w ? x.w + 'x' : 'BWx') + x.r).join(', ') || '-'}`).join(' | '), { x: 10, size: 8 }); } else text('No workouts logged yet.');
  y -= 10; text('This PDF also contains your full app data (hidden). Keep it safe - it is your restore file.', { size: 8, color: rgb(0.45, 0.47, 0.5) });
  const pdfBytes = await doc.save(), photos = await idb.all();
  const tail = new TextEncoder().encode(`\n${MARK_A}\n${bytesToB64(new TextEncoder().encode(JSON.stringify({ app: 'gherwin-fitness', v: 2, exported: new Date().toISOString(), data: S, photos })))}\n${MARK_B}\n`);
  const all = new Uint8Array(pdfBytes.length + tail.length); all.set(pdfBytes, 0); all.set(tail, pdfBytes.length);
  const name = `Gherwin-Fitness-backup-${today()}.pdf`, blob = new Blob([all], { type: 'application/pdf' });
  S.lastBackup = today(); save();
  const file = new File([blob], name, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); toast('Backup ready.'); render(true); return; } catch (e) { if (e.name === 'AbortError') { render(true); return; } } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Backup PDF saved to your downloads.'); render(true);
}
function extractBackup(buf) {
  const bytes = new Uint8Array(buf); let str = ''; for (let i = 0; i < bytes.length; i += 0x8000) str += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const a = str.lastIndexOf(MARK_A), b = str.lastIndexOf(MARK_B); if (a < 0 || b < a) throw new Error('This PDF has no Gherwin Fitness data inside.');
  const obj = JSON.parse(new TextDecoder().decode(b64ToBytes(str.slice(a + MARK_A.length, b).trim()))); if (obj.app !== 'gherwin-fitness' || !obj.data) throw new Error('Not a Gherwin Fitness backup.');
  return obj;
}
async function restorePDF() {
  const f = $('#restoreFile').files[0]; if (!f) return toast('Pick the backup PDF first.');
  const obj = extractBackup(await f.arrayBuffer()); if (!confirm(`Restore backup from ${fmtDY(obj.exported.slice(0, 10))}? This replaces all current data.`)) return;
  S = obj.data; normalize(); Sync.meta.hash = {}; save(); buildEx(); await idb.clear(); for (const [k, v] of Object.entries(obj.photos || {})) await idb.put(k, v);
  toast('Backup restored.'); route = { tab: 'today', sub: {} }; render();
}
window.__gf = { extractBackup, targets, suggest, stockInfo, groceryWeek, adaptive, navyBF, closeGap, growth, foodSearch, get S() { return S; }, get P() { return P; }, EX };

// ---------- start ----------
function stepsFromUrl() {
  const q = new URLSearchParams(location.search), v = q.get('steps'); if (v == null) return;
  const n = Math.round(num(v.replace(/[^0-9.]/g, '')) || 0), d = /^\d{4}-\d{2}-\d{2}$/.test(q.get('date') || '') ? q.get('date') : today();
  history.replaceState(null, '', location.pathname);
  if (!n) return; const r = dayRec(d, true); r.steps = n; r.stepsAt = new Date().toTimeString().slice(0, 5); save(); Sync.push(); toast(`Steps updated: ${n.toLocaleString()}`); render(true);
}
function startApp() {
  if (Sync.started) return; Sync.started = true;
  applyTheme(); buildEx(); render(); stepsFromUrl();
  { const a = new URLSearchParams(location.search).get('action'); if (a) { history.replaceState(null, '', location.pathname); if (a === 'resume' || a === 'start') { const d = today(); if (S.sessions[d] && !S.sessions[d].done) setTimeout(() => openPlayer(d), 300); } else if (a === 'water250' || a === 'waterBottle') noteAction(a); } setTimeout(waterTick, 3000); }
  if (!S.profile.onboarded) openModal(`<div style="text-align:center"><img src="icons/icon-192.png" alt="" style="width:72px;border-radius:16px"><h2>Welcome, Gherwin</h2><div class="small muted">Your plan is ready: 6-day split, recomp nutrition, Sunday grocery list. Confirm a few numbers.</div></div>
  <div class="grid3" style="margin-top:12px"><div><label class="f">Age</label><input type="number" id="obAge" value="${S.profile.age}"></div><div><label class="f">Height (cm)</label><input type="number" id="obH" value="${S.profile.heightCm}"></div><div><label class="f">Today's weight</label><input type="number" step="0.1" inputmode="decimal" id="obW" placeholder="kg"></div></div>
  <div class="small faint" style="margin-top:6px">Don't know today's weight? Leave it empty — the app uses 73 kg until you log one.</div><button class="btn primary block" style="margin-top:14px" data-a="onboardSave">Let's go</button>`);
}
load();
let lastDay = today();
setInterval(() => { if (today() !== lastDay) { lastDay = today(); if (ctx.date < lastDay) ctx.date = lastDay; if (ctx.eatDate < lastDay) ctx.eatDate = lastDay; if (!P && $('#modal').classList.contains('hidden')) { const ae = document.activeElement; if (!ae || !/INPUT|SELECT|TEXTAREA/.test(ae.tagName)) render(true); } } }, 60000);
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller; let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController || reloading) return; reloading = true; const go = () => { if (P) return setTimeout(go, 5000); location.reload(); }; go(); });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
Sync.init();
})();
