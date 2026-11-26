// 부지 찾기: 국내 변전소(154 / 345 / 765kV) 위치를 지도에 표시하고, 찍은 지점에서 가까운 변전소를 알려 준다.
// 변전소 위치 출처: © OpenStreetMap contributors (ODbL). 한전 공식 자료가 아니며 누락·오류가 있을 수 있다.
// 지도 라이브러리 Leaflet 은 index.html 에서 CDN 으로 불러온다(전역 L).
const COLORS = { 154: '#12a97a', 345: '#1f6fe5', 765: '#c2410c' };
const REGIONS = [['전국', 36.3, 127.9, 7], ['수도권', 37.45, 127.0, 9], ['충청', 36.55, 127.2, 9], ['호남', 35.3, 126.9, 9], ['영남', 35.7, 128.8, 9], ['강원', 37.7, 128.4, 9], ['제주', 33.38, 126.55, 10]];

function km(a, b, c, d) {                      // 두 지점 사이 직선거리 (km)
  const R = 6371, r = Math.PI / 180, dLat = (c - a) * r, dLon = (d - b) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function initMap(el, { onPick }) {
  if (!window.L) throw new Error('지도 라이브러리를 불러오지 못했습니다');
  const L = window.L;
  const data = await (await fetch('data/substations.json')).json();
  const items = data.items;                    // [위도, 경도, kV, 이름]
  const map = L.map(el, { center: [36.3, 127.9], zoom: 7, minZoom: 6, maxZoom: 16, scrollWheelZoom: false, preferCanvas: true });
  map.setMaxBounds([[32.2, 122.5], [39.6, 133.0]]);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '지도·변전소 위치 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(map);
  el.addEventListener('click', () => map.scrollWheelZoom.enable(), { once: true });   // 한 번 누른 뒤에만 휠 확대 (페이지 스크롤 방해 방지)

  const layers = {}; const show = { 154: true, 345: true, 765: true };
  for (const kv of [154, 345, 765]) {
    layers[kv] = L.layerGroup().addTo(map);
    for (const s of items.filter((x) => x[2] === kv)) {
      L.circleMarker([s[0], s[1]], { radius: kv === 765 ? 7 : kv === 345 ? 5.5 : 4, color: '#fff', weight: 1, fillColor: COLORS[kv], fillOpacity: 0.9 })
        .bindTooltip(`${s[3] || '이름 미상'} · ${kv}kV`).addTo(layers[kv]);
    }
  }
  let marker = null, lines = L.layerGroup().addTo(map), need = 154, picked = null;

  function nearest(lat, lon, n = 5, minKv = 0) {
    return items.filter((s) => s[2] >= minKv && show[s[2]]).map((s) => ({ lat: s[0], lon: s[1], kv: s[2], name: s[3] || '이름 미상', km: km(lat, lon, s[0], s[1]) })).sort((a, b) => a.km - b.km).slice(0, n);
  }
  function update() {
    if (!picked) return;
    const [lat, lon] = picked; lines.clearLayers();
    const list = nearest(lat, lon, 5), match = nearest(lat, lon, 1, need)[0] || null;
    for (const s of list.slice(0, 3)) L.polyline([[lat, lon], [s.lat, s.lon]], { color: COLORS[s.kv], weight: 2, dashArray: '5 5', opacity: 0.85 }).addTo(lines);
    if (match) L.polyline([[lat, lon], [match.lat, match.lon]], { color: COLORS[match.kv], weight: 4, opacity: 0.9 }).addTo(lines);
    onPick({ lat, lon, list, match, need });
  }
  map.on('click', (e) => {
    picked = [e.latlng.lat, e.latlng.lng];
    if (!marker) marker = L.marker(picked).addTo(map); else marker.setLatLng(picked);
    marker.bindTooltip('고른 부지', { permanent: true, direction: 'top', offset: [-15, -12] });
    update();
  });
  return {
    meta: data.meta, regions: REGIONS, colors: COLORS,
    fly(i) { const r = REGIONS[i]; map.flyTo([r[1], r[2]], r[3], { duration: 0.7 }); },
    toggle(kv, on) { show[kv] = on; if (on) layers[kv].addTo(map); else map.removeLayer(layers[kv]); update(); },
    setNeed(kv) { if (kv !== need) { need = kv; update(); } },
    pick(lat, lon) { map.fire('click', { latlng: L.latLng(lat, lon) }); },
    resize() { map.invalidateSize(); },
  };
}
