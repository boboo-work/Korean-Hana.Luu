// Khởi động ứng dụng + bộ định tuyến theo hash.
import { init, S } from './store.js';
import { $, esc, icon } from './ui.js';
import { viewHome, viewStats, viewSettings } from './views/main.js';
import { viewVocabList, viewVocabDetail, viewVocabEdit, viewCats } from './views/vocab.js';
import { viewGrammarList, viewGrammarDetail, viewGrammarEdit, viewCompare } from './views/grammar.js';
import { viewPractice, viewSession } from './views/practice.js';
import { viewConjugate, viewListen, viewTutor } from './views/tools.js';

const TABS = [['home', 'Home', 'home'], ['vocab', 'Vocabulary', 'book'], ['grammar', 'Grammar', 'grammar'], ['practice', 'Practice', 'play'], ['stats', 'Statistics', 'chart']];
const TAB_OF = { conjugate: 'practice', listen: 'practice', tutor: 'home', settings: 'home', cats: 'vocab' };
const FULL = new Set(['session', 'tutor']);

const ROUTES = {
  home: viewHome, stats: viewStats, settings: viewSettings,
  vocab: (root, [a, b]) => (a === 'edit' ? viewVocabEdit(root, b) : a ? viewVocabDetail(root, a) : viewVocabList(root)),
  cats: viewCats,
  grammar: (root, [a, b]) => (a === 'edit' ? viewGrammarEdit(root, b) : a === 'compare' ? viewCompare(root, b) : a ? viewGrammarDetail(root, a) : viewGrammarList(root)),
  practice: viewPractice, session: viewSession,
  conjugate: viewConjugate, listen: viewListen, tutor: viewTutor,
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
}

init().then(() => {
  applyTheme();
  window.addEventListener('hashchange', render);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}).catch((err) => {
  $('#view').innerHTML = `<div class="empty"><p><b>Không mở được cơ sở dữ liệu.</b></p><p class="small">${esc(err && err.message)}</p><p class="small">Hãy tắt chế độ duyệt web riêng tư rồi thử lại.</p></div>`;
});
