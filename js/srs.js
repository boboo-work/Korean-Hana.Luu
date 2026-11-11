// Lặp lại ngắt quãng theo SM-2 (SuperMemo 2), 4 mức đánh giá ánh xạ sang chất lượng q = 1, 3, 4, 5.
import { S, dayStr, addDays, saveCard, logReview, freshCard } from './store.js';

export const RATINGS = [
  { q: 1, label: 'Quên hoàn toàn', cls: 'r0' },
  { q: 3, label: 'Khó nhớ', cls: 'r1' },
  { q: 4, label: 'Đã nhớ', cls: 'r2' },
  { q: 5, label: 'Rất dễ', cls: 'r3' },
];

export function newCard(key) {
  return { key, ef: 2.5, iv: 0, reps: 0, lapses: 0, due: dayStr(), first: null, last: null };
}

// Hàm thuần: trả về thẻ mới sau khi đánh giá.
export function schedule(card, q, today = dayStr()) {
  const c = { ...card };
  if (q < 3) {
    c.reps = 0; c.iv = 0; c.lapses += 1;
    c.ef = Math.max(1.3, c.ef - 0.2);
    c.due = today; // ôn lại ngay trong ngày
  } else {
    // "Rất dễ" luôn cho chu kỳ dài hơn "Đã nhớ" (thưởng 30%), "Khó nhớ" ngắn hơn.
    if (c.reps === 0) c.iv = q === 5 ? 3 : 1;
    else if (c.reps === 1) c.iv = q === 3 ? 3 : q === 5 ? 8 : 6;
    else c.iv = Math.max(c.iv + 1, Math.round(c.iv * (q === 3 ? 1.2 : q === 5 ? c.ef * 1.3 : c.ef)));
    c.reps += 1;
    c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    c.due = addDays(today, c.iv);
  }
  c.first = c.first || today;
  c.last = today;
  return c;
}

export async function rate(key, q, mode) {
  // Đọc lại thẻ từ DB để không ghi đè tiến độ do tab khác vừa lưu.
  const old = (await freshCard(key)) || S.srs[key] || newCard(key);
  const isNew = !old.first;
  const card = schedule(old, q);
  await saveCard(card);
  await logReview({ t: Date.now(), day: dayStr(), key, q, mode, isNew });
  return card;
}

export const isDue = (c, today = dayStr()) => c && c.first && c.due <= today;

// Từ đến hạn: từ khó (hay quên, EF thấp) được xếp trước.
export function dueVocab() {
  const t = dayStr();
  return S.vocab.filter((w) => isDue(S.srs['v:' + w.id], t)).sort((a, b) => {
    const x = S.srs['v:' + a.id], y = S.srs['v:' + b.id];
    return y.lapses - x.lapses || x.ef - y.ef || (x.due < y.due ? -1 : 1);
  });
}
export const newVocab = () => S.vocab.filter((w) => !(S.srs['v:' + w.id] || {}).first);

export function status(key) {
  const c = S.srs[key];
  if (!c || !c.first) return 'new';
  if (c.iv >= 21) return 'mastered';
  return 'learning';
}
