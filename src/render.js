// Отрисовка на Canvas 2D. Мир рисуется в «блоках», камера вписывает поле 12×20 в экран.
import {
  WORLD_W, WORLD_H, BOAT, REACH, TEAM_COLORS, CHARGE_COLORS, BUCKET, HELM, CARDS,
  isBoatTile, tileAt, shotPos, lerp,
} from './const.js';
import { drawCutscene } from './cutscene.js';

const FONT = '"Press Start 2P", system-ui, monospace';

// Детерминированный «рандом», чтобы пена и края дыр не прыгали между кадрами.
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function computeCamera(w, h) {
  const top = Math.min(110, h * 0.12);
  const bottom = Math.min(140, Math.max(100, h * 0.17)); // снизу — эликсир и карты
  const s = Math.min(w / WORLD_W, (h - top - bottom) / WORLD_H);
  return { s, ox: (w - WORLD_W * s) / 2, oy: top + (h - top - bottom - WORLD_H * s) / 2, w, h, bottom };
}

export function screenToWorld(cam, sx, sy) {
  return { x: (sx - cam.ox) / cam.s, y: (sy - cam.oy) / cam.s };
}

// ---------- Эффекты ----------
export function createFx() {
  return { list: [], shake: 0, flash: 0 };
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
      text(fx, ev.x, ev.y - 0.5, ev.nitro ? '+1 НИТРО' : '+1 ДОСКА', ev.nitro ? '#9fe8ff' : '#ffe14d', 0.28);
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
    case 'rock':
      burst(fx, ev.x, ev.y, '#868e97', 16, 4, 0.12, 0.6);
      burst(fx, ev.x, ev.y, '#8a5a2b', 8, 3, 0.1, 0.6);
      text(fx, ev.x, ev.y - 0.6, 'СКАЛА!', '#ff5a5a', 0.34);
      fx.shake = Math.max(fx.shake, 0.5);
      break;
    case 'bolt':
      fx.flash = 1;
      fx.list.push({ k: 'bolt', x: ev.x, y: ev.y, life: 0.25, max: 0.25 });
      burst(fx, ev.x, ev.y, '#fffbd0', 12, 4, 0.08, 0.4);
      text(fx, ev.x, ev.y - 0.6, 'МОЛНИЯ!', '#fffbd0', 0.3);
      fx.shake = Math.max(fx.shake, 0.35);
      break;
    case 'whirl':
      text(fx, ev.x, ev.y, 'ВОДОВОРОТ!', '#bfe6ff', 0.32, 1.2);
      break;
    case 'card': {
      const c = CARDS[ev.id];
      ring(fx, ev.x, ev.y, '#d23cff', 1.2, 0.4);
      burst(fx, ev.x, ev.y, '#f0b8ff', 10, 3, 0.08, 0.5);
      text(fx, ev.x, ev.y - 1.1, c.name.toUpperCase() + '!', '#f0b8ff', 0.3, 1.1);
      break;
    }
    case 'nope':
      text(fx, ev.x, ev.y - 1, 'МАЛО ЭЛИКСИРА', '#f0b8ff', 0.24, 0.8);
      break;
    case 'block':
      ring(fx, ev.x, ev.y, '#aee6ff', 0.8, 0.35);
      burst(fx, ev.x, ev.y, '#aee6ff', 8, 3, 0.07, 0.4);
      text(fx, ev.x, ev.y - 0.5, 'БЛОК!', '#aee6ff', 0.28);
      break;
    case 'chest':
      text(fx, BOAT.x + BOAT.w / 2, BOAT.y + 4, ev.title, '#ffe14d', 0.3, 1.8);
      break;
    case 'boss':
      fx.shake = Math.max(fx.shake, 0.6);
      break;
    case 'bossdown':
      burst(fx, BOAT.x + BOAT.w / 2, 4, '#ffe14d', 40, 7, 0.14, 1);
      burst(fx, BOAT.x + BOAT.w / 2, 4, '#ff3d5a', 30, 6, 0.12, 1);
      fx.shake = Math.max(fx.shake, 0.6);
      break;
    case 'slam':
      burst(fx, ev.x, ev.y, '#8a5a2b', 12, 3.5, 0.11, 0.6);
      burst(fx, ev.x, ev.y, '#a8dcff', 6, 2.5, 0.07, 0.5);
      fx.shake = Math.max(fx.shake, 0.35);
      break;
    case 'roar':
      text(fx, ev.x, ev.y - 1.2, 'РРРР!', '#ff9a7a', 0.34, 1);
      break;
    case 'stomp':
      ring(fx, ev.x, ev.y, '#d7f0ff', 3, 0.6);
      text(fx, BOAT.x + BOAT.w / 2, BOAT.y + 3, 'ВОЛНА!', '#bfe6ff', 0.34, 1);
      fx.shake = Math.max(fx.shake, 0.6);
      break;
    case 'nitro':
      text(fx, BOAT.x + BOAT.w / 2, BOAT.y + 1, 'МЫ — СЕМЬЯ! НИТРО!', '#ffb13d', 0.36, 1.6);
      burst(fx, BOAT.x + BOAT.w / 2, BOAT.y + BOAT.h, '#ffb13d', 30, 6, 0.12, 0.8);
      fx.shake = Math.max(fx.shake, 0.4);
      break;
    case 'rocksmash':
      burst(fx, ev.x, ev.y, '#868e97', 20, 5, 0.12, 0.6);
      text(fx, ev.x, ev.y - 0.5, 'В ЩЕПКИ!', '#ffb13d', 0.3);
      break;
    case 'chase':
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
  fx.flash = Math.max(0, fx.flash - dt * 3);
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
function drawWater(ctx, cam, time, view) {
  const travel = view.ph === 'menu' ? time * 1.6 : view.di || 0; // сколько проплыли
  const bx = view.bx || 0;
  const { s } = cam;
  const g = ctx.createLinearGradient(0, 0, 0, cam.h);
  g.addColorStop(0, '#0d3b66');
  g.addColorStop(1, '#155e93');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cam.w, cam.h);

  const x0 = -cam.ox / s, x1 = (cam.w - cam.ox) / s;
  const y0 = -cam.oy / s, y1 = (cam.h - cam.oy) / s;
  const gap = 1.1;
  const scroll = (travel * 0.9) % gap;
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = Math.max(1, s * 0.06);
  for (let y = Math.floor(y0 / gap) * gap - gap; y < y1 + gap; y += gap) {
    const row = Math.round(y / gap);
    ctx.beginPath();
    for (let x = x0 - 0.5; x <= x1 + 0.5; x += 0.5) {
      const wy = y + scroll + Math.sin((x + bx) * 1.3 + time * 1.5 + row) * 0.12;
      const sx = cam.ox + x * s, sy = cam.oy + wy * s;
      if (x === x0 - 0.5) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  // Пена вдоль бортов и кильватерный след — лодка «плывёт» вверх.
  ctx.fillStyle = 'rgba(220,240,255,0.5)';
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1;
    const along = (hash(i) * 30 + travel * 1.6) % 30;
    const y = BOAT.y + 1 + along;
    const behind = Math.max(0, y - (BOAT.y + BOAT.h));
    const x = BOAT.x + BOAT.w / 2 + side * (BOAT.w / 2 + 0.15 + hash(i + 50) * 0.5 + behind * 0.45) - (view.bv || 0) * behind * 0.3;
    const a = Math.max(0, 1 - along / 22);
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
  if (d.nitro) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - 0.12, y - 0.2, 0.34, 0.6);
    ctx.fillStyle = '#2f6fd6';
    ctx.fillRect(x - 0.18, y - 0.3, 0.36, 0.6);
    ctx.fillStyle = '#c0c8d0';
    ctx.fillRect(x - 0.08, y - 0.42, 0.16, 0.12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 0.1, y - 0.12, 0.2, 0.08);
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 8 + d.id);
    ctx.strokeStyle = '#9fe8ff';
    ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.arc(x, y, 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
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

// ---------- Плавание: скалы, водовороты, штурвал, шторм, остров ----------
function drawRock(ctx, r, time) {
  const { x, y } = r;
  const rad = r.r;
  // Пена вокруг
  ctx.strokeStyle = 'rgba(230,245,255,0.55)';
  ctx.lineWidth = 0.08;
  ctx.beginPath(); ctx.arc(x, y + 0.05, rad + 0.18 + Math.sin(time * 4 + r.id) * 0.04, 0, Math.PI * 2); ctx.stroke();
  // Кубический валун: несколько серых блоков
  const seed = r.id * 7;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - rad + 0.12, y - rad * 0.8 + 0.15, rad * 2, rad * 1.7);
  const blocks = [[-1, -0.8, 1.2, 1], [-0.2, -1, 1.2, 1.1], [-0.9, 0, 1.9, 0.9]];
  blocks.forEach(([bx, by, bw, bh], i) => {
    ctx.fillStyle = ['#6f7780', '#868e97', '#5d646c'][(i + seed) % 3];
    ctx.fillRect(x + bx * rad * 0.8, y + by * rad * 0.8, bw * rad * 0.8, bh * rad * 0.8);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + bx * rad * 0.8, y + by * rad * 0.8, bw * rad * 0.8, 0.08);
  });
}

function drawWhirl(ctx, w, time) {
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.rotate(-time * 2.2);
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(200,235,255,${0.5 - i * 0.1})`;
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.arc(0, 0, w.r * (1 - i * 0.22), i, i + Math.PI * 1.3);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(5,30,60,0.6)';
  ctx.beginPath(); ctx.arc(0, 0, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawHelm(ctx, view, active) {
  const { x, y } = HELM;
  const a = (view.bx || 0) * 0.9; // колесо поворачивается вместе с курсом
  // Колесо стоит перед рулевым (ближе к носу), чтобы фигурка его не закрывала
  ctx.fillStyle = '#5a3a1c';
  ctx.fillRect(x - 0.08, y - 0.75, 0.16, 0.4);
  ctx.save();
  ctx.translate(x, y - 0.75);
  ctx.rotate(a);
  ctx.strokeStyle = '#6b4423';
  ctx.lineWidth = 0.08;
  for (let i = 0; i < 4; i++) {
    const t = (i / 4) * Math.PI;
    ctx.beginPath(); ctx.moveTo(Math.cos(t) * -0.42, Math.sin(t) * -0.42); ctx.lineTo(Math.cos(t) * 0.42, Math.sin(t) * 0.42); ctx.stroke();
  }
  ctx.strokeStyle = active ? '#ffe14d' : '#8a5a2b';
  ctx.lineWidth = 0.1;
  ctx.beginPath(); ctx.arc(0, 0, 0.32, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#3b2614';
  ctx.beginPath(); ctx.arc(0, 0, 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- Мелкие помощники для спрайтов вида сверху ----------
function fE(ctx, x, y, rx, ry, col, rot = 0) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
}
function fR(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
function fRR(ctx, x, y, w, h, r, col) { ctx.fillStyle = col; roundRect(ctx, x, y, w, h, r); ctx.fill(); }
function fPath(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
// Иней поверх замороженного босса
function frost(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(170,230,255,0.45)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.05;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.lineTo(x - Math.cos(a) * r * 0.5, y - Math.sin(a) * r * 0.5); ctx.stroke();
  }
}
// Пальма сверху: звезда из листьев с прожилками и кокосы в центре
function palmTop(ctx, x, y, r, time) {
  fE(ctx, x + r * 0.25, y + r * 0.3, r * 0.95, r * 0.55, 'rgba(0,0,0,0.2)');
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + Math.sin(time * 1.2 + k) * 0.06;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    fE(ctx, r * 0.48, 0, r * 0.53, r * 0.18, '#1f5a20');
    fE(ctx, r * 0.46, -0.02, r * 0.48, r * 0.13, k % 2 ? '#3f9a36' : '#4fae42');
    ctx.strokeStyle = '#7ad064'; ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.moveTo(r * 0.06, 0); ctx.lineTo(r * 0.9, 0); ctx.stroke();
    ctx.restore();
  }
  fE(ctx, x, y, r * 0.2, r * 0.2, '#5a3a1c');
  for (let k = 0; k < 3; k++) fE(ctx, x + Math.cos(k * 2.1) * r * 0.12, y + Math.sin(k * 2.1) * r * 0.12, r * 0.09, r * 0.09, '#3a2410');
}
function gullTop(ctx, x, y, time) {
  const f = Math.sin(time * 9) * 0.12;
  ctx.strokeStyle = '#f4f4ee'; ctx.lineWidth = 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 0.32, y + f); ctx.lineTo(x, y - 0.06); ctx.lineTo(x + 0.32, y + f); ctx.stroke();
}

// Остров показывается, когда до него осталось меньше экрана пути.
function drawIsland(ctx, view, time) {
  const remaining = view.isl - view.di;
  if (!(remaining < 24)) return;
  const y = BOAT.y - remaining * ((BOAT.y + 1) / 24); // нижний край острова: от верха экрана до носа лодки
  const cx = WORLD_W / 2 - (view.bx || 0) * 0.15;
  const cy = y - 3.6;
  // Бирюзовое мелководье и прибой
  fE(ctx, cx, cy, 7.8, 5, 'rgba(70,200,200,0.28)');
  fE(ctx, cx, cy, 7, 4.35, 'rgba(110,230,215,0.35)');
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.1;
  ctx.setLineDash([0.45, 0.3]); ctx.lineDashOffset = -time * 0.6;
  ctx.beginPath(); ctx.ellipse(cx, cy, 6.4 + Math.sin(time * 1.6) * 0.1, 3.85 + Math.sin(time * 1.6) * 0.06, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // Песок с мокрой кромкой и песчинками
  fE(ctx, cx, cy, 6.15, 3.6, '#c9a55a');
  fE(ctx, cx, cy - 0.08, 5.9, 3.4, '#ecd08a');
  for (let i = 0; i < 30; i++) {
    const a = i * 2.39, rr = 0.4 + ((i * 37) % 10) / 10 * 0.55;
    fR(ctx, cx + Math.cos(a) * 5.6 * rr, cy + Math.sin(a) * 3.2 * rr, 0.07, 0.07, i % 2 ? '#d4b46a' : '#fff0c0');
  }
  // Зелень с кустами
  fE(ctx, cx - 0.4, cy - 0.5, 4.4, 2.5, '#2f6e30');
  fE(ctx, cx - 0.4, cy - 0.62, 4.15, 2.25, '#4c9c44');
  for (const [dx, dy, r] of [[-2.8, -0.3, 0.9], [2.4, -0.9, 1], [0.6, 0.6, 0.8], [-1, -1.5, 0.85]]) {
    fE(ctx, cx + dx, cy + dy, r, r * 0.8, '#245a26');
    fE(ctx, cx + dx - 0.12, cy + dy - 0.1, r * 0.75, r * 0.6, '#5aae4a');
  }
  // Камни на берегу
  for (const [dx, dy, r] of [[-5, 0.6, 0.45], [4.6, 1.2, 0.38], [5.2, -0.8, 0.3]]) {
    fE(ctx, cx + dx, cy + dy, r, r * 0.75, '#3a3e44');
    fE(ctx, cx + dx - 0.06, cy + dy - 0.06, r * 0.85, r * 0.6, '#8b939c');
    fE(ctx, cx + dx - 0.12, cy + dy - 0.14, r * 0.35, r * 0.2, '#b8c0c8');
  }
  // Деревянный пирс к лодке
  const px = cx + 1.6;
  fR(ctx, px - 0.62, cy + 2.6, 1.24, 2.7, '#3a2410');
  for (let k = 0; k < 7; k++) fR(ctx, px - 0.55, cy + 2.68 + k * 0.37, 1.1, 0.3, k % 2 ? '#a8763f' : '#9c6c37');
  for (const sx of [-0.66, 0.5]) for (let k = 0; k < 3; k++) fR(ctx, px + sx, cy + 2.8 + k * 1.1, 0.16, 0.22, '#2a1808');
  // Костёр, свет и дым
  const fx = cx - 1.8, fy = cy + 0.7;
  ctx.fillStyle = 'rgba(255,150,60,0.25)';
  ctx.beginPath(); ctx.arc(fx, fy, 0.9 + Math.sin(time * 12) * 0.05, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 6; k++) fE(ctx, fx + Math.cos(k * 1.05) * 0.35, fy + Math.sin(k * 1.05) * 0.25, 0.1, 0.08, '#6f7780');
  for (let k = 0; k < 5; k++) {
    const h = 0.18 + Math.abs(Math.sin(time * 11 + k * 1.7)) * 0.18;
    fR(ctx, fx - 0.2 + k * 0.09, fy - h, 0.08, h, ['#d6262f', '#ff7a1a', '#ffc93d', '#ff7a1a', '#d6262f'][k]);
  }
  for (let k = 0; k < 5; k++) {
    const f = (time * 0.35 + k / 5) % 1;
    ctx.fillStyle = `rgba(200,200,205,${0.4 * (1 - f)})`;
    ctx.beginPath(); ctx.arc(fx + Math.sin(time + k) * 0.25 + f * 0.6, fy - 0.4 - f * 2.4, 0.15 + f * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  // Пальмы
  palmTop(ctx, cx - 3, cy - 1.2, 1.6, time);
  palmTop(ctx, cx + 2.5, cy - 1.6, 1.85, time + 1);
  palmTop(ctx, cx + 0.2, cy - 2.4, 1.4, time + 2);
  // Чайки кружат над островом
  for (let i = 0; i < 3; i++) {
    const a = time * 0.6 + i * 2.1;
    gullTop(ctx, cx + Math.cos(a) * 4.2, cy - 2.2 + Math.sin(a) * 1.8, time + i);
  }
}

// Шторм за кормой: фиолетовая стена с молниями. gap — сколько блоков до неё.
function drawStorm(ctx, cam, view, time) {
  const gap = view.di - view.st;
  if (!(gap < 10)) return;
  const front = BOAT.y + BOAT.h + Math.max(-BOAT.h - 7, gap);
  const bottom = (cam.h - cam.oy) / cam.s + 1;
  const g = ctx.createLinearGradient(0, front - 1.5, 0, front + 3);
  g.addColorStop(0, 'rgba(70,20,90,0)');
  g.addColorStop(0.4, 'rgba(70,20,90,0.65)');
  g.addColorStop(1, 'rgba(30,5,45,0.9)');
  ctx.fillStyle = g;
  const x0 = -cam.ox / cam.s, x1 = (cam.w - cam.ox) / cam.s;
  ctx.fillRect(x0, front - 1.5, x1 - x0, bottom - front + 1.5);
  // Рваный край
  ctx.fillStyle = 'rgba(120,50,150,0.5)';
  for (let x = Math.floor(x0); x < x1; x += 0.5) {
    const h = 0.3 + Math.abs(Math.sin(x * 2.1 + time * 3)) * 0.6;
    ctx.fillRect(x, front - h, 0.5, h);
  }
  if (Math.sin(time * 9.3) > 0.97) {
    ctx.strokeStyle = 'rgba(255,255,220,0.9)';
    ctx.lineWidth = 0.08;
    const lx = x0 + ((Math.floor(time * 3) * 37) % 10) / 10 * (x1 - x0);
    ctx.beginPath(); ctx.moveTo(lx, front); ctx.lineTo(lx + 0.4, front + 1); ctx.lineTo(lx - 0.2, front + 1.6); ctx.lineTo(lx + 0.3, front + 3); ctx.stroke();
  }
}

// ---------- Карты: башенки, щит, полоска карт ----------
const EMOJI_FONT = 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

function drawTurret(ctx, t, time) {
  const { x, y } = t;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 0.28, y - 0.1, 0.62, 0.4);
  ctx.fillStyle = '#7d858e';
  ctx.fillRect(x - 0.3, y - 0.6, 0.6, 0.8);
  ctx.fillStyle = '#959da6';
  ctx.fillRect(x - 0.36, y - 0.72, 0.72, 0.2);
  ctx.fillStyle = '#5d646c';
  for (let i = 0; i < 3; i++) ctx.fillRect(x - 0.36 + i * 0.28, y - 0.82, 0.16, 0.12);
  // Флажок
  ctx.fillStyle = '#5a3a1c';
  ctx.fillRect(x + 0.02, y - 1.25, 0.05, 0.45);
  ctx.fillStyle = '#d23cff';
  ctx.fillRect(x + 0.07, y - 1.25 + Math.sin(time * 6) * 0.02, 0.28, 0.16);
  // Сколько ещё простоит
  ctx.strokeStyle = 'rgba(210,60,255,0.8)';
  ctx.lineWidth = 0.06;
  ctx.beginPath(); ctx.arc(x, y - 0.2, 0.5, -Math.PI / 2, -Math.PI / 2 + (t.t / t.max) * Math.PI * 2); ctx.stroke();
}

function drawShield(ctx, view, time) {
  if (!(view.shT > 0)) return;
  if (view.shT < 1.5 && Math.sin(time * 20) < 0) return; // мигает перед исчезновением
  const cx = BOAT.x + BOAT.w / 2, cy = BOAT.y + BOAT.h / 2 + 0.5;
  ctx.fillStyle = `rgba(120,210,255,${0.12 + Math.sin(time * 4) * 0.04})`;
  ctx.strokeStyle = 'rgba(170,230,255,0.8)';
  ctx.lineWidth = 0.1;
  ctx.beginPath(); ctx.ellipse(cx, cy, BOAT.w / 2 + 0.9, BOAT.h / 2 + 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

// Где на экране лежат эликсир и карты (нужно и для отрисовки, и для попадания пальцем).
export function cardLayout(cam) {
  const W = cam.w, pad = 14, gap = 8;
  const top = cam.h - cam.bottom;
  const nextW = 42;
  const cardH = Math.max(46, cam.bottom - 52);
  const cardW = Math.min(76, (W - 2 * pad - nextW - gap * 4) / 4);
  const total = cardW * 4 + gap * 4 + nextW;
  const x0 = (W - total) / 2;
  const cards = [];
  for (let i = 0; i < 4; i++) cards.push({ x: x0 + i * (cardW + gap), y: top + 30, w: cardW, h: cardH });
  return {
    elixir: { x: x0 + 18, y: top + 10, w: total - 18, h: 13 }, // слева место под цифру
    cards,
    next: { x: x0 + 4 * (cardW + gap), y: top + 30 + cardH * 0.35, w: nextW, h: cardH * 0.65 },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCardFace(ctx, rect, id, lvl, el, pressed) {
  const card = CARDS[id];
  if (!card) return;
  const ok = el >= card.cost;
  const k = pressed ? 0.94 : 1;
  const w = rect.w * k, h = rect.h * k;
  const x = rect.x + (rect.w - w) / 2, y = rect.y + (rect.h - h) / 2;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = ok ? '#5b3a1e' : '#2e1f12';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ok ? '#ffe14d' : '#7a5230';
  ctx.stroke();
  // Иконка
  ctx.globalAlpha = ok ? 1 : 0.45;
  ctx.font = `${Math.round(Math.min(w, h) * 0.46)}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(card.icon, x + w / 2, y + h * 0.47);
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;
  // Пока копится эликсир — заливка снизу
  if (!ok) {
    ctx.fillStyle = 'rgba(210,60,255,0.25)';
    const f = Math.min(1, el / card.cost);
    ctx.fillRect(x + 2, y + h - 2 - (h - 4) * f, w - 4, (h - 4) * f);
  }
  // Цена — капля эликсира
  ctx.fillStyle = '#d23cff';
  ctx.beginPath(); ctx.arc(x + 11, y + 11, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1e1207'; ctx.lineWidth = 2; ctx.stroke();
  outlined(ctx, String(card.cost), x + 11, y + 16, 11, '#ffffff');
  // Уровень
  outlined(ctx, '★'.repeat(lvl), x + w / 2, y + h - 6, 9, '#ffe14d');
}

function drawCardBar(ctx, cam, view, hud) {
  if (!view.hand) return;
  const L = cardLayout(cam);
  const el = view.el || 0;
  // Эликсир: 10 делений
  const seg = (L.elixir.w - 9 * 3) / 10;
  for (let i = 0; i < 10; i++) {
    const sx = L.elixir.x + i * (seg + 3);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(sx - 1, L.elixir.y - 1, seg + 2, L.elixir.h + 2);
    ctx.fillStyle = '#3a1d45';
    ctx.fillRect(sx, L.elixir.y, seg, L.elixir.h);
    const f = Math.max(0, Math.min(1, el - i));
    ctx.fillStyle = f >= 1 ? '#d23cff' : '#9b2bc0';
    ctx.fillRect(sx, L.elixir.y, seg * f, L.elixir.h);
  }
  outlined(ctx, String(Math.floor(el)), L.elixir.x - 10, L.elixir.y + 12, 11, '#f0b8ff');

  view.hand.forEach(([id, lvl], i) => drawCardFace(ctx, L.cards[i], id, lvl, el, hud.pressed === i));
  if (view.nx) {
    const r = L.next;
    roundRect(ctx, r.x, r.y, r.w, r.h, 5);
    ctx.fillStyle = '#2e1f12'; ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.font = `${Math.round(r.w * 0.5)}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(CARDS[view.nx].icon, r.x + r.w / 2, r.y + r.h / 2 + 2);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
    outlined(ctx, 'ДАЛЕЕ', r.x + r.w / 2, r.y - 4, 7, '#e8d3b0');
  }
}

// ---------- Боссы, рейдеры, нитро ----------
const BOSS_NAMES = { serpent: 'МИРОВОЙ ЗМЕЙ', giant: 'КОЛОСС', raider: 'КАТЕР РЕЙДЕРОВ' };

// Мировой змей (вид сверху): кольца из воды с пеной, рогатая голова смотрит на лодку, глаза светятся.
const SERP_TOP = { ol: '#0e1a1e', sc: '#3d6268', sc2: '#47717a', li: '#79a3a4', dk: '#22383c', bo: '#e6dbbb', boD: '#a89c7c' };
function spikeTop(ctx, x, y, C) {
  ctx.fillStyle = C.ol;
  fPath(ctx, [[x - 0.13, y + 0.06], [x, y - 0.26], [x + 0.13, y + 0.06]]); ctx.fill();
  ctx.fillStyle = C.bo;
  fPath(ctx, [[x - 0.08, y + 0.03], [x, y - 0.19], [x + 0.08, y + 0.03]]); ctx.fill();
}

function drawSerpent(ctx, e, time) {
  const { x, y } = e;
  const C = SERP_TOP;
  const side = x < WORLD_W / 2 ? -1 : 1; // тело уходит от лодки
  if (e.under) {
    // Под водой: длинная тень, рябь и пузыри
    for (let i = 0; i < 5; i++) fE(ctx, x + side * i * 0.8, y + Math.sin(time * 2 + i) * 0.25, 0.95 - i * 0.08, 0.58 - i * 0.05, 'rgba(4,24,40,0.45)');
    ctx.strokeStyle = 'rgba(200,235,255,0.5)'; ctx.lineWidth = 0.05;
    for (let k = 0; k < 2; k++) {
      const f = (time * 0.9 + k * 0.5) % 1;
      ctx.globalAlpha = 1 - f;
      ctx.beginPath(); ctx.ellipse(x, y, 0.6 + f * 1.3, (0.6 + f * 1.3) * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) { const f = (time * 1.4 + i / 6) % 1; fR(ctx, x + Math.sin(i * 2.3) * 0.7, y - f * 0.7, 0.08, 0.08, '#d8f0ff'); }
    return;
  }
  const flash = e.flash < 0.12;
  // Кольца тела (от дальних к ближним)
  for (let i = 3; i >= 1; i--) {
    const hx = x + side * (0.35 + i * 0.95), hy = y + 0.35 + i * 0.3 + Math.sin(time * 3 + i) * 0.1;
    const base = flash ? '#ffffff' : i % 2 ? C.sc : C.sc2;
    ctx.strokeStyle = 'rgba(220,240,255,0.5)'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.ellipse(hx, hy + 0.26, 0.74 + Math.sin(time * 4 + i) * 0.05, 0.25, 0, 0, Math.PI * 2); ctx.stroke();
    fE(ctx, hx, hy, 0.57, 0.45, C.ol);
    fE(ctx, hx, hy - 0.02, 0.5, 0.38, base);
    fE(ctx, hx + 0.16, hy + 0.06, 0.3, 0.26, C.dk);
    fE(ctx, hx + 0.06, hy, 0.33, 0.28, base);
    fE(ctx, hx - 0.18, hy - 0.16, 0.2, 0.09, C.li);
    for (let k = 0; k < 6; k++) fR(ctx, hx - 0.3 + (k % 3) * 0.25 + (k > 2 ? 0.12 : 0), hy - 0.1 + (k > 2 ? 0.15 : 0), 0.07, 0.05, C.dk);
    for (let k = -1; k <= 1; k++) spikeTop(ctx, hx + k * 0.26, hy - 0.4 + Math.abs(k) * 0.08, C);
    ctx.fillStyle = 'rgba(240,250,255,0.85)';
    for (let k = 0; k < 6; k++) ctx.fillRect(hx - 0.55 + k * 0.2, hy + 0.33 + Math.sin(time * 6 + k) * 0.03, 0.12, 0.06);
  }
  // Шея
  for (let k = 3; k >= 0; k--) {
    const nx = x + side * k * 0.2, ny = y + 0.3 + k * 0.05;
    fE(ctx, nx, ny, 0.5, 0.42, C.ol);
    fE(ctx, nx, ny - 0.02, 0.44, 0.36, flash ? '#ffffff' : C.sc);
  }
  // Голова повёрнута к лодке (в локальных координатах +y — вперёд)
  const ang = Math.atan2(BOAT.y + BOAT.h / 2 - y, BOAT.x + BOAT.w / 2 - x) - Math.PI / 2;
  const open = e.throwT < 0.45;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    for (const [col, w] of [[C.ol, 0.28], [C.bo, 0.17]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(s * 0.35, -0.3); ctx.quadraticCurveTo(s * 1.0, -0.7, s * 0.72, -1.3); ctx.stroke();
    }
    ctx.strokeStyle = C.boD; ctx.lineWidth = 0.05;
    for (const k of [0.35, 0.6]) { ctx.beginPath(); ctx.moveTo(s * (0.45 + k * 0.4), -0.4 - k * 0.6); ctx.lineTo(s * (0.6 + k * 0.4), -0.35 - k * 0.6); ctx.stroke(); }
  }
  if (open) { // нижняя челюсть видна, когда пасть раскрыта
    fRR(ctx, -0.38, 0.42, 0.76, 0.68, 0.16, C.ol);
    fRR(ctx, -0.32, 0.47, 0.64, 0.58, 0.14, '#2c4a4f');
    fRR(ctx, -0.25, 0.5, 0.5, 0.4, 0.1, '#5a0f18');
    fR(ctx, -0.1, 0.7, 0.2, 0.18, '#9dff3d');
    for (let k = 0; k < 4; k++) fR(ctx, -0.22 + k * 0.14, 0.98, 0.05, 0.08, '#f4efe0');
  }
  fRR(ctx, -0.62, -0.55, 1.24, 1.0, 0.25, C.ol);
  fRR(ctx, -0.56, -0.5, 1.12, 0.9, 0.22, flash ? '#ffffff' : C.sc);
  const sy = open ? 0.12 : 0.24;
  fRR(ctx, -0.43, sy, 0.86, 0.74, 0.2, C.ol);
  fRR(ctx, -0.37, sy + 0.04, 0.74, 0.64, 0.17, flash ? '#ffffff' : C.sc2);
  fR(ctx, -0.07, -0.42, 0.14, 1.1, C.li);
  fR(ctx, -0.5, -0.13, 0.32, 0.12, C.dk);
  fR(ctx, 0.18, -0.13, 0.32, 0.12, C.dk);
  fR(ctx, -0.18, sy + 0.56, 0.08, 0.06, '#120808');
  fR(ctx, 0.1, sy + 0.56, 0.08, 0.06, '#120808');
  for (const s of [-1, 1]) {
    fE(ctx, s * 0.42, 0.03, 0.25, 0.25, 'rgba(255,160,40,0.35)');
    fR(ctx, s * 0.42 - 0.11, -0.04, 0.22, 0.14, '#ffb32b');
    fR(ctx, s * 0.42 - 0.02, -0.04, 0.04, 0.14, '#1a0800');
    ctx.fillStyle = C.bo;
    for (let k = 0; k < 3; k++) { fPath(ctx, [[s * 0.4, 0.28 + k * 0.2], [s * 0.64, 0.34 + k * 0.2], [s * 0.4, 0.4 + k * 0.2]]); ctx.fill(); }
  }
  ctx.restore();
  if (e.frozen) frost(ctx, x, y, 0.85);
}

// Колосс (вид сверху): по пояс в воде, мышцы с волокнами, оскал; при броске поднимает валун над головой.
function drawGiant(ctx, e, time) {
  const { x, y } = e;
  const flash = e.flash < 0.12;
  const C = { ol: '#2a0604', m: flash ? '#ffffff' : '#b23a2e', m2: flash ? '#ffffff' : '#c64a3c', l: '#e57a62', d: '#7a2018', x: '#4a0e0a', tooth: '#f4ecd8', hair: '#120c0c', eye: '#efe0a8' };
  const throwing = e.throwT < 0.6;
  // Волны вокруг пояса
  ctx.strokeStyle = 'rgba(230,245,255,0.55)'; ctx.lineWidth = 0.07;
  for (let k = 0; k < 2; k++) {
    const f = (time * 0.6 + k * 0.5) % 1;
    ctx.globalAlpha = 1 - f;
    ctx.beginPath(); ctx.ellipse(x, y + 0.65, 1.6 + f * 0.9, 0.5 + f * 0.25, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Руки
  const armY = throwing ? -2.0 : -0.95, armH = throwing ? 1.75 : 1.5;
  for (const s of [-1, 1]) {
    fRR(ctx, x + s * 1.2 - 0.3, y + armY - 0.05, 0.6, armH + 0.1, 0.18, C.ol);
    fRR(ctx, x + s * 1.2 - 0.24, y + armY, 0.48, armH, 0.15, C.m);
    for (let k = 0; k < 3; k++) fR(ctx, x + s * 1.2 - 0.14 + k * 0.12, y + armY + 0.12, 0.035, armH - 0.3, k % 2 ? C.d : C.l);
  }
  if (throwing) {
    fE(ctx, x, y - 2.95, 0.66, 0.5, '#2a2e34');
    fE(ctx, x, y - 3.0, 0.6, 0.44, '#7d858e');
    fE(ctx, x - 0.18, y - 3.14, 0.26, 0.14, '#a8b0b8');
    fR(ctx, x + 0.15, y - 2.9, 0.18, 0.06, '#5d646c');
  }
  // Туловище-трапеция с обводкой
  const torso = [[x - 1.08, y - 1.38], [x + 1.08, y - 1.38], [x + 0.8, y + 0.72], [x - 0.8, y + 0.72]];
  fPath(ctx, torso); ctx.strokeStyle = C.ol; ctx.lineWidth = 0.14; ctx.stroke(); ctx.fillStyle = C.m; ctx.fill();
  fE(ctx, x - 0.42, y - 0.98, 0.42, 0.3, C.m2);
  fE(ctx, x + 0.42, y - 0.98, 0.42, 0.3, C.m2);
  fR(ctx, x - 0.75, y - 1.25, 0.6, 0.06, C.l);
  fR(ctx, x + 0.15, y - 1.25, 0.6, 0.06, C.l);
  fR(ctx, x - 0.03, y - 1.25, 0.06, 1.9, C.d);
  for (let r = 0; r < 3; r++) for (const sx of [-0.4, 0.06]) {
    fR(ctx, x + sx, y - 0.58 + r * 0.38, 0.34, 0.3, C.m2);
    fR(ctx, x + sx, y - 0.58 + r * 0.38, 0.34, 0.05, C.l);
  }
  for (const s of [-1, 1]) for (let r = 0; r < 3; r++) fR(ctx, x + s * 0.72 - (s > 0 ? 0.2 : 0), y - 0.55 + r * 0.3, 0.2, 0.05, C.d);
  // Голова-череп с оскалом
  fRR(ctx, x - 0.6, y - 2.32, 1.2, 1.12, 0.3, C.ol);
  fRR(ctx, x - 0.54, y - 2.26, 1.08, 1.0, 0.26, C.m2);
  for (let i = 0; i < 5; i++) fR(ctx, x - 0.46 + i * 0.22, y - 2.42 - (i % 2) * 0.06, 0.08, 0.16, C.hair);
  fR(ctx, x - 0.5, y - 2.02, 1.0, 0.1, C.d);
  fR(ctx, x - 0.4, y - 1.92, 0.26, 0.18, C.x);
  fR(ctx, x + 0.14, y - 1.92, 0.26, 0.18, C.x);
  fR(ctx, x - 0.33, y - 1.86, 0.1, 0.06, C.eye);
  fR(ctx, x + 0.21, y - 1.86, 0.1, 0.06, C.eye);
  fR(ctx, x - 0.06, y - 1.7, 0.12, 0.1, C.x);
  fR(ctx, x - 0.44, y - 1.56, 0.88, 0.3, C.x);
  for (let i = 0; i < 6; i++) {
    fR(ctx, x - 0.42 + i * 0.145, y - 1.55, 0.11, 0.12, C.tooth);
    fR(ctx, x - 0.42 + i * 0.145, y - 1.4, 0.11, 0.12, C.tooth);
  }
  // Вода по пояс и пена
  fR(ctx, x - 1.3, y + 0.4, 2.6, 0.5, 'rgba(20,80,130,0.55)');
  ctx.fillStyle = 'rgba(240,250,255,0.85)';
  for (let k = 0; k < 8; k++) ctx.fillRect(x - 1.1 + k * 0.28, y + 0.38 + Math.sin(time * 5 + k) * 0.04, 0.16, 0.06);
  // Пар клубится вокруг
  for (let i = 0; i < 9; i++) {
    const f = (time * 0.7 + i / 9) % 1;
    ctx.fillStyle = `rgba(235,235,235,${0.35 * (1 - f)})`;
    ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.3) * 1.3, y - 1.1 - f * 1.9, 0.18 + f * 0.48, 0, Math.PI * 2); ctx.fill();
  }
  if (e.frozen) frost(ctx, x, y - 1, 1.3);
}

// Катер рейдеров (вид сверху): нос к лодке, лобовое стекло, мотор с брызгами, флаг с черепом.
function drawRaider(ctx, e, time) {
  const { x, y } = e;
  const flash = e.flash < 0.12;
  ctx.fillStyle = 'rgba(230,245,255,0.55)';
  for (let i = 0; i < 9; i++) {
    const yy = y - 1.25 - i * 0.32, sp = 0.25 + i * 0.09;
    ctx.fillRect(x - sp + Math.sin(time * 9 + i) * 0.05, yy, 0.16, 0.1);
    ctx.fillRect(x + sp - 0.16 + Math.sin(time * 9 + i + 1) * 0.05, yy, 0.16, 0.1);
  }
  const hull = [[x - 0.85, y - 1.05], [x + 0.85, y - 1.05], [x + 0.85, y + 0.35], [x, y + 1.3], [x - 0.85, y + 0.35]];
  fPath(ctx, hull); ctx.strokeStyle = '#08090b'; ctx.lineWidth = 0.14; ctx.stroke();
  ctx.fillStyle = flash ? '#ffffff' : '#2b2f36'; ctx.fill();
  fPath(ctx, [[x - 0.68, y - 0.9], [x + 0.68, y - 0.9], [x + 0.68, y + 0.3], [x, y + 1.08], [x - 0.68, y + 0.3]]);
  ctx.fillStyle = flash ? '#ffffff' : '#3a3f48'; ctx.fill();
  ctx.strokeStyle = '#d6262f'; ctx.lineWidth = 0.08;
  ctx.beginPath(); ctx.moveTo(x - 0.78, y - 0.95); ctx.lineTo(x - 0.78, y + 0.33); ctx.lineTo(x, y + 1.18); ctx.lineTo(x + 0.78, y + 0.33); ctx.lineTo(x + 0.78, y - 0.95); ctx.stroke();
  fPath(ctx, [[x - 0.6, y + 0.12], [x + 0.6, y + 0.12], [x + 0.36, y + 0.46], [x - 0.36, y + 0.46]]);
  ctx.fillStyle = 'rgba(160,220,255,0.8)'; ctx.fill();
  fR(ctx, x - 0.34, y - 1.36, 0.68, 0.38, '#111216');
  fR(ctx, x - 0.34, y - 1.36, 0.68, 0.08, '#3a3e46');
  fR(ctx, x - 0.34, y - 1.18, 0.68, 0.06, '#d6262f');
  for (let i = 0; i < 4; i++) { const f = (time * 4 + i / 4) % 1; fR(ctx, x - 0.2 + i * 0.12, y - 1.45 - f * 0.4, 0.08, 0.08, `rgba(255,255,255,${1 - f})`); }
  for (const [rx, ry] of [[x - 0.32, y - 0.38], [x + 0.3, y - 0.12]]) {
    fE(ctx, rx, ry, 0.28, 0.28, '#0c0c0e');
    fE(ctx, rx, ry, 0.23, 0.23, '#3a3f4a');
    fE(ctx, rx, ry - 0.02, 0.15, 0.15, '#151515');
    fR(ctx, rx - 0.23, ry + 0.02, 0.46, 0.08, '#c0202a');
  }
  if (e.throwT < 0.3) {
    fR(ctx, x + 0.42, y - 0.52, 0.12, 0.38, '#3a3f4a');
    fR(ctx, x + 0.42, y - 0.68, 0.1, 0.18, '#3f7f3a');
    fR(ctx, x + 0.42, y - 0.8, 0.1, 0.12, Math.sin(time * 30) > 0 ? '#ffe14d' : '#ff7a1a');
  }
  fR(ctx, x + 0.62, y - 1.3, 0.05, 0.45, '#a8b0b8');
  const wv = Math.sin(time * 8) * 0.04;
  fR(ctx, x + 0.67, y - 1.3 + wv, 0.42, 0.26, '#141414');
  fR(ctx, x + 0.82, y - 1.24 + wv, 0.12, 0.1, '#f0f0f0');
  if (e.frozen) frost(ctx, x, y, 1);
}

function drawBossMarks(ctx, view, time) {
  for (const [col, row, t, max] of view.BM || []) {
    const x = BOAT.x + col, y = BOAT.y + row;
    const k = 1 - t / max;
    ctx.fillStyle = `rgba(255,40,40,${0.25 + 0.25 * Math.abs(Math.sin(time * 10))})`;
    ctx.fillRect(x + 0.05, y + 0.05, 0.9, 0.9);
    ctx.fillStyle = 'rgba(255,40,40,0.6)';
    ctx.fillRect(x + 0.05, y + 0.95 - 0.9 * k, 0.9, 0.9 * k);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 0.45, y + 0.2, 0.1, 0.38);
    ctx.fillRect(x + 0.45, y + 0.68, 0.1, 0.1);
  }
}

function drawNitroFlames(ctx, view, time) {
  if (!(view.nT > 0)) return;
  // Пламя из-за кормы и полосы скорости по воде
  for (let i = 0; i < 10; i++) {
    const f = (time * 6 + i * 0.37) % 1;
    const x = BOAT.x + 1.2 + (i % 5) * 0.9;
    const y = BOAT.y + BOAT.h + f * 2.2;
    ctx.fillStyle = f < 0.4 ? '#9fe8ff' : f < 0.7 ? '#ffb13d' : 'rgba(255,90,40,0.6)';
    const r = 0.22 * (1 - f) + 0.05;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.05;
  for (let i = 0; i < 8; i++) {
    const x = (i * 1.7 + 0.5) % WORLD_W;
    const y = (time * 25 + i * 3.1) % (WORLD_H + 4) - 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 1.6); ctx.stroke();
  }
}

// Кнопка нитро справа над картами
export function nitroButton(cam) {
  return { x: cam.w - 42, y: cam.h - cam.bottom - 46, r: 28 };
}

function drawNitroButton(ctx, cam, view, time, myKey) {
  if (!(view.ni > 0 || view.nT > 0)) return;
  const b = nitroButton(cam);
  const active = view.nT > 0;
  const waiting = (view.nr || []).length > 0;
  const iPressed = (view.nr || []).includes(myKey);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.arc(b.x + 2, b.y + 3, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = active ? '#ffb13d' : iPressed ? '#5fd6ff' : '#2f6fd6';
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = waiting && Math.sin(time * 14) > 0 ? '#ffffff' : '#1e1207';
  ctx.stroke();
  outlined(ctx, 'N₂O', b.x, b.y + 4, 11, '#ffffff');
  outlined(ctx, '×' + (view.ni || 0), b.x + b.r - 4, b.y - b.r + 8, 10, '#ffe14d');
  if (waiting && !active) {
    const text = iPressed ? 'ЖДЁМ НАПАРНИКА!' : 'НАПАРНИК ЖМЁТ N₂O!';
    outlined(ctx, text, b.x - b.r - 6, b.y + 4, 9, '#9fe8ff', 'right');
  }
}

function drawBossBar(ctx, cam, view) {
  if (!view.bs) return;
  const [kind, hp, max] = view.bs;
  const w = Math.min(260, cam.w - 60), x = (cam.w - w) / 2;
  const y = cam.oy + 26;
  outlined(ctx, BOSS_NAMES[kind] || 'БОСС', cam.w / 2, y - 6, 10, '#ff9a7a');
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 2, y - 2, w + 4, 12);
  ctx.fillStyle = '#4a1010';
  ctx.fillRect(x, y, w, 8);
  ctx.fillStyle = '#ff3d5a';
  ctx.fillRect(x, y, w * Math.max(0, hp / max), 8);
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
  ctx.fillStyle = p.skin === 'rainbow' ? `hsl(${(performance.now() / 5) % 360},90%,55%)` : p.skin || '#d6262f';
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
  if (e.kind === 'serpent') return drawSerpent(ctx, e, time);
  if (e.kind === 'giant') return drawGiant(ctx, e, time);
  if (e.kind === 'raider') return drawRaider(ctx, e, time);
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

  if (e.frozen) {
    ctx.fillStyle = 'rgba(170,230,255,0.55)';
    ctx.fillRect(x - sz / 2 - 0.06, y - sz / 2 - 0.06, sz + 0.12, sz + 0.12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 0.04, y - sz / 2 - 0.25, 0.08, 0.2);
    ctx.fillRect(x - 0.1, y - sz / 2 - 0.19, 0.2, 0.08);
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
    if (sh.kind === 'boulder') {
      ctx.fillStyle = '#6f7780';
      ctx.fillRect(bx - 0.32, by - 0.3, 0.64, 0.6);
      ctx.fillStyle = '#959da6';
      ctx.fillRect(bx - 0.32, by - 0.3, 0.3, 0.2);
    } else if (sh.kind === 'molotov') {
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(bx - 0.08, by - 0.18, 0.16, 0.32);
      ctx.fillStyle = Math.sin(time * 30) > 0 ? '#ffe14d' : '#ff6a2a';
      ctx.fillRect(bx - 0.07, by - 0.32, 0.14, 0.14);
    } else if (sh.kind === 'brute') {
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

  if (sh.owner === 't') {
    if (sh.kind === 'bomb') {
      ctx.fillStyle = '#1b1b22';
      ctx.beginPath(); ctx.arc(bx, by, 0.26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a3a1c';
      ctx.fillRect(bx + 0.05, by - 0.38, 0.06, 0.14);
      ctx.fillStyle = Math.sin(time * 30) > 0 ? '#ffe14d' : '#ff9a3d';
      ctx.fillRect(bx + 0.03, by - 0.46, 0.1, 0.1);
    } else {
      ctx.fillStyle = '#d23cff';
      ctx.beginPath(); ctx.arc(bx, by, 0.1, 0, Math.PI * 2); ctx.fill();
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
    } else if (p.k === 'bolt') {
      ctx.strokeStyle = '#fffbd0';
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.moveTo(p.x + 0.8, p.y - 9);
      ctx.lineTo(p.x - 0.4, p.y - 5);
      ctx.lineTo(p.x + 0.5, p.y - 3.5);
      ctx.lineTo(p.x - 0.2, p.y);
      ctx.stroke();
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

  // Путь до острова: лодка и шторм на одной полосе
  const py = by + 22;
  const isl = view.isl || 1;
  const pos = (d) => bx + Math.max(0, Math.min(1, d / isl)) * barW;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx - 2, py - 2, barW + 4, 10);
  ctx.fillStyle = '#1d4f7a';
  ctx.fillRect(bx, py, barW, 6);
  ctx.fillStyle = '#e6c879';
  ctx.fillRect(bx, py, pos(view.di) - bx, 6);
  ctx.fillStyle = '#58b04a';
  ctx.fillRect(bx + barW - 6, py - 3, 8, 12); // остров
  if (view.st > 0) {
    ctx.fillStyle = '#9b4dca';
    ctx.fillRect(bx, py, pos(view.st) - bx, 6);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pos(view.di) - 3, py - 4, 6, 14); // лодка

  // Доски и пробоины
  const holes = (view.H || []).length;
  const iy = by + 46;
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
  if (pass) outlined(ctx, 'РОЗЫГРЫШ ×' + pass[3], W / 2, by + 66, sz * 0.75, CHARGE_COLORS[Math.min(pass[3], 5)]);

  // Сколько до шторма
  const gap = view.di - view.st;
  if (gap < 15) {
    const inside = gap < 0;
    const blinkS = (inside || gap < 5) && Math.sin(performance.now() / 110) > 0;
    const label = inside ? 'В ШТОРМЕ! ВЫЧЕРПЫВАЙТЕ!' : `ШТОРМ ЗА КОРМОЙ: ${Math.ceil(gap)}`;
    outlined(ctx, label, W / 2, Math.min(cam.oy + WORLD_H * cam.s, cam.h - cam.bottom) - 8, Math.max(8, sz * 0.65), blinkS ? '#ffffff' : '#d39bff');
  }

  if (view.ban) {
    const pulse = 1 + Math.sin(performance.now() / 120) * 0.03;
    outlined(ctx, view.ban, W / 2, cam.oy + WORLD_H * cam.s * 0.38, sz * 1.6 * pulse, '#ffffff');
  }

  // Нижняя строка: комната и пинг
  if (hud.status) {
    ctx.globalAlpha = 0.75;
    outlined(ctx, hud.status, W / 2, cam.h - 5, Math.max(7, sz * 0.5), '#d7f0ff');
    ctx.globalAlpha = 1;
  }

  if (hud.hint > 0) {
    ctx.globalAlpha = Math.min(1, hud.hint);
    const hy = cam.h - cam.bottom;
    outlined(ctx, '◀ БЕГ', W * 0.25, hy - 34, sz * 0.8, '#ffffff');
    outlined(ctx, 'УДАР ▶', W * 0.75, hy - 34, sz * 0.8, '#ffffff');
    outlined(ctx, 'удар: свайп — прицел, тап — авто', W / 2, hy - 16, Math.max(7, Math.min(sz * 0.55, W / 40)), '#d7f0ff');
    ctx.globalAlpha = 1;
  }

  drawCardBar(ctx, cam, view, hud);
  drawBossBar(ctx, cam, view);
  drawNitroButton(ctx, cam, view, performance.now() / 1000, hud.myKey);

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
  if (view.cut) {
    const P = view.P || {};
    drawCutscene(ctx, cam, view.cut[0], view.cut[1] + age, {
      duo: !!P.g, skins: { h: P.h?.[10], g: P.g?.[10] }, skip: hud.skip || 0,
    });
    return;
  }
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  drawWater(ctx, cam, time, view);

  const sh = fx.shake * cam.s * 0.5;
  const shx = sh ? (Math.random() - 0.5) * sh : 0, shy = sh ? (Math.random() - 0.5) * sh : 0;
  const k = cam.dpr;
  ctx.setTransform(cam.s * k, 0, 0, cam.s * k, (cam.ox + shx) * k, (cam.oy + shy) * k);

  drawIsland(ctx, view, time);
  for (const w of view.WP || []) {
    const p = smoothed('w' + w[0], w[1], w[2], dt);
    drawWhirl(ctx, { x: p.x, y: p.y, r: w[3] }, time);
  }
  for (const r of view.R || []) {
    const p = smoothed('r' + r[0], r[1], r[2], dt);
    drawRock(ctx, { id: r[0], x: p.x, y: p.y, r: r[3] }, time);
  }
  drawNitroFlames(ctx, view, time);
  drawBoat(ctx, view, time);
  drawBossMarks(ctx, view, time);
  if (view.ph !== 'menu') drawHelm(ctx, view, !!view.hm);
  for (const t of view.T || []) drawTurret(ctx, { x: t[1], y: t[2], t: t[3], max: t[4] }, time);
  for (const d of view.D || []) {
    const p = smoothed('d' + d[0], d[1], d[2], dt);
    drawDebris(ctx, { id: d[0], x: p.x, y: p.y, nitro: d[3] }, time);
  }

  for (const o of smooth.values()) o.seen = false;
  for (const e of view.E) {
    const [id, kind, x, y, hp, maxHp, flash, throwT, under] = e;
    const p = smoothed('e' + id, x, y, dt);
    drawEnemy(ctx, { id, kind, x: p.x, y: p.y, hp, maxHp, flash: flash + age, throwT: throwT + age, frozen: view.frT > 0, under }, time);
  }

  for (const key of ['h', 'g']) {
    const arr = view.P[key];
    if (!arr) continue;
    let p;
    if (me && key === me.key) p = { ...me, repair: arr[7], bail: arr[8] };
    else {
      const sp = smoothed('p' + key, arr[0], arr[1], dt);
      p = { x: sp.x, y: sp.y, fx: arr[2], fy: arr[3], swingAge: arr[4] + age, sdx: arr[5], sdy: arr[6], repair: arr[7], bail: arr[8], skin: arr[10] };
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

  if (me && me.atHelm) worldText(ctx, cam, '◀ РУЛЬ ▶   ▼ отойти', HELM.x, HELM.y - 0.85, 0.22, '#ffe14d');

  drawShield(ctx, view, time);
  drawStorm(ctx, cam, view, time);
  drawFx(ctx, cam, fx);
  for (const [id, o] of smooth) if (!o.seen) smooth.delete(id);

  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  // В шторме экран темнеет, молния даёт вспышку
  if (view.ph !== 'menu' && view.di - view.st < 0) {
    ctx.fillStyle = 'rgba(40,10,60,0.3)';
    ctx.fillRect(0, 0, cam.w, cam.h);
  }
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,255,230,${fx.flash * 0.45})`;
    ctx.fillRect(0, 0, cam.w, cam.h);
  }
  if (view.ph !== 'menu') drawHud(ctx, cam, view, hud, joy);
}
