import { S, setSetting } from '../store.js';
import { esc, $, go, bind, header, icon, toast } from '../ui.js';
import { speak, startRec, stopRec, recSupported, ttsSupported } from '../tts.js';
import { analyze, conjugate } from '../conjugate.js';
import { TASKS, aiReady, ask } from '../ai.js';

// ---------- Chia động từ ----------
export function viewConjugate(root, _rest, query) {
  let word = (query && query.get('w')) || '';
  let pick = 0;
  const result = () => {
    if (!word) return `<div class="card"><p class="muted small">Ví dụ để thử:</p><div class="chips" style="margin-top:6px">${['먹다', '듣다', '돕다', '살다', '모르다', '그렇다', '낫다', '걷다', '예쁘다', '공부하다'].map((w) => `<button class="chip ko" data-act="try" data-w="${w}">${w}</button>`).join('')}</div></div>`;
    const a = analyze(word);
    if (a.error) return `<div class="notice">${esc(a.error)}</div>`;
    const c = a.candidates[Math.min(pick, a.candidates.length - 1)];
    const r = conjugate(a.word, c.type);
    const multi = a.candidates.length > 1;
    return `
      ${multi ? `<div class="notice ${c.certain ? 'info' : ''}"><b>${c.certain ? 'Từ này có nhiều nghĩa với cách chia khác nhau' : '⚠ Cần kiểm chứng'}</b>${c.certain ? '' : `<br>${esc(c.why || '')}`}<br>Chọn cách chia:
        <div class="chips" style="margin:8px 0 0;padding:0">${a.candidates.map((x, i) => `<button class="chip ${i === pick ? 'on' : ''}" data-act="pick" data-i="${i}">${esc(x.label)}${x.meaning ? ' · ' + esc(x.meaning) : ''}</button>`).join('')}</div></div>`
      : !c.certain ? `<div class="notice"><b>⚠ Cần kiểm chứng</b><br>${esc(c.why || '')}</div>`
      : `<div class="notice ok">Kiểu chia: <b>${esc(c.label)}</b>${c.why ? '<br><span class="small">' + esc(c.why) + '</span>' : ''}</div>`}
      ${(() => { const v = S.vocab.find((x) => x.word === a.word); const isVA = v && ['Động từ', 'Tính từ', 'Thành ngữ', 'Cụm từ', ''].includes(v.pos || '');
        return v && !isVA ? `<div class="notice"><b>⚠ Trong sổ từ, “${esc(a.word)}” là ${esc(v.pos.toLowerCase())}</b>, không phải động từ hay tính từ. Bảng chia bên dưới không áp dụng cho từ này.</div>`
          : !v && c.type !== 'ncop' ? '<p class="small muted" style="margin:-4px 2px 10px">Công cụ chia theo quy tắc và không kiểm tra từ có tồn tại hay không. Hãy chắc rằng đây là động từ hoặc tính từ.</p>' : ''; })()}
      <div class="card cj"><div class="line"><span>Dạng từ điển</span><b>${esc(a.word)}</b></div><div class="line"><span>Gốc từ</span><b>${esc(r.stem)}-</b></div><div class="line"><span>Kiểu chia</span><b style="font-family:var(--ui);font-size:15px">${esc(c.label)}</b></div></div>
      ${r.groups.map(([title, rows]) => `<div class="card cj"><h3>${esc(title)}</h3>${rows.map(([l, f]) => `<div class="line"><span>${esc(l)}</span><b>${esc(f)}${ttsSupported() && !f.includes('/') && !f.includes('(') ? ` <button class="iconbtn" style="display:inline-grid;vertical-align:middle" data-act="say" data-t="${esc(f)}" aria-label="Nghe ${esc(f)}">${icon('sound')}</button>` : ''}</b></div>`).join('')}</div>`).join('')}
      <div class="card"><h2>Ghi chú</h2><ul class="notes" style="margin-top:8px">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>
      <p class="small muted center">Kết quả được tạo theo quy tắc ngữ pháp, không phải tra từ điển. Với từ hiếm, hãy đối chiếu thêm.</p>`;
  };
  root.innerHTML = header('Chia động từ', { back: '#/practice', sub: '동사 · 형용사 활용' }) + `
    <form id="f" class="row" style="margin:6px 0 14px"><input class="input ko grow" id="w" lang="ko" value="${esc(word)}" placeholder="Nhập dạng từ điển, ví dụ: 먹다" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Động từ hoặc tính từ"><button class="btn primary">Chia</button></form>
    <div id="out">${result()}</div>`;
  const run = (w) => { word = w.trim(); pick = 0; $('#w', root).value = word; $('#out', root).innerHTML = result(); };
  $('#f', root).onsubmit = (e) => { e.preventDefault(); run($('#w', root).value); $('#w', root).blur(); };
  bind(root, { try: (el) => run(el.dataset.w), pick: (el) => { pick = +el.dataset.i; $('#out', root).innerHTML = result(); }, say: (el) => speak(el.dataset.t) });
}

// ---------- Nghe & nói ----------
export function viewListen(root, _rest, query) {
  let text = (query && query.get('t')) || '';
  let url = null, recording = false;
  const samples = S.vocab.filter((w) => w.ex).slice(0, 40).sort(() => Math.random() - 0.5).slice(0, 5).map((w) => w.ex.replace(/[{}]/g, ''));
  const recHtml = () => (!recSupported() ? '<p class="muted small">Trình duyệt này không hỗ trợ ghi âm.</p>' : `
    <div class="row" style="flex-wrap:wrap"><button class="btn ${recording ? 'danger' : 'primary'}" data-act="rec">${icon('mic')} ${recording ? 'Dừng ghi' : 'Ghi âm giọng của bạn'}</button>
    ${url ? `<button class="btn" data-act="playrec">▶ Nghe lại</button><button class="btn" data-act="say">${icon('sound')} Nghe mẫu</button>` : ''}</div>
    ${url ? `<audio id="au" src="${url}" preload="auto"></audio>` : ''}`);
  root.innerHTML = header('Nghe & nói', { back: '#/practice', sub: '듣기 · 말하기' }) + `
    <div class="card"><label class="field"><span>Từ hoặc câu tiếng Hàn</span><textarea class="input ko" id="t" lang="ko" placeholder="한국어 문장을 입력하세요">${esc(text)}</textarea></label>
      <div class="row"><button class="btn primary grow" data-act="say">${icon('sound')} Nghe</button><button class="btn grow" data-act="slow">Nghe chậm</button></div>
      ${ttsSupported() ? '' : '<p class="small muted" style="margin-top:8px">Trình duyệt này không hỗ trợ đọc văn bản.</p>'}</div>
    <div class="card"><h2>Luyện nói</h2><div id="rec" style="margin-top:10px">${recHtml()}</div>
      <p class="small muted" style="margin-top:12px">Ứng dụng chỉ ghi âm để bạn tự nghe và so sánh với giọng mẫu; <b>không chấm điểm phát âm</b> và không nhận diện giọng nói. Bản ghi không được lưu lại.</p></div>
    <div class="sec">Câu mẫu để luyện</div>
    <div class="list">${samples.map((s) => `<button class="item ko" data-act="use" data-t="${esc(s)}"><span class="grow" style="font-size:17px">${esc(s)}</span></button>`).join('')}</div>
    <button class="btn block" style="margin-top:12px" data-act="voice">Chọn giọng đọc (nam / nữ)</button>`;
  const cur = () => $('#t', root).value.trim();
  const redraw = () => { $('#rec', root).innerHTML = recHtml(); };
  bind(root, {
    say: () => { if (!speak(cur())) toast('Hãy nhập nội dung tiếng Hàn'); },
    slow: () => { if (!speak(cur(), { slow: true })) toast('Hãy nhập nội dung tiếng Hàn'); },
    use: (el) => { $('#t', root).value = el.dataset.t; speak(el.dataset.t); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    voice: () => go('#/settings'),
    playrec: () => $('#au', root).play(),
    rec: async () => {
      try {
        if (!recording) { await startRec(); recording = true; if (url) URL.revokeObjectURL(url); url = null; }
        else { url = await stopRec(); recording = false; }
        redraw();
      } catch { recording = false; redraw(); toast('Không truy cập được micro. Hãy cấp quyền micro cho trang.'); }
    },
  });
}

// ---------- AI Tutor ----------
let history = null; // [{role, content}] – lưu trên thiết bị (40 tin gần nhất), không nằm trong tệp sao lưu
let busy = null;
const saveHistory = () => setSetting('tutorHistory', history.slice(-40));

export function viewTutor(root) {
  if (!aiReady()) {
    root.innerHTML = header('AI Tutor', { back: '#/home', sub: 'AI 한국어 선생님' }) + `
      <div class="notice"><b>Chưa kết nối AI.</b><br>Khu vực này cần khóa API (Claude API của Anthropic) để hoạt động. Ứng dụng không giả lập câu trả lời khi chưa có kết nối thật.</div>
      <button class="btn primary block" data-act="set">Nhập khóa API trong Cài đặt</button>
      <div class="sec">Khi kết nối, gia sư AI có thể</div>
      <div class="list">${TASKS.map(([t], i) => `<div class="item"><span class="tag">${i + 1}</span><span class="grow">${esc(t)}</span></div>`).join('')}</div>`;
    bind(root, { set: () => go('#/settings') });
    return;
  }
  if (!history) history = Array.isArray(S.settings.tutorHistory) ? S.settings.tutorHistory.filter((m) => m && typeof m.content === 'string') : [];
  const msgHtml = (m) => `<div class="msg ${m.role === 'user' ? 'user' : m.error ? 'err' : 'ai'} ko">${esc(m.content)}</div>`;
  root.innerHTML = header('AI Tutor', { back: '#/home', sub: 'AI 한국어 선생님', right: `<button class="iconbtn" data-act="clear" aria-label="Cuộc trò chuyện mới">${icon('trash')}</button>` }) + `
    <div class="chips">${TASKS.map(([t], i) => `<button class="chip" data-act="task" data-i="${i}">${esc(t)}</button>`).join('')}</div>
    <div class="chat" id="chat" aria-live="polite">${history.length ? history.map(msgHtml).join('') : '<div class="empty">Chọn một chức năng ở trên hoặc đặt câu hỏi bất kỳ về tiếng Hàn.<br><span class="small">AI có thể sai — hãy đối chiếu từ điển với thông tin quan trọng.</span></div>'}</div>
    <form class="composer" id="f"><textarea class="input ko grow" id="m" rows="1" placeholder="Hỏi gia sư tiếng Hàn…" aria-label="Tin nhắn"></textarea><button class="btn primary" id="send">Gửi</button></form>`;
  const chat = $('#chat', root), box = $('#m', root);
  const bottom = () => window.scrollTo(0, document.body.scrollHeight);
  bottom();
  const send = async () => {
    const text = box.value.trim(); if (!text || busy) return;
    if (!history.length) chat.innerHTML = '';
    history.push({ role: 'user', content: text });
    chat.insertAdjacentHTML('beforeend', msgHtml(history[history.length - 1]));
    const userEl = chat.lastElementChild;
    box.value = '';
    const el = document.createElement('div'); el.className = 'msg ai ko'; el.textContent = '…'; chat.appendChild(el); bottom();
    busy = new AbortController(); $('#send', root).textContent = 'Dừng';
    try {
      const answer = await ask(history.filter((m) => !m.error).map(({ role, content }) => ({ role, content })), (t) => { el.textContent = t; }, busy.signal);
      history.push({ role: 'assistant', content: answer || '(Không có nội dung trả lời)' }); el.textContent = history[history.length - 1].content;
      saveHistory();
    } catch (e) {
      // Tin chưa được trả lời không nằm trong ngữ cảnh các lần gửi sau; trả lại ô nhập để gửi lại.
      history.pop(); userEl.remove(); if (!box.value) box.value = text;
      el.className = 'msg err'; el.textContent = e.name === 'AbortError' ? 'Đã dừng. Câu hỏi được trả lại ô nhập.' : 'Không nhận được câu trả lời. ' + (e.message === 'Failed to fetch' || e.message === 'Load failed' ? 'Kiểm tra kết nối mạng (AI Tutor cần Internet).' : e.message);
    }
    busy = null; const b = $('#send', root); if (b) b.textContent = 'Gửi';
  };
  $('#f', root).onsubmit = (e) => { e.preventDefault(); if (busy) busy.abort(); else send(); };
  bind(root, {
    task: (el) => { box.value = TASKS[+el.dataset.i][1]; box.focus(); },
    clear: () => { if (busy) busy.abort(); history = []; saveHistory(); viewTutor(root); },
  });
}
