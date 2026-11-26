// 확장 설비 모델(LEVEL 2~6)과 레벨 부가 요소: 구역, 유리 칸막이, 반복 랙, 컨테인먼트, AMR
// 모든 모델은 코드로 만든 교육용 개념 모델이다(제조사 CAD 아님).
import * as THREE from 'three';
import { box, plane, glow, M, C, grilleTex, rackFrontTex, canvasTex } from './world.js';

function cyl(r, h, mat, x, y, z, axis = 'y', sys = 'shell', seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z); m.castShadow = true; m.userData.sys = sys; return m;
}
function hide(m) { m.visible = false; m.castShadow = false; m.userData.sys = 'inner'; return m; }
function grille() { return new THREE.MeshStandardMaterial({ map: grilleTex(), metalness: 0.5, roughness: 0.5 }); }
function fanDisc(kit, r, x, y, z, axis = 'y') {
  const g = new THREE.Group(), spin = new THREE.Group();
  g.add(cyl(r, 0.05, kit.dark, 0, 0, 0, 'y', 'face', 24));
  for (let i = 0; i < 5; i++) { const b = box(r * 0.8, 0.02, r * 0.26, kit.grey, 0, 0, 0, 'face'); b.castShadow = false; const a = i * Math.PI * 2 / 5; b.rotation.y = a; b.position.set(Math.cos(a) * r * 0.45, 0.04, -Math.sin(a) * r * 0.45); spin.add(b); }
  g.add(spin); kit.fans.push(spin);
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  g.position.set(x, y, z); return g;
}

export function installExt(Kit) {
  const baseRack = Kit.prototype.rack;
  Object.assign(Kit.prototype, {
    initExt() {
      if (this.pipeS) return;
      this.fans = [];
      this.pipeS = M(C.supply, { metalness: 0.5, roughness: 0.3 }); this.pipeR = M(C.ret, { metalness: 0.5, roughness: 0.3 });
      this.steel = M(0x9aa6b4, { metalness: 0.7, roughness: 0.35 }); this.green = M(0x2f5d50, { metalness: 0.4, roughness: 0.5 }); this.copper = M(0xc98a4a, { metalness: 0.85, roughness: 0.3 });
      this.glass = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.22, metalness: 0.1, roughness: 0.05, depthWrite: false });
      this.shells.push(this.steel, this.green);
    },
    rack(variant) {
      this.initExt();
      const r = baseRack.call(this, variant); const g = r.group; const [W, H, D] = r.size;
      const liquid = variant === 'hgx' || variant === 'dlc' || variant === 'nvl72';
      if (variant === 'gpu' || liquid) g.add(box(W - 0.1, 0.03, 0.03, glow(0x76b900, 2.2), 0, H - 0.07, D / 2 + 0.02, 'led'));
      if (liquid) {
        // 랙 뒤쪽 세로 매니폴드(공급·환수)와 서버로 가는 호스
        g.add(cyl(0.045, H - 0.3, this.pipeS, -W / 2 + 0.1, H / 2 + 0.05, -D / 2 - 0.07, 'y', 'pipe'));
        g.add(cyl(0.045, H - 0.3, this.pipeR, W / 2 - 0.1, H / 2 + 0.05, -D / 2 - 0.07, 'y', 'pipe'));
        for (let i = 0; i < 8; i++) {
          g.add(cyl(0.018, 0.16, this.pipeS, -W / 2 + 0.2, 0.4 + i * 0.2, -D / 2 - 0.06, 'x', 'pipe', 8));
          g.add(cyl(0.018, 0.16, this.pipeR, W / 2 - 0.2, 0.4 + i * 0.2, -D / 2 - 0.06, 'x', 'pipe', 8));
        }
        for (let i = 0; i < 7; i++) g.add(hide(box(W - 0.4, 0.05, D - 0.5, this.copper, 0, 0.47 + i * 0.26, 0)));   // 콜드 플레이트(X-Ray)
      }
      if (variant === 'nvl72') { g.add(box(W - 0.1, 0.34, 0.03, this.white, 0, 0.3, D / 2 + 0.012, 'face')); g.add(box(0.3, 0.14, 0.02, this.ledBlue, 0, 0.3, D / 2 + 0.03, 'led')); }
      return r;
    },
    crah() {
      this.initExt(); const r = this.crac(); const [W, H] = r.size;
      r.group.add(cyl(0.07, 0.6, this.pipeS, -W / 2 + 0.3, H + 0.3, -0.2, 'y', 'pipe')); r.group.add(cyl(0.07, 0.6, this.pipeR, -W / 2 + 0.55, H + 0.3, -0.2, 'y', 'pipe'));
      return r;
    },
    inrow() {
      this.initExt(); const W = 0.45, H = 2.1, D = 1.1, g = new THREE.Group();
      g.add(box(W, H, D, this.white, 0, H / 2, 0)); g.add(box(W + 0.02, 0.1, D + 0.02, this.blue, 0, 1.75, 0));
      g.add(plane(W - 0.08, 1.3, grille(), 0, 0.85, D / 2 + 0.004, 0, 'face')); g.add(box(0.2, 0.1, 0.02, this.ledBlue, 0, 1.9, D / 2 + 0.012, 'led'));
      g.add(cyl(0.05, 0.5, this.pipeS, -0.1, H + 0.25, -0.3, 'y', 'pipe')); g.add(cyl(0.05, 0.5, this.pipeR, 0.1, H + 0.25, -0.3, 'y', 'pipe'));
      g.add(hide(box(W - 0.1, 1.4, 0.1, this.copper, 0, 1.0, 0)));
      return { group: g, size: [W, H, D] };
    },
    chiller() {
      this.initExt(); const W = 3.4, H = 2.3, D = 1.7, g = new THREE.Group();
      g.add(box(W, 0.2, D, this.dark, 0, 0.1, 0)); g.add(box(W - 0.1, H - 0.5, D - 0.1, this.steel, 0, 0.2 + (H - 0.5) / 2, 0));
      g.add(box(W - 0.6, 0.6, 0.03, grille(), 0, 1.1, D / 2 - 0.03, 'face')); g.add(box(0.5, 0.3, 0.03, this.ledBlue, -W / 2 + 0.5, 1.6, D / 2 - 0.03, 'led'));
      for (const sx of [-0.95, 0, 0.95]) g.add(fanDisc(this, 0.38, sx, H - 0.26, 0));
      g.add(cyl(0.11, 0.7, this.pipeS, W / 2 - 0.1, 0.6, 0.4, 'x', 'pipe')); g.add(cyl(0.11, 0.7, this.pipeR, W / 2 - 0.1, 0.6, -0.4, 'x', 'pipe'));
      g.add(hide(cyl(0.3, W - 0.8, this.copper, 0, 0.75, 0.3, 'x'))); g.add(hide(cyl(0.3, W - 0.8, this.inner, 0, 0.75, -0.3, 'x')));
      return { group: g, size: [W, H, D] };
    },
    pump() {
      this.initExt(); const W = 0.9, H = 1.0, D = 1.5, g = new THREE.Group();
      g.add(box(W, 0.12, D, this.dark, 0, 0.06, 0)); g.add(cyl(0.26, 0.7, this.blue, 0, 0.45, -0.3, 'z')); g.add(cyl(0.34, 0.3, this.steel, 0, 0.45, 0.35, 'z'));
      g.add(cyl(0.09, 0.5, this.pipeS, 0, 0.9, 0.35, 'y', 'pipe')); g.add(cyl(0.09, 0.4, this.pipeS, 0, 0.45, 0.65, 'z', 'pipe'));
      return { group: g, size: [W, H, D] };
    },
    switchgear() {
      this.initExt(); const W = 2.6, H = 2.1, D = 0.7, g = new THREE.Group();
      g.add(box(W, H, D, this.grey, 0, H / 2, 0));
      for (let i = 0; i < 4; i++) {
        const x = -W / 2 + 0.33 + i * 0.65;
        g.add(box(0.58, 1.9, 0.02, this.white, x, H / 2, D / 2 + 0.01, 'face')); g.add(box(0.2, 0.2, 0.03, this.dark, x, 1.6, D / 2 + 0.03, 'face'));
        g.add(box(0.1, 0.04, 0.02, i === 1 ? this.ledAmber : this.ledGreen, x, 1.35, D / 2 + 0.03, 'led')); g.add(box(0.06, 0.3, 0.05, this.dark, x + 0.2, 1.0, D / 2 + 0.03, 'face'));
      }
      for (let i = 0; i < 3; i++) g.add(hide(box(0.08, 1.6, 0.08, this.copper, -0.3 + i * 0.3, 1.0, 0)));
      return { group: g, size: [W, H, D] };
    },
    fwu() {
      this.initExt(); const W = 3.2, H = 2.7, D = 0.7, g = new THREE.Group();
      g.add(box(W, H, D, this.white, 0, H / 2, 0)); g.add(box(W + 0.02, 0.12, D + 0.02, this.blue, 0, H - 0.1, 0));
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.add(fanDisc(this, 0.33, -1.14 + c * 0.76, 0.5 + r * 0.76, D / 2 + 0.03, 'z'));
      g.add(hide(box(W - 0.3, H - 0.5, 0.12, this.copper, 0, H / 2, -0.15)));
      g.add(cyl(0.08, 0.5, this.pipeS, -W / 2 + 0.3, H + 0.25, -0.15, 'y', 'pipe')); g.add(cyl(0.08, 0.5, this.pipeR, -W / 2 + 0.6, H + 0.25, -0.15, 'y', 'pipe'));
      return { group: g, size: [W, H, D] };
    },
    desk() {
      this.initExt(); const W = 3.2, H = 1.6, D = 1.1, g = new THREE.Group();
      g.add(box(W, 0.08, D, this.white, 0, 0.78, 0)); g.add(box(W - 0.2, 0.74, 0.08, this.blue, 0, 0.37, -D / 2 + 0.1));
      for (const sx of [-1.4, 1.4]) g.add(box(0.08, 0.74, D - 0.1, this.grey, sx, 0.37, 0));
      const cols = [0x39b6ff, 0x4dff8a, 0xffb13d];
      for (let i = 0; i < 3; i++) { g.add(box(0.92, 0.56, 0.05, this.dark, -1.0 + i, 1.25, -0.25, 'face')); g.add(box(0.84, 0.48, 0.02, glow(cols[i], 1.0), -1.0 + i, 1.25, -0.215, 'led')); g.add(box(0.08, 0.2, 0.08, this.dark, -1.0 + i, 0.9, -0.25)); }
      return { group: g, size: [W, H, D] };
    },
    cdu() {
      this.initExt(); const W = 0.8, H = 2.1, D = 1.1, g = new THREE.Group();
      g.add(box(W, H, D, this.white, 0, H / 2, 0)); g.add(box(W + 0.02, 0.1, D + 0.02, this.blue, 0, 1.82, 0));
      g.add(box(0.44, 0.3, 0.03, this.dark, 0, 1.5, D / 2 + 0.012, 'face')); g.add(box(0.36, 0.22, 0.02, this.ledBlue, 0, 1.5, D / 2 + 0.03, 'led'));
      const win = box(W - 0.2, 0.9, 0.02, this.glass, 0, 0.7, D / 2 + 0.012, 'face'); win.castShadow = false; g.add(win);
      // 내부: 판형 열교환기, 펌프 2대(이중화)
      for (let i = 0; i < 9; i++) g.add(hide(box(0.4, 0.6, 0.025, i % 2 ? this.pipeS : this.pipeR, 0, 1.2, -0.12 + i * 0.03)));
      for (const sx of [-0.18, 0.18]) g.add(hide(cyl(0.11, 0.3, this.inner, sx, 0.4, 0.1, 'z')));
      for (const [m, x] of [[this.pipeS, -0.25], [this.pipeR, -0.08], [this.pipeS, 0.12], [this.pipeR, 0.29]]) g.add(cyl(0.05, 0.5, m, x, H + 0.25, -0.3, 'y', 'pipe'));
      return { group: g, size: [W, H, D] };
    },
    manifold() {
      this.initExt(); const W = 1.4, H = 2.0, D = 0.5, g = new THREE.Group();
      g.add(box(W, 0.1, D, this.dark, 0, 0.05, 0)); g.add(box(0.06, H, 0.06, this.frame, -W / 2 + 0.05, H / 2, 0)); g.add(box(0.06, H, 0.06, this.frame, W / 2 - 0.05, H / 2, 0)); g.add(box(W, 0.06, 0.06, this.frame, 0, H - 0.03, 0));
      g.add(cyl(0.07, H - 0.3, this.pipeS, -0.3, H / 2, 0, 'y', 'pipe')); g.add(cyl(0.07, H - 0.3, this.pipeR, 0.3, H / 2, 0, 'y', 'pipe'));
      for (let i = 0; i < 9; i++) for (const [m, x] of [[this.pipeS, -0.3], [this.pipeR, 0.3]]) { g.add(cyl(0.028, 0.14, this.steel, x, 0.3 + i * 0.18, 0.1, 'z', 'pipe', 10)); g.add(cyl(0.02, 0.12, m, x, 0.3 + i * 0.18, 0.2, 'z', 'pipe', 8)); }
      return { group: g, size: [W, H, D] };
    },
    exhibit() {
      // 유리 진열대 안의 액체냉각 GPU 서버(덮개를 연 모습): GPU 위 콜드 플레이트, 공급·환수 호스
      this.initExt(); const W = 1.8, H = 1.5, D = 1.2, g = new THREE.Group();
      g.add(box(W, 0.8, D, this.white, 0, 0.4, 0)); g.add(box(W + 0.04, 0.06, D + 0.04, this.blue, 0, 0.82, 0)); g.add(box(W - 0.2, 0.1, D - 0.3, this.dark, 0, 0.9, 0, 'face'));
      for (let i = 0; i < 8; i++) {
        const x = -0.6 + (i % 4) * 0.4, z = i < 4 ? -0.18 : 0.2;
        g.add(box(0.3, 0.05, 0.26, glow(0x76b900, 0.25), x, 0.97, z, 'face')); g.add(box(0.22, 0.06, 0.2, this.copper, x, 1.02, z, 'face'));
        g.add(cyl(0.015, 0.2, this.pipeS, x - 0.05, 1.08, z + 0.02, 'z', 'pipe', 8)); g.add(cyl(0.015, 0.2, this.pipeR, x + 0.05, 1.08, z + 0.02, 'z', 'pipe', 8));
      }
      g.add(cyl(0.03, W - 0.4, this.pipeS, 0, 1.1, 0.42, 'x', 'pipe', 10)); g.add(cyl(0.03, W - 0.4, this.pipeR, 0, 1.1, -0.4, 'x', 'pipe', 10));
      const cs = box(W - 0.06, 0.6, D - 0.06, this.glass, 0, 1.2, 0, 'face'); cs.castShadow = false; g.add(cs);
      return { group: g, size: [W, H, D] };
    },
    tower() {
      this.initExt(); const W = 3.2, H = 3.6, D = 3.2, g = new THREE.Group();
      g.add(box(W, 0.3, D, this.dark, 0, 0.15, 0)); g.add(box(W - 0.2, 2.4, D - 0.2, this.steel, 0, 1.5, 0));
      g.add(plane(W - 0.6, 1.2, grille(), 0, 1.2, D / 2 - 0.09, 0, 'face')); g.add(plane(W - 0.6, 1.2, grille(), 0, 1.2, -D / 2 + 0.09, Math.PI, 'face'));
      g.add(cyl(1.2, 0.8, this.white, 0, 3.1, 0, 'y', 'shell', 28)); g.add(fanDisc(this, 1.05, 0, 3.52, 0));
      return { group: g, size: [W, H, D] };
    },
    drycooler() {
      this.initExt(); const W = 4.4, H = 1.9, D = 2.0, g = new THREE.Group();
      for (const sx of [-1.9, 1.9]) for (const sz of [-0.8, 0.8]) g.add(box(0.12, 0.8, 0.12, this.frame, sx, 0.4, sz));
      g.add(box(W, 0.9, D, this.steel, 0, 1.25, 0)); g.add(box(W - 0.2, 0.7, 0.03, grille(), 0, 1.25, D / 2 + 0.005, 'face'));
      for (let i = 0; i < 4; i++) g.add(fanDisc(this, 0.45, -1.6 + i * 1.07, 1.73, 0));
      return { group: g, size: [W, H, D] };
    },
    generator() {
      this.initExt(); const W = 3.8, H = 2.3, D = 1.5, g = new THREE.Group();
      g.add(box(W, 0.2, D, this.dark, 0, 0.1, 0)); g.add(box(W - 0.1, H - 0.3, D - 0.1, this.green, 0, 0.2 + (H - 0.3) / 2, 0));
      g.add(box(1.0, 0.9, 0.03, grille(), -1.1, 1.2, D / 2 - 0.03, 'face')); g.add(box(0.5, 0.4, 0.03, this.dark, 1.2, 1.4, D / 2 - 0.03, 'face')); g.add(box(0.3, 0.06, 0.02, this.ledGreen, 1.2, 1.4, D / 2 - 0.01, 'led'));
      g.add(cyl(0.12, 0.9, this.dark, 1.4, H + 0.3, 0, 'y'));
      g.add(hide(box(1.6, 1.0, 0.8, this.inner, -0.6, 1.0, 0))); g.add(hide(cyl(0.45, 1.0, this.copper, 1.0, 1.0, 0, 'x')));
      return { group: g, size: [W, H, D] };
    },
    hx() {
      this.initExt(); const W = 1.3, H = 1.6, D = 0.7, g = new THREE.Group();
      g.add(box(W, 0.1, D, this.dark, 0, 0.05, 0)); g.add(box(0.08, H - 0.1, D, this.blue, -W / 2 + 0.04, H / 2 + 0.05, 0)); g.add(box(0.08, H - 0.1, D, this.blue, W / 2 - 0.04, H / 2 + 0.05, 0));
      for (let i = 0; i < 14; i++) g.add(box(0.05, H - 0.4, D - 0.1, i % 2 ? this.steel : this.grey, -0.5 + i * 0.077, H / 2 + 0.05, 0));
      for (const [m, y, z] of [[this.pipeS, 1.3, 0.2], [this.pipeR, 0.4, 0.2], [this.pipeR, 1.3, -0.2], [this.pipeS, 0.4, -0.2]]) g.add(cyl(0.07, 0.3, m, -W / 2 - 0.1, y, z, 'x', 'pipe'));
      return { group: g, size: [W, H, D] };
    },
    modular() {
      this.initExt(); const W = 6.2, H = 2.9, D = 2.6, g = new THREE.Group();
      g.add(box(W, H, D, this.white, 0, H / 2, 0)); g.add(box(W + 0.04, 0.2, D + 0.04, this.blue, 0, H - 0.1, 0)); g.add(box(W + 0.04, 0.16, D + 0.04, this.dark, 0, 0.08, 0));
      g.add(box(1.0, 2.1, 0.04, this.grey, -2.2, 1.15, D / 2 + 0.01, 'face')); g.add(box(0.5, 0.2, 0.02, this.ledBlue, -2.2, 2.4, D / 2 + 0.02, 'led'));
      for (let i = 0; i < 3; i++) g.add(box(1.0, 0.9, 0.03, grille(), -0.6 + i * 1.2, 1.5, D / 2 + 0.01, 'face'));
      for (let i = 0; i < 6; i++) g.add(hide(box(0.6, 2.0, 1.0, this.inner, -2.2 + i * 0.85, 1.2, 0)));
      return { group: g, size: [W, H, D] };
    },
    heatrec() {
      this.initExt(); const W = 2.4, H = 2.1, D = 1.3, g = new THREE.Group(); const hot = M(0xff8a3d, { metalness: 0.5, roughness: 0.3 });
      g.add(box(W, H - 0.3, D, this.white, 0, (H - 0.3) / 2, 0)); g.add(box(W + 0.02, 0.1, D + 0.02, hot, 0, 1.5, 0)); g.add(box(0.5, 0.3, 0.03, this.ledAmber, -0.6, 1.2, D / 2 + 0.012, 'led'));
      g.add(cyl(0.1, 0.8, this.pipeR, -0.7, H, 0, 'y', 'pipe')); g.add(cyl(0.1, 0.8, hot, 0.7, H, 0, 'y', 'pipe')); g.add(cyl(0.1, 1.4, hot, 0, H + 0.3, 0, 'x', 'pipe'));
      g.add(hide(box(1.6, 0.9, 0.7, this.copper, 0, 0.8, 0)));
      return { group: g, size: [W, H, D] };
    },
    amr() {
      this.initExt(); const W = 0.9, H = 0.9, D = 1.2, g = new THREE.Group();
      g.add(box(W, 0.26, D, this.white, 0, 0.2, 0)); g.add(box(W + 0.02, 0.05, D + 0.02, this.ledBlue, 0, 0.09, 0, 'led')); g.add(box(W - 0.1, 0.06, D - 0.1, this.dark, 0, 0.36, 0));
      g.add(box(0.5, 0.3, 0.5, M(0xc9a26b, { roughness: 0.9, metalness: 0 }), 0, 0.54, 0));
      return { group: g, size: [W, H, D] };
    },
    lab(color = 0xb37bff) {
      this.initExt(); const W = 1.3, H = 1.6, D = 0.7, g = new THREE.Group();
      g.add(box(W, 0.9, D, this.white, 0, 0.45, 0)); g.add(box(W + 0.02, 0.06, D + 0.02, M(color, { roughness: 0.4 }), 0, 0.93, 0));
      const p = box(1.1, 0.6, 0.05, this.dark, 0, 1.28, -0.05, 'face'); p.rotation.x = -0.2; g.add(p);
      const s2 = box(1.0, 0.5, 0.02, glow(color, 1.3), 0, 1.285, -0.02, 'led'); s2.rotation.x = -0.2; g.add(s2);
      return { group: g, size: [W, H, D] };
    },
  });
}

/** 구역 바닥 색·이름, 유리 칸막이, 반복 랙(인스턴싱), 컨테인먼트, 움직이는 AMR */
const MAT = new THREE.Matrix4();
export function buildExtras(world, level, kit) {
  kit.initExt();
  const root = world.root;
  for (const z of level.zones || []) {
    const [x0, z0, x1, z1] = z.rect; const w = x1 - x0, d = z1 - z0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: z.color || 0x9fb3c8, roughness: 0.85, metalness: 0.05, transparent: true, opacity: z.opacity ?? 0.55 }));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2); m.receiveShadow = true; m.userData.sys = 'room'; root.add(m);
    const name = z.name ? (z.name[world.lang] ?? z.name.ko) : ''; if (!name) continue;
    const tex = canvasTex(512, 96, (g) => { g.font = '700 50px Pretendard, "Malgun Gothic", sans-serif'; g.fillStyle = 'rgba(13,27,46,.8)'; g.textBaseline = 'middle'; g.fillText(name, 10, 50); });
    const lw = Math.min(w - 0.6, 6); const lab = new THREE.Mesh(new THREE.PlaneGeometry(lw, lw * 96 / 512), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    lab.rotation.x = -Math.PI / 2; lab.position.set(x0 + 0.4 + lw / 2, 0.02, z0 + 0.7); lab.userData.sys = 'room'; root.add(lab);
  }
  // 유리 칸막이 (문 자리는 선분을 나눠서 비워 둔다)
  for (const [x1, z1, x2, z2] of level.walls || []) {
    const len = Math.hypot(x2 - x1, z2 - z1), horiz = Math.abs(z2 - z1) < 0.01, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, hh = 2.5;
    const g1 = box(horiz ? len : 0.12, hh, horiz ? 0.12 : len, kit.glass, cx, hh / 2, cz, 'room'); g1.castShadow = false; root.add(g1);
    root.add(box(horiz ? len : 0.16, 0.5, horiz ? 0.16 : len, kit.grey, cx, 0.25, cz, 'room')); root.add(box(horiz ? len : 0.16, 0.08, horiz ? 0.16 : len, kit.frame, cx, hh, cz, 'room'));
    world.colliders.push({ minX: Math.min(x1, x2) - 0.08, maxX: Math.max(x1, x2) + 0.08, minZ: Math.min(z1, z2) - 0.08, maxZ: Math.max(z1, z2) + 0.08, y0: 0, y1: hh, noCam: true });
  }
  // 반복 랙: 실제 시설의 수많은 랙을 대표 구역 몇 줄로 줄여 보여 준다(살펴보기 대상 아님). 인스턴싱으로 그린다.
  for (const f of level.fill || []) {
    const W = 0.9, H = 2.1, D = 1.1, n = f.count, ry = THREE.MathUtils.degToRad(f.rot || 0);
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(W, H - 0.1, D), kit.body, n); body.castShadow = true; body.receiveShadow = true; body.userData.sys = 'shell';
    const ft = rackFrontTex(f.variant || 'cpu1u');
    const face = new THREE.InstancedMesh(new THREE.PlaneGeometry(W - 0.1, H - 0.2), new THREE.MeshStandardMaterial({ map: ft, emissiveMap: ft, emissive: 0xffffff, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.55 }), n); face.userData.sys = 'face';
    const isGpu = ['gpu', 'hgx', 'nvl72', 'dlc'].includes(f.variant);
    const led = new THREE.InstancedMesh(new THREE.BoxGeometry(W - 0.1, 0.03, 0.03), isGpu ? glow(0x76b900, 2.2) : kit.ledBlue, n); led.userData.sys = 'led';
    const o = new THREE.Object3D(); const q = Math.round((f.rot || 0) / 90) % 2 !== 0;
    for (let i = 0; i < n; i++) {
      const x = f.x + i * (f.dx || 0), z = f.z + i * (f.dz || 0);
      o.rotation.set(0, ry, 0); o.position.set(x, H / 2 + 0.05, z); o.updateMatrix(); body.setMatrixAt(i, o.matrix);
      o.position.set(x + Math.sin(ry) * (D / 2 + 0.004), H / 2 + 0.05, z + Math.cos(ry) * (D / 2 + 0.004)); o.updateMatrix(); face.setMatrixAt(i, o.matrix);
      o.position.set(x + Math.sin(ry) * (D / 2 + 0.02), H - 0.02, z + Math.cos(ry) * (D / 2 + 0.02)); o.updateMatrix(); led.setMatrixAt(i, o.matrix);
      const hw = (q ? D : W) / 2, hd = (q ? W : D) / 2;
      world.colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, y0: 0, y1: H });
    }
    root.add(body, face, led);
    if (['hgx', 'nvl72', 'dlc'].includes(f.variant)) {
      // 랙 뒤 세로 매니폴드 (공급 파랑, 환수 빨강)
      const geo = new THREE.CylinderGeometry(0.045, 0.045, H - 0.3, 10);
      const ms = new THREE.InstancedMesh(geo, kit.pipeS, n), mr = new THREE.InstancedMesh(geo, kit.pipeR, n); ms.userData.sys = mr.userData.sys = 'pipe';
      for (let i = 0; i < n; i++) {
        const x = f.x + i * (f.dx || 0), z = f.z + i * (f.dz || 0), c = Math.cos(ry), sn = Math.sin(ry);
        for (const [mesh, lx] of [[ms, -W / 2 + 0.1], [mr, W / 2 - 0.1]]) { const lz = -D / 2 - 0.07; o.rotation.set(0, 0, 0); o.position.set(x + lx * c + lz * sn, H / 2 + 0.05, z - lx * sn + lz * c); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); }
      }
      root.add(ms, mr);
    }
  }
  // 바닥 아래 배관 트렌치: 이중마루 밑으로 지나는 2차 측 배관이 유리 덮개를 통해 보인다
  const trM = M(0x3a4654, { roughness: 0.9, metalness: 0.1 }); const coverM = new THREE.MeshStandardMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false });
  for (const [x0, z0, x1, z1] of level.trenches || []) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, dep = 0.75;
    const bot = new THREE.Mesh(new THREE.PlaneGeometry(w, d), trM); bot.rotation.x = -Math.PI / 2; bot.position.set(cx, -dep, cz); bot.userData.sys = 'room'; root.add(bot);
    for (const [bw, bd, bx, bz] of [[w, 0.04, cx, z0], [w, 0.04, cx, z1], [0.04, d, x0, cz], [0.04, d, x1, cz]]) { const s2 = box(bw, dep, bd, trM, bx, -dep / 2, bz, 'room'); s2.castShadow = false; root.add(s2); }
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(w, d), coverM); cover.rotation.x = -Math.PI / 2; cover.position.set(cx, 0.004, cz); cover.userData.sys = 'room'; root.add(cover);
    for (let x = x0 + 0.6; x < x1 - 0.1; x += 0.6) { const l = box(0.025, 0.012, d, kit.frame, x, 0.008, cz, 'room'); l.castShadow = false; root.add(l); }
  }
  // 바닥 아래 주배관에서 랙 매니폴드로 올라가는 수직관
  if (level.risers && level.risers.length) {
    const geo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8);
    for (const ret of [false, true]) {
      const list = level.risers.filter((r) => !!r.ret === ret); if (!list.length) continue;
      const im = new THREE.InstancedMesh(geo, ret ? kit.pipeR : kit.pipeS, list.length); im.userData.sys = 'pipe';
      list.forEach((r, i) => { MAT.makeTranslation(r.x, -0.05, r.z); im.setMatrixAt(i, MAT); }); root.add(im);
    }
  }
  // 컨테인먼트(통로 밀폐): 반투명 지붕과 끝 문
  for (const c of level.contain || []) {
    const [x0, z0, x1, z1] = c.rect;
    const roof = box(x1 - x0, 0.05, z1 - z0, new THREE.MeshStandardMaterial({ color: c.hot ? 0xffb199 : 0x9fd8ff, transparent: true, opacity: 0.3, depthWrite: false }), (x0 + x1) / 2, 2.24, (z0 + z1) / 2, 'room'); roof.castShadow = false; root.add(roof);
  }
  // AMR (자율주행 물류 로봇): 정해진 길을 돈다
  for (const a of level.amrs || []) {
    const made = kit.amr(); root.add(made.group);
    const curve = new THREE.CatmullRomCurve3(a.pts.map((p) => new THREE.Vector3(p[0], 0, p[1])), true, 'catmullrom', 0.2);
    world.movers.push({ obj: made.group, curve, u: a.u || 0, speed: (a.speed || 1.4) / curve.getLength() });
  }
  world.fans = kit.fans;
}
