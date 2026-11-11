// Lớp dữ liệu: IndexedDB + bộ nhớ đệm trong RAM. Mọi view đọc từ S, ghi qua các hàm bên dưới.
import { SEED_VOCAB, SEED_CATS } from './data/vocab.js';
import { SEED_GRAMMAR } from './data/grammar.js';

export const DEFAULTS = {
  theme: 'auto', showRoman: true,
  newPerDay: 10, reviewPerDay: 20, grammarPerWeek: 10,
  voiceURI: '', aiProvider: 'anthropic', aiKey: '', aiModel: 'claude-opus-5-5',
};

export const S = { vocab: [], grammar: [], cats: [], srs: {}, reviews: [], settings: { ...DEFAULTS } };

let idb;
const STORES = { vocab: 'id', grammar: 'id', cats: 'id', srs: 'key', reviews: 'id', kv: 'k' };

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('korean-vocab-master', 1);
    r.onupgradeneeded = () => {
      for (const [name, keyPath] of Object.entries(STORES))
        r.result.createObjectStore(name, { keyPath, autoIncrement: name === 'reviews' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function run(store, mode, fn) {
  return new Promise((res, rej) => {
    const t = idb.transaction(store, mode);
    const q = fn(t.objectStore(store));
    t.oncomplete = () => res(q && q.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
const all = (s) => run(s, 'readonly', (o) => o.getAll());
const put = (s, v) => run(s, 'readwrite', (o) => o.put(v));
const del = (s, k) => run(s, 'readwrite', (o) => o.delete(k));
const putMany = (s, arr) => run(s, 'readwrite', (o) => { arr.forEach((v) => o.put(v)); });
const clear = (s) => run(s, 'readwrite', (o) => o.clear());

export const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function dayStr(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return dayStr(new Date(y, m - 1, d + n));
}

async function load() {
  const [vocab, grammar, cats, srs, reviews, kv] = await Promise.all(Object.keys(STORES).map(all));
  S.vocab = vocab; S.grammar = grammar; S.cats = cats; S.reviews = reviews;
  S.srs = Object.fromEntries(srs.map((c) => [c.key, c]));
  S.settings = { ...DEFAULTS, ...Object.fromEntries(kv.map((r) => [r.k, r.v])) };
}

export async function init() {
  idb = await open();
  await load();
  if (!S.settings.seeded) {
    await putMany('cats', SEED_CATS);
    await putMany('vocab', SEED_VOCAB);
    await putMany('grammar', SEED_GRAMMAR);
    await put('kv', { k: 'seeded', v: 1 });
    await load();
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

export async function setSetting(k, v) { S.settings[k] = v; await put('kv', { k, v }); }

function upsert(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item; else list.push(item);
}
export async function saveVocab(w) { upsert(S.vocab, w); await put('vocab', w); }
export async function deleteVocab(id) {
  S.vocab = S.vocab.filter((w) => w.id !== id);
  delete S.srs['v:' + id];
  await del('vocab', id); await del('srs', 'v:' + id);
}
export async function saveGrammar(g) { upsert(S.grammar, g); await put('grammar', g); }
export async function deleteGrammar(id) {
  S.grammar = S.grammar.filter((g) => g.id !== id);
  delete S.srs['g:' + id];
  await del('grammar', id); await del('srs', 'g:' + id);
}
export async function saveCat(c) { upsert(S.cats, c); await put('cats', c); }
export async function deleteCat(id) {
  S.cats = S.cats.filter((c) => c.id !== id);
  await del('cats', id);
  const touched = S.vocab.filter((w) => (w.cats || []).includes(id));
  touched.forEach((w) => { w.cats = w.cats.filter((c) => c !== id); });
  if (touched.length) await putMany('vocab', touched);
}
export async function saveCard(card) { S.srs[card.key] = card; await put('srs', card); }
export async function logReview(r) {
  const id = await run('reviews', 'readwrite', (o) => o.add(r));
  S.reviews.push({ ...r, id });
}

// ---- Sao lưu / khôi phục (không bao gồm khóa API) ----
export function exportBackup() {
  const settings = { ...S.settings }; delete settings.aiKey;
  return { app: 'korean-vocab-master', version: 1, exportedAt: new Date().toISOString(),
    vocab: S.vocab, grammar: S.grammar, cats: S.cats, srs: Object.values(S.srs), reviews: S.reviews, settings };
}
export async function importBackup(data) {
  if (!data || data.app !== 'korean-vocab-master' || !Array.isArray(data.vocab)) throw new Error('Tệp sao lưu không hợp lệ');
  const key = S.settings.aiKey;
  for (const s of Object.keys(STORES)) await clear(s);
  await putMany('vocab', data.vocab);
  await putMany('grammar', data.grammar || []);
  await putMany('cats', data.cats || []);
  await putMany('srs', data.srs || []);
  await putMany('reviews', (data.reviews || []).map(({ id, ...r }) => r));
  const st = { ...(data.settings || {}), seeded: 1 }; if (key) st.aiKey = key;
  await putMany('kv', Object.entries(st).map(([k, v]) => ({ k, v })));
  await load();
}
export async function resetAll() {
  for (const s of Object.keys(STORES)) await clear(s);
  S.settings = { ...DEFAULTS };
  await init();
}

// ---- Thống kê ----
export function todayStats() {
  const t = dayStr();
  const rs = S.reviews.filter((r) => r.day === t);
  return {
    newWords: new Set(rs.filter((r) => r.isNew && r.key[0] === 'v').map((r) => r.key)).size,
    reviewed: rs.filter((r) => !r.isNew).length,
    total: rs.length,
  };
}
export function grammarThisWeek() {
  const now = new Date();
  const monday = dayStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)));
  return S.grammar.filter((g) => g.learnedAt && g.learnedAt >= monday).length;
}
export function streak() {
  const days = new Set(S.reviews.map((r) => r.day));
  let d = dayStr();
  if (!days.has(d)) d = addDays(d, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
