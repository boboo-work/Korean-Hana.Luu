# Korean Vocab Master – 나의 한국어 단어장

Ứng dụng PWA học từ vựng và ngữ pháp tiếng Hàn cho người Việt. Chạy ngoại tuyến, không cần đăng nhập, dữ liệu lưu trên thiết bị.

## Chạy thử trên máy tính

```bash
python3 -m http.server 5173
```

Mở `http://localhost:5173`.

## Cài lên iPhone

iOS chỉ cho phép chế độ ngoại tuyến (service worker) khi trang được phục vụ qua **HTTPS**. Hãy đưa cả thư mục này lên một dịch vụ lưu trữ tĩnh có HTTPS (GitHub Pages, Netlify, Cloudflare Pages…), mở địa chỉ đó bằng Safari → Chia sẻ → **Thêm vào MH chính**.

Mở qua mạng nội bộ (`http://<ip-máy-tính>:5173`) vẫn dùng được trong Safari nhưng không cài ngoại tuyến được.

## Kiến trúc

Không dùng framework hay bước build: HTML + CSS + JavaScript module thuần, nên có thể triển khai bằng cách chép tệp.

| Tệp | Vai trò |
|---|---|
| `js/store.js` | IndexedDB (vocab, grammar, cats, srs, reviews, kv) + bộ đệm trong RAM, sao lưu/khôi phục, thống kê |
| `js/srs.js` | Lặp lại ngắt quãng SM-2, 4 mức đánh giá |
| `js/conjugate.js` | Chia động từ/tính từ theo quy tắc, gắn cờ “cần kiểm chứng” khi không chắc |
| `js/tts.js` | Đọc tiếng Hàn (Web Speech API) và ghi âm (MediaRecorder) |
| `js/ai.js` | Lớp kết nối AI theo nhà cung cấp (hiện có Claude API) |
| `js/csv.js` | Nhập/xuất CSV |
| `js/data/*` | Dữ liệu mẫu: 95 từ, 30 cấu trúc ngữ pháp, 6 bảng so sánh |
| `js/views/*` | Các màn hình; `js/app.js` là bộ định tuyến theo hash |
| `sw.js` | Lưu sẵn toàn bộ tệp để chạy ngoại tuyến. **Tăng `VERSION` mỗi lần phát hành.** |

Phần lõi (`store`, `srs`, `conjugate`, `csv`, `ai`) không phụ thuộc giao diện, có thể tái sử dụng khi bọc thành ứng dụng native (Capacitor/WKWebView) hoặc viết lại giao diện.

## Giới hạn có chủ đích

- **IPA** để trống trong dữ liệu mẫu vì chưa có nguồn đối chiếu đáng tin cậy.
- **Phát âm** dùng giọng tiếng Hàn có sẵn trên thiết bị; giọng nam/nữ tùy vào giọng đã cài.
- **Ghi âm** chỉ để tự nghe lại, không chấm điểm phát âm, không nhận diện giọng nói.
- **AI Tutor** chỉ hoạt động khi nhập khóa API trong Cài đặt; không có câu trả lời giả lập.
- **Nhập/xuất** dùng CSV (UTF-8 có BOM, mở được bằng Excel), chưa hỗ trợ tệp `.xlsx`.
