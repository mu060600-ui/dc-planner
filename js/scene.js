// 계산 결과로 3D 배치를 자동 생성하고 돌려 보는 화면.
// 실제 랙 수가 많아도 대표 구역(최대 48랙)만 그린다. 모델은 교육용 개념 표현이다(제조사 CAD 아님).
import * as THREE from 'three';
import { World } from './world.js';
import { buildSite } from './site.js';

const MAX_RACKS = 48, PER_ROW = 12;

/** 선택값과 계산 결과 → World 가 읽는 배치 데이터 */
export function makeLevel(input, r) {
  const shown = Math.min(r.racks, MAX_RACKS);
  const perRow = Math.min(PER_ROW, shown);
  const rows = Math.ceil(shown / perRow), pairs = Math.ceil(rows / 2);
  const hallD = pairs * 6 + 4, d = Math.max(18, hallD + 2), w = 30;
  const xs = -11.5, z0 = -((pairs - 1) * 6 + 3) / 2;
  const variant = r.server.variant;
  const fill = [], items = [], air = [], liquid = [], power = [], heat = [];
  const rowInfo = [];
  let left = shown;
  for (let i = 0; i < rows; i++) {
    const p = Math.floor(i / 2), back = i % 2 === 1;
    const z = z0 + p * 6 + (back ? 3 : 0), n = Math.min(perRow, left); left -= n;
    fill.push({ variant, x: xs, z, count: n, rot: back ? 180 : 0, dx: 1 });
    rowInfo.push({ z, n, back, p });
    heat.push({ pos: [xs + (n - 1) / 2, z + (back ? 1.0 : -1.0)], size: [n, 1.1], t: r.liquid ? 0.45 : 0.9 });
  }
  const xEnd = xs + perRow - 0.5;
  const aisles = []; for (let p = 0; p < pairs; p++) aisles.push(z0 + p * 6 + 1.5);
  for (const za of aisles) heat.push({ pos: [xs + (perRow - 1) / 2, za], size: [perRow, 1.8], t: 0.1 });

  // 열 배출 설비 (오른쪽 기계 구역)
  const rejects = [];
  for (let i = 0; i < Math.min(2, r.dry); i++) rejects.push('drycooler');
  for (let i = 0; i < Math.min(rejects.length ? 1 : 2, r.chillers); i++) rejects.push('chiller');
  rejects.slice(0, 3).forEach((type, i) => items.push({ id: 'rej' + i, type, pos: [9.6, -d / 2 + 2.6 + i * 3.6], rot: 0 }));
  const zr = -d / 2 + 2.6;
  items.push({ id: 'pump', type: 'pump', pos: [5.6, zr + 0.2], rot: 90 });
  // 전력 설비
  if (r.gens > 0) items.push({ id: 'gen', type: 'generator', pos: [9.6, d / 2 - 3.6], rot: 0 });
  items.push({ id: 'swg', type: 'switchgear', pos: [9.6, d / 2 - 0.7], rot: 180 });
  const upsN = Math.min(3, r.ups);
  for (let i = 0; i < upsN; i++) items.push({ id: 'ups' + i, type: 'ups', pos: [14.3, d / 2 - 2 - i * 1.3], rot: -90 });
  const zu = d / 2 - 2;

  // ---- 랙 줄 위치 정보: 앞면(찬 통로 쪽), 뒷면(더운 쪽)
  const trenches = [], risers = [];
  for (const ri of rowInfo) { ri.sgn = ri.back ? 1 : -1; ri.zFront = ri.z - ri.sgn * 0.55; ri.zRear = ri.z + ri.sgn * 0.55; ri.za = aisles[ri.p]; }

  // ---- 공기 쪽 냉각 장비
  const units = [];                                  // 공조기 위치 (냉수 배관 연결용)
  if (input.cooling === 'inrow') {
    rowInfo.forEach((ri, i) => { ri.ux = xs + ri.n - 0.5 + 0.3; items.push({ id: 'inrow' + i, type: 'inrow', pos: [ri.ux, ri.z], rot: ri.back ? 180 : 0 }); units.push([ri.ux, ri.z, ri.sgn]); });
  } else {
    const type = r.airType.startsWith('FWU') ? 'fwu' : 'crah';
    aisles.slice(0, 3).forEach((za, i) => { items.push({ id: 'air' + i, type, pos: [-14.4, za], rot: 90 }); units.push([-14.0, za, 0]); });
  }
  // ---- 공기 흐름: 찬 통로 → 랙 앞면으로 흡입 → 랙 통과 → 뒷면 더운 공기 → 냉방기로 복귀
  const every = r.liquid ? 4 : 3;
  if (input.cooling === 'inrow') {
    for (const ri of rowInfo) {
      // In-row 는 바로 옆에서 찬 공기를 내보내고, 랙 뒤의 더운 공기를 뒤쪽에서 다시 빨아들인다
      air.push({ color: 'cold', pts: [[ri.ux, 1.0, ri.zFront - ri.sgn * 0.15], [ri.ux - 0.6, 0.9, (ri.zFront + ri.za) / 2], [xs + ri.n * 0.5, 0.9, (ri.zFront + ri.za) / 2], [xs, 0.9, (ri.zFront + ri.za) / 2]] });
      for (let k = 1; k < ri.n; k += every) { const x = xs + k; air.push({ color: 'cold', pts: [[x, 0.9, (ri.zFront + ri.za) / 2], [x, 1.05, ri.zFront - ri.sgn * 0.1], [x, 1.1, ri.zFront + ri.sgn * 0.25]] }); air.push({ color: 'hot', pts: [[x, 1.2, ri.zRear - ri.sgn * 0.2], [x, 1.3, ri.zRear + ri.sgn * 0.3], [x + 0.6, 1.35, ri.zRear + ri.sgn * 0.45]] }); }
      air.push({ color: 'hot', pts: [[xs, 1.35, ri.zRear + ri.sgn * 0.45], [xs + ri.n * 0.5, 1.35, ri.zRear + ri.sgn * 0.45], [ri.ux - 0.3, 1.35, ri.zRear + ri.sgn * 0.45], [ri.ux, 1.3, ri.zRear + ri.sgn * 0.1]] });
    }
  } else {
    aisles.slice(0, 3).forEach((za) => air.push({ color: 'cold', pts: [[-13.5, 1.0, za], [-12.4, 0.7, za], [xs, 0.6, za], [xEnd, 0.6, za]] }));   // 찬 통로를 따라 공급
    for (const ri of rowInfo) {
      const zu = aisles[Math.min(ri.p, 2)], zt = ri.zRear + ri.sgn * 0.55;
      for (let k = 1; k < ri.n; k += every) { const x = xs + k; air.push({ color: 'cold', pts: [[x, 0.6, ri.za], [x, 0.95, (ri.zFront + ri.za) / 2], [x, 1.1, ri.zFront + ri.sgn * 0.25]] }); air.push({ color: 'hot', pts: [[x, 1.2, ri.zRear - ri.sgn * 0.2], [x, 1.5, ri.zRear + ri.sgn * 0.3], [x - 0.2, 2.6, zt], [x - 0.9, 3.0, zt]] }); }
      // 랙 위로 모인 더운 공기가 공조기 상부로 돌아간다
      air.push({ color: 'hot', pts: [[xEnd, 3.0, zt], [xs, 3.0, zt], [-12.6, 3.0, zt], [-13.4, 2.7, (zt + zu) / 2], [-14.0, 2.3, zu]] });
    }
  }

  // ---- 냉각수 배관 (직각 경로)
  const zFar = z0 + (pairs - 1) * 6 + 3 + 1.2;
  if (r.liquid) {
    // 2차 측(서버 쪽): In-Row CDU → 바닥 아래(이중마루 밑) 주배관 → 랙마다 수직관 → 랙 매니폴드
    rowInfo.forEach((ri, i) => {
      const cx = xs + ri.n - 0.5 + 0.55, zs = ri.z + ri.sgn * 0.56, zrt = ri.z + ri.sgn * 0.74, x0 = xs - 0.75;
      items.push({ id: 'cdu' + i, type: 'cdu', pos: [cx, ri.z], rot: ri.back ? 180 : 0 }); ri.cx = cx;
      trenches.push([x0, Math.min(ri.z + ri.sgn * 0.4, ri.z + ri.sgn * 0.92), cx + 0.45, Math.max(ri.z + ri.sgn * 0.4, ri.z + ri.sgn * 0.92)]);
      liquid.push({ color: 'supply', r: 0.06, pts: [[cx - 0.2, 0.5, zs], [cx - 0.2, -0.42, zs], [x0 + 0.25, -0.42, zs]] });
      liquid.push({ color: 'ret', r: 0.06, pts: [[x0 + 0.25, -0.42, zrt], [cx + 0.15, -0.42, zrt], [cx + 0.15, 0.5, zrt]] });
      for (let k = 0; k < ri.n; k++) { const x = xs + k; risers.push({ x: x + ri.sgn * 0.35, z: zs }, { x: x - ri.sgn * 0.35, z: zrt, ret: true }); }
      // 1차 측(시설 쪽): 머리 위 헤더에서 CDU 상부로 내려온다
      const zb = ri.z + ri.sgn * 0.3;
      liquid.push({ color: 'supply', r: 0.07, pts: [[5.0, 3.3, zb], [cx - 0.25, 3.3, zb], [cx - 0.25, 2.55, zb]] });
      liquid.push({ color: 'ret', r: 0.07, pts: [[cx + 0.05, 2.55, zb], [cx + 0.05, 3.55, zb], [4.6, 3.55, zb]] });
    });
    liquid.push({ color: 'supply', r: 0.1, pts: [[7.4, 1.2, zr], [7.4, 3.3, zr], [5.0, 3.3, zr], [5.0, 3.3, zFar]] });
    liquid.push({ color: 'ret', r: 0.1, pts: [[4.6, 3.55, zFar], [4.6, 3.55, zr + 0.8], [7.4, 3.55, zr + 0.8], [7.4, 1.2, zr + 0.8]] });
  } else {
    // 공랭: 머리 위 냉수 헤더에서 공조기마다 분기해 내려온다
    const hz = -d / 2 + 0.8, far = Math.min(...units.map((u) => u[0]));
    liquid.push({ color: 'supply', r: 0.09, pts: [[7.4, 1.2, zr], [7.4, 3.3, zr], [7.4, 3.3, hz], [far, 3.3, hz]] });
    liquid.push({ color: 'ret', r: 0.09, pts: [[far, 3.55, hz + 0.5], [7.0, 3.55, hz + 0.5], [7.0, 3.55, zr + 0.8], [7.4, 1.2, zr + 0.8]] });
    for (const [x, z] of units) {
      liquid.push({ color: 'supply', r: 0.05, pts: [[x - 0.15, 3.3, hz], [x - 0.15, 3.3, z - 0.3], [x - 0.15, 2.5, z - 0.3]] });
      liquid.push({ color: 'ret', r: 0.05, pts: [[x + 0.15, 2.5, z + 0.3], [x + 0.15, 3.55, z + 0.3], [x + 0.15, 3.55, hz + 0.5]] });
    }
  }
  // 전력
  aisles.forEach((za) => power.push({ color: 'power', pts: [[13.8, 2.0, zu], [12, 3.8, zu], [4.2, 3.8, zu], [4.2, 3.8, za], [xEnd, 3.8, za], [xs, 3.8, za]] }));
  power.push({ color: 'power', pts: [[9.6, 2.0, d / 2 - 0.9], [11.5, 3.6, d / 2 - 1.4], [13.8, 2.0, zu]] });

  return {
    id: 'plan', room: { w, d, h: 4.2 }, outColor: 0xd5dee9, spawn: [0, 0, 0],
    zones: [
      { rect: [-15, -d / 2, 4.3, d / 2], color: 0xcfd9e4, opacity: 0, name: { ko: r.racks > shown ? `서버홀 (전체 ${r.racks.toLocaleString()}랙 중 ${shown}랙만 표시)` : `서버홀 (${shown}랙)` } },
      { rect: [4.3, -d / 2, 15, d / 2], color: 0x9aa89a, opacity: 0.55, name: { ko: '기계 · 전력 설비' } },
    ],
    walls: [], fill, items, missions: [], heat, trenches, risers,
    contain: input.cooling === 'air' || input.cooling === 'inrow' ? aisles.map((za) => ({ rect: [xs - 0.5, za - 0.95, xEnd, za + 0.95] })) : [],
    flows: { air, liquid, power },
  };
}

export class Viewer {
  constructor(el) {
    this.el = el;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(r.domElement);
    const scene = (this.scene = new THREE.Scene()); scene.background = new THREE.Color(0xe8eef5);
    const env = new THREE.Scene(); env.background = new THREE.Color(0x9fb3c8);
    const mk = (c, x, y, z, s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); env.add(m); };
    mk(0xffffff, 0, 30, 0, 26); mk(0xdfeaff, 30, 8, 10, 16); mk(0x7f96b6, -30, 4, -10, 18); mk(0x56667e, 0, -30, 0, 30);
    scene.environment = new THREE.PMREMGenerator(r).fromScene(env, 0.04).texture; scene.environmentIntensity = 0.75;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8795a8, 0.95));
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 2.0)); sun.position.set(10, 22, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 70; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    const c = sun.shadow.camera; c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.updateProjectionMatrix();
    scene.add(sun, sun.target);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 6000);
    this.view = 'site'; this.site = null; this.minDist = 12; this.maxDist = 90; this.lookY = 1.2;
    this.world = new World(scene);
    this.ang = 0.7; this.elv = 0.72; this.dist = 44; this.auto = true; this.mode = 'normal'; this.center = new THREE.Vector3();
    const dom = r.domElement; let last = null; const ptrs = new Map(); let pinch = 0;
    dom.addEventListener('pointerdown', (e) => { try { dom.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } ptrs.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; this.auto = false; });
    dom.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const dd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) this.zoom(pinch / dd); pinch = dd; return; }
      this.ang -= (e.clientX - last[0]) * 0.008; this.elv = THREE.MathUtils.clamp(this.elv + (e.clientY - last[1]) * 0.006, 0.18, 1.45); last = [e.clientX, e.clientY];
    });
    const up = (e) => { ptrs.delete(e.pointerId); pinch = 0; };
    dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
    dom.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.1 : 0.9); this.auto = false; }, { passive: false });
    new ResizeObserver(() => this.resize()).observe(el); this.resize();
    const clock = new THREE.Clock();
    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      if (this.auto) this.ang += dt * 0.12;
      const ce = Math.cos(this.elv), se = Math.sin(this.elv);
      this.camera.position.set(this.center.x + Math.sin(this.ang) * ce * this.dist, se * this.dist, this.center.z + Math.cos(this.ang) * ce * this.dist);
      this.camera.lookAt(this.center.x, this.lookY, this.center.z);
      if (this.view === 'hall' && this.world.root) this.world.update(dt, clock.elapsedTime);
      if (this.view === 'site' && this.site) this.site.tick(dt, clock.elapsedTime);
      r.render(scene, this.camera); requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  zoom(f) { this.dist = THREE.MathUtils.clamp(this.dist * f, this.minDist, this.maxDist); }
  resize() { const w = this.el.clientWidth || 600, h = this.el.clientHeight || 400; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  /** 실내 배치와 부지 전체를 둘 다 만들어 두고, 고른 보기만 보여 준다 */
  show(level, input, result) {
    this.world.build(level, null, 'ko'); this.world.setMode(this.mode); this.hallDist = Math.max(38, level.room.d * 1.9);
    if (this.site) { this.scene.remove(this.site.group); this.site.dispose(); }
    this.site = buildSite(input, result); this.scene.add(this.site.group);
    this.setView(this.view, true);
  }
  setView(v, keepAngle = false) {
    this.view = v; const site = v === 'site';
    if (this.world.root) this.world.root.visible = !site;
    if (this.site) this.site.group.visible = site;
    const c = this.sun.shadow.camera;
    if (site && this.site) {
      const R = this.site.radius; this.minDist = R * 0.5; this.maxDist = R * 4.5; this.dist = R * 2.15; this.lookY = R * 0.04;
      this.sun.position.set(R * 0.6, R * 1.3, R * 0.7); c.left = -R * 1.25; c.right = R * 1.25; c.top = R * 1.25; c.bottom = -R * 1.25; c.far = R * 4; this.sun.shadow.normalBias = Math.max(0.03, R * 0.0012);
      this.scene.background.set(0xcfe2f3);
    } else {
      this.minDist = 12; this.maxDist = 90; this.dist = this.hallDist || 44; this.lookY = 1.2;
      this.sun.position.set(10, 22, 12); c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.far = 70; this.sun.shadow.normalBias = 0.03;
      this.scene.background.set(0xe8eef5);
    }
    c.updateProjectionMatrix();
    if (!keepAngle) { this.elv = site ? 0.6 : 0.72; this.auto = true; }
  }
  setMode(m) { this.mode = m; if (this.world.root) this.world.setMode(m); }
  hasFlow(kind) { return this.world.root ? this.world.hasFlow(kind) : false; }
}
