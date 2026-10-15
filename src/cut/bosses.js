// Боссы для кат-сцен: Мировой змей, Колосс и катер рейдеров.
import {
  PX, R, P, oval, disc, glow, line, spans, sprite, box, noTint, hash, lerp, mix, ease, easeOut, clamp01,
} from './gfx.js';
import { humanParts, RAIDER, OL } from './people.js';
import { flame, flag } from './props.js';
import { digit } from './movie.js';

// ---------- Мировой змей ----------
const SERP = {
  ol: '#0e1a1e', base: '#3d6268', base2: '#47717a', light: '#79a3a4', dark: '#22383c',
  belly: '#a6bba8', bellyD: '#7c917f', bone: '#e6dbbb', bone2: '#bcae8a', boneD: '#857a60',
  eye: '#ffb32b', eyeHi: '#fff2a8', glow: '#ff9a20', mouth: '#2a0408', gum: '#6a1018', tooth: '#f6f0e0', toothD: '#c4baa0',
};
// Силуэт на фоне молнии — всё чёрное, кроме глаза
const SIL = Object.fromEntries(Object.keys(SERP).map((k) => [k, '#04080b']));
Object.assign(SIL, { eye: '#ffb32b', eyeHi: '#fff2a8', glow: '#ff9a20' });

// Костяной шип: столбик квадратиков вдоль направления ang
function spike(c, x, y, ang, len, C) {
  const pts = [];
  for (let j = 0; j <= 4; j++) {
    const k = j / 4;
    pts.push([x + Math.cos(ang) * len * k, y + Math.sin(ang) * len * k, lerp(1.5, 0.5, k)]);
  }
  for (const [px, py, s] of pts) R(c, px - s / 2 - PX, py - s / 2 - PX, s + 2 * PX, s + 2 * PX, C.ol);
  for (const [px, py, s] of pts) { R(c, px - s / 2, py - s / 2, s, s, C.bone); P(c, px - s / 2, py - s / 2, C.boneD); }
}

// Изогнутый рог: дуга от затылка назад и вверх, с кольцами
function horn(c, x, y, rad, C, back) {
  const cx = x + rad * 0.85, cy = y + rad * 0.5;
  const pts = [];
  for (let j = 0; j <= 18; j++) {
    const k = j / 18;
    const a = lerp(-2.6, 0.35, k);
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, lerp(3.4, 0.7, k) * (back ? 0.85 : 1), k, j]);
  }
  for (const [px, py, s] of pts) R(c, px - s / 2 - PX, py - s / 2 - PX, s + 2 * PX, s + 2 * PX, C.ol);
  for (const [px, py, s, k, j] of pts) {
    let col = k < 0.5 ? C.bone : k < 0.8 ? C.bone2 : C.boneD;
    if (back) col = k < 0.6 ? C.bone2 : C.boneD;
    if (j % 4 === 3) col = C.boneD;
    R(c, px - s / 2, py - s / 2, s, s, col);
    if (!back && j % 4 !== 3) P(c, px - s / 2, py - s / 2, '#fffaf0');
  }
}

export function drawWorldSerpent(S, x, water, rise, jaw, sil) {
  const { c, t } = S;
  if (rise <= 0) return null;
  const C = sil ? SIL : SERP;
  // Кольца гигантского тела торчат из воды
  for (const [ox, r0, sd] of [[22, 8, 0], [35, 6, 1], [-26, 7, 2]]) {
    const r = r0 * rise, hx = x + ox, hy = water + 1;
    disc(c, hx, hy, r + PX, C.ol, -1);
    disc(c, hx, hy, r, C.base, -1);
    disc(c, hx + r * 0.35, hy, r * 0.65, C.dark, -1);
    disc(c, hx + r * 0.1, hy, r * 0.62, C.base, -1);
    oval(c, hx - r * 0.45, hy - r * 0.45, r * 0.3, r * 0.18, C.light);
    for (let yy = hy - r + 1.5; yy < hy - 0.5; yy += 2) {
      const off = (Math.round((yy - hy) / 2) % 2) * 1.2;
      for (let xx = hx - r + off; xx < hx + r; xx += 2.4) {
        if ((xx - hx) ** 2 + (yy - hy) ** 2 < (r - 1) ** 2) { P(c, xx, yy, C.dark); P(c, xx + PX, yy - PX, C.light); }
      }
    }
    for (let k = 0; k < 5; k++) {
      const an = Math.PI * (1.15 + k * 0.175);
      spike(c, hx + Math.cos(an) * r, hy + Math.sin(an) * r, an, 2.6 * rise, C);
    }
    for (let i = 0; i < 10; i++) P(c, hx - r - 1 + ((hash(i + sd * 13) * (2 * r + 2) + t * 4) % (2 * r + 2)), hy - PX * (i % 2), '#eaf6ff');
  }
  // Шея — изогнутая кривая из чешуйчатых колец
  const h = rise * 48, sway = Math.sin(t * 1.4) * 4;
  const P0 = [x + 4, water + 4], P1 = [x + 15 + sway, water - h * 0.5], P2 = [x - 2 + sway * 0.4, water - h];
  const bez = (k) => [
    (1 - k) ** 2 * P0[0] + 2 * (1 - k) * k * P1[0] + k * k * P2[0],
    (1 - k) ** 2 * P0[1] + 2 * (1 - k) * k * P1[1] + k * k * P2[1],
  ];
  const N = 30;
  const rad = (k) => lerp(9.6, 6.8, k);
  for (let i = 0; i <= N; i++) { const [px, py] = bez(i / N); disc(c, px, py, rad(i / N) + PX, C.ol); }
  for (let i = 0; i <= N; i++) {
    const k = i / N, [px, py] = bez(k), r = rad(k);
    disc(c, px, py, r, i % 3 ? C.base : C.base2);
    oval(c, px + r * 0.62, py, r * 0.36, r * 0.86, C.dark);
    oval(c, px - r * 0.58, py - r * 0.1, r * 0.28, r * 0.7, C.light);
    R(c, px - r * 0.96, py - 1, r * 0.4, 1.6, C.belly);
    R(c, px - r * 0.96, py + 0.6, r * 0.4, PX, C.bellyD);
    if (i % 2 === 0) { P(c, px + r * 0.1, py - r * 0.3, C.dark); P(c, px - r * 0.2, py + r * 0.35, C.dark); }
  }
  for (let i = 1; i < N; i += 3) {
    const k = i / N, [px, py] = bez(k), r = rad(k);
    spike(c, px + r * 0.85, py - r * 0.35, -0.5, 3.2, C);
  }
  // Голова мордой влево
  const [nx, ny] = bez(1);
  const hx = nx - 4, hy = ny - 3;
  const open = jaw * 10, jy = hy + 2 + open;
  horn(c, hx + 7, hy - 6, 9, C, true);
  box(c, hx - 6, hy - 9, 17, 12, C.base, C.light, C.dark, C.ol);
  box(c, hx - 26, hy - 6.5, 22, 8.5, C.base, C.light, C.dark, C.ol);
  R(c, hx - 28, hy - 4.5, 2.4, 5.5, C.base);
  for (let i = 0; i < 6; i++) P(c, hx - 24 + i * 3.4, hy - 4.5 + (i % 2), C.dark);
  R(c, hx - 26, hy - 5, 1.6, 1, C.mouth);
  box(c, hx - 13, hy - 10.5, 13, 3.4, C.dark, C.base, null, C.ol);
  // Пасть: нутро, язык, слюна
  if (open > 0.4) {
    R(c, hx - 24, hy + 2, 26, open, C.mouth);
    R(c, hx - 24, hy + 2, 26, 0.8, C.gum);
    R(c, hx - 24, jy - 0.8, 26, 0.8, C.gum);
    R(c, hx - 14, jy - 2.2, 10, 1.4, sil ? C.mouth : '#a02838');
    const ga = c.globalAlpha;
    c.globalAlpha = ga * 0.5;
    for (const sx of [-18, -9, -2]) R(c, hx + sx, hy + 2.8, PX, Math.max(PX, open - 1.6), '#d8e0e4');
    c.globalAlpha = ga;
  }
  // Нижняя челюсть с зубами
  box(c, hx - 23, jy, 25, 4.6, C.base2, C.light, C.dark, C.ol);
  for (let i = 0; i < 11; i++) {
    const tl = i % 3 === 1 ? 2.6 : 1.6;
    R(c, hx - 22 + i * 2.2, jy - tl, 1, tl, C.tooth);
  }
  // Верхние клыки — поверх, видны даже с закрытой пастью
  for (let i = 0; i < 12; i++) {
    const tx = hx - 24 + i * 2.1, tl = i % 3 === 0 ? 2.8 : 1.8;
    R(c, tx, hy + 2, 1, tl, C.tooth);
    R(c, tx + PX, hy + 2 + tl - PX, PX, PX, C.toothD);
  }
  // Шипы-«борода» и щёчные шипы
  for (let i = 0; i < 6; i++) spike(c, hx - 19 + i * 4.2, jy + 4.4, Math.PI * 0.62, 3 + (i % 2) * 1.4, C);
  for (let i = 0; i < 3; i++) spike(c, hx + 10, hy - 4 + i * 3, -0.15 + i * 0.25, 3.5 - i * 0.6, C);
  // Светящийся глаз
  noTint(() => {
    glow(c, hx - 7, hy - 6, 6, C.glow, sil ? 0.9 : 0.55);
    R(c, hx - 9.5, hy - 7.6, 5, 3, C.eye);
    R(c, hx - 9, hy - 7.6, 2, 1, C.eyeHi);
    R(c, hx - 7.3, hy - 7.6, 0.8, 3, '#120400');
  });
  horn(c, hx + 3, hy - 8, 11, C, false);
  return { hx, hy, mx: hx - 26, my: hy + 2 + open / 2 };
}

// ---------- Эффекты воды и пара ----------
export function splashCrown(S, x, y, dt) {
  if (dt <= 0 || dt > 1.8) return;
  const { c } = S;
  const ga = c.globalAlpha;
  if (dt < 0.9) {
    c.globalAlpha = ga * 0.55 * (1 - dt / 0.9);
    oval(c, x, y - 2, 14 + dt * 8, 28 * Math.sin((dt / 0.9) * Math.PI), '#cfe8f8', -1);
    c.globalAlpha = ga;
  }
  for (let i = 0; i < 46; i++) {
    const a = Math.PI * (0.08 + 0.84 * hash(i)), v = 26 + hash(i + 4) * 34;
    const px = x + Math.cos(a) * v * dt * 0.7, py = y - Math.sin(a) * v * dt + 30 * dt * dt;
    if (py <= y + 1) R(c, px, py, 1, 1, i % 3 ? '#dff2ff' : '#ffffff');
  }
}

export function drips(S, x, water, rise) {
  const { c, t } = S;
  if (rise < 0.6) return;
  for (let i = 0; i < 26; i++) {
    const f = (t * 1.1 + hash(i)) % 1;
    const x0 = x + (hash(i + 3) - 0.3) * 18, y0 = water - hash(i + 6) * 44 * rise;
    const py = y0 + f * f * 40;
    if (py > water) continue;
    P(c, x0, py, '#cfe8ff');
    P(c, x0, py - PX, '#9fc0d8');
  }
}

export function breath(S, mx, my) {
  const { c, t } = S;
  const ga = c.globalAlpha;
  for (let i = 0; i < 12; i++) {
    const f = (t * 1.8 + i / 12) % 1;
    c.globalAlpha = ga * 0.45 * (1 - f);
    disc(c, mx - f * 26, my + Math.sin(i * 1.7) * 3 + f * 5, 1.2 + f * 5, '#d8e2ea');
  }
  c.globalAlpha = ga;
}

export function steamBlast(S, x, y, dt, lit) {
  if (dt <= 0 || dt > 3.2) return;
  const { c } = S;
  const ga = c.globalAlpha;
  for (let i = 0; i < 26; i++) {
    const a = hash(i + 3) * Math.PI;
    const d = easeOut(dt / 1.4) * (14 + hash(i + 8) * 22);
    const px = x + Math.cos(a) * d * 1.4, py = y - 6 - Math.sin(a) * d * 0.9 - dt * 5;
    const r = 4 + dt * 3 + hash(i + 1) * 4;
    c.globalAlpha = ga * 0.55 * (1 - dt / 3.2);
    disc(c, px, py, r, mix(lit, '#f4f4f4', clamp01(dt / 1.5)));
    disc(c, px - r * 0.25, py - r * 0.3, r * 0.5, '#ffffff');
  }
  c.globalAlpha = ga;
}

export function steamRing(S, x, y, dt) {
  if (dt <= 0 || dt > 2.2) return;
  const { c } = S;
  const ga = c.globalAlpha;
  const rr = easeOut(dt / 1.2) * 48;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    c.globalAlpha = ga * 0.45 * (1 - dt / 2.2);
    disc(c, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.35 - dt * 4, 4 + dt * 4, '#f0f0f0');
  }
  c.globalAlpha = ga;
}

// ---------- Колосс ----------
const COL = {
  ol: '#2a0604', m: '#b23a2e', m2: '#c64a3c', l: '#e57a62', d: '#7a2018', x: '#4a0e0a',
  bone: '#ecd2b4', tooth: '#f4ecd8', toothD: '#c8bca2', hair: '#120c0c', eye: '#efe0a8', gum: '#8a1a18', rim: '#ffb07a',
};

// Гигант без кожи, вид спереди. (cx, base) — середина у линии пояса, k — масштаб.
export function drawColossus(S, cx, base, k) {
  const { c } = S;
  const B = (x, y, w, h, col) => R(c, cx + x * k, base + y * k, w * k, h * k, col);
  const O = (x, y, rx, ry, col, half) => oval(c, cx + x * k, base + y * k, rx * k, ry * k, col, half);
  const L = (x0, y0, x1, y1, col, th) => line(c, cx + x0 * k, base + y0 * k, cx + x1 * k, base + y1 * k, col, th ? th * k : 0);
  const SP = (y0, y1, f, col) => spans(c, base + y0 * k, base + y1 * k, (yy) => { const r = f((yy - base) / k); return [cx + r[0] * k, cx + r[1] * k]; }, col);
  // Руки по бокам (позади туловища)
  for (const sx of [-1, 1]) {
    const ax = sx * 27;
    SP(-57, 6, () => [ax - 4.9, ax + 4.9], COL.ol);
    SP(-56, 6, () => [ax - 4.2, ax + 4.2], COL.m);
    O(ax - sx * 0.5, -45, 4.4, 7, COL.m2);
    for (let i = -3; i <= 3; i++) L(ax + i * 1.1, -53, ax + i * 1.2 + sx * 0.4, -28, i % 2 ? COL.l : COL.d);
    B(ax - 4.2, -27, 8.4, 1.4, COL.d);
    for (let i = -2; i <= 2; i++) L(ax + i * 1.4, -25, ax + i * 1.3, 4, COL.l);
  }
  // Плечи
  for (const sx of [-1, 1]) {
    O(sx * 22, -57, 8.2, 7.2, COL.ol);
    O(sx * 22, -57, 7.6, 6.6, COL.m2);
    for (let i = 0; i < 5; i++) L(sx * (16 + i * 2.2), -62, sx * (19 + i * 1.6), -51, COL.l);
  }
  // Туловище с контровым светом слева (закат)
  const torso = (y) => {
    const kk = (y + 63) / 66;
    let hw = lerp(21, 14.5, ease(kk));
    if (y < -59) hw -= (y + 59) ** 2 * 0.3;
    return [-hw, hw];
  };
  SP(-64, 6, (y) => { const r = torso(y); return [r[0] - 0.8, r[1] + 0.8]; }, COL.ol);
  SP(-63, 6, torso, COL.m);
  SP(-62, 6, (y) => { const r = torso(y); return [r[0], r[0] + 1]; }, COL.rim);
  L(-2, -61, -17, -59, COL.bone, 1.1);
  L(2, -61, 17, -59, COL.bone, 1.1);
  // Грудь с волокнами
  for (const sx of [-1, 1]) {
    O(sx * 9, -50, 9.4, 6.4, COL.d);
    O(sx * 9, -51, 8.8, 5.8, COL.m2);
    O(sx * 8, -54, 6, 2, COL.l, -1);
    for (let i = 0; i < 5; i++) L(sx, -56 + i * 2, sx * (15 - i), -50 + i * 1.6, COL.l);
  }
  B(-0.7, -57, 1.4, 15, COL.d);
  // Рёбра по бокам
  for (const sx of [-1, 1]) for (let r = 0; r < 4; r++) for (let j = 0; j < 5; j++) {
    const rx = sx * (19 - j * 1.6) - 0.9, ry = -44 + r * 5 + j * 0.7;
    B(rx, ry, 1.8, 1, COL.d);
    B(rx, ry - 1, 1.8, 0.6, COL.l);
  }
  // Пресс
  B(-0.8, -43, 1.6, 50, COL.d);
  for (let r = 0; r < 4; r++) for (const sx of [-9, 1.2]) {
    const y = -42 + r * 8;
    B(sx, y, 7.8, 6.8, COL.m2);
    B(sx, y, 7.8, 1, COL.l);
    B(sx, y + 5.8, 7.8, 1, COL.d);
    B(sx + 6.8, y, 1, 6.8, COL.d);
  }
  // Шея и трапеции
  SP(-74, -60, (y) => { const kk = (y + 74) / 14; const hw = lerp(6.5, 17, kk * kk); return [-hw, hw]; }, COL.m);
  L(-6, -73, -1.5, -61, COL.l, 1.6);
  L(6, -73, 1.5, -61, COL.l, 1.6);
  B(-1.3, -71, 2.6, 8, COL.d);
  // Голова-череп
  const skull = (y) => {
    const kk = (y + 98) / 28;
    const hw = kk < 0.35 ? 10.5 * Math.sqrt(Math.max(0, kk) / 0.35) : kk < 0.65 ? 11 : lerp(11, 7, (kk - 0.65) / 0.35);
    return [-hw, hw];
  };
  SP(-99, -69, (y) => { const r = skull(y); return [r[0] - 0.8, r[1] + 0.8]; }, COL.ol);
  SP(-98, -70, skull, COL.m2);
  SP(-97, -70, (y) => { const r = skull(y); return [r[0], r[0] + 1]; }, COL.rim);
  B(-10, -90, 2.6, 6, COL.d);
  B(7.4, -90, 2.6, 6, COL.d);
  // Редкие чёрные волосы
  for (let i = 0; i < 8; i++) { const hx = -8.5 + i * 2.4; L(hx, -96.5, hx + (hash(i) - 0.5) * 3, -100 - hash(i + 4) * 2.5, COL.hair, 0.9); }
  L(-10.2, -95, -11, -87, COL.hair, 0.8);
  L(10.2, -95, 11.2, -88, COL.hair, 0.8);
  // Тяжёлый лоб и глубокие глазницы
  B(-9.4, -88.5, 18.8, 2.4, COL.d);
  B(-9.4, -86.2, 18.8, 1, COL.x);
  B(-7.8, -86, 5.8, 4.6, COL.x);
  B(2, -86, 5.8, 4.6, COL.x);
  noTint(() => { B(-6.6, -84.6, 2.2, 1.3, COL.eye); B(3.2, -84.6, 2.2, 1.3, COL.eye); });
  // Открытые мышцы щёк
  for (const sx of [-1, 1]) {
    B(sx * 9.6 - 1.5, -82, 3, 10, COL.l);
    for (let i = 0; i < 3; i++) B(sx * 9.6 - 1.5 + i, -82, 0.5 / k, 10, COL.d);
  }
  // Носовая впадина
  B(-1.8, -81.5, 3.6, 3.2, COL.x);
  B(-0.7, -78.4, 1.4, 1, COL.x);
  // Оскал без губ — два ряда зубов
  B(-9, -77.4, 18, 7.8, COL.x);
  B(-9, -77.4, 18, 1.3, COL.gum);
  B(-9, -70.8, 18, 1.2, COL.gum);
  for (let i = 0; i < 9; i++) {
    const tx = -8.6 + i * 1.95;
    B(tx, -76.1, 1.55, 2.8, COL.tooth);
    B(tx, -73.6, 1.55, 0.5, COL.toothD);
    B(tx, -73.2, 1.55, 2.6, COL.tooth);
  }
  B(-6, -69.6, 12, 1.4, COL.m);
  B(-12.4, -86, 1.8, 5, COL.m);
  B(10.6, -86, 1.8, 5, COL.m);
}

// ---------- Катер рейдеров (сбоку, носом влево) ----------
export function raiderBoat(S, x, y, threaten) {
  const { c, t } = S;
  const top = y - 6, bot = y + 3;
  const prof = (yy) => { const k = clamp01((yy - top) / (bot - top)); return [x - 21 + k * k * 9, x + 18 - k * 0.8]; };
  flag(S, x + 14, y - 23);
  // Водитель за стеклом и метатель на носу (оба лицом влево)
  sprite(c, x + 4, top, PX, humanParts(t, RAIDER, 'stand', 0.5, { mask: '#c0202a' }), OL, true);
  const thrower = humanParts(t, RAIDER, threaten ? 'cheer' : 'stand', 1.3, { mask: '#c0202a', item: threaten ? { kind: 'molotov' } : null });
  sprite(c, x - 11, top, PX, thrower, OL, true);
  if (thrower.flame) flame(S, x - 11 - thrower.flame[0] * PX, top + thrower.flame[1] * PX);
  // Лобовое стекло
  const ga = c.globalAlpha;
  c.globalAlpha = ga * 0.55;
  spans(c, top - 6, top, (yy) => { const kk = (yy - (top - 6)) / 6; return [x - 1 - kk * 3, x + 3]; }, '#a8dcff');
  c.globalAlpha = ga;
  line(c, x - 1, top - 6, x - 4, top, '#16181c');
  line(c, x - 1, top - 6, x + 3, top - 6, '#16181c');
  // Корпус с гоночной полосой
  spans(c, top - PX, bot + PX, (yy) => { const r = prof(yy); return [r[0] - PX, r[1] + PX]; }, '#0a0b0e');
  spans(c, top, bot, prof, (yy) => {
    const k = (yy - top) / (bot - top);
    if (k < 0.12) return '#5a606c';
    if (k > 0.32 && k < 0.46) return '#d6262f';
    if (k >= 0.46 && k < 0.52) return '#7a1218';
    if (k > 0.8) return '#1a1d22';
    return '#2b2f36';
  });
  R(c, x - 20, top, 38, PX, '#8a909c');
  digit(c, 1, x + 3, y - 3.4, PX, '#ffffff');
  digit(c, 3, x + 5, y - 3.4, PX, '#ffffff');
  // Подвесной мотор
  box(c, x + 17.5, top - 6, 4.5, 6.5, '#1b1d22', '#3a3e46', '#0a0b0e', '#050506');
  R(c, x + 17.5, top - 3.8, 4.5, 0.7, '#d6262f');
  R(c, x + 19, top + 0.5, 1.4, 7, '#2b2f36');
}

// След, брызги и полосы скорости за катером
export function raiderWake(S, x, wl, moving, drift) {
  const { c, t } = S;
  const ga = c.globalAlpha;
  if (moving > 0) {
    for (let i = 0; i < 30; i++) {
      c.globalAlpha = ga * moving * (1 - i / 30);
      const px = x + 18 + i * 2 + ((t * 30) % 2);
      R(c, px, wl + 2.6 - i * 0.04, 1.6, PX, '#ffffff');
      R(c, px, wl + 3.4 + i * 0.08, 1.4, PX, '#e8f4ff');
    }
    c.globalAlpha = ga * 0.5 * moving;
    for (let i = 0; i < 10; i++) R(c, x + 24 + hash(i) * 40, wl - 18 + hash(i + 5) * 22, 10 + hash(i + 9) * 14, PX, '#ffffff');
  }
  for (let i = 0; i < 14; i++) {
    const f = (t * 3 + hash(i)) % 1;
    c.globalAlpha = ga * (1 - f);
    P(c, x + 20 + f * 9, wl + 1 - Math.sin(f * Math.PI) * 4, '#ffffff');
  }
  if (drift > 0 && drift < 1) {
    for (let i = 0; i < 30; i++) {
      const a = Math.PI + hash(i) * Math.PI * 0.9, r = drift * 24 * (0.4 + hash(i + 2));
      c.globalAlpha = ga * (1 - drift);
      R(c, x - 6 + Math.cos(a) * r, wl - Math.abs(Math.sin(a)) * r * 0.8, 1.2, 1.2, '#ffe8e0');
    }
  }
  c.globalAlpha = ga;
}
