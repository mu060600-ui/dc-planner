// 데이터센터 월드: 방, 설비 3D 모델, 충돌 상자, 흐름(공기·전력·냉각수) 시각화, 보기 모드 전환
// 모든 설비 모델은 코드로 만든 교육용 개념 모델이다(제조사 CAD 아님).
import * as THREE from 'three';
import { installExt, buildExtras } from './world_ext.js';

export const C = { cold: 0x39b6ff, hot: 0xff6a3d, power: 0xffd23d, supply: 0x2f8bff, ret: 0xff5252, brand: 0x1f6fe5 };

/** 직각으로 꺾이는 경로. 실제 배관처럼 곧게 가다가 엘보에서 꺾인다(모서리만 작게 둥글림). */
export function orthoCurve(pts, r = 0.18) {
  const v = pts.map((p) => new THREE.Vector3(...p)); const path = new THREE.CurvePath(); let cur = v[0];
  for (let i = 1; i < v.length; i++) {
    const p = v[i], next = v[i + 1];
    if (!next) { if (cur.distanceTo(p) > 1e-4) path.add(new THREE.LineCurve3(cur, p)); break; }
    const din = p.clone().sub(cur), dout = next.clone().sub(p); const rr = Math.min(r, din.length() * 0.49, dout.length() * 0.49);
    const a = p.clone().addScaledVector(din.normalize(), -rr), b = p.clone().addScaledVector(dout.normalize(), rr);
    if (cur.distanceTo(a) > 1e-4) path.add(new THREE.LineCurve3(cur, a));
    path.add(new THREE.QuadraticBezierCurve3(a, p, b)); cur = b;
  }
  return path;
}

// ------------------------------------------------------------------ 캔버스 텍스처
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const rnd = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function drawServer(g, x, y, w, h, kind, r) {
  // 서버 전면: 손잡이, 드라이브 베이, 통풍구, 상태 LED
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, kind === 'switch' ? '#27344a' : '#3a4558'); grad.addColorStop(1, kind === 'switch' ? '#1b2536' : '#262f3f');
  g.fillStyle = grad; g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle = '#5c6a80'; g.fillRect(x, y + 1, 7, h - 2); g.fillRect(x + w - 7, y + 1, 7, h - 2);
  if (kind === 'blank') { g.fillStyle = '#1a2130'; g.fillRect(x + 8, y + 2, w - 16, h - 4); return; }
  if (kind === 'switch') {
    const n = 22; const pw = (w - 40) / n;
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) {
      g.fillStyle = '#0c1220'; g.fillRect(x + 14 + i * pw, y + 3 + k * (h - 6) / 2, pw - 2, (h - 8) / 2);
      g.fillStyle = r() > 0.25 ? '#4dff8a' : '#ffb13d'; g.fillRect(x + 14 + i * pw, y + 3 + k * (h - 6) / 2, 2, 2);
    }
    g.fillStyle = '#39b6ff'; g.fillRect(x + w - 22, y + h / 2 - 2, 8, 4);
    return;
  }
  const rows = h > 24 ? 2 : 1; const bays = kind === 'storage' ? 12 : (rows === 2 ? 8 : 4);
  const bw = (w * (kind === 'storage' ? 0.86 : 0.52)) / (bays / rows);
  for (let k = 0; k < rows; k++) for (let i = 0; i < bays / rows; i++) {
    const bx = x + 12 + i * bw, by = y + 3 + k * (h - 6) / rows, bh = (h - 6) / rows - 2;
    g.fillStyle = '#151c2a'; g.fillRect(bx, by, bw - 3, bh);
    g.fillStyle = '#2f3a4e'; g.fillRect(bx + 1, by + 1, bw - 8, bh - 2);
    g.fillStyle = r() > 0.2 ? '#4dff8a' : '#39b6ff'; g.fillRect(bx + bw - 6, by + 2, 2, 2);
  }
  if (kind !== 'storage') {
    g.fillStyle = '#10161f';
    for (let i = 0; i < 26; i++) for (let k = 0; k < Math.floor((h - 6) / 4); k++) g.fillRect(x + w * 0.60 + i * 3.4, y + 4 + k * 4, 2, 2);
  }
  g.fillStyle = '#39b6ff'; g.fillRect(x + w - 18, y + h / 2 - 1, 5, 3);
  if (kind === 'gpu') { g.fillStyle = '#76b900'; g.fillRect(x + 12, y + 2, 30, 3); }
}

const rackTexCache = {};
export function rackFrontTex(variant) {
  if (rackTexCache[variant]) return rackTexCache[variant];
  const U = 18, W = 256, H = U * 42;
  const t = canvasTex(W, H, (g) => {
    g.fillStyle = '#131926'; g.fillRect(0, 0, W, H);
    const r = rnd(variant.length * 977 + 13);
    let u = 0;
    const put = (n, kind) => { drawServer(g, 6, u * U, W - 12, n * U, kind, r); u += n; };
    if (variant === 'network') { put(1, 'blank'); for (let i = 0; i < 4; i++) put(1, 'switch'); put(2, 'blank'); for (let i = 0; i < 3; i++) put(1, 'switch'); put(2, 'blank'); while (u < 40) put(1, u % 3 ? 'cpu' : 'blank'); }
    else if (variant === 'cpu2u') { put(1, 'switch'); put(1, 'blank'); while (u < 41) put(2, 'cpu'); }
    else if (variant === 'mixed') { put(1, 'switch'); put(1, 'blank'); for (let i = 0; i < 8; i++) put(1, 'cpu'); put(1, 'blank'); for (let i = 0; i < 6; i++) put(2, 'cpu'); put(1, 'blank'); for (let i = 0; i < 4; i++) put(2, 'storage'); while (u < 42) put(1, 'blank'); }
    else if (variant === 'storage') { put(1, 'switch'); while (u < 41) put(2, 'storage'); }
    else if (variant === 'gpu' || variant === 'hgx' || variant === 'dlc') { put(1, 'switch'); put(1, 'blank'); while (u < 40) put(4, 'gpu'); }
    else if (variant === 'nvl72') { put(1, 'blank'); for (let i = 0; i < 4; i++) put(1, 'storage'); for (let i = 0; i < 10; i++) put(1, 'gpu'); for (let i = 0; i < 9; i++) put(1, 'switch'); for (let i = 0; i < 8; i++) put(1, 'gpu'); for (let i = 0; i < 4; i++) put(1, 'storage'); while (u < 42) put(2, 'blank'); }
    else { put(1, 'switch'); put(1, 'blank'); while (u < 42) put(1, 'cpu'); }
  });
  return (rackTexCache[variant] = t);
}
let _rear, _grille, _floor;
function rackRearTex() {
  return _rear || (_rear = canvasTex(256, 756, (g, W, H) => {
    g.fillStyle = '#161c28'; g.fillRect(0, 0, W, H);
    for (let y = 8; y < H - 30; y += 54) for (let x = 14; x < W - 50; x += 50) {
      g.fillStyle = '#0b0f17'; g.beginPath(); g.arc(x + 22, y + 24, 21, 0, 7); g.fill();
      g.strokeStyle = '#3d4a60'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#2a3445'; g.beginPath(); g.arc(x + 22, y + 24, 6, 0, 7); g.fill();
    }
    g.fillStyle = '#ffb13d'; for (let y = 20; y < H; y += 54) g.fillRect(W - 26, y, 10, 4);
  }));
}
export function grilleTex() {
  return _grille || (_grille = canvasTex(256, 128, (g, W, H) => {
    g.fillStyle = '#c9d2dc'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#5d6b7c'; for (let y = 6; y < H; y += 10) g.fillRect(6, y, W - 12, 5);
  }));
}
function floorTex(w, d) {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = '#cfd6de'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) {
      g.fillStyle = (i + k) % 2 ? '#d6dce4' : '#c8d0d9'; g.fillRect(i * 128 + 2, k * 128 + 2, 124, 124);
      g.fillStyle = '#b3bcc7'; for (let a = 0; a < 4; a++) g.fillRect(i * 128 + (a % 2 ? 110 : 12), k * 128 + (a > 1 ? 110 : 12), 5, 5);
    }
  }, [w / 1.2, d / 1.2]);
  return t;
}

// ------------------------------------------------------------------ 설비 모델
export function M(color, o = {}) { return new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.5, ...o }); }
export function box(w, h, d, mat, x = 0, y = 0, z = 0, sys = 'shell') {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; m.userData.sys = sys; return m;
}
export function plane(w, h, mat, x, y, z, ry = 0, sys = 'shell') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.userData.sys = sys; return m;
}
export function glow(color, intensity = 1.6) { return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity }); }

export class Kit {
  constructor() {
    this.body = M(0x2b3545, { metalness: 0.6, roughness: 0.38 });
    this.frame = M(0x55647a, { metalness: 0.7, roughness: 0.35 });
    this.white = M(0xe9eef4, { metalness: 0.2, roughness: 0.45 });
    this.grey = M(0xaab4c0, { metalness: 0.45, roughness: 0.45 });
    this.dark = M(0x1a212d, { metalness: 0.5, roughness: 0.5 });
    this.blue = M(C.brand, { metalness: 0.3, roughness: 0.4 });
    this.ledBlue = glow(0x39b6ff, 2.2); this.ledGreen = glow(0x4dff8a, 2.0); this.ledAmber = glow(0xffb13d, 2.0);
    this.inner = M(0x4a90ff, { emissive: 0x113a7a, emissiveIntensity: 0.6 });
    this.shells = [this.body, this.white, this.grey, this.frame];
  }
  rack(variant = 'cpu1u') {
    const W = 0.9, H = 2.1, D = 1.1, g = new THREE.Group();
    g.add(box(W, H - 0.1, D, this.body, 0, H / 2 + 0.05, 0));
    g.add(box(W + 0.04, 0.1, D + 0.04, this.dark, 0, 0.05, 0));
    g.add(box(W + 0.02, 0.05, D + 0.02, this.frame, 0, H + 0.03, 0));
    const ft = rackFrontTex(variant);
    g.add(plane(W - 0.1, H - 0.2, new THREE.MeshStandardMaterial({ map: ft, emissiveMap: ft, emissive: 0xffffff, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.55 }), 0, H / 2 + 0.05, D / 2 + 0.004, 0, 'face'));
    const rt = rackRearTex();
    g.add(plane(W - 0.1, H - 0.2, new THREE.MeshStandardMaterial({ map: rt, metalness: 0.4, roughness: 0.6 }), 0, H / 2 + 0.05, -D / 2 - 0.004, Math.PI, 'face'));
    for (const sx of [-1, 1]) { g.add(box(0.05, H - 0.1, 0.05, this.frame, sx * (W / 2 - 0.02), H / 2 + 0.05, D / 2 + 0.01)); }
    g.add(box(W - 0.1, 0.03, 0.03, this.ledBlue, 0, H - 0.02, D / 2 + 0.02, 'led'));
    // X-Ray 에서 보이는 내부 서버 슬레드
    for (let i = 0; i < 7; i++) { const s = box(W - 0.22, 0.2, D - 0.3, this.inner, 0, 0.35 + i * 0.26, 0, 'inner'); s.castShadow = false; s.visible = false; g.add(s); }
    // 상단 케이블 트레이 연결
    g.add(box(0.3, 0.06, 0.5, this.grey, 0, H + 0.09, 0, 'struct'));
    return { group: g, size: [W, H, D] };
  }
  crac() {
    const W = 1.9, H = 2.05, D = 0.95, g = new THREE.Group();
    g.add(box(W, H, D, this.white, 0, H / 2, 0));
    g.add(box(W + 0.02, 0.12, D + 0.02, this.blue, 0, 1.52, 0));
    const gt = grilleTex();
    g.add(plane(W - 0.25, 0.7, new THREE.MeshStandardMaterial({ map: gt, metalness: 0.5, roughness: 0.5 }), 0, 0.5, D / 2 + 0.004, 0, 'face'));
    g.add(box(W - 0.3, 0.05, D - 0.25, new THREE.MeshStandardMaterial({ map: gt, metalness: 0.5, roughness: 0.5 }), 0, H + 0.02, 0, 'face'));
    g.add(box(0.42, 0.26, 0.03, this.dark, 0.5, 1.2, D / 2 + 0.012, 'face'));
    g.add(box(0.34, 0.18, 0.02, this.ledBlue, 0.5, 1.2, D / 2 + 0.03, 'led'));
    g.add(box(0.5, 0.03, 0.02, this.ledGreen, -0.45, 1.25, D / 2 + 0.012, 'led'));
    // 내부: 냉각 코일과 송풍 팬 (X-Ray)
    const coil = box(W - 0.3, 0.9, 0.12, M(0xc98a4a, { metalness: 0.8, roughness: 0.3 }), 0, 1.25, 0, 'inner'); coil.visible = false; g.add(coil);
    for (const sx of [-0.5, 0.5]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 24), this.inner); f.rotation.x = Math.PI / 2; f.position.set(sx, 0.45, 0.1); f.userData.sys = 'inner'; f.visible = false; g.add(f); }
    return { group: g, size: [W, H, D] };
  }
  ups() {
    const W = 1.0, H = 1.95, D = 0.9, g = new THREE.Group();
    g.add(box(W, H, D, this.grey, 0, H / 2, 0));
    g.add(box(W + 0.02, 0.08, D + 0.02, this.dark, 0, 0.04, 0));
    g.add(box(0.5, 0.34, 0.03, this.dark, 0, 1.45, D / 2 + 0.012, 'face'));
    g.add(box(0.42, 0.24, 0.02, this.ledGreen, 0, 1.45, D / 2 + 0.03, 'led'));
    for (let i = 0; i < 5; i++) g.add(box(0.1, 0.05, 0.02, i < 4 ? this.ledGreen : this.ledAmber, -0.28 + i * 0.14, 1.12, D / 2 + 0.012, 'led'));
    g.add(plane(W - 0.2, 0.6, new THREE.MeshStandardMaterial({ map: grilleTex(), metalness: 0.5, roughness: 0.5 }), 0, 0.5, D / 2 + 0.004, 0, 'face'));
    for (let i = 0; i < 4; i++) { const b = box(W - 0.2, 0.3, D - 0.2, M(0x2d6a4f, { emissive: 0x0d3b26, emissiveIntensity: 0.6 }), 0, 0.3 + i * 0.36, 0, 'inner'); b.visible = false; g.add(b); }
    return { group: g, size: [W, H, D] };
  }
  pdu() {
    const W = 0.9, H = 1.9, D = 0.5, g = new THREE.Group();
    g.add(box(W, H, D, this.grey, 0, H / 2, 0));
    g.add(box(W - 0.12, 1.3, 0.02, this.dark, 0, 1.1, D / 2 + 0.01, 'face'));
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) g.add(box(0.11, 0.13, 0.03, c === 3 && r === 2 ? this.ledAmber : this.white, -0.27 + c * 0.18, 1.6 - r * 0.2, D / 2 + 0.03, 'face'));
    g.add(box(0.3, 0.06, 0.02, this.ledBlue, 0, 0.32, D / 2 + 0.012, 'led'));
    return { group: g, size: [W, H, D] };
  }
  sensor() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 12), this.frame); pole.position.y = 0.75; pole.castShadow = true; g.add(pole);
    g.add(box(0.3, 0.02, 0.3, this.dark, 0, 0.01, 0));
    g.add(box(0.26, 0.2, 0.08, this.white, 0, 1.55, 0));
    g.add(box(0.18, 0.1, 0.02, this.ledGreen, 0, 1.57, 0.045, 'led'));
    return { group: g, size: [0.3, 1.7, 0.3] };
  }
  kiosk(logoTex) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.12, 32), this.white); base.position.y = 0.06; base.castShadow = true; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 40), this.ledBlue); ring.rotation.x = Math.PI / 2; ring.position.y = 0.13; g.add(ring);
    g.add(box(0.1, 1.0, 0.1, this.blue, 0, 0.6, 0));
    const p = box(0.9, 0.56, 0.05, this.dark, 0, 1.3, 0.05, 'face'); p.rotation.x = -0.3; g.add(p);
    const scr = plane(0.82, 0.48, new THREE.MeshStandardMaterial({ map: logoTex, emissiveMap: logoTex, emissive: 0xffffff, emissiveIntensity: 0.9, color: 0xffffff }), 0, 1.31, 0.085, 0, 'face'); scr.rotation.x = -0.3; g.add(scr);
    return { group: g, size: [0.8, 1.6, 0.8] };
  }
  portal() {
    const g = new THREE.Group();
    g.add(box(0.18, 2.5, 0.2, this.frame, -0.9, 1.25, 0)); g.add(box(0.18, 2.5, 0.2, this.frame, 0.9, 1.25, 0)); g.add(box(2.0, 0.18, 0.2, this.frame, 0, 2.5, 0));
    const door = plane(1.62, 2.4, new THREE.MeshStandardMaterial({ color: 0x0b2a55, emissive: 0x2f8bff, emissiveIntensity: 0.9, transparent: true, opacity: 0.75 }), 0, 1.2, 0.02, 0, 'led');
    g.add(door); g.userData.door = door;
    return { group: g, size: [2.0, 2.6, 0.3], noCollide: true };
  }
}

// ------------------------------------------------------------------ 레벨
export class World {
  constructor(scene) { this.scene = scene; this.root = null; this.colliders = []; this.items = []; this.flowGroups = {}; this.particles = []; this.mode = 'normal'; this.roomH = 3.4; }

  dispose() {
    if (!this.root) return;
    this.scene.remove(this.root);
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.root = null; this.colliders = []; this.items = []; this.flowGroups = {}; this.particles = []; this.movers = []; this.fans = [];
  }

  build(level, logoTex, lang = 'ko') {
    this.lang = lang; this.movers = []; this.fans = [];
    this.dispose();
    const root = (this.root = new THREE.Group()); this.scene.add(root);
    const kit = (this.kit = new Kit());
    const { w, d, h } = level.room; this.roomH = h; this.level = level;
    // 바닥, 벽, 천장
    this.roomMats = [];
    let floorGeo = new THREE.PlaneGeometry(w, d); const ftex = floorTex(w, d);
    if (level.trenches && level.trenches.length) {
      // 바닥 아래 배관이 보이도록 트렌치 자리를 뚫는다 (ShapeGeometry 는 UV 가 좌표값이라 반복 수를 다시 맞춘다)
      const sh = new THREE.Shape(); sh.moveTo(-w / 2, -d / 2); sh.lineTo(w / 2, -d / 2); sh.lineTo(w / 2, d / 2); sh.lineTo(-w / 2, d / 2); sh.closePath();
      for (const [x0, z0, x1, z1] of level.trenches) { const h = new THREE.Path(); h.moveTo(x0, -z0); h.lineTo(x0, -z1); h.lineTo(x1, -z1); h.lineTo(x1, -z0); h.closePath(); sh.holes.push(h); }
      floorGeo = new THREE.ShapeGeometry(sh); ftex.repeat.set(1 / 1.2, 1 / 1.2);
    }
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: ftex, metalness: 0.25, roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.userData.sys = 'room'; root.add(floor);
    const wallM = M(0xe3e9f0, { metalness: 0.05, roughness: 0.85 }); const stripeM = M(C.brand, { metalness: 0.2, roughness: 0.5 });
    const ceilM = M(0xf2f5f8, { metalness: 0, roughness: 0.9, side: THREE.BackSide });
    this.roomMats.push(wallM, stripeM, ceilM, floor.material);
    // 벽은 안쪽 면만 그린다 → 카메라가 벽 밖으로 나가도 방 안이 가려지지 않는다(단면 모형 방식)
    const T = 0.3;
    const walls = [[0, -d / 2, w, 0, 0, -T], [0, d / 2, w, Math.PI, 0, T], [-w / 2, 0, d, Math.PI / 2, -T, 0], [w / 2, 0, d, -Math.PI / 2, T, 0]];
    for (const [x, z, len, ry, ox, oz] of walls) {
      const m = plane(len, h, wallM, x, h / 2, z, ry, 'room'); m.receiveShadow = true; root.add(m);
      const s = plane(len, 0.14, stripeM, x - Math.sign(ox) * 0.004, 1.05, z - Math.sign(oz) * 0.004, ry, 'room'); root.add(s);
      const horiz = ox === 0;
      this.colliders.push(horiz
        ? { minX: -w / 2 - T, maxX: w / 2 + T, minZ: Math.min(z, z + oz), maxZ: Math.max(z, z + oz), y0: 0, y1: h, noCam: true }
        : { minX: Math.min(x, x + ox), maxX: Math.max(x, x + ox), minZ: -d / 2 - T, maxZ: d / 2 + T, y0: 0, y1: h, noCam: true });
    }
    // 방 바깥 바닥
    const out = new THREE.Mesh(new THREE.PlaneGeometry(w + 60, d + 60), M(level.outColor ?? 0x16253a, { roughness: 1, metalness: 0 })); out.rotation.x = -Math.PI / 2; out.position.y = -0.02; out.userData.sys = 'room'; root.add(out);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilM); ceil.rotation.x = -Math.PI / 2; ceil.position.y = h; ceil.userData.sys = 'room'; root.add(ceil);
    const lightM = glow(0xffffff, 1.4);
    for (let x = -w / 2 + 2.5; x < w / 2 - 1; x += 3.5) for (let z = -d / 2 + 2; z < d / 2 - 1; z += 4) { const lp = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.28), lightM); lp.rotation.x = Math.PI / 2; lp.position.set(x, h - 0.02, z); lp.userData.sys = 'led'; root.add(lp); }

    // 설비
    for (const it of level.items) {
      let made;
      if (it.type === 'rack') made = kit.rack(it.variant);
      else if (it.type === 'lab') made = kit.lab(it.color);
      else if (it.type === 'kiosk') made = kit.kiosk(logoTex);
      else made = kit[it.type]();
      const g = made.group; g.position.set(it.pos[0], 0, it.pos[1]); g.rotation.y = THREE.MathUtils.degToRad(it.rot || 0);
      root.add(g);
      const [sw, sh, sd] = made.size; const q = Math.round((it.rot || 0) / 90) % 2 !== 0;
      const hw = (q ? sd : sw) / 2, hd = (q ? sw : sd) / 2;
      if (!made.noCollide) this.colliders.push({ minX: it.pos[0] - hw, maxX: it.pos[0] + hw, minZ: it.pos[1] - hd, maxZ: it.pos[1] + hd, y0: 0, y1: sh, noCam: sh < 1.8 });
      // 외곽선 (가까이 가거나 마우스를 올리면 빛난다)
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(sw + 0.08, sh + 0.06, sd + 0.08)), new THREE.LineBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.9 }));
      edges.position.y = sh / 2; edges.visible = false; edges.userData.sys = 'outline'; g.add(edges);
      g.traverse((o) => { o.userData.itemId = it.id; });
      this.items.push({ ...it, group: g, edges, height: sh, radius: Math.max(hw, hd) + 1.5, pos3: new THREE.Vector3(it.pos[0], 0, it.pos[1]) });
    }
    // 상부 케이블 트레이 (전력 경로를 따라)
    const trayM = M(0x4a5665, { metalness: 0.3, roughness: 0.7 });
    for (const f of level.flows.power || []) for (let i = 0; i < f.pts.length - 1; i++) {
      const a = f.pts[i], b = f.pts[i + 1]; if (Math.abs(a[1] - b[1]) > 0.2 || a[1] < 2.5) continue;
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]); if (len < 0.3) continue;
      const t = box(len, 0.04, 0.24, trayM, (a[0] + b[0]) / 2, a[1] + 0.12, (a[2] + b[2]) / 2, 'struct'); t.rotation.y = -Math.atan2(b[2] - a[2], b[0] - a[0]); t.castShadow = false; root.add(t);
    }
    buildExtras(this, level, kit);
    this.buildFlows(level); this.buildHeat(level);
    this.setMode('normal');
  }

  buildFlows(level) {
    const sphere = new THREE.SphereGeometry(0.07, 10, 8);
    const arrow = new THREE.ConeGeometry(0.1, 0.34, 8); arrow.rotateX(Math.PI / 2);   // 공기 흐름은 진행 방향을 가리키는 화살표
    for (const kind of ['air', 'power', 'liquid']) {
      const grp = new THREE.Group(); grp.visible = false; this.root.add(grp); this.flowGroups[kind] = grp;
      for (const f of level.flows[kind] || []) {
        const curve = kind === 'air' ? new THREE.CatmullRomCurve3(f.pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.4) : orthoCurve(f.pts, kind === 'liquid' ? Math.max(0.16, (f.r || 0.07) * 2.4) : 0.12);
        if (kind === 'liquid') {
          // 냉각수 배관은 항상 보인다 (공급 = 파랑, 환수 = 빨강)
          const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(16, Math.round(curve.getLength() * 8)), f.r || 0.07, 10), f.color === 'ret' ? this.kit.pipeR : this.kit.pipeS);
          pipe.castShadow = true; pipe.userData.sys = 'pipe'; this.root.add(pipe);
        }
        const col = C[f.color] ?? 0xffffff; const len = curve.getLength();
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(12, Math.round(len * 6)), kind === 'air' ? 0.035 : kind === 'liquid' ? (f.r || 0.07) + 0.03 : 0.035, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: kind === 'air' ? 0.16 : kind === 'liquid' ? 0.3 : 0.5, depthWrite: false }));
        tube.userData.sys = 'flow'; grp.add(tube);
        const n = Math.min(70, Math.max(kind === 'air' ? 2 : 3, Math.round(len * (kind === 'air' ? 0.9 : 1.6))));
        const inst = new THREE.InstancedMesh(kind === 'air' ? arrow : sphere, new THREE.MeshBasicMaterial({ color: col }), n);
        inst.userData.sys = 'flow'; grp.add(inst);
        this.particles.push({ inst, curve, n, speed: (kind === 'power' ? 2.2 : kind === 'air' ? 1.6 : 1.3) / len, kind });
      }
    }
  }

  buildHeat(level) {
    const grp = new THREE.Group(); grp.visible = false; this.root.add(grp); this.heatGroup = grp;
    const col = new THREE.Color();
    for (const z of level.heat || []) {
      col.setHSL(0.66 * (1 - z.t), 0.95, 0.5);
      const m = new THREE.Mesh(new THREE.BoxGeometry(z.size[0], 2.3, z.size[1]), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, depthWrite: false }));
      m.position.set(z.pos[0], 1.16, z.pos[1]); m.userData.sys = 'flow'; grp.add(m);
    }
  }

  hasFlow(kind) { return (this.level.flows[kind] || []).length > 0; }

  setMode(mode) {
    this.mode = mode;
    for (const k in this.flowGroups) this.flowGroups[k].visible = (mode === k) || (mode === 'bim' && k !== 'air');
    this.heatGroup.visible = mode === 'heat';
    const ghost = mode === 'xray' || mode === 'bim';
    for (const m of this.kit.shells) { m.transparent = ghost; m.opacity = ghost ? 0.16 : 1; m.depthWrite = !ghost; m.needsUpdate = true; }
    for (const m of this.roomMats) { m.transparent = mode === 'bim'; m.opacity = mode === 'bim' ? 0.18 : 1; m.depthWrite = mode !== 'bim'; m.needsUpdate = true; }
    this.root.traverse((o) => {
      const s = o.userData.sys;
      if (s === 'inner') o.visible = ghost;
      if (s === 'face') o.visible = mode !== 'bim';
    });
    this.forceOutline = mode === 'bim';
  }

  update(dt, time) {
    for (const p of this.particles) {
      if (!this.flowGroups[p.kind].visible) continue;
      for (let i = 0; i < p.n; i++) {
        const u = ((time * p.speed + i / p.n) % 1 + 1) % 1;
        p.curve.getPointAt(u, P);
        if (p.kind === 'air') { p.curve.getTangentAt(u, TAN); DUM.position.copy(P); DUM.lookAt(P.x + TAN.x, P.y + TAN.y, P.z + TAN.z); DUM.updateMatrix(); p.inst.setMatrixAt(i, DUM.matrix); }
        else { MAT.makeTranslation(P.x, P.y, P.z); p.inst.setMatrixAt(i, MAT); }
      }
      p.inst.instanceMatrix.needsUpdate = true;
    }
    for (const it of this.items) if (it.type === 'portal') it.group.userData.door.material.emissiveIntensity = 0.8 + Math.sin(time * 3) * 0.3;
    for (const m of this.movers) {
      m.u = (m.u + dt * m.speed) % 1; m.curve.getPointAt(m.u, P); const q = m.curve.getPointAt((m.u + 0.01) % 1);
      m.obj.rotation.y = Math.atan2(q.x - P.x, q.z - P.z); m.obj.position.set(P.x, 0, P.z);
    }
    for (const f of this.fans || []) f.rotation.y += dt * 7;
  }

  /** 가장 가까운 상호작용 대상 */
  nearest(pos) {
    let best = null, bd = 1e9;
    for (const it of this.items) {
      const d = Math.hypot(pos.x - it.pos[0], pos.z - it.pos[1]);
      if (d < it.radius && d < bd) { best = it; bd = d; }
    }
    return best;
  }
  item(id) { return this.items.find((i) => i.id === id); }
  highlight(near, hover) { for (const it of this.items) it.edges.visible = this.forceOutline || it === near || it === hover; }
}
const P = new THREE.Vector3(), MAT = new THREE.Matrix4(), TAN = new THREE.Vector3(), DUM = new THREE.Object3D();

// ------------------------------------------------------------------ 메인 화면 배경: 데이터센터 캠퍼스
export function buildCampus() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), M(0xb9c6d3, { roughness: 0.9, metalness: 0 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 70), M(0x6d7b8c, { roughness: 0.9, metalness: 0 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, 12); g.add(road);
  const wallM = M(0xeef2f6, { roughness: 0.7, metalness: 0.1 }), blueM = M(C.brand, { roughness: 0.4 }), darkM = M(0x2b3545, { roughness: 0.4, metalness: 0.6 }), winM = glow(0x6fd0ff, 0.9), pipeS = M(C.supply, { roughness: 0.35, metalness: 0.5 }), pipeR = M(C.ret, { roughness: 0.35, metalness: 0.5 }), steel = M(0x9aa6b4, { roughness: 0.4, metalness: 0.7 });
  const building = (x, z, w, h, d) => {
    g.add(box(w, h, d, wallM, x, h / 2, z)); g.add(box(w + 0.2, 0.5, d + 0.2, blueM, x, h + 0.25, z));
    for (let i = 0; i < Math.floor(w / 3); i++) g.add(box(1.6, h * 0.5, 0.06, winM, x - w / 2 + 2 + i * 3, h * 0.5, z + d / 2 + 0.04, 'led'));
    g.add(box(w, 0.6, 0.1, darkM, x, 0.3, z + d / 2 + 0.05));
  };
  building(-13, -16, 20, 8, 14); building(13, -18, 20, 10, 16); building(0, -40, 34, 13, 14);
  // 기계실과 냉각설비 (칠러, 냉각탑)
  g.add(box(9, 4, 6, M(0xd5dce4), -27, 2, -6));
  for (let i = 0; i < 4; i++) {
    const x = 24 + (i % 2) * 5, z = -4 + Math.floor(i / 2) * 5;
    g.add(box(4, 2.2, 3.4, steel, x, 1.3, z)); g.add(box(4.1, 0.25, 3.5, darkM, x, 0.12, z));
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 24), darkM); fan.position.set(x, 2.55, z); fan.userData.fan = true; g.add(fan);
  }
  // 배관 랙 (공급 = 파랑, 환수 = 빨강)
  for (const [m, y] of [[pipeS, 3.2], [pipeR, 3.7]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 44, 16), m); p.rotation.z = Math.PI / 2; p.position.set(0, y, -7.5); p.castShadow = true; g.add(p);
  }
  for (let x = -20; x <= 20; x += 5) { g.add(box(0.25, 4, 0.25, steel, x, 2, -7.5)); g.add(box(0.25, 0.25, 1.4, steel, x, 2.9, -7.5)); }
  // 전력설비 (변압기, 발전기)
  for (let i = 0; i < 3; i++) { g.add(box(3, 2.4, 2.2, M(0x7f8c9b, { metalness: 0.6 }), -26 + i * 4.2, 1.2, 5)); g.add(box(0.4, 0.8, 0.4, glow(C.power, 0.8), -26 + i * 4.2, 2.8, 5, 'led')); }
  return g;
}

installExt(Kit);
