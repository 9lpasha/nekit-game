// Реквизит кат-сцен: остров, пальмы, лагерь, проектор, экран, стулья, живность.
import {
  PX, R, P, oval, disc, glow, line, spans, fillPoly, noTint, hash, lerp, mix,
} from './gfx.js';

// ---------- Природа ----------
export function palm(S, x, gy, s, sway) {
  const { c, t } = S;
  const n = 10, h = 18 * s, lean = 4 * s * sway;
  let tx = x, ty = gy;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const px = x + k * k * lean, py = gy - k * h;
    R(c, px - 0.95 * s - PX, py - 2 * s, 1.9 * s + 2 * PX, 2.1 * s, '#3a2410');
    R(c, px - 0.95 * s, py - 2 * s, 1.9 * s, 2.1 * s, i % 2 ? '#8e6440' : '#7a5232');
    R(c, px - 0.95 * s, py - 2 * s, 0.6 * s, 2.1 * s, '#a87a52');
    tx = px; ty = py - 2 * s;
  }
  // кокосы
  for (const [dx, dy] of [[-0.9, 0.6], [0.5, 0.9], [0.1, 0.2]]) {
    disc(c, tx + dx * s, ty + dy * s + 0.6 * s, 0.85 * s, '#4a2e14');
    P(c, tx + dx * s - 0.3 * s, ty + dy * s + 0.3 * s, '#8a6038');
  }
  // листья дугой, с бликом сверху и свисающими перьями
  const fronds = [-0.25, -0.75, -1.35, -1.85, -2.45, -2.95, 0.35, 2.8];
  for (let f = 0; f < fronds.length; f++) {
    const ang = fronds[f] + Math.sin(t * 1.6 + f) * 0.05 * sway;
    const L = (8 + hash(f) * 2.5) * s;
    for (let j = 0; j <= 12; j++) {
      const kj = j / 12;
      const fx = tx + Math.cos(ang) * L * kj;
      const fy = ty + Math.sin(ang) * L * kj * 0.55 + L * 0.5 * kj * kj;
      const th = Math.max(PX, (1.5 - kj) * s);
      R(c, fx - th / 2, fy - th / 2, th, th, '#3c8a32');
      R(c, fx - th / 2, fy - th / 2, th, PX, '#72c45a');
      if (j % 2) R(c, fx, fy + th / 2, PX, (1 - kj) * 1.8 * s, '#2a6424');
    }
  }
  disc(c, tx, ty, 1.1 * s, '#2f7228');
}

export function bush(S, x, y, s) {
  const { c } = S;
  const big = [[-2.6, 0.4, 2.4], [0, -0.8, 3], [2.8, 0.3, 2.3]];
  for (const [dx, dy, r] of big) disc(c, x + dx * s, y + dy * s, r * s + PX, '#0e2a12');
  for (const [dx, dy, r] of big) disc(c, x + dx * s, y + dy * s, r * s, '#2f7a34');
  for (const [dx, dy, r] of [[-3, -0.3, 1.1], [-0.6, -1.9, 1.4], [2.3, -0.6, 1]]) disc(c, x + dx * s, y + dy * s, r * s, '#5aae4a');
  P(c, x - 1 * s, y - 0.4 * s, '#e04a5a'); P(c, x + 1.8 * s, y - 1 * s, '#e04a5a'); // ягодки
}

export function rock(S, x, y, s) {
  const { c } = S;
  oval(c, x, y, 3.4 * s + PX, 2.2 * s + PX, '#1e2226', -1);
  oval(c, x, y, 3.4 * s, 2.2 * s, '#6f7780', -1);
  oval(c, x + 1.6 * s, y, 1.4 * s, 1.2 * s, '#5d646c', -1);
  oval(c, x - 0.8 * s, y - 0.9 * s, 1.6 * s, 0.6 * s, '#9aa2ab');
  R(c, x - 2.6 * s, y - 0.6 * s, 1.4 * s, PX, '#5a8a4a');
}

// Далёкий остров на горизонте
export function islandFar(S, x, y, s) {
  const { c, t } = S;
  oval(c, x, y + 0.3, 17 * s, 1.2 * s, '#a8d8f0');
  oval(c, x, y, 15 * s, 4.2 * s, '#b8934a', -1);
  oval(c, x, y - 0.3, 14 * s, 3.8 * s, '#ecd08a', -1);
  oval(c, x + s, y - 2.8 * s, 9.5 * s, 3.6 * s, '#2c6e30', -1);
  oval(c, x + 0.6 * s, y - 3.1 * s, 8.6 * s, 3.2 * s, '#4c9c44', -1);
  disc(c, x - 3 * s, y - 4.4 * s, 2 * s, '#3a8a3a');
  disc(c, x + 4.5 * s, y - 4 * s, 2.4 * s, '#3a8a3a');
  R(c, x - 11 * s, y - 1.3 * s, 2.4 * s, 1.3 * s, '#7d858e');
  R(c, x + 9 * s, y - 1 * s, 1.8 * s, 1 * s, '#7d858e');
  palm(S, x + 3 * s, y - 5.4 * s, 0.6 * s, 1 + Math.sin(t * 1.4) * 0.3);
  palm(S, x - 2.5 * s, y - 4.6 * s, 0.48 * s, 1 + Math.sin(t * 1.2 + 1) * 0.3);
  for (let i = 0; i < 10; i++) P(c, x - 15 * s + ((hash(i) * 30 * s + t * 3) % (30 * s)), y + (i % 2) * PX, '#ffffff');
}

// Ракушки и морская звезда у кромки воды
export function beachBits(S, gy) {
  const { c } = S;
  const star = (x, y) => {
    R(c, x - PX, y - PX, 3 * PX, 3 * PX, '#e8743a');
    for (const [dx, dy] of [[0, -2], [2, -0.5], [1.4, 1.6], [-1.4, 1.6], [-2, -0.5]]) line(c, x, y, x + dx * 0.7, y + dy * 0.7, '#f0904a');
  };
  star(64, gy + 13);
  for (const [x, y, col] of [[70, gy + 16, '#f4d8d0'], [58, gy + 19, '#fff0e0'], [80, gy + 20, '#f4d8d0']]) {
    oval(c, x, y, 1, 0.6, col, -1);
    P(c, x, y - PX, '#c8a098');
  }
}

export function fireflies(S, x0, x1, y0, y1, a) {
  if (a <= 0) return;
  const { c, t } = S;
  noTint(() => {
    const ga = c.globalAlpha;
    for (let i = 0; i < 12; i++) {
      c.globalAlpha = ga * a * Math.max(0, Math.sin(t * (1.5 + hash(i) * 2) + i * 2));
      const fx = lerp(x0, x1, hash(i + 1)) + Math.sin(t * 0.7 + i) * 3;
      const fy = lerp(y0, y1, hash(i + 2)) + Math.cos(t * 0.9 + i) * 2;
      glow(c, fx, fy, 1.6, '#d8ff6a', 0.6);
      P(c, fx, fy, '#f4ffb0');
    }
    c.globalAlpha = ga;
  });
}

export function shootingStar(S, k, x, y) {
  const { c } = S;
  noTint(() => {
    const ga = c.globalAlpha;
    const hx = x - k * 40, hy = y + k * 12;
    for (let i = 0; i < 10; i++) {
      c.globalAlpha = ga * (1 - i / 10) * Math.sin(k * Math.PI);
      R(c, hx + i * 1.2, hy - i * 0.36, 1, PX, '#ffffff');
    }
    c.globalAlpha = ga;
  });
}

export function crab(S, x, y) {
  const { c, t } = S;
  const st = Math.sin(t * 16);
  for (let i = 0; i < 3; i++) {
    const w = i % 2 ? st : -st;
    line(c, x - 1.2 - i * 0.5, y, x - 2.4 - i * 0.5, y + 1 + w * 0.3, '#b02a1a');
    line(c, x + 1.2 + i * 0.5, y, x + 2.4 + i * 0.5, y + 1 - w * 0.3, '#b02a1a');
  }
  oval(c, x, y - 0.2, 2.2, 1.3, '#5a1008');
  oval(c, x, y - 0.3, 2, 1.1, '#e04a2a');
  oval(c, x - 0.5, y - 0.8, 0.9, 0.35, '#ff8a6a');
  const open = Math.sin(t * 7) > 0;
  for (const sx of [-1, 1]) {
    disc(c, x + sx * 2.6, y - 1.4, 0.8, '#e04a2a');
    if (open) P(c, x + sx * 2.6, y - 2.1, '#5a1008');
  }
  R(c, x - 0.8, y - 2.4, PX, 1, '#5a1008'); R(c, x + 0.5, y - 2.4, PX, 1, '#5a1008');
  P(c, x - 0.8, y - 2.6, '#ffffff'); P(c, x + 0.5, y - 2.6, '#ffffff');
}

// ---------- Лагерь ----------
export function tent(S, x, gy, k) {
  if (k <= 0) return;
  const { c } = S;
  const h = 14 * k, w = 11 * k;
  const hw = (yy, top, ww) => ((yy - top) / (gy - top)) * ww;
  line(c, x, gy - h, x - 17 * k, gy, '#d8c8a0');
  line(c, x, gy - h, x + 17 * k, gy, '#d8c8a0');
  R(c, x - 17.5 * k, gy - 1, 1, 1.5, '#6b4423');
  R(c, x + 16.5 * k, gy - 1, 1, 1.5, '#6b4423');
  spans(c, gy - h - PX, gy, (yy) => { const d = hw(yy, gy - h, w); return [x - d - PX, x + d + PX]; }, '#3a1808');
  spans(c, gy - h, gy, (yy) => [x - hw(yy, gy - h, w), x], '#f29050');
  spans(c, gy - h, gy, (yy) => [x, x + hw(yy, gy - h, w)], '#c9602a');
  line(c, x, gy - h, x - w, gy, '#ffb478');
  // вход и откинутый клапан
  const dt = gy - h * 0.62;
  spans(c, dt, gy, (yy) => { const d = hw(yy, dt, w * 0.34); return [x - d, x + d]; }, '#4a1c0a');
  spans(c, dt, gy, (yy) => { const kk = (yy - dt) / (gy - dt); return [x - w * 0.34 * kk - 1.8 * kk, x - w * 0.34 * kk]; }, '#ffb070');
  R(c, x - 0.4, gy - h - 1.2, 0.8, 1.6, '#6b4423');
}

export function firewood(S, x, y) {
  const { c } = S;
  for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) {
    const lx = x + i * 2.4 + r * 1.2, ly = y - 1.2 - r * 1.8;
    disc(c, lx, ly, 1.1, '#2a1808');
    disc(c, lx, ly, 0.95, '#8a5a2b');
    disc(c, lx, ly, 0.5, '#d8b07a');
    P(c, lx, ly, '#8a5a2b');
  }
}

export function campfire(S, x, gy, lit) {
  const { c, t } = S;
  for (let i = 0; i < 7; i++) {
    const sx = x - 5 + i * 1.65;
    disc(c, sx, gy - 0.4, 1, '#3a3e44');
    disc(c, sx - 0.2, gy - 0.6, 0.7, '#8b939c');
  }
  line(c, x - 3.5, gy - 0.8, x + 3, gy - 2.6, '#6b4423', 1.2);
  line(c, x + 3.5, gy - 0.8, x - 3, gy - 2.6, '#5a3a1c', 1.2);
  R(c, x - 4, gy - 1.4, 1.2, 1.2, '#c99a5b');
  R(c, x + 3, gy - 1.4, 1.2, 1.2, '#c99a5b');
  if (lit <= 0) return;
  noTint(() => {
    glow(c, x, gy - 3, 10 * lit, '#ff9a3d', 0.5 * (0.85 + 0.15 * Math.sin(t * 13)));
    // язычки пламени: снизу белый, выше жёлтый, оранжевый, красный
    for (let col = -3; col <= 3; col++) {
      const hh = (4.2 - Math.abs(col)) * (0.75 + 0.35 * Math.sin(t * 13 + col * 1.9) + 0.15 * Math.sin(t * 29 + col)) * lit * 1.6;
      if (hh <= 0) continue;
      const bx = x + col * 0.8 - 0.4, by = gy - 1.6;
      R(c, bx, by - hh, 0.9, hh * 0.3, '#d6262f');
      R(c, bx, by - hh * 0.7, 0.9, hh * 0.3, '#ff7a1a');
      R(c, bx, by - hh * 0.4, 0.9, hh * 0.25, '#ffc93d');
      R(c, bx, by - hh * 0.15, 0.9, hh * 0.15 + PX, '#fff6c0');
    }
    for (let i = 0; i < 10; i++) {
      const f = (t * 0.9 + hash(i)) % 1;
      P(c, x + (hash(i + 3) - 0.5) * 6 + Math.sin(t * 3 + i) * 1.5, gy - 4 - f * 16, f < 0.5 ? '#ffe14d' : '#ff7a1a');
    }
  });
  const ga = c.globalAlpha;
  for (let i = 0; i < 6; i++) {
    const f = (t * 0.35 + i / 6) % 1;
    c.globalAlpha = ga * 0.25 * (1 - f) * lit;
    disc(c, x + Math.sin(t + i) * 2 + f * 4, gy - 8 - f * 22, 1.5 + f * 4, '#8a8a90');
  }
  c.globalAlpha = ga;
}

// Кинопроектор на ящике, с двумя бобинами
export function projector(S, x, gy, drop, on) {
  if (drop <= 0) return;
  const { c, t } = S;
  const y = gy - (1 - drop) * 26;
  R(c, x - 5.5, y - 6.5, 11, 6.5, '#3a2410');
  R(c, x - 5, y - 6, 10, 6, '#8a5a2b');
  R(c, x - 5, y - 6, 10, PX, '#b07a42');
  R(c, x - 5, y - 4, 10, PX, '#5a3a1c');
  R(c, x - 5, y - 2, 10, PX, '#5a3a1c');
  R(c, x - 4.5, y - 12, 8.5, 5.6, '#141518');
  R(c, x - 4, y - 11.5, 7.5, 4.6, '#2b2f36');
  R(c, x - 4, y - 11.5, 7.5, PX, '#5a606c');
  for (let i = 0; i < 3; i++) R(c, x - 3 + i * 1.4, y - 10, 0.6, 2.4, '#16181c');
  R(c, x + 3.5, y - 10.6, 3, 2.6, '#141518');
  R(c, x + 4, y - 10.1, 2.2, 1.6, '#1b1d22');
  noTint(() => R(c, x + 5.8, y - 10.1, 0.7, 1.6, on ? '#e8fbff' : '#4a7a8a'));
  for (const [rx, rr] of [[-2.2, 2.6], [1.8, 2.2]]) {
    const cx = x + rx, cy = y - 14.6;
    line(c, cx, cy, x - 0.2, y - 11.5, '#16181c', 0.5);
    disc(c, cx, cy, rr + PX, '#0c0c0e');
    disc(c, cx, cy, rr, '#3a3e46');
    disc(c, cx, cy, rr * 0.55, '#1b1d22');
    const ang = on ? t * 5 : 0;
    for (let s = 0; s < 3; s++) {
      const a = ang + (s / 3) * Math.PI * 2;
      line(c, cx, cy, cx + Math.cos(a) * rr * 0.85, cy + Math.sin(a) * rr * 0.85, '#8a909a');
    }
    disc(c, cx, cy, 0.4, '#c0c6d0');
  }
}

// Луч проектора с пылинками
export function beam(S, x0, y0, sx, sTop, sBot, a) {
  if (a <= 0) return;
  const { c, t } = S;
  noTint(() => {
    fillPoly(c, [[x0, y0], [sx, sTop], [sx, sBot]], '#fff6d8', 0.14 * a);
    const ga = c.globalAlpha;
    c.globalAlpha = ga * 0.6 * a;
    for (let i = 0; i < 18; i++) {
      const k = (hash(i) + t * 0.05 * (0.5 + hash(i + 9))) % 1;
      const spread = lerp(0.5, (sBot - sTop) / 2, k);
      P(c, lerp(x0, sx, k), lerp(y0, (sTop + sBot) / 2, k) + (hash(i + 4) - 0.5) * 2 * spread + Math.sin(t + i) * 0.4, '#fffbe8');
    }
    c.globalAlpha = ga;
  });
}

// Бамбуковые шесты и простыня-экран. Возвращает прямоугольник экрана, когда он развёрнут.
export function screenRig(S, x0, x1, top, gy, unroll) {
  const { c } = S;
  for (const px of [x0 - 1.4, x1 + 0.2]) {
    R(c, px - PX, top - 3, 1.2 + 2 * PX, gy - top + 3, '#3a2410');
    for (let yy = top - 3; yy < gy; yy += 2.2) {
      R(c, px, yy, 1.2, 2.2, '#c9a45a');
      R(c, px, yy + 1.9, 1.2, 0.3, '#7a6030');
    }
  }
  line(c, x0 - 0.8, top - 2, x1 + 0.8, top - 2, '#d8c8a0');
  if (unroll <= 0) return null;
  const h = 17 * unroll;
  R(c, x0 - PX, top - PX, x1 - x0 + 2 * PX, h + 2 * PX, '#202020');
  return { x: x0, y: top, w: x1 - x0, h };
}

export function sheet(S, r, night) {
  const { c, t } = S;
  noTint(() => {
    R(c, r.x, r.y, r.w, r.h, mix('#f4f4ee', '#9aa2c0', night * 0.6));
    const ga = c.globalAlpha;
    c.globalAlpha = ga * 0.12;
    for (let i = 0; i < r.w; i += 2) R(c, r.x + i, r.y, 1, r.h, Math.sin(t * 2 + i * 0.6) > 0 ? '#ffffff' : '#808898');
    c.globalAlpha = ga;
  });
}

// Походный стул (спинка слева — сидят лицом к экрану)
export function chair(S, x, seatY, k) {
  if (k <= 0) return;
  const { c } = S;
  const gy = seatY + 4.5;
  line(c, x - 3 * k, gy, x + 3 * k, seatY + 0.6, '#8a929c', 0.5);
  line(c, x + 3 * k, gy, x - 3 * k, seatY + 0.6, '#b8c0ca', 0.5);
  R(c, x - 3.6 * k - PX, seatY - 0.6 - PX, 7.2 * k + 2 * PX, 1.4 + 2 * PX, '#0e1a30');
  R(c, x - 3.6 * k, seatY - 0.6, 7.2 * k, 1.4, '#2f6fd6');
  R(c, x - 3.6 * k, seatY - 0.6, 7.2 * k, PX, '#6fa4ff');
  R(c, x - 4.2 * k - PX, seatY - 8 * k - PX, 1.4 * k + 2 * PX, 8 * k + 2 * PX, '#0e1a30');
  R(c, x - 4.2 * k, seatY - 8 * k, 1.4 * k, 8 * k, '#2f6fd6');
  for (let i = 0; i < 3; i++) R(c, x - 4.2 * k, seatY - 7 * k + i * 2.4 * k, 1.4 * k, 0.6 * k, '#ffffff');
}

// Огонь на тряпке коктейля
export function flame(S, x, y) {
  const { c, t } = S;
  noTint(() => {
    glow(c, x, y - 0.8, 3, '#ff9a3d', 0.6);
    const cols = ['#fff6c0', '#ffc93d', '#ff8a2a', '#d6262f', '#d6262f'];
    for (let i = 0; i < 5; i++) R(c, x - 0.6 + hash(i + Math.floor(t * 18)) * 1.2, y - i * 0.45, 0.6, 0.6, cols[i]);
  });
}

// Пиратский флаг с черепом, развевается
export function flag(S, px, py) {
  const { c, t } = S;
  R(c, px - PX, py - PX, 0.6 + 2 * PX, 17, '#16181c');
  R(c, px, py, 0.6, 17, '#a8b0b8');
  const SK = ['.###.', '#.#.#', '#####', '.#.#.'];
  for (let i = 0; i < 16; i++) {
    const off = Math.sin(t * 9 - i * 0.55) * 0.9 * (i / 16);
    const x = px + 0.6 + i * PX;
    R(c, x, py + off, PX, 6, '#141414');
    const si = i - 5;
    if (si >= 0 && si < 5) SK.forEach((r, j) => { if (r[si] === '#') P(c, x, py + off + 1.2 + j * PX, '#f0f0f0'); });
    if (i === 4 || i === 10) P(c, x, py + off + 4, '#f0f0f0');
  }
}
