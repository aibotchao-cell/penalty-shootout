import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Procedural voxel texture atlas (canvas-generated, no external assets).
// A 8x12 grid of 48x48 tiles = 384x576 atlas（解析度 ×3，細節更清楚）
// 32 格：前 12 格是舊的工廠材質（保留相容），後 20 格是各主題（森林／沙漠／雪地／火山／遺跡／太空／神殿／洞窟）
// 加開到 64 格：教室／羽球館／足球場／魔法村／夜市 的專屬材質（依 AlbertC 提供的參考照片）
// 再開到 96 格：學校大門（紅磚校舍／鐘塔／白雨遮／橘色護欄／綠籬，依 AlbertC 提供的照片）
// ---------------------------------------------------------------------------

export const TILE_PX = 48;   // 3 倍解析度（原本 16）
const COLS = 8;
const ROWS = 12;
const ATLAS_W = COLS * TILE_PX;
const ATLAS_H = ROWS * TILE_PX;

export const T = {
  concreteFloor: 0,
  concreteWall: 1,
  rustyMetal: 2,
  darkMetal: 3,
  crate: 4,
  hazard: 5,
  dirt: 6,
  grate: 7,
  brick: 8,
  greenMetal: 9,
  barrel: 10,
  ceiling: 11,
  // ---- 主題材質 ----
  grassTop: 12,
  grassSide: 13,
  sand: 14,
  sandstone: 15,
  snow: 16,
  ice: 17,
  stone: 18,
  cobble: 19,
  mossy: 20,
  logSide: 21,
  logTop: 22,
  planks: 23,
  leaves: 24,
  basalt: 25,
  lava: 26,
  obsidian: 27,
  marble: 28,
  gold: 29,
  neonPink: 30,
  neonCyan: 31,
  // ---- 教室 ----
  deskTop: 32,
  deskSide: 33,
  chairBlue: 34,
  boardGreen: 35,
  wallPanelBlue: 36,
  ceilingWhite: 37,
  floorGray: 38,
  // ---- 羽球館 ----
  courtGreen: 39,
  courtLine: 40,
  trussDark: 41,
  bannerWhite: 42,
  courtWall: 43,
  // ---- 城市足球場 ----
  pitchGreen: 44,
  bleacherWhite: 45,
  bleacherBlue: 46,
  buildingFacade: 47,
  canopyWhite: 48,
  // ---- 魔法村（城堡） ----
  snowRoof: 49,
  shingleRoof: 50,
  chimneyBrick: 51,
  shopWindow: 52,
  cobbleStreet: 53,
  plazaTile: 54,
  woodDoor: 55,
  // ---- 夜市 ----
  asphalt: 56,
  awningRed: 57,
  awningBlue: 58,
  lanternRed: 59,
  neonPurple: 60,
  neonGreen: 61,
  stallWood: 62,
  whiteBoard: 63,
  // ---- 學校大門 ----
  brickRed: 64,
  schoolWindow: 65,
  barrierOrange: 66,
  ledSign: 67,
  hedgeGreen: 68,
  // ---- LS 特輯（足球場）----
  chainFence: 69,
  goalNet: 70,
  goalPost: 71,
  pitchLine: 72,
};

// deterministic RNG so the atlas looks identical every run
let _seed = 987654321;
function rnd() { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }

const c255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const css = (c) => `rgb(${c255(c[0])},${c255(c[1])},${c255(c[2])})`;
const sh = (c, d) => [c[0] + d, c[1] + d, c[2] + d];

function noise(ctx, s, base, spread, density) {
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, s, s);
  const n = Math.floor(s * s * density);
  for (let i = 0; i < n; i++) {
    const x = (rnd() * s) | 0;
    const y = (rnd() * s) | 0;
    const d = Math.round((rnd() - 0.5) * spread * 2);
    ctx.fillStyle = css(sh(base, d));
    ctx.fillRect(x, y, 1, 1);
  }
}

const painters = [];
painters[T.concreteFloor] = (ctx, s) => {
  noise(ctx, s, [120, 118, 112], 26, 0.55);
  ctx.fillStyle = css([88, 86, 82]);
  ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, s - 1, s, 1);
  ctx.fillRect(0, 0, 1, s); ctx.fillRect(s - 1, 0, 1, s);
};
painters[T.concreteWall] = (ctx, s) => {
  noise(ctx, s, [142, 140, 132], 22, 0.45);
  ctx.fillStyle = css([104, 102, 96]);
  ctx.fillRect(0, 8, s, 1);
  for (let x = 0; x < s; x += 8) ctx.fillRect(x, 0, 1, s);
};
painters[T.rustyMetal] = (ctx, s) => {
  noise(ctx, s, [112, 74, 48], 24, 0.5);
  for (let i = 0; i < 28; i++) {
    const x = (rnd() * s) | 0, y = (rnd() * s) | 0, r = 1 + ((rnd() * 2) | 0);
    ctx.fillStyle = css([150 + ((rnd() * 45) | 0), 78 + ((rnd() * 34) | 0), 30]);
    ctx.fillRect(x, y, r, r);
  }
};
painters[T.darkMetal] = (ctx, s) => {
  noise(ctx, s, [60, 64, 70], 16, 0.4);
  ctx.fillStyle = css([116, 120, 126]);
  ctx.fillRect(2, 2, 2, 2); ctx.fillRect(s - 4, 2, 2, 2);
  ctx.fillRect(2, s - 4, 2, 2); ctx.fillRect(s - 4, s - 4, 2, 2);
};
painters[T.crate] = (ctx, s) => {
  noise(ctx, s, [140, 96, 52], 18, 0.35);
  ctx.fillStyle = css([96, 62, 30]);
  ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, s - 1, s, 1);
  ctx.fillRect(0, 5, s, 1); ctx.fillRect(0, 11, s, 1);
  ctx.fillRect(0, 0, 1, s); ctx.fillRect(s - 1, 0, 1, s);
  ctx.fillRect(7, 0, 1, s);
};
painters[T.hazard] = (ctx, s) => {
  ctx.fillStyle = css([222, 178, 42]);
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([38, 36, 34]);
  for (let i = -s; i < s * 2; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + 4, 0);
    ctx.lineTo(i + 4 - s, s); ctx.lineTo(i - s, s);
    ctx.closePath(); ctx.fill();
  }
};
painters[T.dirt] = (ctx, s) => {
  noise(ctx, s, [96, 78, 54], 22, 0.6);
  ctx.fillStyle = css([64, 50, 34]);
  for (let i = 0; i < 12; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
};
painters[T.grate] = (ctx, s) => {
  ctx.fillStyle = css([40, 42, 46]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([96, 100, 106]);
  for (let i = 1; i < s; i += 4) ctx.fillRect(i, 0, 1, s);
  for (let i = 1; i < s; i += 4) ctx.fillRect(0, i, s, 1);
};
painters[T.brick] = (ctx, s) => {
  ctx.fillStyle = css([78, 62, 54]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([142, 74, 58]);
  const bh = 4;
  for (let row = 0; row < s / bh; row++) {
    const off = row % 2 ? 4 : 0;
    for (let x = -8 + off; x < s; x += 8) ctx.fillRect(x + 1, row * bh + 1, 6, bh - 1);
  }
};
painters[T.greenMetal] = (ctx, s) => {
  noise(ctx, s, [58, 96, 76], 18, 0.4);
  ctx.fillStyle = css([110, 150, 128]);
  for (let i = 0; i < 5; i++) {
    const x = (rnd() * s) | 0, y = (rnd() * s) | 0;
    ctx.fillRect(x, y, 1, 2 + ((rnd() * 4) | 0));
  }
  ctx.fillStyle = css([34, 58, 46]);
  ctx.fillRect(2, 2, 2, 2); ctx.fillRect(s - 4, s - 4, 2, 2);
};
painters[T.barrel] = (ctx, s) => {
  noise(ctx, s, [120, 70, 40], 20, 0.45);
  ctx.fillStyle = css([70, 46, 30]);
  ctx.fillRect(0, 3, s, 2); ctx.fillRect(0, s - 5, s, 2);
  ctx.fillStyle = css([160, 96, 40]);
  ctx.fillRect(0, 7, s, 1);
};
painters[T.ceiling] = (ctx, s) => {
  noise(ctx, s, [86, 84, 82], 18, 0.5);
  ctx.fillStyle = css([58, 56, 54]);
  ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, 0, 1, s);
  ctx.fillRect(0, 8, s, 1); ctx.fillRect(8, 0, 1, s);
};

// ---------------------------- 主題材質 ---------------------------------------
painters[T.grassTop] = (ctx, s) => {
  noise(ctx, s, [92, 148, 62], 26, 0.75);
  ctx.fillStyle = css([120, 176, 78]);
  for (let i = 0; i < 22; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 1, 1 + ((rnd() * 2) | 0));
  ctx.fillStyle = css([64, 108, 44]);
  for (let i = 0; i < 14; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 1, 1);
};
painters[T.grassSide] = (ctx, s) => {
  noise(ctx, s, [104, 82, 56], 20, 0.55);
  ctx.fillStyle = css([92, 148, 62]);
  ctx.fillRect(0, 0, s, 3);
  for (let x = 0; x < s; x++) {
    const h = 3 + ((rnd() * 3) | 0);
    ctx.fillStyle = css([88 + ((rnd() * 26) | 0), 140 + ((rnd() * 24) | 0), 58]);
    ctx.fillRect(x, 0, 1, h);
  }
};
painters[T.sand] = (ctx, s) => {
  noise(ctx, s, [224, 208, 152], 18, 0.7);
  ctx.fillStyle = css([196, 178, 124]);
  for (let i = 0; i < 16; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
};
painters[T.sandstone] = (ctx, s) => {
  noise(ctx, s, [216, 196, 142], 14, 0.4);
  ctx.fillStyle = css([182, 158, 108]);
  for (const y of [4, 9, 14]) ctx.fillRect(0, y, s, 1);
  ctx.fillStyle = css([236, 220, 172]);
  ctx.fillRect(0, 0, s, 1);
};
painters[T.snow] = (ctx, s) => {
  noise(ctx, s, [238, 244, 250], 12, 0.5);
  ctx.fillStyle = css([210, 226, 240]);
  for (let i = 0; i < 18; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 1, 1);
};
painters[T.ice] = (ctx, s) => {
  noise(ctx, s, [152, 206, 238], 16, 0.35);
  ctx.fillStyle = css([206, 238, 252]);
  for (let i = 0; i < 6; i++) {
    const x = (rnd() * s) | 0, y = (rnd() * s) | 0, l = 4 + ((rnd() * 7) | 0);
    ctx.fillRect(x, y, l, 1);
  }
  ctx.fillStyle = css([118, 174, 214]);
  ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, s - 1, s, 1);
};
painters[T.stone] = (ctx, s) => {
  noise(ctx, s, [132, 132, 136], 20, 0.6);
  ctx.fillStyle = css([104, 104, 110]);
  for (let i = 0; i < 8; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2 + ((rnd() * 3) | 0), 2);
};
painters[T.cobble] = (ctx, s) => {
  ctx.fillStyle = css([92, 92, 96]);
  ctx.fillRect(0, 0, s, s);                        // 石縫
  for (let gy = 0; gy < 4; gy++)
    for (let gx = 0; gx < 4; gx++) {
      const w = 3 + ((rnd() * 2) | 0), h = 3 + ((rnd() * 2) | 0);
      const v = 132 + ((rnd() * 26) | 0);          // 灰階（三通道一起變，才不會花花的）
      ctx.fillStyle = css([v, v, v + 2]);
      ctx.fillRect(gx * 4 + 1, gy * 4 + 1, w, h);
    }
  noise(ctx, s, [140, 140, 144], 10, 0.18);
};
painters[T.mossy] = (ctx, s) => {
  painters[T.cobble](ctx, s);
  ctx.fillStyle = css([76, 122, 62]);
  for (let i = 0; i < 26; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 1 + ((rnd() * 2) | 0), 1);
};
painters[T.logSide] = (ctx, s) => {
  noise(ctx, s, [122, 88, 52], 16, 0.35);
  ctx.fillStyle = css([86, 60, 34]);
  for (const x of [2, 6, 10, 14]) ctx.fillRect(x, 0, 1, s);
  ctx.fillStyle = css([146, 108, 66]);
  for (const x of [4, 8, 12]) ctx.fillRect(x, 0, 1, s);
};
painters[T.logTop] = (ctx, s) => {
  noise(ctx, s, [150, 112, 68], 14, 0.3);
  ctx.strokeStyle = css([100, 70, 42]);
  ctx.lineWidth = 1;
  const c = s / 2;
  for (let rad = 2; rad < s / 2; rad += 3) {
    ctx.beginPath();
    ctx.arc(c, c, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
};
painters[T.planks] = (ctx, s) => {
  noise(ctx, s, [156, 116, 70], 14, 0.3);
  ctx.fillStyle = css([104, 74, 42]);
  for (const y of [0, 5, 10, 15]) ctx.fillRect(0, y, s, 1);
  ctx.fillStyle = css([84, 58, 32]);
  for (const [x, y] of [[3, 3], [11, 3], [7, 8], [14, 8], [5, 13], [12, 13]]) ctx.fillRect(x, y, 1, 1);
};
painters[T.leaves] = (ctx, s) => {
  noise(ctx, s, [58, 106, 46], 30, 0.8);
  ctx.fillStyle = css([38, 78, 32]);
  for (let i = 0; i < 22; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 1, 1);
  ctx.fillStyle = css([92, 150, 64]);
  for (let i = 0; i < 16; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 1, 1);
};
painters[T.basalt] = (ctx, s) => {
  noise(ctx, s, [64, 58, 62], 16, 0.5);
  ctx.fillStyle = css([34, 30, 34]);
  for (const x of [3, 7, 11, 15]) ctx.fillRect(x, (rnd() * 4) | 0, 1, s);
};
painters[T.lava] = (ctx, s) => {
  noise(ctx, s, [232, 112, 24], 34, 0.7);
  ctx.fillStyle = css([255, 226, 120]);
  for (let i = 0; i < 20; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
  ctx.fillStyle = css([120, 30, 8]);
  for (let i = 0; i < 10; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
};
painters[T.obsidian] = (ctx, s) => {
  noise(ctx, s, [32, 26, 46], 14, 0.6);
  ctx.fillStyle = css([96, 70, 140]);
  for (let i = 0; i < 6; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
};
painters[T.marble] = (ctx, s) => {
  noise(ctx, s, [226, 222, 214], 10, 0.4);
  ctx.strokeStyle = css([176, 172, 168]);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    const y0 = (rnd() * s) | 0;
    ctx.moveTo(0, y0);
    ctx.lineTo(s, y0 + (-3 + ((rnd() * 7) | 0)));
    ctx.stroke();
  }
};
painters[T.gold] = (ctx, s) => {
  noise(ctx, s, [226, 182, 60], 16, 0.45);
  ctx.fillStyle = css([255, 238, 150]);
  for (let i = 0; i < 10; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 2);
  ctx.fillStyle = css([166, 118, 24]);
  ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, s - 1, s, 1);
  ctx.fillRect(0, 0, 1, s); ctx.fillRect(s - 1, 0, 1, s);
};
painters[T.neonPink] = (ctx, s) => {
  noise(ctx, s, [44, 40, 56], 12, 0.4);
  ctx.fillStyle = css([255, 78, 178]);
  ctx.fillRect(0, 5, s, 2);
  ctx.fillStyle = css([255, 176, 226]);
  ctx.fillRect(0, 5, s, 1);
  ctx.fillStyle = css([120, 30, 84]);
  ctx.fillRect(0, 7, s, 1);
};
painters[T.neonCyan] = (ctx, s) => {
  noise(ctx, s, [38, 44, 52], 12, 0.4);
  ctx.fillStyle = css([70, 232, 244]);
  ctx.fillRect(0, 5, s, 2);
  ctx.fillStyle = css([186, 250, 255]);
  ctx.fillRect(0, 5, s, 1);
  ctx.fillStyle = css([26, 96, 108]);
  ctx.fillRect(0, 7, s, 1);
};

// ============ 教室（參考：AlbertC 提供的演講廳照片） ============
painters[T.deskTop] = (ctx, s) => {
  noise(ctx, s, [226, 216, 188], 10, 0.35);
  ctx.fillStyle = css([250, 246, 232]);
  ctx.fillRect(0, 0, s, 1);
  ctx.fillStyle = css([186, 174, 148]);
  ctx.fillRect(0, s - 2, s, 2);
};
painters[T.deskSide] = (ctx, s) => {
  noise(ctx, s, [104, 112, 124], 14, 0.4);
  ctx.fillStyle = css([68, 74, 84]);
  ctx.fillRect(0, 0, s, 2);
  ctx.fillRect(0, s - 3, s, 2);
  ctx.fillStyle = css([138, 146, 158]);
  ctx.fillRect(0, 6, s, 1);
};
painters[T.chairBlue] = (ctx, s) => {
  noise(ctx, s, [78, 104, 138], 16, 0.35);
  ctx.fillStyle = css([46, 64, 92]);
  ctx.fillRect(0, 0, s, 2);
  ctx.fillStyle = css([116, 146, 184]);
  ctx.fillRect(0, 13, s, 2);
};
painters[T.boardGreen] = (ctx, s) => {
  ctx.fillStyle = css([38, 70, 56]); ctx.fillRect(0, 0, s, s);
  noise(ctx, s, [38, 70, 56], 12, 0.3);
  ctx.fillStyle = css([196, 208, 200]);
  ctx.fillRect(3, 4, 4, 1); ctx.fillRect(9, 8, 5, 1); ctx.fillRect(5, 11, 3, 1);
  ctx.fillStyle = css([148, 116, 62]);
  ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, s - 1, s, 1);
};
painters[T.wallPanelBlue] = (ctx, s) => {
  noise(ctx, s, [178, 192, 202], 12, 0.3);
  ctx.fillStyle = css([232, 232, 226]);
  ctx.fillRect(0, 10, s, 5);
  ctx.fillStyle = css([198, 168, 92]);
  ctx.fillRect(0, 9, s, 1);
};
painters[T.ceilingWhite] = (ctx, s) => {
  ctx.fillStyle = css([236, 240, 242]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([196, 202, 206]);
  for (let i = 0; i < s; i += 8) { ctx.fillRect(i, 0, 1, s); ctx.fillRect(0, i, s, 1); }
  ctx.fillStyle = css([176, 182, 186]);
  ctx.fillRect(s / 2 - 2, s / 2 - 2, 4, 4);
};
painters[T.floorGray] = (ctx, s) => {
  noise(ctx, s, [152, 158, 162], 10, 0.3);
  ctx.fillStyle = css([124, 130, 136]);
  ctx.fillRect(0, 7, s, 1); ctx.fillRect(7, 0, 1, s);
};

// ============ 羽球館（參考：AlbertC 提供的球館照片） ============
painters[T.courtGreen] = (ctx, s) => {
  noise(ctx, s, [40, 150, 92], 14, 0.35);
  ctx.fillStyle = css([26, 122, 74]);
  for (let i = 0; i < 10; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
};
painters[T.courtLine] = (ctx, s) => {
  noise(ctx, s, [40, 150, 92], 14, 0.35);
  ctx.fillStyle = css([244, 246, 244]);
  ctx.fillRect(6, 0, 4, s);
};
painters[T.trussDark] = (ctx, s) => {
  ctx.fillStyle = css([52, 56, 60]); ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = css([136, 142, 148]);
  ctx.lineWidth = 1;
  for (let i = -s; i < s * 2; i += 6) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
  }
  ctx.fillStyle = css([24, 26, 28]);
  ctx.fillRect(0, 0, s, 2); ctx.fillRect(0, s - 2, s, 2);
};
painters[T.bannerWhite] = (ctx, s) => {
  // 羽球網：白色網面（細格）＋上緣紅帶
  ctx.fillStyle = css([238, 240, 238]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([186, 192, 190]);
  for (let i = 1; i < s; i += 3) { ctx.fillRect(i, 0, 1, s); ctx.fillRect(0, i, s, 1); }
  ctx.fillStyle = css([198, 58, 52]);
  ctx.fillRect(0, 0, s, 2);
  ctx.fillStyle = css([120, 128, 132]);
  ctx.fillRect(0, s - 1, s, 1);
};
painters[T.courtWall] = (ctx, s) => {
  noise(ctx, s, [58, 68, 82], 12, 0.4);
  ctx.fillStyle = css([92, 104, 122]);
  ctx.fillRect(0, 5, s, 1); ctx.fillRect(0, 11, s, 1);
  ctx.fillStyle = css([30, 36, 46]);
  ctx.fillRect(1, 1, 2, 2); ctx.fillRect(s - 3, 1, 2, 2);
};

// ============ 城市足球場（參考：AlbertC 提供的球場照片） ============
painters[T.pitchGreen] = (ctx, s) => {
  ctx.fillStyle = css([64, 152, 74]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([78, 168, 84]);
  ctx.fillRect(0, 0, s, s / 2);
  noise(ctx, s, [70, 158, 78], 14, 0.35);
};
painters[T.bleacherWhite] = (ctx, s) => {
  noise(ctx, s, [226, 228, 230], 8, 0.25);
  ctx.fillStyle = css([168, 174, 180]);
  for (const y of [3, 7, 11, 15]) ctx.fillRect(0, y, s, 1);
};
painters[T.bleacherBlue] = (ctx, s) => {
  noise(ctx, s, [58, 92, 156], 12, 0.3);
  ctx.fillStyle = css([34, 60, 112]);
  for (const y of [3, 7, 11, 15]) ctx.fillRect(0, y, s, 1);
  noise(ctx, s, [58, 92, 156], 18, 0.25);
};
painters[T.buildingFacade] = (ctx, s) => {
  noise(ctx, s, [196, 190, 180], 10, 0.3);
  ctx.fillStyle = css([92, 116, 140]);
  for (let gy = 1; gy < s - 2; gy += 5)
    for (let gx = 2; gx < s - 2; gx += 5) ctx.fillRect(gx, gy, 3, 3);
  ctx.fillStyle = css([228, 226, 220]);
  ctx.fillRect(0, 0, s, 1);
};
painters[T.canopyWhite] = (ctx, s) => {
  noise(ctx, s, [238, 240, 242], 8, 0.2);
  ctx.fillStyle = css([206, 210, 214]);
  for (let i = 0; i < 5; i++) {
    const x = (rnd() * s) | 0;
    ctx.fillRect(x, 0, 1, s);
  }
};

// ============ 魔法村（參考：AlbertC 提供的魔法村＋城堡照片） ============
painters[T.snowRoof] = (ctx, s) => {
  noise(ctx, s, [248, 251, 254], 6, 0.3);
  ctx.fillStyle = css([255, 255, 255]);
  ctx.fillRect(0, 0, s, 2);
  ctx.fillStyle = css([214, 224, 236]);
  ctx.fillRect(0, s - 3, s, 3);
  ctx.fillStyle = css([178, 192, 208]);
  for (let x = 0; x < s; x += 4) ctx.fillRect(x, s - 1, 2, 1);
};
painters[T.shingleRoof] = (ctx, s) => {
  noise(ctx, s, [96, 100, 112], 12, 0.35);
  ctx.fillStyle = css([62, 66, 78]);
  for (let y = 2; y < s; y += 5)
    for (let x = (y / 5) % 2 ? 0 : 3; x < s; x += 6) ctx.fillRect(x, y, 4, 1);
};
painters[T.chimneyBrick] = (ctx, s) => {
  noise(ctx, s, [126, 88, 74], 16, 0.4);
  ctx.fillStyle = css([74, 50, 42]);
  ctx.fillRect(0, 0, s, 3);
  for (let y = 6; y < s; y += 5) ctx.fillRect(0, y, s, 1);
};
painters[T.shopWindow] = (ctx, s) => {
  noise(ctx, s, [248, 200, 108], 18, 0.3);
  ctx.fillStyle = css([255, 232, 168]);
  ctx.fillRect(2, 3, s - 4, s - 6);
  ctx.fillStyle = css([92, 66, 40]);
  ctx.fillRect(0, 0, s, 2); ctx.fillRect(0, s - 2, s, 2);
  ctx.fillRect(0, 0, 2, s); ctx.fillRect(s - 2, 0, 2, s);
  ctx.fillRect(s / 2 - 1, 2, 2, s - 4);
};
painters[T.cobbleStreet] = (ctx, s) => {
  ctx.fillStyle = css([118, 112, 108]);
  ctx.fillRect(0, 0, s, s);
  for (let gy = 0; gy < 4; gy++)
    for (let gx = 0; gx < 4; gx++) {
      const v = 148 + ((rnd() * 26) | 0);
      ctx.fillStyle = css([v, v - 4, v - 10]);
      ctx.fillRect(gx * 4 + 1, gy * 4 + 1, 3, 3);
    }
  noise(ctx, s, [150, 146, 140], 10, 0.2);
};
painters[T.plazaTile] = (ctx, s) => {
  noise(ctx, s, [196, 192, 184], 10, 0.3);
  ctx.fillStyle = css([164, 160, 152]);
  ctx.fillRect(0, 7, s, 1); ctx.fillRect(7, 0, 1, s);
  ctx.fillStyle = css([216, 212, 204]);
  ctx.fillRect(0, 0, s, 1);
};
painters[T.woodDoor] = (ctx, s) => {
  noise(ctx, s, [110, 74, 46], 14, 0.35);
  ctx.fillStyle = css([78, 52, 32]);
  ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, 0, 1, s); ctx.fillRect(s - 1, 0, 1, s);
  ctx.fillRect(3, 3, s - 6, 1); ctx.fillRect(3, 11, s - 6, 1);
  ctx.fillRect(3, 3, 1, 9); ctx.fillRect(s - 4, 3, 1, 9);
  ctx.fillStyle = css([214, 178, 92]);
  ctx.fillRect(s - 5, 7, 2, 2);
};

// ============ 夜市（參考：AlbertC 提供的夜市照片） ============
painters[T.asphalt] = (ctx, s) => {
  noise(ctx, s, [58, 58, 62], 16, 0.6);
  ctx.fillStyle = css([92, 92, 96]);
  for (let i = 0; i < 14; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 1, 1);
};
painters[T.awningRed] = (ctx, s) => {
  ctx.fillStyle = css([196, 56, 52]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([242, 238, 230]);
  for (let x = 0; x < s; x += 8) ctx.fillRect(x, 0, 4, s);
  ctx.fillStyle = css([140, 32, 30]);
  ctx.fillRect(0, s - 2, s, 2);
};
painters[T.awningBlue] = (ctx, s) => {
  ctx.fillStyle = css([46, 92, 168]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([242, 238, 230]);
  for (let x = 4; x < s; x += 8) ctx.fillRect(x, 0, 4, s);
  ctx.fillStyle = css([26, 58, 116]);
  ctx.fillRect(0, s - 2, s, 2);
};
painters[T.lanternRed] = (ctx, s) => {
  ctx.fillStyle = css([54, 30, 26]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([208, 48, 40]);
  ctx.fillRect(4, 3, 8, 10);
  ctx.fillStyle = css([162, 28, 24]);
  ctx.fillRect(4, 3, 8, 1); ctx.fillRect(4, 12, 8, 1);
  ctx.fillStyle = css([232, 190, 84]);
  ctx.fillRect(7, 0, 2, 3); ctx.fillRect(7, 13, 2, 3);
};
painters[T.neonPurple] = (ctx, s) => {
  noise(ctx, s, [40, 34, 52], 12, 0.4);
  ctx.fillStyle = css([168, 92, 255]);
  ctx.fillRect(0, 6, s, 3);
  ctx.fillStyle = css([214, 176, 255]);
  ctx.fillRect(0, 6, s, 1);
};
painters[T.neonGreen] = (ctx, s) => {
  noise(ctx, s, [32, 44, 40], 12, 0.4);
  ctx.fillStyle = css([92, 240, 140]);
  ctx.fillRect(0, 6, s, 3);
  ctx.fillStyle = css([196, 255, 216]);
  ctx.fillRect(0, 6, s, 1);
};
painters[T.stallWood] = (ctx, s) => {
  noise(ctx, s, [138, 102, 66], 14, 0.35);
  ctx.fillStyle = css([96, 68, 42]);
  ctx.fillRect(0, 4, s, 1); ctx.fillRect(0, 10, s, 1);
  ctx.fillStyle = css([172, 140, 96]);
  ctx.fillRect(0, 0, s, 1);
};
painters[T.whiteBoard] = (ctx, s) => {
  ctx.fillStyle = css([246, 248, 248]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([210, 214, 216]);
  ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, s - 1, s, 1);
  ctx.fillStyle = css([64, 92, 168]);
  ctx.fillRect(3, 3, 6, 1); ctx.fillRect(3, 6, 4, 1);
  ctx.fillStyle = css([196, 62, 56]);
  ctx.fillRect(11, 10, 3, 1);
};

// ============ 學校大門（參考：AlbertC 提供的國小校門口照片） ============
painters[T.brickRed] = (ctx, s) => {
  // 紅磚牆：小塊紅磚 + 淺色磚縫
  ctx.fillStyle = css([196, 186, 172]); ctx.fillRect(0, 0, s, s);
  const bh = 3, bw = 7;
  for (let row = 0; row * bh < s; row++) {
    const off = row % 2 ? 3 : 0;
    for (let x = -bw + off; x < s; x += bw) {
      const r = 158 + ((rnd() * 40) | 0);
      ctx.fillStyle = css([r, 74 + ((rnd() * 22) | 0), 58 + ((rnd() * 18) | 0)]);
      ctx.fillRect(x + 1, row * bh + 1, bw - 1, bh - 1);
    }
  }
  noise(ctx, s, [186, 96, 74], 12, 0.14);
};
painters[T.schoolWindow] = (ctx, s) => {
  // 校舍窗：白框 + 深藍玻璃 + 分隔
  ctx.fillStyle = css([240, 240, 236]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([38, 56, 78]);
  ctx.fillRect(2, 2, s - 4, s - 4);
  ctx.fillStyle = css([96, 130, 168]);
  ctx.fillRect(3, s / 2 - 1, s - 6, 3);
  ctx.fillStyle = css([214, 222, 232]);
  ctx.fillRect(3, 3, s - 6, 2);
  ctx.fillStyle = css([240, 240, 236]);
  ctx.fillRect(s / 2 - 1, 2, 2, s - 4);
};
painters[T.barrierOrange] = (ctx, s) => {
  // 橘白相間的施工護欄（網格狀）
  ctx.fillStyle = css([240, 240, 236]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([232, 118, 26]);
  for (let i = -s; i < s; i += 5) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 3, 0); ctx.lineTo(i + 3 + s, s); ctx.lineTo(i + s, s); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = css([196, 92, 16]);
  for (let y = 3; y < s; y += 5) ctx.fillRect(0, y, s, 1);
  ctx.fillStyle = css([120, 120, 124]);
  ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, s - 1, s, 1);
};
painters[T.ledSign] = (ctx, s) => {
  // 校門口的紅色 LED 跑馬燈
  ctx.fillStyle = css([28, 26, 26]); ctx.fillRect(0, 0, s, s);
  for (let y = 4; y <= 11; y += 3) {
    for (let x = 2; x < s - 1; x += 2) {
      const on = rnd() < 0.72;
      ctx.fillStyle = on ? css([255, 82 + ((rnd() * 60) | 0), 40]) : css([72, 34, 30]);
      ctx.fillRect(x, y, 1, 2);
    }
  }
  ctx.fillStyle = css([70, 68, 66]);
  ctx.fillRect(0, 0, s, 2); ctx.fillRect(0, s - 2, s, 2);
};
painters[T.hedgeGreen] = (ctx, s) => {
  // 修剪過的綠籬
  noise(ctx, s, [46, 96, 44], 22, 0.85);
  ctx.fillStyle = css([30, 66, 30]);
  for (let i = 0; i < 18; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 1, 1);
  ctx.fillStyle = css([92, 146, 70]);
  for (let i = 0; i < 14; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 1, 1);
  ctx.fillStyle = css([24, 52, 26]);
  ctx.fillRect(0, s - 2, s, 2);
};

// ============ LS 特輯：足球場用的材質 ============
painters[T.chainFence] = (ctx, s) => {
  // 鐵網（菱形網目）
  ctx.fillStyle = css([26, 30, 34]); ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = css([152, 160, 168]);
  ctx.lineWidth = 1;
  for (let i = -s; i < s * 2; i += 4) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + s, 0); ctx.lineTo(i, s); ctx.stroke();
  }
  ctx.fillStyle = css([196, 204, 212]);
  ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, s - 1, s, 1);
};
painters[T.goalNet] = (ctx, s) => {
  // 球門網
  ctx.fillStyle = css([232, 236, 240]); ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = css([168, 176, 186]);
  for (let i = 0; i < s; i += 3) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
  }
};
painters[T.goalPost] = (ctx, s) => {
  // 白色球門柱
  ctx.fillStyle = css([242, 244, 246]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([206, 210, 214]);
  ctx.fillRect(0, s - 3, s, 3);
  ctx.fillStyle = css([255, 255, 255]);
  ctx.fillRect(0, 0, s, 2);
};
painters[T.pitchLine] = (ctx, s) => {
  // 草皮上的白線
  ctx.fillStyle = css([70, 158, 78]); ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = css([248, 250, 248]);
  ctx.fillRect(0, 6, s, 4);
};

let _atlas = null;

export function makeAtlas() {
  if (_atlas) return _atlas;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < painters.length; i++) {
    if (!painters[i]) continue;
    const col = i % COLS, row = (i / COLS) | 0;
    ctx.save();
    ctx.translate(col * TILE_PX, row * TILE_PX);
    ctx.beginPath(); ctx.rect(0, 0, TILE_PX, TILE_PX); ctx.clip();
    painters[i](ctx, TILE_PX);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;   // 遠處用 mipmap，避免高解析度貼圖閃爍
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _atlas = tex;
  return tex;
}

// returns [u0, v0, u1, v1] for a tile index (three's v is bottom-up)
export function tileUV(index) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const inset = 0.25 / ATLAS_W;
  const u0 = (col * TILE_PX) / ATLAS_W + inset;
  const u1 = ((col + 1) * TILE_PX) / ATLAS_W - inset;
  const v1 = 1 - (row * TILE_PX) / ATLAS_H - inset;
  const v0 = 1 - ((row + 1) * TILE_PX) / ATLAS_H + inset;
  return [u0, v0, u1, v1];
}
