// Персонажи и лодки для кат-сцен (вид сбоку, пиксель-арт с обводкой).
import { TEAM_COLORS } from '../const.js';
import { PX, R, P, sprite, spans, shade, hash, lerp, clamp01 } from './gfx.js';

export const OL = '#120c14';
const HAIR = { h: ['#4a2f1b', '#70482a'], g: ['#1f1f2b', '#3b3b55'] };
export const RAIDER = {
  shirt: '#3a3f4a', shirtL: '#5a606e', shirtD: '#23262e', hair: '#151515', hairL: '#2e2e2e',
  skin: '#c9946e', skinD: '#a8764f', pants: '#22252c', pantsD: '#16181c', shoe: '#0e0e10',
};

export function racketColor(S, key) {
  const sk = S.o.skins?.[key];
  if (sk === 'rainbow') return `hsl(${Math.round((S.t * 120) % 360)},90%,55%)`;
  return sk || '#d6262f';
}

function playerPal(key) {
  const team = TEAM_COLORS[key] || '#ff8a3d';
  const [hair, hairL] = HAIR[key] || HAIR.h;
  return {
    shirt: team, shirtL: shade(team, 0.3), shirtD: shade(team, -0.32), hair, hairL,
    skin: '#f0c49a', skinD: '#cf9a70', pants: '#3b3d52', pantsD: '#272838', shoe: '#2a1a10',
  };
}

// Предмет в руке; (hx, hy) — кисть в пикселях спрайта.
function itemParts(a, item, hx, hy, up, out) {
  if (!item || !item.kind) return;
  const { kind, col } = item;
  if (kind === 'racket') {
    if (up) {
      a(hx, hy - 3, 1, 3, '#8a5a2b');
      a(hx - 1, hy - 9, 3, 1, col); a(hx - 2, hy - 8, 5, 3, col); a(hx - 1, hy - 5, 3, 1, col);
      a(hx - 1, hy - 8, 1, 1, '#ffffff');
    } else {
      a(hx + 2, hy + 1, 2, 1, '#8a5a2b');
      a(hx + 5, hy - 2, 3, 1, col); a(hx + 4, hy - 1, 5, 3, col); a(hx + 5, hy + 2, 3, 1, col);
      a(hx + 5, hy - 1, 1, 1, '#ffffff');
    }
  } else if (kind === 'popcorn') {
    a(hx, hy - 1, 4, 5, '#f2f2ee'); a(hx, hy - 1, 1, 5, '#d6262f'); a(hx + 2, hy - 1, 1, 5, '#d6262f');
    a(hx, hy - 3, 4, 2, '#fff2b0'); a(hx + 1, hy - 4, 2, 1, '#fff6c8'); a(hx + 3, hy - 3, 1, 1, '#f0d070');
  } else if (kind === 'cup') {
    a(hx, hy - 1, 3, 4, '#d6262f'); a(hx, hy, 3, 1, '#ffffff'); a(hx, hy - 2, 3, 1, '#ffffff'); a(hx + 2, hy - 5, 1, 3, '#ffe14d');
  } else if (kind === 'molotov') {
    a(hx, hy - 5, 2, 4, '#3f7f3a'); a(hx, hy - 5, 1, 4, '#5aa050'); a(hx, hy - 7, 1, 2, '#3f7f3a'); a(hx, hy - 8, 1, 1, '#d8c8a0');
    out.flame = [hx + 0.5, hy - 9];
  }
}

// Человечек из пиксельных частей (лицом вправо). Ноги в (0,0), сидя — бёдра в (0,0).
// pose: stand | walk | sit | jump | cheer | alarm | point | wave
export function humanParts(t, pal, pose, phase, opt = {}) {
  const out = [];
  const a = (x, y, w, h, col) => out.push([x, y, w, h, col]);
  const sit = pose === 'sit';
  const walk = pose === 'walk' ? Math.sin(t * 11 + phase) : 0;
  const lw = Math.round(walk * 2);
  const bob = pose === 'walk' && Math.abs(walk) > 0.7 ? -1 : 0;
  const up = pose === 'cheer' || pose === 'jump' || pose === 'alarm';
  const ty = (sit ? -9 : -14) + bob, hy = ty - 8;
  const { shirt, shirtL, shirtD, hair, hairL, skin, skinD, pants, pantsD, shoe } = pal;
  // задняя рука
  if (pose === 'cheer' || pose === 'jump') { a(-6, ty - 7, 2, 8, shirtD); a(-6, ty - 9, 2, 2, skinD); }
  else if (sit) { a(-4, ty + 1, 2, 5, shirtD); a(-3, ty + 6, 2, 2, skinD); }
  else { a(-5 - lw, ty + 1, 2, 5, shirtD); a(-5 - lw, ty + 6, 2, 2, skinD); }
  // ноги
  if (sit) { a(-2, -1, 8, 2, pants); a(-2, 0, 8, 1, pantsD); a(5, 1, 3, 5, pants); a(5, 5, 4, 2, shoe); }
  else if (pose === 'jump') { a(-3, -6, 3, 3, pantsD); a(-4, -3, 4, 1, shoe); a(0, -7, 3, 3, pants); a(0, -4, 4, 1, shoe); }
  else { a(-3 - lw, -6, 3, 4, pantsD); a(-3 - lw, -2, 4, 2, shoe); a(lw, -6, 3, 4, pants); a(lw, -2, 4, 2, shoe); }
  // туловище: футболка с полоской
  a(-4, ty, 9, 8, shirt); a(-4, ty, 9, 1, shirtL); a(-4, ty + 3, 8, 1, shirtL); a(4, ty, 1, 8, shirtD); a(-4, ty + 7, 9, 1, shirtD);
  // голова и волосы
  a(-4, hy, 9, 8, skin); a(-4, hy + 7, 9, 1, skinD); a(-2, hy + 3, 1, 2, skinD);
  a(-5, hy - 1, 10, 3, hair); a(-5, hy + 2, 3, 4, hair); a(2, hy + 2, 3, 1, hair); a(-3, hy - 1, 4, 1, hairL);
  // глаз (иногда моргает)
  if ((t + phase * 1.37) % 3.3 < 0.13) a(1, hy + 4, 2, 1, '#17171f');
  else { a(1, hy + 3, 2, 2, '#ffffff'); a(2, hy + 3, 1, 2, '#17171f'); }
  if (opt.mask) { a(-1, hy + 5, 6, 3, opt.mask); a(-4, hy + 5, 3, 1, opt.mask); a(-1, hy + 5, 6, 1, shade(opt.mask, 0.25)); }
  else {
    a(0, hy + 5, 1, 1, '#f39a8a');
    if (up) a(2, hy + 6, 2, 2, '#5a1414'); else a(2, hy + 6, 2, 1, '#a0503c');
  }
  // передняя рука и предмет
  if (up || pose === 'wave') {
    const wv = pose === 'wave' ? Math.round(Math.sin(t * 12) * 1.2) : 0;
    a(5, ty - 7, 2, 8, shirt); a(5 + wv, ty - 9, 2, 2, skin);
    itemParts(a, opt.item, 6 + wv, ty - 10, true, out);
  } else if (pose === 'point') {
    a(4, ty + 1, 7, 2, shirt); a(11, ty + 1, 2, 2, skin); a(13, ty + 1, 1, 1, skin);
  } else if (sit) {
    a(3, ty + 1, 2, 4, shirt); a(4, ty + 5, 2, 2, skin);
    itemParts(a, opt.item, 5, ty + 4, false, out);
  } else {
    a(3 + lw, ty + 1, 2, 5, shirt); a(3 + lw, ty + 6, 2, 2, skin);
    itemParts(a, opt.item, 4 + lw, ty + 7, false, out);
  }
  return out;
}

export function player(S, x, y, key, pose, phase = 0, item = 'racket') {
  const parts = humanParts(S.t, playerPal(key), pose, phase, { item: { kind: item, col: racketColor(S, key) } });
  sprite(S.c, x, y, PX, parts, OL);
  if (pose === 'alarm') {
    const b = Math.round(Math.sin(S.t * 10)) * PX;
    sprite(S.c, x, y + b, PX, [[0, -34, 2, 5, '#ffffff'], [0, -28, 2, 2, '#ffffff']], OL);
  }
}

// Маленький человечек для дальних планов
export function miniPlayer(S, x, y, key, pose) {
  const team = TEAM_COLORS[key] || '#ff8a3d';
  const [hair] = HAIR[key] || HAIR.h;
  const up = pose === 'alarm' || pose === 'cheer';
  const rk = racketColor(S, key);
  const parts = [
    [-1, -3, 1, 3, '#3b3d52'], [1, -3, 1, 3, '#272838'],
    [-2, -7, 4, 4, team], [-2, -7, 4, 1, shade(team, 0.3)],
    [-2, -11, 4, 4, '#f0c49a'], [-2, -12, 4, 2, hair], [-2, -10, 1, 2, hair], [1, -10, 1, 1, '#17171f'],
    up ? [2, -12, 1, 5, team] : [2, -7, 1, 3, team],
    up ? [2, -15, 2, 2, rk] : [3, -5, 2, 2, rk],
  ];
  sprite(S.c, x, y, PX, parts, OL);
  if (pose === 'alarm' && Math.sin(S.t * 10) > -0.3) sprite(S.c, x, y, PX, [[0, -20, 1, 3, '#ffffff'], [0, -16, 1, 1, '#ffffff']], OL);
}

// Оба игрока (или один в соло). pose — строка или функция от номера игрока.
export function crew(S, x, y, pose, gap, mini = false) {
  const keys = S.o.duo ? ['h', 'g'] : ['h'];
  keys.forEach((key, i) => {
    const px = S.o.duo ? x + (i - 0.5) * gap : x;
    const p = typeof pose === 'function' ? pose(i) : pose;
    if (mini) miniPlayer(S, px, y, key, p); else player(S, px, y, key, p, i * 1.7);
  });
}

// ---------- Лодка сбоку ----------
// Рисуется в два слоя: дальний борт → люди → ближний борт (он закрывает им ноги).
export const deckY = (y, len) => y - len * 0.22 * 0.8; // где стоят ноги экипажа

export function boatBack(S, x, y, len) {
  const h = len * 0.22;
  R(S.c, x - len * 0.44, y - h - 1.6, len * 0.86, 1.4, '#5a3a1c');
  R(S.c, x - len * 0.44, y - h - 1.6, len * 0.86, PX, '#8a5a2b');
}

export function boatFront(S, x, y, len, water) {
  const { c, t } = S;
  const h = len * 0.22, top = y - h, bot = y + h * 0.45;
  const L = x - len / 2, Rr = x + len / 2;
  const prof = (yy) => {
    const k = clamp01((yy - top) / (bot - top));
    return [L + Math.pow(k, 1.7) * len * 0.1, Rr - Math.pow(k, 1.3) * len * 0.2];
  };
  spans(c, top - PX, bot + PX, (yy) => { const [l, r] = prof(yy); return [l - PX, r + PX]; }, '#24140a');
  const planks = ['#b47c44', '#a06c38', '#ac7640', '#8c5e2f'];
  spans(c, top, bot, prof, (yy) => {
    const k = (yy - top) / (bot - top), b = k * 4, f = b - Math.floor(b);
    const base = planks[Math.min(3, Math.floor(b))];
    if (k > 0.05 && f < 0.09) return '#5a3a1c'; // шов между досками
    if (f < 0.22) return shade(base, 0.12); // блик на доске
    return base;
  });
  // планширь
  R(c, L - PX, top - 1.4, len + 2 * PX, 1.5, '#4a2f16');
  R(c, L, top - 1.4, len, PX, '#d8a868');
  // гвозди
  for (let i = 1; i < 8; i++) for (const kk of [0.18, 0.43, 0.68]) {
    const yy = top + (bot - top) * kk;
    const [l, r] = prof(yy);
    P(c, lerp(l, r, i / 8), yy, '#e8d8b0');
  }
  // вода по ватерлинии и пена
  const ga = c.globalAlpha;
  c.globalAlpha = ga * 0.6;
  spans(c, y, bot + PX, (yy) => { const [l, r] = prof(yy); return [l - 1, r + 1]; }, water);
  c.globalAlpha = ga;
  for (let i = 0; i < 16; i++) P(c, L - 1 + ((hash(i) * (len + 2) + t * 5) % (len + 2)), y + (i % 3) * PX, '#eef8ff');
}

// Пенный след за кормой
export function wake(S, x, y, a) {
  if (a <= 0) return;
  const { c, t } = S;
  const ga = c.globalAlpha;
  for (let i = 0; i < 20; i++) {
    const d = i * 1.8 + ((t * 7) % 1.8);
    c.globalAlpha = ga * a * (1 - i / 20);
    R(c, x - d, y + 0.5 + d * 0.1, 1.6, PX, '#eef8ff');
    R(c, x - d, y + 0.5 - d * 0.05, 1.2, PX, '#eef8ff');
  }
  c.globalAlpha = ga;
}
