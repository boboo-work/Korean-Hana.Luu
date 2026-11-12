// Theo dõi vùng NHÌN THẤY THẬT của màn hình (visualViewport) để bàn phím không đẩy nội dung lên hoặc che khuất.
//
// Vấn đề trên iOS: khi bàn phím mở, Safari không co cửa sổ mà cuộn/đẩy trang để lộ ô nhập; đóng rồi mở lại thì phần bị đẩy
// còn lưu lại (đầu trang mất, thẻ bị che). Cách xử lý:
//  - đặt --vvh / --vvt = chiều cao và độ lệch của vùng nhìn thấy; các màn hình toàn khung (phiên học, game, gia sư)
//    được cố định đúng vào vùng này, nên bàn phím chỉ làm vùng đó thấp đi chứ không đẩy gì;
//  - ô nhập được ghim ở đáy vùng (sticky) nên luôn nằm ngay trên bàn phím;
//  - body.kb báo bàn phím đang mở để thu gọn bố cục và ẩn thanh tab / nút nổi.
const vv = window.visualViewport;
const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);
const isField = (el) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_TYPES.has(el.type)));

let base = 0, open = false, raf = 0;

function apply() {
  raf = 0;
  const root = document.documentElement;
  const h = vv ? vv.height : innerHeight, top = vv ? vv.offsetTop : 0;
  base = Math.max(base, innerHeight, h);                      // chiều cao khi chưa có bàn phím (đo lại khi xoay màn hình)
  root.style.setProperty('--vvh', Math.round(h) + 'px');
  root.style.setProperty('--vvt', Math.round(top) + 'px');
  const now = isField(document.activeElement) && h < base - 100;
  if (now === open) return;
  open = now;
  document.body.classList.toggle('kb', now);
  if (now) {
    const el = document.activeElement;
    requestAnimationFrame(() => { try { el.scrollIntoView({ block: 'nearest' }); } catch { /* phần tử đã bị gỡ */ } });
  } else {
    // Bàn phím vừa đóng: xóa phần trang còn bị đẩy lại.
    const full = document.body.classList.contains('full');
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    window.scrollTo(0, full ? 0 : Math.min(window.scrollY, max));
  }
}

export const syncViewport = () => { if (!raf) raf = requestAnimationFrame(apply); };
export const keyboardOpen = () => open;

export function initViewport() {
  if (vv) { vv.addEventListener('resize', syncViewport); vv.addEventListener('scroll', syncViewport); }
  addEventListener('resize', syncViewport);
  addEventListener('orientationchange', () => { base = 0; setTimeout(syncViewport, 300); });
  addEventListener('focusin', syncViewport);
  addEventListener('focusout', () => setTimeout(syncViewport, 80));
  setInterval(() => { if (open) syncViewport(); }, 400); // phòng khi trình duyệt không phát sự kiện blur / resize lúc đóng bàn phím
  syncViewport();
}
