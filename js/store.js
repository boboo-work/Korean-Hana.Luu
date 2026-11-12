// Lớp dữ liệu: IndexedDB + bộ nhớ đệm trong RAM. Mọi view đọc từ S, ghi qua các hàm bên dưới.
import { SEED_VOCAB, SEED_CATS } from './data/vocab.js';
import { SEED_GRAMMAR } from './data/grammar.js';

export const DEFAULTS = {
  theme: 'auto', showRoman: true, autoSpeak: true,
  newPerDay: 10, reviewPerDay: 20, grammarPerWeek: 10,
  voiceURI: '', aiProvider: 'anthropic', aiKey: '', aiModel: 'claude-opus-5-5',
};

export const S = { vocab: [], grammar: [], cats: [], srs: {}, reviews: [], settings: { ...DEFAULTS } };

let idb;
const SEED_VERSION = 2;
const SEED_PATCH = new Set(['g-001', 'g-025', 'g-026', 'g-027']); // mục ngữ pháp mẫu đổi cấp độ / mô tả ở bản 2
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
    await put('kv', { k: 'seedVersion', v: SEED_VERSION });
    await load();
  }
  if ((S.settings.seedVersion || 1) < SEED_VERSION) await migrateSeed();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// Cập nhật nội dung mẫu đã sửa lỗi cho người dùng cũ, giữ nguyên tiến độ và mục tự thêm.
async function migrateSeed() {
  for (const seed of SEED_GRAMMAR) {
    const cur = S.grammar.find((g) => g.id === seed.id);
    if (!cur) continue;
    cur.quiz = seed.quiz;
    if (SEED_PATCH.has(seed.id)) { cur.level = seed.level; cur.topik = seed.topik; cur.mistakes = seed.mistakes; }
    await put('grammar', cur);
  }
  await setSetting('seedVersion', SEED_VERSION);
}

export const reload = () => load();
export const freshCard = (key) => run('srs', 'readonly', (o) => o.get(key));

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
  const settings = { ...S.settings }; delete settings.aiKey; delete settings.tutorHistory;
  return { app: 'korean-vocab-master', version: 1, exportedAt: new Date().toISOString(),
    vocab: S.vocab, grammar: S.grammar, cats: S.cats, srs: Object.values(S.srs), reviews: S.reviews, settings };
}
export async function importBackup(data) {
  if (!data || data.app !== 'korean-vocab-master' || !Array.isArray(data.vocab)) throw new Error('Tệp sao lưu không hợp lệ');
  // Kiểm tra toàn bộ tệp TRƯỚC khi đụng tới dữ liệu hiện có.
  const arr = (x) => (Array.isArray(x) ? x : []);
  const has = (list, key) => list.every((o) => o && typeof o === 'object' && typeof o[key] === 'string' && o[key]);
  const d = {
    vocab: data.vocab, grammar: arr(data.grammar), cats: arr(data.cats), srs: arr(data.srs),
    reviews: arr(data.reviews).map((r) => { const { id, ...rest } = r || {}; return rest; }),
  };
  const valid = has(d.vocab, 'id') && has(d.vocab, 'word') && has(d.grammar, 'id') && has(d.grammar, 'pattern')
    && has(d.cats, 'id') && has(d.srs, 'key') && has(d.reviews, 'key') && has(d.reviews, 'day');
  if (!valid) throw new Error('Tệp sao lưu bị hỏng (có mục thiếu thông tin bắt buộc). Dữ liệu hiện tại được giữ nguyên.');
  d.vocab = d.vocab.map((w) => ({ ...w, cats: arr(w.cats) }));
  d.grammar = d.grammar.map((g) => ({ ...g, examples: arr(g.examples), quiz: arr(g.quiz) }));
  const st = { ...(data.settings && typeof data.settings === 'object' ? data.settings : {}), seeded: 1 };
  if (S.settings.aiKey) st.aiKey = S.settings.aiKey;
  // Xóa và ghi trong MỘT giao dịch: lỗi ở bất kỳ bước nào thì IndexedDB tự hoàn tác toàn bộ.
  await new Promise((res, rej) => {
    const fail = () => rej(new Error('Không ghi được bản sao lưu. Dữ liệu hiện tại được giữ nguyên.'));
    const t = idb.transaction(Object.keys(STORES), 'readwrite');
    t.oncomplete = () => res(); t.onerror = fail; t.onabort = fail;
    try {
      for (const s of Object.keys(STORES)) t.objectStore(s).clear();
      for (const s of ['vocab', 'grammar', 'cats', 'srs', 'reviews']) d[s].forEach((v) => t.objectStore(s).put(v));
      Object.entries(st).forEach(([k, v]) => t.objectStore('kv').put({ k, v }));
    } catch (e) { try { t.abort(); } catch { /* đã hủy */ } fail(); }
  });
  await load();
  if ((S.settings.seedVersion || 1) < SEED_VERSION) await migrateSeed();
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
