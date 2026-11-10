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
import { initAudio, kickSound, goalCheer, saveGroan } from './sfx.js';
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

// --------------------------- 超級巨星 --------------------------------------
const PLAYERS = [
  { id: 'messi', name: '梅西', num: 10, kit: 0x9dc0e8, kit2: 0xffffff, shorts: 0x15161c, hair: 0x2a1a12, skin: 0xe0a878 },
  { id: 'ronaldo', name: 'C羅', num: 7, kit: 0xa41d2a, kit2: 0x125c33, shorts: 0x125c33, hair: 0x1a1210, skin: 0xeab98f },
  { id: 'mbappe', name: '姆巴佩', num: 10, kit: 0x1b3f8b, kit2: 0xffffff, shorts: 0x1b3f8b, hair: 0x14100e, skin: 0x8a5a3b },
  { id: 'neymar', name: '內馬爾', num: 10, kit: 0xf2d200, kit2: 0x1f7a3a, shorts: 0x1f7a3a, hair: 0x5a3a1a, skin: 0xd9a06a },
  { id: 'haaland', name: '哈蘭德', num: 9, kit: 0x6cabdd, kit2: 0xffffff, shorts: 0xffffff, hair: 0xd9c27a, skin: 0xf3cda6 },
];

// --------------------------- 存檔 ------------------------------------------
const SAVE_KEY = 'ls_penalty_save_v1';
const save = { unlocked: ['messi'], current: 'messi', best: 0 };
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

// ------------------------------ 人物 (方塊風) ------------------------------
function makeFigure(o) {
  const g = new THREE.Group();
  const kit = new THREE.MeshLambertMaterial({ color: o.kit });
  const kit2 = new THREE.MeshLambertMaterial({ color: o.kit2 });
  const shorts = new THREE.MeshLambertMaterial({ color: o.shorts });
  const skin = new THREE.MeshLambertMaterial({ color: o.skin });
  const hairM = new THREE.MeshLambertMaterial({ color: o.hair });
  const gloveMat = new THREE.MeshLambertMaterial({ color: 0xff8c1a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.92, 0.44), kit);
  torso.position.y = 1.32; g.add(torso);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.17, 0.46), kit2);
  stripe.position.y = 1.46; g.add(stripe);
  const sh = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.34, 0.46), shorts);
  sh.position.y = 0.8; g.add(sh);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 2.02; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), hairM);
  hair.position.y = 2.2; g.add(hair);
  for (const sx of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.62, 0.28), skin);
    leg.position.set(sx, 0.37, 0); g.add(leg);
    const sock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), kit);
    sock.position.set(sx, 0.13, 0); g.add(sock);
  }
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.74, 0.22), o.gloves ? gloveMat : kit);
    arm.position.set(sx * 0.56, 1.36, 0);
    arm.rotation.z = sx * (o.gloves ? 0.62 : 0.18);
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), o.gloves ? gloveMat : skin);
    hand.position.set(sx * (o.gloves ? 0.83 : 0.66), o.gloves ? 1.08 : 1.02, 0.02);
    g.add(hand);
  }
  return g;
}

// 守門員
const keeperFigure = makeFigure({
  kit: 0x2f74d0, kit2: 0xffd24a, shorts: 0x1b2b46, hair: 0x1b2b46, skin: 0xe0a878, gloves: true,
});
keeperFigure.rotation.y = Math.PI / 2;          // 面向鏡頭
const keeper = new THREE.Group();
keeper.add(keeperFigure);
const KEEPER_HOME = new THREE.Vector3(GOAL_X + 0.62, 1.0, GOAL_Z);
keeper.position.copy(KEEPER_HOME);
keeper.scale.setScalar(1.28);
scene.add(keeper);

// 玩家（踢球的球員）— 一開始是梅西
const KICKER_HOME = new THREE.Vector3(10.6, 1.0, 19.75);
const kicker = new THREE.Group();
kicker.position.copy(KICKER_HOME);
kicker.scale.setScalar(1.12);
scene.add(kicker);

function applyPlayer() {
  while (kicker.children.length) {
    const c = kicker.children.pop();
    kicker.remove(c);
    c.traverse?.((n) => { if (n.material) n.material.dispose?.(); if (n.geometry) n.geometry.dispose?.(); });
  }
  const p = PLAYERS.find((x) => x.id === save.current) || PLAYERS[0];
  const fig = makeFigure({
    kit: p.kit, kit2: p.kit2, shorts: p.shorts, hair: p.hair, skin: p.skin, gloves: false,
  });
  fig.rotation.y = -Math.PI / 2 + 0.35;          // 面向球門（-X）稍微側身
  kicker.add(fig);
  el('p-player').textContent = `${p.name} ${p.num}`;
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
  phase: 'ready',            // ready | aim | fly | result | done
  diff: 'normal',
  shot: 1,
  goals: 0,
  aim: new THREE.Vector2(GOAL_Z, 2.2),
  t: 0,
  flight: 0.55,
  outcome: null,
  willSave: false,
  diveErr: 99,
  ballFrom: new THREE.Vector3(),
  ballTo: new THREE.Vector3(),
  keeperTo: new THREE.Vector3().copy(KEEPER_HOME),
  kickT: 0,
  resultTimer: 0,
};

function updateHud() {
  const d = DIFF[state.diff];
  el('p-shot').textContent = state.phase === 'done' ? '結束' : `第 ${state.shot} / ${TOTAL_SHOTS} 球`;
  el('p-goals').textContent = `進球 ${state.goals}`;
  el('p-best').textContent = `最高 ${save.best}`;
  el('p-diff').textContent = `${d.icon} ${d.name}`;
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
    const locked = !save.unlocked.includes(p.id);
    const b = document.createElement('button');
    b.className = 'cbtn' + (locked ? ' locked' : '') + (p.id === save.current && !locked ? ' active' : '');
    b.innerHTML = locked
      ? '🔒<span class="num">贏一場解鎖</span>'
      : `${p.name}<span class="num">${p.num} 號</span>`;
    b.addEventListener('click', () => {
      if (locked) {
        el('char-desc').textContent = `${p.name} 還沒解鎖 —— 贏一場（進 ${WIN_GOALS} 球以上）就能解鎖！`;
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
  const allDone = save.unlocked.length >= PLAYERS.length;
  el('char-desc').textContent = note || `${cur.name} · ${cur.num} 號　${
    allDone ? '（全部球員都解鎖了！）' : `（贏一場就能解鎖下一位超級巨星 ${save.unlocked.length}/${PLAYERS.length}）`}`;
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

  // 守門員一定會有反應：往球的方向撲（判斷誤差依難度）
  // ★ 踢角落（貼近門柱或上方）時守門員更難搆到 → 更容易進
  const extreme = Math.abs(state.aim.x - GOAL_Z) > 2.2 || state.aim.y > 3.3;
  const extraErr = extreme ? 0.6 : 0;
  const ez = (Math.random() * 2 - 1) * (d.errZ + extraErr);
  const ey = (Math.random() * 2 - 1) * (d.errY + extraErr * 0.5);
  const kbz = THREE.MathUtils.clamp(state.aim.x + ez, GOAL_Z_MIN - 0.4, GOAL_Z_MAX + 0.4);
  const kby = THREE.MathUtils.clamp(state.aim.y + ey, 1.0, 3.6);
  state.diveErr = Math.hypot(ez, ey);
  state.keeperTo.set(KEEPER_HOME.x, Math.max(1.0, kby - 1.35), kbz);

  state.ballFrom.copy(ball.position);
  state.ballTo.set(AIM_X, state.aim.y, state.aim.x);
  state.t = 0;
  state.kickT = 0;
  state.phase = 'fly';
  state.outcome = null;
  state.willSave = state.diveErr < d.reach * (0.9 + Math.random() * 0.2);
  kickSound(1);
  msg('射門！', 'shoot');
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

function nextShot() {
  if (state.shot >= TOTAL_SHOTS) {
    state.phase = 'done';
    const won = state.goals >= WIN_GOALS;
    let newUnlock = null;
    if (won) {
      const next = PLAYERS.find((p) => !save.unlocked.includes(p.id));
      if (next) { save.unlocked.push(next.id); newUnlock = next; }
    }
    if (state.goals > save.best) save.best = state.goals;
    persist();
    try { localStorage.setItem('ls_penalty_best', String(save.best)); } catch (e) { /* 忽略 */ }
    updateHud();

    const d = DIFF[state.diff];
    const cur = PLAYERS.find((p) => p.id === save.current);
    const title = state.goals === TOTAL_SHOTS ? '🏆 五球全進！太神了！'
      : state.goals >= WIN_GOALS ? '🔥 贏了！太厲害了！'
        : state.goals >= 3 ? '👏 表現不錯！'
          : '💪 再練一下就會更準！';
    el('pover-title').textContent = title;
    el('pover-score').innerHTML =
      `${cur.name} ${cur.num} 號 · ${d.icon} ${d.name}難度<br>5 球進了 <b>${state.goals}</b> 球<br>` +
      `<span class="best">最高紀錄：${save.best} 球</span>` +
      (newUnlock
        ? `<br><span class="unlock">🎉 解鎖新球員：${newUnlock.name}！</span>`
        : (won ? '<br><span class="best">所有球員都解鎖了 ✨</span>' : `<br><span class="best">進 ${WIN_GOALS} 球以上就能解鎖新球員</span>`));
    el('pover').classList.remove('hidden');
    return;
  }
  state.shot++;
  state.phase = 'aim';
  ball.position.copy(SPOT);
  keeper.position.copy(KEEPER_HOME);
  keeper.rotation.set(0, 0, 0);
  state.keeperTo.copy(KEEPER_HOME);
  kicker.position.copy(KICKER_HOME);
  state.aim.set(GOAL_Z, 2.2);
  aimRing.position.set(AIM_RING_X, 2.2, GOAL_Z);
  aimDot.position.copy(aimRing.position);
  updateHud();
  msg('拖曳瞄準，放開射門！');
}

function resetGame() {
  state.phase = 'aim';
  state.shot = 1;
  state.goals = 0;
  state.outcome = null;
  state.t = 0;
  state.kickT = 0;
  ball.position.copy(SPOT);
  keeper.position.copy(KEEPER_HOME);
  keeper.rotation.set(0, 0, 0);
  state.keeperTo.copy(KEEPER_HOME);
  kicker.position.copy(KICKER_HOME);
  state.aim.set(GOAL_Z, 2.2);
  aimRing.position.set(AIM_RING_X, 2.2, GOAL_Z);
  aimDot.position.copy(aimRing.position);
  el('pover').classList.add('hidden');
  updateHud();
  msg('拖曳瞄準，放開射門！');
}

function goFullScreen() {
  const d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {});
}

// ------------------------------ 更新 ---------------------------------------
const clock = new THREE.Clock();

function animateBall(dt) {
  if (state.phase === 'fly') {
    state.t += dt;
    const k = Math.min(1, state.t / state.flight);
    const e = 1 - Math.pow(1 - k, 2.2);
    ball.position.x = THREE.MathUtils.lerp(state.ballFrom.x, state.ballTo.x, e);
    ball.position.z = THREE.MathUtils.lerp(state.ballFrom.z, state.ballTo.z, e);
    ball.position.y = THREE.MathUtils.lerp(state.ballFrom.y, state.ballTo.y, e) + Math.sin(k * Math.PI) * 0.35;
    ball.rotation.x -= dt * 14;
    ball.rotation.z -= dt * 6;
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
}

function animateKeeper(dt) {
  const d = DIFF[state.diff];
  const speed = state.phase === 'fly' ? d.speed : 3.0;
  keeper.position.lerp(state.keeperTo, Math.min(1, dt * speed));
  const dz = keeper.position.z - GOAL_Z;
  const lift = Math.max(0, keeper.position.y - 1.0);
  keeper.rotation.x = dz * 0.28 + lift * 0.12;
  keeper.rotation.z = 0;
}

// 踢球動作：往前踏一步 → 回來
function animateKicker(dt) {
  if (state.phase === 'fly' || state.phase === 'result') {
    state.kickT += dt;
    const k = Math.min(1, state.kickT / 0.45);
    const step = Math.sin(Math.min(1, k) * Math.PI) * 0.55;
    kicker.position.x = KICKER_HOME.x - step * 0.85;
    kicker.position.z = KICKER_HOME.z - step * 0.55;
    kicker.rotation.x = -step * 0.2;
  } else {
    kicker.position.lerp(KICKER_HOME, Math.min(1, dt * 6));
    kicker.rotation.x *= 0.85;
  }
}

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  animateBall(dt);
  animateKeeper(dt);
  animateKicker(dt);
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
window.__penalty = { state, ball, keeper, kicker, shoot, resetGame, DIFF, PLAYERS, save, persist, renderChars, applyPlayer, TOTAL_SHOTS };
