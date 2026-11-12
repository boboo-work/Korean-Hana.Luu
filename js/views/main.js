import { S, setSetting, todayStats, grammarThisWeek, streak, dayStr, addDays, exportBackup, importBackup, resetAll } from '../store.js';
import { esc, $, go, bind, header, icon, toast, confirmSheet, download, pickFile } from '../ui.js';
import { speak, koVoices, onVoices, ttsSupported } from '../tts.js';
import { status } from '../srs.js';
import { todayQueue, startToday } from './practice.js';
import { MODELS } from '../ai.js';

const goalRow = (label, cur, max) => { const p = Math.min(100, max ? (cur / max) * 100 : 0); return `<div class="goal"><div class="row"><span>${label}</span><span class="muted">${cur}/${max}</span></div><div class="bar"><i class="${p >= 100 ? 'done' : ''}" style="width:${p}%"></i></div></div>`; };

export function viewHome(root) {
  const t = todayStats(), q = todayQueue(), st = streak(), set = S.settings;
  const n = q.all.length;
  const pool = S.vocab.filter((w) => w.ex);
  const day = Math.floor(Date.now() / 864e5);
  const wod = pool.length ? pool[day % pool.length] : null;
  root.innerHTML = header('Korean Vocab Master', { right: `<button class="iconbtn" data-act="nav" data-to="#/settings" aria-label="Cài đặt">${icon('gear')}</button>` }) + `
    <div class="hello"><div class="ko">안녕하세요 👋 나의 한국어 단어장</div><h2>Hôm nay học gì nào?</h2></div>
    <div class="cta">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><div class="n">${n}</div><div>${n ? `từ cần học hôm nay · ${q.due.length} ôn tập, ${q.fresh.length} mới` : 'Bạn đã hoàn thành phần ôn hôm nay'}</div></div>
        <div class="row" style="gap:4px;font-weight:700;white-space:nowrap" title="Chuỗi ngày học liên tiếp">${icon('flame')}${st} ngày</div>
      </div>
      <button class="btn block" data-act="${n ? 'today' : 'nav'}" data-to="#/practice">${n ? 'Bắt đầu ôn tập' : 'Luyện tập thêm'}</button>
    </div>
    <div class="card"><h2>Mục tiêu</h2>
      ${goalRow('Từ mới hôm nay', t.newWords, set.newPerDay)}
      ${goalRow('Lượt ôn tập hôm nay', t.reviewed, set.reviewPerDay)}
      ${goalRow('Ngữ pháp tuần này', grammarThisWeek(), set.grammarPerWeek)}
    </div>
    <div class="grid2">
      <button class="tool" data-act="nav" data-to="#/conjugate">${icon('swap')}Chia động từ<span>동사 · 형용사 활용</span></button>
      <button class="tool" data-act="nav" data-to="#/listen">${icon('mic')}Nghe & nói<span>Nghe mẫu, ghi âm</span></button>
      <button class="tool" data-act="nav" data-to="#/tutor">${icon('bot')}AI Tutor<span>${set.aiKey ? 'Hỏi đáp với gia sư AI' : 'Chưa kết nối API'}</span></button>
      <button class="tool" data-act="nav" data-to="#/grammar">${icon('grammar')}So sánh ngữ pháp<span>은/는 ↔ 이/가, 에 ↔ 에서…</span></button>
    </div>
    ${wod ? `<div class="sec">Từ của ngày</div><div class="card"><div class="row"><button class="grow" data-act="nav" data-to="#/vocab/${esc(wod.id)}" style="text-align:left">
      <div class="ko" style="font-size:26px;font-weight:700;color:var(--navy)">${esc(wod.word)}</div><div class="muted small">${esc(wod.roman)}</div><div style="font-weight:650">${esc(wod.vi)}</div></button>
      <button class="iconbtn" data-act="say" data-t="${esc(wod.word)}" aria-label="Nghe">${icon('sound')}</button></div></div>` : ''}`;
  bind(root, { nav: (el) => go(el.dataset.to), today: () => startToday(), say: (el) => speak(el.dataset.t) });
}

// ---------- Thống kê ----------
let range = 'day';
function buckets() {
  const today = dayStr(); const out = [];
  if (range === 'day') {
    for (let i = 6; i >= 0; i--) { const d = addDays(today, -i); out.push({ label: d.slice(8) + '/' + d.slice(5, 7), from: d, to: d }); }
  } else if (range === 'week') {
    const now = new Date(); const mon = addDays(today, -((now.getDay() + 6) % 7));
    for (let i = 7; i >= 0; i--) { const f = addDays(mon, -7 * i); out.push({ label: f.slice(8) + '/' + f.slice(5, 7), from: f, to: addDays(f, 6) }); }
  } else {
    const now = new Date();
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const ym = dayStr(d).slice(0, 7); out.push({ label: 'Th' + (d.getMonth() + 1), from: ym + '-01', to: ym + '-31' }); }
  }
  return out.map((b) => {
    const rs = S.reviews.filter((r) => r.day >= b.from && r.day <= b.to);
    return { ...b, total: rs.length, fresh: new Set(rs.filter((r) => r.isNew).map((r) => r.key)).size };
  });
}
const chart = (data, k) => { const max = Math.max(1, ...data.map((d) => d[k])); return `<div class="chart">${data.map((d) => `<div class="col"><span class="v">${d[k] || ''}</span><div class="b ${d[k] ? '' : 'z'}" style="height:${(d[k] / max) * 100}%"></div><span class="l">${d.label}</span></div>`).join('')}</div>`; };

export function viewStats(root) {
  const sts = S.vocab.map((w) => status('v:' + w.id));
  const learned = sts.filter((s) => s !== 'new').length, mastered = sts.filter((s) => s === 'mastered').length;
  const graded = S.reviews.filter((r) => r.key[0] === 'v' && r.mode !== 'game'); // game không đo trí nhớ: hết giờ có thể chỉ do gõ chậm
  const acc = graded.length ? Math.round((graded.filter((r) => r.q >= 3).length / graded.length) * 100) : null;
  const hard = S.vocab.map((w) => ({ w, c: S.srs['v:' + w.id] })).filter((x) => x.c && x.c.lapses > 0).sort((a, b) => b.c.lapses - a.c.lapses || a.c.ef - b.c.ef).slice(0, 8);
  const data = buckets();
  const unit = { day: '7 ngày gần đây', week: '8 tuần gần đây', month: '6 tháng gần đây' }[range];
  root.innerHTML = header('Thống kê', { sub: '통계' }) + `
    <div class="grid2">
      <div class="stat"><b>${streak()}</b><span>Ngày học liên tiếp</span></div>
      <div class="stat"><b>${learned}<small class="muted" style="font-size:14px;font-weight:600"> / ${S.vocab.length}</small></b><span>Từ đã học</span></div>
      <div class="stat"><b>${mastered}</b><span>Từ đã thuộc (chu kỳ ≥ 21 ngày)</span></div>
      <div class="stat"><b>${acc === null ? '—' : acc + '%'}</b><span>Tỉ lệ nhớ</span></div>
      <div class="stat"><b>${S.grammar.filter((g) => g.learnedAt).length}<small class="muted" style="font-size:14px;font-weight:600"> / ${S.grammar.length}</small></b><span>Ngữ pháp đã học</span></div>
      <div class="stat"><b>${S.reviews.length}</b><span>Tổng lượt học</span></div>
    </div>
    <div class="sec">Tiến độ</div>
    <div class="seg" role="tablist">${[['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']].map(([k, l]) => `<button role="tab" aria-selected="${range === k}" class="${range === k ? 'on' : ''}" data-act="range" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="card" style="margin-top:10px"><h2>Lượt học · ${unit}</h2>${chart(data, 'total')}</div>
    <div class="card"><h2>Từ mới · ${unit}</h2>${chart(data, 'fresh')}</div>
    <div class="sec">Từ hay quên</div>
    ${hard.length ? `<div class="list">${hard.map(({ w, c }) => `<button class="item" data-act="open" data-id="${esc(w.id)}"><div class="grow"><div class="w">${esc(w.word)}</div><div class="m">${esc(w.vi)}</div></div><span class="tag warn">quên ${c.lapses} lần</span></button>`).join('')}</div>` : '<div class="card muted small">Chưa có từ nào bị quên. Tiếp tục phát huy!</div>'}`;
  bind(root, { range: (el) => { range = el.dataset.k; viewStats(root); }, open: (el) => go('#/vocab/' + el.dataset.id) });
}

// ---------- Cài đặt ----------
export function viewSettings(root) {
  const s = S.settings;
  const voices = koVoices();
  const num = (k, label, min, max) => `<label class="field"><span>${label}</span><input class="input" type="number" inputmode="numeric" min="${min}" max="${max}" data-set="${k}" value="${s[k]}"></label>`;
  root.innerHTML = header('Cài đặt', { back: '#/home' }) + `
    <div class="sec">Giao diện</div>
    <div class="seg">${[['auto', 'Theo hệ thống'], ['light', 'Sáng'], ['dark', 'Tối']].map(([k, l]) => `<button class="${s.theme === k ? 'on' : ''}" data-act="theme" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="sec">Mục tiêu học tập</div>
    <div class="card">${num('newPerDay', 'Số từ mới mỗi ngày', 1, 100)}${num('reviewPerDay', 'Số lượt ôn tập mỗi ngày', 1, 500)}${num('grammarPerWeek', 'Số cấu trúc ngữ pháp mỗi tuần', 1, 50)}</div>
    <div class="sec">Giọng đọc tiếng Hàn</div>
    <div class="card">
      ${!ttsSupported() ? '<p class="muted small">Trình duyệt này không hỗ trợ đọc văn bản.</p>' : voices.length ? `
        <label class="field"><span>Giọng đọc (giọng có sẵn trên thiết bị)</span><select class="input" data-set="voiceURI">
          <option value="">Mặc định</option>${voices.map((v) => `<option value="${esc(v.uri)}" ${v.uri === s.voiceURI ? 'selected' : ''}>${esc(v.name)} — ${v.gender}</option>`).join('')}</select></label>
        <div class="row"><button class="btn sm" data-act="test">Nghe thử</button><button class="btn sm" data-act="testslow">Nghe thử chậm</button></div>
        <p class="small muted" style="margin-top:10px">Giọng nam/nữ phụ thuộc vào các giọng đã cài trên máy. Trên iPhone: Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Hàn để tải thêm giọng chất lượng cao.</p>`
      : '<p class="muted small">Chưa tìm thấy giọng tiếng Hàn trên thiết bị. Hãy tải giọng tiếng Hàn trong phần cài đặt hệ thống rồi mở lại ứng dụng.</p>'}
    </div>
    <div class="sec">AI Tutor</div>
    <div class="card">
      <label class="field"><span>Nhà cung cấp</span><select class="input" data-set="aiProvider"><option value="anthropic">Anthropic (Claude API)</option></select></label>
      <label class="field"><span>Khóa API (chỉ lưu trên thiết bị này)</span><input class="input" type="password" data-set="aiKey" value="${esc(s.aiKey)}" placeholder="Dán khóa API của bạn" autocomplete="off"></label>
      <label class="field"><span>Mô hình</span><select class="input" data-set="aiModel">${MODELS.map(([id, l]) => `<option value="${id}" ${id === s.aiModel ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <p class="small muted">Khóa được gửi trực tiếp từ thiết bị đến nhà cung cấp, không đi qua máy chủ nào khác và không nằm trong tệp sao lưu. Chi phí sử dụng API do tài khoản của bạn chi trả.</p>
    </div>
    <div class="sec">Dữ liệu</div>
    <div class="stack">
      <button class="btn block" data-act="backup">Sao lưu toàn bộ (tệp JSON)</button>
      <button class="btn block" data-act="restore">Khôi phục từ tệp sao lưu</button>
      <button class="btn block danger" data-act="reset">Xóa toàn bộ dữ liệu</button>
    </div>
    <p class="small muted center" style="margin-top:22px">Korean Vocab Master · dữ liệu lưu ngoại tuyến trên thiết bị (IndexedDB).<br>Để cài lên iPhone: mở bằng Safari → Chia sẻ → Thêm vào MH chính.</p>`;
  root.onchange = async (e) => {
    const k = e.target.dataset.set; if (!k) return;
    let v = e.target.value;
    if (e.target.type === 'number') { v = Math.max(+e.target.min, Math.min(+e.target.max, parseInt(v, 10) || +e.target.min)); e.target.value = v; }
    if (k === 'aiKey') v = v.trim();
    await setSetting(k, v); toast('Đã lưu');
  };
  if (!voices.length) onVoices(() => { if (location.hash.startsWith('#/settings')) viewSettings(root); });
  bind(root, {
    theme: async (el) => { await setSetting('theme', el.dataset.k); if (el.dataset.k === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = el.dataset.k; viewSettings(root); },
    test: () => speak('안녕하세요. 만나서 반갑습니다.'), testslow: () => speak('안녕하세요. 만나서 반갑습니다.', { slow: true }),
    backup: () => download(`korean-vocab-master-${dayStr()}.json`, JSON.stringify(exportBackup()), 'application/json'),
    restore: async () => {
      const f = await pickFile('.json,application/json'); if (!f) return;
      let data; try { data = JSON.parse(f.text); } catch { return toast('Tệp không phải JSON hợp lệ'); }
      confirmSheet(`Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại bằng bản sao lưu (${(data.vocab || []).length} từ). Tiếp tục?`, 'Khôi phục', async () => {
        try { await importBackup(data); toast('Đã khôi phục dữ liệu'); viewSettings(root); } catch (e) { toast(e.message); }
      });
    },
    reset: () => confirmSheet('Xóa toàn bộ từ vựng, ngữ pháp, lịch sử học và cài đặt, rồi nạp lại dữ liệu mẫu? Không thể hoàn tác.', 'Xóa toàn bộ', async () => { await resetAll(); delete document.documentElement.dataset.theme; toast('Đã đặt lại dữ liệu'); go('#/home'); }),
  });
}
