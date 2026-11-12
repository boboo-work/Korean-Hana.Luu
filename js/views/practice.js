import { S, setSetting, todayStats } from '../store.js';
import { esc, $, go, bind, header, icon, toast, shuffle, stripMark } from '../ui.js';
import { speak } from '../tts.js';
import { RATINGS, rate, dueVocab, newVocab, isDue } from '../srs.js';
import { markEx } from './vocab.js';

const MODES = [
  ['ko-vi', 'Hàn → Việt', 'Flashcard: xem từ tiếng Hàn, nhớ nghĩa', '1'],
  ['vi-ko', 'Việt → Hàn', 'Flashcard: xem nghĩa, nhớ từ tiếng Hàn', '2'],
  ['listen', 'Nghe → Hàn', 'Nghe phát âm rồi gõ lại bằng Hangul', '3'],
  ['spell', 'Chính tả', 'Xem nghĩa, gõ đúng từ tiếng Hàn', '4'],
  ['blank', 'Điền chỗ trống', 'Chọn từ phù hợp với câu ví dụ', '5'],
  ['mc', 'Trắc nghiệm', 'Chọn nghĩa đúng trong 4 đáp án', '6'],
  ['build', 'Ghép câu', 'Sắp xếp các từ thành câu đúng', '7'],
  ['grammar', 'Ngữ pháp', 'Câu hỏi về cấu trúc ngữ pháp', '8'],
];
const MODE_NAME = Object.fromEntries(MODES.map((m) => [m[0], m[1]]));
let source = 'today';
let ses = null;

const norm = (s) => String(s || '').replace(/\s+/g, '').normalize('NFC');
const tokensOf = (w) => stripMark(w.ex).trim().split(/\s+/).filter(Boolean);
const eligible = {
  blank: (w) => w.ex && (w.ex.includes('{') || w.ex.includes(w.word)) && w.exVi,
  build: (w) => w.ex && w.exVi && tokensOf(w).length >= 3,
};

export function todayQueue() {
  const due = dueVocab();
  const left = Math.max(0, S.settings.newPerDay - todayStats().newWords);
  const fresh = newVocab().sort((a, b) => a.level - b.level || a.id.localeCompare(b.id)).slice(0, left);
  return { due, fresh, all: [...due, ...fresh] };
}

function vocabPool() {
  if (source === 'today') return todayQueue().all;
  let list = S.vocab;
  if (source === 'fav') list = list.filter((w) => w.fav);
  else if (source !== 'all') list = list.filter((w) => (w.cats || []).includes(source));
  return shuffle(list).slice(0, 20);
}

function start(mode) {
  let items;
  if (mode === 'grammar') {
    const rank = (g) => { const c = S.srs['g:' + g.id]; return isDue(c) ? 0 : !c ? 1 : 2; };
    items = shuffle(S.grammar).sort((a, b) => rank(a) - rank(b)).slice(0, 10).map((g) => ({ g }));
    if (S.grammar.length < 4) return toast('Cần ít nhất 4 cấu trúc ngữ pháp');
  } else {
    if (S.vocab.length < 4 && ['mc', 'blank'].includes(mode)) return toast('Cần ít nhất 4 từ vựng cho chế độ này');
    let pool = vocabPool();
    if (!pool.length) return toast(source === 'today' ? 'Hôm nay đã ôn xong! Chọn nguồn khác để luyện thêm.' : 'Nguồn này chưa có từ nào.');
    if (eligible[mode]) pool = pool.filter(eligible[mode]);
    if (!pool.length) return toast('Các từ trong nguồn này chưa có câu ví dụ phù hợp.');
    items = pool.map((w) => ({ w }));
  }
  ses = { mode, items, i: 0, right: 0, graded: 0, rated: 0 };
  go('#/session');
}

export function viewPractice(root) {
  if (!['today', 'all', 'fav'].includes(source) && !S.cats.some((c) => c.id === source)) source = 'today';
  const q = todayQueue();
  const opts = [['today', `Ôn tập hôm nay (${q.due.length} đến hạn + ${q.fresh.length} mới)`], ['all', 'Tất cả từ (ngẫu nhiên 20)'], ['fav', '★ Yêu thích'], ...S.cats.map((c) => [c.id, c.name])];
  root.innerHTML = header('Luyện tập', { sub: '연습' }) + `
    <div class="card">
      <label class="field" style="margin:0"><span>Nguồn từ vựng</span><select class="input" id="src">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === source ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="row" style="margin-top:12px"><input type="checkbox" id="rom" ${S.settings.showRoman ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)"><span>Hiện phiên âm Latin trên thẻ</span></label>
      <label class="row" style="margin-top:12px"><input type="checkbox" id="aus" ${S.settings.autoSpeak !== false ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)"><span>Tự đọc từ khi lật thẻ</span></label>
    </div>
    <div class="sec">Chế độ học</div>
    <div class="grid2">${MODES.map(([id, name, desc, n]) => `<button class="mode" data-act="start" data-m="${id}"><em>${n}</em><b>${name}</b><span>${desc}</span></button>`).join('')}</div>
    <div class="sec">Trò chơi</div>
    <div class="grid2">
      <button class="tool" data-act="nav" data-to="#/game-run">${icon('play')}Chạy & Gõ<span>Gõ đúng từ để nhảy qua chướng ngại vật</span></button>
      <button class="tool" data-act="nav" data-to="#/game-drop">${icon('star')}Bắn Từ<span>Gõ trước khi khung chữ rơi chạm đất</span></button>
    </div>
    <div class="sec">Công cụ</div>
    <div class="grid2">
      <button class="tool" data-act="nav" data-to="#/conjugate">${icon('swap')}Chia động từ<span>Động từ & tính từ, kèm bất quy tắc</span></button>
      <button class="tool" data-act="nav" data-to="#/listen">${icon('mic')}Nghe & nói<span>Nghe mẫu, ghi âm, nghe lại</span></button>
    </div>`;
  $('#src', root).onchange = (e) => { source = e.target.value; };
  $('#rom', root).onchange = (e) => setSetting('showRoman', e.target.checked);
  $('#aus', root).onchange = (e) => setSetting('autoSpeak', e.target.checked);
  bind(root, { start: (el) => start(el.dataset.m), nav: (el) => go(el.dataset.to) });
}

// ---------- Phiên học ----------
function pickOthers(w, n, keyFn) {
  const seen = new Set([keyFn(w)]); const out = [];
  const cand = shuffle(S.vocab.filter((x) => x.id !== w.id));
  for (const x of [...cand.filter((x) => x.pos === w.pos), ...cand]) {
    if (out.length >= n) break;
    const k = keyFn(x); if (seen.has(k)) continue; seen.add(k); out.push(x);
  }
  return out;
}

function backHtml(w) {
  return `<div class="card" style="margin-top:12px">
    <div class="row"><div class="grow"><div class="ko" style="font-size:28px;font-weight:700;color:var(--navy)">${esc(w.word)}${w.hanja ? ` <span class="muted" style="font-size:16px;font-weight:500">${esc(w.hanja)}</span>` : ''}</div>
      ${S.settings.showRoman && w.roman ? `<div class="muted small">${esc(w.roman)}</div>` : ''}</div>
      <button class="iconbtn" data-act="say" data-t="${esc(w.word)}" aria-label="Nghe từ">${icon('sound')}</button></div>
    <div style="font-size:18px;font-weight:650;margin-top:6px">${esc(w.vi)}</div>
    ${w.pos ? `<span class="tag" style="margin-top:6px">${esc(w.pos)}</span>` : ''}
    ${w.ex ? `<div class="exbox" style="margin-top:12px"><div class="row"><div class="ko grow">${markEx(w.ex)}</div><button class="iconbtn" data-act="say" data-t="${esc(stripMark(w.ex))}" aria-label="Nghe câu ví dụ">${icon('sound')}</button></div><div class="muted">${esc(w.exVi)}</div></div>` : ''}
    ${w.notes ? `<p class="small" style="margin-top:10px"><b>Cách dùng:</b> ${esc(w.notes)}</p>` : ''}
    ${w.col ? `<p class="small ko muted" style="margin-top:6px">${esc(w.col)}</p>` : ''}
  </div>`;
}
function gBackHtml(g, explain) {
  const e = g.examples && g.examples[0];
  return `<div class="card" style="margin-top:12px">${explain ? `<p style="margin-bottom:10px"><b>Giải thích:</b> ${esc(explain)}</p>` : ''}
    <div class="ko" style="font-size:24px;font-weight:700;color:var(--navy)">${esc(g.pattern)}</div><div style="font-weight:650">${esc(g.vi)}</div>
    <p class="small muted ko" style="margin-top:6px">${esc(g.formation)}</p>
    ${e ? `<div class="exbox" style="margin-top:10px"><div class="ko">${esc(e.ko)}</div><div class="muted">${esc(e.vi)}</div></div>` : ''}</div>`;
}
const ARROW = { 1: '←', 3: '↓', 4: '→', 5: '↑' };
const rateHtml = (sug, arrows = false) => `<p class="small muted center" style="margin-top:16px">${arrows ? 'Vuốt thẻ theo mũi tên hoặc bấm nút' : 'Bạn nhớ từ này ở mức nào?'}</p><div class="rate" style="margin-top:6px">${RATINGS.map((r) => `<button class="${r.cls} ${r.q === sug ? 'sug' : ''}" data-act="rate" data-q="${r.q}">${arrows ? `<span class="arw" aria-hidden="true">${ARROW[r.q]}</span>` : ''}${r.label}</button>`).join('')}</div>`;

// Mặt sau của thẻ lật (gọn hơn backHtml để vừa trong thẻ).
function cardBack(w, showWord) {
  return `${showWord ? `<div class="big">${esc(w.word)}</div>${w.hanja ? `<div class="ko muted">${esc(w.hanja)}</div>` : ''}${S.settings.showRoman && w.roman ? `<div class="muted">${esc(w.roman)}</div>` : ''}` : ''}
    <div class="${showWord ? 'mean' : 'big vi'}">${esc(w.vi)}</div>${!showWord && w.en ? `<div class="muted">${esc(w.en)}</div>` : ''}
    ${w.pos ? `<span class="tag">${esc(w.pos)}</span>` : ''}
    <button class="btn sm" data-act="say" data-t="${esc(w.word)}">${icon('sound')} Nghe</button>
    ${w.ex ? `<div class="exbox" style="width:100%;text-align:left"><div class="row"><div class="ko grow">${markEx(w.ex)}</div><button class="iconbtn" data-act="say" data-t="${esc(stripMark(w.ex))}" aria-label="Nghe câu ví dụ">${icon('sound')}</button></div><div class="muted">${esc(w.exVi)}</div></div>` : ''}
    ${w.notes ? `<p class="small" style="text-align:left;width:100%"><b>Cách dùng:</b> ${esc(w.notes)}</p>` : ''}`;
}

// Thẻ lật: chạm để lật qua lại; vuốt 4 hướng để đánh giá (chỉ sau khi đã xem mặt sau).
const SWIPE = { left: [1, 'Quên hoàn toàn', 'r0'], down: [3, 'Khó nhớ', 'r1'], right: [4, 'Đã nhớ', 'r2'], up: [5, 'Rất dễ', 'r3'] };
function attachCard(root, st, onFlip, onRate) {
  const card = $('#card', root), tag = $('#tag', root);
  let start = null;
  const dirOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
  const reset = () => { card.style.transition = 'transform .2s'; card.style.transform = ''; tag.className = 'swipe-tag'; };
  const needFlip = () => toast('Hãy lật thẻ xem mặt sau trước khi đánh giá');
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-act]') || st.rated || (e.pointerType === 'mouse' && e.button !== 0)) return;
    start = { x: e.clientX, y: e.clientY };
    try { card.setPointerCapture(e.pointerId); } catch { /* con trỏ đã nhả */ }
    card.style.transition = 'none';
  });
  card.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y, dist = Math.hypot(dx, dy);
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
    if (dist > 28) { const d = SWIPE[dirOf(dx, dy)]; tag.textContent = d[1]; tag.className = 'swipe-tag show ' + d[2] + (dist >= 80 ? ' go' : ''); } else tag.className = 'swipe-tag';
  });
  const end = (e, cancelled) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y, dist = Math.hypot(dx, dy);
    start = null;
    if (cancelled) return reset();
    if (dist < 8) { reset(); return onFlip(); }       // chạm = lật
    if (dist < 80) return reset();                     // kéo chưa đủ xa: trả thẻ về chỗ cũ
    if (!st.flipped) { reset(); return needFlip(); }
    tag.className = 'swipe-tag';
    card.style.transition = 'transform .18s ease-in, opacity .18s';
    card.style.transform = `translate(${dx * 4}px, ${dy * 4}px) rotate(${dx / 8}deg)`; card.style.opacity = '0';
    onRate(SWIPE[dirOf(dx, dy)][0]);
  };
  card.addEventListener('pointerup', (e) => end(e, false));
  card.addEventListener('pointercancel', (e) => end(e, true));
  card.addEventListener('keydown', (e) => {
    if (e.target !== card) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); return onFlip(); }
    const k = { ArrowLeft: 'left', ArrowDown: 'down', ArrowRight: 'right', ArrowUp: 'up' }[e.key];
    if (!k) return;
    e.preventDefault();
    if (!st.flipped) return needFlip();
    onRate(SWIPE[k][0]);
  });
  card.focus({ preventScroll: true });
}
const verdict = (ok, text) => `<p class="verdict ${ok ? 'ok' : 'no'}" role="status">${ok ? '✓ Chính xác' : '✗ Chưa đúng'}${text ? ' — ' + text : ''}</p>`;

export function viewSession(root) {
  if (!ses) return go('#/practice');
  if (ses.i >= ses.items.length) return summary(root);
  const it = ses.items[ses.i];
  const { mode } = ses;
  const w = it.w, g = it.g;
  const st = { answered: false, ok: null, flipped: false, rated: false };
  const isCard = mode === 'ko-vi' || mode === 'vi-ko';
  const top = `<header class="top"><button class="iconbtn" data-act="quit" aria-label="Kết thúc phiên học">${icon('x')}</button>
    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${ses.items.length}" aria-valuenow="${ses.i}"><i style="width:${(ses.i / ses.items.length) * 100}%"></i></div>
    <span class="small muted" style="min-width:46px;text-align:right">${ses.i + 1}/${ses.items.length}</span></header>
    <p class="small muted" style="margin:4px 2px 0">${MODE_NAME[mode]}${it.retry ? ' · ôn lại' : ''}</p>`;
  const key = g ? 'g:' + g.id : 'v:' + w.id;
  let body = '', after = () => '';
  const finish = (ok) => { // ok: true/false cho bài chấm điểm, null cho flashcard
    st.answered = true; st.ok = ok;
    if (ok !== null) { ses.graded++; if (ok) ses.right++; }
    $('#after', root).innerHTML = after(ok) + rateHtml(ok === false ? 1 : ok === true ? 4 : 0, isCard);
    if (!isCard) $('#after', root).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const handlers = {
    quit: () => { ses = null; go('#/practice'); },
    say: (el) => speak(el.dataset.t, { slow: el.dataset.slow === '1' }),
    rate: (el) => doRate(+el.dataset.q),
  };
  async function doRate(q) {
    if (st.rated) return; // chặn bấm/vuốt nhiều lần: mỗi thẻ chỉ ghi một lượt
    st.rated = true;
    await rate(key, q, mode);
    ses.rated++;
    if (q === 1 && !it.retry) ses.items.push({ ...it, retry: true });
    ses.i++; viewSession(root);
  }

  if (mode === 'ko-vi' || mode === 'vi-ko') {
    const front = mode === 'ko-vi'
      ? `<div class="big">${esc(w.word)}</div>${S.settings.showRoman && w.roman ? `<div class="muted">${esc(w.roman)}</div>` : ''}`
      : `<div class="big vi">${esc(w.vi)}</div>${w.en ? `<div class="muted">${esc(w.en)}</div>` : ''}<span class="tag">${esc(w.pos || '')}</span>`;
    body = `<div class="flip" id="card" tabindex="0" role="button" aria-label="Thẻ từ vựng, đang ở mặt trước. Nhấn Enter để lật.">
        <div class="flip-in">
          <div class="face front card">${front}${mode === 'ko-vi' ? `<button class="btn sm" data-act="say" data-t="${esc(w.word)}">${icon('sound')} Nghe</button>` : ''}<div class="hint">Chạm để lật thẻ</div></div>
          <div class="face back card">${cardBack(w, mode === 'vi-ko')}<div class="hint">Chạm để lật lại</div></div>
        </div>
        <div class="swipe-tag" id="tag" aria-hidden="true"></div>
      </div>
      <p class="small muted center swipe-help" aria-hidden="true">Chạm để lật · lật xong vuốt thẻ để đánh giá</p>`;
    after = () => '';
    it._init = () => attachCard(root, st, () => {
      const card = $('#card', root); const on = card.classList.toggle('on');
      card.setAttribute('aria-label', `Thẻ từ vựng, đang ở mặt ${on ? 'sau' : 'trước'}. Nhấn Enter để lật, phím mũi tên để đánh giá.`);
      if (on && S.settings.autoSpeak !== false) speak(w.word); // tự đọc từ mỗi lần lật sang mặt sau
      if (!st.flipped) { st.flipped = true; finish(null); }
    }, doRate);
  } else if (mode === 'listen' || mode === 'spell') {
    const prompt = mode === 'listen'
      ? `<div class="card fc" style="min-height:190px"><button class="btn primary" data-act="say" data-t="${esc(w.word)}">${icon('sound')} Nghe</button><button class="btn sm" data-act="say" data-slow="1" data-t="${esc(w.word)}">Nghe chậm</button><div class="hint">Nghe rồi gõ lại từ bằng Hangul</div></div>`
      : `<div class="card fc" style="min-height:190px"><div class="big vi">${esc(w.vi)}</div>${w.en ? `<div class="muted">${esc(w.en)}</div>` : ''}<span class="tag">${esc(w.pos || '')}</span><div class="hint">Gõ từ tiếng Hàn tương ứng</div></div>`;
    body = `${prompt}<div class="ans-dock" id="dock"><form id="ans" class="row"><input class="input ko grow" id="inp" lang="ko" placeholder="한글로 입력" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Câu trả lời"><button class="btn primary">Kiểm tra</button></form>
      <button class="btn ghost block" data-act="giveup" style="margin-top:6px">Không biết – xem đáp án</button></div>`;
    after = (ok) => verdict(ok, ok ? '' : `đáp án: ${esc(w.word)}`) + backHtml(w);
    const done = (ok) => { if (st.answered) return; $('#inp', root).disabled = true; $('#dock', root)?.classList.add('done'); finish(ok); };
    handlers.giveup = () => done(false);
    it._submit = () => { const v = $('#inp', root).value; if (!v.trim()) return; done(norm(v) === norm(w.word)); };
  } else if (mode === 'mc' || mode === 'blank') {
    let question, options, correct;
    if (mode === 'mc') {
      correct = w.vi;
      options = shuffle([w.vi, ...pickOthers(w, 3, (x) => x.vi).map((x) => x.vi)]);
      question = `<div class="card fc" style="min-height:170px"><div class="big">${esc(w.word)}</div>${S.settings.showRoman && w.roman ? `<div class="muted">${esc(w.roman)}</div>` : ''}</div>`;
    } else {
      correct = w.word;
      options = shuffle([w.word, ...pickOthers(w, 3, (x) => x.word).map((x) => x.word)]);
      const sent = w.ex.includes('{') ? w.ex.replace(/\{[^}]*\}/g, '＿＿＿') : w.ex.split(w.word).join('＿＿＿');
      question = `<div class="card fc" style="min-height:170px"><div class="ko" style="font-size:24px;font-weight:650;color:var(--navy)">${esc(sent)}</div><div class="muted">${esc(w.exVi)}</div><div class="hint">Từ nào (dạng từ điển) phù hợp với chỗ trống?</div></div>`;
    }
    body = question + `<div class="opts">${options.map((o) => `<button class="opt ${mode === 'blank' ? 'ko' : ''}" data-act="pick" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    after = (ok) => verdict(ok) + backHtml(w);
    handlers.pick = (el) => {
      if (st.answered) return;
      const ok = el.dataset.v === correct;
      root.querySelectorAll('.opt').forEach((b) => { b.disabled = true; if (b.dataset.v === correct) b.classList.add('right'); });
      if (!ok) el.classList.add('wrong');
      finish(ok);
    };
  } else if (mode === 'build') {
    const target = tokensOf(w);
    let bank = shuffle(target.map((t, i) => ({ t, i })));
    if (bank.every((b, i) => b.i === i)) bank.reverse();
    const picked = [];
    const draw = () => {
      $('#ansbox', root).innerHTML = picked.map((b) => `<button class="tok" data-act="unpick" data-i="${b.i}">${esc(b.t)}</button>`).join('') || '<span class="muted small">Chạm vào các từ bên dưới theo đúng thứ tự</span>';
      $('#bank', root).innerHTML = bank.map((b) => `<button class="tok" data-act="tok" data-i="${b.i}">${esc(b.t)}</button>`).join('');
      $('#chk', root).disabled = bank.length > 0;
    };
    body = `<div class="card" style="margin-top:14px"><p class="small muted">Ghép thành câu có nghĩa:</p><p style="font-size:18px;font-weight:650">${esc(w.exVi)}</p></div>
      <div class="tokens ans" id="ansbox"></div><div class="tokens" id="bank"></div>
      <div class="grid2" style="margin-top:12px"><button class="btn ghost" data-act="giveup">Xem đáp án</button><button class="btn primary" id="chk" data-act="check">Kiểm tra</button></div>`;
    after = (ok) => verdict(ok, ok ? '' : `câu đúng: <span class="ko">${esc(target.join(' '))}</span>`) + backHtml(w);
    const move = (from, to, i) => { const k = from.findIndex((b) => b.i === i); if (k >= 0) to.push(from.splice(k, 1)[0]); draw(); };
    handlers.tok = (el) => { if (!st.answered) move(bank, picked, +el.dataset.i); };
    handlers.unpick = (el) => { if (!st.answered) move(picked, bank, +el.dataset.i); };
    handlers.check = () => { if (!st.answered) finish(picked.map((b) => b.t).join(' ') === target.join(' ')); };
    handlers.giveup = () => { if (!st.answered) finish(false); };
    it._init = draw;
  } else if (mode === 'grammar') {
    let qText, options, correct, explain = '';
    if (g.quiz && g.quiz.length) {
      const q = g.quiz[Math.floor(Math.random() * g.quiz.length)];
      qText = q.q; correct = q.opts[q.a]; options = shuffle(q.opts); explain = q.ex;
    } else {
      qText = `“${g.pattern}” có nghĩa là gì?`; correct = g.vi;
      options = shuffle([g.vi, ...shuffle(S.grammar.filter((x) => x.id !== g.id && x.vi !== g.vi)).slice(0, 3).map((x) => x.vi)]);
    }
    const isKo = g.quiz && g.quiz.length;
    body = `<div class="card fc" style="min-height:150px"><div class="ko" style="font-size:22px;font-weight:650;color:var(--navy)">${esc(qText)}</div><div class="hint">Chọn đáp án đúng</div></div>
      <div class="opts">${options.map((o) => `<button class="opt ${isKo ? 'ko' : ''}" data-act="pick" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    after = (ok) => verdict(ok) + gBackHtml(g, explain);
    handlers.pick = (el) => {
      if (st.answered) return;
      const ok = el.dataset.v === correct;
      root.querySelectorAll('.opt').forEach((b) => { b.disabled = true; if (b.dataset.v === correct) b.classList.add('right'); });
      if (!ok) el.classList.add('wrong');
      finish(ok);
    };
  }

  root.innerHTML = top + body + '<div id="after"></div>';
  bind(root, handlers);
  if (it._init) it._init();
  const form = $('#ans', root);
  if (form) { form.onsubmit = (e) => { e.preventDefault(); it._submit(); }; $('#inp', root).focus(); }
  if (mode === 'listen') speak(w.word);
}

function summary(root) {
  const s = ses;
  const pct = s.graded ? Math.round((s.right / s.graded) * 100) : null;
  const t = todayStats();
  root.innerHTML = `<div class="hero" style="padding-top:70px"><div class="big">수고했어요!</div><div class="vi">Hoàn thành phiên học</div></div>
    <div class="grid2"><div class="stat"><b>${s.rated}</b><span>Lượt trả lời</span></div><div class="stat"><b>${pct === null ? '—' : pct + '%'}</b><span>Tỉ lệ đúng</span></div>
      <div class="stat"><b>${t.newWords}</b><span>Từ mới hôm nay</span></div><div class="stat"><b>${t.reviewed}</b><span>Lượt ôn hôm nay</span></div></div>
    <div class="stack" style="margin-top:18px"><button class="btn primary block" data-act="again">Luyện tiếp</button><button class="btn block" data-act="home">Về trang chủ</button></div>`;
  bind(root, { again: () => { ses = null; go('#/practice'); }, home: () => { ses = null; go('#/home'); } });
}

export const startToday = () => { source = 'today'; start('ko-vi'); };
