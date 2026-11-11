// Nhập / xuất từ vựng dạng CSV (UTF-8 có BOM để Excel mở đúng tiếng Hàn và tiếng Việt).
import { S, uid, saveVocab } from './store.js';

export const FIELDS = [
  ['word', 'Korean Word'], ['roman', 'Romanization'], ['ipa', 'IPA'], ['vi', 'Vietnamese Meaning'], ['en', 'English Meaning'],
  ['pos', 'Part of Speech'], ['hanja', 'Hanja'], ['def', 'Korean Definition'], ['ex', 'Example Sentence'], ['exVi', 'Vietnamese Translation'],
  ['syn', 'Synonyms'], ['ant', 'Antonyms'], ['rel', 'Related Words'], ['col', 'Collocations'], ['notes', 'Grammar Notes'],
  ['level', 'Difficulty'], ['topic', 'Topic'], ['cats', 'Categories'], ['fav', 'Favorite'],
];

// Ô bắt đầu bằng = + - @ được thêm dấu ' để bảng tính không chạy như công thức.
const q = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export function toCSV(list = S.vocab) {
  const catName = Object.fromEntries(S.cats.map((c) => [c.id, c.name]));
  const rows = [FIELDS.map((f) => f[1]).join(',')];
  for (const w of list) rows.push(FIELDS.map(([k]) => {
    if (k === 'cats') return q((w.cats || []).map((c) => catName[c] || c).join('; '));
    if (k === 'fav') return w.fav ? '1' : '';
    return q(w[k]);
  }).join(','));
  return '﻿' + rows.join('\r\n');
}

export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], cur = '', inQ = false;
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = ''; if (row.some((x) => x.trim())) rows.push(row); row = [];
    } else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Nhập CSV: trùng "Korean Word" thì cập nhật, chưa có thì thêm mới vào My Vocabulary. */
export async function importCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('Tệp không có dữ liệu.');
  const norm = (s) => s.trim().toLowerCase();
  const head = rows[0].map(norm);
  const col = {};
  for (const [k, label] of FIELDS) { const i = head.findIndex((h) => h === norm(label) || h === k.toLowerCase()); if (i >= 0) col[k] = i; }
  if (col.word === undefined) throw new Error('Thiếu cột “Korean Word”.');
  const catByName = Object.fromEntries(S.cats.map((c) => [norm(c.name), c.id]));
  let added = 0, updated = 0;
  for (const r of rows.slice(1)) {
    const get = (k) => (col[k] !== undefined ? (r[col[k]] || '').trim().replace(/^'(?=[=+\-@])/, '') : undefined);
    const word = get('word'); if (!word) continue;
    const old = S.vocab.find((w) => w.word === word);
    const w = old ? { ...old } : { id: uid('u'), word, roman: '', ipa: '', vi: '', en: '', pos: '', hanja: '', def: '', ex: '', exVi: '', syn: '', ant: '', rel: '', col: '', notes: '', level: 1, topic: '', cats: ['my'], fav: false, created: Date.now() };
    for (const [k] of FIELDS) {
      const v = get(k); if (v === undefined || k === 'word') continue;
      if (k === 'level') { const n = parseInt(v, 10); if (n >= 1 && n <= 3) w.level = n; }
      else if (k === 'fav') w.fav = ['1', 'true', 'x', 'yes'].includes(norm(v));
      else if (k === 'cats') { const ids = v.split(/[;|]/).map((x) => catByName[norm(x)]).filter(Boolean); if (ids.length) w.cats = ids; }
      else if (v !== '' || !old) w[k] = v;
    }
    await saveVocab(w); old ? updated++ : added++;
  }
  return { added, updated };
}
