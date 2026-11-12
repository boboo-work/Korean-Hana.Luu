// Service worker: lưu sẵn toàn bộ ứng dụng để chạy ngoại tuyến.
// Đổi VERSION mỗi lần phát hành để thiết bị tải bản mới.
const VERSION = 'kvm-v4';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/srs.js', 'js/conjugate.js', 'js/ui.js', 'js/tts.js', 'js/csv.js', 'js/ai.js',
  'js/data/vocab.js', 'js/data/grammar.js',
  'js/views/main.js', 'js/views/vocab.js', 'js/views/grammar.js', 'js/views/practice.js', 'js/views/tools.js', 'js/views/games.js',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API bên ngoài đi thẳng ra mạng
  // Ưu tiên mạng để luôn có bản mới; mất mạng thì dùng bản đã lưu.
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
