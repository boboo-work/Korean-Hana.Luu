// Giao diện: chế độ sáng/tối và màu chủ đạo. Giá trị màu thật nằm trong css/app.css (data-accent);
// ở đây chỉ có danh sách để hiển thị ô chọn (sw = [màu đậm, màu nhấn] bản sáng).
import { S } from './store.js';

export const ACCENTS = [
  { id: 'navy', name: 'Xanh navy', sw: ['#1F2D4D', '#3D5A98'] },
  { id: 'ocean', name: 'Xanh biển', sw: ['#0B3C5D', '#18629A'] },
  { id: 'teal', name: 'Xanh ngọc', sw: ['#0F4C4A', '#10685F'] },
  { id: 'forest', name: 'Xanh lá', sw: ['#1E4D3A', '#2A7550'] },
  { id: 'violet', name: 'Tím', sw: ['#3B2A66', '#6246B5'] },
  { id: 'rose', name: 'Hồng', sw: ['#6B2040', '#B02F68'] },
  { id: 'terracotta', name: 'Cam đất', sw: ['#5C2E12', '#A8480F'] },
  { id: 'graphite', name: 'Xám than', sw: ['#262B33', '#4B5563'] },
];

export function applyTheme() {
  const r = document.documentElement;
  const theme = S.settings.theme || 'auto';
  const accent = ACCENTS.some((a) => a.id === S.settings.accent) ? S.settings.accent : 'navy';
  if (theme === 'auto') delete r.dataset.theme; else r.dataset.theme = theme;
  if (accent === 'navy') delete r.dataset.accent; else r.dataset.accent = accent;
  // Lưu bản sao nhỏ để lần mở sau áp dụng ngay khi tải trang, không bị nháy màu mặc định.
  try { localStorage.setItem('kvm-theme', theme); localStorage.setItem('kvm-accent', accent); } catch { /* bị chặn: bỏ qua */ }
}
