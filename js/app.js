// Khởi động ứng dụng + bộ định tuyến theo hash.
import { init, S, reload } from './store.js';
import { $, esc, icon } from './ui.js';
import { viewHome, viewStats, viewSettings } from './views/main.js';
import { viewVocabList, viewVocabDetail, viewVocabEdit, viewCats } from './views/vocab.js';
import { viewGrammarList, viewGrammarDetail, viewGrammarEdit, viewCompare } from './views/grammar.js';
import { viewPractice, viewSession } from './views/practice.js';
import { viewConjugate, viewListen, viewTutor } from './views/tools.js';
import { viewRun, viewDrop } from './views/games.js';

const TABS = [['home', 'Home', 'home'], ['vocab', 'Vocabulary', 'book'], ['grammar', 'Grammar', 'grammar'], ['practice', 'Practice', 'play'], ['stats', 'Statistics', 'chart']];
const TAB_OF = { 'game-run': 'practice', 'game-drop': 'practice', conjugate: 'practice', listen: 'practice', tutor: 'home', settings: 'home', cats: 'vocab' };
const FULL = new Set(['session', 'tutor', 'game-run', 'game-drop']);

const ROUTES = {
  home: viewHome, stats: viewStats, settings: viewSettings,
  vocab: (root, [a, b]) => (a === 'edit' ? viewVocabEdit(root, b) : a ? viewVocabDetail(root, a) : viewVocabList(root)),
  cats: viewCats,
  grammar: (root, [a, b]) => (a === 'edit' ? viewGrammarEdit(root, b) : a === 'compare' ? viewCompare(root, b) : a ? viewGrammarDetail(root, a) : viewGrammarList(root)),
  practice: viewPractice, session: viewSession,
  conjugate: viewConjugate, listen: viewListen, tutor: viewTutor,
  'game-run': viewRun, 'game-drop': viewDrop,
};

export function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}

function render() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [name = 'home', ...rest] = path.split('/').map(decodeURIComponent);
  const route = ROUTES[name] ? name : 'home';
  const root = $('#view');
  root.onclick = root.oninput = root.onchange = root.onsubmit = null;
  document.body.classList.toggle('full', FULL.has(route));
  const tab = TAB_OF[route] || route;
  $('#tabbar').innerHTML = TABS.map(([id, label, ic]) => `<a href="#/${id}" class="${id === tab ? 'on' : ''}" ${id === tab ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(label)}</span></a>`).join('');
  window.speechSynthesis && window.speechSynthesis.cancel();
  ROUTES[route](root, rest.length ? rest : [], new URLSearchParams(query));
  window.scrollTo(0, 0);
  if (!root.contains(document.activeElement)) root.focus({ preventScroll: true }); // đưa focus vào màn hình mới
}

init().then(() => {
  applyTheme();
  window.addEventListener('hashchange', render);
  // Quay lại tab: nạp lại dữ liệu từ DB (có thể tab khác vừa ghi). Không vẽ lại khi đang làm bài hoặc đang nhập liệu.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    await reload();
    const name = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'home';
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement || {}).tagName);
    if (['home', 'stats', 'vocab', 'grammar', 'practice', 'cats'].includes(name) && !location.hash.includes('/edit/') && !typing && !document.querySelector('.sheet-wrap')) render();
  });
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}).catch((err) => {
  $('#view').innerHTML = `<div class="empty"><p><b>Không mở được cơ sở dữ liệu.</b></p><p class="small">${esc(err && err.message)}</p><p class="small">Hãy tắt chế độ duyệt web riêng tư rồi thử lại.</p></div>`;
});
