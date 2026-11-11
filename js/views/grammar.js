import { S, uid, saveGrammar, deleteGrammar, dayStr } from '../store.js';
import { esc, $, go, bind, header, icon, toast, confirmSheet } from '../ui.js';
import { speak } from '../tts.js';
import { LEVELS, COMPARISONS } from '../data/grammar.js';

const filter = { q: '', level: 0 };

export function viewGrammarList(root) {
  const listHtml = () => {
    const q = filter.q.trim().toLowerCase();
    const items = S.grammar.filter((g) => (!filter.level || g.level === filter.level) && (!q || [g.pattern, g.vi, g.usage].some((x) => (x || '').toLowerCase().includes(q))))
      .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
    if (!items.length) return '<div class="empty">Không có cấu trúc nào phù hợp.</div>';
    return '<div class="list">' + items.map((g) => `<button class="item" data-act="open" data-id="${esc(g.id)}">
      <div class="grow"><div class="w">${esc(g.pattern)}</div><div class="m">${esc(g.vi)}</div></div>
      ${g.learnedAt ? '<span class="tag good">Đã học</span>' : ''}<span class="tag">${LEVELS[g.level]}</span></button>`).join('') + '</div>';
  };
  const chips = () => [[0, 'Tất cả'], [1, 'Sơ cấp'], [2, 'Trung cấp'], [3, 'Cao cấp']].map(([n, l]) => `<button class="chip ${filter.level === n ? 'on' : ''}" data-act="lv" data-n="${n}">${l}</button>`).join('');
  root.innerHTML = header('Ngữ pháp', { sub: '문법' }) + `
    <div class="search"><input class="input" id="q" type="search" placeholder="Tìm cấu trúc hoặc ý nghĩa…" value="${esc(filter.q)}" aria-label="Tìm kiếm" autocomplete="off"></div>
    <div class="chips" id="chips">${chips()}</div>
    <div class="sec">So sánh cấu trúc dễ nhầm</div>
    <div class="chips">${COMPARISONS.map((c) => `<button class="chip ko" data-act="cmp" data-id="${c.id}">${esc(c.a)} ↔ ${esc(c.b)}</button>`).join('')}</div>
    <div class="sec">Danh sách cấu trúc</div>
    <div id="list">${listHtml()}</div>
    <button class="fab" data-act="add" aria-label="Thêm cấu trúc">${icon('plus')}</button>`;
  const refresh = () => { $('#list', root).innerHTML = listHtml(); };
  $('#q', root).oninput = (e) => { filter.q = e.target.value; refresh(); };
  bind(root, {
    open: (el) => go('#/grammar/' + el.dataset.id),
    cmp: (el) => go('#/grammar/compare/' + el.dataset.id),
    add: () => go('#/grammar/edit/new'),
    lv: (el) => { filter.level = +el.dataset.n; $('#chips', root).innerHTML = chips(); refresh(); },
  });
}

const exHtml = (list) => list.map((e, i) => `<div class="exbox"><div class="row"><div class="ko grow">${esc(e.ko)}</div><button class="iconbtn" data-act="say" data-t="${esc(e.ko)}" aria-label="Nghe câu ${i + 1}">${icon('sound')}</button></div><div class="muted">${esc(e.vi)}</div></div>`).join('');

export function viewGrammarDetail(root, id) {
  const g = S.grammar.find((x) => x.id === id);
  if (!g) { root.innerHTML = header('Ngữ pháp', { back: '#/grammar' }) + '<div class="empty">Không tìm thấy cấu trúc này.</div>'; bind(root, {}); return; }
  const cmps = COMPARISONS.filter((c) => [c.a, c.b].some((p) => g.pattern === p || g.pattern.startsWith(p + ' ')));
  const sec = (t, v, ko) => (v ? `<div class="card"><h2>${t}</h2><p style="margin-top:6px" class="${ko ? 'ko' : ''}">${esc(v)}</p></div>` : '');
  root.innerHTML = header('', { back: '#/grammar', right: `<button class="iconbtn" data-act="edit" aria-label="Sửa">${icon('edit')}</button><button class="iconbtn" data-act="del" aria-label="Xóa">${icon('trash')}</button>` }) + `
    <div class="card hero"><div class="big" style="font-size:34px">${esc(g.pattern)}</div><div class="vi">${esc(g.vi)}</div>
      <div style="margin-top:12px"><span class="tag">${LEVELS[g.level]}</span> <span class="tag">${esc(g.topik || '')}</span></div></div>
    ${sec('Cách dùng', g.usage)}${sec('Cấu tạo', g.formation, true)}
    ${g.examples && g.examples.length ? `<div class="card"><h2>Ví dụ</h2><div class="stack" style="margin-top:8px">${exHtml(g.examples)}</div></div>` : ''}
    ${sec('Lỗi thường gặp', g.mistakes, true)}${sec('Cấu trúc tương tự', g.similar, true)}
    ${cmps.map((c) => `<button class="btn block ko" style="margin-bottom:10px" data-act="cmp" data-id="${c.id}">${icon('swap')} So sánh ${esc(c.a)} và ${esc(c.b)}</button>`).join('')}
    <button class="btn ${g.learnedAt ? '' : 'primary'} block" data-act="learn">${g.learnedAt ? '✓ Đã học ngày ' + g.learnedAt + ' — bỏ đánh dấu' : 'Đánh dấu đã học'}</button>`;
  bind(root, {
    say: (el) => speak(el.dataset.t),
    cmp: (el) => go('#/grammar/compare/' + el.dataset.id),
    edit: () => go('#/grammar/edit/' + g.id),
    learn: async () => { g.learnedAt = g.learnedAt ? null : dayStr(); await saveGrammar(g); viewGrammarDetail(root, id); },
    del: () => confirmSheet(`Xóa cấu trúc “${g.pattern}”?`, 'Xóa', async () => { await deleteGrammar(g.id); go('#/grammar'); }),
  });
}

export function viewCompare(root, id) {
  const c = COMPARISONS.find((x) => x.id === id);
  if (!c) return go('#/grammar');
  root.innerHTML = header('So sánh', { back: '#/grammar' }) + `
    <div class="card hero"><div class="big" style="font-size:30px">${esc(c.a)} <span class="muted">↔</span> ${esc(c.b)}</div><p style="margin-top:10px">${esc(c.summary)}</p></div>
    <div class="card"><div class="tablewrap"><table class="cmp"><thead><tr><td></td><th>${esc(c.a)}</th><th>${esc(c.b)}</th></tr></thead>
      <tbody>${c.rows.map((r) => `<tr><td>${esc(r[0])}</td><td class="ko">${esc(r[1])}</td><td class="ko">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h2>Ví dụ đối chiếu</h2><div class="stack" style="margin-top:8px">${exHtml(c.ex.map(([ko, vi]) => ({ ko, vi })))}</div></div>
    <div class="notice info"><b>Mẹo nhớ:</b> ${esc(c.tip)}</div>
    <div class="grid2">${[c.a, c.b].map((p) => { const g = S.grammar.find((x) => x.pattern === p) || S.grammar.find((x) => x.pattern.startsWith(p + ' ')); return g ? `<button class="btn ko" data-act="open" data-id="${g.id}">${esc(p)}</button>` : ''; }).join('')}</div>`;
  bind(root, { say: (el) => speak(el.dataset.t), open: (el) => go('#/grammar/' + el.dataset.id) });
}

export function viewGrammarEdit(root, id) {
  const old = id && id !== 'new' ? S.grammar.find((x) => x.id === id) : null;
  const g = old || { pattern: '', vi: '', usage: '', formation: '', examples: [], similar: '', mistakes: '', level: 1, topik: '', quiz: [], learnedAt: null };
  const f = (k, label, ta, ko, val = g[k], ph = '') => `<label class="field"><span>${label}</span>${ta ? `<textarea class="input ${ko ? 'ko' : ''}" name="${k}" placeholder="${esc(ph)}">${esc(val)}</textarea>` : `<input class="input ${ko ? 'ko' : ''}" name="${k}" value="${esc(val)}" autocomplete="off">`}</label>`;
  root.innerHTML = header(old ? 'Sửa cấu trúc' : 'Thêm cấu trúc', { back: old ? '#/grammar/' + old.id : '#/grammar' }) + `
    <form id="f" novalidate>
      ${f('pattern', 'Cấu trúc ngữ pháp *', false, true)}${f('vi', 'Ý nghĩa tiếng Việt *')}
      <div class="grid2"><label class="field"><span>Phân loại</span><select class="input" name="level">${[1, 2, 3].map((n) => `<option value="${n}" ${n === g.level ? 'selected' : ''}>${LEVELS[n]}</option>`).join('')}</select></label>${f('topik', 'Cấp TOPIK')}</div>
      ${f('usage', 'Cách dùng', true)}${f('formation', 'Cấu tạo', true, true)}
      ${f('examples', 'Ví dụ (mỗi dòng: câu tiếng Hàn | nghĩa tiếng Việt)', true, true, g.examples.map((e) => e.ko + ' | ' + e.vi).join('\n'), '밥을 먹어요. | Tôi ăn cơm.')}
      ${f('similar', 'Cấu trúc tương tự', false, true)}${f('mistakes', 'Lỗi thường gặp', true, true)}
      <button class="btn primary block">Lưu</button>
    </form>`;
  bind(root, {});
  $('#f', root).onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries([...new FormData(e.target).entries()].map(([k, v]) => [k, String(v).trim()]));
    if (!d.pattern || !d.vi) return toast('Cần nhập cấu trúc và ý nghĩa');
    const out = { ...g, ...d, id: old ? old.id : uid('g'), level: +d.level,
      examples: d.examples.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0]).map(([ko, vi = '']) => ({ ko, vi })) };
    await saveGrammar(out); toast('Đã lưu'); go('#/grammar/' + out.id);
  };
}
