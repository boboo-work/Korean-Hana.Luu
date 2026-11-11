// Lớp kết nối AI. Mỗi nhà cung cấp là một hàm stream({key, model, system, messages, onText, signal}).
// Thêm nhà cung cấp khác bằng cách bổ sung vào PROVIDERS; phần giao diện không cần thay đổi.
// Trình duyệt gọi thẳng API bằng fetch vì ứng dụng không có máy chủ và không dùng công cụ build.
import { S } from './store.js';

export const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 (khuyên dùng)'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (nhanh, rẻ hơn)'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 (rẻ nhất)'],
];

export const SYSTEM = `Bạn là giáo viên tiếng Hàn cho người Việt Nam, đang hỗ trợ trong ứng dụng học từ vựng "Korean Vocab Master".
Trả lời bằng tiếng Việt, rõ ràng và ngắn gọn; tiếng Hàn viết bằng Hangul.
Khi giải thích từ vựng hoặc ngữ pháp, luôn kèm ví dụ tiếng Hàn tự nhiên và bản dịch tiếng Việt cho từng ví dụ.
Chỉ đưa ra nghĩa, phiên âm, Hán tự hay quy tắc ngữ pháp khi bạn chắc chắn. Nếu không chắc, hãy nói rõ là không chắc và khuyên người học đối chiếu từ điển (ví dụ 표준국어대사전 hoặc từ điển Hàn–Việt của Viện Quốc ngữ) thay vì đoán.
Bạn chỉ đọc văn bản nên không thể nghe hay chấm điểm phát âm của người học; đừng nhận xét về phát âm thực tế của họ.
Trình bày bằng văn bản thuần, xuống dòng rõ ràng, không dùng bảng hay cú pháp Markdown phức tạp.`;

// 10 chức năng của gia sư: nhãn + lời nhắc mở đầu (người học điền tiếp).
export const TASKS = [
  ['Giải thích từ vựng', 'Giải thích từ sau bằng tiếng Việt (nghĩa, sắc thái, cách dùng, ví dụ): '],
  ['Giải thích ngữ pháp', 'Giải thích chi tiết cấu trúc ngữ pháp sau (ý nghĩa, cách chia, ví dụ, lỗi thường gặp): '],
  ['Phân biệt từ đồng nghĩa', 'Phân biệt cách dùng của các từ sau, kèm ví dụ cho từng từ: '],
  ['Sửa lỗi câu', 'Hãy sửa lỗi câu tiếng Hàn sau và giải thích từng lỗi: '],
  ['Tạo ví dụ theo tình huống', 'Tạo 5 câu ví dụ tiếng Hàn kèm dịch nghĩa cho tình huống: '],
  ['Tạo hội thoại', 'Viết một đoạn hội thoại tiếng Hàn thực tế (kèm dịch) về chủ đề: '],
  ['Luyện giao tiếp', 'Hãy trò chuyện với tôi bằng tiếng Hàn ở trình độ sơ cấp. Mỗi lượt bạn nói 1–2 câu, sửa lỗi cho tôi nếu có rồi hỏi tiếp. Chủ đề: '],
  ['Đóng vai giáo viên', 'Hãy đóng vai giáo viên tiếng Hàn và dạy tôi một bài ngắn, có kiểm tra lại sau mỗi phần, về: '],
  ['Đánh giá trình độ', 'Hãy đánh giá trình độ tiếng Hàn của tôi: hỏi tôi lần lượt 8 câu từ dễ đến khó (từ vựng, ngữ pháp, đọc hiểu), mỗi lần một câu, rồi ước lượng cấp độ TOPIK và nêu rõ đây chỉ là ước lượng.'],
  ['Tạo bài tập', 'Tạo 5 bài tập tiếng Hàn phù hợp với trình độ của tôi (nêu đáp án sau khi tôi trả lời). Trình độ và chủ đề: '],
];

export const aiReady = () => !!S.settings.aiKey;

async function anthropic({ key, model, system, messages, onText, signal }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: {
      'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model, max_tokens: 16000, stream: true, system, messages,
      output_config: { effort: 'medium' },
      ...(model === 'claude-haiku-5-5' ? {} : { fallbacks: 'default' }),
    }),
  });
  if (!res.ok) {
    let msg = ''; try { msg = (await res.json()).error.message; } catch { /* không có nội dung lỗi */ }
    const hint = { 401: 'Khóa API không hợp lệ.', 403: 'Khóa API không có quyền truy cập.', 429: 'Vượt giới hạn tốc độ hoặc hết hạn mức. Hãy thử lại sau.', 529: 'Máy chủ đang quá tải. Hãy thử lại sau.' }[res.status] || '';
    throw new Error(`${hint} (HTTP ${res.status}${msg ? ': ' + msg : ''})`.trim());
  }
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = '', text = '', stop = null;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { text += ev.delta.text; onText(text); }
      else if (ev.type === 'message_delta' && ev.delta.stop_reason) stop = ev.delta.stop_reason;
      else if (ev.type === 'error') throw new Error(ev.error && ev.error.message || 'Lỗi luồng dữ liệu');
    }
  }
  if (stop === 'refusal') throw new Error('Mô hình đã từ chối yêu cầu này. Hãy thử diễn đạt lại câu hỏi.');
  if (stop === 'max_tokens') text += '\n\n[Câu trả lời bị cắt do quá dài]';
  return text;
}

const PROVIDERS = { anthropic };

export function ask(messages, onText, signal) {
  const { aiProvider, aiKey, aiModel } = S.settings;
  const p = PROVIDERS[aiProvider];
  if (!p) throw new Error('Nhà cung cấp AI chưa được hỗ trợ.');
  if (!aiKey) throw new Error('Chưa có khóa API.');
  return p({ key: aiKey, model: aiModel, system: SYSTEM, messages, onText, signal });
}
