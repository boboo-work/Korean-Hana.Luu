// Công cụ chia động từ / tính từ tiếng Hàn dựa trên quy tắc.
// Nguyên tắc: chỉ khẳng định khi quy tắc xác định được chắc chắn; còn lại gắn cờ "cần kiểm chứng".

const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const V = { A: 0, AE: 1, YA: 2, YAE: 3, EO: 4, E: 5, YEO: 6, YE: 7, O: 8, WA: 9, WAE: 10, OE: 11, YO: 12, U: 13, WO: 14, WE: 15, WI: 16, YU: 17, EU: 18, UI: 19, I: 20 };
const J = (ch) => JONG.indexOf(ch);

export const isSyl = (ch) => ch >= '가' && ch <= '힣';
export function dec(ch) {
  const n = ch.charCodeAt(0) - 0xac00;
  return [Math.floor(n / 588), Math.floor((n % 588) / 28), n % 28];
}
export const com = (c, v, j = 0) => String.fromCharCode(0xac00 + c * 588 + v * 28 + j);

const last = (s) => s[s.length - 1];
const init = (s) => s.slice(0, -1);
const withJong = (s, j) => { const [c, v] = dec(last(s)); return init(s) + com(c, v, j); };
const withVowel = (s, v) => { const [c] = dec(last(s)); return init(s) + com(c, v, 0); };
const bright = (v) => v === V.A || v === V.O || v === V.YA;

// ---- Danh sách từ đã kiểm chứng ----
const D_IRR = ['듣다', '싣다', '깨닫다', '긷다', '일컫다', '붇다'];
const D_REG = ['받다', '닫다', '믿다', '얻다', '쏟다', '뜯다', '돋다', '곧다', '굳다', '뻗다'];
const B_IRR = ['돕다', '곱다', '춥다', '덥다', '어렵다', '쉽다', '가깝다', '무겁다', '가볍다', '맵다', '고맙다', '아름답다', '귀엽다', '더럽다', '즐겁다', '반갑다', '무섭다', '뜨겁다', '차갑다', '눕다', '줍다', '밉다', '싱겁다', '두껍다', '시끄럽다', '부드럽다', '가렵다', '그립다', '아깝다', '안타깝다', '부끄럽다', '어둡다', '외롭다', '새롭다', '괴롭다', '놀랍다', '즐겁다', '어지럽다', '부럽다', '굽다'];
const B_REG = ['입다', '잡다', '좁다', '씹다', '접다', '뽑다', '업다', '집다', '꼽다', '수줍다', '붙잡다'];
const S_IRR = ['낫다', '짓다', '붓다', '잇다', '긋다', '젓다'];
const S_REG = ['웃다', '씻다', '벗다', '빗다', '솟다', '빼앗다'];
const H_IRR = ['그렇다', '이렇다', '저렇다', '어떻다', '아무렇다', '빨갛다', '파랗다', '노랗다', '하얗다', '까맣다', '커다랗다', '동그랗다', '기다랗다', '조그맣다', '뻘겋다', '퍼렇다', '누렇다', '허옇다', '꺼멓다'];
const H_REG = ['좋다', '놓다', '넣다', '낳다', '닿다', '쌓다', '찧다', '빻다'];
const REU_REG = ['따르다', '치르다', '들르다', '다다르다', '우러르다'];

// Từ đồng hình khác cách chia: người dùng tự chọn nghĩa.
const AMBIG = {
  '걷다': [['d', 'đi bộ'], ['reg', 'vén lên, thu (quần áo, tiền)']],
  '묻다': [['d', 'hỏi'], ['reg', 'chôn; dính (bẩn)']],
  '굽다': [['b', 'nướng'], ['reg', 'cong']],
  '이르다': [['reu', 'sớm; nói, mách'], ['reo', 'đến, đạt tới']],
  '누르다': [['reu', 'ấn, nhấn'], ['reo', 'có màu vàng úa']],
};

const TYPE_LABEL = {
  reg: 'Quy tắc', ha: '하다 (bất quy tắc 여)', d: 'Bất quy tắc ㄷ', b: 'Bất quy tắc ㅂ', s: 'Bất quy tắc ㅅ',
  h: 'Bất quy tắc ㅎ', l: 'Gốc ㄹ (rụng ㄹ)', reu: 'Bất quy tắc 르', reo: 'Bất quy tắc 러', u: 'Bất quy tắc 우',
  eu: 'Rụng ㅡ', cop: 'Hệ từ (이다/아니다)',
};

const HONORIFIC_NOTE = {
  '먹다': 'Kính ngữ đặc biệt thường dùng: 드시다 / 잡수시다 (드세요).',
  '마시다': 'Kính ngữ đặc biệt thường dùng: 드시다 (드세요).',
  '자다': 'Kính ngữ đặc biệt: 주무시다 (주무세요).',
  '있다': 'Kính ngữ: 계시다 (người ở/có mặt) – 있으시다 (sở hữu).',
  '말하다': 'Kính ngữ đặc biệt: 말씀하시다.',
  '죽다': 'Kính ngữ đặc biệt: 돌아가시다.',
  '아프다': 'Kính ngữ đặc biệt: 편찮으시다 (khi nói về sức khỏe người lớn).',
  '주다': 'Khiêm nhường khi đưa cho người trên: 드리다.',
};
const NEG_NOTE = {
  '있다': 'Phủ định từ vựng thường dùng: 없다 (없어요).',
  '알다': 'Phủ định từ vựng thường dùng: 모르다 (몰라요).',
};

/** Phân tích: trả về danh sách khả năng chia [{type, label, certain, meaning?, why?}] */
export function analyze(word) {
  word = (word || '').trim().normalize('NFC');
  if (!word) return { error: 'Hãy nhập một động từ hoặc tính từ ở dạng từ điển (kết thúc bằng 다).' };
  if (![...word].every(isSyl)) return { error: 'Chỉ nhập chữ Hangul hoàn chỉnh, không có khoảng trắng.' };
  if (last(word) !== '다' || word.length < 2) return { error: 'Từ phải ở dạng từ điển, kết thúc bằng 다 (ví dụ: 먹다, 예쁘다).' };
  const stem = init(word);
  const cand = (type, certain = true, extra = {}) => ({ type, label: TYPE_LABEL[type], certain, ...extra });
  const out = (cands) => ({ word, stem, candidates: cands });

  if (word === '이다' || word === '아니다') return out([cand('cop')]);
  if (AMBIG[word]) return out(AMBIG[word].map(([t, m]) => cand(t, true, { meaning: m })));
  if (word === '푸다') return out([cand('u')]);
  if (last(stem) === '하') return out([cand('ha')]);

  const [, v, j] = dec(last(stem));
  const byList = (irr, reg, type, suffixes = []) => {
    if (irr.includes(word)) return out([cand(type)]);
    if (reg.includes(word)) return out([cand('reg')]);
    if (suffixes.some((s) => stem.endsWith(s) && stem.length > s.length)) return out([cand(type, true, { why: 'Đuôi -' + suffixes.find((s) => stem.endsWith(s)) + '다 luôn chia bất quy tắc ㅂ.' })]);
    const hit = irr.find((w) => word.endsWith(w) && word.length > w.length);
    const hitR = reg.find((w) => word.endsWith(w) && word.length > w.length);
    const why = 'Từ này chưa có trong danh sách đã kiểm chứng. Hãy tra từ điển để xác nhận là quy tắc hay bất quy tắc.';
    const a = cand(type, false, { why }), b = cand('reg', false, { why });
    if (hit && !hitR) return out([{ ...a, why: `Suy đoán theo từ gốc ${hit}. Cần kiểm chứng.` }, b]);
    if (hitR && !hit) return out([{ ...b, why: `Suy đoán theo từ gốc ${hitR}. Cần kiểm chứng.` }, a]);
    return out([b, a]);
  };
  if (j === J('ㄷ')) return byList(D_IRR, D_REG, 'd');
  if (j === J('ㅂ')) return byList(B_IRR, B_REG, 'b', ['롭', '스럽', '답']);
  if (j === J('ㅅ')) return byList(S_IRR, S_REG, 's');
  if (j === J('ㅎ')) return byList(H_IRR, H_REG, 'h');
  if (j === J('ㄹ')) return out([cand('l')]);
  if (j !== 0) return out([cand('reg')]);

  if (last(stem) === '르') {
    if (REU_REG.includes(word)) return out([cand('eu')]);
    if (word === '푸르다') return out([cand('reo')]);
    if (stem.length >= 2) return out([cand('reu', true, { why: 'Hầu hết gốc từ kết thúc bằng 르 chia bất quy tắc 르 (ngoại lệ: 따르다, 치르다, 들르다, 푸르다…).' })]);
  }
  if (v === V.EU) return out([cand('eu')]);
  const common = [V.A, V.AE, V.EO, V.E, V.YEO, V.O, V.OE, V.U, V.WI, V.UI, V.I];
  if (!common.includes(v)) return out([cand('reg', false, { why: 'Nguyên âm cuối gốc từ ít gặp; dạng rút gọn 아/어 có thể khác. Cần kiểm chứng.' })]);
  return out([cand('reg')]);
}

// Dạng 아/어 (cũng chính là 해체 hiện tại)
function aoForm(stem, type) {
  const L = last(stem), [c, v, j] = dec(L);
  const prevV = stem.length > 1 ? dec(stem[stem.length - 2])[1] : null;
  const addAO = (s) => s + (bright(dec(last(s))[1]) ? '아' : '어');
  switch (type) {
    case 'ha': return init(stem) + '해';
    case 'u': return init(stem) + com(c, V.EO);
    case 'd': return addAO(withJong(stem, J('ㄹ')));
    case 'b': return withJong(stem, 0) + ((stem === '돕' || stem === '곱') ? '와' : '워');
    case 's': return addAO(withJong(stem, 0));
    case 'h': {
      const special = ['그렇', '이렇', '저렇', '어떻', '아무렇'].includes(stem);
      const map = { [V.A]: V.AE, [V.EO]: special ? V.AE : V.E, [V.YA]: V.YAE, [V.YEO]: V.YE };
      return init(stem) + com(c, map[v] ?? V.AE, 0);
    }
    case 'reu': { const p = init(stem); return withJong(p, J('ㄹ')) + (bright(prevV) ? '라' : '러'); }
    case 'reo': return stem + '러';
    case 'eu': return withVowel(stem, prevV !== null && bright(prevV) ? V.A : V.EO);
  }
  if (j !== 0) return addAO(stem);
  switch (v) {
    case V.A: case V.EO: case V.AE: case V.E: case V.YEO: return stem;
    case V.O: return withVowel(stem, V.WA);
    case V.U: return withVowel(stem, V.WO);
    case V.I: return withVowel(stem, V.YEO);
    case V.OE: return withVowel(stem, V.WAE);
    case V.EU: return withVowel(stem, prevV !== null && bright(prevV) ? V.A : V.EO);
    default: return addAO(stem);
  }
}

// Gốc đứng trước đuôi bắt đầu bằng 으 (으시, 을…), đã ở dạng kết thúc bằng nguyên âm.
function euBase(stem, type) {
  const j = dec(last(stem))[2];
  switch (type) {
    case 'd': return withJong(stem, J('ㄹ')) + '으';
    case 'b': return withJong(stem, 0) + '우';
    case 's': return withJong(stem, 0) + '으';
    case 'h': return withJong(stem, 0);
    case 'l': return withJong(stem, 0); // rụng ㄹ trước ㅅ/ㄴ/ㅂ
  }
  return j === 0 ? stem : stem + '으';
}

const COPULA = {
  '이다': [
    ['Hiện tại', [['해요체', '이에요 / 예요'], ['합니다체', '입니다'], ['해체', '이야 / 야']]],
    ['Quá khứ', [['해요체', '이었어요 / 였어요'], ['합니다체', '이었습니다 / 였습니다'], ['해체', '이었어 / 였어']]],
    ['Tương lai / phỏng đoán', [['해요체', '일 거예요'], ['합니다체', '일 겁니다'], ['해체', '일 거야']]],
    ['Phủ định', [['해요체', '(이/가) 아니에요'], ['합니다체', '(이/가) 아닙니다'], ['해체', '(이/가) 아니야']]],
    ['Nghi vấn', [['해요체', '이에요? / 예요?'], ['합니다체', '입니까?'], ['해체', '이야? / 야?']]],
    ['Kính ngữ', [['해요체', '이세요 / 세요'], ['합니다체', '이십니다 / 십니다'], ['Quá khứ', '이셨어요 / 셨어요']]],
  ],
  '아니다': [
    ['Hiện tại', [['해요체', '아니에요'], ['합니다체', '아닙니다'], ['해체', '아니야']]],
    ['Quá khứ', [['해요체', '아니었어요'], ['합니다체', '아니었습니다'], ['해체', '아니었어']]],
    ['Tương lai / phỏng đoán', [['해요체', '아닐 거예요'], ['합니다체', '아닐 겁니다'], ['해체', '아닐 거야']]],
    ['Phủ định', [['—', 'Bản thân 아니다 đã là phủ định của 이다']]],
    ['Nghi vấn', [['해요체', '아니에요?'], ['합니다체', '아닙니까?'], ['해체', '아니야?']]],
    ['Kính ngữ', [['해요체', '아니세요'], ['합니다체', '아니십니다'], ['Quá khứ', '아니셨어요']]],
  ],
};

/** Chia theo một kiểu cụ thể. Trả về { groups: [[tiêu đề, [[nhãn, dạng]]]], notes: [] } */
export function conjugate(word, type) {
  const stem = init(word);
  const notes = [];
  if (type === 'cop') {
    notes.push(word === '이다'
      ? 'Dạng trước dấu “/” dùng sau danh từ có patchim (학생이에요), dạng sau dùng sau danh từ không có patchim (의사예요).'
      : '아니다 đi với trợ từ 이/가: 학생이 아니에요.');
    return { stem, groups: COPULA[word], notes };
  }
  const j = dec(last(stem))[2];
  const ao = aoForm(stem, type);
  const past = withJong(ao, J('ㅆ'));
  const eb = euBase(stem, type);
  const fut = type === 'l' ? stem : withJong(eb, J('ㄹ'));
  const hon = eb + '시';
  const formal = (suffix) => { // ㅂ니다 / 습니다
    if (type === 'l') return withJong(withJong(stem, 0), J('ㅂ')) + suffix;
    return j === 0 ? withJong(stem, J('ㅂ')) + suffix : stem + '습' + suffix;
  };
  const groups = [
    ['Hiện tại', [['해요체', ao + '요'], ['합니다체', formal('니다')], ['해체', ao]]],
    ['Quá khứ', [['해요체', past + '어요'], ['합니다체', past + '습니다'], ['해체', past + '어']]],
    ['Tương lai / phỏng đoán', [['해요체', fut + ' 거예요'], ['합니다체', fut + ' 겁니다'], ['해체', fut + ' 거야']]],
    ['Phủ định', [['Dạng dài · 해요체', stem + '지 않아요'], ['Dạng dài · 합니다체', stem + '지 않습니다'], ['Dạng dài · 해체', stem + '지 않아'], ['Dạng ngắn', '안 ' + ao + '요']]],
    ['Nghi vấn', [['해요체', ao + '요?'], ['합니다체', formal('니까') + '?'], ['해체', ao + '?']]],
    ['Kính ngữ (으)시', [['해요체', eb + '세요'], ['합니다체', eb + '십니다'], ['Quá khứ', eb + '셨어요']]],
  ];
  if (type === 'ha' && stem.length > 1)
    notes.push(`Dạng ngắn: nếu là “danh từ + 하다” (공부하다, 일하다…) thì 안 đứng trước 하다: ${init(stem)} 안 해요. Với tính từ (깨끗하다…) dùng “안 ${ao}요” hoặc dạng dài.`);
  if (type === 'l') notes.push('Gốc ㄹ: ㄹ rụng trước ㄴ, ㅂ, ㅅ và không thêm 으 (살다 → 삽니다, 사세요, 살 거예요).');
  if (type === 'h') notes.push('Bất quy tắc ㅎ: ㅎ rụng trước nguyên âm; trước phụ âm vẫn giữ (그렇습니다).');
  if (type === 'eu') notes.push('Rụng ㅡ trước 아/어; chọn 아 hay 어 theo nguyên âm của âm tiết đứng trước.');
  if (stem.endsWith('이') && stem.length > 1) notes.push('Kết quả giả định đây là động/tính từ có gốc kết thúc bằng 이. Nếu là “danh từ + 이다” thì chia theo 이다 (이에요/예요).');
  if (HONORIFIC_NOTE[word]) notes.push(HONORIFIC_NOTE[word]);
  if (NEG_NOTE[word]) notes.push(NEG_NOTE[word]);
  notes.push('Thì hiện tại và các dạng trên giống nhau cho động từ và tính từ. Mệnh lệnh (으)세요 chỉ dùng với động từ.');
  return { stem, groups, notes };
}
