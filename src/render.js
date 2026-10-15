// Отрисовка на Canvas 2D. Мир рисуется в «блоках», камера вписывает поле 12×20 в экран.
import {
  WORLD_W, WORLD_H, BOAT, REACH, TEAM_COLORS, CHARGE_COLORS, BUCKET,
  isBoatTile, tileAt, shotPos, lerp,
} from './const.js';

const FONT = '"Press Start 2P", system-ui, monospace';

// Детерминированный «рандом», чтобы пена и края дыр не прыгали между кадрами.
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function computeCamera(w, h) {
  const top = Math.min(110, h * 0.12);
  const bottom = Math.min(80, h * 0.09);
  const s = Math.min(w / WORLD_W, (h - top - bottom) / WORLD_H);
  return { s, ox: (w - WORLD_W * s) / 2, oy: top + (h - top - bottom - WORLD_H * s) / 2, w, h };
}

export function screenToWorld(cam, sx, sy) {
  return { x: (sx - cam.ox) / cam.s, y: (sy - cam.oy) / cam.s };
}

// ---------- Эффекты ----------
export function createFx() {
  return { list: [], shake: 0 };
}

function burst(fx, x, y, color, n, speed, size = 0.08, life = 0.5) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    fx.list.push({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size });
  }
}
function ring(fx, x, y, color, r, life = 0.4) { fx.list.push({ k: 'ring', x, y, r, life, max: life, color }); }
function text(fx, x, y, str, color, size = 0.45, life = 0.9) { fx.list.push({ k: 'text', x, y, str, color, size, life, max: life }); }

export function applyEvent(fx, ev) {
  switch (ev.type) {
    case 'hit':
      burst(fx, ev.x, ev.y, ev.perfect ? '#fff27a' : '#ffffff', ev.perfect ? 14 : 7, 4);
      ring(fx, ev.x, ev.y, CHARGE_COLORS[Math.min(ev.charge, 5)], 0.9, 0.25);
      if (ev.perfect) text(fx, ev.x, ev.y - 0.6, 'ИДЕАЛЬНО!', '#fff27a', 0.32);
      else if (ev.pass) text(fx, ev.x, ev.y - 0.6, 'ПАС ×' + ev.charge, '#bfe6ff', 0.3);
      break;
    case 'boat':
      if (ev.drop) {
        burst(fx, ev.x, ev.y, '#a8dcff', 10, 2.5, 0.08, 0.5);
        text(fx, ev.x, ev.y - 0.5, 'УРОНИЛИ!', '#ff5a5a', 0.32);
        fx.shake = Math.max(fx.shake, 0.15);
        break;
      }
      burst(fx, ev.x, ev.y, '#8a5a2b', 12, 3.5, 0.11, 0.6);
      burst(fx, ev.x, ev.y, '#a8dcff', 8, 2.5, 0.07, 0.5);
      text(fx, ev.x, ev.y - 0.5, ev.hole ? 'ПРОБОИНА!' : 'ЗАЛИВАЕТ!', '#ff5a5a', 0.3);
      fx.shake = Math.max(fx.shake, ev.big ? 0.45 : 0.25);
      break;
    case 'patch':
      burst(fx, ev.x, ev.y, '#d9a46a', 12, 3, 0.1, 0.5);
      text(fx, ev.x, ev.y - 0.6, 'ЗАЛАТАЛИ!', '#7dff6a', 0.3);
      break;
    case 'loot':
      burst(fx, ev.x, ev.y, '#d9a46a', 10, 3, 0.09, 0.5);
      ring(fx, ev.x, ev.y, '#ffe14d', 0.8, 0.3);
      text(fx, ev.x, ev.y - 0.5, '+1 ДОСКА', '#ffe14d', 0.28);
      break;
    case 'splash':
      burst(fx, ev.x, ev.y, '#a8dcff', 9, 2.5, 0.07, 0.45);
      ring(fx, ev.x, ev.y, '#d7f0ff', 0.7, 0.5);
      break;
    case 'ehit':
      burst(fx, ev.x, ev.y, '#7dff6a', 8, 3);
      break;
    case 'kill':
      burst(fx, ev.x, ev.y, '#5fae4e', 16, 4, 0.1, 0.7);
      burst(fx, ev.x, ev.y, '#8a5a2b', 8, 3, 0.1, 0.7);
      text(fx, ev.x, ev.y - 0.4, '+' + ev.pts, '#ffe14d', 0.36);
      break;
    case 'smash':
      ring(fx, ev.x, ev.y, '#ff3d5a', ev.r, 0.5);
      ring(fx, ev.x, ev.y, '#ffe14d', ev.r * 0.6, 0.35);
      burst(fx, ev.x, ev.y, '#ff9a3d', 30, 6, 0.12, 0.7);
      text(fx, ev.x, ev.y - 0.8, 'СМЭШ!', '#ff3d5a', 0.6, 1.2);
      fx.shake = Math.max(fx.shake, 0.4);
      break;
    case 'throw':
      burst(fx, ev.x, ev.y, '#d7f0ff', 4, 1.5, 0.06, 0.3);
      break;
  }
}

function updateFx(fx, dt) {
  for (const p of fx.list) {
    p.life -= dt;
    if (p.k === 'p') { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
    if (p.k === 'text') p.y -= dt * 0.8;
  }
  fx.list = fx.list.filter((p) => p.life > 0);
  fx.shake = Math.max(0, fx.shake - dt);
}

// ---------- Сглаживание чужих объектов (на гостевом телефоне снимки приходят ~30 раз/с) ----------
const smooth = new Map();
function smoothed(id, x, y, dt) {
  let o = smooth.get(id);
  if (!o || Math.hypot(o.x - x, o.y - y) > 3) { o = { x, y }; smooth.set(id, o); }
  const k = 1 - Math.exp(-dt * 18);
  o.x += (x - o.x) * k; o.y += (y - o.y) * k;
  o.seen = true;
  return o;
}

// ---------- Мир ----------
function drawWater(ctx, cam, time) {
  const { s } = cam;
  const g = ctx.createLinearGradient(0, 0, 0, cam.h);
  g.addColorStop(0, '#0d3b66');
  g.addColorStop(1, '#155e93');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cam.w, cam.h);

  const x0 = -cam.ox / s, x1 = (cam.w - cam.ox) / s;
  const y0 = -cam.oy / s, y1 = (cam.h - cam.oy) / s;
  const gap = 1.1;
  const scroll = (time * 1.4) % gap;
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = Math.max(1, s * 0.06);
  for (let y = Math.floor(y0 / gap) * gap - gap; y < y1 + gap; y += gap) {
    const row = Math.round(y / gap);
    ctx.beginPath();
    for (let x = x0 - 0.5; x <= x1 + 0.5; x += 0.5) {
      const wy = y + scroll + Math.sin(x * 1.3 + time * 1.5 + row) * 0.12;
      const sx = cam.ox + x * s, sy = cam.oy + wy * s;
      if (x === x0 - 0.5) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  // Пена вдоль бортов и кильватерный след — лодка «плывёт» вверх.
  ctx.fillStyle = 'rgba(220,240,255,0.5)';
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1;
    const travel = (hash(i) * 30 + time * 2.6) % 30;
    const y = BOAT.y + 1 + travel;
    const behind = Math.max(0, y - (BOAT.y + BOAT.h));
    const x = BOAT.x + BOAT.w / 2 + side * (BOAT.w / 2 + 0.15 + hash(i + 50) * 0.5 + behind * 0.45);
    const a = Math.max(0, 1 - travel / 22);
    const r = (0.05 + hash(i + 9) * 0.09) * (1 + behind * 0.15);
    ctx.globalAlpha = a * 0.7;
    ctx.fillRect(cam.ox + (x - r) * s, cam.oy + (y - r) * s, r * 2 * s, r * 2 * s);
  }
  ctx.globalAlpha = 1;
}

function drawBoat(ctx, view, time) {
  // Тень
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let row = 0; row < BOAT.h; row++) for (let col = 0; col < BOAT.w; col++) {
    if (isBoatTile(col, row)) ctx.fillRect(BOAT.x + col + 0.2, BOAT.y + row + 0.3, 1, 1);
  }
  for (let row = 0; row < BOAT.h; row++) for (let col = 0; col < BOAT.w; col++) {
    if (!isBoatTile(col, row)) continue;
    const x = BOAT.x + col, y = BOAT.y + row;
    ctx.fillStyle = (col + row) % 2 ? '#a8763f' : '#9c6c37';
    ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y + 0.48, 1, 0.05);
    ctx.fillRect(x + (row % 2 ? 0.3 : 0.7), y, 0.04, 0.48);
    ctx.fillRect(x + (row % 2 ? 0.7 : 0.3), y + 0.53, 0.04, 0.47);
  }
  // Скамья
  ctx.fillStyle = '#6e4825';
  ctx.fillRect(BOAT.x + 0.15, BOAT.y + 5.35, BOAT.w - 0.3, 0.3);
  // Борта: тёмная кромка там, где нет соседней доски
  ctx.fillStyle = '#5a3a1c';
  const b = 0.16;
  for (let row = 0; row < BOAT.h; row++) for (let col = 0; col < BOAT.w; col++) {
    if (!isBoatTile(col, row)) continue;
    const x = BOAT.x + col, y = BOAT.y + row;
    if (!isBoatTile(col - 1, row)) ctx.fillRect(x, y, b, 1);
    if (!isBoatTile(col + 1, row)) ctx.fillRect(x + 1 - b, y, b, 1);
    if (!isBoatTile(col, row - 1)) ctx.fillRect(x, y, 1, b);
    if (!isBoatTile(col, row + 1)) ctx.fillRect(x, y + 1 - b, 1, b);
  }
  // Заплатки — светлые доски с гвоздями, как блок в кубическом мире
  for (const [col, row] of view.PT || []) {
    const x = BOAT.x + col + 0.12, y = BOAT.y + row + 0.12;
    ctx.fillStyle = '#c99a5b';
    ctx.fillRect(x, y, 0.76, 0.76);
    ctx.fillStyle = '#e0b878';
    ctx.fillRect(x, y, 0.76, 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x, y + 0.36, 0.76, 0.04);
    ctx.fillStyle = '#3a3a3a';
    for (const [nx, ny] of [[0.08, 0.08], [0.6, 0.08], [0.08, 0.6], [0.6, 0.6]]) ctx.fillRect(x + nx, y + ny, 0.08, 0.08);
  }

  // Пробоины: рваная дыра, в ней вода, пузыри
  for (const [col, row] of view.H || []) {
    const cx = BOAT.x + col + 0.5, cy = BOAT.y + row + 0.5;
    const seed = col * 13 + row * 7;
    ctx.fillStyle = '#2b1a0c';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 0.3 + hash(seed + i) * 0.12;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1d5f99';
    ctx.beginPath(); ctx.arc(cx, cy, 0.24, 0, Math.PI * 2); ctx.fill();
    const b = (time * 1.5 + hash(seed)) % 1;
    ctx.fillStyle = `rgba(200,235,255,${1 - b})`;
    ctx.fillRect(cx - 0.1 + hash(seed + 3) * 0.12, cy + 0.1 - b * 0.25, 0.07, 0.07);
    ctx.fillRect(cx + 0.06 - hash(seed + 5) * 0.1, cy + 0.05 - ((b + 0.5) % 1) * 0.25, 0.05, 0.05);
  }

  // Ведро на корме
  const bx = BUCKET.x, by = BUCKET.y;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.arc(bx, by, BUCKET.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5c6670';
  ctx.fillRect(bx - 0.22, by - 0.2, 0.44, 0.4);
  ctx.fillStyle = '#8a96a3';
  ctx.fillRect(bx - 0.26, by - 0.24, 0.52, 0.1);
  ctx.fillStyle = '#2e6da4';
  ctx.fillRect(bx - 0.18, by - 0.14, 0.36, 0.12);

  // Вода в лодке: чем больше, тем гуще синий слой поверх палубы
  const wa = view.wa || 0;
  if (wa > 0) {
    ctx.save();
    ctx.globalAlpha = 0.12 + (wa / 100) * 0.5;
    ctx.fillStyle = wa > 70 ? '#1f6fb5' : '#2f86c9';
    for (let row = 0; row < BOAT.h; row++) for (let col = 0; col < BOAT.w; col++) {
      if (isBoatTile(col, row)) ctx.fillRect(BOAT.x + col + 0.08, BOAT.y + row + 0.08, 0.84, 0.84);
    }
    ctx.globalAlpha = Math.min(0.5, wa / 120);
    ctx.strokeStyle = '#cde9ff';
    ctx.lineWidth = 0.05;
    for (let i = 0; i < 6; i++) {
      const y = BOAT.y + 2.5 + ((i * 1.3 + time * 0.6) % 7.3);
      ctx.beginPath();
      ctx.moveTo(BOAT.x + 0.4 + hash(i) * 2, y);
      ctx.lineTo(BOAT.x + 1.4 + hash(i) * 3, y + Math.sin(time * 3 + i) * 0.05);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawDebris(ctx, d, time) {
  const bob = Math.sin(time * 3 + d.id) * 0.05;
  const x = d.x, y = d.y + bob;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 1.3 + d.id) * 0.25);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-0.36, -0.08, 0.8, 0.3);
  ctx.fillStyle = '#c99a5b';
  ctx.fillRect(-0.42, -0.14, 0.84, 0.28);
  ctx.fillStyle = '#e0b878';
  ctx.fillRect(-0.42, -0.14, 0.84, 0.07);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(-0.1, -0.14, 0.04, 0.28);
  ctx.restore();
  // Мерцающее кольцо, чтобы доску было видно на воде
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 6 + d.id);
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = 0.04;
  ctx.beginPath(); ctx.arc(x, y, 0.55, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// Текст в мировых координатах рисуем в экранных пикселях — мелкие дробные шрифты на телефонах рендерятся криво.
function worldText(ctx, cam, str, x, y, size, color) {
  ctx.save();
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  outlined(ctx, str, cam.ox + x * cam.s, cam.oy + y * cam.s, Math.round(size * cam.s), color);
  ctx.restore();
}

function drawPlayer(ctx, cam, p, color, label) {
  const { x, y, fx, fy } = p;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y + 0.3, 0.38, 0.16, 0, 0, Math.PI * 2); ctx.fill();

  // Тело и голова — квадратные, как в кубическом мире
  ctx.fillStyle = shade(color, 0.6);
  ctx.fillRect(x - 0.34, y - 0.3, 0.68, 0.62);
  ctx.fillStyle = color;
  ctx.fillRect(x - 0.3, y - 0.26, 0.6, 0.54);
  const hx = x + fx * 0.08, hy = y - 0.3 + fy * 0.06;
  ctx.fillStyle = '#e8b98a';
  ctx.fillRect(hx - 0.22, hy - 0.22, 0.44, 0.44);
  ctx.fillStyle = '#4a2f1b';
  ctx.fillRect(hx - 0.22, hy - 0.22, 0.44, 0.13);
  ctx.fillStyle = '#1b1b2a';
  ctx.fillRect(hx - 0.13 + fx * 0.06, hy - 0.03 + fy * 0.05, 0.08, 0.08);
  ctx.fillRect(hx + 0.05 + fx * 0.06, hy - 0.03 + fy * 0.05, 0.08, 0.08);

  // Ракетка
  const swinging = p.swingAge < 0.2;
  let a;
  if (swinging) {
    const base = Math.atan2(p.sdy, p.sdx);
    a = base + lerp(-1.4, 1.4, p.swingAge / 0.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.arc(x, y, REACH * 0.75, base - 1.4, a); ctx.stroke();
  } else {
    a = Math.atan2(fy, fx) + 0.9;
  }
  const rx = x + Math.cos(a) * 0.62, ry = y + Math.sin(a) * 0.62;
  ctx.strokeStyle = '#6b4423';
  ctx.lineWidth = 0.09;
  ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 0.25, y + Math.sin(a) * 0.25); ctx.lineTo(rx, ry); ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(rx, ry, 0.23, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d6262f';
  ctx.beginPath(); ctx.arc(rx, ry, 0.19, 0, Math.PI * 2); ctx.fill();

  if (p.repair > 0) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.arc(x, y - 0.95, 0.2, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#7dff6a';
    ctx.beginPath(); ctx.arc(x, y - 0.95, 0.2, -Math.PI / 2, -Math.PI / 2 + p.repair * Math.PI * 2); ctx.stroke();
  }
  if (p.bail) {
    // Выплёскиваем воду за борт
    const t = (performance.now() / 400) % 1;
    ctx.fillStyle = `rgba(160,215,255,${1 - t})`;
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 0.3 + t * 0.8 + i * 0.1, y - 0.4 - Math.sin(t * Math.PI) * 0.6 + i * 0.08, 0.09, 0.09);
  }

  if (label) worldText(ctx, cam, label, x, y - 0.66, 0.26, color);
}

const ENEMY_LOOK = {
  zombie:  { body: '#5fae4e', size: 0.56, raft: [1.3, 1.0] },
  spitter: { body: '#a6d64a', size: 0.48, raft: [1.15, 0.9] },
  brute:   { body: '#3f7a35', size: 0.82, raft: [1.7, 1.35] },
};

function drawEnemy(ctx, e, time) {
  const look = ENEMY_LOOK[e.kind];
  const bob = Math.sin(time * 2.2 + e.id) * 0.05;
  const x = e.x, y = e.y + bob;
  const [rw, rh] = look.raft;

  // Плот из брёвен
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - rw / 2 + 0.12, y - rh / 2 + 0.15, rw, rh);
  const logs = 3;
  for (let i = 0; i < logs; i++) {
    ctx.fillStyle = i % 2 ? '#7a5230' : '#6b4626';
    ctx.fillRect(x - rw / 2, y - rh / 2 + (rh / logs) * i, rw, rh / logs - 0.04);
    ctx.fillStyle = '#4a2f1b';
    ctx.fillRect(x - rw / 2, y - rh / 2 + (rh / logs) * i, 0.08, rh / logs - 0.04);
    ctx.fillRect(x + rw / 2 - 0.08, y - rh / 2 + (rh / logs) * i, 0.08, rh / logs - 0.04);
  }

  // Заражённый: смотрит на лодку, тянет руки
  const cx = BOAT.x + BOAT.w / 2, cy = BOAT.y + BOAT.h / 2;
  const d = Math.hypot(cx - x, cy - y) || 1;
  const dx = (cx - x) / d, dy = (cy - y) / d;
  const sz = look.size;
  const throwing = e.throwT < 0.3;
  ctx.fillStyle = shade(look.body, 0.7);
  const armLen = throwing ? -0.25 : sz * 0.75;
  for (const side of [-1, 1]) {
    const ax = x - dy * side * sz * 0.38, ay = y + dx * side * sz * 0.38;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + dx * armLen, ay + dy * armLen);
    ctx.lineWidth = sz * 0.22;
    ctx.strokeStyle = shade(look.body, 0.7);
    ctx.stroke();
  }
  ctx.fillStyle = e.flash < 0.12 ? '#ffffff' : look.body;
  ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - sz / 2, y + sz * 0.25, sz, sz * 0.25);
  // Глаза-«грибницы» (заражённые не видят — только слышат)
  ctx.fillStyle = e.kind === 'spitter' ? '#ffef5a' : '#c9d6a0';
  const ex = dx * sz * 0.12, ey = dy * sz * 0.12;
  ctx.fillRect(x - sz * 0.28 + ex, y - sz * 0.12 + ey, sz * 0.18, sz * 0.14);
  ctx.fillRect(x + sz * 0.1 + ex, y - sz * 0.12 + ey, sz * 0.18, sz * 0.14);
  if (e.kind === 'spitter') {
    ctx.fillStyle = '#2b3a12';
    ctx.fillRect(x - sz * 0.15 + ex, y + sz * 0.1 + ey, sz * 0.3, sz * 0.16);
  }

  if (e.hp < e.maxHp) {
    const w = 0.22, gap = 0.06, total = e.maxHp * w + (e.maxHp - 1) * gap;
    for (let i = 0; i < e.maxHp; i++) {
      ctx.fillStyle = i < e.hp ? '#ff4d5e' : 'rgba(0,0,0,0.45)';
      ctx.fillRect(x - total / 2 + i * (w + gap), y - rh / 2 - 0.35, w, 0.14);
    }
  }
}

function drawShot(ctx, sh, age, time, myKey) {
  const t = Math.min(sh.t + age, sh.dur);
  const pos = shotPos(sh, t);
  const enemy = sh.owner === 'e';

  // Куда упадёт снаряд врага / куда летит пас
  if (enemy || sh.passTo) {
    const r = 0.22 + 0.4 * (1 - pos.p);
    const pulse = 0.6 + 0.4 * Math.sin(time * 14);
    ctx.strokeStyle = enemy ? `rgba(255,70,70,${pulse})` : TEAM_COLORS[sh.passTo];
    ctx.lineWidth = sh.passTo === myKey ? 0.1 : 0.06;
    ctx.beginPath(); ctx.arc(sh.tx, sh.ty, r, 0, Math.PI * 2); ctx.stroke();
    if (enemy) {
      ctx.beginPath();
      ctx.moveTo(sh.tx - 0.12, sh.ty - 0.12); ctx.lineTo(sh.tx + 0.12, sh.ty + 0.12);
      ctx.moveTo(sh.tx + 0.12, sh.ty - 0.12); ctx.lineTo(sh.tx - 0.12, sh.ty + 0.12);
      ctx.stroke();
    }
  }

  // Тень на воде/палубе
  ctx.fillStyle = `rgba(0,0,0,${0.35 - Math.min(0.25, pos.z * 0.08)})`;
  ctx.beginPath(); ctx.ellipse(pos.x, pos.y, 0.16, 0.08, 0, 0, Math.PI * 2); ctx.fill();

  const bx = pos.x, by = pos.y - pos.z;
  if (enemy) {
    if (sh.kind === 'brute') {
      ctx.fillStyle = '#6b4626';
      ctx.fillRect(bx - 0.22, by - 0.26, 0.44, 0.52);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(bx - 0.22, by - 0.16, 0.44, 0.06);
      ctx.fillRect(bx - 0.22, by + 0.1, 0.44, 0.06);
    } else if (sh.kind === 'spitter') {
      ctx.fillStyle = '#9dff3d';
      ctx.beginPath(); ctx.arc(bx, by, 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d9ff9e';
      ctx.fillRect(bx - 0.06, by - 0.08, 0.06, 0.06);
    } else {
      ctx.fillStyle = '#8d8d8d';
      ctx.fillRect(bx - 0.16, by - 0.16, 0.32, 0.32);
      ctx.fillStyle = '#b3b3b3';
      ctx.fillRect(bx - 0.16, by - 0.16, 0.16, 0.12);
    }
    return;
  }

  const color = CHARGE_COLORS[Math.min(sh.charge, 5)];
  // След за мячом
  for (let i = 3; i >= 1; i--) {
    const tp = shotPos(sh, Math.max(0, t - i * 0.03));
    ctx.globalAlpha = 0.18 * (4 - i);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(tp.x, tp.y - tp.z, 0.13 - i * 0.02, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.arc(bx, by, sh.smash ? 0.42 : 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(bx, by, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(bx - 0.07, by - 0.08, 0.05, 0.05);
}

function drawFx(ctx, cam, fx) {
  for (const p of fx.list) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.k === 'p') {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    } else if (p.k === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.2 - a * 0.7), 0, Math.PI * 2); ctx.stroke();
    } else if (p.k === 'text') {
      worldText(ctx, cam, p.str, p.x, p.y, p.size, p.color);
    }
  }
  ctx.globalAlpha = 1;
}

function outlined(ctx, str, x, y, size, color, align = 'center') {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.3);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function drawHud(ctx, cam, view, hud, joy) {
  const W = cam.w;
  const pad = 14;
  const sz = Math.max(10, Math.min(16, W / 32));

  // Вода в лодке
  const wa = view.wa || 0;
  const barW = Math.min(240, W - 2 * pad - 120);
  const bx = (W - barW) / 2, by = pad + sz + 8;
  const danger = wa > 70;
  const blink = danger && Math.sin(performance.now() / 90) > 0;
  outlined(ctx, 'ВОДА ' + Math.floor(wa) + '%', W / 2, pad + sz, sz * 0.8, danger ? '#ff6b6b' : '#bfe6ff');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx - 2, by - 2, barW + 4, 16);
  ctx.fillStyle = '#3a2a20';
  ctx.fillRect(bx, by, barW, 12);
  ctx.fillStyle = blink ? '#ff4d5e' : wa > 40 ? '#2f86c9' : '#4da6ff';
  ctx.fillRect(bx, by, (barW * wa) / 100, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(bx, by, (barW * wa) / 100, 3);

  // Доски и пробоины
  const holes = (view.H || []).length;
  const iy = by + 34;
  ctx.fillStyle = '#c99a5b';
  ctx.fillRect(pad, iy - 11, 24, 10);
  ctx.fillStyle = '#e0b878';
  ctx.fillRect(pad, iy - 11, 24, 3);
  outlined(ctx, '×' + (view.pl ?? 0), pad + 30, iy, sz * 0.75, view.pl ? '#ffe9c4' : '#ff6b6b', 'left');
  if (holes) outlined(ctx, 'ДЫР: ' + holes, W - pad, iy, sz * 0.75, '#ff9a7a', 'right');

  outlined(ctx, 'ВОЛНА ' + Math.max(1, view.w), pad, pad + sz, sz * 0.8, '#bfe6ff', 'left');
  outlined(ctx, String(view.sc), W - pad, pad + sz, sz * 0.9, '#ffe14d', 'right');

  // Счётчик розыгрыша, пока пас в воздухе
  const pass = view.S.find((s) => s[11]);
  if (pass) outlined(ctx, 'РОЗЫГРЫШ ×' + pass[3], W / 2, by + 52, sz * 0.75, CHARGE_COLORS[Math.min(pass[3], 5)]);

  if (view.ban) {
    const pulse = 1 + Math.sin(performance.now() / 120) * 0.03;
    outlined(ctx, view.ban, W / 2, cam.oy + WORLD_H * cam.s * 0.38, sz * 1.6 * pulse, '#ffffff');
  }

  // Нижняя строка: комната и пинг
  if (hud.status) {
    ctx.globalAlpha = 0.75;
    outlined(ctx, hud.status, W / 2, cam.h - 10, Math.max(8, sz * 0.6), '#d7f0ff');
    ctx.globalAlpha = 1;
  }

  if (hud.hint > 0) {
    ctx.globalAlpha = Math.min(1, hud.hint);
    outlined(ctx, '◀ БЕГ', W * 0.25, cam.h - 50, sz * 0.8, '#ffffff');
    outlined(ctx, 'УДАР ▶', W * 0.75, cam.h - 50, sz * 0.8, '#ffffff');
    outlined(ctx, 'удар: свайп — прицел, тап — авто', W / 2, cam.h - 32, Math.max(7, Math.min(sz * 0.55, W / 40)), '#d7f0ff');
    ctx.globalAlpha = 1;
  }

  if (joy) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(joy.x0, joy.y0, joy.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.7;
    let dx = joy.x - joy.x0, dy = joy.y - joy.y0;
    const d = Math.hypot(dx, dy);
    if (d > joy.r) { dx *= joy.r / d; dy *= joy.r / d; }
    ctx.beginPath(); ctx.arc(joy.x0 + dx, joy.y0 + dy, joy.r * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// view — снимок от хоста, age — сколько секунд прошло с его получения,
// me — локальный игрок (рисуем без задержки сети).
export function render(ctx, cam, view, age, me, fx, time, dt, hud, joy) {
  updateFx(fx, dt);
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  drawWater(ctx, cam, time);

  const sh = fx.shake * cam.s * 0.5;
  const shx = sh ? (Math.random() - 0.5) * sh : 0, shy = sh ? (Math.random() - 0.5) * sh : 0;
  const k = cam.dpr;
  ctx.setTransform(cam.s * k, 0, 0, cam.s * k, (cam.ox + shx) * k, (cam.oy + shy) * k);

  drawBoat(ctx, view, time);
  for (const d of view.D || []) {
    const p = smoothed('d' + d[0], d[1], d[2], dt);
    drawDebris(ctx, { id: d[0], x: p.x, y: p.y }, time);
  }

  for (const o of smooth.values()) o.seen = false;
  for (const e of view.E) {
    const [id, kind, x, y, hp, maxHp, flash, throwT] = e;
    const p = smoothed('e' + id, x, y, dt);
    drawEnemy(ctx, { id, kind, x: p.x, y: p.y, hp, maxHp, flash: flash + age, throwT: throwT + age }, time);
  }

  for (const key of ['h', 'g']) {
    const arr = view.P[key];
    if (!arr) continue;
    let p;
    if (me && key === me.key) p = { ...me, repair: arr[7], bail: arr[8] };
    else {
      const sp = smoothed('p' + key, arr[0], arr[1], dt);
      p = { x: sp.x, y: sp.y, fx: arr[2], fy: arr[3], swingAge: arr[4] + age, sdx: arr[5], sdy: arr[6], repair: arr[7], bail: arr[8] };
    }
    drawPlayer(ctx, cam, p, TEAM_COLORS[key], me && key === me.key ? 'ТЫ' : null);
  }

  for (const s of view.S) {
    const [id, owner, kind, charge, x0, y0, tx, ty, t, dur, arc, passTo, smash] = s;
    drawShot(ctx, { id, owner, kind, charge, x0, y0, tx, ty, t, dur, arc, passTo, smash }, age, time, me && me.key);
  }

  // Подсказка: стоишь на дыре, а досок нет
  if (me && view.ph === 'play' && !view.pl) {
    const { col, row } = tileAt(me.x, me.y);
    if ((view.H || []).some(([c, r]) => c === col && r === row)) {
      worldText(ctx, cam, 'НЕТ ДОСОК!', me.x, me.y - 1.05, 0.26, '#ff6b6b');
      worldText(ctx, cam, 'лови их ракеткой у борта', me.x, me.y + 0.95, 0.2, '#ffe9c4');
    }
  }

  drawFx(ctx, cam, fx);
  for (const [id, o] of smooth) if (!o.seen) smooth.delete(id);

  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  if (view.ph !== 'menu') drawHud(ctx, cam, view, hud, joy);
}
