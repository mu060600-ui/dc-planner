// 화면: 선택 → 계산 → 결과(지표, 점검, 자재 목록, 3D 배치), 엑셀 저장
import { WORKLOADS, SERVERS, COOLING, REJECT, REDUNDANCY, VOLTAGE, EXPANSION, ASSUMPTIONS, plan, fmt, powerLabel } from './calc.js';
import { makeLevel, Viewer } from './scene.js';
import { initMap } from './map.js';

const INQUIRY_URL = 'https://www.aik.co.kr/board/list.html?pid=57&fno=8';
const $ = (s) => document.querySelector(s);
const state = { workload: 'inf', itKw: 5000, density: 40, server: 'smc-gpu-air', cooling: 'inrow', reject: 'mix', redundancy: 'N+1', voltage: 'auto', expansion: '1' };
let result = null, viewer = null, buildT = null, mapApi = null, site = null;

// IT 전력 슬라이더: 50kW ~ 300MW 를 로그 눈금으로
const IT_MIN = 50, IT_MAX = 300000;
const toIt = (v) => { const kw = IT_MIN * Math.pow(IT_MAX / IT_MIN, v / 1000); const step = kw < 1000 ? 10 : kw < 10000 ? 100 : 1000; return Math.round(kw / step) * step; };
const fromIt = (kw) => Math.round(Math.log(kw / IT_MIN) / Math.log(IT_MAX / IT_MIN) * 1000);

function optButtons(el, entries, key, extra = () => '') {
  el.innerHTML = entries.map(([k, o]) => `<button class="opt ${state[key] === k ? 'on' : ''} ${o.dim ? 'dim' : ''}" data-k="${k}"><b>${o.name}${extra(k, o)}</b>${o.desc ? `<span>${o.desc}</span>` : ''}</button>`).join('');
  el.onclick = (e) => { const b = e.target.closest('.opt'); if (!b || e.target.closest('a')) return; set(key, b.dataset.k); };
}

function set(key, val) {
  state[key] = val;
  if (key === 'workload') { const w = WORKLOADS[val]; Object.assign(state, { itKw: w.it, density: w.density, server: w.server, cooling: w.cooling }); }
  if (key === 'server') { const s = SERVERS[val]; if (s.cool === 'liquid') state.cooling = 'dlc'; if (s.variant === 'nvl72' && state.density < 100) state.density = 130; }
  render();
}

function render() {
  optButtons($('#o-workload'), Object.entries(WORKLOADS), 'workload');
  const servers = Object.entries(SERVERS).map(([k, s]) => [k, { name: s.name, desc: `${s.size} · ${s.note} · 모델 ${s.model} <a href="${s.url}" target="_blank" rel="noopener">공식 페이지 ↗</a>`, dim: !s.fit.includes(state.workload), cool: s.cool, rec: WORKLOADS[state.workload].server === k }]);
  optButtons($('#o-server'), servers, 'server', (k, o) => `<span class="tag ${o.cool}">${o.cool === 'liquid' ? '액체냉각' : '공랭'}</span>${o.rec ? '<span class="tag rec">추천</span>' : ''}`);
  optButtons($('#o-cooling'), Object.entries(COOLING), 'cooling');
  optButtons($('#o-reject'), Object.entries(REJECT), 'reject');
  optButtons($('#o-redundancy'), Object.entries(REDUNDANCY), 'redundancy');
  const rec = plan(state).recVoltage;
  optButtons($('#o-voltage'), Object.entries(VOLTAGE), 'voltage', (k) => (k === rec ? '<span class="tag rec">이 규모에 맞음</span>' : ''));
  optButtons($('#o-expansion'), Object.entries(EXPANSION), 'expansion');
  $('#s-it').value = fromIt(state.itKw); $('#v-it').textContent = powerLabel(state.itKw);
  $('#s-den').value = state.density; $('#v-den').textContent = `${state.density} kW`;

  const r = (result = plan(state));
  const k = (label, val, sub = '') => `<div class="kpi"><span>${label}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  $('#kpis').innerHTML = [
    k('필요한 랙', `${fmt(r.racks)}대`, `랙당 ${state.density}kW`),
    k('IT 전력', powerLabel(state.itKw), '발열량도 거의 같음'),
    k('전체 시설 전력 예시', powerLabel(Math.round(r.facilityKw)), `냉각에 ${powerLabel(Math.round(r.coolKw))}`),
    k('PUE 예시', fmt(r.pue, 2), '1에 가까울수록 효율적'),
    k('서버실 면적', `${fmt(r.area)}㎡`, `약 ${fmt(r.area / 3.3058)}평`),
    k('수전 용량', `${fmt(r.mva, r.mva < 10 ? 1 : 0)} MVA`, `${r.voltage}kV · 변압기 ${r.transformers}대`),
    k('필요한 부지', `${fmt(r.siteArea)}㎡`, `약 ${fmt(r.siteArea / 3.3058)}평 · 건물 ${r.buildings}동`),
    r.liquid ? k('냉각수 유량', `${fmt(r.flowLpm)} L/min`, `물로 ${powerLabel(Math.round(r.liqKw))}, 공기로 ${powerLabel(Math.round(r.airKw))}`) : k('공기로 식히는 열', powerLabel(Math.round(r.airKw)), `${r.airType.split(' ')[0]} ${r.airUnits}대`),
  ].join('');
  const icon = { ok: '✅', warn: '⚠️', bad: '⛔', info: '💡' };
  $('#checks').innerHTML = r.checks.map((c) => `<div class="chk ${c.level}"><i>${icon[c.level]}</i><span>${c.text}</span></div>`).join('');
  $('#bom').innerHTML = '<tr><th>분류</th><th>품목</th><th style="text-align:right">수량</th><th>비고</th></tr>'
    + r.bom.map((b) => `<tr><td class="c">${b.cat}</td><td>${b.item}</td><td class="n">${typeof b.qty === 'number' ? fmt(b.qty) + ' ' + b.unit : b.qty}</td><td class="c" style="white-space:normal">${b.note}</td></tr>`).join('');
  const shown = Math.min(r.racks, 48);
  state._note = { hall: (r.racks > shown ? `전체 ${fmt(r.racks)}랙 가운데 대표 구역 ${shown}랙만 그렸습니다. ` : '') + '드래그로 돌려 보고 휠로 확대합니다. 교육용 개념 모델입니다.',
    site: `부지 약 ${fmt(r.siteArea)}㎡, 건물 ${r.buildings}동${r.buildings > 4 ? '(4동까지만 표시)' : ''}, ${r.voltage === '22.9' ? '22.9kV 수전설비' : r.voltage + 'kV 변전소'}. 배치는 개념 표현이며 실제 부지 조건에 따라 달라집니다.` };
  $('#vnote').textContent = state._note[view];
  if (mapApi) mapApi.setNeed(needKv()); renderSite();
  clearTimeout(buildT); buildT = setTimeout(build3d, 250);
}

const MODES = [['normal', '일반'], ['air', '공기 흐름'], ['liquid', '냉각수'], ['power', '전력'], ['heat', '열 분포'], ['xray', 'X-Ray']];
let mode = 'normal', view = 'site';
function renderModes() {
  $('#views').innerHTML = [['site', '부지 전체'], ['hall', '서버실 안']].map(([v, n]) => `<button data-v="${v}" class="${view === v ? 'on' : ''}">${n}</button>`).join('');
  $('#modes').innerHTML = view === 'hall' ? MODES.map(([m, n]) => `<button data-m="${m}" class="${mode === m ? 'on' : ''}">${n}</button>`).join('') : '';
  $('#modes').style.display = view === 'hall' ? '' : 'none';
}
function build3d() {
  if (!viewer) {
    try { viewer = new Viewer($('#view3d')); } catch (e) { $('#view3d').innerHTML = '<p style="padding:20px;color:#5b6b80">이 브라우저에서는 3D 화면을 표시할 수 없습니다. 아래 계산 결과는 그대로 볼 수 있습니다.</p>'; viewer = false; return; }
  }
  if (viewer) { viewer.view = view; viewer.show(makeLevel(state, result), state, result); }
}

// ---------------------------------------------------------------- 부지 찾기 (변전소 지도)
function needKv() { return result && result.voltage !== '22.9' ? Number(result.voltage) : 154; }
function renderSite() {
  const el = $('#finder-side'); if (!site || !result) return;
  const m = site.match, need = needKv(), low = result.voltage === '22.9';
  const col = mapApi.colors;
  const head = m
    ? `<div class="pick ${m.km > 15 ? 'warn' : ''}"><b>${m.name} · ${m.kv}kV</b><span>직선거리 약 ${fmt(m.km, 1)}km</span><span>${low ? '이 규모는 22.9kV 배전선로로 받습니다. 그 전기를 보내 주는 가장 가까운 변전소입니다.' : `이 규모(${need}kV 수전)에 맞는 가장 가까운 변전소입니다.`}${m.km > 15 ? ' 거리가 멀어 인입 선로 공사가 길어질 수 있습니다.' : ''}</span></div>`
    : `<div class="pick warn"><b>${need}kV 이상 변전소를 찾지 못했습니다</b><span>표시 전압을 켜거나 다른 위치를 눌러 보세요.</span></div>`;
  el.innerHTML = head + `<h3 style="font-size:13px;color:#5b6b80;margin:10px 0 2px">가까운 변전소 5곳</h3><ul class="near">`
    + site.list.map((s) => `<li><i style="background:${col[s.kv]}"></i><span>${s.name} <em>${s.kv}kV</em></span><b>${fmt(s.km, 1)}km</b></li>`).join('')
    + `</ul><p class="hint">고른 위치: 북위 ${site.lat.toFixed(4)}, 동경 ${site.lon.toFixed(4)}. 거리는 직선거리이며 실제 선로 경로와 다릅니다.</p>`;
}
async function startMap() {
  try {
    mapApi = await initMap($('#map'), { onPick: (s) => { site = s; renderSite(); } });
    const c = mapApi.colors, by = mapApi.meta.by_kv;
    $('#legend').innerHTML = [765, 345, 154].map((kv) => `<label data-kv="${kv}"><input type="checkbox" checked><i style="background:${c[kv]}"></i>${kv}kV · ${by[kv]}곳</label>`).join('');
    $('#legend').onchange = (e) => { const l = e.target.closest('label'); l.classList.toggle('off', !e.target.checked); mapApi.toggle(+l.dataset.kv, e.target.checked); };
    $('#regions').innerHTML = mapApi.regions.map((r, i) => `<button data-i="${i}">${r[0]}</button>`).join('');
    $('#regions').onclick = (e) => { const b = e.target.closest('button'); if (b) mapApi.fly(+b.dataset.i); };
    $('#map-note').textContent = `변전소 ${fmt(mapApi.meta.count)}곳의 위치는 OpenStreetMap 공개 데이터(${mapApi.meta.fetched.slice(0, 4)}-${mapApi.meta.fetched.slice(4, 6)}-${mapApi.meta.fetched.slice(6)} 기준)입니다. 한전 공식 자료가 아니어서 빠지거나 틀린 곳이 있을 수 있고, 변전소의 여유 용량은 알 수 없습니다. 실제 전력 공급 가능 여부는 한전에 확인해야 합니다.`;
    mapApi.setNeed(needKv());
  } catch (e) {
    $('#map').innerHTML = '<p style="padding:20px;color:#5b6b80">지도를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요. 아래 설계 도구는 그대로 쓸 수 있습니다.</p>';
  }
}

// ---------------------------------------------------------------- 내보내기
function summaryText() {
  const r = result, w = WORKLOADS[state.workload];
  return [
    '[AI KOREA 데이터센터 설계해 보기 - 구성 요약]',
    `용도: ${w.name}`, `IT 전력: ${powerLabel(state.itKw)} / 랙당 ${state.density}kW / 랙 ${fmt(r.racks)}대`,
    `서버: ${r.server.name} (${r.server.model})`,
    `냉각: ${COOLING[state.cooling].name} / 열 배출: ${REJECT[state.reject].name} / 예비: ${REDUNDANCY[state.redundancy].name}`,
    `전체 시설 전력 예시: ${powerLabel(Math.round(r.facilityKw))} / PUE 예시 ${fmt(r.pue, 2)} / 서버실 면적 약 ${fmt(r.area)}㎡`,
    `수전: ${r.voltage}kV, 약 ${fmt(r.mva, r.mva < 10 ? 1 : 0)}MVA, 변압기 ${r.transformers}대 / 부지 약 ${fmt(r.siteArea)}㎡ (약 ${fmt(r.siteArea / 3.3058)}평), 건물 ${r.buildings}동`,
    r.liquid ? `냉각수 유량 약 ${fmt(r.flowLpm)} L/min, ${r.cduType} ${r.cduUnits}대` : `${r.airType} ${r.airUnits}대`,
    ...(site ? [`부지 후보: 북위 ${site.lat.toFixed(4)}, 동경 ${site.lon.toFixed(4)}${site.match ? ` / 가까운 ${site.match.kv}kV 변전소: ${site.match.name}, 직선 약 ${fmt(site.match.km, 1)}km` : ''}`] : []),
    '※ 교육·상담용 개략 추정값이며 실제 설계와 견적을 대체하지 않습니다.',
  ].join('\n');
}
function csv() {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`; const r = result;
  const rows = [['AI KOREA 데이터센터 설계해 보기'], ['교육·상담용 개략 추정값이며 실제 설계와 견적을 대체하지 않습니다.'], [],
    ['항목', '값'], ['용도', WORKLOADS[state.workload].name], ['IT 전력 (kW)', state.itKw], ['랙당 전력 밀도 (kW)', state.density], ['랙 수', r.racks],
    ['서버', `${r.server.name} (${r.server.model})`], ['냉각 방식', COOLING[state.cooling].name], ['열 배출', REJECT[state.reject].name], ['예비 설비', REDUNDANCY[state.redundancy].name],
    ['전체 시설 전력 예시 (kW)', Math.round(r.facilityKw)], ['냉각 전력 예시 (kW)', Math.round(r.coolKw)], ['PUE 예시', r.pue.toFixed(2)], ['서버실 면적 (㎡)', Math.round(r.area)], ['수전 전압 (kV)', r.voltage], ['수전 용량 (MVA)', r.mva.toFixed(1)], ['변압기 (대)', r.transformers], ['건물 바닥 면적 (㎡)', Math.round(r.bldgArea)], ['변전소 면적 (㎡)', r.subArea], ['부지 면적 (㎡)', Math.round(r.siteArea)], ['건물 (동)', r.buildings],
    ['냉각수로 가져가는 열 (kW)', Math.round(r.liqKw)], ['공기로 식히는 열 (kW)', Math.round(r.airKw)], ['냉각수 유량 (L/min)', Math.round(r.flowLpm)],
    ...(site ? [['부지 후보 (위도, 경도)', `${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}`], ...site.list.map((x, i) => [`가까운 변전소 ${i + 1}`, `${x.name} ${x.kv}kV, 직선 ${x.km.toFixed(1)}km`])] : []), [],
    ['분류', '품목', '수량', '단위', '비고'], ...r.bom.map((b) => [b.cat, b.item, b.qty, b.unit, b.note]), [],
    ['계산 가정', '값', '설명'], ...ASSUMPTIONS];
  const text = '﻿' + rows.map((x) => x.map(q).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = `AIKOREA_데이터센터_구성_${powerLabel(state.itKw).replace(' ', '')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200); }

// ---------------------------------------------------------------- 시작
$('#cta-top').href = $('#cta-bottom').href = INQUIRY_URL;
$('#s-it').addEventListener('input', (e) => { state.itKw = toIt(+e.target.value); render(); });
$('#s-den').addEventListener('input', (e) => { state.density = +e.target.value; render(); });
$('#o-it').innerHTML = [50, 500, 5000, 30000, 100000, 300000].map((v) => `<button data-v="${v}">${powerLabel(v)}</button>`).join('');
$('#o-it').onclick = (e) => { const b = e.target.closest('button'); if (b) { state.itKw = +b.dataset.v; render(); } };
$('#modes').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; renderModes(); if (viewer) viewer.setMode(mode);
};
$('#views').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.v; renderModes(); if (viewer) viewer.setView(view); $('#vnote').textContent = state._note[view]; };
$('#b-csv').onclick = () => { csv(); toast('CSV 파일로 저장했습니다. 엑셀에서 열 수 있습니다.'); };
$('#b-copy').onclick = async () => { try { await navigator.clipboard.writeText(summaryText()); toast('구성 요약을 복사했습니다.'); } catch (e) { toast('복사하지 못했습니다. 브라우저 권한을 확인해 주세요.'); } };
$('#assume').innerHTML = '<tr><th>가정</th><th>값</th><th>설명</th></tr>' + ASSUMPTIONS.map((a) => `<tr><td>${a[0]}</td><td class="c" style="white-space:normal">${a[1]}</td><td class="c" style="white-space:normal">${a[2]}</td></tr>`).join('');
renderModes(); render(); startMap();
window.__planner = { get map() { return mapApi; }, get site() { return site; }, state, set, setView: (v) => { view = v; renderModes(); if (viewer) viewer.setView(v); }, get result() { return result; }, get viewer() { return viewer; }, summaryText, render };
