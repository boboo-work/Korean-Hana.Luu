// Hai mini game chuyển từ app tiếng Anh "Từ Vựng": "Chạy & Gõ" và "Bắn Từ".
// Khác biệt chính: gõ bằng bàn phím tiếng Hàn, nên ô chữ tính theo ÂM TIẾT và hiểu trạng thái đang ghép chữ
// (ㅎ → 하 → 학). Ô nhập không bị xóa giữa các từ để bộ gõ Hangul không bị rối; phần đã dùng được bỏ qua.
//
// Cách chọn từ ("vòng phủ"): mỗi từ đã học phải được chơi ít nhất một lần trước khi từ nào được chơi lần hai.
// Thứ tự theo "lâu chưa chơi nhất"; từ đến hạn ôn / từ sai lần trước chỉ chiếm 1/3 số chỗ nên không chặn các từ còn lại.
import { S, setSetting } from '../store.js';
import { esc, $, go, bind, header, icon, shuffle, lockBounce } from '../ui.js';
import { speak } from '../tts.js';
import { gameAnswer, isDue } from '../srs.js';
import { dec, isSyl } from '../conjugate.js';

export const GAME_MIN = 5;
const LIVES = 3, ROUND = 15, MAX_SYL = 8;

// ---- Nhân vật & chướng ngại vật (lấy từ app tiếng Anh) ----
const HEROES = {
  mochi: { name: 'Mochi', svg: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 12c-1-6 3-9 8-9-1 5-3 8-8 9z" fill="#3E9B6B"/><rect class="leg a" x="21" y="52" width="8" height="10" rx="4" fill="#C9603A"/><rect class="leg b" x="35" y="52" width="8" height="10" rx="4" fill="#C9603A"/><ellipse cx="32" cy="34" rx="23" ry="22" fill="#F08A5D"/><ellipse cx="34" cy="42" rx="13" ry="10" fill="#FBD3B8"/><circle cx="27" cy="29" r="6" fill="#fff"/><circle cx="43" cy="29" r="6" fill="#fff"/><circle cx="29" cy="30" r="2.8" fill="#1B1B1F"/><circle cx="45" cy="30" r="2.8" fill="#1B1B1F"/><path d="M31 40q5 4 10 0" fill="none" stroke="#7A2E14" stroke-width="2.2" stroke-linecap="round"/></svg>` },
  bolt: { name: 'Bolt', svg: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 12V5" stroke="#5A6B8C" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="4" r="3.5" fill="#F2B632"/><rect class="leg a" x="20" y="52" width="9" height="10" rx="3" fill="#2B3F6B"/><rect class="leg b" x="35" y="52" width="9" height="10" rx="3" fill="#2B3F6B"/><rect x="10" y="12" width="44" height="42" rx="12" fill="#4A6FB5"/><rect x="16" y="20" width="34" height="17" rx="8.5" fill="#12203D"/><circle cx="28" cy="28.5" r="4" fill="#7FE3C4"/><circle cx="42" cy="28.5" r="4" fill="#7FE3C4"/><rect x="24" y="43" width="18" height="4" rx="2" fill="#C9D6F2"/></svg>` },
};
const OBSTACLES = [
  `<svg viewBox="0 0 48 40" aria-hidden="true"><rect x="2" y="27" width="44" height="12" rx="2.5" fill="#2A78D6"/><rect x="6" y="15" width="38" height="12" rx="2.5" fill="#EB6834"/><rect x="4" y="3" width="36" height="12" rx="2.5" fill="#1BAF7A"/><path d="M8 33h14M12 21h12M9 9h10" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".75"/></svg>`,
  `<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M3 39 10 18l9-9 12-3 11 12 4 21z" fill="#8C8A80"/><path d="M19 9l4 12-7 8M31 6l-2 14 8 9" fill="none" stroke="#6C6A62" stroke-width="2" stroke-linecap="round"/></svg>`,
  `<svg viewBox="0 0 48 40" aria-hidden="true"><rect x="5" y="14" width="38" height="25" rx="3" fill="#B7793A"/><path d="M5 22h38M24 14v25" stroke="#8A5622" stroke-width="2.5"/><rect x="18" y="5" width="12" height="9" rx="2" fill="none" stroke="#8A5622" stroke-width="2.5"/></svg>`,
];
const HAMMER = `<svg viewBox="0 0 40 56" aria-hidden="true"><rect x="17" y="14" width="6" height="40" rx="3" fill="#B7793A"/><rect x="3" y="2" width="34" height="18" rx="5" fill="#6C7280"/><rect x="3" y="2" width="9" height="18" rx="4" fill="#8E95A3"/></svg>`;

// ---- Kỷ lục, nhân vật, mốc vòng phủ (lưu trong IndexedDB) ----
const prefs = () => ({ best: 0, hero: 'mochi', drop: null, cycle: 0, ...(S.settings.game || {}) });
const savePrefs = (patch) => setSetting('game', { ...prefs(), ...patch });

const core = (s) => String(s || '').replace(/\s+/g, '');       // bỏ khoảng trắng: người chơi gõ có hay không cũng được
const norm = (s) => String(s || '').toLowerCase().trim();
const wordOf = (id) => S.vocab.find((w) => w.id === id);
const fmtTime = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const sylCount = (w) => core(w.word).length;

// ---- Nguồn từ ----
/** Từ đã học nhưng không chơi được vẫn được đếm, kèm lý do, để người dùng biết vì sao không thấy từ đó. */
export function poolInfo() {
  const learned = S.vocab.filter((w) => (S.srs['v:' + w.id] || {}).first);
  const reasons = { noMeaning: 0, tooLong: 0, notHangul: 0 };
  const pool = [];
  for (const w of learned) {
    const c = core(w.word);
    if (!c || ![...c].every(isSyl)) { reasons.notHangul++; continue; }
    if (c.length > MAX_SYL) { reasons.tooLong++; continue; }
    if (!(w.vi || '').trim()) { reasons.noMeaning++; continue; }
    pool.push(w);
  }
  return { total: S.vocab.length, learned: learned.length, pool, reasons };
}
export const gamePool = () => poolInfo().pool;

/** Lượt chơi game gần nhất của mỗi từ (lấy từ nhật ký học). */
export function lastGame() {
  const m = new Map();
  for (const r of S.reviews) if (r.mode === 'game' && r.t) { const p = m.get(r.key); if (!p || r.t > p.t) m.set(r.key, r); }
  return m;
}
/** Vòng phủ: một vòng xong khi mọi từ dùng được đã được chơi kể từ mốc `cycle`. */
export function coverInfo(pool = gamePool(), last = lastGame()) {
  const start = prefs().cycle || 0;
  const covered = pool.filter((w) => { const r = last.get('v:' + w.id); return r && r.t >= start; }).length;
  return { n: pool.length, covered, done: pool.length > 0 && covered === pool.length, start };
}
const maybeNewCycle = (pool, last) => { if (coverInfo(pool, last).done) savePrefs({ cycle: Date.now() }).catch(console.error); };

/** Chọn `count` từ: ưu tiên từ lâu chưa chơi nhất; từ đến hạn / sai lần trước chiếm tối đa 1 trong 3 chỗ. */
export function pickWords(pool, count, last = lastGame()) {
  const t = (w) => (last.get('v:' + w.id) || { t: 0 }).t;
  const asc = (arr) => shuffle(arr).sort((a, b) => t(a) - t(b)); // xáo trước, sort ổn định → bằng nhau thì ngẫu nhiên
  const urgent = (w) => isDue(S.srs['v:' + w.id]) || (last.get('v:' + w.id) || {}).q === 1;
  const prio = asc(pool.filter(urgent)), rest = asc(pool.filter((w) => !urgent(w)));
  const out = []; let pi = 0, ri = 0;
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const wantPrio = i % 3 === 0;
    if ((wantPrio && pi < prio.length) || ri >= rest.length) out.push(prio[pi++]); else out.push(rest[ri++]);
  }
  return out;
}

// ---- Đáp án chấp nhận & từ trùng nghĩa ----
/** Đáp án hợp lệ: chính từ đó và các từ đồng nghĩa người dùng đã ghi ở trường "Từ đồng nghĩa". */
export function alts(w) {
  const out = [core(w.word)];
  for (const s of String(w.syn || '').split(/[,;/·、，]/)) {
    const c = core(s);
    if (c && c.length <= MAX_SYL && [...c].every(isSyl) && !out.includes(c)) out.push(c);
  }
  return out;
}
/** Có từ khác cùng nghĩa (hoặc liệt kê nhau là đồng nghĩa) thì phải gợi ý để người chơi không bị oan. */
export function hasSiblings(w) {
  const v = norm(w.vi), me = alts(w), cw = core(w.word);
  return S.vocab.some((o) => o.id !== w.id && (norm(o.vi) === v || me.includes(core(o.word)) || alts(o).includes(cw)));
}

// ---- Gõ Hangul ----
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
const JSPLIT = { 3: [1, 19], 5: [4, 22], 6: [4, 27], 9: [8, 1], 10: [8, 16], 11: [8, 17], 12: [8, 19], 13: [8, 25], 14: [8, 26], 15: [8, 27], 18: [17, 19] }; // patchim kép → [phần đầu, phần sau]
const VBASE = { 9: [8], 10: [8, 9], 11: [8], 14: [13], 15: [13, 14], 16: [13], 19: [18] }; // nguyên âm ghép → các dạng đang gõ dở
const choOfJong = (j) => CHO.indexOf(JONG[j]);

/** Trạng thái của âm tiết đang gõ so với âm tiết đích: 'ok' | 'pend' (đang ghép, chưa sai) | 'bad'. */
export function sylState(typed, target, next) {
  if (typed === target) return 'ok';
  if (!isSyl(target)) return 'bad';
  const [tc, tv, tj] = dec(target);
  if (CHO.includes(typed)) return CHO.indexOf(typed) === tc ? 'pend' : 'bad';
  if (!isSyl(typed)) return 'bad';
  const [c, v, j] = dec(typed);
  if (c !== tc) return 'bad';
  if (v !== tv) return (VBASE[tv] || []).includes(v) && j === 0 ? 'pend' : 'bad';
  if (j === 0) return 'pend';
  const nextCho = next && isSyl(next) ? dec(next)[0] : -1;
  if (tj === 0) return choOfJong(j) === nextCho ? 'pend' : 'bad';                       // 갇 khi đích là 가 + 다
  if (JSPLIT[tj] && JSPLIT[tj][0] === j) return 'pend';                                  // 일 khi đích là 읽
  if (JSPLIT[j] && JSPLIT[j][0] === tj && choOfJong(JSPLIT[j][1]) === nextCho) return 'pend'; // 읽 khi đích là 일 + 가
  return 'bad';
}

/** Phần người chơi đã gõ cho từ hiện tại, bỏ qua phần ô nhập đã dùng cho các từ trước. */
export function typedOf(value, used) {
  value = value.normalize('NFC');
  if (!used) return value;
  if (value.startsWith(used)) return value.slice(used.length);
  // Bộ gõ vừa ghép phụ âm mới vào âm tiết cuối của từ trước (교 + ㅇ → 굥): tách phụ âm đó ra.
  const k = used.length - 1, p = used[k], c = value[k];
  if (c && value.slice(0, k) === used.slice(0, k) && isSyl(p) && isSyl(c)) {
    const [pc, pv, pj] = dec(p), [cc, cv, cj] = dec(c);
    if (pc === cc && pv === cv && cj !== pj) {
      if (pj === 0) return (JSPLIT[cj] ? JONG[JSPLIT[cj][0]] + JONG[JSPLIT[cj][1]] : JONG[cj]) + value.slice(k + 1);
      if (JSPLIT[cj] && JSPLIT[cj][0] === pj) return JONG[JSPLIT[cj][1]] + value.slice(k + 1);
    }
  }
  let i = 0; while (i < value.length && i < used.length && value[i] === used[i]) i++;
  return value.slice(i);
}

/** Ô chữ theo âm tiết: đúng = xanh, đang ghép = viền xanh dương, sai = đỏ. Khoảng trắng trong từ hiện thành khoảng cách. */
export function slots(word, typed = '', reveal = false, hint = false) {
  const syl = [], gapAfter = new Set();
  for (const ch of [...word]) { if (/\s/.test(ch)) { if (syl.length) gapAfter.add(syl.length - 1); } else syl.push(ch); }
  const t = [...String(typed).replace(/\s/g, '')];
  const out = [];
  syl.forEach((ch, i) => {
    if (t[i] === undefined) {
      const hinted = hint && i === 0 && !t.length;
      out.push(`<i class="${reveal ? 'show' : hinted ? 'hint' : ''}">${reveal || hinted ? esc(ch) : ''}</i>`);
    } else {
      const st = i === t.length - 1 ? sylState(t[i], ch, syl[i + 1]) : (t[i] === ch ? 'ok' : 'bad');
      out.push(`<i class="${st}">${esc(t[i])}</i>`);
    }
    if (gapAfter.has(i)) out.push('<i class="sp"></i>');
  });
  // Gõ dư: âm tiết dư cuối cùng có thể chỉ là phụ âm đang chờ ghép, nên chỉ báo sai khi dư từ 2 ký tự.
  const extra = t.slice(syl.length);
  if (extra.length > 1 || (extra.length === 1 && isSyl(extra[0]))) for (const x of extra.slice(0, 4)) out.push(`<i class="bad">${esc(x)}</i>`);
  return out.join('');
}
const hasBad = (html) => html.includes('class="bad"');

/** Chọn đáp án đang được gõ: từ chính, hoặc từ đồng nghĩa nếu chữ đã gõ khớp từ đó. */
function resolve(w, typed) {
  const list = alts(w);
  const target = typed ? (list.find((c) => !hasBad(slots(c, typed))) || list[0]) : list[0];
  return { target, shown: target === core(w.word) ? w.word : target };
}

// Ô nhập dùng chung cho hai game. Chữ trong ô được ẩn (người chơi nhìn các ô chữ phía trên); nhãn cho biết trạng thái bàn phím.
const inputHtml = `<div class="g-kb"><input class="input ko g-input" id="gi" type="text" lang="ko" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Gõ từ tiếng Hàn"><span class="g-kb-l off" aria-hidden="true">⌨ Chạm để gõ tiếng Hàn</span><span class="g-kb-l on" aria-hidden="true">⌨ Đang gõ…</span></div>`;
function wireInput(root, state, onType, onBlur, onFocus) {
  const el = $('#gi', root);
  state.used = ''; state.composing = false;
  el.addEventListener('compositionstart', () => { state.composing = true; });
  el.addEventListener('compositionend', () => {
    state.composing = false;
    if (state.used && el.value === state.used) { el.value = ''; state.used = ''; } // điểm an toàn để dọn ô nhập
    onType(el);
  });
  el.addEventListener('input', () => {
    if (state.used && state.used.startsWith(el.value) && el.value.length < state.used.length) state.used = el.value; // xóa lùi vào phần cũ
    onType(el);
  });
  el.addEventListener('blur', () => setTimeout(onBlur, 150)); // bàn phím bị ẩn → tạm dừng, chờ người chơi chạm tiếp
  el.addEventListener('focus', () => onFocus && onFocus()); // chạm thẳng vào ô nhập khi đang tạm dừng → chơi tiếp
  return el;
}
const consume = (state, el) => { state.used = el.value.normalize('NFC'); };
const overlay = '<button class="g-pause" data-act="resume" hidden>⏸ Tạm dừng · Chạm để tiếp tục</button>';

// ---- Pháo giấy ----
function confetti(count = 100) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelector('canvas.confetti')?.remove();
  const cv = document.createElement('canvas'); cv.className = 'confetti';
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; document.body.appendChild(cv);
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const colors = ['#3D5A98', '#EB6834', '#1F7450', '#F2B632', '#8E6BD8'];
  const parts = Array.from({ length: count }, (_, i) => { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 7 + Math.random() * 9;
    return { x: W / 2 + (Math.random() - 0.5) * 60, y: H * 0.42, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length] }; });
  const DUR = 1800, t0 = performance.now(); let last = t0;
  const frame = (now) => {
    const t = now - t0, k = Math.min(3, (now - last) / 16.7); last = now;
    ctx.clearRect(0, 0, W, H); ctx.globalAlpha = t > DUR - 400 ? Math.max(0, (DUR - t) / 400) : 1;
    for (const p of parts) { p.vy += 0.32 * k; p.vx *= 0.99; p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }
    if (t < DUR && cv.isConnected) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
  setTimeout(() => cv.remove(), DUR + 600);
}

const missedHtml = (ids) => { const ws = ids.map(wordOf).filter(Boolean); return ws.length ? `<div class="sec">Từ cần ôn lại</div><div class="card g-missed">${ws.map((w) => `<p><b class="ko" style="font-size:19px">${esc(w.word)}</b> <span class="muted small">${esc(w.roman || '')}</span><br><span class="muted small">${esc(w.vi)}</span></p>`).join('')}</div>` : ''; };
const notReady = (n) => `<p class="small center" style="margin-top:18px;color:var(--warn);font-weight:650">Cần học ít nhất ${GAME_MIN} từ để chơi (hiện có ${n} từ phù hợp).</p><button class="btn block" style="margin-top:10px" data-act="learn">Sang phần Luyện tập</button>`;
const coverLine = () => { const c = coverInfo(); return `Vòng phủ: <b>${c.covered}/${c.n}</b> từ đã chơi${c.done ? ' — lần chơi tới bắt đầu vòng mới' : ''}`; };
function poolNote() {
  const i = poolInfo(), parts = [];
  if (i.reasons.noMeaning) parts.push(`${i.reasons.noMeaning} thiếu nghĩa`);
  if (i.reasons.tooLong) parts.push(`${i.reasons.tooLong} dài quá ${MAX_SYL} âm tiết`);
  if (i.reasons.notHangul) parts.push(`${i.reasons.notHangul} không phải toàn Hangul`);
  const fresh = i.total - i.learned;
  return `<p class="muted small" style="margin-top:10px">${i.pool.length} từ dùng được · ${i.learned}/${i.total} từ đã học${fresh ? ` (${fresh} từ chưa học chưa vào game)` : ''}${parts.length ? ` · bị loại: ${parts.join(', ')}` : ''}</p><p class="small" style="margin-top:6px">${coverLine()}</p>`;
}

// =====================================================================
// Game 1: Chạy & Gõ
// =====================================================================
let G = null;
const runTime = (w) => (4 + 1.8 * sylCount(w)) * Math.max(0.55, 1 - 0.025 * G.score) * 1000;

export function viewRun(root) {
  if (G && G.phase === 'play') G = null; // quay lại màn hình khi vòng lặp đã dừng: bắt đầu lại từ đầu
  drawRun(root);
}

function drawRun(root) {
  const p = prefs();
  const q = (sel) => $(sel, root);
  const hearts = () => Array.from({ length: LIVES }, (_, i) => `<span class="${i < G.lives ? 'on' : ''}">♥</span>`).join('');
  const buildQueue = (avoid) => { const pool = gamePool(); const ids = pickWords(pool, pool.length, lastGame()).map((w) => w.id); if (ids.length > 1 && ids[0] === avoid) ids.push(ids.shift()); return ids; };
  const cur = () => {
    for (let guard = 0; guard < 500; guard++) {
      if (G.i >= G.queue.length) { G.queue = buildQueue(G.queue[G.queue.length - 1]); G.i = 0; if (!G.queue.length) return null; }
      const w = wordOf(G.queue[G.i]); if (w) return w; G.i++;
    }
    return null;
  };
  // Chỉ lần gặp ĐẦU TIÊN của mỗi từ trong lượt chơi được ghi vào lịch ôn; các lần gặp lại (sau khi trượt) chỉ để luyện.
  const record = (w, ok) => { if (G.seen.has(w.id)) return; G.seen.add(w.id); gameAnswer('v:' + w.id, ok).catch(console.error); };
  const place = (prog) => {
    const stage = q('.g-stage'), obs = q('.g-obs'), hero = q('.g-hero'); if (!stage || !obs || !hero) return;
    const start = stage.clientWidth + 8, end = hero.offsetLeft + hero.offsetWidth - 16;
    obs.style.transform = `translateX(${start - (start - end) * Math.min(1, prog)}px)`;
  };
  const hud = () => { q('.g-hearts').innerHTML = hearts(); q('.g-score b').textContent = G.score; };
  const pause = () => { if (G.paused) return; G.paused = true; q('.g-pause').hidden = false; };
  const resume = () => { if (!G.paused) return; G.paused = false; q('.g-pause').hidden = true; G.last = 0; q('#gi').focus({ preventScroll: true }); };
  const showWord = () => {
    const w = cur(); if (!w) { G = null; return drawRun(root); }
    G.mode = 'run'; G.t = 0; G.T = runTime(w); G.hint = hasSiblings(w);
    const obs = q('.g-obs'); obs.style.transition = 'none'; obs.innerHTML = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
    place(0);
    q('.g-hero').classList.remove('jump', 'hurt'); q('.g-stage').classList.remove('stop');
    q('.g-meaning').textContent = w.vi; q('.g-pos').textContent = w.pos || ''; q('.g-pos').hidden = !w.pos;
    q('.g-slots').innerHTML = slots(w.word, '', false, G.hint);
    q('.g-note').textContent = G.hint ? `Có từ khác cùng nghĩa — gợi ý chữ đầu: “${[...core(w.word)][0]}”` : 'Gõ từ tiếng Hàn để nhảy qua'; q('.g-note').className = 'g-note';
    q('.g-skip').hidden = false;
    consume(G, q('#gi')); q('#gi').classList.remove('bad');
    if (document.activeElement !== q('#gi')) pause(); // bàn phím đang ẩn: không để chướng ngại vật chạy khi người chơi chưa gõ được
  };
  const correct = () => {
    const w = cur(); G.mode = 'jumping'; G.score++;
    record(w, true);
    hud(); q('.g-slots').innerHTML = slots(w.word, w.word); speak(w.word);
    q('.g-skip').hidden = true; q('.g-hero').classList.add('jump');
    const obs = q('.g-obs'); obs.style.transition = 'transform .5s linear'; obs.style.transform = 'translateX(-90px)';
    G.i++;
    setTimeout(() => { if (G && G.phase === 'play' && G.mode === 'jumping' && root.isConnected && q('.g-stage')) showWord(); }, 560);
  };
  const miss = () => {
    const w = cur(); G.mode = 'retype'; G.lives--;
    if (!G.missed.includes(w.id)) G.missed.push(w.id);
    record(w, false);
    hud(); q('.g-hero').classList.add('hurt'); q('.g-stage').classList.add('stop'); speak(w.word);
    q('.g-skip').hidden = true;
    q('.g-slots').innerHTML = slots(w.word, '', true);
    consume(G, q('#gi')); q('#gi').classList.remove('bad');
    if (G.lives <= 0) {
      G.mode = 'dead';
      setTimeout(async () => {
        if (!G || G.mode !== 'dead') return;
        G.newBest = G.score > p.best; if (G.newBest) await savePrefs({ best: G.score });
        G.phase = 'over'; cancelAnimationFrame(G.raf); drawRun(root);
        if (G.newBest) confetti(120);
      }, 1100);
      return;
    }
    q('.g-note').textContent = `Trượt! ${w.roman ? w.roman + ' · ' : ''}gõ lại để chạy tiếp`; q('.g-note').className = 'g-note bad';
  };
  const onType = (el) => {
    if (!G || G.phase !== 'play' || (G.mode !== 'run' && G.mode !== 'retype')) return;
    const w = cur(), typed = typedOf(el.value, G.used).replace(/\s/g, '');
    const { target, shown } = resolve(w, typed);
    const html = slots(shown, typed, G.mode === 'retype' && !typed, G.hint && !typed);
    q('.g-slots').innerHTML = html; el.classList.toggle('bad', hasBad(html));
    if (typed !== target) return;
    consume(G, el);
    if (G.mode === 'run') correct();
    else { const id = G.queue[G.i]; G.i++; G.queue.splice(Math.min(G.queue.length, G.i + 3), 0, id); showWord(); } // từ trượt quay lại sau vài từ
  };
  const onBlur = () => { if (G && G.phase === 'play' && G.mode === 'run' && !G.paused && root.isConnected && q('.g-stage') && document.activeElement !== q('#gi')) pause(); };
  const frame = (ts) => {
    if (!G || G.phase !== 'play' || !location.hash.startsWith('#/game-run') || !q('.g-stage')) { if (G) G.raf = 0; return; }
    const dt = Math.min(100, ts - (G.last || ts)); G.last = ts;
    if (G.mode === 'run' && !G.paused) {
      // Phòng khi trình duyệt không phát sự kiện blur: ô nhập mất focus quá 250 ms thì tạm dừng.
      if (document.activeElement === q('#gi')) G.blurAt = 0; else if (!G.blurAt) G.blurAt = ts; else if (ts - G.blurAt > 250) pause();
    }
    if (G.mode === 'run' && !document.hidden && !G.paused) { G.t += dt; place(G.t / G.T); if (G.t >= G.T) miss(); }
    G.raf = requestAnimationFrame(frame);
  };
  const begin = (keep) => {
    const pool = gamePool(); maybeNewCycle(pool, lastGame());
    if (!keep || !G) G = { queue: buildQueue(), i: 0 };
    Object.assign(G, { phase: 'play', lives: LIVES, score: 0, missed: [], best: prefs().best, hero: prefs().hero, newBest: false, mode: 'run', t: 0, T: 1, last: 0, seen: new Set(), paused: false, hint: false, blurAt: 0 });
    drawRun(root);
  };
  const quit = () => { if (G && G.raf) cancelAnimationFrame(G.raf); G = null; go('#/practice'); };

  root.onpointerdown = null;
  if (G && G.phase === 'play') {
    root.innerHTML = `<div class="game">
      <div class="g-top"><button class="iconbtn" data-act="quit" aria-label="Thoát">${icon('x')}</button><div class="g-hearts" aria-label="Số mạng">${hearts()}</div><div class="g-score"><b>${G.score}</b><small>Kỷ lục ${G.best}</small></div></div>
      <div class="g-row"><button class="btn sm g-skip" data-act="skip">Không biết</button>${inputHtml}</div>
      <div class="g-stage" data-act="focus"><i class="g-cloud c1"></i><i class="g-cloud c2"></i><div class="g-hero">${(HEROES[G.hero] || HEROES.mochi).svg}</div><div class="g-obs"></div><div class="g-ground"></div>${overlay}</div>
      <div class="g-prompt" data-act="focus"><p class="g-meaning"></p><span class="tag g-pos" hidden></span><div class="g-slots ko"></div><p class="g-note"></p></div></div>`;
    lockBounce(root);
    root.onpointerdown = (e) => { if (e.target.closest('.g-skip, .g-stage, .g-prompt')) e.preventDefault(); }; // chạm vào game không làm ẩn bàn phím
    bind(root, {
      quit, focus: () => { if (G.paused) resume(); else q('#gi').focus({ preventScroll: true }); }, resume,
      skip: () => { if (G && G.phase === 'play' && G.mode === 'run') { G.paused = false; q('.g-pause').hidden = true; miss(); } },
    });
    const el = wireInput(root, G, onType, onBlur, () => { if (G && G.paused) resume(); });
    el.focus({ preventScroll: true }); // focus ngay trong lượt chạm để iOS bật bàn phím
    showWord();
    cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(frame);
    G.debug = { miss, pause, resume, tick: (ms) => { G.t += ms; if (G.mode === 'run' && G.t >= G.T) miss(); } };
    return;
  }
  if (G && G.phase === 'over') {
    root.innerHTML = `<div class="gpage">${header('Chạy & Gõ', { back: '#/practice' })}
      <div class="card g-over gfix"><div class="g-hero big hurt-still">${(HEROES[G.hero] || HEROES.mochi).svg}</div><p class="small muted" style="font-weight:700">${G.newBest ? 'KỶ LỤC MỚI!' : 'HẾT MẠNG'}</p><b class="g-final">${G.score}</b><p class="muted small">từ gõ đúng · kỷ lục ${Math.max(G.best, G.score)}</p><p class="small" style="margin-top:8px">${coverLine()}</p></div>
      <div class="scroll">${missedHtml(G.missed)}</div>
      <button class="btn primary block" data-act="cont">Chơi tiếp từ từ vừa trượt</button><button class="btn ghost block" data-act="quit">Thoát</button></div>`;
    lockBounce(root);
    bind(root, { cont: () => begin(true), quit });
    return;
  }
  const n = gamePool().length;
  root.innerHTML = `<div class="gpage">${header('Chạy & Gõ', { back: '#/practice', sub: '달리기 · 타자' })}
    <div class="card gfix"><p class="muted small" style="margin-bottom:6px">Chọn nhân vật</p>
      <div class="g-pick">${Object.entries(HEROES).map(([id, h]) => `<button class="${p.hero === id ? 'on' : ''}" data-act="hero" data-hero="${id}" aria-pressed="${p.hero === id}"><span class="g-hero big">${h.svg}</span><b>${h.name}</b></button>`).join('')}</div></div>
    <div class="card scroll"><b>Cách chơi</b><ul class="g-rules">
      <li>Màn hình hiện nghĩa tiếng Việt — gõ đúng từ tiếng Hàn để nhảy qua chướng ngại vật.</li>
      <li>Gõ nhầm cứ xóa và sửa. Chỉ mất mạng khi chướng ngại vật chạm tới mà chưa gõ xong, hoặc khi bấm “Không biết”.</li>
      <li>Bàn phím bị ẩn thì game tự tạm dừng; chạm màn hình để chơi tiếp.</li>
      <li>Có ${LIVES} mạng. Hết mạng, bạn chơi tiếp từ đúng từ vừa trượt.</li>
      <li>Mọi từ đã học lần lượt xuất hiện hết một vòng rồi mới lặp lại. Chỉ lần gặp đầu của mỗi từ được tính vào lịch ôn; trượt chỉ đưa từ vào danh sách ôn hôm nay, không đặt lại chu kỳ.</li></ul>
      <p class="muted small" style="margin-top:10px">Kỷ lục: <b>${p.best}</b> từ</p>${poolNote()}</div>
    ${n >= GAME_MIN ? '<button class="btn primary block" data-act="start">Bắt đầu</button>' : notReady(n)}</div>`;
  lockBounce(root);
  bind(root, { start: () => begin(false), hero: async (el) => { await savePrefs({ hero: el.dataset.hero }); drawRun(root); }, learn: () => go('#/practice') });
}

// =====================================================================
// Game 2: Bắn Từ
// =====================================================================
let D = null;
const dropTime = (w) => (9 + 1.8 * sylCount(w)) * 1000;

export function viewDrop(root) {
  if (D && D.phase === 'play') D = null;
  drawDrop(root);
}

function drawDrop(root) {
  const q = (sel) => $(sel, root);
  const cur = () => wordOf(D.queue[0]);
  const record = (w, ok) => { if (D.seen.has(w.id)) return; D.seen.add(w.id); gameAnswer('v:' + w.id, ok).catch(console.error); };
  const range = () => { const stage = q('.d-stage'), tile = q('.d-tile'); const top = q('.d-meaning').offsetHeight + 14; return { top, bottom: Math.max(top, stage.clientHeight - 30 - tile.offsetHeight) }; };
  const place = (prog) => { const tile = q('.d-tile'); if (!tile) return; const { top, bottom } = range(); tile.style.transform = `translate(-50%, ${top + (bottom - top) * Math.min(1, prog)}px)`; };
  const after = (ms, fn) => { const step = D.step; setTimeout(() => { if (D && D.phase === 'play' && D.step === step && q('.d-stage')) fn(); }, ms); };
  const pause = () => { if (D.paused) return; D.paused = true; q('.g-pause').hidden = false; };
  const resume = () => { if (!D.paused) return; D.paused = false; q('.g-pause').hidden = true; D.last = 0; q('#gi').focus({ preventScroll: true }); };
  const showWord = () => {
    while (D.queue.length && !cur()) D.queue.shift();
    if (!D.queue.length) return finish();
    const w = cur(); D.mode = 'fall'; D.t = 0; D.T = dropTime(w); D.step++; D.hint = hasSiblings(w);
    q('.d-meaning').innerHTML = `${esc(w.vi)}${w.pos ? ` <span class="tag">${esc(w.pos)}</span>` : ''}${D.hint ? ' <span class="tag warn">nhiều từ cùng nghĩa</span>' : ''}`;
    const tile = q('.d-tile'); tile.className = 'd-tile'; tile.style.transition = 'none'; tile.innerHTML = `<div class="g-slots ko">${slots(w.word, '', false, D.hint)}</div>`;
    q('.d-badge').className = 'd-badge'; q('.d-answer').hidden = true; q('.g-skip').hidden = false;
    q('.d-count').textContent = `${D.total - D.queue.length}/${D.total}`;
    q('.d-bolt').classList.remove('swing'); place(0);
    consume(D, q('#gi')); q('#gi').classList.remove('bad');
    if (document.activeElement !== q('#gi')) pause();
  };
  const correct = () => {
    const w = cur(); D.mode = 'hit';
    record(w, true);
    q('.g-skip').hidden = true;
    const tile = q('.d-tile'), stage = q('.d-stage'), gun = q('.d-mochi');
    tile.querySelector('.g-slots').innerHTML = slots(w.word, w.word); speak(w.word);
    const s = stage.getBoundingClientRect(), a = gun.getBoundingClientRect(), b = tile.getBoundingClientRect();
    const shot = document.createElement('i'); shot.className = 'd-shot'; stage.appendChild(shot);
    const from = [a.left - s.left + a.width * 0.7, a.top - s.top + 6], to = [b.left - s.left + b.width / 2, b.top - s.top + b.height / 2];
    gun.classList.remove('fire'); void gun.offsetWidth; gun.classList.add('fire');
    let landed = false;
    const land = () => {
      if (landed) return; landed = true; shot.remove();
      if (!D || D.mode !== 'hit') return;
      tile.classList.add('hit');
      const r = tile.getBoundingClientRect(), badge = q('.d-badge'), above = r.top - s.top - 44;
      badge.style.top = `${above > q('.d-meaning').offsetHeight ? above : r.bottom - s.top + 8}px`; badge.className = 'd-badge show';
    };
    try { shot.animate([{ transform: `translate(${from[0]}px, ${from[1]}px)` }, { transform: `translate(${to[0]}px, ${to[1]}px)` }], { duration: 170, easing: 'ease-in', fill: 'forwards' }).finished.then(land, land); } catch { land(); }
    setTimeout(land, 260); // phòng khi hoạt ảnh bị tạm dừng
    D.queue.shift();
    after(950, showWord);
  };
  const wrong = () => {
    const w = cur(); D.mode = 'smash';
    if (!D.missed.includes(w.id)) D.missed.push(w.id);
    record(w, false);
    q('.g-skip').hidden = true;
    const tile = q('.d-tile'); consume(D, q('#gi')); q('#gi').classList.remove('bad');
    q('.d-bolt').classList.add('swing');
    after(170, () => {
      tile.classList.add('smash');
      tile.insertAdjacentHTML('beforeend', Array.from({ length: 7 }, (_, i) => `<b class="shard" style="--x:${(i - 3) * 22}px;--y:${-18 - (i % 3) * 16}px;--r:${(i - 3) * 50}deg"></b>`).join(''));
      const ans = q('.d-answer'); ans.innerHTML = `<small>Đáp án</small><b class="ko">${esc(w.word)}</b>${w.roman ? `<span class="small">${esc(w.roman)}</span>` : ''}<em>Chạm để tiếp tục</em>`; ans.hidden = false;
      speak(w.word);
    });
    const id = D.queue.shift(); D.queue.splice(Math.min(D.queue.length, 3), 0, id); // quay lại sau vài lượt
    after(2600, showWord);
  };
  const finish = async () => {
    const first = D.total - D.missed.length, old = prefs().drop;
    D.newBest = D.total >= ROUND && (!old || first > old.first || (first === old.first && D.elapsed < old.ms));
    if (D.newBest) await savePrefs({ drop: { first, ms: Math.round(D.elapsed) } });
    D.phase = 'over'; cancelAnimationFrame(D.raf); drawDrop(root);
    confetti(D.newBest || !D.missed.length ? 150 : 70);
  };
  const onType = (el) => {
    if (!D || D.phase !== 'play' || D.mode !== 'fall') return;
    const w = cur(), typed = typedOf(el.value, D.used).replace(/\s/g, '');
    const { target, shown } = resolve(w, typed);
    const html = slots(shown, typed, false, D.hint && !typed);
    q('.d-tile .g-slots').innerHTML = html; el.classList.toggle('bad', hasBad(html));
    if (typed === target) { consume(D, el); correct(); }
  };
  const onBlur = () => { if (D && D.phase === 'play' && D.mode === 'fall' && !D.paused && root.isConnected && q('.d-stage') && document.activeElement !== q('#gi')) pause(); };
  const frame = (ts) => {
    if (!D || D.phase !== 'play' || !location.hash.startsWith('#/game-drop') || !q('.d-stage')) { if (D) D.raf = 0; return; }
    const dt = Math.min(100, ts - (D.last || ts)); D.last = ts;
    if (D.mode === 'fall' && !D.paused) {
      if (document.activeElement === q('#gi')) D.blurAt = 0; else if (!D.blurAt) D.blurAt = ts; else if (ts - D.blurAt > 250) pause();
    }
    if (!document.hidden && !D.paused) {
      D.elapsed += dt;
      if (D.mode === 'fall') { D.t += dt; place(D.t / D.T); const bar = q('.d-time i'); if (bar) bar.style.transform = `scaleX(${Math.max(0, 1 - D.t / D.T)})`; if (D.t >= D.T) wrong(); }
    }
    D.raf = requestAnimationFrame(frame);
  };
  const start = () => {
    const pool = gamePool(), last = lastGame();
    maybeNewCycle(pool, last);
    const picked = pickWords(pool, ROUND, last);
    D = { phase: 'play', queue: shuffle(picked.map((w) => w.id)), total: picked.length, missed: [], elapsed: 0, step: 0, mode: 'fall', t: 0, T: 1, last: 0, seen: new Set(), paused: false, hint: false, blurAt: 0 };
    drawDrop(root);
  };
  const quit = () => { if (D && D.raf) cancelAnimationFrame(D.raf); D = null; go('#/practice'); };

  root.onpointerdown = null;
  if (D && D.phase === 'play') {
    root.innerHTML = `<div class="game">
      <div class="g-top"><button class="iconbtn" data-act="quit" aria-label="Thoát">${icon('x')}</button><div class="d-time"><i></i></div><div class="g-score"><b class="d-count">0/${D.total}</b><small>đã bắn trúng</small></div></div>
      <div class="g-row"><button class="btn sm g-skip" data-act="skip">Không biết</button>${inputHtml}</div>
      <div class="d-stage" data-act="focus"><p class="d-meaning"></p><div class="d-tile"></div><div class="d-badge">정답!</div><div class="d-answer" hidden></div>
        <div class="g-hero d-mochi">${HEROES.mochi.svg}</div><div class="g-hero d-bolt">${HEROES.bolt.svg}<span class="d-hammer">${HAMMER}</span></div><div class="g-ground"></div>${overlay}</div></div>`;
    lockBounce(root);
    root.onpointerdown = (e) => { if (e.target.closest('.g-skip, .d-stage')) e.preventDefault(); };
    bind(root, {
      quit, resume,
      focus: () => {
        if (D.paused) return resume();
        if (D.mode === 'smash' && !q('.d-answer').hidden) showWord(); // chạm để bỏ qua màn đáp án
        q('#gi').focus({ preventScroll: true });
      },
      skip: () => { if (D && D.phase === 'play' && D.mode === 'fall') { D.paused = false; q('.g-pause').hidden = true; wrong(); } },
    });
    const el = wireInput(root, D, onType, onBlur, () => { if (D && D.paused) resume(); });
    el.focus({ preventScroll: true });
    showWord();
    D.raf = requestAnimationFrame(frame);
    D.debug = { pause, resume, tick: (ms) => { D.elapsed += ms; if (D.mode === 'fall') { D.t += ms; if (D.t >= D.T) wrong(); } } };
    return;
  }
  if (D && D.phase === 'over') {
    root.innerHTML = `<div class="gpage">${header('Bắn Từ', { back: '#/practice' })}
      <div class="card g-over gfix"><p class="small muted" style="font-weight:700">${D.newBest ? 'KỶ LỤC MỚI!' : 'HOÀN THÀNH'}</p><b class="g-final">${D.total - D.missed.length}/${D.total}</b><p class="muted small">từ đúng ngay lần đầu · ${fmtTime(D.elapsed)}</p><p class="small" style="margin-top:8px">${coverLine()}</p></div>
      <div class="scroll">${missedHtml(D.missed)}</div>
      <button class="btn primary block" data-act="start">Chơi ván mới</button><button class="btn ghost block" data-act="quit">Thoát</button></div>`;
    lockBounce(root);
    bind(root, { start, quit });
    return;
  }
  const n = gamePool().length, best = prefs().drop;
  root.innerHTML = `<div class="gpage">${header('Bắn Từ', { back: '#/practice', sub: '단어 쏘기' })}
    <div class="d-duo gfix"><span class="g-hero big">${HEROES.mochi.svg}</span><span class="g-hero big">${HEROES.bolt.svg}</span></div>
    <div class="card scroll"><b>Cách chơi</b><ul class="g-rules">
      <li>Nghĩa tiếng Việt hiện ở trên; khung chữ của từ rơi dần xuống trong khoảng 10–20 giây.</li>
      <li>Gõ đúng từ tiếng Hàn: Mochi bắn trúng, hiện “정답!”.</li>
      <li>Chữ bạn gõ hiện ngay trên khung đang rơi (đúng màu xanh, sai màu đỏ). Gõ nhầm cứ xóa và sửa.</li>
      <li>Để khung rơi chạm đất hoặc bấm “Không biết”: Bolt đập vỡ, hiện đáp án (chạm để sang từ kế tiếp), từ đó quay lại sau vài lượt.</li>
      <li>Bàn phím bị ẩn thì game tự tạm dừng. Không có mạng. Mỗi ván tối đa ${ROUND} từ, ưu tiên những từ lâu chưa chơi nhất; mọi từ đã học lần lượt được chơi hết một vòng.</li></ul>
      <p class="muted small" style="margin-top:10px">${best ? `Kỷ lục: <b>${best.first}/${ROUND}</b> đúng ngay lần đầu · ${fmtTime(best.ms)}` : 'Chưa có kỷ lục'}</p>${poolNote()}</div>
    ${n >= GAME_MIN ? '<button class="btn primary block" data-act="start">Bắt đầu</button>' : notReady(n)}</div>`;
  lockBounce(root);
  bind(root, { start, learn: () => go('#/practice') });
}

// Dùng cho kiểm thử tự động (đẩy nhanh thời gian, đọc trạng thái).
export const _debug = { run: () => G, drop: () => D, pickWords, poolInfo, coverInfo, lastGame, alts, hasSiblings, resolve };
