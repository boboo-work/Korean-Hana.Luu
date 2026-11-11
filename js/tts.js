// Phát âm bằng Web Speech API (giọng tiếng Hàn có sẵn trên thiết bị) + ghi âm bằng MediaRecorder.
import { S } from './store.js';

const synth = window.speechSynthesis;
// Giới tính chỉ gắn nhãn cho những giọng đã biết; còn lại ghi "không rõ".
const KNOWN = { yuna: 'Nữ', sora: 'Nữ', heami: 'Nữ', sunhi: 'Nữ', 'sun-hi': 'Nữ', jihun: 'Nam', minsu: 'Nam', injoon: 'Nam', 'in-joon': 'Nam', hyunsu: 'Nam' };

export const ttsSupported = () => !!synth;
export function koVoices() {
  if (!synth) return [];
  return synth.getVoices().filter((v) => /^ko/i.test(v.lang)).map((v) => {
    const k = Object.keys(KNOWN).find((n) => v.name.toLowerCase().includes(n));
    return { uri: v.voiceURI, name: v.name, gender: k ? KNOWN[k] : 'Không rõ', voice: v };
  });
}
// Giọng mặc định: ưu tiên giọng đọc tự nhiên, tránh các giọng hiệu ứng của macOS/iOS (Eddy, Grandma…).
const NOVELTY = /eddy|flo\b|grandma|grandpa|reed|rocko|sandy|shelley|bells|bubbles|organ|whisper|zarvox|trinoids|cellos|boing|bad news|good news|jester|junior|ralph|albert|fred|kathy|superstar|wobble/i;
export function defaultVoice(vs = koVoices()) {
  return vs.find((x) => /yuna|sora|google|heami|sunhi|sun-hi|injoon|in-joon|jihun|minsu/i.test(x.name))
    || vs.find((x) => x.voice.default && !NOVELTY.test(x.name))
    || vs.find((x) => !NOVELTY.test(x.name)) || vs[0];
}
export function onVoices(cb) { if (synth) synth.addEventListener('voiceschanged', cb, { once: true }); }

export function speak(text, { slow = false } = {}) {
  if (!synth || !text) return false;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[{}]/g, ''));
  u.lang = 'ko-KR';
  const vs = koVoices();
  const v = vs.find((x) => x.uri === S.settings.voiceURI) || defaultVoice(vs);
  if (v) u.voice = v.voice;
  u.rate = slow ? 0.55 : 0.95;
  synth.speak(u);
  return true;
}

// ---- Ghi âm ----
let rec = null, chunks = [], stream = null;
export const recSupported = () => !!(navigator.mediaDevices && window.MediaRecorder);
export async function startRec() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
}
export function stopRec() {
  return new Promise((res) => {
    if (!rec) return res(null);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/mp4' });
      rec = null; res(URL.createObjectURL(blob));
    };
    rec.stop();
  });
}
