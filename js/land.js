// 찍은 지점의 대략적인 토지 구분과 행정구역.
// 방식: 화면에 쓰는 것과 같은 OpenStreetMap 지도 타일에서 그 지점의 색을 읽는다. 지도는 토지 이용을 색으로 칠해 두므로
//       (공업 = 연보라, 주거 = 회색, 숲 = 초록, 농지 = 연노랑 …) 색으로 구분을 알 수 있다. 행정구역은 Nominatim 주소 조회를 쓴다.
// 주의: 법적 용도지역(국토계획법)이 아니다. 지도에 칠해진 토지 이용 표시일 뿐이고, 칠해지지 않은 곳이 많다.
//       정식 용도지역은 브이월드 인증키를 받은 뒤 연결한다.
// (조회 서버 Overpass 를 쓰는 방식은 2026-11-26 시험에서 응답 없음·오류가 잦아 쓰지 않는다.)
const Z = 13;      // 건물 윤곽이 그려지기 전 단계라 토지 색을 읽기 좋다 (1픽셀 약 15m)

// OpenStreetMap 기본 지도 색 → 구분. level: good / warn / bad / none
const CLASSES = [
  ['#ebdbe8', 'good', '공업·산업 용지', '공장이나 물류 시설이 있는 곳이라 전력 인입과 인허가 검토에 유리한 편입니다.'],
  ['#f2dad9', 'warn', '상업 용지', '도심 상업 지역은 가능한 경우가 있지만 땅값과 주변 민원을 함께 봐야 합니다.'],
  ['#ffd6d1', 'warn', '상업 용지 (판매 시설)', '상가 지역입니다. 땅값과 주변 민원을 함께 봐야 합니다.'],
  ['#e0dfdf', 'bad', '주거 지역', '주거지 주변은 소음·전자파 민원과 용도 제한으로 어려운 편입니다.'],
  ['#ffffe5', 'bad', '학교·병원 등 공공 시설', '다른 용도로 쓰이고 있어 어려운 편입니다.'],
  ['#eef0d5', 'warn', '농지', '농지 전용 허가 같은 절차가 필요하고, 전력 인입 거리도 따져 봐야 합니다.'],
  ['#f5dcba', 'warn', '농지 (농가·축사)', '농지 전용 허가 같은 절차가 필요합니다.'],
  ['#aedfa3', 'warn', '농지 (과수원)', '농지 전용 허가 같은 절차가 필요합니다.'],
  ['#add19e', 'warn', '산림', '산지 전용 허가와 토목 공사가 필요해 기간과 비용이 늘어납니다.'],
  ['#c8d7ab', 'warn', '산림 (관목지)', '산지 전용 허가와 토목 공사가 필요할 수 있습니다.'],
  ['#cdebb0', 'warn', '초지·잔디', '현재 용도와 소유 관계를 확인해야 합니다.'],
  ['#c8facc', 'bad', '공원', '공원으로 쓰이는 땅이라 어려운 편입니다.'],
  ['#dffce2', 'bad', '체육 시설', '다른 용도로 쓰이고 있어 어려운 편입니다.'],
  ['#def6c0', 'bad', '골프장', '다른 용도로 쓰이고 있어 어려운 편입니다.'],
  ['#aacbaf', 'bad', '묘지', '다른 용도로 쓰이고 있어 어려운 편입니다.'],
  ['#aad3df', 'bad', '물 (강·호수·바다)', '땅이 아닌 곳입니다.'],
  ['#c7c7b4', 'warn', '개발 예정지·공사 중', '개발 계획에 따라 달라집니다. 사업 시행자나 지자체에 확인이 필요합니다.'],
  ['#c5c3c3', 'warn', '채석장·매립지', '현재 용도와 소유 관계를 따로 확인해야 합니다.'],
  ['#f2efe9', 'none', null, null],     // 아무 구분도 칠해지지 않은 땅
].map(([hex, level, label, note]) => ({ rgb: [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)], level, label, note }));

function tileXY(lat, lon) {
  const n = 2 ** Z, x = (lon + 180) / 360 * n, r = lat * Math.PI / 180;
  const y = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
  return { tx: Math.floor(x), ty: Math.floor(y), px: Math.floor((x - Math.floor(x)) * 256), py: Math.floor((y - Math.floor(y)) * 256) };
}
function loadTile(tx, ty) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => reject(new Error('timeout')), 9000);
    img.onload = () => { clearTimeout(timer); resolve(img); }; img.onerror = () => { clearTimeout(timer); reject(new Error('tile')); };
    img.src = `https://tile.openstreetmap.org/${Z}/${tx}/${ty}.png`;
  });
}
/** 지점 주변 21×21 픽셀(약 300m 사방)에서 가장 많이 나온 구분을 고른다. 도로·글자 색은 어느 구분에도 안 맞아 빠진다. */
async function sampleLand(lat, lon) {
  const { tx, ty, px, py } = tileXY(lat, lon);
  const img = await loadTile(tx, ty);
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const S = 21, x0 = Math.max(0, Math.min(256 - S, px - 10)), y0 = Math.max(0, Math.min(256 - S, py - 10));
  const d = g.getImageData(x0, y0, S, S).data; const count = new Map();
  for (let i = 0; i < d.length; i += 4) {
    let best = null, bd = 1e9;
    for (const k of CLASSES) { const dist = Math.abs(d[i] - k.rgb[0]) + Math.abs(d[i + 1] - k.rgb[1]) + Math.abs(d[i + 2] - k.rgb[2]); if (dist < bd) { bd = dist; best = k; } }
    if (bd <= 14) count.set(best, (count.get(best) || 0) + 1);
  }
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return [];
  const [top, n] = ranked[0];
  const total = S * S;
  if (top.level === 'none') { const second = ranked[1]; return second && second[1] >= total * 0.25 ? [second[0]] : []; }   // 대부분 빈 땅이면 "표시 없음"
  return n >= total * 0.15 ? [top] : [];
}
async function adminName(lat, lon) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&zoom=14&accept-language=ko`, { signal: ctl.signal });
    const a = (await r.json()).address || {};
    return [a.province || a.state || a.city, a.city && (a.province || a.state) ? a.city : a.county, a.borough || a.city_district, a.town || a.village || a.suburb || a.quarter || a.neighbourhood].filter((v, i, arr) => v && arr.indexOf(v) === i).join(' ');
  } catch (e) { return ''; } finally { clearTimeout(timer); }
}

/** 반환: { ok, admin, kinds: [{level, label, note}] }. 지도 색을 읽지 못하면 { ok: false, admin } */
export async function landInfo(lat, lon) {
  const [kinds, admin] = await Promise.all([sampleLand(lat, lon).catch(() => null), adminName(lat, lon)]);
  if (kinds === null) return { ok: false, admin };
  return { ok: true, admin, kinds: kinds.map((k) => ({ level: k.level, label: k.label, note: k.note })) };
}
