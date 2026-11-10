import * as THREE from 'three';
import { T, makeAtlas, tileUV } from './textures.js';

// ---------------------------------------------------------------------------
// LS 特輯：五人制足球場
//   綠茵球場 + 白線 + 兩端球門（網）+ 四周只有鐵網圍住
// ---------------------------------------------------------------------------

export const SX = 52, SY = 12, SZ = 36;

// 球場範圍（草地）
const X0 = 4, X1 = SX - 5;      // 左右邊線
const Z0 = 4, Z1 = SZ - 5;      // 上下邊線
const WALL_H = 5;               // 鐵網高度
const FENCE_OUT = 2;            // 鐵網離邊線幾格

export const B = {
  AIR: 0,
  GRASS: 1,     // 草皮
  LINE: 2,      // 白線
  FENCE: 3,     // 鐵網
  POST: 4,      // 球門柱／橫樑
  NET: 5,       // 球門網
  OUT: 6,       // 場外地面
  STRIPE: 7,    // 草皮深色條紋
};

const TILE = {
  [B.GRASS]: { top: T.pitchGreen, side: T.pitchGreen, bottom: T.pitchGreen },
  [B.STRIPE]: { top: T.courtGreen, side: T.courtGreen, bottom: T.courtGreen },
  [B.LINE]: { top: T.pitchLine, side: T.pitchLine, bottom: T.pitchLine },
  [B.FENCE]: { top: T.chainFence, side: T.chainFence, bottom: T.chainFence },
  [B.POST]: { top: T.goalPost, side: T.goalPost, bottom: T.goalPost },
  [B.NET]: { top: T.goalNet, side: T.goalNet, bottom: T.goalNet },
  [B.OUT]: { top: T.asphalt, side: T.asphalt, bottom: T.asphalt },
};

function tileForFace(id, face) {
  const t = TILE[id];
  if (!t) return 0;
  return face === 'top' ? t.top : face === 'bottom' ? t.bottom : t.side;
}

export class World {
  constructor() {
    this.blocks = new Uint8Array(SX * SY * SZ);
  }
  idx(x, y, z) { return (y * SZ + z) * SX + x; }
  inBounds(x, y, z) { return x >= 0 && x < SX && y >= 0 && y < SY && z >= 0 && z < SZ; }
  get(x, y, z) {
    x |= 0; y |= 0; z |= 0;
    return this.inBounds(x, y, z) ? this.blocks[this.idx(x, y, z)] : 0;
  }
  set(x, y, z, v) {
    x |= 0; y |= 0; z |= 0;
    if (typeof v !== 'number' || !isFinite(v)) return;
    if (this.inBounds(x, y, z)) this.blocks[this.idx(x, y, z)] = v;
  }
  isSolid(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return true;
    if (y >= SY) return false;
    if (x < 0 || x >= SX || z < 0 || z >= SZ) return true;
    return this.blocks[this.idx(x, y, z)] !== 0;
  }
  // 這格能不能站人（地面 + 兩格空間）
  standable(x, z) {
    if (x < 1 || x >= SX - 1 || z < 1 || z >= SZ - 1) return false;
    if (this.get(x, 0, z) === 0) return false;
    return this.get(x, 1, z) === 0 && this.get(x, 2, z) === 0;
  }
  // 球場內的隨機合法位置（給敵人出生用）
  randomSpot(margin = 2) {
    for (let i = 0; i < 400; i++) {
      const x = X0 + Math.floor(Math.random() * (X1 - X0 + 1));
      const z = Z0 + Math.floor(Math.random() * (Z1 - Z0 + 1));
      if (this.standable(x, z)) return { x: x + 0.5, z: z + 0.5 };
    }
    return { x: (X0 + X1) / 2, z: (Z0 + Z1) / 2 };
  }
}

// --------------------------- 建球場 ---------------------------------------
function lineSet(w, fn) {
  for (let x = X0; x <= X1; x++)
    for (let z = Z0; z <= Z1; z++) if (fn(x, z)) w.set(x, 0, z, B.LINE);
}

export function buildCourt(w) {
  w.blocks.fill(0);
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const goalHalf = 4;                      // 球門半寬（9 格寬）
  const goalTop = 4;                       // 橫樑高度

  // 場外（柏油）
  for (let x = 0; x < SX; x++)
    for (let z = 0; z < SZ; z++) w.set(x, 0, z, B.OUT);

  // 草皮 + 深淺條紋
  for (let x = X0; x <= X1; x++)
    for (let z = Z0; z <= Z1; z++) w.set(x, 0, z, (Math.floor(x / 4) % 2 === 0) ? B.GRASS : B.STRIPE);

  // 邊線、中線、中圈、禁區、球門區
  const inCircle = (x, z, r) => Math.abs(Math.hypot(x - cx, z - cz) - r) < 0.75;
  lineSet(w, (x, z) => x === X0 || x === X1 || z === Z0 || z === Z1);           // 邊線
  lineSet(w, (x, z) => x === Math.round(cx));                                   // 中線
  lineSet(w, (x, z) => inCircle(x, z, 5));                                      // 中圈
  lineSet(w, (x, z) => (x < X0 + 9 || x > X1 - 9) && (z === Math.round(cz - 7) || z === Math.round(cz + 7)));   // 禁區橫線
  lineSet(w, (x, z) => (x === X0 + 9 || x === X1 - 9) && z >= Math.round(cz - 7) && z <= Math.round(cz + 7));   // 禁區豎線
  lineSet(w, (x, z) => (x === X0 + 3 || x === X1 - 3) && z >= Math.round(cz - 4) && z <= Math.round(cz + 4));   // 球門區
  w.set(Math.round(cx), 0, Math.round(cz), B.LINE);                             // 中點

  // 兩端球門：門柱 + 橫樑 + 網
  for (const gx of [X0 + 1, X1 - 1]) {
    const inward = gx === X0 + 1 ? 1 : -1;
    for (let dz = -goalHalf; dz <= goalHalf; dz++) {
      w.set(gx, 0, Math.round(cz) + dz, B.NET);                                  // 網底
      for (let y = 1; y < goalTop; y++) w.set(gx - inward, y, Math.round(cz) + dz, B.NET);  // 網面
    }
    for (const dz of [-goalHalf, goalHalf]) {
      for (let y = 1; y <= goalTop; y++) w.set(gx, y, Math.round(cz) + dz, B.POST);         // 門柱
    }
    for (let dz = -goalHalf; dz <= goalHalf; dz++) {
      w.set(gx, goalTop, Math.round(cz) + dz, B.POST);                                       // 橫樑
      for (let y = 1; y < goalTop; y++) w.set(gx + inward, y, Math.round(cz) + dz, B.AIR);    // 門內空間
    }
  }

  // 四周鐵網（只有鐵網，沒有看台）
  const fx0 = X0 - FENCE_OUT, fx1 = X1 + FENCE_OUT;
  const fz0 = Z0 - FENCE_OUT, fz1 = Z1 + FENCE_OUT;
  for (let y = 1; y <= WALL_H; y++) {
    for (let x = fx0; x <= fx1; x++) {
      w.set(x, y, fz0, B.FENCE);
      w.set(x, y, fz1, B.FENCE);
    }
    for (let z = fz0; z <= fz1; z++) {
      w.set(fx0, y, z, B.FENCE);
      w.set(fx1, y, z, B.FENCE);
    }
  }
  // 鐵網立柱（每 6 格一根，加粗一格）
  for (let x = fx0; x <= fx1; x += 6) {
    w.set(x, WALL_H + 1, fz0, B.POST); w.set(x, WALL_H + 1, fz1, B.POST);
  }
  for (let z = fz0; z <= fz1; z += 6) {
    w.set(fx0, WALL_H + 1, z, B.POST); w.set(fx1, WALL_H + 1, z, B.POST);
  }

  // 角旗
  for (const [ax, az] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) {
    w.set(ax, 1, az, B.POST); w.set(ax, 2, az, B.POST); w.set(ax, 3, az, B.POST);
  }
  return { x0: X0, x1: X1, z0: Z0, z1: Z1, fence: { x0: fx0, x1: fx1, z0: fz0, z1: fz1 } };
}

// --------------------------- mesher ---------------------------------------
const FACES = [
  { n: 'top',    dir: [0, 1, 0],  u: 0, v: 2, shade: 1.00, corners: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
  { n: 'bottom', dir: [0, -1, 0], u: 0, v: 2, shade: 0.55, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: 'east',   dir: [1, 0, 0],  u: 2, v: 1, shade: 0.78, corners: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] },
  { n: 'west',   dir: [-1, 0, 0], u: 2, v: 1, shade: 0.78, corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: 'south',  dir: [0, 0, 1],  u: 0, v: 1, shade: 0.90, corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: 'north',  dir: [0, 0, -1], u: 0, v: 1, shade: 0.68, corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] },
];
const AO_LEVELS = [0.50, 0.70, 0.86, 1.0];

export function buildMesh(world) {
  const positions = [];
  const uvs = [];
  const colors = [];
  const solid = (x, y, z) => world.isSolid(x, y, z);

  for (let y = 0; y < SY; y++) {
    for (let z = 0; z < SZ; z++) {
      for (let x = 0; x < SX; x++) {
        const id = world.get(x, y, z);
        if (id === B.AIR) continue;
        for (const f of FACES) {
          const nx = x + f.dir[0], ny = y + f.dir[1], nz = z + f.dir[2];
          if (solid(nx, ny, nz)) continue;
          const tile = tileForFace(id, f.n);
          const [u0, v0, u1, v1] = tileUV(tile);
          const uvc = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
          const U = f.u, V = f.v;
          const verts = f.corners.map((c, k) => {
            const su = c[U] === 1 ? 1 : -1;
            const sv = c[V] === 1 ? 1 : -1;
            const o1 = [nx, ny, nz]; o1[U] += su;
            const o2 = [nx, ny, nz]; o2[V] += sv;
            const oc = [nx, ny, nz]; oc[U] += su; oc[V] += sv;
            const s1 = solid(o1[0], o1[1], o1[2]) ? 1 : 0;
            const s2 = solid(o2[0], o2[1], o2[2]) ? 1 : 0;
            const cc = solid(oc[0], oc[1], oc[2]) ? 1 : 0;
            const ao = (s1 && s2) ? 0 : (3 - (s1 + s2 + cc));
            return { p: [x + c[0], y + c[1], z + c[2]], uv: uvc[k], shade: f.shade * AO_LEVELS[ao] };
          });
          const a = verts[0].p, b = verts[1].p, c = verts[2].p;
          const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
          const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const cr = [
            e1[1] * e2[2] - e1[2] * e2[1],
            e1[2] * e2[0] - e1[0] * e2[2],
            e1[0] * e2[1] - e1[1] * e2[0],
          ];
          const dot = cr[0] * f.dir[0] + cr[1] * f.dir[1] + cr[2] * f.dir[2];
          const q = dot < 0 ? [verts[0], verts[3], verts[2], verts[1]] : verts;
          const tri = [q[0], q[1], q[2], q[0], q[2], q[3]];
          for (const vt of tri) {
            positions.push(vt.p[0], vt.p[1], vt.p[2]);
            uvs.push(vt.uv[0], vt.uv[1]);
            colors.push(vt.shade, vt.shade, vt.shade);
          }
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeBoundingSphere();

  const mat = new THREE.MeshBasicMaterial({ map: makeAtlas(), vertexColors: true, fog: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}
