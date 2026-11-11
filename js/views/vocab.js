import { S, uid, saveVocab, deleteVocab, saveCat, deleteCat } from '../store.js';
import { esc, $, go, bind, header, icon, toast, sheet, confirmSheet, download, pickFile, stripMark } from '../ui.js';
import { speak } from '../tts.js';
import { status } from '../srs.js';
import { toCSV, importCSV } from '../csv.js';
import { LEVELS } from '../data/grammar.js';

const filter = { q: '', cat: 'all' };
const POS = ['Danh từ', 'Động từ', 'Tính từ', 'Phó từ', 'Đại từ', 'Số từ', 'Trợ từ', 'Định từ', 'Thán từ', 'Cụm từ', 'Thành ngữ'];
export const markEx = (s) => esc(s).replace(/\{([^}]*)\}/g, '<mark>$1</mark>');
const sortedCats = () => [...S.cats].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));

function matches(w) {
  if (filter.cat === 'fav' && !w.fav) return false;
  if (!['all', 'fav'].includes(filter.cat) && !(w.cats || []).includes(filter.cat)) return false;
  const q = filter.q.trim().toLowerCase();
  if (!q) return true;
  return [w.word, w.roman, w.vi, w.en, w.hanja, w.topic].some((x) => (x || '').toLowerCase().includes(q));
}

let limit = 150;
export function viewVocabList(root) {
  if (!['all', 'fav'].includes(filter.cat) && !S.cats.some((c) => c.id === filter.cat)) filter.cat = 'all'; // danh mục đã bị xóa
  limit = 150;
  const listHtml = () => {
    const items = S.vocab.filter(matches).sort((a, b) => (b.created || 0) - (a.created || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (!items.length) return `<div class="empty">Không có từ nào phù hợp.<br><span class="small">Nhấn + để thêm từ mới.</span></div>`;
    return `<p class="small muted" style="margin:2px 4px 8px">${items.length} từ</p><div class="list">` + items.slice(0, limit).map((w) => `
      <div class="item">
        <i class="dot ${status('v:' + w.id)}" title="Trạng thái học"></i>
        <button class="grow" data-act="open" data-id="${esc(w.id)}" style="text-align:left">
          <div class="w">${esc(w.word)}${S.settings.showRoman && w.roman ? `<span class="r">${esc(w.roman)}</span>` : ''}</div>
          <div class="m">${esc(w.vi)}</div>
        </button>
        <button class="iconbtn" data-act="say" data-t="${esc(w.word)}" aria-label="Nghe phát âm">${icon('sound')}</button>
        <button class="iconbtn ${w.fav ? 'on' : ''}" data-act="fav" data-id="${esc(w.id)}" aria-label="Yêu thích" aria-pressed="${!!w.fav}">${icon('star')}</button>
      </div>`).join('') + '</div>' + (items.length > limit ? `<button class="btn block" style="margin-top:10px" data-act="more">Hiện thêm (còn ${items.length - limit} từ)</button>` : '');
  };
  const chipsHtml = () => [['all', 'Tất cả'], ['fav', '★ Yêu thích'], ...sortedCats().map((c) => [c.id, c.name])]
    .map(([id, n]) => `<button class="chip ${filter.cat === id ? 'on' : ''}" data-act="cat" data-id="${esc(id)}">${esc(n)}</button>`).join('');

  root.innerHTML = header('Từ vựng', { sub: '나의 단어장', right: `<button class="iconbtn" data-act="menu" aria-label="Tùy chọn">${icon('more')}</button>` }) + `
    <div class="search"><input class="input" id="q" type="search" placeholder="Tìm từ, nghĩa, phiên âm, Hán tự…" value="${esc(filter.q)}" autocomplete="off" aria-label="Tìm kiếm"></div>
    <div class="chips" id="chips">${chipsHtml()}</div>
    <div id="list">${listHtml()}</div>
    <button class="fab" data-act="add" aria-label="Thêm từ mới">${icon('plus')}</button>`;
  const refresh = () => { $('#list', root).innerHTML = listHtml(); };
  let timer;
  $('#q', root).oninput = (e) => { filter.q = e.target.value; limit = 150; clearTimeout(timer); timer = setTimeout(refresh, S.vocab.length > 500 ? 150 : 0); };
  bind(root, {
    more: () => { limit += 300; refresh(); },
    open: (el) => go('#/vocab/' + el.dataset.id),
    add: () => go('#/vocab/edit/new'),
    say: (el) => speak(el.dataset.t),
    cat: (el) => { filter.cat = el.dataset.id; $('#chips', root).innerHTML = chipsHtml(); refresh(); },
    fav: async (el) => { const w = S.vocab.find((x) => x.id === el.dataset.id); w.fav = !w.fav; await saveVocab(w); refresh(); },
    menu: () => sheet(`<h3>Tùy chọn từ vựng</h3>
      <button class="btn block" data-act="exp">Xuất CSV (mở được bằng Excel)</button>
      <button class="btn block" data-act="imp">Nhập từ tệp CSV</button>
      <button class="btn block" data-act="tpl">Tải tệp CSV mẫu</button>
      <button class="btn block" data-act="cats">Quản lý danh mục</button>
      <button class="btn ghost block" data-act="close">Đóng</button>`, {
      exp: (el, close) => { download('korean-vocab.csv', toCSV(), 'text/csv;charset=utf-8'); close(); },
      tpl: (el, close) => { download('korean-vocab-mau.csv', toCSV(S.vocab.slice(0, 2)), 'text/csv;charset=utf-8'); close(); },
      cats: (el, close) => { close(); go('#/cats'); },
      imp: async (el, close) => {
        const f = await pickFile('.csv,text/csv'); if (!f) return;
        try { const r = await importCSV(f.text); close(); toast(`Đã thêm ${r.added}, cập nhật ${r.updated} từ`); refresh(); }
        catch (e) { toast(e.message); }
      },
    }),
  });
}

export function viewVocabDetail(root, id) {
  const w = S.vocab.find((x) => x.id === id);
  if (!w) { root.innerHTML = header('Từ vựng', { back: '#/vocab' }) + '<div class="empty">Không tìm thấy từ này.</div>'; bind(root, {}); return; }
  const c = S.srs['v:' + w.id];
  const cats = (w.cats || []).map((cid) => S.cats.find((x) => x.id === cid)).filter(Boolean);
  const row = (label, val, ko = false) => (val ? `<div><dt>${label}</dt><dd class="${ko ? 'ko' : ''}">${esc(val)}</dd></div>` : '');
  const hist = S.reviews.filter((r) => r.key === 'v:' + w.id).slice(-6).reverse();
  const qLabel = { 1: 'Quên', 3: 'Khó nhớ', 4: 'Đã nhớ', 5: 'Rất dễ' };
  root.innerHTML = header('', { back: '#/vocab', right: `
      <button class="iconbtn ${w.fav ? 'on' : ''}" data-act="fav" aria-label="Yêu thích" aria-pressed="${!!w.fav}">${icon('star')}</button>
      <button class="iconbtn" data-act="edit" aria-label="Sửa">${icon('edit')}</button>
      <button class="iconbtn" data-act="del" aria-label="Xóa">${icon('trash')}</button>` }) + `
    <div class="card hero">
      <div class="big">${esc(w.word)}</div>
      ${w.hanja ? `<div class="ko muted">${esc(w.hanja)}</div>` : ''}
      ${w.roman ? `<div class="rom">${esc(w.roman)}${w.ipa ? ' · /' + esc(w.ipa) + '/' : ''}</div>` : ''}
      <div class="vi">${esc(w.vi)}</div>
      ${w.en ? `<div class="muted">${esc(w.en)}</div>` : ''}
      <div class="row" style="justify-content:center;margin-top:14px;flex-wrap:wrap">
        <button class="btn sm" data-act="say">${icon('sound')} Nghe</button>
        <button class="btn sm" data-act="slow">Chậm</button>
        <button class="btn sm" data-act="rec">${icon('mic')} Luyện nói</button>
      </div>
      <div style="margin-top:12px">${w.pos ? `<span class="tag">${esc(w.pos)}</span> ` : ''}<span class="tag">${LEVELS[w.level] || 'Sơ cấp'}</span>${w.topic ? ` <span class="tag">${esc(w.topic)}</span>` : ''}</div>
    </div>
    ${w.ex ? `<div class="card"><h2>Ví dụ</h2><div class="exbox" style="margin-top:8px"><div class="row"><div class="ko grow">${markEx(w.ex)}</div><button class="iconbtn" data-act="sayex" aria-label="Nghe câu ví dụ">${icon('sound')}</button></div><div class="muted">${esc(w.exVi)}</div></div></div>` : ''}
    <div class="card"><dl class="kv" style="margin:0">
      ${row('Giải thích tiếng Hàn', w.def, true)}${row('Từ đồng nghĩa', w.syn, true)}${row('Từ trái nghĩa', w.ant, true)}
      ${row('Từ liên quan', w.rel, true)}${row('Cụm từ thường đi cùng', w.col, true)}${row('Ghi chú cách dùng', w.notes)}
      ${row('Danh mục', cats.map((x) => x.name).join(' · '))}
      ${['def', 'syn', 'ant', 'rel', 'col', 'notes'].every((k) => !w[k]) && !cats.length ? '<p class="muted small">Chưa có thông tin bổ sung. Nhấn biểu tượng bút để thêm.</p>' : ''}
    </dl></div>
    ${w.pos === 'Động từ' || w.pos === 'Tính từ' ? `<button class="btn block" data-act="conj">Chia ${esc(w.pos.toLowerCase())} này</button>` : ''}
    <div class="card" style="margin-top:12px"><h2>Tiến độ ghi nhớ</h2>
      ${c && c.first ? `<div class="grid3" style="margin-top:10px"><div><b>${c.due}</b><div class="small muted">Ôn lần tới</div></div><div><b>${c.iv} ngày</b><div class="small muted">Chu kỳ</div></div><div><b>${c.lapses}</b><div class="small muted">Số lần quên</div></div></div>
        <p class="small muted" style="margin-top:10px">Hệ số dễ (EF): ${c.ef.toFixed(2)} · Đã ôn đúng liên tiếp: ${c.reps}</p>
        ${hist.length ? `<p class="small" style="margin-top:8px">${hist.map((r) => `${r.day.slice(5)} ${qLabel[r.q] || ''}`).join(' · ')}</p>` : ''}`
        : '<p class="muted small" style="margin-top:8px">Từ mới – chưa học lần nào.</p>'}
    </div>`;
  bind(root, {
    say: () => speak(w.word), slow: () => speak(w.word, { slow: true }), sayex: () => speak(w.ex),
    rec: () => go('#/listen?t=' + encodeURIComponent(w.word)),
    conj: () => go('#/conjugate?w=' + encodeURIComponent(w.word)),
    edit: () => go('#/vocab/edit/' + w.id),
    fav: async () => { w.fav = !w.fav; await saveVocab(w); viewVocabDetail(root, id); },
    del: () => confirmSheet(`Xóa từ “${w.word}” và toàn bộ lịch sử học của từ này?`, 'Xóa từ', async () => { await deleteVocab(w.id); toast('Đã xóa'); go('#/vocab'); }),
  });
}

export function viewVocabEdit(root, id) {
  const old = id && id !== 'new' ? S.vocab.find((x) => x.id === id) : null;
  const w = old || { word: '', roman: '', ipa: '', vi: '', en: '', pos: 'Danh từ', hanja: '', def: '', ex: '', exVi: '', syn: '', ant: '', rel: '', col: '', notes: '', level: 1, topic: '', cats: ['my'], fav: false };
  const f = (k, label, { ta = false, ko = false, ph = '', req = false } = {}) => `<label class="field"><span>${label}${req ? ' *' : ''}</span>${ta
    ? `<textarea class="input ${ko ? 'ko' : ''}" name="${k}" placeholder="${esc(ph)}">${esc(w[k])}</textarea>`
    : `<input class="input ${ko ? 'ko' : ''}" name="${k}" value="${esc(w[k])}" placeholder="${esc(ph)}" ${ko ? 'lang="ko"' : ''} ${req ? 'required' : ''} autocomplete="off">`}</label>`;
  root.innerHTML = header(old ? 'Sửa từ' : 'Thêm từ mới', { back: old ? '#/vocab/' + old.id : '#/vocab' }) + `
    <form id="f" novalidate>
      ${f('word', 'Từ tiếng Hàn (Hangul)', { ko: true, req: true, ph: '예: 사랑' })}
      ${f('vi', 'Nghĩa tiếng Việt', { req: true })}
      <div class="grid2">${f('roman', 'Phiên âm Latin')}${f('ipa', 'IPA (nếu có nguồn tin cậy)')}</div>
      ${f('en', 'Nghĩa tiếng Anh')}
      <div class="grid2">
        <label class="field"><span>Từ loại</span><select class="input" name="pos">${POS.map((p) => `<option ${p === w.pos ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
        <label class="field"><span>Cấp độ</span><select class="input" name="level">${[1, 2, 3].map((n) => `<option value="${n}" ${n === +w.level ? 'selected' : ''}>${LEVELS[n]}</option>`).join('')}</select></label>
      </div>
      <div class="grid2">${f('hanja', 'Hán tự (한자)', { ko: true })}${f('topic', 'Chủ đề')}</div>
      ${f('def', 'Giải thích bằng tiếng Hàn', { ta: true, ko: true })}
      ${f('ex', 'Câu ví dụ tiếng Hàn', { ta: true, ko: true, ph: 'Đặt từ đang học trong {…}, ví dụ: 학교에 {가요}.' })}
      ${f('exVi', 'Dịch nghĩa câu ví dụ', { ta: true })}
      ${f('syn', 'Từ đồng nghĩa', { ko: true })}${f('ant', 'Từ trái nghĩa', { ko: true })}
      ${f('rel', 'Từ liên quan', { ko: true })}${f('col', 'Cụm từ thường đi cùng', { ko: true })}
      ${f('notes', 'Ghi chú cách sử dụng', { ta: true })}
      <div class="field"><span>Danh mục</span><div class="checks">${sortedCats().map((c) => `<label><input type="checkbox" name="cats" value="${esc(c.id)}" ${(w.cats || []).includes(c.id) ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}</div></div>
      <button class="btn primary block" type="submit">Lưu</button>
    </form>`;
  bind(root, {});
  $('#f', root).onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const out = { ...w, id: old ? old.id : uid('u'), created: old ? old.created : Date.now() };
    for (const [k, v] of fd.entries()) if (k !== 'cats') out[k] = String(v).trim();
    out.word = out.word.normalize('NFC'); out.level = +out.level; out.cats = fd.getAll('cats');
    if (!out.word || !out.vi) return toast('Cần nhập từ tiếng Hàn và nghĩa tiếng Việt');
    if (S.vocab.some((x) => x.word === out.word && x.id !== out.id)) return toast('Từ này đã có trong sổ');
    await saveVocab(out); toast('Đã lưu'); go('#/vocab/' + out.id);
  };
}

export function viewCats(root) {
  const count = (id) => S.vocab.filter((w) => (w.cats || []).includes(id)).length;
  root.innerHTML = header('Danh mục', { back: '#/vocab' }) + `
    <form id="f" class="row" style="margin:6px 0 14px"><input class="input grow" name="name" placeholder="Tên danh mục mới" aria-label="Tên danh mục mới" autocomplete="off"><button class="btn primary">Thêm</button></form>
    <div class="list">${sortedCats().map((c) => `<div class="item"><div class="grow"><div style="font-weight:650">${esc(c.name)}</div><div class="m">${count(c.id)} từ${c.builtin ? ' · mặc định' : ''}</div></div>
      ${c.builtin ? '' : `<button class="iconbtn" data-act="ren" data-id="${esc(c.id)}" aria-label="Đổi tên">${icon('edit')}</button><button class="iconbtn" data-act="del" data-id="${esc(c.id)}" aria-label="Xóa">${icon('trash')}</button>`}</div>`).join('')}</div>`;
  $('#f', root).onsubmit = async (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get('name').trim(); if (!name) return;
    if (S.cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) return toast('Danh mục đã tồn tại');
    await saveCat({ id: uid('c'), name, builtin: false, order: 100 }); viewCats(root);
  };
  bind(root, {
    del: (el) => { const c = S.cats.find((x) => x.id === el.dataset.id); confirmSheet(`Xóa danh mục “${c.name}”? Các từ trong danh mục vẫn được giữ lại.`, 'Xóa danh mục', async () => { await deleteCat(c.id); viewCats(root); }); },
    ren: (el) => {
      const c = S.cats.find((x) => x.id === el.dataset.id);
      sheet(`<h3>Đổi tên danh mục</h3><input class="input" id="rn" value="${esc(c.name)}" aria-label="Tên danh mục"><button class="btn primary block" data-act="ok">Lưu</button><button class="btn ghost block" data-act="close">Hủy</button>`, {
        ok: async (b, close) => { const v = $('#rn').value.trim(); if (!v) return; c.name = v; await saveCat(c); close(); viewCats(root); },
      });
    },
  });
}
