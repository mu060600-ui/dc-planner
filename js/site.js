// 부지 전체 3D: 울타리 안의 데이터센터 건물, 냉각·발전기 구역, 변전소, 송전선 인입, 도로, 주차, 녹지.
// 면적은 계산 결과(건물·변전소·부지)를 따라 크기가 달라진다. 배치와 모델은 교육용 개념 표현이다(실제 설계·제조사 CAD 아님).
import * as THREE from 'three';
import { Kit, M, box, glow, canvasTex } from './world.js';

const COL = { grass: 0x9dbb8c, ground: 0xc9d1c2, road: 0x59636f, pad: 0xb9bfc6, gravel: 0xa9a59a, wall: 0xeef2f6, blue: 0x1f6fe5, steel: 0x8f9aa8, trGreen: 0x4c6b5f, power: 0xffd23d };

function flat(w, d, color, x, z, y = 0.02, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, ...o }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; return m;
}
function cyl(rt, rb, h, mat, x, y, z, seg = 12) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; }
function label(text, size) {
  const tex = canvasTex(512, 128, (g) => {
    g.font = '700 54px Pretendard, "Malgun Gothic", sans-serif'; const w = Math.min(500, g.measureText(text).width + 44);
    g.fillStyle = 'rgba(15,28,46,.88)'; g.beginPath(); g.roundRect((512 - w) / 2, 18, w, 92, 46); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66, 470);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.scale.set(size * 4, size, 1); s.renderOrder = 10; return s;
}

/** 주변압기: 본체, 방열기, 콘서베이터(기름 탱크), 부싱 */
function transformer(s, mats) {
  const g = new THREE.Group();
  g.add(box(3.2 * s, 2.6 * s, 2.2 * s, mats.tr, 0, 1.5 * s, 0));
  g.add(box(3.8 * s, 0.25 * s, 2.8 * s, mats.dark, 0, 0.12 * s, 0));
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) g.add(box(0.5 * s, 2.0 * s, 0.1 * s, mats.steel, sx * 2.0 * s, 1.4 * s, (-0.9 + i * 0.36) * s));
  const tank = cyl(0.42 * s, 0.42 * s, 2.4 * s, mats.steel, 0, 3.5 * s, -0.5 * s); tank.rotation.z = Math.PI / 2; g.add(tank);
  for (let i = 0; i < 3; i++) { g.add(cyl(0.1 * s, 0.2 * s, 1.5 * s, mats.bush, (-0.9 + i * 0.9) * s, 3.5 * s, 0.5 * s)); g.add(cyl(0.07 * s, 0.07 * s, 0.4 * s, mats.steel, (-0.9 + i * 0.9) * s, 4.4 * s, 0.5 * s)); }
  return g;
}
/** 송전 철탑: 격자 느낌의 뼈대 */
function tower(H, mats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, H * 0.13, H, 4, 6, true), mats.lattice); body.position.y = H / 2; body.rotation.y = Math.PI / 4; g.add(body);
  for (const [y, w] of [[H * 0.98, H * 0.34], [H * 0.82, H * 0.46], [H * 0.66, H * 0.4]]) g.add(box(0.5, 0.5, w, mats.steel, 0, y, 0));
  return g;
}
function sagLine(a, b, sag, mat) {
  const mid = a.clone().lerp(b, 0.5); mid.y -= sag;
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 16, 0.12, 5), mat); return m;
}

/** spec: plan() 결과 + input. 반환: { group, radius, tick(dt, t) } */
export function buildSite(input, r) {
  const g = new THREE.Group(); const kit = new Kit(); kit.initExt();
  const mats = {
    tr: M(COL.trGreen, { metalness: 0.4, roughness: 0.5 }), dark: M(0x2b3545, { metalness: 0.5 }), steel: M(COL.steel, { metalness: 0.7, roughness: 0.35 }), bush: M(0x8a4b2a, { roughness: 0.4 }),
    lattice: new THREE.MeshBasicMaterial({ color: 0x5c6877, wireframe: true }), line: new THREE.MeshBasicMaterial({ color: 0x39424e }),
    wall: M(COL.wall, { roughness: 0.75, metalness: 0.1 }), blue: M(COL.blue, { roughness: 0.4 }), fence: M(0x6f7b89, { metalness: 0.6, roughness: 0.4 }),
  };
  const hv = r.voltage !== '22.9';
  // ---- 부지 크기 (계산한 면적을 그대로 쓴다)
  const D = Math.sqrt(r.siteArea / 1.45), W = D * 1.45, mrg = Math.max(4, W * 0.045);
  const subD = Math.sqrt(r.subArea / 1.3), subW = subD * 1.3;
  const nB = Math.min(4, r.buildings);
  let bd = Math.sqrt(r.bldgArea / nB / 1.5), bw = bd * 1.5;
  const gap = Math.max(5, bw * 0.18);
  const availW = W - 2 * mrg - subW - gap * 2;
  const cols = nB > 2 ? 2 : nB, rowsB = Math.ceil(nB / cols);
  const fit = Math.min(1, availW / (cols * bw + (cols - 1) * gap), (D - 2 * mrg - 16) / (rowsB * (bd + 14)));
  bw *= fit; bd *= fit;
  const bh = THREE.MathUtils.clamp(bw * 0.2, 6, 16);
  const eq = THREE.MathUtils.clamp(bw / 40, 0.75, 2.4);       // 옥외 설비 표시 배율 (큰 부지에서도 보이게)

  // ---- 땅, 도로, 울타리
  const outer = flat(W + 600, D + 600, COL.grass, 0, 0, -0.05); g.add(outer);
  g.add(flat(W, D, COL.ground, 0, 0, 0.0));
  const rw = Math.max(3.5, mrg * 0.55);
  for (const [w, d, x, z] of [[W - mrg, rw, 0, -D / 2 + mrg * 0.75], [W - mrg, rw, 0, D / 2 - mrg * 0.75], [rw, D - mrg, -W / 2 + mrg * 0.75, 0], [rw, D - mrg, W / 2 - mrg * 0.75, 0]]) g.add(flat(w, d, COL.road, x, z, 0.03));
  g.add(flat(rw * 1.4, mrg + 40, COL.road, -W * 0.18, D / 2 + 20 - mrg * 0.4, 0.03));                                   // 진입로
  g.add(flat(W + 600, rw * 1.6, COL.road, 0, D / 2 + 40, 0.03));                                                        // 바깥 도로
  for (const [w, d, x, z] of [[W, 0.3, 0, -D / 2], [W, 0.3, 0, D / 2], [0.3, D, -W / 2, 0], [0.3, D, W / 2, 0]]) { const fh = Math.min(2.2, W * 0.03); const f = box(w, fh, d, mats.fence, x, fh / 2, z); f.castShadow = false; g.add(f); }
  // 정문 경비실, 주차장
  g.add(box(4 * eq, 3 * eq, 3 * eq, mats.wall, -W * 0.18 + rw * 1.4, 1.5 * eq, D / 2 - mrg * 0.2)); g.add(box(4.4 * eq, 0.3 * eq, 3.4 * eq, mats.blue, -W * 0.18 + rw * 1.4, 3.1 * eq, D / 2 - mrg * 0.2));
  const pk = { w: Math.min(W * 0.2, 60), d: Math.min(D * 0.12, 26) };
  g.add(flat(pk.w, pk.d, 0x7c8792, -W / 2 + mrg * 1.4 + pk.w / 2, D / 2 - mrg * 1.4 - pk.d / 2, 0.04));
  for (let i = 1; i < Math.floor(pk.w / 3); i++) g.add(flat(0.15, pk.d * 0.8, 0xffffff, -W / 2 + mrg * 1.4 + i * 3, D / 2 - mrg * 1.4 - pk.d / 2, 0.05));

  // ---- 데이터센터 건물과 옥외 설비
  const labels = [], duct = [], fansY = [];
  const coolers = Math.min(6, Math.max(2, Math.ceil((r.dry + r.chillers) / nB)));
  const x0 = -W / 2 + mrg * 1.5 + bw / 2, zTop = -D / 2 + mrg * 1.6 + 12 * eq + bd / 2;
  const lsize = Math.max(3, W * 0.035);
  for (let i = 0; i < nB; i++) {
    const cx = x0 + (i % cols) * (bw + gap), cz = zTop + Math.floor(i / cols) * (bd + 14 * eq + gap * 0.6);
    g.add(box(bw, bh, bd, mats.wall, cx, bh / 2, cz)); g.add(box(bw + 0.4, bh * 0.08, bd + 0.4, mats.blue, cx, bh * 1.04, cz));
    g.add(box(bw * 0.9, bh * 0.22, 0.2, glow(0x6fd0ff, 0.55), cx, bh * 0.55, cz + bd / 2 + 0.12, 'led'));
    g.add(box(bw * 0.16, bh * 0.45, 0.3, mats.dark, cx - bw * 0.3, bh * 0.23, cz + bd / 2 + 0.16));
    g.add(flat(bw + 4, bd + 4, COL.pad, cx, cz, 0.035));
    // 건물 뒤 냉각 설비 구역
    const yz = cz - bd / 2 - 6 * eq; g.add(flat(bw, 9 * eq, COL.pad, cx, yz, 0.04));
    for (let k = 0; k < coolers; k++) {
      const useDry = k < Math.round(coolers * r.dry / Math.max(1, r.dry + r.chillers));
      const u = useDry ? kit.drycooler() : kit.chiller(); u.group.scale.setScalar(eq * 0.9);
      u.group.position.set(cx - bw / 2 + (k + 0.5) * (bw / coolers), 0, yz); g.add(u.group);
    }
    // 건물에서 냉각 구역으로 가는 배관
    for (const [m, dx] of [[kit.pipeS, -0.5], [kit.pipeR, 0.5]]) { const p = cyl(0.3 * eq, 0.3 * eq, 5 * eq, m, cx + bw * 0.35 + dx * eq, 1.2 * eq, cz - bd / 2 - 2.2 * eq); p.rotation.x = Math.PI / 2; g.add(p); }
    const lb = label(nB > 1 ? `데이터센터 ${i + 1}동` : '데이터센터', lsize); lb.position.set(cx, bh + lsize * 0.9, cz); labels.push(lb);
    duct.push(new THREE.Vector3(cx + bw / 2 + 1, 0.3, cz));
    if (i === 0) { const l2 = label('냉각 설비', lsize * 0.8); l2.position.set(cx, 4 * eq + lsize * 0.7, yz); labels.push(l2); }
  }
  // 비상발전기 구역 (건물 앞쪽)
  if (r.gens > 0) {
    const n = Math.min(5, r.gens), gx = x0 - bw / 2 + 3 * eq, gz = zTop + (rowsB - 1) * (bd + 14 * eq + gap * 0.6) + bd / 2 + 6 * eq;
    g.add(flat(n * 5.2 * eq + 2, 5 * eq, COL.pad, gx + (n - 1) * 2.6 * eq, gz, 0.04));
    for (let k = 0; k < n; k++) { const u = kit.generator(); u.group.scale.setScalar(eq); u.group.position.set(gx + k * 5.2 * eq, 0, gz); g.add(u.group); }
    const lg = label('비상발전기', lsize * 0.8); lg.position.set(gx + (n - 1) * 2.6 * eq, 3 * eq + lsize * 0.7, gz); labels.push(lg);
  }

  // ---- 변전소 (오른쪽 뒤)
  const sx = W / 2 - mrg * 1.5 - subW / 2, sz = -D / 2 + mrg * 1.6 + subD / 2;
  g.add(flat(subW, subD, COL.gravel, sx, sz, 0.04));
  for (const [w, d, x, z] of [[subW, 0.25, sx, sz - subD / 2], [subW, 0.25, sx, sz + subD / 2], [0.25, subD, sx - subW / 2, sz], [0.25, subD, sx + subW / 2, sz]]) { const fh = hv ? 2.6 : 1.6; const f = box(w, fh, d, mats.fence, x, fh / 2, z); f.castShadow = false; g.add(f); }
  const ts = hv ? THREE.MathUtils.clamp(subW / 26, 1.2, 3.2) : THREE.MathUtils.clamp(subW / 22, 0.5, 0.9);
  const nT = Math.min(4, r.transformers);
  const trX = (k) => sx - subW * 0.32 + k * (subW * 0.64 / Math.max(1, nT - 1 || 1));
  const trZ = sz + subD * 0.12;
  for (let k = 0; k < nT; k++) {
    const t = transformer(ts, mats); t.position.set(nT === 1 ? sx : trX(k), 0, trZ); g.add(t);
    if (hv && k < nT - 1) g.add(box(0.4, 5 * ts, 4.5 * ts, mats.wall, (trX(k) + trX(k + 1)) / 2, 2.5 * ts, trZ));       // 방화벽
  }
  if (hv) {
    // GIS 건물, 인입 철구(갠트리), 철탑과 송전선
    const gb = { w: subW * 0.5, d: subD * 0.24, h: 6 * ts * 0.8 };
    g.add(box(gb.w, gb.h, gb.d, mats.wall, sx, gb.h / 2, sz - subD * 0.3)); g.add(box(gb.w + 0.4, gb.h * 0.1, gb.d + 0.4, mats.blue, sx, gb.h * 1.05, sz - subD * 0.3));
    const H = r.voltage === '345' ? 46 : 32, gh = 12 * ts * 0.8, gx2 = sx + subW / 2 - 2.5 * ts, gz2 = sz - subD * 0.3;
    for (const dz of [-gb.d * 0.55, gb.d * 0.55]) g.add(cyl(0.3 * ts, 0.45 * ts, gh, mats.steel, gx2, gh / 2, gz2 + dz));
    g.add(box(0.5 * ts, 0.5 * ts, gb.d * 1.2, mats.steel, gx2, gh, gz2));
    const t1 = tower(H, mats), t2 = tower(H, mats); const tx1 = W / 2 + 30 + H * 0.4, tx2 = W / 2 + 110 + H;
    t1.position.set(tx1, 0, gz2); t2.position.set(tx2, 0, gz2 - 30); g.add(t1, t2);
    for (const [y, off] of [[0.98, 0.15], [0.82, 0.21], [0.66, 0.18]]) for (const s of [-1, 1]) {
      const a = new THREE.Vector3(tx2, H * y, gz2 - 30 + s * H * off), b = new THREE.Vector3(tx1, H * y, gz2 + s * H * off);
      g.add(sagLine(a, b, H * 0.1, mats.line));
      g.add(sagLine(b, new THREE.Vector3(gx2, gh, gz2 + s * gb.d * 0.5 * (off / 0.21)), H * 0.05, mats.line));
    }
    const lt = label('송전선로 인입', lsize * 0.8); lt.position.set(tx1, H + lsize, gz2); labels.push(lt);
  } else {
    // 22.9kV: 배전 전주에서 인입, 수배전반
    const k2 = kit.switchgear(); k2.group.scale.setScalar(ts * 1.6); k2.group.position.set(sx, 0, sz - subD * 0.25); g.add(k2.group);
    for (let i = 0; i < 3; i++) { const px = W / 2 + 6 + i * 22, pz = sz; g.add(cyl(0.18, 0.25, 11, mats.steel, px, 5.5, pz)); g.add(box(0.2, 0.2, 2.4, mats.steel, px, 10.4, pz)); }
    for (let i = 0; i < 2; i++) for (const s of [-1, 0, 1]) g.add(sagLine(new THREE.Vector3(W / 2 + 6 + (i + 1) * 22, 10.5, sz + s), new THREE.Vector3(W / 2 + 6 + i * 22, 10.5, sz + s), 0.6, mats.line));
    for (const s of [-1, 0, 1]) g.add(sagLine(new THREE.Vector3(W / 2 + 6, 10.5, sz + s), new THREE.Vector3(sx + subW * 0.3, 3, sz + s * 0.5), 0.8, mats.line));
  }
  const ls = label(hv ? `변전소 ${r.voltage}kV` : '수전설비 22.9kV', lsize); ls.position.set(sx, (hv ? 9 * ts : 5) + lsize, sz); labels.push(ls);

  // ---- 변전소 → 건물 전력 경로 (땅속 전력구를 지면에 표시) 와 흐르는 입자
  const paths = [];
  const start = new THREE.Vector3(sx - subW / 2 - 1, 0.3, sz + subD * 0.3);
  const ductMat = new THREE.MeshBasicMaterial({ color: COL.power, transparent: true, opacity: 0.55 });
  for (const end of duct) {
    const pts = [start, new THREE.Vector3(start.x - gap * 0.4, 0.3, start.z), new THREE.Vector3(end.x + gap * 0.4, 0.3, end.z), end];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.35 * eq, 6), ductMat));
    const n = Math.max(6, Math.round(curve.getLength() / (6 * eq)));
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.75 * eq, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1a8 }), n); g.add(inst);
    paths.push({ curve, inst, n, speed: 14 * eq / curve.getLength() });
  }

  // ---- 나무 (울타리 안쪽 둘레)
  const step = Math.max(7, (W + D) / 45); const pos = [];
  for (let x = -W / 2 + 2; x <= W / 2 - 2; x += step) pos.push([x, -D / 2 + 1.6], [x, D / 2 - 1.6]);
  for (let z = -D / 2 + 2 + step; z <= D / 2 - 2 - step; z += step) pos.push([-W / 2 + 1.6, z]);
  const tsz = THREE.MathUtils.clamp(W / 110, 0.45, 2.2);   // 나무 크기는 부지 크기에 맞춘다
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5 * tsz, 4.2 * tsz, 7), M(0x4f8a5b, { roughness: 0.9, metalness: 0 }), pos.length); crown.castShadow = true;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22 * tsz, 0.28 * tsz, 1.4 * tsz, 6), M(0x7a5a3c, { roughness: 0.9, metalness: 0 }), pos.length);
  const o = new THREE.Object3D();
  pos.forEach(([x, z], i) => { if (Math.abs(x - (-W * 0.18)) < rw * 1.6 && z > 0) { o.scale.setScalar(0.001); } else o.scale.setScalar(0.85 + (i * 37 % 10) / 30); o.position.set(x, 3.3 * tsz * o.scale.y, z); o.updateMatrix(); crown.setMatrixAt(i, o.matrix); o.position.y = 0.7 * tsz; o.updateMatrix(); trunk.setMatrixAt(i, o.matrix); });
  g.add(crown, trunk);
  const le = label('정문', lsize * 0.7); le.position.set(-W * 0.18, 4 * eq + lsize * 0.6, D / 2 + 2); labels.push(le);
  for (const l of labels) g.add(l);

  const P = new THREE.Vector3(), MAT = new THREE.Matrix4();
  return {
    group: g, radius: Math.hypot(W, D) / 2, W, D,
    tick(dt, t) {
      for (const p of paths) { for (let i = 0; i < p.n; i++) { p.curve.getPointAt(((t * p.speed + i / p.n) % 1 + 1) % 1, P); MAT.makeTranslation(P.x, P.y, P.z); p.inst.setMatrixAt(i, MAT); } p.inst.instanceMatrix.needsUpdate = true; }
      for (const f of kit.fans) f.rotation.y += dt * 5;
    },
    dispose() { g.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); },
  };
}
