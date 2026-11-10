// ---------------------------------------------------------------------------
// LS 特輯：戲劇化的動物叫聲（Web Audio 即時合成，不需要任何音檔）
//   鱷魚低吼嘶嘶／恐龍咆哮／漢堡滑稽啾聲／金剛吼叫／小牛哞／
//   紅鷹尖嘯／紅豹低吼／爆炸頭教練吹哨子
//   被擊飛出場時另外加一段「往下掉」的戲劇化長音
// ---------------------------------------------------------------------------

let ctx = null;
let master = null;
let voices = 0;
const MAX_VOICES = 5;          // 同時最多 5 個聲音，避免吵成一團

// 一定要在使用者點擊後才能啟動（iOS / Safari 的限制）
export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export const audioReady = () => !!ctx;

// ---- 合成小工具 ----------------------------------------------------------
function tone(t0, o) {
  const {
    type = 'sawtooth', f0 = 300, f1 = null, dur = 0.4, gain = 0.25,
    attack = 0.012, detune = 0, vibrato = 0, vibRate = 7,
    tremolo = 0, tremRate = 20, filter = null,
  } = o;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  if (detune) osc.detune.setValueAtTime(detune, t0);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type || 'lowpass';
    f.frequency.value = filter.freq || 1200;
    f.Q.value = filter.q || 1;
    node.connect(f); node = f;
  }
  node.connect(g); g.connect(master);

  // 顫音（音高抖動）
  if (vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = vibRate;
    const lg = ctx.createGain();
    lg.gain.value = vibrato;
    lfo.connect(lg); lg.connect(osc.frequency);
    lfo.start(t0); lfo.stop(t0 + dur + 0.05);
  }
  // 抖音（音量抖動）
  if (tremolo) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = tremRate;
    const lg = ctx.createGain();
    lg.gain.value = tremolo;
    lfo.connect(lg); lg.connect(g.gain);
    lfo.start(t0); lfo.stop(t0 + dur + 0.05);
  }
  osc.start(t0); osc.stop(t0 + dur + 0.06);
}

function noise(t0, o) {
  const { dur = 0.3, gain = 0.2, type = 'bandpass', freq = 1200, q = 1, sweepTo = null } = o;
  const src = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * (dur + 0.05)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

// ---- 8 種角色的叫聲 ------------------------------------------------------
// p = 音高倍率（隨機浮動）、ko = 被擊飛出場（更戲劇化）
const CRIES = {
  // 鱷魚：低沉喉音 + 嘶嘶聲
  croc(t0, p) {
    tone(t0, { type: 'sawtooth', f0: 95 * p, f1: 58 * p, dur: 0.55, gain: 0.34, vibrato: 9, vibRate: 11, filter: { freq: 700 } });
    noise(t0 + 0.05, { dur: 0.6, gain: 0.16, freq: 2600, q: 0.9, sweepTo: 900 });
  },
  // 恐龍：大聲咆哮（低頻抖動）
  dino(t0, p) {
    tone(t0, { type: 'sawtooth', f0: 150 * p, f1: 68 * p, dur: 0.9, gain: 0.4, vibrato: 16, vibRate: 17, filter: { freq: 900, q: 1.2 } });
    tone(t0 + 0.02, { type: 'square', f0: 76 * p, f1: 44 * p, dur: 0.85, gain: 0.2 });
    noise(t0, { dur: 0.7, gain: 0.12, freq: 500, q: 0.7, sweepTo: 180 });
  },
  // 漢堡：滑稽的「啾～」滑音（食物只能這樣叫）
  burger(t0, p) {
    tone(t0, { type: 'sine', f0: 420 * p, f1: 1500 * p, dur: 0.22, gain: 0.3, filter: { freq: 2600 } });
    tone(t0 + 0.16, { type: 'sine', f0: 1500 * p, f1: 700 * p, dur: 0.2, gain: 0.22 });
    noise(t0, { dur: 0.12, gain: 0.1, type: 'highpass', freq: 2200 });
  },
  // 金剛：兩段式「嗚嗚」低吼
  kong(t0, p) {
    tone(t0, { type: 'sawtooth', f0: 120 * p, f1: 100 * p, dur: 0.3, gain: 0.34, tremolo: 0.12, tremRate: 26, filter: { freq: 620 } });
    tone(t0 + 0.3, { type: 'sawtooth', f0: 108 * p, f1: 52 * p, dur: 0.6, gain: 0.38, vibrato: 12, vibRate: 13, filter: { freq: 700 } });
    noise(t0, { dur: 0.85, gain: 0.1, freq: 400, q: 0.6, sweepTo: 150 });
  },
  // 小牛：哞～～（慢起音 + 抖音）
  calf(t0, p) {
    tone(t0, { type: 'triangle', f0: 176 * p, f1: 132 * p, dur: 0.75, gain: 0.34, attack: 0.12, vibrato: 7, vibRate: 5.5 });
    tone(t0, { type: 'sine', f0: 352 * p, f1: 264 * p, dur: 0.7, gain: 0.12, attack: 0.12 });
  },
  // 紅鷹：尖銳的長嘯
  eagle(t0, p) {
    tone(t0, { type: 'sawtooth', f0: 1900 * p, f1: 3200 * p, dur: 0.42, gain: 0.26, tremolo: 0.09, tremRate: 30, filter: { type: 'highpass', freq: 900 } });
    tone(t0 + 0.2, { type: 'sawtooth', f0: 2600 * p, f1: 1500 * p, dur: 0.4, gain: 0.2, tremolo: 0.08, tremRate: 26 });
    noise(t0, { dur: 0.5, gain: 0.1, type: 'highpass', freq: 2400 });
  },
  // 紅豹：低吼 + 噴氣
  panther(t0, p) {
    tone(t0, { type: 'sawtooth', f0: 210 * p, f1: 120 * p, dur: 0.5, gain: 0.3, vibrato: 22, vibRate: 24, filter: { freq: 1100, q: 1.5 } });
    noise(t0 + 0.3, { dur: 0.35, gain: 0.18, freq: 3000, q: 1.2, sweepTo: 1200 });
  },
  // 爆炸頭紅衣教練：吹哨子（比賽犯規啦！）
  coach(t0, p) {
    tone(t0, { type: 'square', f0: 2350 * p, f1: 2250 * p, dur: 0.6, gain: 0.2, tremolo: 0.16, tremRate: 22, filter: { type: 'bandpass', freq: 2400, q: 1.4 } });
    tone(t0, { type: 'sine', f0: 3100 * p, dur: 0.55, gain: 0.1, tremolo: 0.09, tremRate: 44 });
  },
};

// 被擊飛出場：一段「越掉越遠」的戲劇化長音
function fallingScream(t0, p) {
  tone(t0, { type: 'sawtooth', f0: 700 * p, f1: 120 * p, dur: 1.1, gain: 0.22, vibrato: 40, vibRate: 9, filter: { freq: 1600 } });
  tone(t0 + 0.1, { type: 'sine', f0: 1200 * p, f1: 260 * p, dur: 1.0, gain: 0.12 });
}

// ---- 對外 API ------------------------------------------------------------
export function hitCry(head, ko = false) {
  if (!ctx || voices >= MAX_VOICES) return;
  const t0 = ctx.currentTime + 0.01;
  const p = 0.88 + Math.random() * 0.28;          // 每個人的音高都不太一樣
  const fn = CRIES[head] || CRIES.croc;
  voices++;
  try { fn(t0, ko ? p * 0.92 : p); } catch (e) { /* 忽略音訊小錯誤 */ }
  if (ko) { try { fallingScream(t0 + 0.18, p * 0.9); } catch (e) {} }
  setTimeout(() => { voices = Math.max(0, voices - 1); }, ko ? 1500 : 1000);
}

// 踢球的聲音（順手加的，讓射門有回饋）
export function kickSound(power = 1) {
  if (!ctx || voices >= MAX_VOICES) return;
  const t0 = ctx.currentTime + 0.005;
  voices++;
  try {
    tone(t0, { type: 'sine', f0: 220 * (0.9 + Math.random() * 0.2), f1: 90, dur: 0.14, gain: 0.22 * power, filter: { freq: 900 } });
    noise(t0, { dur: 0.09, gain: 0.14 * power, freq: 1500, q: 0.8, sweepTo: 500 });
  } catch (e) {}
  setTimeout(() => { voices = Math.max(0, voices - 1); }, 300);
}

// 進球／清空一波的歡呼提示（簡單的上行三音）
export function waveClearSound() {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.01;
  [523, 659, 784, 1046].forEach((f, i) => {
    try { tone(t0 + i * 0.1, { type: 'triangle', f0: f, dur: 0.22, gain: 0.2, filter: { freq: 4000 } }); } catch (e) {}
  });
}

// ⚽ 點球大戰：進球 —— 歡呼（上行和弦 + 一點人聲雜訊）
export function goalCheer() {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.01;
  [523, 659, 784, 1046, 1318].forEach((f, i) => {
    try { tone(t0 + i * 0.07, { type: 'triangle', f0: f, dur: 0.5, gain: 0.18, filter: { freq: 5000 } }); } catch (e) {}
  });
  // 群眾歡呼：帶通雜訊 + 起伏
  try {
    noise(t0, { dur: 1.1, gain: 0.12, type: 'bandpass', freq: 900, q: 0.6, sweepTo: 1600 });
    noise(t0 + 0.15, { dur: 0.9, gain: 0.08, type: 'highpass', freq: 1800 });
  } catch (e) {}
}

// ⚽ 點球大戰：被撲救 —— 嘆息（往下滑的低音）
export function saveGroan() {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.01;
  try {
    tone(t0, { type: 'sawtooth', f0: 300, f1: 120, dur: 0.7, gain: 0.2, vibrato: 10, vibRate: 6, filter: { freq: 800 } });
    tone(t0 + 0.05, { type: 'sine', f0: 200, f1: 90, dur: 0.6, gain: 0.12 });
    noise(t0, { dur: 0.5, gain: 0.06, type: 'lowpass', freq: 600 });
  } catch (e) {}
}
