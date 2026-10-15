// Кат-сцены: вступление, появление боссов и финал на острове.
// Рисуются целиком кодом в виде сбоку. Сцена — 100 «единиц» шириной по центру экрана,
// небо и море тянутся на всю ширину. Время t приходит от хоста, поэтому у обоих игроков всё синхронно.
import { TEAM_COLORS, CUT_TIME } from './const.js';

const FONT = '"Press Start 2P", system-ui, monospace';
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const easeOut = (v) => 1 - (1 - clamp01(v)) ** 3;
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp01((t - a) / (b - a)); // 0..1 на отрезке [a, b]
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Звуки по таймлайну сцены: [время, тип звука для sfx.event]
const CUES = {
  intro: [[0.2, 'cutstart'], [7.4, 'title']],
  serpent: [[0.2, 'rumble'], [1.5, 'splash'], [3.0, 'roar'], [3.5, 'bosstitle']],
  giant: [[0.2, 'rumble'], [1.3, 'stone'], [1.8, 'stone'], [2.3, 'stone'], [2.8, 'stone'], [3.3, 'ignite'], [3.7, 'stomp'], [4.0, 'bosstitle']],
  raider: [[0.1, 'engine'], [2.1, 'drift'], [3.0, 'bosstitle']],
  outro: [[0.3, 'cutstart'], [2.9, 'bump'], [3.7, 'jump'], [6.3, 'pop'], [7.3, 'fire'], [9.3, 'pop'], [10.1, 'click'], [10.8, 'pop'], [11.6, 'movie'], [13, 'win']],
};

export function cutCues(id, prevT, t) {
  return (CUES[id] || []).filter(([at]) => at > prevT && at <= t).map(([, type]) => type);
}

// ---------- Примитивы ----------
function R(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(x, y, w, h); }

function sky(S, top, mid, bottom) {
  const { c, W, X0, hor } = S;
  const g = c.createLinearGradient(0, 0, 0, hor);
  g.addColorStop(0, top); g.addColorStop(0.6, mid); g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(-X0, 0, W, hor + 1);
}

function stars(S, alpha) {
  if (alpha <= 0) return;
  const { c, W, X0, hor, t } = S;
  for (let i = 0; i < 60; i++) {
    const x = -X0 + hash(i) * W, y = hash(i + 99) * hor * 0.85;
    c.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(t * 3 + i));
    R(c, x, y, 0.6, 0.6, '#ffffff');
  }
  c.globalAlpha = 1;
}

function sea(S, near, far, speed = 1) {
  const { c, W, X0, hor, H, t } = S;
  const g = c.createLinearGradient(0, hor, 0, H);
  g.addColorStop(0, far); g.addColorStop(1, near);
  c.fillStyle = g;
  c.fillRect(-X0, hor, W, H - hor);
  // Блики волн: дальше от горизонта — крупнее и быстрее (перспектива)
  c.fillStyle = 'rgba(255,255,255,0.18)';
  for (let row = 0; row < 14; row++) {
    const k = row / 14;
    const y = hor + 1 + k * k * (H - hor);
    const len = 2 + k * 8;
    for (let i = 0; i < 7; i++) {
      const x = -X0 + ((hash(row * 7 + i) * W + t * speed * (4 + k * 18)) % (W + 20)) - 10;
      c.fillRect(x, y, len, 0.4 + k * 0.8);
    }
  }
}

function sun(S, x, y, r, color) {
  const { c } = S;
  c.fillStyle = color;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 0.25;
  c.beginPath(); c.arc(x, y, r * 1.8, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1;
}

function palm(S, x, y, s, sway) {
  const { c } = S;
  for (let i = 0; i < 6; i++) R(c, x - 0.8 * s + i * 0.25 * s * sway, y - (i + 1) * 3 * s, 1.6 * s, 3.2 * s, i % 2 ? '#7a5230' : '#8a6038');
  const tx = x + 1.5 * s * sway, ty = y - 19 * s;
  c.fillStyle = '#3f8f35';
  for (const [dx, dy, w] of [[-8, 1, 8], [0, -1, 8], [-4, -3, 8], [-6, 3, 4], [4, 2, 5]]) c.fillRect(tx + dx * s, ty + dy * s, w * s, 2 * s);
  R(c, tx - 1 * s, ty - 1 * s, 2 * s, 2 * s, '#2f6f28');
}

function island(S, x, y, s) {
  const { c } = S;
  R(c, x - 14 * s, y - 2 * s, 28 * s, 2.5 * s, '#e6c879');
  R(c, x - 10 * s, y - 4 * s, 20 * s, 2.5 * s, '#d9b866');
  R(c, x - 6 * s, y - 6 * s, 12 * s, 2.5 * s, '#58b04a');
  palm(S, x + 2 * s, y - 4 * s, s * 0.7, 1 + Math.sin(S.t * 1.5) * 0.3);
}

// Игрок сбоку. (x, y) — ноги. pose: stand | walk | sit | jump | alarm
function player(S, x, y, s, color, skin, pose, phase = 0) {
  const { c, t } = S;
  const step = pose === 'walk' ? Math.sin(t * 12 + phase) : 0;
  if (pose === 'sit') {
    R(c, x - 2 * s, y - 5 * s, 6 * s, 2 * s, '#3a3a4a'); // ноги вперёд
    R(c, x + 3 * s, y - 5 * s, 2 * s, 5 * s, '#3a3a4a');
    y += 2 * s; // сидя чуть ниже
  } else {
    R(c, x - 2 * s, y - 5 * s + step * s, 1.8 * s, 5 * s - step * s, '#3a3a4a');
    R(c, x + 0.4 * s, y - 5 * s - step * s, 1.8 * s, 5 * s + step * s, '#3a3a4a');
  }
  const by = y - 11 * s;
  R(c, x - 2.6 * s, by, 5.4 * s, 6.2 * s, color);
  R(c, x - 2.6 * s, by + 4.6 * s, 5.4 * s, 1.6 * s, 'rgba(0,0,0,0.2)');
  R(c, x - 2.2 * s, by - 4.6 * s, 4.6 * s, 4.6 * s, '#e8b98a');
  R(c, x - 2.2 * s, by - 4.6 * s, 4.6 * s, 1.4 * s, '#4a2f1b');
  R(c, x + 1 * s, by - 2.6 * s, 0.9 * s, 0.9 * s, '#1b1b2a');
  // Рука с ракеткой
  const up = pose === 'alarm' || pose === 'jump' ? -3 : 0;
  R(c, x + 2.4 * s, by + 1 * s + up * s, 1.4 * s, 3.4 * s, color);
  R(c, x + 3.2 * s, by + (0.8 + up) * s, 0.6 * s, 2 * s, '#6b4423');
  c.fillStyle = '#111';
  c.beginPath(); c.arc(x + 3.5 * s, by + (-0.8 + up) * s, 1.9 * s, 0, Math.PI * 2); c.fill();
  c.fillStyle = skin === 'rainbow' ? `hsl(${(t * 120) % 360},90%,55%)` : skin || '#d6262f';
  c.beginPath(); c.arc(x + 3.5 * s, by + (-0.8 + up) * s, 1.5 * s, 0, Math.PI * 2); c.fill();
  if (pose === 'alarm') bubbleMark(S, x, by - 8 * s, s);
}

function bubbleMark(S, x, y, s) {
  const { c } = S;
  R(c, x - 1.5 * s, y - 3 * s, 3 * s, 4.5 * s, '#ffffff');
  R(c, x - 0.5 * s, y - 2.4 * s, 1 * s, 2.2 * s, '#d6262f');
  R(c, x - 0.5 * s, y + 0.2 * s, 1 * s, 0.8 * s, '#d6262f');
}

function boatSide(S, x, y, s) {
  const { c } = S;
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(x - 15 * s, y + 1 * s, 30 * s, 2 * s);
  c.fillStyle = '#8a5a2b';
  c.beginPath();
  c.moveTo(x - 17 * s, y - 6 * s); c.lineTo(x + 18 * s, y - 7 * s); c.lineTo(x + 13 * s, y + 2 * s); c.lineTo(x - 14 * s, y + 2 * s);
  c.closePath(); c.fill();
  R(c, x - 17 * s, y - 7 * s, 35 * s, 1.6 * s, '#5a3a1c');
  c.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 0; i < 3; i++) c.fillRect(x - 15 * s + i, y - 3.5 * s + i * 2.2 * s, 28 * s - i * 2, 0.4 * s);
}

// Оба игрока (или один, если играет соло)
function crew(S, x, y, s, pose, gap = 9) {
  const { o } = S;
  if (o.duo) {
    player(S, x - gap * s / 2, y, s, TEAM_COLORS.h, o.skins.h, pose, 0);
    player(S, x + gap * s / 2, y, s, TEAM_COLORS.g, o.skins.g, pose, 1.7);
  } else player(S, x, y, s, TEAM_COLORS.h, o.skins.h, pose, 0);
}

// ---------- Подписи, карточка босса, кинорамка ----------
function caption(cam, text, alpha, size = 13, y) {
  const c = cam.ctx;
  c.globalAlpha = alpha;
  c.font = `${size}px ${FONT}`;
  c.textAlign = 'center';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size * 0.3);
  c.strokeStyle = 'rgba(0,0,0,0.9)';
  const lines = wrap(c, text, cam.w - 32);
  lines.forEach((line, i) => {
    const ly = (y ?? cam.h * 0.93) + (i - (lines.length - 1) / 2) * size * 1.6;
    c.strokeText(line, cam.w / 2, ly);
    c.fillStyle = '#ffffff';
    c.fillText(line, cam.w / 2, ly);
  });
  c.globalAlpha = 1;
}

function wrap(c, text, maxW) {
  const words = text.split(' ');
  const out = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (c.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

// Подпись появляется и исчезает плавно
function timedCaption(cam, t, a, b, text, size) {
  if (t < a || t > b) return;
  caption(cam, text, Math.min(1, (t - a) * 3, (b - t) * 3), size);
}

function bossCard(cam, p, name, sub) {
  if (p <= 0) return;
  const c = cam.ctx;
  const k = easeOut(p);
  const y = cam.h * 0.62;
  const x = lerp(cam.w, 0, k);
  c.save();
  c.translate(x, 0);
  c.fillStyle = 'rgba(160,20,30,0.92)';
  c.beginPath();
  c.moveTo(0, y - 34); c.lineTo(cam.w, y - 48); c.lineTo(cam.w, y + 26); c.lineTo(0, y + 40); c.closePath(); c.fill();
  c.fillStyle = '#ffe14d';
  c.fillRect(0, y + 34, cam.w, 4);
  c.textAlign = 'center';
  c.font = `10px ${FONT}`;
  c.fillStyle = '#ffd0d0';
  c.fillText('БОСС', cam.w / 2, y - 18);
  const size = Math.min(22, cam.w / (name.length * 1.05));
  c.font = `${size}px ${FONT}`;
  c.lineWidth = 4;
  c.strokeStyle = '#000';
  c.strokeText(name, cam.w / 2, y + 6);
  c.fillStyle = '#ffffff';
  c.fillText(name, cam.w / 2, y + 6);
  c.font = `9px ${FONT}`;
  c.fillStyle = '#ffe14d';
  c.fillText(sub, cam.w / 2, y + 24);
  c.restore();
}

function letterbox(cam) {
  const c = cam.ctx;
  const bar = Math.round(cam.h * 0.09);
  c.fillStyle = '#000';
  c.fillRect(0, 0, cam.w, bar);
  c.fillRect(0, cam.h - bar * 1.3, cam.w, bar * 1.3);
}

// ---------- Сцены ----------
const SCENES = {
  // Рассвет. Камера начинает с далёкого острова, отъезжает — в кадр вплывает лодка с игроками.
  intro(S) {
    const { c, t, hor, H } = S;
    const zoom = lerp(2.2, 1, ease(seg(t, 2.2, 5)));
    const fx = lerp(78, 50, ease(seg(t, 2.2, 5)));
    const fy = lerp(hor - 2, H * 0.5, ease(seg(t, 2.2, 5)));
    c.translate(50, H * 0.5); c.scale(zoom, zoom); c.translate(-fx, -fy);
    sky(S, '#4a6fd0', '#ff8fb0', '#ffc06b');
    sun(S, 70, hor - 3, 5, '#fff1b0');
    sea(S, '#0d3b66', '#3f78b5', 0.6);
    island(S, 78, hor + 0.5, 0.45);
    const bx = lerp(-40, 38, easeOut(seg(t, 2.6, 6.2)));
    const by = hor + 36 + Math.sin(t * 2) * 0.8;
    boatSide(S, bx, by, 1.5);
    crew(S, bx, by - 9, 1.1, 'stand', 12);
  },

  // Гроза. Из-под воды поднимается змей, ревёт.
  serpent(S) {
    const { c, t, hor } = S;
    const roar = t > 3 && t < 3.9;
    if (roar) c.translate((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5);
    const flash = t > 0.7 && t < 0.85;
    sky(S, flash ? '#9ab0c0' : '#101a26', '#22384a', '#3d5a6b');
    sea(S, '#08202f', '#1d4256', 1.2);
    // Лодка с испуганными игроками слева
    const by = hor + 34 + Math.sin(t * 3) * 1;
    boatSide(S, 18, by, 0.9);
    crew(S, 18, by - 6, 0.65, t > 1.7 ? 'alarm' : 'stand', 12);
    // Пузыри и бурление
    const x = 64, water = hor + 20;
    for (let i = 0; i < 10; i++) {
      const f = (t * 1.5 + hash(i)) % 1;
      c.globalAlpha = (1 - f) * clamp01(t);
      R(c, x - 8 + hash(i + 5) * 16, water - f * 6, 1.2, 1.2, '#cfeaff');
    }
    c.globalAlpha = 1;
    const rise = easeOut(seg(t, 1.4, 2.9));
    const jaw = roar ? 0.6 + 0.4 * Math.sin(t * 30) : t > 3.9 ? 0.3 : 0;
    drawSerpentSide(S, x, water, rise, jaw);
    if (t > 1.4 && t < 2.4) {
      for (let i = 0; i < 16; i++) {
        const a = hash(i) * Math.PI, r = (t - 1.4) * 22 * (0.5 + hash(i + 3));
        R(c, x + Math.cos(a) * r, water - Math.sin(a) * r * 0.8, 1.4, 1.4, '#e6f6ff');
      }
    }
  },

  // Скала в море: блоки один за другим складываются в великана, загораются глаза, топот — волна.
  giant(S) {
    const { c, t, hor } = S;
    const rumble = t < 1.2 || (t > 3.7 && t < 4.3);
    if (rumble) c.translate((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8);
    sky(S, '#2b2f36', '#4a525c', '#6b737c');
    sea(S, '#0d2c44', '#2d5170', 0.8);
    const by = hor + 34 + Math.sin(t * 2.5) * 1;
    boatSide(S, 16, by, 0.9);
    crew(S, 16, by - 6, 0.65, t > 3.4 ? 'alarm' : 'stand', 12);
    // Скала
    const gx = 64, ground = hor + 12;
    R(c, gx - 16, ground, 32, 6, '#5d646c');
    R(c, gx - 11, ground - 3, 22, 4, '#767e87');
    drawGiantSide(S, gx, ground - 3, seg(t, 1.2, 3.1), t > 3.3 ? 1 : 0, t > 3.6 && t < 4.1);
    // Волна от топота
    if (t > 3.7) {
      const r = (t - 3.7) * 30;
      c.strokeStyle = `rgba(230,245,255,${clamp01(1 - (t - 3.7) / 1.5)})`;
      c.lineWidth = 1.2;
      c.beginPath(); c.ellipse(gx, ground + 4, r, r * 0.25, 0, 0, Math.PI * 2); c.stroke();
    }
  },

  // Закат. Катер рейдеров влетает в кадр с полосами скорости и тормозит заносом.
  raider(S) {
    const { c, t, hor } = S;
    sky(S, '#3a1840', '#c4413b', '#ff9a3d');
    sun(S, 30, hor - 2, 6, '#ffcf6b');
    sea(S, '#2a1030', '#7a3a4a', 2);
    const x = lerp(140, 58, easeOut(seg(t, 0, 2.2)));
    const drift = seg(t, 2, 2.8);
    const y = hor + 26;
    // Полосы скорости
    if (t < 2.4) {
      c.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 9; i++) c.fillRect(x + 14 + hash(i) * 30, y - 12 + hash(i + 4) * 16, 12 + hash(i + 8) * 14, 0.6);
    }
    // Брызги заноса
    if (drift > 0 && drift < 1) {
      for (let i = 0; i < 18; i++) {
        const a = Math.PI + hash(i) * Math.PI * 0.8, r = drift * 20 * (0.4 + hash(i + 2));
        R(c, x - 8 + Math.cos(a) * r, y - Math.abs(Math.sin(a)) * r * 0.7, 1.3, 1.3, '#ffe0d0');
      }
    }
    c.save();
    c.translate(x, y);
    c.rotate(Math.sin(drift * Math.PI) * -0.12);
    drawRaiderSide(S, 0, 0, 1.3, t > 2.6);
    c.restore();
    // Наши — в своей лодке на переднем плане слева
    const by = hor + 40 + Math.sin(t * 3) * 1;
    boatSide(S, 14, by, 1);
    crew(S, 14, by - 7, 0.75, t > 2.4 ? 'alarm' : 'stand', 12);
  },

  // Финал: причаливаем, лагерь, проектор, стулья и кино под звёздами.
  outro(S) {
    const { c, t, hor, H } = S;
    const night = ease(seg(t, 5, 11));
    const pan = -lerp(0, 44, ease(seg(t, 3.6, 6.5)));
    sky(S, mix('#ff9a5a', '#0b1030', night), mix('#ffb36b', '#1b2450', night), mix('#ffd38a', '#2c3768', night));
    stars(S, seg(t, 8, 11));
    sun(S, 20 + pan * 0.3, hor - 4 + night * 14, 6, mix('#ffe08a', '#d06040', night));
    if (night > 0.6) sun(S, 78, H * 0.18, 3.2, '#f4f1d8'); // луна ниже верхней полосы
    c.translate(pan, 0);
    sea(S, mix('#0d3b66', '#06142a', night), mix('#3f78b5', '#132b4f', night), 0.5);

    // Пляж
    const ground = hor + 24;
    c.fillStyle = mix('#e6c879', '#6b5a3a', night * 0.8);
    c.beginPath();
    c.moveTo(48, H); c.lineTo(58, hor + 10); c.lineTo(220, hor + 10); c.lineTo(220, H); c.closePath(); c.fill();
    R(c, 58, hor + 10, 162, 2, 'rgba(255,255,255,0.25)');
    palm(S, 56, ground - 6, 0.9, 1 + Math.sin(t * 1.1 + 1) * 0.25);
    palm(S, 146, ground - 2, 1.1, 1 + Math.sin(t * 1.3) * 0.25);

    // Экран для кино между шестами + проектор с лучом
    const sx = 112, sw = 28;
    const scr = easeOut(seg(t, 9.4, 10.2));
    if (scr > 0) {
      R(c, sx - 1, ground - 30, 1.2, 30, '#6b4423');
      R(c, sx + sw, ground - 30, 1.2, 30, '#6b4423');
      const sh = 16 * scr;
      R(c, sx, ground - 29, sw, sh, '#f4f4ee');
      if (t > 11) movie(S, sx + 1, ground - 28, sw - 2, 14, t - 11);
    }
    const proj = easeOut(seg(t, 9, 9.5));
    if (proj > 0) {
      const py = ground - 4 - (1 - proj) * 20;
      R(c, 78, py, 8, 4, '#7a5230'); // ящик
      R(c, 79, py - 4, 6, 4, '#2b2f36');
      R(c, 85, py - 3.2, 1.6, 2.2, '#9fe8ff');
      if (t > 10.1) {
        // Луч от проектора над головами зрителей к экрану
        c.fillStyle = `rgba(255,255,220,${0.16 + Math.sin(t * 20) * 0.02})`;
        c.beginPath(); c.moveTo(86.6, py - 2); c.lineTo(sx, ground - 29); c.lineTo(sx, ground - 13); c.closePath(); c.fill();
      }
    }

    // Палатка
    const tent = seg(t, 6.2, 6.8);
    if (tent > 0) {
      const k = tent < 1 ? easeOut(tent) * (1 + Math.sin(tent * Math.PI) * 0.15) : 1;
      c.save(); c.translate(64, ground); c.scale(k, k);
      c.fillStyle = '#e8743a';
      c.beginPath(); c.moveTo(-11, 0); c.lineTo(0, -13); c.lineTo(11, 0); c.closePath(); c.fill();
      c.fillStyle = '#b5522a';
      c.beginPath(); c.moveTo(-3, 0); c.lineTo(0, -8); c.lineTo(3, 0); c.closePath(); c.fill();
      c.restore();
    }

    // Костёр
    const fireX = 72;
    if (t > 7) {
      R(c, fireX - 4, ground - 1.5, 8, 1.5, '#5a3a1c');
      R(c, fireX - 3, ground - 2.5, 6, 1.2, '#7a5230');
      if (t > 7.3) {
        for (let i = 0; i < 6; i++) {
          const f = (t * 2 + hash(i)) % 1;
          const fx = fireX - 2 + hash(i + 1) * 4;
          R(c, fx, ground - 3 - f * 7, 1.6 * (1 - f) + 0.4, 1.6 * (1 - f) + 0.4, f < 0.4 ? '#ffe14d' : f < 0.7 ? '#ff9a3d' : '#d6262f');
        }
        c.fillStyle = `rgba(255,160,60,${0.1 * night})`;
        c.beginPath(); c.arc(fireX, ground - 3, 18, 0, Math.PI * 2); c.fill();
      }
    }

    // Походные стулья
    const chairs = easeOut(seg(t, 10.8, 11.3));
    const chairX = [94, 104];
    if (chairs > 0) for (const x of chairX) chair(S, x, ground, chairs);

    // Лодка причаливает и утыкается в песок
    const bx = lerp(-40, 44, easeOut(seg(t, 0, 3)));
    const bump = t > 2.9 && t < 3.2 ? Math.sin((t - 2.9) * 40) * 0.6 : 0;
    const by = ground + Math.sin(t * 2) * 0.6 * (1 - seg(t, 2.5, 3)) + bump;
    boatSide(S, bx, by, 1.2);

    // Игроки: стоят в лодке → прыгают на берег → идут к лагерю → садятся на стулья
    const o = S.o;
    const keys = o.duo ? ['h', 'g'] : ['h'];
    keys.forEach((key, i) => {
      const onBoat = { x: bx - 4 + i * 9, y: by - 8.4 };
      const shore = { x: 66 + i * 6, y: ground };
      const camp = { x: 88 + i * 18, y: ground };
      const seat = { x: chairX[o.duo ? i : 0] + 1, y: ground - 3 };
      let x, y, pose = 'stand';
      if (t < 3.6) { x = onBoat.x; y = onBoat.y; }
      else if (t < 4.3) {
        const k = seg(t, 3.6 + i * 0.15, 4.3);
        x = lerp(onBoat.x, shore.x, k); y = lerp(onBoat.y, shore.y, k) - Math.sin(k * Math.PI) * 8; pose = 'jump';
      } else if (t < 6) {
        const k = seg(t, 4.3, 6);
        x = lerp(shore.x, camp.x, k); y = ground; pose = k < 1 ? 'walk' : 'stand';
      } else if (t < 11.4) { x = camp.x; y = ground; }
      else if (t < 12.2) {
        const k = seg(t, 11.4, 12.2);
        x = lerp(camp.x, seat.x, k); y = ground; pose = 'walk';
      } else { x = seat.x; y = seat.y; pose = 'sit'; }
      player(S, x, y, 0.75, TEAM_COLORS[key], o.skins[key], pose, i * 1.7);
    });
  },
};

function chair(S, x, ground, k) {
  const { c } = S;
  c.save(); c.translate(x, ground); c.scale(k, k);
  c.strokeStyle = '#3a3a3a';
  c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(-3, 0); c.lineTo(3, -5); c.moveTo(3, 0); c.lineTo(-3, -5); c.stroke();
  R(c, -3.4, -5.6, 7, 1.4, '#2f6fd6'); // сиденье
  R(c, 2.6, -11, 1.2, 6, '#2f6fd6'); // спинка
  c.restore();
}

// Кино на экране — пиксельный «Понг»: две ракетки и мячик.
function movie(S, x, y, w, h, t) {
  const { c } = S;
  R(c, x, y, w, h, '#101820');
  const by = y + h / 2 + Math.sin(t * 2.3) * (h / 2 - 2);
  const bx = x + 2 + ((Math.sin(t * 1.6) + 1) / 2) * (w - 4);
  R(c, x + 1, by - 2 + Math.sin(t * 2.3 - 0.3) * 1, 0.8, 4, '#ff8a3d');
  R(c, x + w - 1.8, by - 2 - Math.sin(t * 2.3 + 0.4) * 1, 0.8, 4, '#3db4ff');
  R(c, bx - 0.5, by - 0.5, 1, 1, '#ffffff');
  for (let i = 0; i < 6; i++) R(c, x + w / 2 - 0.15, y + i * (h / 6) + 0.5, 0.3, h / 12, 'rgba(255,255,255,0.3)');
  if (t > 4) {
    c.font = `2px ${FONT}`;
    c.textAlign = 'center';
    c.fillStyle = '#ffe14d';
    c.fillText('КОНЕЦ', x + w / 2, y + 3);
  }
}

function drawSerpentSide(S, x, water, rise, jaw) {
  const { c, t } = S;
  if (rise <= 0) return;
  const h = rise * 42;
  const n = 9;
  // Шея из блоков, качается
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const px = x + Math.sin(i * 0.7 + t * 2) * 4 * (1 - k) - k * 4;
    const py = water - k * h;
    const sz = lerp(9, 6.5, k);
    R(c, px - sz / 2, py - sz / 2, sz, sz, i % 2 ? '#277f73' : '#2f9e8f');
    R(c, px - sz / 2, py - sz / 2, sz * 0.3, sz, '#e0c25a');
  }
  // Горбы за спиной
  for (let i = 0; i < 2; i++) {
    const hx = x + 16 + i * 12;
    c.fillStyle = '#277f73';
    c.beginPath(); c.arc(hx, water + 1, 4 * rise, Math.PI, 0); c.fill();
  }
  // Голова с пастью
  const hx = x - 8, hy = water - h - 4;
  R(c, hx - 6, hy - 6, 14, 7, '#2f9e8f');
  R(c, hx - 9, hy - 3, 5, 4, '#2f9e8f');
  R(c, hx - 6, hy + 1 + jaw * 5, 12, 4, '#227066'); // нижняя челюсть
  if (jaw > 0.1) {
    R(c, hx - 5, hy + 1, 10, jaw * 5, '#5a0f18');
    for (let i = 0; i < 4; i++) R(c, hx - 4 + i * 3, hy + 1, 1, 1.6, '#ffffff');
  }
  R(c, hx - 1, hy - 4.5, 3, 2, '#ffe14d');
  R(c, hx + 0.2, hy - 4.2, 1, 1.6, '#111');
}

function drawGiantSide(S, x, base, build, eyes, stomp) {
  const { c, t } = S;
  // Блоки в порядке сборки: ноги, таз, торс, руки, голова
  const parts = [
    [-7, -8, 5, 8], [2, -8, 5, 8], [-8, -12, 16, 5], [-9, -24, 18, 12], [-14, -24, 5, 12], [9, -24, 5, 12], [-5, -32, 10, 8],
  ];
  parts.forEach(([dx, dy, w, h], i) => {
    const p = clamp01(build * parts.length - i);
    if (p <= 0) return;
    const fall = (1 - easeOut(p)) * 30;
    const lift = stomp && i >= 4 && i <= 5 ? -4 : 0;
    R(c, x + dx, base + dy - fall + (i < 2 && stomp ? -2 : 0) + lift, w, h, i % 2 ? '#7d858e' : '#8b939c');
    R(c, x + dx, base + dy - fall + lift, w, 1, 'rgba(255,255,255,0.15)');
  });
  if (eyes) {
    const glow = `rgba(255,${130 + Math.sin(t * 8) * 60},40,1)`;
    R(c, x - 3.5, base - 29, 2.4, 1.6, glow);
    R(c, x + 1.2, base - 29, 2.4, 1.6, glow);
  }
}

function drawRaiderSide(S, x, y, s, fists) {
  const { c, t } = S;
  c.fillStyle = '#2b2f36';
  c.beginPath();
  c.moveTo(x - 14 * s, y - 5 * s); c.lineTo(x + 8 * s, y - 5 * s); c.lineTo(x + 16 * s, y - 2 * s); c.lineTo(x + 10 * s, y + 2 * s); c.lineTo(x - 13 * s, y + 2 * s);
  c.closePath(); c.fill();
  R(c, x - 13 * s, y - 2 * s, 26 * s, 1.2 * s, '#d6262f');
  R(c, x - 16 * s, y - 7 * s, 3 * s, 7 * s, '#444b55'); // мотор сзади
  for (const dx of [-6, 1]) {
    R(c, x + dx * s, y - 11 * s, 4 * s, 6 * s, '#444b55');
    R(c, x + dx * s, y - 14.5 * s, 4 * s, 3.5 * s, '#2b2f36');
    R(c, x + dx * s, y - 13.2 * s, 4 * s, 1 * s, '#d6262f'); // маска
    if (fists) R(c, x + (dx + 3.2) * s, y - (16 + Math.abs(Math.sin(t * 10 + dx)) * 2) * s, 1.4 * s, 4 * s, '#444b55');
  }
}

function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// Кнопка пропуска в верхней чёрной полосе: её надо удерживать, кольцо показывает прогресс.
export const SKIP_HOLD = 1.2;
export function skipButton(cam) {
  const bar = Math.round(cam.h * 0.09);
  return { x: cam.w - 34, y: bar / 2, r: Math.min(22, bar / 2 - 4) };
}

function drawSkipButton(ctx, cam, p) {
  const b = skipButton(cam);
  ctx.fillStyle = p > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (p > 0) {
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  for (const dx of [-7, 0]) { // значок ⏩ из двух треугольников
    ctx.beginPath(); ctx.moveTo(b.x + dx - 1, b.y - 6); ctx.lineTo(b.x + dx + 7, b.y); ctx.lineTo(b.x + dx - 1, b.y + 6); ctx.closePath(); ctx.fill();
  }
  ctx.font = `7px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.globalAlpha = 0.7;
  ctx.fillText(p > 0 ? 'держи…' : 'удерживай — пропустить', b.x - b.r - 6, b.y + 3);
  ctx.globalAlpha = 1;
}

// cam — камера игры (размеры экрана), o — { duo, skins: { h, g }, skip: 0..1 прогресс удержания }
export function drawCutscene(ctx, cam, id, t, o) {
  const scene = SCENES[id];
  if (!scene) return;
  const u = Math.min(cam.w / 100, cam.h / 150);
  const W = cam.w / u, H = cam.h / u;
  const S = { c: ctx, u, W, H, X0: (W - 100) / 2, hor: H * 0.42, t, o };
  ctx.save();
  ctx.setTransform(cam.dpr * u, 0, 0, cam.dpr * u, 0, 0);
  ctx.translate(S.X0, 0);
  scene(S);
  ctx.restore();

  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  const sc = { ctx, w: cam.w, h: cam.h };
  letterbox(sc);
  const solo = !o.duo;
  if (id === 'intro') {
    timedCaption(sc, t, 0.4, 2.6, 'Мир ушёл под воду…');
    timedCaption(sc, t, 2.8, 5.2, 'Говорят, где-то остался Остров.');
    timedCaption(sc, t, 5.4, 7.6, solo ? 'Ты один. Лодка. И ракетка.' : 'Вас двое. Лодка. И две ракетки.');
    if (t > 7.3) {
      const a = Math.min(1, (t - 7.3) * 3);
      caption(sc, 'ДВОЕ В ЛОДКЕ', a, Math.min(28, Math.floor((cam.w - 40) / 12)), cam.h * 0.3); // в одну строку
      caption(sc, 'не считая зомби', a, 11, cam.h * 0.3 + 34);
    }
  } else if (id === 'serpent') bossCard(sc, seg(t, 3.5, 4.1), 'МОРСКОЙ ЗМЕЙ', 'Хозяин глубин');
  else if (id === 'giant') bossCard(sc, seg(t, 4, 4.6), 'КАМЕННЫЙ ВЕЛИКАН', 'Страж скал');
  else if (id === 'raider') bossCard(sc, seg(t, 3, 3.6), 'КАТЕР РЕЙДЕРОВ', 'Финальная погоня! Остров близко');
  else if (id === 'outro') {
    timedCaption(sc, t, 0.4, 2.8, 'ЗЕМЛЯ!!!', 16);
    timedCaption(sc, t, 4.3, 7.5, 'Разбиваем лагерь');
    timedCaption(sc, t, 8.6, 11, 'А теперь — кино!');
    timedCaption(sc, t, 12.5, 17.5, 'Остров, остров — ужин готов! 🍗');
  }
  drawSkipButton(ctx, cam, o.skip || 0);
  // Плавное затемнение в начале и в конце
  const fade = Math.max(1 - t * 2.5, 1 - (CUT_TIME[id] - t) * 2.5);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp01(fade)})`; ctx.fillRect(0, 0, cam.w, cam.h); }
}
