// ---------------------------------------------------------------------------
// LS 點球大戰（獨立遊戲）
//   ● 球員：一開始是梅西，贏一場（進 4 球以上）就解鎖下一位超級巨星
//   ● 拖曳瞄準 → 放開射門（電腦：滑鼠瞄準、點一下射門）
//   ● 守門員「一定會有反應」：往球的方向撲，只有判斷誤差依難度不同
//   ● 5 球決勝，最高分與解鎖進度都存在瀏覽器
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { World, buildCourt, buildMesh } from './world.js';
import { ballTexture, logoTexture } from './logo.js';
import { initAudio, kickSound, goalCheer, saveGroan, diveWhoosh, catchThud, refWhistle } from './sfx.js';
import { VERSION } from './version.js';

const el = (id) => document.getElementById(id);

// --------------------------- 球門幾何 --------------------------------------
const GOAL_X = 5.0;
const GOAL_Z = 18;
const GOAL_Z_MIN = 15.0, GOAL_Z_MAX = 21.0;
const GOAL_Y_MIN = 1.25, GOAL_Y_MAX = 3.75;
const AIM_X = 5.3;
const SPOT = new THREE.Vector3(11.8, 1.34, 18);
const TOTAL_SHOTS = 5;
const WIN_GOALS = 4;            // 進 4 球以上算贏 → 解鎖下一位球員

// --------------------------- 難度 ------------------------------------------
const DIFF = {
  easy: { name: '簡單', icon: '😊', errZ: 2.45, errY: 1.1, reach: 0.74, speed: 2.6,
    desc: '守門員動作比較慢、常常判斷錯，踢角落幾乎都能進' },
  normal: { name: '普通', icon: '⚽', errZ: 1.5, errY: 0.68, reach: 0.82, speed: 3.5,
    desc: '守門員會猜方向，踢角落比較容易進，一直踢中路會被撲' },
  hard: { name: '困難', icon: '😤', errZ: 1.15, errY: 0.52, reach: 0.84, speed: 4.8,
    desc: '守門員反應很快、判斷很準，要踢到很角落才有機會' },
};

// --------------------------- 射門種類（跟著球員）---------------------------
const SHOTS = {
  basic: {
    name: '基本射門', icon: '⚽', extraErr: 0, flight: 0.55, delay: 0, curve: 0, color: 0x9dc0e8,
    desc: '穩定好控制，一開始就會',
  },
  curve: {
    name: '旋球', icon: '🌀', extraErr: 0.30, flight: 0.62, delay: 0, curve: 1.15, color: 0x5ad1ff,
    desc: '球會彎進角落，守門員很難判斷',
  },
  rhythm: {
    name: '節奏變化', icon: '⏱', extraErr: 0.30, flight: 0.55, delay: 0.24, curve: 0, color: 0xffd24a,
    desc: '故意停一下再踢，守門員會先動',
  },
  fake: {
    name: '假動作射門', icon: '🎭', extraErr: 0.42, flight: 0.55, delay: 0.2, curve: 0, color: 0xc77dff,
    desc: '先騙守門員撲一邊，再踢另一邊',
  },
  power: {
    name: '爆射', icon: '💥', extraErr: 0.28, flight: 0.34, delay: 0, curve: 0, color: 0xff5a3c,
    desc: '又快又直，守門員來不及反應',
  },
};

// --------------------------- 超級巨星（用錢買）-----------------------------
const PLAYERS = [
  { id: 'messi', name: '梅西', num: 10, price: 0, shot: 'basic', kit: 0x9dc0e8, kit2: 0xffffff, shorts: 0x15161c, hair: 0x2a1a12, skin: 0xe0a878 },
  { id: 'ronaldo', name: 'C羅', num: 7, price: 500, shot: 'curve', kit: 0xa41d2a, kit2: 0x125c33, shorts: 0x125c33, hair: 0x1a1210, skin: 0xeab98f },
  { id: 'mbappe', name: '姆巴佩', num: 10, price: 900, shot: 'rhythm', kit: 0x1b3f8b, kit2: 0xffffff, shorts: 0x1b3f8b, hair: 0x14100e, skin: 0x8a5a3b },
  { id: 'neymar', name: '內馬爾', num: 10, price: 1400, shot: 'fake', kit: 0xf2d200, kit2: 0x1f7a3a, shorts: 0x1f7a3a, hair: 0x5a3a1a, skin: 0xd9a06a },
  { id: 'haaland', name: '哈蘭德', num: 9, price: 2000, shot: 'power', kit: 0x6cabdd, kit2: 0xffffff, shorts: 0xffffff, hair: 0xd9c27a, skin: 0xf3cda6 },
];

// 賺錢規則：每進一球 +100 元、完成一輪 +50 元、難度加倍（簡單 ×1／普通 ×1.5／困難 ×2）
const COIN_PER_GOAL = 100;
const COIN_FINISH = 50;
const COIN_MULT = { easy: 1, normal: 1.5, hard: 2 };

// --------------------------- 存檔 ------------------------------------------
const SAVE_KEY = 'ls_penalty_save_v1';
const save = { unlocked: ['messi'], current: 'messi', best: 0, coins: 0 };
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) Object.assign(save, JSON.parse(raw));
} catch (e) { /* 忽略 */ }
if (!Array.isArray(save.unlocked) || !save.unlocked.includes('messi')) save.unlocked = ['messi'];
if (!PLAYERS.some((p) => p.id === save.current)) save.current = 'messi';
const oldBest = Number(localStorage.getItem('ls_penalty_best') || 0);
if (oldBest > save.best) save.best = oldBest;

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 忽略 */ }
}

// ------------------------------- 場景 --------------------------------------
const canvas = el('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc4ea);
scene.fog = new THREE.Fog(0xbcd8ee, 40, 130);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 300);
camera.position.set(14.6, 2.15, GOAL_Z);
camera.lookAt(AIM_X, 1.85, GOAL_Z);

scene.add(new THREE.AmbientLight(0xffffff, 1.05));
const sun = new THREE.DirectionalLight(0xfff6e0, 1.0);
sun.position.set(0.3, 1, 0.4);
scene.add(sun);

const world = new World();
buildCourt(world);
scene.add(buildMesh(world));

{
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 11),
    new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true, opacity: 0.95, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(26, 1.03, 18);
  scene.add(m);
}

// ------------------------------- 足球 --------------------------------------
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.34, 24, 18),
  new THREE.MeshLambertMaterial({ map: ballTexture() })
);
ball.position.copy(SPOT);
scene.add(ball);

{
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  dot.rotation.x = -Math.PI / 2;
  dot.position.set(SPOT.x, 1.015, SPOT.z);
  scene.add(dot);
}

// 射門軌跡（彩色球尾，顏色依射門種類）
const TRAIL_N = 10;
const trailGroup = new THREE.Group();
trailGroup.visible = false;
const trailDots = [];
for (let i = 0; i < TRAIL_N; i++) {
  const rad = 0.3 * (1 - i / TRAIL_N) + 0.05;
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(rad, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 * (1 - i / TRAIL_N) + 0.06 })
  );
  trailGroup.add(m);
  trailDots.push(m);
}
scene.add(trailGroup);
let trailQueue = [];

// ---------------------- Minecraft 風像素貼圖 -------------------------------
const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

function pxTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g2 = c.getContext('2d');
  g2.imageSmoothingEnabled = false;
  draw(g2, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;      // ★ 像素感（不做模糊）
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 六面材質：[+x, -x, +y, -y, +z(正面), -z]
function mcMats(frontMap, sideColor, topColor, bottomColor) {
  const f = new THREE.MeshLambertMaterial({ map: frontMap });
  const s = new THREE.MeshLambertMaterial({ color: sideColor });
  const t = new THREE.MeshLambertMaterial({ color: topColor ?? sideColor });
  const b = new THREE.MeshLambertMaterial({ color: bottomColor ?? sideColor });
  return [s, s, t, b, f, s];
}

// 8x8 像素臉（Minecraft 風格）
function mcFace(skin, hair) {
  return pxTexture(8, 8, (g2) => {
    g2.fillStyle = hex(skin); g2.fillRect(0, 0, 8, 8);
    g2.fillStyle = hex(hair); g2.fillRect(0, 0, 8, 2);
    g2.fillStyle = '#f4f4f4'; g2.fillRect(1, 3, 2, 1); g2.fillRect(5, 3, 2, 1);
    g2.fillStyle = '#22314d'; g2.fillRect(2, 3, 1, 1); g2.fillRect(5, 3, 1, 1);
    g2.fillStyle = 'rgba(0,0,0,0.16)'; g2.fillRect(3, 4, 2, 1);
    g2.fillStyle = 'rgba(90,40,30,0.75)'; g2.fillRect(3, 6, 2, 1);
  });
}

// 8x12 球衣（領口＋胸前橫條）
function mcJersey(kit, kit2) {
  return pxTexture(8, 12, (g2) => {
    g2.fillStyle = hex(kit); g2.fillRect(0, 0, 8, 12);
    g2.fillStyle = hex(kit2); g2.fillRect(3, 0, 2, 2);
    g2.fillStyle = hex(kit2); g2.fillRect(0, 4, 8, 2);
    g2.fillStyle = 'rgba(0,0,0,0.12)'; g2.fillRect(0, 11, 8, 1);
  });
}

// 4x12 手（袖子＋皮膚＋守門員手套）
function mcArm(kit, skin, gloves) {
  return pxTexture(4, 12, (g2) => {
    g2.fillStyle = hex(kit); g2.fillRect(0, 0, 4, 4);
    g2.fillStyle = hex(skin); g2.fillRect(0, 4, 4, 8);
    if (gloves) { g2.fillStyle = '#ff8c1a'; g2.fillRect(0, 8, 4, 4); g2.fillStyle = '#e07b12'; g2.fillRect(0, 11, 4, 1); }
  });
}

// 4x12 腿（短褲＋皮膚＋球鞋）
function mcLeg(shorts, skin) {
  return pxTexture(4, 12, (g2) => {
    g2.fillStyle = hex(shorts); g2.fillRect(0, 0, 4, 5);
    g2.fillStyle = hex(skin); g2.fillRect(0, 5, 4, 7);
    g2.fillStyle = '#20202a'; g2.fillRect(0, 10, 4, 2);
  });
}

// ------------------------------ 人物 (Minecraft 方塊風) ---------------------
// 比例照 Minecraft：頭 8、身體 8x12x4、手腳 4x12x4（1 單位 ≈ 0.0563，身高約 1.8）
function makeFigure(o) {
  const g = new THREE.Group();
  const U = 0.0563;

  // 頭 0.45 立方
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(8 * U, 8 * U, 8 * U),
    mcMats(mcFace(o.skin, o.hair), o.skin, o.hair, o.skin)
  );
  head.position.y = (12 + 12 + 4) * U;   // 腿 12 + 身體 12 + 頭一半 4 = 28
  g.add(head);

  // 身體 0.45 x 0.675 x 0.225
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(8 * U, 12 * U, 4 * U),
    mcMats(mcJersey(o.kit, o.kit2), o.kit, o.kit2, o.shorts)
  );
  torso.position.y = 6 * U + 12 * U;   // 腳 12 + 身體一半 6
  g.add(torso);

  for (const sx of [-1, 1]) {
    // 手（肩膀當支點）
    const armPivot = new THREE.Group();
    armPivot.position.set(sx * 6 * U, 24 * U, 0);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(4 * U, 12 * U, 4 * U),
      mcMats(mcArm(o.kit, o.skin, o.gloves), o.kit, o.kit, o.skin)
    );
    arm.position.y = -6 * U;
    armPivot.add(arm);
    armPivot.rotation.z = sx * (o.gloves ? 0.95 : 0.07);   // 守門員張開手
    g.add(armPivot);

    // 腳（髖部當支點）
    const legPivot = new THREE.Group();
    legPivot.position.set(sx * 2 * U, 12 * U, 0);
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(4 * U, 12 * U, 4 * U),
      mcMats(mcLeg(o.shorts, o.skin), o.shorts, o.shorts, o.skin)
    );
    leg.position.y = -6 * U;
    legPivot.add(leg);
    g.add(legPivot);
  }
  return g;
}

// 守門員
// ---------------------- 5 位超級巨星守門員（一輪比一輪強）----------------------
const KEEPERS = [
  { name: '菜鳥阿明', stars: 1, kit: 0x2f74d0, kit2: 0xffd24a, shorts: 0x1b2b46, hair: 0x1b2b46, skin: 0xe0a878, reachMul: 0.80, errMul: 1.28 },
  { name: '街頭阿豪', stars: 2, kit: 0x1f9d55, kit2: 0xffffff, shorts: 0x14532d, hair: 0x2a1a12, skin: 0xd9a06a, reachMul: 0.89, errMul: 1.12 },
  { name: '職業阿傑', stars: 3, kit: 0x8e44ad, kit2: 0xffd24a, shorts: 0x2c0e3a, hair: 0x14100e, skin: 0xeab98f, reachMul: 1.00, errMul: 1.00 },
  { name: '國家隊阿德', stars: 4, kit: 0xc0392b, kit2: 0xffffff, shorts: 0x2a1a12, hair: 0x5a3a1a, skin: 0xf3cda6, reachMul: 1.09, errMul: 0.90 },
  { name: '世界門神阿神', stars: 5, kit: 0xffb300, kit2: 0x141414, shorts: 0x141414, hair: 0x1a1210, skin: 0x8a5a3b, reachMul: 1.18, errMul: 0.80 },
];

const keeper = new THREE.Group();
const KEEPER_HOME = new THREE.Vector3(GOAL_X + 0.62, 1.0, GOAL_Z);
keeper.position.copy(KEEPER_HOME);
keeper.scale.setScalar(1.22);
scene.add(keeper);
let curKeeper = KEEPERS[0];

function setKeeper(idx) {
  curKeeper = KEEPERS[Math.max(0, Math.min(idx, KEEPERS.length - 1))];
  while (keeper.children.length) {
    const c = keeper.children.pop();
    keeper.remove(c);
    c.traverse((n) => {
      if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => m.dispose?.());
      if (n.geometry) n.geometry.dispose?.();
    });
  }
  const fig = makeFigure({
    kit: curKeeper.kit, kit2: curKeeper.kit2, shorts: curKeeper.shorts,
    hair: curKeeper.hair, skin: curKeeper.skin, gloves: true,
  });
  fig.rotation.y = Math.PI / 2;          // 面向鏡頭
  keeper.add(fig);
  keeper.position.copy(KEEPER_HOME);
  keeper.rotation.set(0, 0, 0);
}
setKeeper(0);
const keeperStars = () => '⭐'.repeat(curKeeper.stars);

// ---------------------- 敵隊 5 位射手 --------------------------------------
const RIVALS = [
  { name: '紅隊前鋒', kit: 0xc0392b, hair: 0x1a1210, skin: 0xd9a06a },
  { name: '紅隊隊長', kit: 0xa93226, hair: 0x2a1a12, skin: 0xe0a878 },
  { name: '紅隊快馬', kit: 0xcb4335, hair: 0x14100e, skin: 0x8a5a3b },
  { name: '紅隊重砲', kit: 0x922b21, hair: 0xd9c27a, skin: 0xf3cda6 },
  { name: '紅隊新星', kit: 0xd98880, hair: 0x5a3a1a, skin: 0xd9a06a },
];
const rival = new THREE.Group();
rival.visible = false;
scene.add(rival);
let rivalName = '';

function setRival(idx) {
  while (rival.children.length) {
    const c = rival.children.pop();
    rival.remove(c);
    c.traverse?.((n) => { if (n.material) n.material.dispose?.(); if (n.geometry) n.geometry.dispose?.(); });
  }
  const r = RIVALS[idx % RIVALS.length];
  rivalName = r.name;
  const fig = makeFigure({ kit: r.kit, kit2: 0xffffff, shorts: 0x2a1a12, hair: r.hair, skin: r.skin, gloves: false });
  fig.rotation.y = Math.PI / 2;          // 面向球門／鏡頭（守門員視角看得到他的正面）
  rival.add(fig);
  rival.position.set(11.8, 1.0, 18);
}

// 鏡頭：踢球視角 / 守門員視角（撲救時往旁邊衝、畫面傾斜、手套伸出去）
const CAM_SHOOT = new THREE.Vector3(14.6, 2.15, GOAL_Z);
const CAM_KEEP = new THREE.Vector3(6.6, 2.05, GOAL_Z);
const _camTmp = new THREE.Vector3();
const _lookTmp = new THREE.Vector3();

// 守門員手套（掛在鏡頭前面，撲救時伸出去）
const gloveMat = new THREE.MeshLambertMaterial({ color: 0xff8c1a });
const gloveL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.26), gloveMat);
const gloveR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.26), gloveMat);
const GLOVE_HOME = { l: new THREE.Vector3(-0.78, -0.52, -1.15), r: new THREE.Vector3(0.78, -0.52, -1.15) };
gloveL.position.copy(GLOVE_HOME.l);
gloveR.position.copy(GLOVE_HOME.r);
gloveL.visible = false;
gloveR.visible = false;
gloveL.renderOrder = 8;
gloveR.renderOrder = 8;
camera.add(gloveL);
camera.add(gloveR);
scene.add(camera);

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function updateCamera(dt) {
  if (state.turn === 'their') {
    // 撲救動作進度
    if (state.diveZone >= 0) state.diveAnim = Math.min(1, state.diveAnim + dt * 3.4);
    const k = easeOut(state.diveAnim);
    const dir = state.diveZone === 0 ? -1 : state.diveZone === 2 ? 1 : 0;
    const targetZ = GOAL_Z + dir * 2.7 * k;
    const targetY = CAM_KEEP.y - 0.75 * k;               // 撲出去會掉低
    const targetX = CAM_KEEP.x + 1.1 * k;                // 身體往前撲
    _camTmp.set(targetX, targetY, targetZ);
    camera.position.lerp(_camTmp, Math.min(1, dt * 9));
    _lookTmp.set(11.8, 1.9 - 0.5 * k, GOAL_Z);
    camera.lookAt(_lookTmp);
    // 畫面傾斜（撲出去的方向）
    if (dir) camera.rotateZ(-dir * 0.45 * k);

    // 手套伸出去（小幅度，不要擋住視野）
    gloveL.visible = true;
    gloveR.visible = true;
    gloveL.position.set(GLOVE_HOME.l.x + dir * 0.3 * k, GLOVE_HOME.l.y + 0.16 * k, GLOVE_HOME.l.z - 0.4 * k);
    gloveR.position.set(GLOVE_HOME.r.x + dir * 0.3 * k, GLOVE_HOME.r.y + 0.16 * k, GLOVE_HOME.r.z - 0.4 * k);
  } else {
    gloveL.visible = false;
    gloveR.visible = false;
    camera.position.lerp(CAM_SHOOT, Math.min(1, dt * 5));
    _lookTmp.set(AIM_X, 1.85, GOAL_Z);
    camera.lookAt(_lookTmp);
  }
}

// 玩家只顯示在 HUD（不站在場上擋畫面）
function applyPlayer() {
  const p = PLAYERS.find((x) => x.id === save.current) || PLAYERS[0];
  const sp = SHOTS[p.shot] || SHOTS.basic;
  el('p-player').textContent = `${p.name} ${p.num} · ${sp.icon}${sp.name}`;
}

// ------------------------------ 準心 ---------------------------------------
const AIM_RING_X = GOAL_X + 1.15;
const aimRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.34, 0.055, 8, 22),
  new THREE.MeshBasicMaterial({ color: 0xffe14d, depthTest: false, transparent: true, opacity: 0.95 })
);
aimRing.rotation.y = Math.PI / 2;
aimRing.renderOrder = 5;
aimRing.position.set(AIM_RING_X, 2.2, GOAL_Z);
scene.add(aimRing);
const aimDot = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 10, 8),
  new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })
);
aimDot.renderOrder = 6;
aimDot.position.copy(aimRing.position);
scene.add(aimDot);

// ------------------------------ 狀態 ---------------------------------------
const state = {
  phase: 'ready',            // ready | aim | wind | fly | result | their | done
  diff: 'normal',
  turn: 'our',               // our = 我方踢 / their = 換我當守門員
  round: 1,                  // 第幾輪（每輪各踢一球）
  shot: 1,
  goals: 0,                  // 我方進球
  theirGoals: 0,             // 敵方進球
  aim: new THREE.Vector2(GOAL_Z, 2.2),
  t: 0,
  flight: 0.55,
  windT: 0,
  shotKey: 'basic',
  curveDir: 1,
  outcome: null,
  willSave: false,
  diveErr: 99,
  diveZone: -1,              // 我當守門員時選的撲救方向 0左 1中 2右
  diveAnim: 0,               // 撲救動作進度 0→1
  theirZone: 1,              // 敵方射門落在哪一格
  theirT: 0,
  theirResolved: false,
  kamFrom: new THREE.Vector3(14.6, 2.15, GOAL_Z),
  kamTo: new THREE.Vector3(14.6, 2.15, GOAL_Z),
  ballFrom: new THREE.Vector3(),
  ballTo: new THREE.Vector3(),
  keeperTo: new THREE.Vector3().copy(KEEPER_HOME),
  kickT: 0,
  resultTimer: 0,
};

function updateHud() {
  const d = DIFF[state.diff];
  el('p-shot').textContent = state.phase === 'done' ? '結束' : `第 ${state.round} 輪`;
  el('p-score').textContent = `我方 ${state.goals} : ${state.theirGoals} 敵方`;
  el('p-best').textContent = `最高 ${save.best}`;
  el('p-diff').textContent = `${d.icon} ${d.name}`;
  el('p-coins').textContent = `💰 ${save.coins}`;
}
function msg(text, cls = '') {
  const m = el('p-msg');
  m.textContent = text;
  m.className = cls;
}

// --------------------------- 瞄準 ------------------------------------------
const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), AIM_X);
const ndc = new THREE.Vector2();
const hitPoint = new THREE.Vector3();

function pointerToAim(clientX, clientY) {
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  if (!raycaster.ray.intersectPlane(aimPlane, hitPoint)) return;
  state.aim.x = THREE.MathUtils.clamp(hitPoint.z, GOAL_Z_MIN, GOAL_Z_MAX);
  state.aim.y = THREE.MathUtils.clamp(hitPoint.y, GOAL_Y_MIN, GOAL_Y_MAX);
  aimRing.position.set(AIM_RING_X, state.aim.y, state.aim.x);
  aimDot.position.copy(aimRing.position);
}

let dragging = false;
canvas.addEventListener('pointerdown', (e) => {
  if (state.phase !== 'aim') return;
  initAudio();
  dragging = true;
  pointerToAim(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  if (state.phase !== 'aim') return;
  if (e.pointerType === 'mouse' || dragging) pointerToAim(e.clientX, e.clientY);
});
canvas.addEventListener('pointerup', (e) => {
  if (state.phase !== 'aim' || !dragging) return;
  dragging = false;
  pointerToAim(e.clientX, e.clientY);
  shoot();
});
el('btn-shoot').addEventListener('click', (e) => {
  e.preventDefault();
  if (state.phase === 'aim') shoot();
});

// 當守門員時：選撲救方向
document.querySelectorAll('#p-dive .dbtn2').forEach((b) => {
  b.addEventListener('click', () => {
    if (state.turn !== 'their') return;
    if (state.phase !== 'their' && state.phase !== 'theirFly' && state.phase !== 'theirResult') return;
    state.diveZone = Number(b.dataset.zone);
    state.diveAnim = 0;
    diveWhoosh();
    document.querySelectorAll('#p-dive .dbtn2').forEach((x) => x.classList.toggle('chosen', x === b));
    if (state.phase === 'their') msg('好！撲這裡…', '');
  });
});

// ----------------------- 開始畫面的選項（難度＋球員）------------------------
let startDiff = 'normal';

document.querySelectorAll('#diff-row .dbtn').forEach((b) => {
  b.addEventListener('click', () => {
    startDiff = b.dataset.diff;
    document.querySelectorAll('#diff-row .dbtn').forEach((x) => x.classList.toggle('active', x === b));
    el('diff-desc').textContent = DIFF[startDiff].desc;
  });
});

function renderChars(note = '') {
  const row = el('char-row');
  row.innerHTML = '';
  PLAYERS.forEach((p) => {
    const owned = save.unlocked.includes(p.id);
    const affordable = save.coins >= p.price;
    const b = document.createElement('button');
    b.className = 'cbtn'
      + (owned ? (p.id === save.current ? ' active' : '') : (affordable ? ' buyable' : ' locked'));
    b.innerHTML = owned
      ? `${p.name}<span class="num">${p.num} 號 · ${SHOTS[p.shot].icon}${SHOTS[p.shot].name}</span>`
      : `${p.name}<span class="num">💰 ${p.price}　${SHOTS[p.shot].icon}${SHOTS[p.shot].name}</span>`;
    b.addEventListener('click', () => {
      if (!owned) {
        if (affordable) {
          save.coins -= p.price;
          save.unlocked.push(p.id);
          save.current = p.id;
          persist();
          applyPlayer();
          renderChars(`🎉 買到 ${p.name} 了！剩下的錢：${save.coins} 元`);
        } else {
          el('char-desc').textContent =
            `${p.name} 需要 ${p.price} 元 —— 你還差 ${p.price - save.coins} 元（多踢幾輪賺錢！）`;
        }
        return;
      }
      save.current = p.id;
      persist();
      applyPlayer();
      renderChars();
    });
    row.appendChild(b);
  });
  const cur = PLAYERS.find((x) => x.id === save.current) || PLAYERS[0];
  const curShot = SHOTS[cur.shot] || SHOTS.basic;
  el('char-desc').textContent = note
    || `💰 你有 ${save.coins} 元　·　目前：${cur.name} ${cur.num} 號（${curShot.icon}${curShot.name}：${curShot.desc}）`;
  el('p-coins').textContent = `💰 ${save.coins}`;
}

el('btn-play').addEventListener('click', () => {
  initAudio();
  state.diff = startDiff;
  el('start').classList.add('hidden');
  resetGame();
  goFullScreen();
});
el('btn-again').addEventListener('click', () => {
  el('pover').classList.add('hidden');
  resetGame();
});
el('btn-change-diff').addEventListener('click', () => {
  el('pover').classList.add('hidden');
  renderChars();
  el('start').classList.remove('hidden');
  state.phase = 'ready';
});

// ------------------------------ 射門 ---------------------------------------
function shoot() {
  if (state.phase !== 'aim') return;
  const d = DIFF[state.diff];
  const pl = PLAYERS.find((x) => x.id === save.current) || PLAYERS[0];
  const sp = SHOTS[pl.shot] || SHOTS.basic;
  state.shotKey = pl.shot;

  // 守門員一定會有反應：往球的方向撲（判斷誤差＝難度 × 這位守門員的強度）
  // ★ 踢角落（貼近門柱或上方）時守門員更難搆到 → 更容易進
  const extreme = Math.abs(state.aim.x - GOAL_Z) > 2.2 || state.aim.y > 3.3;
  const extraErr = (extreme ? 0.6 : 0) + sp.extraErr;
  const ez = (Math.random() * 2 - 1) * (d.errZ * curKeeper.errMul + extraErr);
  const ey = (Math.random() * 2 - 1) * (d.errY * curKeeper.errMul + extraErr * 0.5);
  const kbz = THREE.MathUtils.clamp(state.aim.x + ez, GOAL_Z_MIN - 0.4, GOAL_Z_MAX + 0.4);
  const kby = THREE.MathUtils.clamp(state.aim.y + ey, 1.0, 3.6);
  state.diveErr = Math.hypot(ez, ey);
  state.keeperTo.set(KEEPER_HOME.x, Math.max(1.0, kby - 1.35), kbz);
  state.willSave = state.diveErr < d.reach * curKeeper.reachMul * (0.9 + Math.random() * 0.2);

  state.ballFrom.copy(ball.position);
  state.ballTo.set(AIM_X, state.aim.y, state.aim.x);
  state.flight = sp.flight;
  state.curveDir = state.aim.x >= GOAL_Z ? 1 : -1;
  state.t = 0;
  state.windT = sp.delay;
  state.outcome = null;

  for (const d of trailDots) d.material.color.setHex(sp.color);
  trailQueue = [];
  trailGroup.visible = true;

  if (state.windT > 0) {
    state.phase = 'wind';
    if (pl.shot === 'fake') {
      msg('🎭 假動作…', 'shoot');
      const fakeZ = GOAL_Z - (state.aim.x - GOAL_Z) * 0.9;
      aimRing.position.set(AIM_RING_X, state.aim.y, THREE.MathUtils.clamp(fakeZ, GOAL_Z_MIN, GOAL_Z_MAX));
      aimDot.position.copy(aimRing.position);
    } else {
      msg('⏱ 等一下再踢…', 'shoot');
    }
  } else {
    state.phase = 'fly';
    kickSound(1);
    msg(`${sp.icon} ${sp.name}！`, 'shoot');
  }
}

function resolveShot() {
  if (state.willSave) {
    state.outcome = 'save';
    saveGroan();
    el('p-flash').className = 'save';
    msg('🧤 被撲到了！', 'save');
    state.ballFrom.copy(ball.position);
    state.ballTo.set(8.5, 2.4, state.aim.x + (Math.random() - 0.5) * 5);
  } else {
    state.outcome = 'goal';
    state.goals++;
    goalCheer();
    el('p-flash').className = 'goal';
    msg('⚽ 進球！', 'goal');
    state.ballFrom.copy(ball.position);
    state.ballTo.set(GOAL_X + 0.45, Math.max(1.2, state.aim.y - 0.2), state.aim.x);
  }
  state.t = 0;
  state.resultTimer = 0;
  state.phase = 'result';
  updateHud();
  setTimeout(() => { el('p-flash').className = ''; }, 700);
}

// ------------------- 5 對 5：我方踢完 → 換敵方（我當守門員）-------------------
function beginTheirTurn() {
  state.turn = 'their';
  state.phase = 'their';
  state.diveZone = -1;
  state.diveAnim = 0;
  state.theirZone = 1;
  state.theirT = 0;
  state.theirResolved = false;
  state.t = 0;
  keeper.position.copy(KEEPER_HOME);
  state.keeperTo.copy(KEEPER_HOME);
  trailGroup.visible = false;
  trailQueue = [];
  ball.position.copy(SPOT);
  setRival(state.round - 1);
  rival.visible = true;
  el('p-dive').classList.add('show');
  el('btn-shoot').style.display = 'none';
  document.querySelectorAll('#p-dive .dbtn2').forEach((b) => b.classList.remove('chosen'));
  // 敵方要踢哪一格（難度越高越會踢角落）
  const cornerBias = state.diff === 'hard' ? 0.85 : state.diff === 'normal' ? 0.6 : 0.35;
  state.theirZone = Math.random() < cornerBias ? (Math.random() < 0.5 ? 0 : 2) : 1;
  msg('🧤 換你當守門員！選一個方向撲', '');
  refWhistle();
  updateHud();
}

function nextShot() {
  if (state.turn === 'our') { beginTheirTurn(); return; }
  afterTheirTurn();
}

function afterTheirTurn() {
  state.turn = 'our';
  state.diveZone = -1;
  state.diveAnim = 0;
  rival.visible = false;
  el('p-dive').classList.remove('show');
  el('btn-shoot').style.display = '';
  ball.position.copy(SPOT);
  trailGroup.visible = false;
  trailQueue = [];
  keeper.position.copy(KEEPER_HOME);
  keeper.rotation.set(0, 0, 0);
  state.keeperTo.copy(KEEPER_HOME);
  state.aim.set(GOAL_Z, 2.2);
  aimRing.position.set(AIM_RING_X, 2.2, GOAL_Z);
  aimDot.position.copy(aimRing.position);

  if (state.round >= TOTAL_SHOTS) {
    if (state.goals !== state.theirGoals) { finishMatch(); return; }
    state.round++;                 // 平手 → 延長賽
    state.sudden = true;
    msg('⚖️ 平手！延長賽，加油！', '');
  } else {
    state.round++;
  }
  state.phase = 'aim';
  updateHud();
  setKeeper(state.round - 1);
  if (!state.sudden) msg(`第 ${state.round} 輪 · 守門員：${curKeeper.name} ${keeperStars()}`);
  refWhistle();
}

// 敵方射門（球朝我飛過來）
function theirKick() {
  const d = DIFF[state.diff];
  const zoneZ = state.theirZone === 0 ? GOAL_Z - 2.1 : state.theirZone === 2 ? GOAL_Z + 2.1 : GOAL_Z;
  const jitter = (Math.random() - 0.5) * (d.errZ * 0.45);
  state.ballFrom.copy(SPOT);
  state.ballTo.set(6.3, 1.45 + Math.random() * 1.7, zoneZ + jitter);
  state.flight = 0.5;
  state.t = 0;
  state.phase = 'theirFly';
  trailGroup.visible = true;
  trailQueue = [];
  for (const dd of trailDots) dd.material.color.setHex(0xff6b6b);
  kickSound(1);
  msg('⚡ 敵方射門！', 'shoot');
  const dz = state.diveZone === 0 ? GOAL_Z - 2.1 : state.diveZone === 2 ? GOAL_Z + 2.1 : GOAL_Z;
  state.diveErr = Math.abs(dz - state.ballTo.z);
  state.willSave = state.diveZone >= 0 && state.diveErr < 1.25 && Math.random() < 0.92;
}

function resolveTheir() {
  if (state.willSave) {
    state.outcome = 'save';
    catchThud();
    goalCheer();
    el('p-flash').className = 'goal';
    msg('🧤 撲到了！太棒了！', 'goal');
    state.ballFrom.copy(ball.position);
    state.ballTo.set(9.5, 2.4, ball.position.z + (Math.random() - 0.5) * 4);
  } else {
    state.outcome = 'theirGoal';
    state.theirGoals++;
    saveGroan();
    el('p-flash').className = 'save';
    msg('😣 被進球了…', 'save');
    state.ballFrom.copy(ball.position);
    state.ballTo.set(5.5, Math.max(1.3, state.ballTo.y), state.ballTo.z);
  }
  state.t = 0;
  state.resultTimer = 0;
  state.phase = 'theirResult';
  setTimeout(() => { el('p-flash').className = ''; }, 700);
  updateHud();
}

// 比賽結束：算錢 + 顯示結果
function finishMatch() {
  state.phase = 'done';
  const mine = state.goals;
  const theirs = state.theirGoals;
  const win = mine > theirs;
  const draw = mine === theirs;
  const mult = COIN_MULT[state.diff] || 1;
  const goalEarn = Math.round((mine * COIN_PER_GOAL + COIN_FINISH) * mult);
  // 比賽結果：贏 +100、輸 -100、平手不加不減
  const resultBonus = win ? 100 : (draw ? 0 : -100);
  const earned = goalEarn + resultBonus;
  save.coins = Math.max(0, save.coins + earned);
  if (mine > save.best) save.best = mine;
  persist();
  try { localStorage.setItem('ls_penalty_best', String(save.best)); } catch (e) { /* 忽略 */ }
  updateHud();

  const d = DIFF[state.diff];
  const cur = PLAYERS.find((p) => p.id === save.current);
  const title = win ? '🏆 你贏了！' : (draw ? '⚖️ 平手' : '😢 輸了…下次加油！');
  const canBuy = PLAYERS.some((p) => !save.unlocked.includes(p.id) && p.price <= save.coins);
  const nextTarget = PLAYERS.find((p) => !save.unlocked.includes(p.id));
  const resultLine = win ? '<span style="color:#7fe36a">贏球 +100 元</span>'
    : draw ? '<span style="color:#ffe6b8">平手 ±0 元</span>'
      : '<span style="color:#ff8a7a">輸球 -100 元</span>';
  el('pover-title').textContent = title;
  el('pover-score').innerHTML =
    `${cur.name} ${cur.num} 號 · ${d.icon} ${d.name}難度<br>` +
    `我方 <b>${mine}</b> : <b>${theirs}</b> 敵方<br>` +
    `<span class="best">最高紀錄：${save.best} 球</span>` +
    `<br><span class="unlock">💰 進球獎金 ${goalEarn} 元 · ${resultLine}</span>` +
    `<br><span class="unlock">這場 ${earned >= 0 ? '+' : ''}${earned} 元（共 ${save.coins} 元）</span>` +
    (canBuy
      ? '<br><span class="best">🛒 錢夠了！可以去買新的超級巨星</span>'
      : (nextTarget ? `<br><span class="best">再賺 ${nextTarget.price - save.coins} 元就能買 ${nextTarget.name}</span>` : '<br><span class="best">全部球星都買到了 ✨</span>'));
  el('pover').classList.remove('hidden');
}

function resetGame() {
  state.phase = 'aim';
  state.turn = 'our';
  state.round = 1;
  state.sudden = false;
  state.shot = 1;
  state.goals = 0;
  state.theirGoals = 0;
  state.diveZone = -1;
  state.diveAnim = 0;
  state.outcome = null;
  state.t = 0;
  state.kickT = 0;
  ball.position.copy(SPOT);
  trailGroup.visible = false;
  trailQueue = [];
  keeper.position.copy(KEEPER_HOME);
  keeper.rotation.set(0, 0, 0);
  state.keeperTo.copy(KEEPER_HOME);
  state.aim.set(GOAL_Z, 2.2);
  aimRing.position.set(AIM_RING_X, 2.2, GOAL_Z);
  aimDot.position.copy(aimRing.position);
  rival.visible = false;
  el('p-dive').classList.remove('show');
  el('btn-shoot').style.display = '';
  document.querySelectorAll('#p-dive .dbtn2').forEach((b) => b.classList.remove('chosen'));
  camera.position.copy(CAM_SHOOT);
  camera.lookAt(AIM_X, 1.85, GOAL_Z);
  el('pover').classList.add('hidden');
  setKeeper(0);
  updateHud();
  msg(`第 1 輪 · 守門員：${curKeeper.name} ${keeperStars()}　（拖曳瞄準，放開射門）`);
  refWhistle();
}

function goFullScreen() {
  const d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {});
}

// ------------------------------ 更新 ---------------------------------------
const clock = new THREE.Clock();

function updateTrail() {
  if (!trailGroup.visible) return;
  trailQueue.push(ball.position.clone());
  if (trailQueue.length > TRAIL_N) trailQueue.shift();
  const last = trailQueue[trailQueue.length - 1] || ball.position;
  for (let i = 0; i < TRAIL_N; i++) {
    const p = trailQueue[trailQueue.length - 1 - i] || last;
    trailDots[i].position.copy(p);
  }
}

function animateBall(dt) {
  const sp = SHOTS[state.shotKey] || SHOTS.basic;

  if (state.phase === 'their') {
    // 敵方準備射門（約 1.5 秒讓你選撲救方向）
    state.theirT += dt;
    if (state.theirT > 1.5) theirKick();
  } else if (state.phase === 'theirFly') {
    state.t += dt;
    const k = Math.min(1, state.t / state.flight);
    const e = 1 - Math.pow(1 - k, 2);
    ball.position.x = THREE.MathUtils.lerp(state.ballFrom.x, state.ballTo.x, e);
    ball.position.z = THREE.MathUtils.lerp(state.ballFrom.z, state.ballTo.z, e);
    ball.position.y = THREE.MathUtils.lerp(state.ballFrom.y, state.ballTo.y, e) + Math.sin(k * Math.PI) * 0.22;
    ball.rotation.x -= dt * 18;
    if (k >= 1) resolveTheir();
  } else if (state.phase === 'theirResult') {
    state.resultTimer += dt;
    state.t += dt;
    const k = Math.min(1, state.t / 0.4);
    ball.position.x = THREE.MathUtils.lerp(state.ballFrom.x, state.ballTo.x, k);
    ball.position.z = THREE.MathUtils.lerp(state.ballFrom.z, state.ballTo.z, k);
    ball.position.y = THREE.MathUtils.lerp(state.ballFrom.y, state.ballTo.y, k)
      + (state.outcome === 'save' ? Math.sin(k * Math.PI) * 0.7 : -0.2 * k);
    if (state.resultTimer > 1.4) nextShot();
  } else if (state.phase === 'wind') {
    state.windT -= dt;
    if (state.windT <= 0) {
      state.phase = 'fly';
      state.t = 0;
      kickSound(1);
      msg(`${sp.icon} ${sp.name}！`, 'shoot');
      aimRing.position.set(AIM_RING_X, state.aim.y, state.aim.x);
      aimDot.position.copy(aimRing.position);
    }
  } else if (state.phase === 'fly') {
    state.t += dt;
    const k = Math.min(1, state.t / state.flight);
    const e = 1 - Math.pow(1 - k, 2.2);
    const curveOff = sp.curve ? Math.sin(k * Math.PI) * sp.curve * state.curveDir : 0;
    ball.position.x = THREE.MathUtils.lerp(state.ballFrom.x, state.ballTo.x, e);
    ball.position.z = THREE.MathUtils.lerp(state.ballFrom.z, state.ballTo.z, e) + curveOff;
    ball.position.y = THREE.MathUtils.lerp(state.ballFrom.y, state.ballTo.y, e) + Math.sin(k * Math.PI) * 0.35;
    ball.rotation.x -= dt * (sp.flight < 0.4 ? 26 : 14);
    ball.rotation.z -= dt * 6;
    if (curveOff) ball.rotation.y -= dt * 11 * state.curveDir;
    if (k >= 1) resolveShot();
  } else if (state.phase === 'result') {
    state.resultTimer += dt;
    state.t += dt;
    const k = Math.min(1, state.t / 0.35);
    ball.position.x = THREE.MathUtils.lerp(state.ballFrom.x, state.ballTo.x, k);
    ball.position.z = THREE.MathUtils.lerp(state.ballFrom.z, state.ballTo.z, k);
    ball.position.y = THREE.MathUtils.lerp(state.ballFrom.y, state.ballTo.y, k)
      + (state.outcome === 'goal' ? -0.4 * k : Math.sin(k * Math.PI) * 0.9);
    if (state.outcome === 'save') ball.position.y = Math.max(1.1, ball.position.y);
    if (state.resultTimer > 1.5) nextShot();
  }
  updateTrail();
}

function animateKeeper(dt) {
  const d = DIFF[state.diff];
  // 動作前搖（節奏變化／假動作）時守門員也會先撲出去 → 被騙
  const speed = (state.phase === 'fly' || state.phase === 'wind') ? d.speed : 3.0;
  keeper.position.lerp(state.keeperTo, Math.min(1, dt * speed));
  const dz = keeper.position.z - GOAL_Z;
  const lift = Math.max(0, keeper.position.y - 1.0);
  keeper.rotation.x = dz * 0.28 + lift * 0.12;
  keeper.rotation.z = 0;
}

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  animateBall(dt);
  animateKeeper(dt);
  updateCamera(dt);
  if (state.phase === 'aim') {
    aimRing.scale.setScalar(1 + Math.sin(performance.now() / 320) * 0.07);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------ 啟動 ---------------------------------------
el('ver-line').textContent = `v${VERSION}`;
el('diff-desc').textContent = DIFF.normal.desc;
applyPlayer();
renderChars();
updateHud();
frame();

// 除錯／測試用
window.__penalty = { state, ball, keeper, shoot, resetGame, DIFF, PLAYERS, save, persist, renderChars, applyPlayer, TOTAL_SHOTS, SHOTS, KEEPERS, RIVALS, setKeeper };
