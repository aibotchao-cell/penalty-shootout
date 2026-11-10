import * as THREE from 'three';

// ---------------------------------------------------------------------------
// LS 特輯的標誌與足球花紋
//   ballTexture()  — 程序化畫出「黑白五角形」的經典足球花紋
//   logoTexture()  — 載入 assets/logo.png（LS 隊徽，已去背）給球場／球衣／選單用
// ---------------------------------------------------------------------------

let _ball = null;
export function ballTexture() {
  if (_ball) return _ball;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f8f6';
  ctx.fillRect(0, 0, S, S);

  // 黑色五角形（經典足球）
  const penta = (cx, cy, r, rot) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = '#17181a';
  const spots = [
    [22, 24, 17, 0.2], [70, 18, 15, 0.9], [110, 40, 16, 1.5],
    [44, 66, 16, 0.4], [92, 74, 15, 1.1], [16, 100, 15, 0.7],
    [64, 112, 16, 0.1], [116, 106, 14, 1.3],
  ];
  for (const [x, y, r, rot] of spots) penta(x, y, r, rot);

  // 五角形之間的細縫線（讓花紋更立體）
  ctx.strokeStyle = 'rgba(30,32,34,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 44); ctx.lineTo(S, 40);
  ctx.moveTo(0, 88); ctx.lineTo(S, 92);
  ctx.moveTo(40, 0); ctx.lineTo(44, S);
  ctx.moveTo(88, 0); ctx.lineTo(84, S);
  ctx.stroke();

  // 一點皮革顆粒
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < 260; i++) ctx.fillRect(Math.random() * S | 0, Math.random() * S | 0, 1, 1);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.anisotropy = 4;
  _ball = tex;
  return tex;
}

let _logo = null;
export function logoTexture() {
  if (_logo) return _logo;
  _logo = new THREE.TextureLoader().load('./assets/logo.png');
  _logo.colorSpace = THREE.SRGBColorSpace;
  _logo.anisotropy = 4;
  return _logo;
}

// 球衣上的隊徽小牌（LS logo）
export function badgeMaterial() {
  return new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true, depthWrite: false });
}
